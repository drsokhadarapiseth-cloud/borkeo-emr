import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawn} from 'node:child_process';import {DatabaseSync} from 'node:sqlite';import {openDatabase} from '../server/database.mjs';
test('database startup waits for a short existing lock before switching journal mode',{timeout:15000},async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'borkeo-startup-lock-')),file=path.join(directory,'fixture.sqlite');let child,db;
 try{const seed=new DatabaseSync(file);seed.exec('CREATE TABLE synthetic(id INTEGER)');seed.close();
 child=spawn(process.execPath,['--input-type=module','-e',"import {DatabaseSync} from 'node:sqlite';const d=new DatabaseSync(process.argv[1]);d.exec('BEGIN EXCLUSIVE');process.stdout.write('READY');setTimeout(()=>{d.exec('COMMIT');d.close()},600)",file],{windowsHide:true,stdio:['ignore','pipe','pipe']});const exited=new Promise(resolve=>child.once('exit',resolve));
 await new Promise((resolve,reject)=>{child.once('error',reject);child.stdout.once('data',resolve)});db=openDatabase(file);assert.equal(db.sqlite.prepare('PRAGMA busy_timeout').get().timeout,5000);assert.equal(db.sqlite.prepare('PRAGMA journal_mode').get().journal_mode,'wal');db.close();db=null;await exited;
 }finally{db?.close();if(child&&child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}for(const suffix of ['','-wal','-shm'])if(fs.existsSync(file+suffix))fs.unlinkSync(file+suffix);fs.rmdirSync(directory)}
});
