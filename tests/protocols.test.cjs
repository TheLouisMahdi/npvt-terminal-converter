'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'Index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Inline application script exists');
const wiring = script.indexOf("$('bubbleToggle').addEventListener");
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
