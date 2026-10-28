'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const script=fs.readFileSync(path.join(__dirname,'..','Index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const cutoff=script.indexOf("document.addEventListener('dragover'");
assert.ok(cutoff>0);
const ctx=vm.createContext({URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,atob,btoa,crypto:crypto.webcrypto,window:{crypto:crypto.webcrypto}});
vm.runInContext(script.slice(0,cutoff),ctx,{filename:'Index.html',timeout:20000});
const call=(name,...args)=>JSON.parse(JSON.stringify(vm.runInContext(name+'('+args.map(x=>JSON.stringify(x)).join(',')+')',ctx,{timeout:20000})));
const uuid='f47ac10b-58cc-4372-a567-0e02b2c3d4e5';
const vless='vless://'+uuid+'@example.org:443?type=ws&security=tls&encryption=none&host=cdn.example.org&path=%2Fws#Example';
const hy2='hy2://secret@h.example:443?sni=h.example#HY2';
const wg='[Interface]\nPrivateKey = eCtXsJZ27+4PbhDkHnB923tkUn2Gj59wZw5wFA75MnU=\nAddress = 10.3.0.2/32\n\n[Peer]\nPublicKey = Cr8hWlKvtDt7nrvf+f0brNQQzabAqrjfBvas9pmowjo=\nEndpoint = example.org:51820\nAllowedIPs = 0.0.0.0/0';
function val(x){return JSON.parse(JSON.stringify(x));}
test('Advanced native Xray transport or TLS options block lossy links',()=>{
 const basic={protocol:'vless',settings:{vnext:[{address:'edge.example',port:443,users:[{id:uuid,encryption:'none'}]}]},
   streamSettings:{network:'ws',security:'tls',wsSettings:{path:'/ws'},tlsSettings:{serverName:'edge.example'}}};
 const good=call('smartAvailable',[call('smartRecognizeText',JSON.stringify({outbounds:[basic]}))]);
 assert.ok(good.links.includes('vless://'));
 const advanced=JSON.parse(JSON.stringify(basic));
 advanced.streamSettings.tlsSettings.minVersion='1.3';
 const detected=call('smartRecognizeText',JSON.stringify({outbounds:[advanced]}));
 const blocked=call('smartAvailable',[detected]);
 assert.equal(blocked.links,undefined);
 assert.equal(blocked.subscription,undefined);
 assert.equal(blocked.xray.includes('minVersion'),true);
 const extraHeader=JSON.parse(JSON.stringify(basic));
 extraHeader.streamSettings.wsSettings.headers={Host:'front.example','X-Custom':'must-not-drop'};
 const dropped=call('smartAvailable',[call('smartRecognizeText',JSON.stringify({outbounds:[extraHeader]}))]);
 assert.equal(dropped.links,undefined);
});

