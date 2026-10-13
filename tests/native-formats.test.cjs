'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname,'..','Index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
const cutoff=script.indexOf("document.addEventListener('dragover'");
assert.ok(cutoff>0);
const context=vm.createContext({URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,atob,btoa,setTimeout,clearTimeout});
vm.runInContext(script.slice(0,cutoff),context,{filename:'Index.html',timeout:10000});
const call=(fn,value)=>vm.runInContext(fn+'('+JSON.stringify(value)+')',context,{timeout:5000});
const norm=x=>JSON.parse(JSON.stringify(x));
const key='eCtXsJZ27+4PbhDkHnB923tkUn2Gj59wZw5wFA75MnU=';
const publicKey='Cr8hWlKvtDt7nrvf+f0brNQQzabAqrjfBvas9pmowjo=';
const nodes=[
 {name:'snell',type:'snell',server:'snell.example',port:44046,psk:'secret',version:4,udp:true,'obfs-opts':{mode:'shadow-tls',host:'bing.com',password:'mask',version:3,alpn:['h2']}},
 {name:'TrustTunnel',type:'trusttunnel',server:'trust.example',port:443,username:'user',password:'secret',quic:true,'max-streams':5,alpn:['h3']},
 {name:'ShadowQUIC',type:'shadowquic',server:'shadow.example',port:10443,username:'user',password:'secret','quic-versions':['v1'], 'udp-over-stream':false},
 {name:'Mieru',type:'mieru',server:'mieru.example','port-range':'2090-2099',username:'user',password:'secret',transport:'TCP',multiplexing:'MULTIPLEXING_LOW'},
 {name:'AWG3.1',type:'wireguard','private-key':key,ip:'10.7.0.2/32',server:'192.0.2.10',port:51820,'public-key':publicKey,'allowed-ips':['0.0.0.0/0'],udp:true,
  'amnezia-wg-option':{version:3,jc:5,jmin:100,jmax:200,s1:20,s2:20,s3:20,s4:20,h1:'111-222',h2:333,'header-protection-key':key,'content-padding-addition':'0-32','random-trailers':true,'disable-cookies':true}}
];
test('Five remaining Mihomo families preserve all keys JSON to YAML to JSON',()=>{
  const input={proxies:nodes};
  const yml=vm.runInContext('nativeFormatConvert('+JSON.stringify(JSON.stringify(input))+',"yaml")',context);
  const parsed=norm(call('parseMihomoYaml',yml));
  assert.deepEqual(parsed,input);
  const encoded=vm.runInContext('nativeFormatConvert('+JSON.stringify(yml)+',"json")',context);
  assert.deepEqual(JSON.parse(encoded),input);
});

