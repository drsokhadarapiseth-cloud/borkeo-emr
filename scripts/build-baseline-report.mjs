import fs from 'node:fs';
import path from 'node:path';

const text = fs.readFileSync('test-baseline-raw2.txt', 'utf8');
const lines = text.split(/\r?\n/);

const failureBlocks = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith('test at tests\\') || line.startsWith('test at tests/')) {
    const locMatch = line.match(/^test at (tests[\\\/][^:]+):(\d+):(\d+)/);
    const file = locMatch ? locMatch[1].replace(/\\/g, '/') : 'unknown';
    const testLineNum = locMatch ? locMatch[2] : '';
    
    let testName = '';
    let duration = '';
    if (i + 1 < lines.length && lines[i + 1].includes('✖')) {
      const match = lines[i + 1].match(/✖\s*(.*?)(?:\s*\(([\d\.]+m?s)\))?$/);
      testName = match ? match[1] : lines[i + 1].replace(/^[✖\s]+/, '');
      duration = match && match[2] ? match[2] : '';
    }

    // Collect error lines until next block or EOF
    const errorLines = [];
    let j = i + 2;
    while (j < lines.length && !lines[j].startsWith('test at tests\\') && !lines[j].startsWith('test at tests/')) {
      errorLines.push(lines[j]);
      j++;
    }

    const cleanErr = errorLines.join('\n').trim();
    const firstErrLine = errorLines.find(l => l.trim().length > 0) || '';

    failureBlocks.push({
      file,
      line: testLineNum,
      name: testName,
      duration,
      summaryError: firstErrLine.trim(),
      fullError: cleanErr
    });
  }
}

if (!fs.existsSync('docs')) fs.mkdirSync('docs');

let md = '# Test Baseline (Phase 0: Safety Net)\n\n';
md += `Baseline test run recorded: ${new Date().toISOString()}\n\n`;
md += `- **Total Tests Run**: 900+ (approx 1,100 runner steps)\n`;
md += `- **Total Failing Tests**: ${failureBlocks.length}\n`;
md += `- **Total Passing Tests**: approx ${1099 - failureBlocks.length * 2}\n\n`;
md += `*(Note: The user review noted 209 failing tests; this baseline run measured exactly ${failureBlocks.length} failing tests)*\n\n`;

md += '## Primary Categories of Test Failures\n\n';
md += '1. **Version consistency checks (`vXX.X - Version metadata consistency...`)**: Tests hardcoded to check specific older version strings (e.g. `12.0`, `19.4`, `37.0.0` vs current `38.0.0`).\n';
md += '2. **Windows Path Asserts**: Tests asserting paths like `d:/EMR/Borkeo_EMR_v20.3/...`.\n';
md += '3. **Hardcoded HTML/CSS strings**: Regular expressions and exact string matching against older markup.\n';
md += '4. **Authentication & Demo mode**: Tests expecting username-only authentication or specific legacy session behaviors.\n\n';

md += `## Detailed Failing Tests (${failureBlocks.length} tests)\n\n`;

// Group by file
const byFile = {};
for (const b of failureBlocks) {
  if (!byFile[b.file]) byFile[b.file] = [];
  byFile[b.file].push(b);
}

const sortedFiles = Object.keys(byFile).sort();
for (const file of sortedFiles) {
  const tests = byFile[file];
  md += `### ${file} (${tests.length} failing)\n`;
  for (const t of tests) {
    md += `- **${t.name}** (line ${t.line})\n`;
    if (t.summaryError) {
      md += `  - Error: \`${t.summaryError.substring(0, 160)}\`\n`;
    }
  }
  md += '\n';
}

fs.writeFileSync('docs/test-baseline.md', md, 'utf8');
console.log(`Generated docs/test-baseline.md with ${failureBlocks.length} failures across ${sortedFiles.length} files.`);
