'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'Index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Inline application script exists');
const wiring = script.indexOf("document.addEventListener('dragover'");
assert.ok(wiring > 0, 'Application event wiring anchor exists');

const context = vm.createContext({
  URL, URLSearchParams, TextEncoder, TextDecoder, Uint8Array, atob, btoa,
  setTimeout, clearTimeout
});
vm.runInContext(script.slice(0, wiring), context, {filename: 'Index.html', timeout: 10000});

function run(expression) {
  return vm.runInContext(expression, context, {timeout: 3000});
}
function json(expression) {
  return JSON.parse(run(`JSON.stringify(${expression})`));
}

test('AnyTLS URI parses password, IPv6 host, SNI and insecure', () => {
  const parsed = json("parseAnytlsShare('anytls://my%40secret@[2001:db8::1]:8443/?sni=cdn.example&insecure=1#Node')");
  assert.equal(parsed.outbound.type, 'anytls');
  assert.equal(parsed.outbound.server, '2001:db8::1');
  assert.equal(parsed.outbound.password, 'my@secret');
  assert.equal(parsed.outbound.server_port, 8443);
  assert.equal(parsed.outbound.tls.server_name, 'cdn.example');
  assert.equal(parsed.outbound.tls.insecure, true);
  assert.equal(parsed.name, 'Node');
});

test('AnyTLS URI converts into native sing-box JSON', () => {
  const config = json("linkItemToStandaloneJsonObject({link:'anytls://pass@example.org:443/?sni=sni.example#Sample'})");
  const outbound = config.outbounds[0];
  assert.equal(outbound.type, 'anytls');
  assert.equal(outbound.password, 'pass');
  assert.equal(outbound.tls.server_name, 'sni.example');
  assert.equal(config.outbounds[1].type, 'direct');
});

