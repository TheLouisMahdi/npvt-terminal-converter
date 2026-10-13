'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');

const html=fs.readFileSync(path.join(__dirname,'..','Index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
const cutoff=script.indexOf("document.addEventListener('dragover'");
assert.ok(cutoff>0);
const ctx=vm.createContext({
  URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,
  atob,btoa,setTimeout,clearTimeout,crypto:crypto.webcrypto
});
vm.runInContext(script.slice(0,cutoff),ctx,{filename:'Index.html',timeout:15000});

function fakeNetmod(object,key='<n3t5yn4^n3tm0d>'){
  const cipher=crypto.createCipheriv('aes-128-ecb',Buffer.from(key),null);
  const binary=Buffer.concat([cipher.update(JSON.stringify(object),'utf8'),cipher.final()]);
  return Buffer.from(binary.toString('base64').match(/.{1,76}/g).join('\n'));
}
function fakeNpvs(){
  const hlen=169,header=Buffer.alloc(hlen);
  header[0]=1;header[50]=1;header.writeUInt32BE(600000,53);
  header.writeUInt32BE(16,133);
  const bytes=Buffer.alloc(9+hlen+16+32+64);
  bytes.write('NPVS',0);bytes[4]=5;bytes.writeUInt32BE(hlen,5);
  header.copy(bytes,9);
  bytes.writeUInt32BE(32,9+hlen+12);
  return bytes;
}
async function decode(data){
 const value=Buffer.from(data);
 return JSON.parse(JSON.stringify(await vm.runInContext('decryptNetMod(new Uint8Array('+JSON.stringify([...value])+'))',ctx)));
}
test('NetMod AES-ECB compatibility decrypts all three published key families',async()=>{
  const mock={Payload:{Value:'GET / HTTP/1.1'},SSH:[{Host:'ssh.example',User:'demo',Pass:'fake'}],Proxy:[{Host:'proxy.example',Port:8080,UseAuth:true}],Note:'Synthetic fixture'};
  for(const key of ['<n3t5yn4^n3tm0d>','_netsyna_netmod_','nicetrybuddygoon']) {
    const out=await decode(fakeNetmod(mock,key));
    assert.deepEqual(out,mock);
  }
});
test('NetMod decoder preserves native SSH/Proxy data rather than mislabeling VLESS',async()=>{
  const out=await decode(fakeNetmod({SSH:[{Host:'sample',Port:22}],Proxy:[],Controls:{SSH:1}}));
  assert.deepEqual(out.SSH,[{Host:'sample',Port:22}]);
  assert.equal(out.protocol,undefined);
});
test('NetMod rejects wrong padding, unknown formats and non-JSON',async()=>{
  await assert.rejects(decode(Buffer.from('not-base64')),/Base64/);
  const garbage=Buffer.alloc(32,17).toString('base64');
  await assert.rejects(decode(Buffer.from(garbage)),/NetMod decryption failed/);
});
test('NPVS v5 header reports required creator passphrase and safe metadata only',()=>{
  const npvs=fakeNpvs();
  const data=JSON.parse(JSON.stringify(vm.runInContext('inspectNpvsV5(new Uint8Array('+JSON.stringify([...npvs])+'))',ctx)));
  assert.equal(data.format,'NPVS');
  assert.equal(data.version,5);
  assert.equal(data.unlock,'creator-passphrase');
  assert.equal(data.iterations,600000);
  assert.equal(data.encrypted,true);
  assert.ok(!Object.keys(data).some(k=>/password|salt|secret|payload/i.test(k)));
});
test('NPVS truncation, incorrect magic and unsupported version are rejected',()=>{
  const base=fakeNpvs();
  const parse=data=>vm.runInContext('inspectNpvsV5(new Uint8Array('+JSON.stringify([...data])+'))',ctx);
  assert.throws(()=>parse(Buffer.alloc(200,0)),/Not an NPVS/);
  assert.throws(()=>parse(base.subarray(0,-1)),/ciphertext length/);
  const version=Buffer.from(base);version[4]=6;
  assert.throws(()=>parse(version),/requires a separate format adapter/);
});
