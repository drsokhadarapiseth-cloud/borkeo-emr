import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

function replaceInFile(filePath, searchStr, replaceStr) {
  let content = fs.readFileSync(filePath, 'utf8');
  const isCrlf = content.includes('\r\n');
  const norm = s => s.replace(/\r\n/g, '\n');
  let normContent = norm(content);
  let normSearch = norm(searchStr);
  let normReplace = norm(replaceStr);

  if (!normContent.includes(normSearch)) {
    console.error(`Could not find search string in ${filePath}`);
    return false;
  }
  normContent = normContent.replace(normSearch, normReplace);
  fs.writeFileSync(filePath, isCrlf ? normContent.replace(/\n/g, '\r\n') : normContent, 'utf8');
  console.log(`Updated ${filePath}`);
  return true;
}

// 1. Update package.json version 36.9.0 -> 37.0.0
const pkgPath = path.join(ROOT, 'package.json');
let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = '37.0.0';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log('Updated package.json to v37.0.0');

// 2. Update public/login.html
const loginPath = path.join(ROOT, 'public', 'login.html');
let loginContent = fs.readFileSync(loginPath, 'utf8');
loginContent = loginContent.replace(/v36\.9/g, 'v37.0');
fs.writeFileSync(loginPath, loginContent, 'utf8');
console.log('Updated public/login.html to v37.0');

// 3. Update server/server.mjs
const serverPath = path.join(ROOT, 'server', 'server.mjs');
let serverContent = fs.readFileSync(serverPath, 'utf8');
serverContent = serverContent.replace(/Borkeo EMR v36\.9/g, 'Borkeo EMR v37.0');
fs.writeFileSync(serverPath, serverContent, 'utf8');
console.log('Updated server/server.mjs to v37.0');

// 4. Update cache busters to ?v=3700 across templates
for (const rel of [
  'protected/EMR.html',
  'legacy-html/EMR.html',
  'protected/patient-list.html',
  'protected/triage.html',
  'protected/health-facility.html',
]) {
  const filePath = path.join(ROOT, rel);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/\?v=3690/g, '?v=3700');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated cache busters in ${rel}`);
  }
}

// 5. Update public/health-facility.js for renderBankTable actions alignment
const oldActionsCode = `const actions=r.insertCell();actions.append(button(txt('កែ','Edit'),()=>{row.scrollIntoView({behavior:'smooth',block:'center'});row.querySelector('input').focus();}),button(txt('លុប','Remove'),()=>{if(!confirm(txt('តើអ្នកពិតជាចង់លុបគណនីធនាគារនេះមែនទេ?','Remove bank account? Save afterward to confirm.')))return;row.remove();dirty=true;renderBankTable();},'hf-remove'));`;

const newActionsCode = `const actions=r.insertCell();actions.className='hf-table-actions-cell';actions.append(button(txt('កែ','Edit'),()=>{row.scrollIntoView({behavior:'smooth',block:'center'});row.querySelector('input').focus();},'hf-table-btn hf-table-edit'),button(txt('លុប','Remove'),()=>{if(!confirm(txt('តើអ្នកពិតជាចង់លុបគណនីធនាគារនេះមែនទេ?','Remove bank account? Save afterward to confirm.')))return;row.remove();dirty=true;renderBankTable();},'hf-table-btn hf-table-delete'));`;

replaceInFile(path.join(ROOT, 'public', 'health-facility.js'), oldActionsCode, newActionsCode);

// 6. Update public/health-facility.css for table actions alignment and button styles
const cssPath = path.join(ROOT, 'public', 'health-facility.css');
let cssContent = fs.readFileSync(cssPath, 'utf8');

const tableActionStyles = `
.hf-table-wrap th:last-child,
.hf-table-wrap td:last-child {
  text-align: center;
  vertical-align: middle;
  white-space: nowrap;
}
.hf-table-actions-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  vertical-align: middle;
  white-space: nowrap;
}
.hf-table-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-height: 34px !important;
  height: 34px !important;
  padding: 0 14px !important;
  margin: 0 !important;
  border-radius: 8px !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  box-sizing: border-box !important;
  cursor: pointer !important;
  line-height: 1 !important;
  transition: all 0.16s ease !important;
}
.hf-table-edit {
  background: #f0fdf4 !important;
  border: 1px solid #86efac !important;
  color: #166534 !important;
}
.hf-table-edit:hover {
  background: #dcfce7 !important;
  border-color: #4ade80 !important;
}
.hf-table-delete {
  background: #fff5f3 !important;
  border: 1px solid #e4c9c2 !important;
  color: #9b3f36 !important;
}
.hf-table-delete:hover {
  background: #fee2e2 !important;
  border-color: #f87171 !important;
}
`;

if (!cssContent.includes('.hf-table-actions-cell')) {
  cssContent += tableActionStyles;
  fs.writeFileSync(cssPath, cssContent, 'utf8');
  console.log('Appended table action alignment styles to public/health-facility.css');
}

console.log('All v37.0 updates applied successfully!');
