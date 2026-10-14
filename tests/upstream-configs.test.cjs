'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'Index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const boundary = script?.indexOf("document.addEventListener('dragover'");
assert.ok(boundary > 0);
const context = vm.createContext({
  URL, URLSearchParams, TextEncoder, TextDecoder, Uint8Array, atob, btoa
});
vm.runInContext(script.slice(0, boundary), context, { filename: 'Index.html', timeout: 20000 });
function call(name, ...args) {
  return JSON.parse(JSON.stringify(vm.runInContext(
    name + '(' + args.map(value => JSON.stringify(value)).join(',') + ')',
    context, { timeout: 20000 }
  )));
}
function outputs(text) {
  return call('smartAvailable', [call('smartRecognizeText', text)]);
}
const uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d4e5';
const key = 'eCtXsJZ27+4PbhDkHnB923tkUn2Gj59wZw5wFA75MnU=';
const publicKey = 'Cr8hWlKvtDt7nrvf+f0brNQQzabAqrjfBvas9pmowjo=';

// Adapted configuration shapes from upstream projects; all secrets/hosts are synthetic.
// Xray: https://github.com/XTLS/Xray-examples/blob/main/VLESS-WSS-Nginx/client.jsonc
// Xray: https://github.com/XTLS/Xray-examples/blob/main/VMess-Websocket-TLS/config_client.jsonc
// Xray: https://github.com/XTLS/Xray-examples/blob/main/VLESS-gRPC-REALITY/config_client.jsonc
// sing-box: https://sing-box.sagernet.org/configuration/outbound/anytls/
// sing-box: https://sing-box.sagernet.org/configuration/outbound/hysteria2/
// Shadowsocks: https://shadowsocks.org/doc/sip002.html
// WireGuard: https://www.wireguard.com/quickstart/

test('upstream Xray VLESS WS+TLS JSONC imports and exports a matching VLESS link', () => {
  const jsonc = '{\n  // Xray example: comments are allowed\n  "outbounds": [{\n    "protocol": "vless",\n    "settings": {"address": "edge.example.org", "port": 443, "id": "' + uuid + '", "encryption": "none"},\n    "streamSettings": {\n      "network": "ws", "security": "tls",\n      "wsSettings": {"path": "/Path2WS?ed=2560"},\n      "tlsSettings": {"allowInsecure": false, "serverName": "edge.example.org", "fingerprint": "chrome"}\n    }\n  }]\n}';
  const parsed = call('smartRecognizeText', jsonc);
  assert.equal(parsed.kind, 'xray');
  const result = call('smartAvailable', [parsed]);
  const link = new URL(result.links.trim());
  assert.equal(link.protocol, 'vless:');
  assert.equal(link.searchParams.get('path'), '/Path2WS?ed=2560');
  assert.equal(link.searchParams.get('fp'), 'chrome');
  assert.equal(link.searchParams.get('sni'), 'edge.example.org');
  assert.equal(JSON.parse(result.xray).outbounds[0].protocol, 'vless');
});

test('upstream Xray VMess WS+TLS native client exports original transport and fingerprint', () => {
  const source = {
    outbounds: [{
      protocol: 'vmess', tag: 'proxy',
      settings: {address: 'vmess.example.org', port: 1234, id: uuid, security: 'auto'},
      streamSettings: {
        network: 'ws', security: 'tls',
        wsSettings: {path: '/vmess'},
        tlsSettings: {serverName: 'vmess.example.org', fingerprint: 'chrome'}
      }
    }]
  };
  const result = outputs(JSON.stringify(source));
  assert.ok(result.links.startsWith('vmess://'));
  const parsed = JSON.parse(Buffer.from(result.links.slice(8), 'base64').toString('utf8'));
  assert.equal(parsed.id, uuid);
  assert.equal(parsed.net, 'ws');
  assert.equal(parsed.path, '/vmess');
  assert.equal(parsed.fp, 'chrome');
});

