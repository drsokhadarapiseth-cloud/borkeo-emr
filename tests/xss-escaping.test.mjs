import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import '../public/escape-html.js';
import { applySecurityHeaders } from '../server/security.mjs';
import { createEmrServer } from '../server/server.mjs';

const { escapeHtml, html, rawHtml } = globalThis;

test('escapeHtml helper properly escapes HTML and attribute special characters', () => {
  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml(`" onfocus="alert('xss')`), '&quot; onfocus=&quot;alert(&#39;xss&#39;)');
  assert.equal(escapeHtml('& < > " \''), '&amp; &lt; &gt; &quot; &#39;');
  assert.equal(escapeHtml(''), '');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(12345), '12345');
  assert.equal(escapeHtml(0), '0');
  assert.equal(escapeHtml(false), 'false');
});

test('html tagged template helper automatically escapes variables while keeping markup safe', () => {
  const patientName = '<script>alert("hacked")</script>';
  const patientBed = '101" onclick="evil()';
  const markup = html`<div class="patient-card" data-bed="${patientBed}"><strong>${patientName}</strong></div>`;

  assert.ok(!markup.includes('<script>'), 'Must not contain raw script tag');
  assert.ok(!markup.includes('onclick="evil()"'), 'Must not break out of attribute');
  assert.ok(markup.includes('&lt;script&gt;alert(&quot;hacked&quot;)&lt;/script&gt;'));
  assert.ok(markup.includes('data-bed="101&quot; onclick=&quot;evil()"'));
});

test('html tagged template handles rawHtml and arrays correctly', () => {
  const safeBadge = rawHtml('<span class="badge">Safe</span>');
  const items = ['<Item 1>', '<Item 2>'];
  const markup = html`<div>${safeBadge}<ul>${items.map(it => html`<li>${it}</li>`)}</ul></div>`;

  assert.ok(markup.includes('<span class="badge">Safe</span>'), 'rawHtml should remain unescaped');
  assert.ok(markup.includes('<li>&lt;Item 1&gt;</li>'), 'array items should be escaped');
  assert.ok(markup.includes('<li>&lt;Item 2&gt;</li>'), 'array items should be escaped');
});

test('rendering patient data containing XSS payloads into UI templates escapes malicious payloads', () => {
  const maliciousPatient = {
    id: 'pt-1001" onmouseover="alert(\'id\')',
    fullName: 'Chea Vanna <img src=x onerror=alert(1)>',
    caseNumber: 'BN-2026-0001<script>',
    chiefComplaint: 'Severe headache & fever <script>fetch("http://evil.com")</script>',
    diagnosis: 'Hypertension "><script>alert(document.cookie)</script>',
    ward: 'ICU" data-malicious="true',
    photoUrl: 'javascript:alert(1)',
  };

  // Simulating patient list card rendering
  const patientCard = html`
    <tr class="patient-row" data-id="${maliciousPatient.id}">
      <td class="name">${maliciousPatient.fullName}</td>
      <td class="case">${maliciousPatient.caseNumber}</td>
      <td class="complaint">${maliciousPatient.chiefComplaint}</td>
      <td class="diag">${maliciousPatient.diagnosis}</td>
      <td class="ward">${maliciousPatient.ward}</td>
    </tr>
  `;

  assert.ok(!patientCard.includes('<img src=x onerror=alert(1)>'), 'Image injection must be escaped');
  assert.ok(!patientCard.includes('<script>'), 'Script tag must be escaped');
  assert.ok(!patientCard.includes('onmouseover="alert'), 'Attribute injection must be escaped');
  assert.ok(patientCard.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(patientCard.includes('&lt;script&gt;fetch(&quot;http://evil.com&quot;)&lt;/script&gt;'));
  assert.ok(patientCard.includes('&quot; onmouseover=&quot;alert(&#39;id&#39;)'));
});

test('Content Security Policy maintains strict policy without unsafe-inline on standard pages', () => {
  const mockHeaders = {};
  const mockResponse = {
    setHeader(name, value) {
      mockHeaders[name.toLowerCase()] = value;
    },
  };

  applySecurityHeaders(mockResponse, { legacy: false });
  const csp = mockHeaders['content-security-policy'];
  assert.ok(csp, 'CSP header must be set');

  // Verify non-legacy CSP contains script-src 'self'
  assert.match(csp, /script-src\s+'self'/, "Standard CSP must specify script-src 'self'");
  // Verify non-legacy CSP does NOT contain 'unsafe-inline'
  const scriptSrcDirective = csp.split(';').map(s => s.trim()).find(s => s.startsWith('script-src'));
  assert.ok(scriptSrcDirective, 'script-src directive must exist in CSP');
  assert.ok(!scriptSrcDirective.includes("'unsafe-inline'"), "Standard CSP must never allow 'unsafe-inline' in script-src");
  assert.ok(!scriptSrcDirective.includes('https://'), 'Standard CSP must not allow external CDNs in script-src');
});

test('escape-html.js is served by EMR server as valid static script', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-xss-test-'));
  const dbPath = path.join(tempDir, 'xss-test.sqlite');

  const app = createEmrServer({
    demoMode: false,
    host: '127.0.0.1',
    port: 33855,
    appOrigin: 'http://127.0.0.1:33855',
    databasePath: dbPath,
    nodeEnv: 'test',
  });

  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(33855, '127.0.0.1', resolve);
  });

  try {
    const res = await fetch('http://127.0.0.1:33855/public/escape-html.js');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/javascript/);
    const body = await res.text();
    assert.ok(body.includes('escapeHtml'));
    assert.ok(body.includes('rawHtml'));
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    if (app.database?.close) app.database.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
});
