'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { inspect } = require('../tools/npvs-inspect.cjs');

function envelope(version, header, body) {
  const prefix = Buffer.alloc(9);
  prefix.write('NPVS');
  prefix[4] = version;
  prefix.writeUInt32BE(header.length, 5);
  const frame = Buffer.alloc(16);
  frame.writeUInt32BE(body.length, 12);
  return Buffer.concat([prefix, header, frame, body, Buffer.alloc(64)]);
}
function gen1() {
  const header = Buffer.from(JSON.stringify({v: 1, passphrase: {iters: 600000, salt: 'secret-salt-do-not-print', wrap: 'secret-wrap-do-not-print'}, recipients: []}));
  return envelope(1, header, Buffer.alloc(32));
}
function gen2(method = 1) {
  const blockLength = method === 1 ? 80 : method === 2 ? 78 : 125;
  const header = Buffer.alloc(53 + blockLength + 4 + 16);
  header[0] = 1;
  header[50] = method;
  if (method === 0) header.writeUInt16BE(1, 51);
  if (method === 1) header.writeUInt32BE(600000, 53);
  if (method === 2) header.writeUInt16BE(2, 53);
  header.writeUInt32BE(16, 53 + blockLength);
  const body = Buffer.alloc(38 + 6 + 16);
  body.write('NPF\x01', 0, 'latin1');
  body.writeUInt16BE(1, 36);
  body.writeUInt16BE(7, 38);
  body.writeUInt16BE(16, 42);
  return envelope(5, header, body);
}

test('content detection ignores extension and recognizes legacy/open markers', () => {
  assert.equal(inspect(Buffer.from('NPVT1,x')).format, 'NPVT1');
  assert.equal(inspect(Buffer.from('NPVTSUB1,x')).format, 'NPVTSUB1');
  assert.equal(inspect(Buffer.from('NPVO1\n{}')).format, 'NPVO1');
  assert.equal(inspect(Buffer.from('random')).state, 'unsupported');
});
test('Gen-1 passphrase header is inspected without leaking secret material', () => {
  const output = inspect(gen1());
  assert.deepEqual(output.unlockMethods, ['creator-passphrase']);
  assert.equal(output.generation, 1);
  assert.equal(output.conversionReady, false);
  assert.doesNotMatch(JSON.stringify(output), /secret|salt|wrap|password/i);
});
test('Gen-2 detection covers passphrase, app-key and recipient wrappers', () => {
  for (const [method, name] of [[1,'creator-passphrase'], [2,'app-key'], [0,'recipient-private-key']]) {
    const output = inspect(gen2(method));
    assert.equal(output.format, 'NPVS');
    assert.equal(output.generation, 2);
    assert.deepEqual(output.unlockMethods, [name]);
    assert.equal(output.fieldCount, 1);
  }
  assert.equal(inspect(gen2()).iterations, 600000);
});
test('base64-encoded NPVS detection uses decoded file content', () => {
  assert.equal(inspect(Buffer.from(gen2().toString('base64'))).generation, 2);
});
test('malformed envelopes and unknown versions are not reported as decrypted', () => {
  assert.throws(() => inspect(gen2().subarray(0, -1)), /length|signature/);
  const broken = gen2(); broken.writeUInt16BE(65535, 42 + 9 + broken.readUInt32BE(5) + 16); // corrupt field blob length
  assert.throws(() => inspect(broken), /NPF field length/);
  assert.equal(inspect(envelope(9, Buffer.alloc(0), Buffer.alloc(32))).state, 'unsupported-version');
  assert.throws(() => inspect(Buffer.alloc(1024*1024+1)), /1 MiB/);
});