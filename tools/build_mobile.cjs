'use strict';
// Build a portable mobile page from the same UI/engine as Index.html.
// mobile.html includes every style and script inline; no runtime dependency.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'Index.html'), 'utf8');
const target = path.join(root, 'mobile.html');

const MOBILE_STYLES = String.raw`
/* Mobile-only presentation; desktop Index.html stays untouched. */
body.mobile-standalone{
  background:linear-gradient(180deg,#0b1712 0%,#07100c 100%);
  overflow-x:hidden;
}
body.mobile-standalone:before,
body.mobile-standalone:after{display:none}
.mobile-standalone .orb{display:none}
.mobile-standalone .wrap{
  width:min(100% - 24px,680px);
  padding:14px 0 calc(28px + env(safe-area-inset-bottom));
}
.mobile-standalone .hero{display:block;margin:0 0 12px}
.mobile-standalone .hero-copy{
  padding:18px;
  border-radius:18px;
  background:rgba(17,34,26,.90);
  box-shadow:0 8px 24px rgba(0,0,0,.18);
}
.mobile-standalone .hero-copy:before{display:none}
.mobile-standalone .kicker{
  font-size:10px;letter-spacing:.11em;text-shadow:none;line-height:1.6
}
.mobile-standalone h1{
  font-size:clamp(26px,7.2vw,34px);
  line-height:1.14;letter-spacing:-.055em;margin:8px 0
}
.mobile-standalone .caret{display:none}
.mobile-standalone .hero p{font-size:13px;line-height:1.6}
.mobile-standalone .hero-actions,
.mobile-standalone .hero-panel{display:none!important}
.mobile-standalone .smart-workspace{
  margin:0 0 14px;padding:16px;
  border-radius:18px;background:rgba(13,28,21,.94);
  box-shadow:0 9px 28px rgba(0,0,0,.16);
}
.mobile-standalone .smart-head{gap:10px;margin-bottom:14px}
.mobile-standalone .smart-head h2{font-size:18px;margin:0 0 4px}
.mobile-standalone .smart-head p{font-size:12px;line-height:1.5}
.mobile-standalone .smart-status-indicator{
  font-size:10px;letter-spacing:0;padding:6px 8px;flex:0 0 auto
}
.mobile-standalone .smart-columns{
  display:grid;grid-template-columns:minmax(0,1fr);gap:20px
}
.mobile-standalone .smart-input,
.mobile-standalone .smart-result{gap:9px}
.mobile-standalone .smart-workspace label.input-label{
  font-size:12px;line-height:1.4;letter-spacing:.025em;margin:0
}
.mobile-standalone .smart-drop{
  min-height:94px;padding:16px 14px;border-radius:14px;
  justify-content:center;gap:6px
}
.mobile-standalone .smart-drop strong{font-size:15px}
.mobile-standalone .smart-drop span{font-size:12px;line-height:1.5}
.mobile-standalone .smart-workspace textarea{
  width:100%;min-height:156px;max-height:42dvh;flex:none;
  resize:vertical;font-size:16px;line-height:1.55;
  padding:13px;border-radius:14px
}
.mobile-standalone .smart-result select{
  width:100%;min-height:48px;font-size:16px;padding:12px
}
.mobile-standalone .smart-detected{
  padding:10px 12px;min-height:42px;font-size:12px
}
.mobile-standalone .smart-more{font-size:12px}
.mobile-standalone .smart-buttons{
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px
}
.mobile-standalone .smart-buttons .btn{
  min-width:0;min-height:46px;font-size:13px
}
.mobile-standalone #smartReset{grid-column:1/-1;min-height:42px}
.mobile-standalone #smartStatus{
  max-height:140px;min-height:52px;padding:11px;font-size:12px;line-height:1.6
}
.mobile-standalone .footer{
  display:block;margin:0;padding:10px 4px;text-align:center;
  font-size:11px;line-height:1.7
}
.mobile-standalone .footer span{display:block}
@media(min-width:600px){
  .mobile-standalone .hero-copy{padding:22px}
  .mobile-standalone .smart-workspace{padding:22px}
  .mobile-standalone .smart-workspace textarea{min-height:190px}
}
`;

function replaceOnce(text, from, to) {
  if (text.indexOf(from) < 0 || text.indexOf(from) !== text.lastIndexOf(from))
    throw new Error('Mobile source anchor missing or duplicated: ' + from.slice(0, 48));
  return text.replace(from, to);
}
function buildMobile(html) {
  html = replaceOnce(html, '<!doctype html>',
    '<!doctype html>\n<!-- Generated from Index.html by tools/build_mobile.cjs. Edit the builder, not this file. -->');
  html = replaceOnce(html, '<title>NPV Tunnel NPVT Converter</title>',
    '<title>NPVT Mobile | Smart Config Converter</title>\n<meta name="theme-color" content="#0b1712">');
  html = replaceOnce(html, '</style>', MOBILE_STYLES + '\n</style>');
  html = replaceOnce(html, '<body>', '<body class="mobile-standalone">');
  html = replaceOnce(html,
    'privacy-first / single-file / terminal converter',
    'offline / mobile / single-file');
  html = replaceOnce(html,
    '<h1>Smart Config Converter<span class="caret">_</span></h1>',
    '<h1>NPVT Mobile</h1>');
  html = replaceOnce(html,
    'One input for many proxy formats. The converter detects each source and offers only supported exports. Encrypted formats without available keys are identified, not guessed.',
    'Import or paste a config, then choose a compatible export. Everything runs on your device.');
  html = replaceOnce(html,
    '<div class="hero-actions">\n        <a class="btn primary" href="#smartWorkspace">Start conversion</a>\n        \n      </div>',
    '');
  return html;
}
const generated = buildMobile(source);
if (process.argv.includes('--check')) {
  const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  if (existing !== generated) {
    console.error('mobile.html is outdated. Run: node tools/build_mobile.cjs');
    process.exitCode = 1;
  } else {
    console.log('mobile.html is up to date and self-contained.');
  }
} else {
  fs.writeFileSync(target, generated);
  console.log('Wrote mobile.html (' + Buffer.byteLength(generated) + ' bytes)');
}
