'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');

const code=fs.readFileSync(path.join(__dirname,'..','tools','npvs-browser-runtime.js'),'utf8');
const context=vm.createContext({Uint8Array,Uint32Array,TextEncoder,TextDecoder,DataView,BigInt,Map,Set,Object,crypto:crypto.webcrypto,atob,btoa});
vm.runInContext(code,context);
function call(name,args){context.args=args;return vm.runInContext(`${name}(...args)`,context);}
function U32(n){const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;}
function B16(n){const b=Buffer.alloc(2);b.writeUInt16BE(n);return b;}
const password='test-only-password';
function seal(key,nonce,plaintext,aad=Buffer.alloc(0)){
  const cipher=crypto.createCipheriv('chacha20-poly1305',key,nonce,{authTagLength:16});
  cipher.setAAD(aad,{plaintextLength:plaintext.length});
  return Buffer.concat([cipher.update(plaintext),cipher.final(),cipher.getAuthTag()]);
}
function fixtureGen1(){
  const salt=crypto.randomBytes(16),kdk=crypto.pbkdf2Sync(password,salt,500,32,'sha256'),dek=crypto.randomBytes(32);
  const wrap=Buffer.concat([crypto.randomBytes(12)]);
  const env={v:1,passphrase:{kdf:'pbkdf2-hmac-sha256',iters:500,salt:salt.toString('base64url'),wrap:Buffer.concat([wrap,seal(kdk,wrap,dek,salt)]).toString('base64url')}};
  const header=Buffer.from(JSON.stringify(env));
  const nonce=crypto.randomBytes(12);
  const body=Buffer.from(JSON.stringify({configs:[{name:'Synthetic',v2rayProfile:{configType:5,server:'example.org',serverPort:'443',password:'f47ac10b-58cc-4372-a567-0e02b2c3d4e5',method:'none'}}]}));
  const sealed=seal(dek,nonce,body,header);
  return Buffer.concat([Buffer.from([78,80,86,83,1]),U32(header.length),header,nonce,U32(sealed.length),sealed,Buffer.alloc(64)]);
}
function fixtureGen2(){
  const configID=crypto.randomBytes(16),creator=crypto.randomBytes(33),salt=crypto.randomBytes(16),dek=crypto.randomBytes(32),nonce=crypto.randomBytes(12),iters=500;
  const kdk=crypto.pbkdf2Sync(password,salt,iters,32,'sha256'),wrapNonce=crypto.randomBytes(12);
  const wrap=Buffer.concat([wrapNonce,seal(kdk,wrapNonce,dek,salt)]);
  const prefix=Buffer.concat([Buffer.from([1]),configID,creator,Buffer.from([1]),B16(0),U32(iters),salt,wrap]);
  const metaKey=crypto.hkdfSync('sha256',dek,nonce,'NPVS-v5/metadata',32);
  const meta=seal(metaKey,nonce,Buffer.from('{"policy":{}}'),prefix);
  const header=Buffer.concat([prefix,U32(meta.length),meta]);
  const contentID=crypto.randomBytes(32);
  const seq=65535,plain=Buffer.from(JSON.stringify({configs:[{name:'Synthetic',v2rayProfile:{configType:5,server:4,serverPort:3,password:2,method:1}}]}));
  const fieldKey=crypto.hkdfSync('sha256',dek,contentID,Buffer.concat([Buffer.from('NPV-fields-v1/field/'),B16(seq)]),32);
  const aad=Buffer.concat([Buffer.from('NPV-fields-v1/record/'),contentID,B16(seq),U32(plain.length)]);
  const rows=[];const records=[[1,'none'],[2,'f47ac10b-58cc-4372-a567-0e02b2c3d4e5'],[3,'443'],[4,'example.org'],[65535,plain]];
  for(const [n,value] of records){
    const plaintext=Buffer.isBuffer(value)?value:Buffer.from(value);
    const fk=crypto.hkdfSync('sha256',dek,contentID,Buffer.concat([Buffer.from('NPV-fields-v1/field/'),B16(n)]),32);
    const aa=Buffer.concat([Buffer.from('NPV-fields-v1/record/'),contentID,B16(n),U32(plaintext.length)]);
    const blob=seal(fk,Buffer.alloc(12),plaintext,aa);
    rows.push(Buffer.concat([B16(n),B16(0),B16(blob.length),blob]));
  }
  const body=Buffer.concat([Buffer.from([78,80,70,1]),contentID,B16(rows.length),...rows]);
  return Buffer.concat([Buffer.from([78,80,86,83,5]),U32(header.length),header,nonce,U32(body.length),body,Buffer.alloc(64)]);
}