test('Mihomo inline arrays and comments import',()=>{
 const source="proxies:\n  - name: 'Snell'\n    type: snell\n    server: example.org\n    port: 443\n    psk: secret\n    obfs-opts:\n      mode: http\n      host: bing.com\n    udp: true # required\n  - name: trust\n    type: trusttunnel\n    server: trust.example\n    port: 443\n    username: user\n    password: pw\n    alpn: [h2, h3]\n";
 const p=norm(call('parseMihomoYaml',source));
 assert.equal(p.proxies.length,2);
 assert.equal(p.proxies[0]['obfs-opts'].mode,'http');
 assert.deepEqual(p.proxies[1].alpn,['h2','h3']);
});
test('WireGuard AWG3.1 INI conversions keep version, obfuscation, keys and peer',()=>{
 const ini=['[Interface]','PrivateKey = '+key,'Address = 10.7.0.2/32','AmneziaWGVersion = 3','Jc = 5','Jmin = 100','Jmax = 200','S1 = 20','S2 = 20','S3 = 20','S4 = 20','H1 = 111-222','HeaderProtectionKey = '+key,'ContentPaddingAddition = 0-32','RandomTrailers = true','DisableCookies = true','','[Peer]','PublicKey = '+publicKey,'Endpoint = 192.0.2.10:51820','AllowedIPs = 0.0.0.0/0'].join('\n');
 const parsed=norm(call('parseWireGuardIni',ini));
 assert.equal(parsed.proxies[0]['amnezia-wg-option'].version,3);
 assert.equal(parsed.proxies[0]['amnezia-wg-option']['random-trailers'],true);
 const yaml=vm.runInContext('nativeFormatConvert('+JSON.stringify(ini)+',"yaml")',context);
 const back=vm.runInContext('nativeFormatConvert('+JSON.stringify(yaml)+',"ini")',context);
 assert.match(back,/HeaderProtectionKey = /);
 assert.match(back,/RandomTrailers = true/);
 assert.match(back,/Endpoint = 192\.0\.2\.10:51820/);
});
test('WireGuard multi-peer client keeps distinct peers',()=>{
 const ini=['[Interface]','PrivateKey = '+key,'Address = 10.0.0.2/32','[Peer]','PublicKey = '+publicKey,'Endpoint = server1.example:51820','AllowedIPs = 10.1.0.0/16','[Peer]','PublicKey = '+publicKey,'Endpoint = server2.example:51820','AllowedIPs = 10.2.0.0/16'].join('\n');
 const result=norm(call('parseWireGuardIni',ini));
 assert.equal(result.proxies[0].peers.length,2);
 const back=call('wireGuardToIni',result);
 assert.equal((back.match(/\[Peer\]/g)||[]).length,2);
});
test('Unsupported YAML directives and dangerous mapping keys fail closed',()=>{
 for(const value of ["proxies: &nodes\n  - type: snell\n","proxies:\n  - name: a\n    type: !inject snell\n","proxies:\n  - name: a\n    name: duplicate\n", "proxies:\n  __proto__: hi\n"]){
  assert.throws(()=>call('parseMihomoYaml',value));
 }
});
test('Unsupported WireGuard system scripts and DNS never disappear silently',()=>{
 const base='[Interface]\nPrivateKey = '+key+'\nAddress = 10.1.0.2/32\n';
 for(const option of ['PostUp = iptables -F','DNS = 1.1.1.1']){
  assert.throws(()=>call('parseWireGuardIni',base+option+'\n[Peer]\nPublicKey = '+publicKey+'\nEndpoint = example.org:443'),/Unsupported Interface field/);
 }
});
test('Unsupported native YAML proxy type rejected with explicit message',()=>{
 assert.throws(()=>vm.runInContext('nativeFormatConvert('+JSON.stringify('proxies:\n  - name: new\n    type: juicity\n    server: x\n    port: 443')+',"json")',context),/Unsupported or missing Mihomo node type/);
});


