'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'Index.html'), 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
assert.ok(css, 'Expected inline CSS in single-file app');
const color = key => css.match(new RegExp('--' + key + ':\\s*(#[0-9a-fA-F]{6})\\s*;'))?.[1];

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(c => parseInt(c, 16) / 255);
  const linear = channels.map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

test('terminal theme uses muted sage instead of neon, without removing its layout', () => {
  assert.equal(color('green'), '#80d8ad');
  assert.equal(color('green2'), '#59c194');
  assert.equal(color('green3'), '#d9f2e4');
  assert.doesNotMatch(css, /#39ff88|#00d46a|rgba\(57\s*,\s*255\s*,\s*136/i);
  assert.match(css, /\.smart-columns\{display:grid/);
  assert.match(css, /\.smart-workspace/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('body text, muted labels and primary button meet WCAG AA contrast', () => {
  assert.ok(contrast(color('text'), color('bg')) >= 4.5);
  assert.ok(contrast(color('muted'), color('bg2')) >= 4.5);
  assert.ok(contrast('#08120d', color('green2')) >= 4.5);
});
