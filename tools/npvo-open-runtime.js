/* Strict NPVO1 (unencrypted) import. This file is inlined into both HTML entrypoints. */
function npvoDecodeMarker(value){
  if(typeof value!=='string'||!value.startsWith('npvs1:'))return value;
  const token=value.slice(6);
  if(!token||token.length>131072||token.length%4===1||
     !/^[A-Za-z0-9+/_-]+={0,2}$/.test(token))
    throw new Error('Invalid NPVO1 encoded field');
  let bytes;
  try{bytes=b64ToBytes(token);}catch(_){throw new Error('Invalid NPVO1 Base64 encoding');}
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
  catch(_){throw new Error('Invalid NPVO1 UTF-8 field');}
}
function npvoDecodeTree(value,depth=0){
  if(depth>32)throw new Error('NPVO1 nesting limit exceeded');
  if(typeof value==='string')return npvoDecodeMarker(value);
  if(Array.isArray(value))return value.map(v=>npvoDecodeTree(v,depth+1));
  if(value&&typeof value==='object'){
    const output=Object.create(null);
    for(const [key,val] of Object.entries(value)){
      if(key==='__proto__'||key==='constructor'||key==='prototype')
        throw new Error('Unsafe NPVO1 object key');
      output[key]=npvoDecodeTree(val,depth+1);
    }
    return output;
  }
  return value;
}
const NPVO_PROFILE_FIELDS=new Set([
  'configType','configVersion','subscriptionId','addedTime','remarks',
  'server','serverPort','password','method','alterId','aid',
  'network','headerType','host','path','security','sni','alpn',
  'fingerPrint','fingerprint','insecure','tlsAllowInsecure','allowInsecure',
  'flow','publicKey','shortId','spiderX','mode','serviceName','authority',
  'xhttpMode','xhttpExtra','pinnedPeerCertSha256','verifyPeerCertByName'
]);
function npvoCheckLinkProfile(profile){
  if(!profile||typeof profile!=='object'||Array.isArray(profile))
    throw new Error('Expected an NPV profile object');
  const type=Number(profile.configType);
  if(![1,3,5,6].includes(type))throw new Error('Unsupported NPV configType');
  for(const [key,value] of Object.entries(profile)){
    if(!NPVO_PROFILE_FIELDS.has(key)&&value!==undefined&&value!==null&&value!=='')
      throw new Error('No verified mapping for profile field '+key);
  }
  const port=Number(profile.serverPort);
  if(!Number.isInteger(port)||port<1||port>65535||!String(profile.server||'').trim())
    throw new Error('Invalid server or port');
  if(!String(profile.password||'').trim())throw new Error('Missing protocol credentials');
  if(profile.tlsAllowInsecure!==undefined&&profile.insecure!==undefined &&
    truthyParam(profile.tlsAllowInsecure)!==truthyParam(profile.insecure))
    throw new Error('Conflicting TLS certificate validation settings');
  const network=normalizeNetworkId(firstValue(profile.network,'tcp'));
  if(!['tcp','ws','grpc','http','httpupgrade','splithttp','xhttp'].includes(network))
    throw new Error('Unsupported NPV transport');
  const mode=String(profile.mode||'');
  const xhttpMode=String(profile.xhttpMode||'');
  if((mode||xhttpMode)&&network!=='xhttp'){
    // NPV's older gRPC profiles store an explicit "gun" mode in both fields.
    if(network!=='grpc'||(mode&&mode!=='gun')||(xhttpMode&&xhttpMode!=='gun'))
      throw new Error('Unrepresentable NPV transport mode');
  }
  if(network==='xhttp'&&mode&&xhttpMode&&mode!==xhttpMode)
    throw new Error('Conflicting XHTTP mode settings');
  if(profile.publicKey&&String(profile.security)!=='reality')
    throw new Error('REALITY public key without REALITY security');
  if(type===3 && network!=='tcp')throw new Error('Shadowsocks transport cannot be exported as a standard SS URI');
  // Some historical exports use UUID-shaped identifiers with non-RFC version bits.
  // Preserve them verbatim; do not rewrite or silently discard those credentials.
  const uuidShape=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  if((type===1||type===5)&&!uuidShape.test(String(profile.password)))
    throw new Error('VMess/VLESS credentials do not have UUID-compatible syntax');
}
function npvoRecognizeOpen(raw,name){
  let original;
  try{original=JSON.parse(raw.replace(/^NPVO1\s*/,'').trim());}
  catch(_){throw new Error('Invalid open NPVO1 configuration JSON');}
  if(!original||!Array.isArray(original.configs)||!original.configs.length||
     original.configs.length>2000)
    throw new Error('NPVO1 contains no configs or exceeds the 2000-profile limit');
  const obj=npvoDecodeTree(original);
  const links=[],failures=[];
  for(let index=0;index<obj.configs.length;index++){
    const config=obj.configs[index];
    try{
      if(!config||!config.v2rayProfile)throw new Error('Missing v2rayProfile');
      npvoCheckLinkProfile(config.v2rayProfile);
      const result=convertJSONToLinks(config,name);
      if(result.errors.length||result.links.length!==1)
        throw new Error(result.errors[0]||'Profile did not produce one verified link');
      links.push(result.links[0].link);
    }catch(error){
      failures.push('Profile '+(index+1)+': '+String(error.message||error));
    }
  }
  // No partial subscription is advertised as complete: keep all profiles in decoded JSON.
  const complete=failures.length===0 && links.length===obj.configs.length;
  return {kind:'npvo',label:'NPVO1 open NPV export · '+
    (complete?links.length+' verified links':links.length+'/'+obj.configs.length+' mapped; links withheld'),
    name,text:raw,obj,links:complete?links:[],notes:failures};
}