test('Detect VLESS share links and offer only verified output targets',()=>{
 const r=call('smartRecognizeText',vless);
 assert.equal(r.kind,'links');
 const opts=call('smartAvailable',[r]);
 assert.ok(opts.links.includes('vless://'));
 assert.ok(opts.subscription);
 assert.ok(opts.xray.includes('"outbounds"'));
 assert.ok(opts.npvt.startsWith('NPVT1'));
 assert.equal(opts.singbox,undefined);
 assert.equal(opts.wireguard,undefined);
});
test('Hysteria2 URI offers sing-box native JSON but never legacy NPVT1',()=>{
 const r=call('smartRecognizeText',hy2);
 const o=call('smartAvailable',[r]);
 assert.equal(r.kind,'links');
 assert.ok(o.singbox.includes('"hysteria2"'));
 assert.equal(o.npvt,undefined);
 assert.equal(o.xray,undefined);
});
test('NPVT1 does not trim valid leading + or / Base64 bytes',()=>{
  for(const first of [0xfb,0xff]){
    const nonce=new Uint8Array(16);nonce[0]=first;
    const plain='{"config":"synthetic"}';
    ctx.npvtFixtureNonce=[...nonce];
    ctx.npvtFixturePlain=plain;
    const token=vm.runInContext(`(()=>{
      const n=new Uint8Array(npvtFixtureNonce),ct=ctrCrypt(n,textToBytes(npvtFixturePlain));
      const payload=new Uint8Array(16+ct.length);payload.set(n);payload.set(ct,16);
      return bytesToBase64(payload);
    })()`,ctx);
    assert.equal(token[0],first===0xfb?'+':'/');
    const output=call('decodeNPVTPlainChunks','NPVT1 '+token);
    assert.equal(output[0].text,plain);
  }
});
test('NPVT1 legacy import detects encrypted container from its content',()=>{
 const source=call('smartRecognizeText',vless);
 const encoded=call('smartConvertRecords',[source],'npvt');
 const r=call('smartRecognizeText',encoded);
 assert.equal(r.kind,'npvt');
 const o=call('smartAvailable',[r]);
 assert.ok(o.links.includes('vless://'));
 assert.equal(o.npvt,undefined); // rebuilding would drop native metadata
});
test('WireGuard INI offers Mihomo YAML/JSON plus original INI, no fabricated share URI',()=>{
 const r=call('smartRecognizeText',wg);
 const o=call('smartAvailable',[r]);
 assert.equal(r.kind,'wireguard');
 assert.ok(o.mihomoYaml.includes('wireguard'));
 assert.ok(o.wireguard.includes('[Interface]'));
 assert.equal(o.links,undefined);
 assert.equal(o.xray,undefined);
});
test('Mihomo JSON Snell accepts same-native YAML while blocking Xray conversion',()=>{
 const json=JSON.stringify({proxies:[{type:'snell',name:'Snell',server:'example.org',port:443,psk:'secret'}]});
 const r=call('smartRecognizeText',json);
 const o=call('smartAvailable',[r]);
 assert.equal(r.kind,'mihomo');
 assert.ok(o.mihomoYaml.includes('snell'));
 assert.equal(o.xray,undefined);
 assert.equal(o.links,undefined);
});
test('Dynamic menu rejects unknown JSON and unknown URI instead of inventing protocols',()=>{
 const obj=call('smartRecognizeText','{"hello":"world"}');
 assert.equal(obj.kind,'json');
 const options=call('smartAvailable',[obj]);
 assert.ok(options.json);
 assert.equal(options.npvt,undefined);
 assert.equal(options.links,undefined);
 const weird=call('smartRecognizeText','ssr://not-tested');
 assert.equal(weird.kind,'unsupported');
 assert.equal(Object.keys(call('smartAvailable',[weird])).length,0);
});
test('Batch of mixed share URI formats supports Base64 subscription but not incompatible native Core',()=>{
 const a=call('smartRecognizeText',vless),b=call('smartRecognizeText',hy2);
 const o=call('smartAvailable',[a,b]);
 assert.ok(o.links.includes('hy2://'));
 assert.ok(o.subscription);
 assert.equal(o.npvt,undefined);
 assert.equal(o.xray,undefined);
 assert.equal(o.singbox,undefined);
});
test('Batch merges compatible Mihomo proxies preserving type and fields',()=>{
 const a=call('smartRecognizeText',JSON.stringify({proxies:[{type:'snell',name:'A',server:'a.example',port:443,psk:'abc'}]}));
 const b=call('smartRecognizeText',JSON.stringify({proxies:[{type:'snell',name:'B',server:'b.example',port:443,psk:'def'}]}));
 const o=call('smartAvailable',[a,b]);
 assert.equal(JSON.parse(o.mihomoJson).proxies.length,2);
 assert.ok(o.mihomoYaml.includes('B'));
});
test('Duplicate name across batch prevents producing invalid Mihomo output',()=>{
 const a=call('smartRecognizeText',JSON.stringify({proxies:[{type:'snell',name:'A',server:'a.example',port:443,psk:'abc'}]}));
 assert.equal(call('smartAvailable',[a,a]).mihomoYaml,undefined);
});
test('NetMod JSON preserves SSH data without pretending it is a proxy URI',()=>{
 const r=call('smartRecognizeText',JSON.stringify({SSH:[{Host:'server',Port:22}],Proxy:[],Payload:{Value:'GET /'}}));
 assert.equal(r.kind,'netmod');
 const o=call('smartAvailable',[r]);
 assert.ok(o.netmod.includes('"SSH"'));
 assert.equal(o.links,undefined);
});
test('TrustTunnel link is detected and offers only supported Mihomo native conversion',()=>{
 const doc={type:'trusttunnel-deeplink',version:2,hostname:'example.org',addresses:['example.org:443'],username:'alice',password:'secret',name:'Demo'};
 const uri=call('encodeTrustTunnelDeepLink',doc);
 const r=call('smartRecognizeText',uri);
 const o=call('smartAvailable',[r]);
 assert.equal(r.kind,'tt');
 assert.ok(o.mihomoJson.includes('trusttunnel'));
 assert.ok(o.trusttunnel.startsWith('tt://?'));
 assert.equal(o.npvt,undefined);
});
test('Unknown binary or invalid text is rejected without a false format label',()=>{
 assert.throws(()=>call('smartRecognizeText','some random garbage'),/Unknown configuration format/);
 assert.throws(()=>call('smartRecognizeText','{"proxies":[{"type":"unknown"}]}'),/Unsupported or missing Mihomo/);
});


