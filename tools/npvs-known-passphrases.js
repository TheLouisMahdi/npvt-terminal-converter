/* Session-only verification of explicitly supplied NPVS creator passphrases.
 * No dictionary generation, mutation, online requests, persistence or secret logging.
 * Inlined into the desktop and standalone mobile HTML files.
 */
const NPVS_KNOWN_MAX=128;
function npvsParseKnownPassphrases(input){
  if(typeof input!=='string'||input.length>16384)
    throw new Error('Passphrase list exceeds the 16 KB limit');
  const unique=new Set();
  for(const entry of input.replace(/\r\n/g,'\n').split('\n')){
    const item=entry.endsWith('\r')?entry.slice(0,-1):entry;
    if(!item)continue;
    if(item.length>256||/[\u0000-\u001f\u007f]/.test(item))
      throw new Error('Each passphrase must be a single line, at most 256 characters');
    unique.add(item);
    if(unique.size>NPVS_KNOWN_MAX)throw new Error('At most 128 supplied passphrases per session');
  }
  if(!unique.size)throw new Error('Provide at least one nonempty passphrase');
  return [...unique];
}
function npvsKnownCandidates(manual,supplied){
  const unique=new Set();
  if(manual)unique.add(manual);
  for(const entry of supplied)unique.add(entry);
  return [...unique];
}
async function npvsMatchKnownPassphrases(input,candidates,onProgress=()=>{},isCurrent=()=>true){
  if(!(input instanceof Uint8Array))input=new Uint8Array(input);
  if(input.length>NPVS_PHASE2_MAX||input.length<9)
    throw new Error('Invalid NPVS candidate file size');
  let salt,wrap,iterations;
  if(input[4]===5){
    const env=npvsGen2(input,'');
    if(env.method!==1)return {applicable:false,checked:0};
    ({salt,wrap,iterations}=env);
  }else if(input[4]<=1){
    const env=npvsGen1(input,'');
    if(!env.locked)return {applicable:false,checked:0};
    if(env.locked.kdf!=='pbkdf2-hmac-sha256')
      throw new Error('Unsupported Gen-1 passphrase KDF');
    salt=npvsB64(env.locked.salt);
    const wrapped=npvsB64(env.locked.wrap);
    if(salt.length!==16||wrapped.length!==60)throw new Error('Invalid Gen-1 passphrase block');
    wrap=wrapped;
    iterations=env.locked.iters;
  }else{
    return {applicable:false,checked:0};
  }
  if(!Array.isArray(candidates)||candidates.length>NPVS_KNOWN_MAX+1)
    throw new Error('Too many supplied passphrases');
  for(let i=0;i<candidates.length;i++){
    if(!isCurrent())return {cancelled:true,checked:i};
    const pass=candidates[i];
    if(typeof pass!=='string'||!pass||pass.length>256)
      throw new Error('Invalid supplied passphrase');
    onProgress(i+1,candidates.length);
    let key,plaintext;
    try{
      key=await npvsPbkdf2(pass,salt,iterations);
      // Verify only the wrapped-DEK authenticated tag until one key matches.
      // This avoids reconstructing profiles for failed supplied passphrases.
      plaintext=npvsOpen(key,wrap.subarray(0,12),wrap.subarray(12),salt);
      if(plaintext.length!==32)throw new Error('Invalid decrypted key length');
      if(!isCurrent())return {cancelled:true,checked:i+1};
      return {passphrase:pass,index:i,checked:i+1,applicable:true};
    }catch(error){
      if(!/authentication failed/.test(String(error.message||error)))
        throw error; // Malformed files and unsupported schemes are NOT bad-password results.
    }finally{
      if(key)key.fill(0);
      if(plaintext)plaintext.fill(0);
    }
  }
  return {passphrase:null,checked:candidates.length,applicable:true};
}
