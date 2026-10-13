'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'Index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error('Missing inline application script');
const wiring = script.indexOf("document.addEventListener('dragover'");
if (wiring < 0) throw new Error('Missing app initialization boundary');

const context = vm.createContext({
  URL, URLSearchParams, TextEncoder, TextDecoder, Uint8Array, atob, btoa,
  setTimeout, clearTimeout
});
vm.runInContext(script.slice(0, wiring), context, {filename: 'Index.html'});

const fixtures = {
  'anytls.json': 'anytls://pass@example.org:443/?sni=example.org#AnyTLS',
  'hysteria2-gecko.json': 'hysteria2://pass@example.org:443,5000-6000/?obfs=gecko&obfs-password=mask&sni=example.org#Gecko',
  'hysteria2-realm.json': 'hysteria2+realm://token@realm.example/room?auth=pass&stun=stun.example.org&sni=example.org#Realm',
  'shadowsocks-sip003.json': 'ss://YWVzLTEyOC1nY206cGFzcw@example.org:8388/?plugin=obfs-local%3Bobfs%3Dhttp#SIP003'
};

const output = path.join(root, 'tests', 'generated');
fs.mkdirSync(output, {recursive:true});
for (const [filename, link] of Object.entries(fixtures)) {
  const content = vm.runInContext(
    `JSON.stringify(linkItemToStandaloneJsonObject({link:${JSON.stringify(link)}}), null, 2)`,
    context
  );
  const config = JSON.parse(content);
  if (!Array.isArray(config.outbounds) || !config.outbounds.length) {
    throw new Error('Missing outbound in ' + filename);
  }
  fs.writeFileSync(path.join(output, filename), content + '\n');
  console.log('Generated', filename);
}
