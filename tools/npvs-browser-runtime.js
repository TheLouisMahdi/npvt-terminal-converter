/* NPVS Phase 2: standalone offline authenticated importer. Inlined into Index.html. */
const NPVS_PHASE2_MAX = 1048576;
const npvsUtf8 = new TextEncoder();

// Authorized key material is session-only. No third-party white-box tables are bundled.
// A16 is generated from a specific Gen-2 envelope salt by an authorized key provider.
// Each entry is scoped to both configId and salt, never a universal bypass.
const npvsGen2Keys=new Map();
function npvsHex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
function npvsParseHex(value,size){
  if(typeof value!=='string'||value.length!==size*2||!/^[0-9a-f]+$/i.test(value))
    npvsFail('invalid authorized key-file field');
  const bytes=new Uint8Array(size);
  for(let i=0;i<size;i++)bytes[i]=parseInt(value.slice(i*2,i*2+2),16);
  return bytes;
}
function npvsInstallGen2Keys(document){
  if(!document||typeof document!=='object'||Array.isArray(document)||
     document.format!=='npvs-gen2-keys-v1'||!Array.isArray(document.entries)||
     !document.entries.length||document.entries.length>32)
    npvsFail('invalid authorized NPVS AppKey key-file format');
  const incoming=new Map();
  for(const entry of document.entries){
    if(!entry||typeof entry!=='object'||Array.isArray(entry))
      npvsFail('invalid key-file entry');
    const id=npvsParseHex(entry.configId,16),salt=npvsParseHex(entry.salt,16);
    const hasA16=entry.a16!==undefined,hasKdk=entry.kdk!==undefined;
    if(hasA16===hasKdk)npvsFail('each key-file entry requires exactly one A16 or KDK');
    const material=hasA16?npvsParseHex(entry.a16,16):npvsParseHex(entry.kdk,32);
    const index=npvsHex(id)+':'+npvsHex(salt);
    if(incoming.has(index))npvsFail('duplicate authorized key-file entry');
    incoming.set(index,{material,type:hasA16?'a16':'kdk'});
  }
  // Validate all input before mutating the current keyring.
  for(const [key,value] of incoming)npvsGen2Keys.set(key,value);
  return npvsGen2Keys.size;
}
function npvsClearGen2Keys(){npvsGen2Keys.clear();}
function npvsHasGen2Key(configId,salt){
  return npvsGen2Keys.has(npvsHex(configId)+':'+npvsHex(salt));
}
async function npvsGen2AppKeyKdk(env){
  const item=npvsGen2Keys.get(npvsHex(env.configID)+':'+npvsHex(env.salt));
  if(!item)return null;
  if(item.type==='kdk')return item.material;
  const data=npvsJoin(npvsUtf8.encode('npvtunnel/appkey/v2 '),item.material,env.configID);
  return new Uint8Array(await crypto.subtle.digest('SHA-256',data));
}

