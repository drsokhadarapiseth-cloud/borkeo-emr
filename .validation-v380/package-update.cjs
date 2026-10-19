const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const base='.validation-v380/baseline';
const files=JSON.parse(fs.readFileSync('.validation-v380/changed.json','utf8')).map(file=>file.replaceAll('\\','/'));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest=[],patches=[];
for(const file of files){
 const target=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n').replace(/\n/g,'\r\n');fs.writeFileSync(file,target,'utf8');
 const original=path.posix.join(base,file),exists=fs.existsSync(original);
 manifest.push({path:file,base_sha256:exists?sha(original):null,target_sha256:sha(file)});
 if(exists){
  const result=cp.spawnSync('git',['-c','core.autocrlf=true','diff','--no-index','--no-ext-diff','--no-color','--',original,file],{encoding:'utf8'});
  if(result.status!==1)throw Error('Diff failed '+file+': '+result.stderr);
  let patch=result.stdout.replace(/\r\n/g,'\n');
  patch=patch.replace(/^diff --git .*$/m,`diff --git a/${file} b/${file}`).replace(/^--- .*$/m,`--- a/${file}`).replace(/^\+\+\+ .*$/m,`+++ b/${file}`);
  patches.push(patch);
 }else{
  const text=target.replace(/\r\n/g,'\n'),lines=text.split('\n');if(lines.at(-1)==='')lines.pop();
  patches.push(`diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n`+lines.map(line=>'+'+line+'\n').join('')+(text.endsWith('\n')?'':'\\ No newline at end of file\n'));
 }
}
fs.writeFileSync('.validation-v380/update380.diff',patches.join(''),'utf8');
fs.writeFileSync('.validation-v380/manifest.json',JSON.stringify(manifest,null,2),'utf8');
console.log(JSON.stringify({files:files.length,patchBytes:Buffer.byteLength(patches.join(''))}));
