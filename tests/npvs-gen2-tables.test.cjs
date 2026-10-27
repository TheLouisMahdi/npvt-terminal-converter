'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');

const runtime=fs.readFileSync(path.join(__dirname,'..','tools','npvs-browser-runtime.js'),'utf8');
const env=vm.createContext({Uint8Array,Uint32Array,TextEncoder,TextDecoder,DataView,BigInt,Map,Set,Object,crypto:crypto.webcrypto,atob,btoa,Blob,DecompressionStream});
vm.runInContext(runtime,env);
function call(expression,vars={}){
  Object.assign(env,vars);
  return vm.runInContext(expression,env);
}
const count=13*57344+4096;

test('A16 lookup dimensions, synthetic table execution and input rejection',()=>{
  const tables=new Uint8Array(count);
  for(let i=0;i<16;i++)tables[count-4096+i*256]=i+1;
  const salt=new Uint8Array(16).fill(17);
  const result=call('npvsGen2DeriveA16(t,s)',{t:tables,s:salt});
  assert.deepEqual([...result],Array.from({length:16},(_,i)=>i+1));
  assert.throws(()=>call('npvsGen2DeriveA16(t,s)',{t:tables.slice(1),s:salt}),/dimensions/);
  assert.throws(()=>call('npvsGen2DeriveA16(t,s)',{t:tables,s:salt.slice(1)}),/dimensions/);
});

test('lookup table import never accepts invalid data as a trusted key source',()=>{
  const fake=new Uint8Array(count);
  assert.throws(()=>call('npvsInstallGen2Tables(t)',{t:fake}),/compatibility self-test/);
  assert.equal(call('npvsHasGen2Key(new Uint8Array(16),new Uint8Array(16))'),false);
  assert.throws(()=>call('npvsInstallGen2Tables(t)',{t:fake.slice(1)}),/exactly/);
  assert.equal(call('npvsHasGen2Key(new Uint8Array(16),new Uint8Array(16))'),false);
});

test('a compressed table import enforces the decompressed size before using it',async()=>{
  const zlib=require('node:zlib');
  const data=zlib.deflateSync(Buffer.alloc(1024,2));
  const file={size:data.length,arrayBuffer:async()=>Uint8Array.from(data).buffer};
  await assert.rejects(call('npvsReadGen2TableFile(f)',{f:file}),/invalid decompressed/);
  assert.equal(call('npvsHasGen2Key(new Uint8Array(16),new Uint8Array(16))'),false);
});

test('stale table import cannot reinstall key data after reset',async()=>{
  const data=new Uint8Array(count);
  const file={size:data.length,arrayBuffer:async()=>data.buffer};
  const ok=await call('npvsReadGen2TableFile(f,()=>false)',{f:file});
  assert.equal(ok,false);
  assert.equal(call('npvsHasGen2Key(new Uint8Array(16),new Uint8Array(16))'),false);
});

test('published compatibility vectors: optional locally supplied legal table asset',()=>{
  const name=process.env.NPVS_COMPAT_TABLE_FILE;
  if(!name){return;}
  const data=new Uint8Array(fs.readFileSync(name));
  const vectors=[
    ['b3e16e38809576cbf6aaafd638b6b070','ffd6b86349231c14b37f6c929e24cd42'],
    ['000102030405060708090a0b0c0d0e0f','f659c73d8c0fa5150e3254dfe0a1106d'],
    ['f7c7701d0117e9f1f0ce9508abb11519','9821914745243955b1bdde3b7952303e'],
    ['c45a3c0407fcc90458a59f7b9d762617','e34dd0a6557a2a2dd41836e3d83740bc'],
    ['2eb61dd803807ce1f73f10aa8ae97711','8eb1c4b1fa21daa7e4de7b8e4864f79a'],
    ['00000000000000000000000000000000','4878126b14231f6f522f310686001524'],
    ['50d72fa987791d011e5d83e3e36ea971','036ab758c7e097dc77b24b995908628a']
  ];
  for(const [salt,expected] of vectors){
    const derived=call('npvsGen2DeriveA16(t,s)',{t:data,s:new Uint8Array(Buffer.from(salt,'hex'))});
    assert.equal(Buffer.from(derived).toString('hex'),expected,'salt: '+salt);
  }
  assert.equal(call('npvsInstallGen2Tables(t)',{t:data}),true);
  assert.equal(call('npvsHasGen2Key(new Uint8Array(16),new Uint8Array(16))'),true);
  call('npvsClearGen2Keys()');
  assert.equal(call('npvsHasGen2Key(new Uint8Array(16),new Uint8Array(16))'),false);
});

test('published authorized Gen-2 v5 AppKey fixture decrypts only after compatible table import',async()=>{
  const tableName=process.env.NPVS_COMPAT_TABLE_FILE;
  const fileName=process.env.NPVS_COMPAT_FIXTURE_FILE;
  if(!tableName||!fileName)return;
  const binary=new Uint8Array(fs.readFileSync(fileName));
  call('npvsClearGen2Keys()');
  const before=await call('npvsPhase2Decode(binary,"")',{binary});
  assert.equal(before.status,'locked');
  assert.equal(before.unlock,'app-key');
  call('npvsInstallGen2Tables(t)',{t:new Uint8Array(fs.readFileSync(tableName))});
  const decrypted=await call('npvsPhase2Decode(binary,"")',{binary});
  assert.equal(decrypted.status,'unlocked');
  assert.equal(decrypted.version,5);
  assert.equal(decrypted.unlock,'app-key');
  assert.ok(Array.isArray(decrypted.obj.configs));
  assert.ok(decrypted.obj.configs.length>0);
  call('npvsClearGen2Keys()');
});
