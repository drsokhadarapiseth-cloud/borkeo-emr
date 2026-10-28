// Pair only the two explicitly approved local EMRs. Never print the shared key.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {linkFile,linkSettings} from '../server/referral-link.mjs';
if(fs.existsSync(linkFile)){
 const existing=JSON.parse(fs.readFileSync(linkFile,'utf8'));
 for(const port of [3001,3002]){const link=linkSettings({referralLink:existing.instances?.[port],demoMode:true});if(!link||link.role!==(port===3001?'sender':'receiver')||link.peer!==(port===3001?'http://localhost:3002':'http://127.0.0.1:3001'))throw Error('Unexpected existing local referral pairing; preserved without changes.');}
 if(existing.instances[3001].secret!==existing.instances[3002].secret)throw Error('Local pairing keys do not match; preserved without changes.');
 console.log('Existing local referral pairing preserved.');
}else{
 const secret=crypto.randomBytes(32).toString('hex');
 const instances={'3001':{role:'sender',peer:'http://localhost:3002',secret},'3002':{role:'receiver',peer:'http://127.0.0.1:3001',secret}};
 fs.mkdirSync(path.dirname(linkFile),{recursive:true});
 fs.writeFileSync(linkFile,JSON.stringify({instances},null,2),{flag:'wx',mode:0o600});
 console.log('Local referral pairing created outside both project folders.');
}