test('NPVO1 open NPV export imports known profile without password',()=>{
 const open='NPVO1\n'+JSON.stringify({configs:[{v2rayProfile:{
   configType:5,server:'example.org',serverPort:443,password:uuid,
   method:'none',network:'tcp',security:'tls',sni:'example.org'
 }}]});
 const r=call('smartRecognizeText',open);
 assert.equal(r.kind,'npvo');
 const outputs=call('smartAvailable',[r]);
 assert.ok(outputs.links.includes('vless://'));
 assert.equal(outputs.npvt,undefined);
});
test('NPVO1 malformed or unknown profile fails closed instead of returning empty success',()=>{
 assert.throws(()=>call('smartRecognizeText','NPVO1\n{"configs":[]}'),/no configs/);
 assert.throws(()=>call('smartRecognizeText','NPVO1\nnot json'),/Invalid open NPVO1/);
});
test('Content-first detection recognizes legacy NetMod AES-ECB even without NM extension',async()=>{
 const input={SSH:[{Host:'ssh.example.org',Port:22}],Proxy:[],Payload:{Value:'GET /'}};
 const cipher=crypto.createCipheriv('aes-128-ecb',Buffer.from('<n3t5yn4^n3tm0d>'),null);
 const contents=Buffer.from(Buffer.concat([cipher.update(JSON.stringify(input)),cipher.final()]).toString('base64'));
 const file={name:'mystery.txt',size:contents.length,arrayBuffer:async()=>contents.buffer.slice(contents.byteOffset,contents.byteOffset+contents.length)};
 ctx.__smartFile=file;
 const result=await vm.runInContext('smartRecognizeFile(__smartFile)',ctx,{timeout:20000});
 assert.equal(result.kind,'netmod');
 assert.equal(result.obj.SSH[0].Host,'ssh.example.org');
});


