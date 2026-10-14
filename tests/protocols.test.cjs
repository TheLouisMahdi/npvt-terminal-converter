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

test('VLESS gRPC authority survives URI to Xray JSON and back', () => {
  const link = 'vless://f47ac10b-58cc-4372-a567-0e02b2c3d4e5@edge.example:443?encryption=none&security=tls&type=grpc&serviceName=tunnel&authority=grpc.example#Node';
  const config = json(`linkItemToStandaloneJsonObject({link:${JSON.stringify(link)}})`);
  assert.equal(config.outbounds[0].streamSettings.grpcSettings.serviceName, 'tunnel');
  assert.equal(config.outbounds[0].streamSettings.grpcSettings.authority, 'grpc.example');

  const result = json(`convertJSONToLinks(${JSON.stringify(config)})`);
  assert.equal(result.errors.length, 0, result.errors.join('; '));
  assert.equal(result.links.length, 1);
  const uri = new URL(result.links[0].link);
  assert.equal(uri.searchParams.get('authority'), 'grpc.example');
  assert.equal(uri.searchParams.get('serviceName'), 'tunnel');
});

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
  assert.deepEqual(parsed.outbound.server_ports, ['123:123', '5000:6000']);
  assert.equal(parsed.outbound.obfs.type, 'gecko');
  assert.equal(parsed.outbound.obfs.password, 'mask');
  assert.equal(parsed.outbound.tls.server_name, 'cdn.example');
  const native = json(`linkItemToStandaloneJsonObject({link:${JSON.stringify(source)}})`);
  assert.equal(native.outbounds[0].type, 'hysteria2');
  assert.deepEqual(native.outbounds[0].server_ports, ['123:123', '5000:6000']);
});

