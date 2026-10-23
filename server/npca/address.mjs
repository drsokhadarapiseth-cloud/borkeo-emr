import fs from 'node:fs';
import path from 'node:path';
import { projectRoot } from '../config.mjs';
let provinces;
const districts=new Map();
export function canonicalAddress(address) {
  provinces ||= JSON.parse(fs.readFileSync(path.join(projectRoot,'data/gazetteer/provinces.json'),'utf8'));
  const p=provinces.find(p=>p.code===address?.province?.code);if(!p)return null;
  if(!districts.has(p.id))districts.set(p.id,JSON.parse(fs.readFileSync(path.join(projectRoot,'data/gazetteer/provinces',p.id+'.json'),'utf8')));
  const d=districts.get(p.id).find(d=>d.code===address.district?.code),c=d?.communes?.find(c=>c.code===address.commune?.code),v=c?.villages?.find(v=>v.code===address.village?.code);
  if(!d||!c||!v)return null;
  return Object.fromEntries([['province',p],['district',d],['commune',c],['village',v]].map(([level,node])=>[level,{code:node.code,name:node.local}]));
}
export function validAddress(address){const canonical=canonicalAddress(address);return Boolean(canonical&&Object.entries(canonical).every(([level,node])=>address[level]?.code===node.code&&address[level]?.name===node.name));}
