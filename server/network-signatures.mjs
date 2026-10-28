import crypto from 'node:crypto';
const privateKey=seed=>crypto.createPrivateKey({key:Buffer.from('302e020100300506032b657004220420'+seed,'hex'),format:'der',type:'pkcs8'});
export const networkPublicKey=seed=>crypto.createPublicKey(privateKey(seed)).export({format:'der',type:'spki'}).subarray(-32).toString('hex');
export const networkSign=(seed,value)=>crypto.sign(null,Buffer.from(value),privateKey(seed)).toString('hex');
export function networkVerify(publicHex,value,signature){
 if(!/^[a-f0-9]{64}$/.test(publicHex||'')||!/^[a-f0-9]{128}$/.test(signature||''))return false;
 try{return crypto.verify(null,Buffer.from(value),crypto.createPublicKey({key:Buffer.from('302a300506032b6570032100'+publicHex,'hex'),format:'der',type:'spki'}),Buffer.from(signature,'hex'))}catch{return false}
}
export const networkRequestText=e=>'emr-network-request:'+JSON.stringify({timestamp:e.timestamp,nonce:e.nonce,body:e.body,from:e.from,to:e.to});
export const networkResponseText=(nonce,body)=>'emr-network-response:'+nonce+JSON.stringify(body);