test('Basic sing-box Hysteria2 JSON converts to URI with working Gecko options', () => {
  const outbound = {
    type: 'hysteria2', tag: 'node', password: 'secret',
    server: 'example.org', server_ports: ['443:443', '5000:6000'],
    tls: {enabled: true, server_name: 'cdn.example', insecure: false},
    obfs: {type: 'gecko', password: 'mask'}
  };
  const converted = json(`convertJSONToLinks({outbounds:[${JSON.stringify(outbound)}]}, 'fixture')`);
  assert.equal(converted.errors.length, 0);
  assert.equal(converted.links.length, 1);
  assert.match(converted.links[0].link, /443,5000-6000/);
  const parsed = json(`parseHysteria2Share(${JSON.stringify(converted.links[0].link)})`);
  assert.equal(parsed.outbound.obfs.type, 'gecko');
  assert.deepEqual(parsed.outbound.server_ports, ['443:443', '5000:6000']);
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

test('Hysteria2 rejects unsupported certificate pins and Gecko tuning', () => {
  assert.throws(
    () => run("parseHysteria2Share('hy2://pass@host:443/?pinSHA256=abc')"), /certificate hash/
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


test('Advanced native Hysteria2 JSON survives the full-configuration export path', () => {
  const original = {outbounds: [{
    type: 'hysteria2', tag: 'advanced', server: 'host.example',
    server_port: 443, password: 'secret', tls: {enabled: true},
    hop_interval_max: '60s', bbr_profile: 'aggressive',
    obfs: {type: 'gecko', password: 'key', min_packet_size: 512}
  }]};
  const encoded = JSON.stringify(JSON.stringify(original));
  const output = json(`linksTextToSeparatedJson(${encoded})`);
  assert.equal(output.fullJson, 1);
  assert.equal(output.objects[0].object.outbounds[0].hop_interval_max, '60s');
  assert.equal(output.objects[0].object.outbounds[0].bbr_profile, 'aggressive');
  assert.equal(output.objects[0].object.outbounds[0].obfs.min_packet_size, 512);
});

test('Hysteria2 ECH Base64 round-trips to native sing-box PEM lines', () => {
  const sample = btoa(String.fromCharCode(0,4,0xfe,0x0d,0,0));
  const uri = `hy2://pw@example.org:443/?ech=${encodeURIComponent(sample)}&sni=cdn.example#ECH`;
  const parsed = json(`parseHysteria2Share(${JSON.stringify(uri)})`);
  assert.equal(parsed.outbound.tls.ech.enabled, true);
  assert.equal(parsed.outbound.tls.ech.config[0], '-----BEGIN ECH CONFIGS-----');
  assert.equal(parsed.outbound.tls.ech.config.at(-1), '-----END ECH CONFIGS-----');
  const roundTrip = json(`convertJSONToLinks({outbounds:[${JSON.stringify(parsed.outbound)}]})`);
  assert.equal(roundTrip.errors.length, 0);
  const url = new URL(roundTrip.links[0].link);
  assert.equal(url.searchParams.get('ech'), sample);
});

test('Hysteria2 ECH configs reject private key material and unsupported settings', () => {
  const outbound = {
    type:'hysteria2', server:'example.org', server_port:443,
    password:'pw', tls:{enabled:true,ech:{enabled:true, key:['private']}}
  };
  const result = json(`convertJSONToLinks({outbounds:[${JSON.stringify(outbound)}]})`);
  assert.equal(result.links.length, 0);
  assert.match(result.errors.join(' '), /unsupported Hysteria2 ECH/);
});

test('Invalid Hysteria2 ECH length fails closed', () => {
  assert.throws(() => run("parseHysteria2Share('hy2://pass@host:443/?ech=YQ==')"), /ECHConfigList length/);
});


test('VLESS modern direct outbound preserves post-quantum encryption in URI', () => {
  const encryption = 'mlkem768x25519plus.native.0rtt..X25519Public.MLKEMClient';
  const cfg = {outbounds:[{
    protocol:'vless', tag:'pq',
    settings:{address:'edge.example',port:443,id:'test-user',encryption,flow:'xtls-rprx-vision'},
    streamSettings:{network:'xhttp',security:'tls',tlsSettings:{serverName:'sni.example'},
      xhttpSettings:{host:'cdn.example',path:'/data',mode:'stream-up'}}
  }]};
  const converted = json(`convertJSONToLinks(${JSON.stringify(cfg)})`);
  assert.equal(converted.errors.length, 0, converted.errors.join(';'));
  assert.equal(converted.links.length, 1);
  const url = new URL(converted.links[0].link);
  assert.equal(url.searchParams.get('encryption'), encryption);
  assert.equal(url.searchParams.get('type'), 'xhttp');
  assert.equal(url.searchParams.get('host'), 'cdn.example');
  assert.equal(url.searchParams.get('mode'), 'stream-up');
  assert.equal(url.searchParams.get('path'), '/data');
  assert.equal(url.searchParams.get('flow'), 'xtls-rprx-vision');
});

test('VLESS XHTTP URI with xmux and downloadSettings round-trips into Xray JSON', () => {
  const extra = {xmux:{maxConcurrency:'4-8'}, downloadSettings:{
    address:'download.example',port:443,network:'xhttp',security:'tls',
    xhttpSettings:{path:'/down',mode:'packet-up'}}};
  const link = 'vless://tester@example.org:443?security=tls&type=xhttp&host=front.example&path=%2Fup&mode=packet-up&encryption=none&extra=' +
    encodeURIComponent(JSON.stringify(extra)) + '#Node';
  const output = json(`linkItemToStandaloneJsonObject({link:${JSON.stringify(link)}})`);
  const outbound = output.outbounds[0];
  assert.equal(outbound.settings.vnext[0].users[0].encryption, 'none');
  assert.equal(outbound.streamSettings.network, 'xhttp');
  assert.equal(outbound.streamSettings.xhttpSettings.host, 'front.example');
  assert.equal(outbound.streamSettings.xhttpSettings.path, '/up');
  assert.equal(outbound.streamSettings.xhttpSettings.mode, 'packet-up');
  assert.equal(outbound.streamSettings.xhttpSettings.extra.xmux.maxConcurrency, '4-8');
  assert.equal(outbound.streamSettings.xhttpSettings.extra.downloadSettings.address, 'download.example');
  const jsonToLinks = json(`convertJSONToLinks(${JSON.stringify(output)})`);
  assert.equal(jsonToLinks.errors.length, 0, jsonToLinks.errors.join(';'));
  const uri = new URL(jsonToLinks.links[0].link);
  assert.deepEqual(JSON.parse(uri.searchParams.get('extra')), extra);
});

test('Unknown XHTTP fields fail safely and preserve full source JSON', () => {
  const cfg = {outbounds:[{protocol:'vless',settings:{address:'example.org',port:443,id:'custom',encryption:'none'},
    streamSettings:{network:'xhttp',xhttpSettings:{path:'/a', mode:'stream-up',unrecognizedKey:true}}}]};
  const links = json(`convertJSONToLinks(${JSON.stringify(cfg)})`);
  assert.equal(links.links.length, 0);
  assert.match(links.errors.join(' '), /Unknown XHTTP settings/);
  const full = json(`collectFullJsonConfigsFromObject(${JSON.stringify(cfg)})`);
  assert.equal(full.length, 1);
  assert.equal(full[0].object.outbounds[0].streamSettings.xhttpSettings.unrecognizedKey, true);
});

test('NPVT refuses unsupported VLESS XHTTP and post-quantum encryption but accepts legacy', () => {
  assert.equal(run("isNpvtBuildSupportedLink('vless://tester@example.org:443?type=xhttp&encryption=none')"), false);
  assert.equal(run("isNpvtBuildSupportedLink('vless://tester@example.org:443?type=tcp&encryption=mlkem768x25519plus.native.0rtt..key')"), false);
  assert.equal(run("isNpvtBuildSupportedLink('vless://tester@example.org:443?type=ws&encryption=none')"), true);
});

test('Malformed XHTTP extra JSON and modes are rejected', () => {
  assert.throws(() => run("parseStandardShare('vless://a@server:443?type=xhttp&extra=%7Bbroken')"), /invalid XHTTP extra/);
  assert.throws(() => run("parseStandardShare('vless://a@server:443?type=xhttp&mode=bad')"), /invalid XHTTP mode/);
});


test('Shadowsocks 2022 uses raw encoded credentials instead of Base64URL', () => {
  const key = 'YctPZ6U7xPPcU+gp3u+0tx/tRizJN9K8y+uKlW2qjlI=';
  const p = {protocol:'ss', server:'example.org',serverPort:8388,password:key,method:'2022-blake3-aes-256-gcm',name:'SS2022'};
  const uri = run(`profileToLink(${JSON.stringify(p)})`);
  assert.match(uri, /^ss:\/\/2022-blake3-aes-256-gcm:/);
  assert.match(uri, /%2B/);
  const parsed = json(`parseSsShare(${JSON.stringify(uri)})`);
  assert.equal(parsed.password, key);
  assert.equal(parsed.method, '2022-blake3-aes-256-gcm');
});

test('SIP003 plugin maps to native sing-box JSON without dropping options', () => {
  const uri = 'ss://YWVzLTEyOC1nY206cGFzcw@example.org:8388/?plugin=obfs-local%3Bobfs%3Dhttp%3Bobfs-host%3Dcdn.example#Node';
  assert.throws(() => run(`parseSsShare(${JSON.stringify(uri)})`), /SIP003 plugin/);
  const obj = json(`linkItemToStandaloneJsonObject({link:${JSON.stringify(uri)}})`);
  assert.equal(obj.outbounds[0].type, 'shadowsocks');
  assert.equal(obj.outbounds[0].plugin, 'obfs-local');
  assert.equal(obj.outbounds[0].plugin_opts, 'obfs=http;obfs-host=cdn.example');
  assert.equal(obj.outbounds[0].server_port, 8388);
  assert.equal(obj.outbounds[0].password, 'pass');
  assert.equal(run(`isNpvtBuildSupportedLink(${JSON.stringify(uri)})`), false);
});

test('Unknown native protocols are not relabeled as VLESS links', () => {
  const outbounds = [
    {type:'snell',server:'snell.example',server_port:443,password:'key'},
    {type:'trusttunnel',server:'trust.example',server_port:443,password:'secret'},
  ];
  const output = json(`convertJSONToLinks({outbounds:${JSON.stringify(outbounds)}})`);
  assert.equal(output.links.length, 0);
  assert.match(output.errors.join(' '), /Unsupported native protocol/);
});

test('Unknown SIP003 plugin is rejected, not silently converted', () => {
  const uri = 'ss://YWVzLTEyOC1nY206cGFzcw@example.org:443/?plugin=unknown-plugin%3Bfoo%3Dbar';
  assert.throws(() => run(`linkItemToStandaloneJsonObject({link:${JSON.stringify(uri)}})`), /unsupported Shadowsocks plugin/);
});


test('Shadowsocks plugin native sing-box JSON round-trips to SIP002 URI', () => {
  const uri = 'ss://YWVzLTEyOC1nY206cGFzcw@example.org:8388/?plugin=obfs-local%3Bobfs%3Dhttp%3Bobfs-host%3Dcdn.example#Node';
  const native = json(`linkItemToStandaloneJsonObject({link:${JSON.stringify(uri)}})`);
  const converted = json(`convertJSONToLinks(${JSON.stringify(native)})`);
  assert.equal(converted.errors.length, 0, converted.errors.join('; '));
  assert.equal(converted.links.length, 1);
  const back = new URL(converted.links[0].link);
  assert.equal(back.searchParams.get('plugin'), 'obfs-local;obfs=http;obfs-host=cdn.example');
  assert.equal(back.hostname, 'example.org');
});

test('Shadowsocks unknown native options do not disappear into share URI', () => {
  const config = {outbounds:[{
    type:'shadowsocks', server:'example.org',server_port:443,
    method:'aes-128-gcm',password:'secret', plugin:'obfs-local',
    plugin_opts:'obfs=http', multiplex:{enabled:true}
  }]};
  const converted = json(`convertJSONToLinks(${JSON.stringify(config)})`);
  assert.equal(converted.links.length, 0);
  assert.match(converted.errors.join(' '), /Advanced Shadowsocks options/);
});
