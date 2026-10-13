'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'Index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error('Missing application script');
const boundary = script.indexOf("document.addEventListener('dragover'");
if (boundary < 0) throw new Error('Missing script test boundary');

const ctx = vm.createContext({
  URL, URLSearchParams, TextEncoder, TextDecoder, Uint8Array, atob, btoa,
  setTimeout, clearTimeout
});
vm.runInContext(script.slice(0, boundary), ctx, {filename:'Index.html'});

const uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d4e5';
const fixtures = {
  'vless-ws-tls.json': `vless://${uuid}@example.org:443?encryption=none&security=tls&type=ws&host=cdn.example.org&path=%2Fws&sni=cdn.example.org#WS`,
  'vless-xhttp-tls.json': `vless://${uuid}@example.org:443?encryption=none&security=tls&type=xhttp&host=cdn.example.org&path=%2Fxhttp&mode=stream-up&sni=cdn.example.org#XHTTP`,
  'trojan-ws-tls.json': 'trojan://test-secret@example.org:443?security=tls&type=ws&host=cdn.example.org&path=%2Fws&sni=cdn.example.org#Trojan'
};

const dest = path.join(root, 'tests', 'generated-xray');
fs.mkdirSync(dest, {recursive:true});
for (const [name, link] of Object.entries(fixtures)) {
  const text = vm.runInContext(
    `JSON.stringify(linkItemToStandaloneJsonObject({link:${JSON.stringify(link)}}), null, 2)`,
    ctx
  );
  const config = JSON.parse(text);
  if (!config.outbounds?.length) throw new Error('Missing outbound: ' + name);
  fs.writeFileSync(path.join(dest, name), text + '\n');
  console.log('Generated', name);
}
