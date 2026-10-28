'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const desktopUrl=pathToFileURL(path.join(root,'Index.html')).href;
const mobileUrl=pathToFileURL(path.join(root,'mobile.html')).href;
const images=path.join(root,'tests','screenshots');
fs.mkdirSync(images,{recursive:true});
const uuid='f47ac10b-58cc-4372-a567-0e02b2c3d4e5';
const vless='vless://'+uuid+'@example.org:443?encryption=none&security=tls&type=ws&host=cdn.example.org&path=%2Fws#UI';
const hy2='hy2://secret@hy2.example:443?sni=hy2.example#HY2';
const wg='[Interface]\nPrivateKey = eCtXsJZ27+4PbhDkHnB923tkUn2Gj59wZw5wFA75MnU=\nAddress = 10.3.0.2/32\n\n[Peer]\nPublicKey = Cr8hWlKvtDt7nrvf+f0brNQQzabAqrjfBvas9pmowjo=\nEndpoint = example.org:51820\nAllowedIPs = 0.0.0.0/0';

async function run(){
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    for(const dimension of [
      {width:1440,height:900,label:'desktop',url:desktopUrl},
      {width:390,height:844,label:'mobile',url:desktopUrl},
      {width:390,height:844,label:'mobile-standalone',url:mobileUrl}
    ]){
      const page=await browser.newPage({viewport:{width:dimension.width,height:dimension.height},acceptDownloads:true});
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(dimension.url,{waitUntil:'load'});
      if(dimension.label==='mobile-standalone'){
        assert.equal(await page.locator('body.mobile-standalone').count(),1);
        assert.equal(await page.locator('h1').innerText(),'NPVT Mobile');
        assert.equal(await page.locator('.hero-actions').count(),0);
        const external=await page.locator('script[src],link[rel="stylesheet"]').count();
        assert.equal(external,0,'mobile file must run without external assets');
      }
      assert.equal(await page.locator('#smartWorkspace').isVisible(),true);
      assert.equal(await page.locator('.workflow-nav').isVisible(),false);
      assert.equal(await page.locator('#smartDownload').isDisabled(),true);
      async function paste(value){
        await page.locator('#smartInput').fill(value);
        await page.waitForTimeout(360);
      }
      async function waitSource(name){
        await page.waitForFunction(pattern=>document.getElementById('smartDetected').textContent.includes(pattern),name,{timeout:10000});
      }
      async function available(){
        return page.locator('#smartTarget option').evaluateAll(nodes=>nodes.map(x=>x.value));
      }
      await paste(vless);
      await waitSource('proxy share link');
      assert.equal(await page.locator('#smartTarget').inputValue(),'xray','default export should be an actual conversion');
      assert.equal(await page.locator('#smartWorkspace').getAttribute('aria-busy'),'false');
      await page.locator('#smartInput').press('End');
      await page.locator('#smartInput').press('Enter');
      assert.ok((await page.locator('#smartInput').inputValue()).endsWith('\n'),'Enter must insert newline in editor');
      await waitSource('proxy share link');
      assert.ok((await available()).includes('npvt'));
      assert.ok((await available()).includes('xray'));
      assert.ok(!(await available()).includes('singbox'));
      await page.locator('#smartTarget').selectOption('npvt');
      const npvt=await page.locator('#smartOutput').inputValue();
      assert.match(npvt,/^NPVT1\s+/);
      await paste(npvt);
      await waitSource('NPVT1 encrypted container');
      assert.ok(!(await available()).includes('npvt'));
      await page.locator('#smartTarget').selectOption('links');
      assert.match(await page.locator('#smartOutput').inputValue(),/vless:\/\//);
      await page.locator('#smartFiles').setInputFiles({name:'client.conf',mimeType:'text/plain',buffer:Buffer.from(wg)});
      await waitSource('WireGuard / AmneziaWG');
      assert.ok((await available()).includes('mihomoYaml'));
      assert.ok(!(await available()).includes('xray'));
      await page.locator('#smartTarget').selectOption('mihomoYaml');
      assert.match(await page.locator('#smartOutput').inputValue(),/wireguard/);
      assert.equal(await page.locator('#smartFiles').inputValue(),'','file picker must reset after import');
      const download=page.waitForEvent('download');
      await page.locator('#smartDownload').click();
      assert.match((await download).suggestedFilename(),/\.yaml$/);
      const fake={SSH:[{Host:'ssh.example.org',Port:22}],Proxy:[],Payload:{Value:'GET /'}};
      const encrypt=crypto.createCipheriv('aes-128-ecb',Buffer.from('<n3t5yn4^n3tm0d>'),null);
      const nm=Buffer.concat([encrypt.update(JSON.stringify(fake)),encrypt.final()]).toString('base64');
      await page.locator('#smartFiles').setInputFiles({name:'example.nm',mimeType:'application/octet-stream',buffer:Buffer.from(nm)});
      await waitSource('NetMod AES-ECB');
      assert.ok((await available()).includes('netmod'));
      assert.equal((await available()).includes('links'),false);
      await page.locator('#smartTarget').selectOption('netmod');
      assert.equal(JSON.parse(await page.locator('#smartOutput').inputValue()).SSH[0].Host,'ssh.example.org');
      const h=Buffer.alloc(169);h[0]=1;h[50]=1;h.writeUInt32BE(600000,53);h.writeUInt32BE(16,133);
      const binary=Buffer.alloc(9+169+16+32+64);
      binary.write('NPVS',0);binary[4]=5;binary.writeUInt32BE(169,5);h.copy(binary,9);binary.writeUInt32BE(32,9+169+12);
      await page.locator('#smartFiles').setInputFiles({name:'encrypted.npvs',mimeType:'application/octet-stream',buffer:binary});
      await waitSource('NPVS v5');
      assert.deepEqual(await available(),['inspection']);
      await page.locator('#smartTableFile').setInputFiles({
        name:'wrong-generation.bin',mimeType:'application/octet-stream',buffer:Buffer.alloc(749568)
      });
      await page.waitForFunction(()=>document.getElementById('smartTableStatus').textContent.includes('Table rejected'),null,{timeout:10000});
      assert.deepEqual(await available(),['inspection'],'invalid lookup tables must not unlock NPVS');
      assert.match(await page.locator('#smartTableStatus').innerText(),/compatibility self-test failed/);
      await page.locator('#smartTarget').selectOption('inspection');
      const info=JSON.parse(await page.locator('#smartOutput').inputValue());
      assert.equal(info[0].unlock,'creator-passphrase');

      // Phase 2: importing authorized NPVS passphrase exports must emit actual links.
      const passphrase='browser-fixture-only',salt=crypto.randomBytes(16),dek=crypto.randomBytes(32);
      const derived=crypto.pbkdf2Sync(passphrase,salt,500,32,'sha256'),wrapNonce=crypto.randomBytes(12),bodyNonce=crypto.randomBytes(12);
      function sealNpvs(key,nonce,plain,aad){
        const cipher=crypto.createCipheriv('chacha20-poly1305',key,nonce,{authTagLength:16});
        cipher.setAAD(aad,{plaintextLength:plain.length});
        return Buffer.concat([cipher.update(plain),cipher.final(),cipher.getAuthTag()]);
      }
      function u32(n){const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;}
      const wrapped=Buffer.concat([wrapNonce,sealNpvs(derived,wrapNonce,dek,salt)]);
      const header=Buffer.from(JSON.stringify({passphrase:{kdf:'pbkdf2-hmac-sha256',iters:500,
        salt:salt.toString('base64url'),wrap:wrapped.toString('base64url')}}));
      const profile=Buffer.from(JSON.stringify({configs:[{name:'Synthetic VLESS',v2rayProfile:{
        configType:5,server:'example.org',serverPort:'443',password:uuid,method:'none'}}]}));
      const sealed=sealNpvs(dek,bodyNonce,profile,header);
      const protectedFile=Buffer.concat([Buffer.from('NPVS'),Buffer.from([1]),u32(header.length),
        header,bodyNonce,u32(sealed.length),sealed,Buffer.alloc(64)]);
      await page.locator('#smartFiles').setInputFiles({name:'authorized.npvs',
        mimeType:'application/octet-stream',buffer:protectedFile});
      await waitSource('locked');
      assert.deepEqual(await available(),['inspection']);
      await page.locator('#smartPassphrase').fill(passphrase);
      await page.locator('#smartUnlock').click();
      await waitSource('authenticated');
      assert.ok((await available()).includes('links'));
      await page.locator('#smartTarget').selectOption('links');
      assert.match(await page.locator('#smartOutput').inputValue(),/vless:\/\//);
      await page.locator('#smartPassphrase').fill('invalid');
      await page.locator('#smartUnlock').click();
      await waitSource('authentication failed');
      assert.equal((await available()).includes('links'),false);
      await page.locator('#smartPassphrase').fill('');

      // Gen-2 app-key: one authorized key-file import, then password-free conversion.
      const gen2Id=crypto.randomBytes(16),gen2Salt=crypto.randomBytes(16),a16=crypto.randomBytes(16),
        gen2Dek=crypto.randomBytes(32),gen2Nonce=crypto.randomBytes(12),gen2WrapNonce=crypto.randomBytes(12);
      const gen2Kdk=crypto.createHash('sha256').update('npvtunnel/appkey/v2 ').update(a16).update(gen2Id).digest();
      const gen2Wrap=Buffer.concat([gen2WrapNonce,sealNpvs(gen2Kdk,gen2WrapNonce,gen2Dek,gen2Salt)]);
      const b16=n=>{const b=Buffer.alloc(2);b.writeUInt16BE(n);return b;};
      const gen2Prefix=Buffer.concat([Buffer.from([1]),gen2Id,crypto.randomBytes(33),
        Buffer.from([2]),b16(0),b16(2),gen2Salt,gen2Wrap]);
      const gen2MetaKey=Buffer.from(crypto.hkdfSync('sha256',gen2Dek,gen2Nonce,'NPVS-v5/metadata',32));
      const gen2Meta=sealNpvs(gen2MetaKey,gen2Nonce,Buffer.from('{"policy":{}}'),gen2Prefix);
      const gen2Header=Buffer.concat([gen2Prefix,u32(gen2Meta.length),gen2Meta]);
      const gen2ContentId=crypto.randomBytes(32),gen2Seq=65535;
      const config=Buffer.from(JSON.stringify({configs:[{name:'Gen2',v2rayProfile:{
        configType:5,server:'example.org',serverPort:443,password:uuid,method:'none'}}]}));
      const fieldInfo=Buffer.concat([Buffer.from('NPV-fields-v1/field/'),b16(gen2Seq)]);
      const fieldKey=Buffer.from(crypto.hkdfSync('sha256',gen2Dek,gen2ContentId,fieldInfo,32));
      const fieldAad=Buffer.concat([Buffer.from('NPV-fields-v1/record/'),gen2ContentId,b16(gen2Seq),u32(config.length)]);
      const fieldBlob=sealNpvs(fieldKey,Buffer.alloc(12),config,fieldAad);
      const gen2Body=Buffer.concat([Buffer.from([78,80,70,1]),gen2ContentId,b16(1),
        b16(gen2Seq),b16(0),b16(fieldBlob.length),fieldBlob]);
      const gen2File=Buffer.concat([Buffer.from('NPVS'),Buffer.from([5]),u32(gen2Header.length),
        gen2Header,gen2Nonce,u32(gen2Body.length),gen2Body,Buffer.alloc(64)]);
      await page.locator('#smartFiles').setInputFiles({name:'unlocked-with-key.npvs',
        mimeType:'application/octet-stream',buffer:gen2File});
      await waitSource('locked');
      assert.equal((await available()).includes('links'),false);
      const authorized={format:'npvs-gen2-keys-v1',entries:[{
        configId:gen2Id.toString('hex'),salt:gen2Salt.toString('hex'),a16:a16.toString('hex')}]};
      await page.locator('#smartAppKeyFile').setInputFiles({
        name:'authorized-keys.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(authorized))});
      await waitSource('authenticated');
      assert.ok((await available()).includes('links'));
      assert.match(await page.locator('#smartAppKeyStatus').innerText(),/1 authorized key/);
      assert.equal((await page.locator('body').innerText()).includes(a16.toString('hex')),false);
      await page.locator('#smartTarget').selectOption('links');
      assert.match(await page.locator('#smartOutput').inputValue(),/vless:\/\/f47ac10b/);
      await page.locator('#smartReset').click();
      await page.locator('#smartFiles').setInputFiles({name:'key-cleared.npvs',
        mimeType:'application/octet-stream',buffer:gen2File});
      await waitSource('locked');
      assert.equal((await available()).includes('links'),false);

      await page.locator('#smartFiles').setInputFiles([
        {name:'one.txt',mimeType:'text/plain',buffer:Buffer.from(vless)},
        {name:'two.txt',mimeType:'text/plain',buffer:Buffer.from(hy2)}
      ]);
      await page.waitForFunction(()=>document.getElementById('smartDetected').textContent.includes('2. '),null,{timeout:10000});
      assert.ok((await available()).includes('subscription'));
      assert.ok(!(await available()).includes('npvt'));
      await page.locator('#smartTarget').selectOption('links');
      assert.match(await page.locator('#smartOutput').inputValue(),/hy2:\/\//);
      // Capture the converted state as well as the empty state.
      await page.screenshot({path:path.join(images,'populated-'+dimension.label+'.png'),fullPage:true,animations:'disabled'});
      const fixture=Buffer.from(vless);
      await page.locator('#smartFiles').setInputFiles(Array.from({length:6},(_,i)=>({
        name:'config-'+i+'.txt',mimeType:'text/plain',buffer:fixture
      })));
      await page.waitForFunction(()=>document.getElementById('smartDetected').textContent.includes('+2 more'),null,{timeout:10000});
      assert.equal(await page.locator('#smartDetectedMore').isVisible(),true);
      await page.locator('#smartDetectedMore summary').click();
      assert.ok((await page.locator('#smartDetectedAll').innerText()).includes('config-5.txt'));
      await page.locator('#smartFiles').setInputFiles({name:'again.txt',mimeType:'text/plain',buffer:fixture});
      await waitSource('proxy share link');
      assert.equal(await page.locator('#smartFiles').inputValue(),'');
      // A slow import that completes after Clear must not restore results.
      await page.evaluate(()=>{
        const original=File.prototype.arrayBuffer;
        File.prototype.arrayBuffer=function(){
          return new Promise((resolve,reject)=>
            setTimeout(()=>original.call(this).then(resolve,reject),350));
        };
      });
      await page.locator('#smartFiles').setInputFiles({name:'slow.txt',mimeType:'text/plain',buffer:fixture});
      await page.locator('#smartReset').click();
      await page.waitForTimeout(550);
      assert.equal(await page.locator('#smartDetected').innerText(),'No input yet');
      assert.equal(await page.locator('#smartOutput').inputValue(),'');
      assert.equal(await page.locator('#smartWorkspace').getAttribute('aria-busy'),'false');
      if(dimension.label!=='desktop'){
        const size=await page.locator('#smartInput').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
        assert.ok(size>=16,'mobile editor must be readable without focus zoom');
      }
      await page.screenshot({path:path.join(images,'empty-'+dimension.label+'.png'),fullPage:true,animations:'disabled'});
      await page.locator('#smartReset').click();
      assert.equal(await page.locator('#smartTarget').isDisabled(),true);
      assert.equal(await page.locator('#smartOutput').inputValue(),'');
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
      assert.ok(overflow<=2,dimension.label+' horizontal overflow '+overflow);
      await page.screenshot({path:path.join(images,'unified-'+dimension.label+'.png'),fullPage:true,animations:'disabled'});
      assert.deepEqual(errors,[],dimension.label+' page errors');
      console.log('PASS '+dimension.label+': smart detection, dynamic formats, encrypted headers, NPVT, NetMod, batch, responsive UI');
      await page.close();
    }
  }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
