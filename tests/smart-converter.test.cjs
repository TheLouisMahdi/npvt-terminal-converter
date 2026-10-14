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
