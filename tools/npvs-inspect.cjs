'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MAX_FILE_BYTES = 1024 * 1024;
const SIGNATURE_BYTES = 64;

function invalid(message) {
  throw new Error(`Invalid NPV container: ${message}`);
}

function requireBytes(buffer, offset, length, label) {
  if (offset < 0 || length < 0 || offset + length > buffer.length) {
    invalid(`truncated ${label}`);
  }
}

function binaryEnvelope(data) {
  requireBytes(data, 0, 9, 'NPVS prefix');
  const version = data[4];
  const headerLength = data.readUInt32BE(5);
  if (headerLength > MAX_FILE_BYTES || headerLength > data.length - 9) {
    invalid('NPVS header length');
  }
  const header = data.subarray(9, 9 + headerLength);
  const payloadOffset = 9 + headerLength;
  requireBytes(data, payloadOffset, 16 + SIGNATURE_BYTES, 'NPVS body envelope');
  const bodyLength = data.readUInt32BE(payloadOffset + 12);
  if (bodyLength < 16 || bodyLength !== data.length - payloadOffset - 16 - SIGNATURE_BYTES) {
    invalid('NPVS encrypted body length or signature');
  }
  return { version, header, bodyOffset: payloadOffset + 16, bodyLength };
}

function inspectGen1(data) {
  const { version, header, bodyLength } = binaryEnvelope(data);
  let fields;
  try {
    fields = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(header));
  } catch {
    invalid('Gen-1 JSON header');
  }
  if (!fields || Array.isArray(fields) || typeof fields !== 'object') {
    invalid('Gen-1 header must be an object');
  }
  const methods = [];
  if (fields.appKey && typeof fields.appKey === 'object') methods.push('app-key');
  if (fields.passphrase && typeof fields.passphrase === 'object') methods.push('creator-passphrase');
  if (Array.isArray(fields.recipients) && fields.recipients.length) methods.push('recipient-private-key');
  return {
    format: 'NPVS', generation: 1, version, state: 'encrypted',
    unlockMethods: methods, recipientCount: Array.isArray(fields.recipients) ? fields.recipients.length : 0,
    bodyBytes: bodyLength, conversionReady: false, validation: 'structure-only'
  };
}

function inspectGen2(data) {
  const { version, header, bodyOffset, bodyLength } = binaryEnvelope(data);
  requireBytes(header, 0, 53, 'Gen-2 fixed header');
  if (header[0] !== 1) invalid('unsupported Gen-2 compact header version');

  const method = header[50];
  if (method > 2) invalid('unknown Gen-2 unlock method');
  const recipientCount = header.readUInt16BE(51);
  if (recipientCount > 1024) invalid('Gen-2 recipient count');
  if (method === 0 && recipientCount === 0) invalid('Gen-2 recipient wrap missing');

  let cursor = 53 + recipientCount * (32 + 93);
  const wrapLength = method === 1 ? 80 : method === 2 ? 78 : 0;
  requireBytes(header, cursor, wrapLength + 4, 'Gen-2 unlock block');
  let iterations;
  if (method === 1) {
    iterations = header.readUInt32BE(cursor);
    if (iterations < 1 || iterations > 10000000) invalid('Gen-2 PBKDF2 iteration count');
  }
  if (method === 2 && header.readUInt16BE(cursor) !== 2) invalid('Gen-2 app-key block marker');
  cursor += wrapLength;
  const metadataLength = header.readUInt32BE(cursor);
  if (metadataLength < 16) invalid('Gen-2 sealed metadata length');
  requireBytes(header, cursor + 4, metadataLength, 'Gen-2 sealed metadata');

  if (bodyLength < 38 || data.toString('latin1', bodyOffset, bodyOffset + 4) !== 'NPF\x01') {
    invalid('Gen-2 NPF body signature');
  }
  const fieldCount = data.readUInt16BE(bodyOffset + 36);
  let fieldCursor = bodyOffset + 38;
  const bodyEnd = bodyOffset + bodyLength;
  for (let i = 0; i < fieldCount; i++) {
    requireBytes(data, fieldCursor, 6, 'NPF field header');
    if (fieldCursor + 6 > bodyEnd) invalid('NPF field escapes body');
    const sealedLength = data.readUInt16BE(fieldCursor + 4);
    if (sealedLength < 16 || sealedLength > bodyEnd - fieldCursor - 6) {
      invalid('NPF field length');
    }
    fieldCursor += 6 + sealedLength;
  }
  if (fieldCursor !== bodyEnd) invalid('NPF record table length');

  const unlockMethods = ['recipient-private-key', 'creator-passphrase', 'app-key'];
  return {
    format: 'NPVS', generation: 2, version, state: 'encrypted',
    unlockMethods: [unlockMethods[method]], recipientCount, fieldCount, bodyBytes: bodyLength,
    ...(iterations === undefined ? {} : { kdf: 'PBKDF2-HMAC-SHA256', iterations }),
    conversionReady: false, validation: 'structure-only'
  };
}

function inspect(input) {
  const original = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (original.length > MAX_FILE_BYTES) invalid('file exceeds the 1 MiB limit');
  let data = original;
  const text = data.toString('utf8').trim();
  if (/^[A-Za-z0-9+/=\s_-]+$/.test(text) && text.startsWith('TlBWUw') && text.length < 1400000) {
    const decoded = Buffer.from(text.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (decoded.subarray(0, 4).toString('ascii') === 'NPVS') data = decoded;
  }
  const start = data.subarray(0, 8).toString('ascii');
  if (start.startsWith('NPVT1') || start.startsWith('NPVTSUB1')) {
    return { format: start.startsWith('NPVTSUB1') ? 'NPVTSUB1' : 'NPVT1', state: 'legacy',
      conversionReady: 'existing-engine', validation: 'marker-only' };
  }
  if (start.startsWith('NPVO1')) {
    return { format: 'NPVO1', state: 'open', conversionReady: 'existing-engine', validation: 'marker-only' };
  }
  if (data.subarray(0, 4).toString('ascii') !== 'NPVS') {
    return { format: 'unknown', state: 'unsupported', conversionReady: false };
  }
  requireBytes(data, 0, 9, 'NPVS prefix');
  if (data[4] <= 1) return inspectGen1(data);
  if (data[4] === 5) return inspectGen2(data);
  return { format: 'NPVS', version: data[4], state: 'unsupported-version', conversionReady: false };
}

if (require.main === module) {
  const paths = process.argv.slice(2);
  if (!paths.length) {
    console.error('Usage: node tools/npvs-inspect.cjs <file> [file ...]');
    process.exitCode = 2;
  } else {
    for (const file of paths) {
      try {
        const stat = fs.statSync(file);
        if (stat.size > MAX_FILE_BYTES) invalid('file exceeds the 1 MiB limit');
        const result = inspect(fs.readFileSync(file));
        console.log(JSON.stringify({ file: path.basename(file), ...result }));
        if (result.state === 'unsupported' || result.state === 'unsupported-version') process.exitCode = 1;
      } catch (error) {
        console.log(JSON.stringify({ file: path.basename(file), state: 'invalid', error: error.message }));
        process.exitCode = 1;
      }
    }
  }
}

module.exports = { inspect };