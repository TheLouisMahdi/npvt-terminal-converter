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
const end=script.indexOf("document.addEventListener('dragover'");
const ctx=vm.createContext({URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,atob,btoa,crypto:crypto.webcrypto,window:{crypto:crypto.webcrypto}});
vm.runInContext(script.slice(0,end),ctx,{filename:'Index.html',timeout:20000});
function call(fn,...args){return JSON.parse(JSON.stringify(vm.runInContext(fn+'('+args.map(x=>JSON.stringify(x)).join(',')+')',ctx,{timeout:20000})))}
const uuid='f47ac10b-58cc-4372-a567-0e02b2c3d4e5';
const fixtures=[
 {type:'vless',name:'VLESS',server:'example.org',port:443,uuid,tls:true,servername:'example.org',
  network:'ws','ws-opts':{path:'/ws',headers:{Host:'cdn.example.org'}}},
 {type:'vmess',name:'VMess',server:'example.org',port:443,uuid,alterId:0,cipher:'auto',tls:true,
  servername:'vmess.example.org'},
 {type:'trojan',name:'Trojan',server:'trojan.example.org',port:443,password:'secret',tls:true,
  servername:'trojan.example.org'},
 {type:'ss',name:'SS2022',server:'ss.example.org',port:8388,cipher:'2022-blake3-aes-256-gcm',
  password:'YctPZ6U7xPPcU+gp3u+0tx/tRizJN9K8y+uKlW2qjlI='}
];
test('Mihomo supported basic proxies convert into matching protocol share URIs',()=>{
 for(const node of fixtures){
  const link=call('smartMihomoLinkFromNode',node);
  const kind=link.split('://')[0];
  assert.equal(kind,node.type);
  const parsed=call('smartMihomoNodeFromLink',link);
  assert.equal(parsed.type,node.type);
  assert.equal(parsed.server,node.server);
  assert.equal(parsed.port,node.port);
  assert.equal(parsed.name,node.name);
  if(node.type==='vless')assert.equal(parsed['ws-opts'].headers.Host,node['ws-opts'].headers.Host);
  if(node.type==='ss')assert.equal(parsed.password,node.password);
 }
});
test('Mihomo native JSON exposes link, subscription and Xray output for one simple VLESS',()=>{
 const doc={proxies:[fixtures[0]]};
 const source=call('smartRecognizeText',JSON.stringify(doc));
 const options=call('smartAvailable',[source]);
 assert.match(options.links,/vless:\/\//);
 assert.ok(options.subscription);
 assert.ok(options.xray.includes('"vless"'));
 assert.ok(options.mihomoYaml.includes('vless'));
 assert.equal(options.npvt,undefined);
});
test('VLESS link exposes native Mihomo YAML when no critical fields are dropped',()=>{
 const link=call('smartMihomoLinkFromNode',fixtures[0]);
 const source=call('smartRecognizeText',link);
 const options=call('smartAvailable',[source]);
 assert.ok(options.mihomoYaml.includes('ws-opts'));
 assert.equal(JSON.parse(options.mihomoJson).proxies[0].type,'vless');
});
test('Mihomo unknown encryption or routing and plugin options fail closed',()=>{
 const invalid=[
  {...fixtures[0],udp:true},
  {...fixtures[0],'packet-encoding':'xudp'},
  {...fixtures[3],plugin:'obfs'},
  {...fixtures[0],network:'xhttp'},
  {...fixtures[0],'ws-opts':{path:'/ws',headers:{Host:'cdn.example.org','Authorization':'secret'}}}
 ];
 for(const node of invalid)assert.throws(()=>call('smartMihomoLinkFromNode',node));
});
test('VLESS unsupported native query fields do not silently convert into Mihomo',()=>{
 const weird='vless://'+uuid+'@example.org:443?encryption=none&security=tls&type=xhttp&extra=%7B%7D';
 assert.throws(()=>call('smartMihomoNodeFromLink',weird));
});
test('Mixed basic Mihomo nodes export all share links, not just the first entry',()=>{
 const r=call('smartRecognizeText',JSON.stringify({proxies:fixtures}));
 const outputs=call('smartAvailable',[r]);
 assert.equal(outputs.links.split('\n').length,4);
 assert.equal(outputs.subscription.length>100,true);
 assert.equal(outputs.npvt,undefined);
 assert.equal(outputs.xray,undefined); // multiple native configs cannot be merged without verified semantics
});