function npvsFail(reason){throw new Error('NPVS: '+reason);}
function npvsJoin(...arrays){const out=new Uint8Array(arrays.reduce((n,a)=>n+a.length,0));let o=0;for(const a of arrays){out.set(a,o);o+=a.length;}return out;}
function npvsBE16(x){return new Uint8Array([x>>>8,x&255]);}
function npvsBE32(x){return new Uint8Array([x>>>24,(x>>>16)&255,(x>>>8)&255,x&255]);}
function npvsLE64(x){const a=new Uint8Array(8);let n=BigInt(x);for(let i=0;i<8;i++){a[i]=Number(n&255n);n>>=8n;}return a;}
function npvsBigLE(bytes){let n=0n;for(let i=bytes.length-1;i>=0;i--)n=(n<<8n)|BigInt(bytes[i]);return n;}
function npvsRead32(buf,offset){return (buf[offset]|(buf[offset+1]<<8)|(buf[offset+2]<<16)|(buf[offset+3]<<24))>>>0;}
function npvsPut32(buf,offset,x){for(let i=0;i<4;i++)buf[offset+i]=(x>>>(8*i))&255;}
function npvsRot(x,n){return (x<<n)|(x>>>(32-n));}
function npvsBlock(key,nonce,counter){
  const st=new Uint32Array(16);
  st.set([0x61707865,0x3320646e,0x79622d32,0x6b206574]);
  for(let i=0;i<8;i++)st[4+i]=npvsRead32(key,4*i);
  st[12]=counter;for(let i=0;i<3;i++)st[13+i]=npvsRead32(nonce,4*i);
  const x=Uint32Array.from(st);
  function q(a,b,c,d){x[a]=(x[a]+x[b])>>>0;x[d]=npvsRot(x[d]^x[a],16);x[c]=(x[c]+x[d])>>>0;x[b]=npvsRot(x[b]^x[c],12);x[a]=(x[a]+x[b])>>>0;x[d]=npvsRot(x[d]^x[a],8);x[c]=(x[c]+x[d])>>>0;x[b]=npvsRot(x[b]^x[c],7);}
  for(let i=0;i<10;i++){q(0,4,8,12);q(1,5,9,13);q(2,6,10,14);q(3,7,11,15);q(0,5,10,15);q(1,6,11,12);q(2,7,8,13);q(3,4,9,14);}
  const out=new Uint8Array(64);for(let i=0;i<16;i++)npvsPut32(out,4*i,(x[i]+st[i])>>>0);return out;
}
function npvsPoly1305(message,otk){
  const clamp=otk.slice(0,16);
  clamp[3]&=15;clamp[7]&=15;clamp[11]&=15;clamp[15]&=15;
  clamp[4]&=252;clamp[8]&=252;clamp[12]&=252;
  const r=npvsBigLE(clamp),s=npvsBigLE(otk.subarray(16,32)),p=(1n<<130n)-5n;
  let acc=0n;
  for(let i=0;i<message.length;i+=16){const part=message.subarray(i,i+16);acc=((acc+npvsBigLE(part)+(1n<<BigInt(part.length*8)))*r)%p;}
  const result=(acc+s)&((1n<<128n)-1n);
  const bytes=new Uint8Array(16);let tmp=result;for(let i=0;i<16;i++){bytes[i]=Number(tmp&255n);tmp>>=8n;}return bytes;
}
function npvsPad16(bytes){return new Uint8Array((16-bytes.length%16)%16);}
function npvsOpen(key,nonce,sealed,aad=new Uint8Array()){
  if(key.length!==32||nonce.length!==12||sealed.length<16)npvsFail('invalid authenticated encryption parameters');
  const data=sealed.subarray(0,sealed.length-16),tag=sealed.subarray(sealed.length-16);
  const macInput=npvsJoin(aad,npvsPad16(aad),data,npvsPad16(data),npvsLE64(aad.length),npvsLE64(data.length));
  const expected=npvsPoly1305(macInput,npvsBlock(key,nonce,0).subarray(0,32));
  let different=0;for(let i=0;i<16;i++)different|=tag[i]^expected[i];
  if(different)npvsFail('authentication failed (wrong key, damaged file or modified ciphertext)');
  const out=new Uint8Array(data.length);
  for(let offset=0,counter=1;offset<data.length;offset+=64,counter++){
    const block=npvsBlock(key,nonce,counter);
    for(let j=0;j<64&&offset+j<data.length;j++)out[offset+j]=data[offset+j]^block[j];
  }
  return out;
}
async function npvsPbkdf2(pass,salt,iterations){
  if(!Number.isSafeInteger(iterations)||iterations<1||iterations>2000000)npvsFail('PBKDF2 iterations outside supported 1..2000000 range');
  const key=await crypto.subtle.importKey('raw',npvsUtf8.encode(pass),'PBKDF2',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256));
}
async function npvsHKDF(secret,salt,info){
  const key=await crypto.subtle.importKey('raw',secret,'HKDF',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,256));
}
function npvsB64(value){
  if(typeof value!=='string'||!/^[A-Za-z0-9_+\/-]*={0,2}$/.test(value))npvsFail('invalid wrapped key encoding');
  const bin=atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4));
  return Uint8Array.from(bin,c=>c.charCodeAt(0));
}
function npvsUtf8Decode(bytes){return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
function npvsGen1(data,passphrase){
  if(data.length<9+16+64)npvsFail('truncated Gen-1 envelope');
  const view=new DataView(data.buffer,data.byteOffset,data.byteLength),len=view.getUint32(5,false);
  if(len<2||len>data.length-9-16-64)npvsFail('invalid Gen-1 header length');
  const headerBytes=data.subarray(9,9+len),nonceOffset=9+len;
  const bodyLength=view.getUint32(nonceOffset+12,false);
  if(bodyLength<16||nonceOffset+16+bodyLength+64!==data.length)npvsFail('invalid Gen-1 body length');
  let header;
  try{header=JSON.parse(npvsUtf8Decode(headerBytes));}catch(_){npvsFail('invalid Gen-1 JSON header');}
  if(!header||typeof header!=='object'||Array.isArray(header))npvsFail('invalid Gen-1 header object');
  const app=header.appKey,locked=header.passphrase;
  if(!app&&!locked)npvsFail('recipient-key variant requires the matching private key');
  return {headerBytes,header,nonce:data.subarray(nonceOffset,nonceOffset+12),sealed:data.subarray(nonceOffset+16,nonceOffset+16+bodyLength),app,locked,passphrase};
}
function npvsGen2(data,passphrase){
  if(data.length<9+135+16+64)npvsFail('truncated Gen-2 envelope');
  const view=new DataView(data.buffer,data.byteOffset,data.byteLength),length=view.getUint32(5,false);
  if(length<135||length>data.length-9-16-64)npvsFail('invalid Gen-2 header length');
  const header=data.subarray(9,9+length),hv=new DataView(header.buffer,header.byteOffset,header.byteLength);
  if(header[0]!==1)npvsFail('unknown Gen-2 header revision');
  const method=header[50],count=hv.getUint16(51,false);
  if(method>2||count>1024||(method===0&&!count))npvsFail('invalid Gen-2 unlock method or recipient list');
  let off=53+count*125,iterations=0,salt,wrap;
  const block=method===1?80:method===2?78:0;
  if(off+block+4>length)npvsFail('truncated Gen-2 key block');
  if(method===1){iterations=hv.getUint32(off,false);salt=header.subarray(off+4,off+20);wrap=header.subarray(off+20,off+80);}
  if(method===2){if(hv.getUint16(off,false)!==2)npvsFail('invalid app-key marker');salt=header.subarray(off+2,off+18);wrap=header.subarray(off+18,off+78);}
  off+=block;
  const metaLength=hv.getUint32(off,false);
  if(metaLength<16||off+4+metaLength!==length)npvsFail('invalid Gen-2 sealed metadata size');
  const meta=header.subarray(off+4),prefix=header.subarray(0,off);
  const bodyOff=9+length,bodyLength=view.getUint32(bodyOff+12,false);
  if(bodyLength<38||bodyOff+16+bodyLength+64!==data.length)npvsFail('invalid Gen-2 body length');
  const body=data.subarray(bodyOff+16,bodyOff+16+bodyLength);
  if(body[0]!==78||body[1]!==80||body[2]!==70||body[3]!==1)npvsFail('invalid NPF record magic');
  const bv=new DataView(body.buffer,body.byteOffset,body.byteLength),num=bv.getUint16(36,false);
  let pos=38;const rows=[];const seen=new Set();
  for(let i=0;i<num;i++){
    if(pos+6>body.length)npvsFail('truncated NPF record header');
    const seq=bv.getUint16(pos,false),size=bv.getUint16(pos+4,false);
    if(size<16||pos+6+size>body.length||seen.has(seq))npvsFail('invalid or repeated NPF record');
    seen.add(seq);rows.push({seq,sealed:body.subarray(pos+6,pos+6+size)});pos+=6+size;
  }
  if(pos!==body.length)npvsFail('trailing NPF data');
  return {method,iterations,salt,wrap,meta,prefix,nonce:data.subarray(bodyOff,bodyOff+12),contentID:body.subarray(4,36),rows,configID:header.subarray(1,17),passphrase};
}
function npvsDecodeSentinels(value){
  if(typeof value!=='string')return value;
  return value.replace(/npvs1:([A-Za-z0-9+/_=-]+)/g,(all,token)=>{
    try{return npvsUtf8Decode(npvsB64(token));}catch(_){return all;}
  });
}
function npvsUnwrapFieldText(bytes){
  const value=npvsUtf8Decode(bytes).trim();
  if(value.startsWith('"')&&value.endsWith('"')){
    try{const parsed=JSON.parse(value);if(typeof parsed==='string')return npvsDecodeSentinels(parsed);}catch(_){}
  }
  return npvsDecodeSentinels(value);
}
function npvsSubstitute(value,fields){
  if(typeof value==='number'&&Number.isInteger(value)&&fields.has(value))return npvsUnwrapFieldText(fields.get(value));
  if(typeof value==='string')return npvsDecodeSentinels(value);
  if(Array.isArray(value))return value.map(v=>npvsSubstitute(v,fields));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,npvsSubstitute(v,fields)]));
  return value;
}
async function npvsPhase2Decode(input,passphrase=''){
  const data=input instanceof Uint8Array?input:new Uint8Array(input);
  if(data.length>NPVS_PHASE2_MAX)npvsFail('file exceeds 1 MiB');
  if(data.length<9||data[0]!==78||data[1]!==80||data[2]!==86||data[3]!==83)npvsFail('not an NPVS file');
  const version=data[4];
  if(version<=1){
    const env=npvsGen1(data,passphrase);
    let dek,unlockMethod;
    let appError;
    if(env.app){
      try{
        if(env.app.kdf!=='wbaes-ctr-sha256'||env.app.keyId!==1)npvsFail('unsupported app-key generation');
        if(typeof ctrCrypt!=='function')npvsFail('legacy key generation is unavailable');
        const salt=npvsB64(env.app.salt),wrap=npvsB64(env.app.wrap);
        if(salt.length!==16||wrap.length!==60)npvsFail('bad Gen-1 app-key parameters');
        const stream=ctrCrypt(salt,new Uint8Array(16));
        const source=npvsJoin(npvsUtf8.encode('npvtunnel/appkey/v1 '),stream);
        const kdk=new Uint8Array(await crypto.subtle.digest('SHA-256',source));
        dek=npvsOpen(kdk,wrap.subarray(0,12),wrap.subarray(12),salt);
        unlockMethod='app-key';
      }catch(error){appError=error;}
    }
    if(!dek && env.locked){
      if(!passphrase)return {status:'locked',version,unlock:'creator-passphrase'};
      if(env.locked.kdf!=='pbkdf2-hmac-sha256')npvsFail('unsupported Gen-1 passphrase KDF');
      const salt=npvsB64(env.locked.salt),wrap=npvsB64(env.locked.wrap);
      if(salt.length!==16||wrap.length!==60)npvsFail('invalid Gen-1 passphrase block');
      const kdk=await npvsPbkdf2(passphrase,salt,env.locked.iters);
      dek=npvsOpen(kdk,wrap.subarray(0,12),wrap.subarray(12),salt);
      unlockMethod='creator-passphrase';
    }
    if(!dek)throw appError||new Error('NPVS: a matching private key is required');
    if(dek.length!==32)npvsFail('invalid Gen-1 decrypted key length');
    const text=npvsUtf8Decode(npvsOpen(dek,env.nonce,env.sealed,env.headerBytes));
    let obj;
    try{obj=JSON.parse(text);}catch(_){obj=text;}
    return {status:'unlocked',version,unlock:unlockMethod,obj};
  }
  if(version!==5)npvsFail('unsupported NPVS version '+version);
  const env=npvsGen2(data,passphrase);
  if(env.method===0)return {status:'locked',version,unlock:'recipient-private-key'};
  let kdk;
  if(env.method===2){
    kdk=await npvsGen2AppKeyKdk(env);
    if(!kdk)return {status:'locked',version,unlock:'app-key',
      reason:'Matching authorized Gen-2 key material is not loaded'};
  }else{
    if(!passphrase)return {status:'locked',version,unlock:'creator-passphrase'};
    kdk=await npvsPbkdf2(passphrase,env.salt,env.iterations);
  }
  const dek=npvsOpen(kdk,env.wrap.subarray(0,12),env.wrap.subarray(12),env.salt);
  if(dek.length!==32)npvsFail('invalid Gen-2 decrypted key length');
  const metaKey=await npvsHKDF(dek,env.nonce,npvsUtf8.encode('NPVS-v5/metadata'));
  const metadata=npvsOpen(metaKey,env.nonce,env.meta,env.prefix);
  try{JSON.parse(npvsUtf8Decode(metadata));}catch(_){npvsFail('authenticated metadata is not valid JSON');}
  const fields=new Map();
  for(const row of env.rows){
    const key=await npvsHKDF(dek,env.contentID,npvsJoin(npvsUtf8.encode('NPV-fields-v1/field/'),npvsBE16(row.seq)));
    const aad=npvsJoin(npvsUtf8.encode('NPV-fields-v1/record/'),env.contentID,npvsBE16(row.seq),npvsBE32(row.sealed.length-16));
    fields.set(row.seq,npvsOpen(key,new Uint8Array(12),row.sealed,aad));
  }
  if(!fields.has(65535))npvsFail('authenticated config sentinel table missing');
  let doc;
  try{doc=JSON.parse(npvsUtf8Decode(fields.get(65535)));}catch(_){npvsFail('invalid authenticated config sentinel table');}
  if(!doc||!Array.isArray(doc.configs)||!doc.configs.length)npvsFail('empty authenticated config table');
  return {status:'unlocked',version,unlock:env.method===2?'app-key':'creator-passphrase',obj:{configs:doc.configs.map(cfg=>npvsSubstitute(cfg,fields))}};
}