test('RFC-style ChaCha20-Poly1305 authenticates Node-generated ciphertext',()=>{
  for(let i=0;i<5;i++){
    const key=crypto.randomBytes(32),nonce=crypto.randomBytes(12),aad=crypto.randomBytes(3+i*5),plain=crypto.randomBytes(i*53+1),ct=seal(key,nonce,plain,aad);
    assert.deepEqual(Buffer.from(call('npvsOpen',[key,nonce,ct,aad])),plain);
    ct[ct.length-1]^=1;
    assert.throws(()=>call('npvsOpen',[key,nonce,ct,aad]),/authentication failed/);
  }
});
test('Gen-1 creator passphrase opens only with correct secret',async()=>{
  const file=fixtureGen1();
  assert.equal((await call('npvsPhase2Decode',[file,''])).status,'locked');
  await assert.rejects(call('npvsPhase2Decode',[file,'incorrect']),/authentication failed/);
  const v=await call('npvsPhase2Decode',[file,password]);
  assert.equal(v.status,'unlocked');assert.equal(v.version,1);assert.equal(v.obj.configs[0].name,'Synthetic');
});
test('Gen-2 creator passphrase authenticates metadata and fields',async()=>{
  const file=fixtureGen2();
  assert.equal((await call('npvsPhase2Decode',[file,''])).status,'locked');
  const v=await call('npvsPhase2Decode',[file,password]);
  assert.equal(v.status,'unlocked');
  assert.equal(v.obj.configs[0].v2rayProfile.password,'f47ac10b-58cc-4372-a567-0e02b2c3d4e5');
  assert.equal(v.obj.configs[0].v2rayProfile.server,'example.org');
});
test('Gen-2 corrupted field tag and wrong passphrase are rejected',async()=>{
  const file=fixtureGen2();
  await assert.rejects(call('npvsPhase2Decode',[file,'incorrect']),/authentication failed/);
  const changed=Buffer.from(file);changed[changed.length-66]^=1; // Last bytes of sealed field (not signature)
  await assert.rejects(call('npvsPhase2Decode',[changed,password]),/authentication failed/);
});
function lockedV5(method){
  const id=crypto.randomBytes(16),creator=crypto.randomBytes(33),count=method===0?1:0;
  const head=Buffer.concat([
    Buffer.from([1]),id,creator,Buffer.from([method]),B16(count),
    ...(method===0?[Buffer.alloc(125)]:[]),
    ...(method===2?[B16(2),Buffer.alloc(16),Buffer.alloc(60)]:[]),
    U32(16),Buffer.alloc(16)
  ]);
  const body=Buffer.concat([Buffer.from([78,80,70,1]),Buffer.alloc(32),B16(0)]);
  return Buffer.concat([Buffer.from('NPVS'),Buffer.from([5]),U32(head.length),head,
    Buffer.alloc(12),U32(body.length),body,Buffer.alloc(64)]);
}
test('Gen-2 app-key stays inspection-only with a valid envelope',async()=>{
  const result=await call('npvsPhase2Decode',[lockedV5(2),'']);
  assert.equal(result.status,'locked');
  assert.equal(result.unlock,'app-key');
});
test('Gen-2 recipient-key remains locked with a valid envelope',async()=>{
  const result=await call('npvsPhase2Decode',[lockedV5(0),'']);
  assert.equal(result.status,'locked');
  assert.equal(result.unlock,'recipient-private-key');
});

test('Gen-1 app-key can import unattended if existing legacy CTR key matches',async()=>{
  context.ctrCrypt=()=>new Uint8Array(16).fill(0x5a);
  const salt=crypto.randomBytes(16),nonce=crypto.randomBytes(12),dek=crypto.randomBytes(32),wrapNonce=crypto.randomBytes(12);
  const kdk=crypto.createHash('sha256').update('npvtunnel/appkey/v1 ').update(Buffer.alloc(16,0x5a)).digest();
  const wrap=Buffer.concat([wrapNonce,seal(kdk,wrapNonce,dek,salt)]);
  const header=Buffer.from(JSON.stringify({appKey:{kdf:'wbaes-ctr-sha256',keyId:1,salt:salt.toString('base64url'),wrap:wrap.toString('base64url')}}));
  const plain=Buffer.from('{"configs":[{"name":"Auto","v2rayProfile":{"server":"example.org","serverPort":443,"password":"demo","configType":5}}]}');
  const body=seal(dek,nonce,plain,header);
  const file=Buffer.concat([Buffer.from([78,80,86,83,1]),U32(header.length),header,nonce,U32(body.length),body,Buffer.alloc(64)]);
  const result=await call('npvsPhase2Decode',[file,'']);
  assert.equal(result.status,'unlocked');
  assert.equal(result.unlock,'app-key');
  assert.equal(result.obj.configs[0].name,'Auto');
  delete context.ctrCrypt;
});