test('Basic sing-box AnyTLS outbound converts into a share URI', () => {
  const source = {
    outbounds: [{
      type: 'anytls', tag: 'edge', server: 'edge.example.org',
      server_port: 443, password: 'p@ss',
      tls: {enabled: true, server_name: 'sni.example.org', insecure: false}
    }]
  };
  const output = json(`convertJSONToLinks(${JSON.stringify(source)}, 'test')`);
  assert.equal(output.errors.length, 0);
  assert.equal(output.links.length, 1);
  assert.match(output.links[0].link, /^anytls:\/\/p%40ss@edge\.example\.org:443\//);
  const parsed = json(`parseAnytlsShare(${JSON.stringify(output.links[0].link)})`);
  assert.equal(parsed.outbound.password, 'p@ss');
  assert.equal(parsed.outbound.tls.server_name, 'sni.example.org');
});

test('Advanced AnyTLS options fail closed instead of being silently discarded', () => {
  const source = {outbounds: [{
    type: 'anytls', server: 'example.org', server_port: 443,
    password: 'secret', tls: {enabled: true}, min_idle_session: 5
  }]};
  const output = json(`convertJSONToLinks(${JSON.stringify(source)}, 'test')`);
  assert.equal(output.links.length, 0);
  assert.match(output.errors.join(' '), /session options/);
});

test('Paste-ready export keeps native sing-box structure', () => {
  const input = {remarks: 'Node', outbounds: [
    {type: 'anytls', server: 'example.org', server_port: 443, password: 'secret', tls: {enabled: true}},
    {type: 'direct', tag: 'direct'}
  ]};
  const result = json(`makePasteReadyXrayConfig(${JSON.stringify(input)})`);
  assert.equal(result.inbounds, undefined);
  assert.equal(result.remarks, undefined);
  assert.equal(result.outbounds[0].type, 'anytls');
});

test('NPVT1 builder rejects AnyTLS while preserving legacy VLESS support', () => {
  assert.equal(run("isNpvtBuildSupportedLink('anytls://pass@example.org:443/')"), false);
  assert.equal(run("isNpvtBuildSupportedLink('vless://id@example.org:443')"), true);
  const extracted = json("extractRawLinks('https://example.org/ anytls://pass@example.org:443/#N')");
  assert.equal(extracted.length, 1);
  assert.match(extracted[0], /^anytls:/);
});

test('Malformed AnyTLS ports are rejected', () => {
  assert.throws(() => run("parseAnytlsShare('anytls://p@example.org:abc/')"), /invalid AnyTLS port/);
  assert.throws(() => run("parseAnytlsShare('anytls://p@example.org:65536/')"), /invalid AnyTLS port/);
});


test('Hysteria2 Gecko with port hopping maps to valid sing-box port ranges', () => {
  const source = 'hysteria2://p%40ss@example.org:123,5000-6000/?obfs=gecko&obfs-password=mask&sni=cdn.example#Node';
  const parsed = json(`parseHysteria2Share(${JSON.stringify(source)})`);
  assert.equal(parsed.outbound.type, 'hysteria2');
  assert.equal(parsed.outbound.password, 'p@ss');
  assert.equal(parsed.outbound.server, 'example.org');
  assert.deepEqual(parsed.outbound.server_ports, ['123', '5000:6000']);
  assert.equal(parsed.outbound.obfs.type, 'gecko');
  assert.equal(parsed.outbound.obfs.password, 'mask');
  assert.equal(parsed.outbound.tls.server_name, 'cdn.example');
  const native = json(`linkItemToStandaloneJsonObject({link:${JSON.stringify(source)}})`);
  assert.equal(native.outbounds[0].type, 'hysteria2');
  assert.deepEqual(native.outbounds[0].server_ports, ['123', '5000:6000']);
});

test('Basic sing-box Hysteria2 JSON converts to URI with working Gecko options', () => {
  const outbound = {
    type: 'hysteria2', tag: 'node', password: 'secret',
    server: 'example.org', server_ports: ['443', '5000:6000'],
    tls: {enabled: true, server_name: 'cdn.example', insecure: false},
    obfs: {type: 'gecko', password: 'mask'}
  };
  const converted = json(`convertJSONToLinks({outbounds:[${JSON.stringify(outbound)}]}, 'fixture')`);
  assert.equal(converted.errors.length, 0);
  assert.equal(converted.links.length, 1);
  assert.match(converted.links[0].link, /443,5000-6000/);
  const parsed = json(`parseHysteria2Share(${JSON.stringify(converted.links[0].link)})`);
  assert.equal(parsed.outbound.obfs.type, 'gecko');
  assert.deepEqual(parsed.outbound.server_ports, ['443', '5000:6000']);
});

test('Hysteria2 Realm URI uses rendezvous token and separate auth', () => {
  const link = 'hysteria2+realm://token%40x@rendezvous.example/room-A?auth=proxy%40pass&stun=stun.one:3478&stun=stun.two:3478&sni=tls.example#Realm';
  const outbound = json(`parseHysteria2Share(${JSON.stringify(link)}).outbound`);
  assert.equal(outbound.type, 'hysteria2');
  assert.equal(outbound.password, 'proxy@pass');
  assert.equal(outbound.server, undefined);
  assert.equal(outbound.server_port, undefined);
  assert.equal(outbound.realm.server_url, 'https://rendezvous.example');
  assert.equal(outbound.realm.token, 'token@x');
  assert.equal(outbound.realm.realm_id, 'room-A');
  assert.deepEqual(outbound.realm.stun_servers, ['stun.one:3478', 'stun.two:3478']);
  const converted = json(`convertJSONToLinks({outbounds:[${JSON.stringify(outbound)}]}, 'fixture')`);
  assert.equal(converted.errors.length, 0);
  assert.match(converted.links[0].link, /^hysteria2\+realm:\/\//);
  assert.equal((converted.links[0].link.match(/stun=/g)||[]).length, 2);
});

test('Hysteria2 Realm HTTP scheme is preserved across JSON conversion', () => {
  const link = 'hysteria2+realm+http://token@r.example:8080/my-room?auth=secret&stun=stun.example';
  const outbound = json(`parseHysteria2Share(${JSON.stringify(link)}).outbound`);
  assert.equal(outbound.realm.server_url, 'http://r.example:8080');
  const result = json(`convertJSONToLinks({outbounds:[${JSON.stringify(outbound)}]})`);
  assert.match(result.links[0].link, /^hysteria2\+realm\+http:\/\//);
});

test('Hysteria2 ECH, pins and unsupported Gecko tuning never disappear silently', () => {
  assert.throws(
    () => run("parseHysteria2Share('hy2://pass@host:443/?ech=YQ==')"), /ECH\/pinSHA256/
  );
  assert.throws(
    () => run("parseHysteria2Share('hy2://pass@host:443/?pinSHA256=abc')"), /ECH\/pinSHA256/
  );
  const config = {outbounds: [{
    type:'hysteria2', server:'host', server_port:443, password:'pass',
    obfs:{type:'gecko',password:'pw',min_packet_size:512},tls:{enabled:true}
  }]};
  const converted = json(`convertJSONToLinks(${JSON.stringify(config)})`);
  assert.equal(converted.links.length, 0);
  assert.match(converted.errors.join(' '), /packet size/);
});

test('Hysteria2 newer sing-box options block lossy URI exports', () => {
  const config = {outbounds: [{
    type:'hysteria2', server:'host', server_port:443,password:'p',tls:{enabled:true},
    hop_interval_max:'60s', bbr_profile:'aggressive'
  }]};
  const result = json(`convertJSONToLinks(${JSON.stringify(config)})`);
  assert.equal(result.links.length, 0);
  assert.match(result.errors.join(' '), /no standard URI mapping/);
});

test('Hysteria2 invalid ports and missing sing-box Realm STUN settings are reported', () => {
  assert.throws(() => run("parseHysteria2Share('hy2://p@host:6000-5000/')"), /invalid Hysteria2 port range/);
  assert.throws(() => run("parseHysteria2Share('hy2://p@host:65536/')"), /invalid Hysteria2 port range/);
  assert.throws(() => run("parseHysteria2Share('hysteria2+realm://token@r.example/room?auth=p')"), /requires explicit stun/);
  assert.throws(() => run("parseHysteria2Share('hysteria2+realm://token@r.example/room?auth=p&stun=stun.example&lport=1234')"), /lport/);
});
