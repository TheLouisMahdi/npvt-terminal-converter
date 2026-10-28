'use strict';
/*
 * Exploratory signature-format check ONLY. No claim about creator identity.
 * Runs against an ephemeral publicly published fixture in CI, not user configs.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=process.env.NPVS_COMPAT_FIXTURE_FILE;
if(!path)process.exit(0);
const b=fs.readFileSync(path);
if(b.length<300||b.toString('ascii',0,4)!=='NPVS'||b[4]!==5)throw Error('bad fixture');
const headerLen=b.readUInt32BE(5),bodyOffset=9+headerLen;
const compressed=b.subarray(9+17,9+50);
const signature=b.subarray(b.length-64);
if(![2,3].includes(compressed[0]))throw Error('unsupported creator key encoding');
const uncompressed=crypto.ECDH.convertKey(compressed,'secp256k1',undefined,undefined,'uncompressed');
const b64url=x=>Buffer.from(x).toString('base64url');
const pub=crypto.createPublicKey({key:{kty:'EC',crv:'secp256k1',x:b64url(uncompressed.subarray(1,33)),y:b64url(uncompressed.subarray(33))},format:'jwk'});
const body=b.subarray(bodyOffset+16,b.length-64);
const unsigned=b.subarray(0,b.length-64);
const candidates={
  full_unsigned:unsigned,
  unsigned_without_magic:b.subarray(9,b.length-64),
  prefixed_header:b.subarray(0,bodyOffset),
  header_only:b.subarray(9,bodyOffset),
  nonce_and_body:b.subarray(bodyOffset,b.length-64),
  body_only:body,
  body_without_content_trailer:body.subarray(0,body.length-32),
  config_id:b.subarray(10,26),
  content_id:body.subarray(4,36),
  header_and_ciphertext:Buffer.concat([b.subarray(0,bodyOffset),body]),
  hash_full:crypto.createHash('sha256').update(unsigned).digest(),
  hash_body:crypto.createHash('sha256').update(body).digest()
};
const hits=[];
for(const [name,msg] of Object.entries(candidates)){
  for(const algorithm of ['sha256','sha512','sha384','sha1']){
    try{if(crypto.verify(algorithm,msg,{key:pub,dsaEncoding:'ieee-p1363'},signature))
      hits.push({name,algorithm});}catch(_){}
  }
}
console.log('NPVS creator outer signature diagnostic:',hits.length?JSON.stringify(hits):
  'No standard ECDSA/P1363 verification matched the tested message scopes. Keep signer status unverified.');
