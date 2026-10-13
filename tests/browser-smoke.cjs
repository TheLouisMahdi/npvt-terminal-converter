'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '..');
const url = pathToFileURL(path.join(root, 'Index.html')).href;
const capture = path.join(root, 'tests', 'screenshots');
fs.mkdirSync(capture, {recursive: true});

const vless = 'vless://f47ac10b-58cc-4372-a567-0e02b2c3d4e5@example.org:443?encryption=none&security=tls&type=ws&host=cdn.example.org&path=%2Fws&sni=cdn.example.org#UI-Test';
const native = JSON.stringify({proxies:[{
  type:'snell',name:'Snell Test',server:'snell.example.org',port:44046,psk:'secret',version:4
}]});
const tt = JSON.stringify({proxies:[{
  type:'trusttunnel',name:'TrustTunnel',server:'example.org',port:443,
  username:'demo',password:'test-secret',sni:'front.example.org'
}]});

async function run() {
  const browser = await chromium.launch({headless:true, args:['--no-sandbox']});
  try {
    for (const viewport of [{width:1440,height:900,label:'desktop'},{width:390,height:844,label:'mobile'}]) {
      const context = await browser.newContext({viewport: {width:viewport.width,height:viewport.height}, acceptDownloads:true});
      const page = await context.newPage();
      const errors=[];
      page.on('pageerror', e=>errors.push(String(e.message||e)));
      await page.goto(url, {waitUntil:'load'});
      assert.equal(await page.locator('nav.workflow-nav a').count(),6,'all six workflow links are visible');
      assert.equal(await page.locator('#nativeTools').count(),1,'native panel exists');
      const hrefs=await page.locator('nav.workflow-nav a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
      for(const href of hrefs)assert.equal(await page.locator(href).count(),1,'navigation target '+href);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
      assert.ok(overflow<=2, viewport.label+' horizontal overflow: '+overflow);
      await page.locator('#nativeInput').fill(native);
      await page.locator('#nativeToYaml').click();
      assert.match(await page.locator('#nativeOutput').inputValue(),/proxies:/);
      assert.equal(await page.locator('#nativeDownload').isEnabled(),true);
      assert.equal(await page.locator('#nativeCopy').isEnabled(),true);
      const download=page.waitForEvent('download');
      await page.locator('#nativeDownload').click();
      assert.match((await download).suggestedFilename(),/\.yaml$/);
      await page.locator('#nativeInput').fill(tt);
      await page.locator('#nativeToTt').click();
      const deepLink=await page.locator('#nativeOutput').inputValue();
      assert.match(deepLink,/^tt:\/\/\?/);
      await page.locator('#nativeInput').fill(deepLink);
      await page.locator('#nativeToJson').click();
      assert.match(await page.locator('#nativeOutput').inputValue(),/trusttunnel-deeplink/);
      await page.locator('#nativeFile').setInputFiles({
        name:'sample.yaml',mimeType:'text/plain',
        buffer:Buffer.from('proxies:\n- name: Snell\n  type: snell\n  server: example.org\n  port: 443\n  psk: pass\n')
      });
      await page.waitForFunction(() => document.getElementById('nativeInput').value.includes('proxies:'), null, {timeout:10000});
      await page.locator('#nativeToJson').click();
      assert.equal(JSON.parse(await page.locator('#nativeOutput').inputValue()).proxies[0].type,'snell');
      await page.locator('#nativeClear').click();
      assert.equal(await page.locator('#nativeOutput').inputValue(),'');
      assert.equal(await page.locator('#nativeDownload').isDisabled(),true);
      await page.locator('#nativeInput').fill('proxies:\n- bad: [invalid, syntax\n');
      await page.locator('#nativeToYaml').click();
      assert.equal(await page.locator('#nativeOutput').inputValue(),'');
      assert.match(await page.locator('#nativeLog').innerText(),/Conversion unavailable/);
      // End-to-end legacy link to NPVT1 to recovered link in the real page.
      await page.locator('#reverseInput').fill(vless);
      await page.locator('#buildReverse').click();
      const npvt=await page.locator('#reverseOutput').inputValue();
      assert.match(npvt,/^NPVT1\s+/);
      await page.locator('#forwardInput').fill(npvt);
      await page.locator('#convertForward').click();
      assert.match(await page.locator('#forwardOutput').inputValue(),/vless:\/\//i);
      await page.locator('#jsonInput').fill(JSON.stringify({
        outbounds:[{protocol:'vless',tag:'node',settings:{
          vnext:[{address:'edge.example.org',port:443,users:[{id:'f47ac10b-58cc-4372-a567-0e02b2c3d4e5',encryption:'none'}]}]},
          streamSettings:{network:'ws',security:'tls',wsSettings:{path:'/ws'}}}]
      }));
      await page.locator('#jsonToLinks').click();
      assert.match(await page.locator('#jsonOutput').inputValue(),/vless:\/\//);
      await page.locator('#nativeInput').fill(native);
      await page.locator('#nativeToYaml').click();
      await page.locator('#nativeTools').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(capture,'native-'+viewport.label+'.png'),animations:'disabled'});
      await page.locator('#nativeClear').click();
      await page.locator('#clearForward').click();
      await page.locator('#clearReverse').click();
      await page.locator('#clearJsonTools').click();
      await page.evaluate(() => window.scrollTo({top:0,behavior:'instant'}));
      await page.waitForTimeout(90);
      await page.screenshot({path:path.join(capture,viewport.label+'.png'),fullPage:true,animations:'disabled'});
      assert.deepEqual(errors,[],viewport.label+' JavaScript errors');
      console.log('PASS '+viewport.label+': responsive navigation, native formats, file import, download, TT, NPVT, Xray JSON, error handling');
      await context.close();
    }
  } finally {await browser.close();}
}

run().catch(error=>{console.error(error);process.exitCode=1;});
