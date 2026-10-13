'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'Index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if(!script)throw new Error('Missing inline script');
const boundary=script.indexOf("document.addEventListener('dragover'");
if(boundary<0)throw new Error('Missing script boundary');
const context=vm.createContext({URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,atob,btoa,setTimeout,clearTimeout});
vm.runInContext(script.slice(0,boundary),context,{filename:'Index.html'});
const key='eCtXsJZ27+4PbhDkHnB923tkUn2Gj59wZw5wFA75MnU=';
const publicKey='Cr8hWlKvtDt7nrvf+f0brNQQzabAqrjfBvas9pmowjo=';
const items=[
 {type:'snell',name:'Snell-v4',server:'snell.example.org',port:44046,psk:'example-secret',version:4,'obfs-opts':{mode:'http',host:'www.example.org'}},
 {type:'trusttunnel',name:'TrustTunnel',server:'trust.example.org',port:443,username:'alice',password:'example-password',quic:false,sni:'trust.example.org'},
 {type:'shadowquic',name:'ShadowQUIC',server:'sq.example.org',port:10443,username:'alice',password:'example-password',alpn:['h3'],'quic-versions':['v1']},
 {type:'mieru',name:'Mieru',server:'mieru.example.org',port:2999,transport:'TCP',username:'alice',password:'example-password',multiplexing:'MULTIPLEXING_LOW'},
 {type:'wireguard',name:'AWG-v3-1','private-key':key,ip:'10.7.0.2',server:'192.0.2.10',port:51820,'public-key':publicKey,'allowed-ips':['0.0.0.0/0'],udp:true,'amnezia-wg-option':{version:3,jc:5,jmin:100,jmax:200,s1:0,s2:0,s3:0,s4:0,h1:123456,h2:234567,h3:345678,h4:456789,'header-protection-key':key,'random-trailers':true,'disable-cookies':true}}
];
const output=path.join(root,'tests','generated-mihomo');
fs.mkdirSync(output,{recursive:true});
for(const proxy of items){
 const json=JSON.stringify({proxies:[proxy]});
 const yaml=vm.runInContext('nativeFormatConvert('+JSON.stringify(json)+',"yaml")',context);
 const base=proxy.type==='wireguard'?'amneziawg-v3.1':proxy.type;
 fs.writeFileSync(path.join(output,base+'.yaml'),yaml);
 console.log('Generated '+base+'.yaml');
}
