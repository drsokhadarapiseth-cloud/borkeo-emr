// Run from the extracted update: node scripts/apply-v292-update.mjs "PATH_TO_EXISTING_EMR"
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Provide the existing v29.1 project folder. Stop its server first.');
if(source===target)throw Error('Extract the update to a separate folder before applying it.');
const version=JSON.parse(fs.readFileSync(path.join(target,'package.json'),'utf8')).version;
if(version!=='29.1.0')throw Error('This update requires v29.1.0. Found '+version+'.');
const files=['server/icd10.mjs','server/server.mjs','public/emr-icd10.js','public/emr-icd10.css','public/login.html','protected/EMR.html','data/icd10/catalogue.sqlite','data/icd10/IMPORT_REPORT.json','tests/v292-icd10-search.test.mjs','tests/v288-ipd-medical-record-access.test.mjs','Borkeo_EMR_v29.2_UPDATE.txt','package.json'];
for(const file of files)if(!fs.existsSync(path.join(source,file)))throw Error('Missing update file: '+file);
const backup=path.join(target,'.backup_v292_'+Date.now());fs.mkdirSync(backup,{recursive:true});
const saved=[];
try{
 for(const file of files){const dest=path.join(target,file),prior=fs.existsSync(dest);if(prior){const b=path.join(backup,file);fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(dest,b);}saved.push({file,prior});fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(source,file),dest);}
 console.log('Installed v29.2. Patient databases and configuration were not replaced. Backup: '+backup);
}catch(error){for(const {file,prior} of saved.reverse()){const dest=path.join(target,file);if(prior)fs.copyFileSync(path.join(backup,file),dest);else fs.rmSync(dest,{force:true});}throw error;}