test('TrustTunnel v2 binary deep-link round-trips all TLV fields including unknown tags',()=>{
 const input={type:'trusttunnel-deeplink',version:2,hostname:'example.org',
  addresses:['192.0.2.10:443'],custom_sni:'front.example.org',username:'alice',
  password:'secret',has_ipv6:true,skip_verification:false,
  upstream_protocol:'http3',name:'Test TT',
  dns_upstreams:['1.1.1.1','https://dns.example/dns-query'],
  anti_dpi:true,unknown_tlvs:[{tag:33,data:'AQID'}]};
 const link=call('encodeTrustTunnelDeepLink',input);
 assert.match(link,/^tt:\/\/\?[A-Za-z0-9_-]+$/);
 const decoded=norm(call('parseTrustTunnelDeepLink',link));
 assert.equal(decoded.version,2);
 assert.deepEqual(decoded.addresses,input.addresses);
 assert.deepEqual(decoded.dns_upstreams,input.dns_upstreams);
 assert.equal(decoded.upstream_protocol,'http3');
 assert.deepEqual(decoded.unknown_tlvs,input.unknown_tlvs);
 const reencoded=call('encodeTrustTunnelDeepLink',decoded);
 assert.deepEqual(norm(call('parseTrustTunnelDeepLink',reencoded)),decoded);
});
test('TrustTunnel deep link maps into Mihomo when all fields are representable',()=>{
 const doc={type:'trusttunnel-deeplink',version:2,hostname:'edge.example',addresses:['192.0.2.30:443'],
   username:'alice',password:'secret',skip_verification:false,upstream_protocol:'http3',name:'Tunnel'};
 const uri=call('encodeTrustTunnelDeepLink',doc);
 const yml=vm.runInContext('nativeFormatConvert('+JSON.stringify(uri)+',"yaml")',context);
 const obj=norm(call('parseMihomoYaml',yml));
 assert.equal(obj.proxies[0].type,'trusttunnel');
 assert.equal(obj.proxies[0].quic,true);
 assert.equal(obj.proxies[0].server,'192.0.2.30');
 const uri2=vm.runInContext('nativeFormatConvert('+JSON.stringify(yml)+',"tt")',context);
 assert.equal(norm(call('parseTrustTunnelDeepLink',uri2)).password,'secret');
 const linkOutput=norm(vm.runInContext('linkItemToStandaloneJsonObject({link:'+JSON.stringify(uri)+'})',context));
 assert.equal(linkOutput.proxies[0].username,'alice');
});
test('TrustTunnel subscription-only and unmappable TLVs cannot be silently flattened to Mihomo',()=>{
 const subscription={type:'trusttunnel-deeplink',version:2,subscription_url:'https://example.org/sub'};
 const link=call('encodeTrustTunnelDeepLink',subscription);
 const parsed=norm(call('parseTrustTunnelDeepLink',link));
 assert.equal(parsed.subscription_url,subscription.subscription_url);
 assert.throws(()=>vm.runInContext('nativeFormatConvert('+JSON.stringify(link)+',"yaml")',context),/cannot be represented/);
 const withDns={type:'trusttunnel-deeplink',version:2,hostname:'example.org',
  addresses:['example.org:443'],username:'u',password:'p',dns_upstreams:['1.1.1.1']};
 assert.throws(()=>call('ttToMihomo',withDns),/cannot be represented/);
});
test('TrustTunnel malformed length and invalid URL are rejected',()=>{
 assert.throws(()=>call('parseTrustTunnelDeepLink','tt://?AQE'),/Invalid TrustTunnel TLV length|Truncated/);
 assert.throws(()=>call('encodeTrustTunnelDeepLink',{type:'trusttunnel-deeplink',version:2,subscription_url:'http://example.org'}),/HTTPS/);
});


test('AWG3 header protection rejects short padding or invalid keys before export',()=>{
 const bad={proxies:[{name:'AWG',type:'wireguard','private-key':key,ip:'10.0.0.2/32',
  server:'192.0.2.1',port:51820,'public-key':publicKey,
  'amnezia-wg-option':{version:3,s1:0,s2:20,s3:20,s4:20,'header-protection-key':key}}]};
 assert.throws(()=>vm.runInContext('nativeFormatConvert('+JSON.stringify(JSON.stringify(bad))+',"yaml")',context),/S1-S4 >= 12/);
 bad.proxies[0]['amnezia-wg-option'].s1=20;
 bad.proxies[0]['amnezia-wg-option']['header-protection-key']='invalid';
 assert.throws(()=>vm.runInContext('nativeFormatConvert('+JSON.stringify(JSON.stringify(bad))+',"yaml")',context),/32-byte Base64/);
});
test('WireGuard INI export does not include synthetic version keys',()=>{
 const doc={proxies:[{name:'AWG',type:'wireguard','private-key':key,ip:'10.0.0.2/32',
  server:'192.0.2.1',port:51820,'public-key':publicKey,
  'amnezia-wg-option':{version:3,s1:20,s2:20,s3:20,s4:20,'header-protection-key':key}}]};
 const ini=vm.runInContext('nativeFormatConvert('+JSON.stringify(JSON.stringify(doc))+',"ini")',context);
 assert.doesNotMatch(ini,/AmneziaWGVersion|^Version = /m);
 assert.equal(norm(call('parseWireGuardIni',ini)).proxies[0]['amnezia-wg-option'].version,3);
});


test('Mihomo official indentless proxies list imports without losing top-level keys',()=>{
 const yaml="mixed-port: 7890\nproxies:\n- name: Snell\n  type: snell\n  server: server.example\n  port: 44046\n  psk: secret\nrules:\n- MATCH,DIRECT\n";
 const parsed=norm(call('parseMihomoYaml',yaml));
 assert.equal(parsed.proxies.length,1);
 assert.equal(parsed.proxies[0].psk,'secret');
 assert.deepEqual(parsed.rules,['MATCH,DIRECT']);
 assert.equal(parsed['mixed-port'],7890);
});
