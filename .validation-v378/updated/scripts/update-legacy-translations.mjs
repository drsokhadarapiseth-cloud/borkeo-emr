import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
let html = fs.readFileSync(path.join(ROOT, 'legacy-html', 'EMR.html'), 'utf8');
html = html.replace('opt_tb: "ជំងឺរបេង",', 'opt_tb: "ជំងឺរបេង", opt_infectious: "ផ្នែកជំងឺឆ្លង", opt_eyecare: "មណ្ឌលថែទាំភ្នែក",');
html = html.replace('opt_tb: "Tuberculosis (TB)",', 'opt_tb: "Tuberculosis (TB)", opt_infectious: "Infectious Diseases Ward", opt_eyecare: "Eye Care Service",');
fs.writeFileSync(path.join(ROOT, 'legacy-html', 'EMR.html'), html, 'utf8');
console.log('Updated legacy-html/EMR.html translations');