test('upstream Xray REALITY gRPC advanced settings retain native JSON and block lossy links', () => {
  const source = {outbounds: [{
    protocol: 'vless', tag: 'proxy',
    settings: {address: '192.0.2.50', port: 443, id: uuid, encryption: 'none'},
    streamSettings: {
      network: 'grpc', security: 'reality',
      grpcSettings: {serviceName: 'tunnel', multiMode: false, permit_without_stream: false},
      realitySettings: {serverName: 'front.example', fingerprint: 'chrome',
        publicKey: 'OBR2JYROQB8odK5glVW_KLnsWl3UZ-voyGq_9ihQgTI', shortId: 'd49d578f280fd83a'}
    }
  }]};
  const result = outputs(JSON.stringify(source));
  assert.equal(result.links, undefined);
  assert.equal(result.subscription, undefined);
  assert.equal(JSON.parse(result.xray).outbounds[0].streamSettings.grpcSettings.permit_without_stream, false);
});

test('upstream sing-box AnyTLS client retains full native credentials and TLS config', () => {
  const original = {outbounds: [{
    type: 'anytls', tag: 'anytls-out', server: 'anytls.example.org', server_port: 443,
    password: 'example-only', tls: {enabled:true, server_name:'anytls.example.org'},
    idle_session_check_interval: '30s', idle_session_timeout: '30s', min_idle_session: 5,
    client_metadata: ''
  }]};
  const result = outputs(JSON.stringify(original));
  assert.deepEqual(JSON.parse(result.singbox).outbounds, original.outbounds);
  assert.equal(result.npvt, undefined);
});

test('upstream sing-box advanced Hysteria2 options cannot be lost in short URI conversion', () => {
  const original = {outbounds: [{
    type:'hysteria2', tag:'hy2', server:'hy2.example.org', server_port:443,
    password:'example-only', tls:{enabled:true,server_name:'hy2.example.org'},
    obfs:{type:'salamander',password:'example-obfs'}, hop_interval_max:'60s',
    up_mbps:100, down_mbps:100, bbr_profile:'standard'
  }]};
  const result = outputs(JSON.stringify(original));
  assert.equal(result.links, undefined);
  assert.equal(JSON.parse(result.singbox).outbounds[0].hop_interval_max, '60s');
  assert.equal(JSON.parse(result.singbox).outbounds[0].obfs.password, 'example-obfs');
});

test('Shadowsocks SIP002 Base64 userinfo maps to Xray and retains method/credentials', () => {
  const uri = 'ss://YWVzLTEyOC1nY206cGFzcw@ss.example.org:8388#SIP002';
  const result = outputs(uri);
  assert.equal(result.links.trim(), uri);
  const server = JSON.parse(result.xray).outbounds[0].settings.servers[0];
  assert.equal(server.method, 'aes-128-gcm');
  assert.equal(server.password, 'pass');
  assert.equal(server.port, 8388);
});

test('WireGuard two-peer client INI round-trips peers without creating unrelated links', () => {
  const ini = '[Interface]\nPrivateKey = ' + key + '\nAddress = 10.9.0.2/32\n\n' +
    '[Peer]\nPublicKey = ' + publicKey + '\nEndpoint = 192.0.2.1:51820\nAllowedIPs = 10.1.0.0/16\n\n' +
    '[Peer]\nPublicKey = ' + publicKey + '\nEndpoint = 192.0.2.2:51821\nAllowedIPs = 10.2.0.0/16\n';
  const result = outputs(ini);
  assert.equal(result.links, undefined);
  assert.equal(result.mihomoJson ? JSON.parse(result.mihomoJson).proxies[0].peers.length : 0, 2);
  assert.equal((result.wireguard.match(/\[Peer\]/g) || []).length, 2);
});

test('Mihomo Snell YAML remains native and never invents VLESS, VMess, or Xray', () => {
  const yaml = 'proxies:\n  - name: "Official-style Snell"\n    type: snell\n    server: snell.example.org\n    port: 443\n    psk: example-only\n    version: 4\n';
  const result = outputs(yaml);
  assert.equal(JSON.parse(result.mihomoJson).proxies[0].version, 4);
  assert.equal(result.xray, undefined);
  assert.equal(result.links, undefined);
});

test('JSONC comments do not damage literal URLs, and trailing commas import safely', () => {
  const input = '// leading comment\n{"origin":"https://example.org/test//path", /* note */ "enabled":true,}';
  const result = outputs(input);
  assert.equal(JSON.parse(result.json).origin, 'https://example.org/test//path');
  assert.equal(JSON.parse(result.json).enabled, true);
});