function npvoFixture(){
  const enc=v=>'npvs1:'+Buffer.from(String(v)).toString('base64');
  const rows=[];
  for(let i=0;i<68;i++){
    const type=i<51?3:i<58?5:i<64?6:1;
    const p={configType:type,addedTime:1720000000000+i,remarks:enc('Fixture '+i),
      server:enc('example.org'),serverPort:enc(type===3?'8388':'443'),
      password:enc((type===1||type===5)?'f47ac10b-58cc-4372-a567-0e02b2c3d4e5':'synthetic-only-password'),
      tlsAllowInsecure:false};
    if(type===3)p.method=enc('aes-256-gcm');
    if(type===1)Object.assign(p,{method:enc('auto'),network:enc('ws'),headerType:enc('none'),
      security:'',host:enc('cdn.example.org'),path:enc('/ws'),insecure:false});
    if(type===5)Object.assign(p,{method:enc('none'),network:enc(i===57?'grpc':'tcp'),security:enc('tls'),
      sni:enc('example.org'),fingerPrint:enc('chrome'),insecure:false});
    if(type===5&&i===57)Object.assign(p,{mode:enc('gun'),xhttpMode:enc('gun'),
      serviceName:enc('example'),headerType:enc('none')});
    if(type===6)Object.assign(p,{network:enc('tcp'),security:enc('tls'),
      sni:enc('example.org'),insecure:false,headerType:enc('none')});
    rows.push({name:'Synthetic '+i,address:'fixture.example.org',v2rayProfile:p});
  }
  return 'NPVO1\n'+JSON.stringify({configs:rows});
}
test('NPVO1 with .npvs extension maps 68 decoded marker-wrapped profiles without credential loss',()=>{
  const src=npvoFixture();
  const rec=call('smartRecognizeText',src,'fake.npvs');
  assert.equal(rec.kind,'npvo');
  assert.equal(rec.links.length,68);
  const byProto=Object.groupBy(rec.links,l=>l.slice(0,l.indexOf('://')));
  assert.equal(byProto.ss.length,51);
  assert.equal(byProto.vless.length,7);
  assert.equal(byProto.trojan.length,6);
  assert.equal(byProto.vmess.length,4);
  assert.ok(!rec.links.some(l=>l.includes('npvs1:')),'no encoded marker may leak into URI credentials');
  const outputs=call('smartAvailable',[rec]);
  assert.ok(outputs.links.split('\n').length===68);
  const obj=JSON.parse(call('smartConvertRecords',[rec],'json'));
  assert.equal(obj.configs.length,68);
  assert.equal(obj.configs[0].v2rayProfile.server,'example.org');
  assert.equal(obj.configs[0].v2rayProfile.password,'synthetic-only-password');
  assert.equal(obj.configs[57].v2rayProfile.serviceName,'example');
});
test('NPVO1 malformed markers fail closed, never emit damaged proxy URIs',()=>{
  const src=npvoFixture().replace('npvs1:', 'npvs1:????');
  assert.throws(()=>call('smartRecognizeText',src,'bad.npvs'),/Invalid NPVO1 encoded field/);
});
test('NPVO1 refuses incomplete batches and retains all profiles as normalized JSON',()=>{
  let src=npvoFixture();
  const obj=JSON.parse(src.slice(6));
  obj.configs[5].v2rayProfile.unknownNewTransportFlag='force-secret-setting';
  const rec=call('smartRecognizeText','NPVO1\n'+JSON.stringify(obj),'partially-supported.npvs');
  assert.equal(rec.kind,'npvo');
  assert.equal(rec.links.length,0,'do not provide partial links as a complete subscription');
  assert.equal(rec.notes.length,1);
  const available=call('smartAvailable',[rec]);
  assert.equal(available.links,undefined);
  assert.ok(available.json);
  assert.equal(JSON.parse(available.json).configs.length,68);
});
test('NPVO1 rejects conflicting certificate flags rather than dropping TLS options',()=>{
  const data=JSON.parse(npvoFixture().slice(6));
  data.configs[0].v2rayProfile.insecure=true;
  data.configs[0].v2rayProfile.tlsAllowInsecure=false;
  const rec=call('smartRecognizeText','NPVO1\n'+JSON.stringify(data),'flags.npvs');
  assert.equal(rec.links.length,0);
  assert.match(rec.notes[0],/Conflicting TLS/);
});


test('Mixed NPVS batches expose only verified successes and preserve locked source visibility',()=>{
  const unlocked={kind:'npvs-decrypted',name:'ok.npvs',label:'NPVS v1 · AEAD verified',
    links:[vless],text:'{"configs":[]}',obj:{configs:[]},notes:[]};
  const locked={kind:'npvs',name:'locked.npvs',label:'NPVS v5 · locked',
    meta:{format:'NPVS',encrypted:true,reason:'None of the provided keys authenticated'},links:[]};
  const options=call('smartAvailable',[unlocked,locked]);
  assert.equal(options.links,vless,'a locked source must not hide successfully decrypted links');
  assert.equal(options.subscription.includes('vless://'),false,'subscription is base64 encoded');
  assert.equal(options.npvt,undefined,'legacy writer must not misrepresent a mixed batch');
  assert.equal(options.archive,undefined,'encrypted file cannot be exported as readable archive');
  const allLocked=call('smartAvailable',[locked]);
  assert.equal(allLocked.links,undefined,'no fabricated success when none unlocked');
  assert.ok(allLocked.inspection);
});
