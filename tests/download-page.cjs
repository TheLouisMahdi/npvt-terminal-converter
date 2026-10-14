'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const allowed=new Set(['download.html','mobile.html','Index.html']);
const server=http.createServer((req,res)=>{
  const file=new URL(req.url,'http://localhost').pathname.slice(1);
  if(!allowed.has(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');
  fs.createReadStream(path.join(root,file)).pipe(res);
});

async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const origin='http://127.0.0.1:'+server.address().port;
    const page=await browser.newPage({acceptDownloads:true});
    // The README links to a same-origin HTML download page; the browser must
    // save actual HTML bytes instead of displaying GitHub's raw text view.
    for(const [target,file,id] of [
      ['mobile','mobile.html','mobileDownload'],
      ['desktop','Index.html','desktopDownload']
    ]){
      await page.goto(origin+'/download.html?file='+target+'&manual=1');
      const button=page.locator('#'+id);
      assert.equal(await button.getAttribute('download'),file);
      const downloaded=page.waitForEvent('download');
      await button.click();
      const asset=await downloaded;
      assert.equal(asset.suggestedFilename(),file);
      assert.deepEqual(fs.readFileSync(await asset.path()),fs.readFileSync(path.join(root,file)));
      console.log('PASS '+target+': downloaded exact standalone '+file);
    }
    // A click on the README download link should start a save automatically
    // in Chromium; the page retains manual download links for restrictive browsers.
    const automatic=page.waitForEvent('download');
    await page.goto(origin+'/download.html?file=mobile');
    assert.equal((await automatic).suggestedFilename(),'mobile.html');
    await page.goto(origin+'/mobile.html');
    assert.equal(await page.locator('h1').innerText(),'NPVT Mobile');
    await page.goto(origin+'/Index.html');
    assert.equal(await page.locator('h1').innerText(),'Smart Config Converter_');
    console.log('PASS Pages-style HTTP: automatic download and HTML rendering');
    await page.close();
  }finally{
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;server.close();});
