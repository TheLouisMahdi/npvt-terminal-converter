# NPVS Gen-2 Outer Creator Signature: Verification Status

Date: 2026-10-28
Status: **UNVERIFIED** — do not claim creator identity, file signer or trusted publisher.

## What has been established

A publicly published, test-only NPVS Gen-2 AppKey fixture contains:
- A 33-byte compressed creator public key beginning with `0x02` or `0x03`, structurally consistent with a secp256k1 public key.
- A trailing 64-byte signature-like block.
- Successful authenticated key unwrap, metadata decrypt and per-field ChaCha20-Poly1305 authentication.

Those facts do **not** identify the signature algorithm, canonical signed message, message digest, or sender trust anchor.

## Diagnostic performed

A dedicated **non-enforcing** test (`tests/npvs-signature-diagnostic.cjs`) used Node's native secp256k1 ECDSA public-key verifier with 64-byte IEEE P1363 `r || s` input and multiple possible envelope/payload message regions. Several common message hashes were also tested.

**Outcome:** No tested standard signature/message-scope combination verified. This does *not* establish a corrupt file; it indicates the canonical signed message and/or cryptographic scheme is still unknown.

The diagnostic uses only a published upstream fixture downloaded to a temporary CI directory. No user's credentials or test file is added to GitHub.

## Required before enabling creator-signature status

1. Obtain a verified format document or legitimate known signer/signed-message test vector.
2. Identify signature scheme, exact byte-level canonical message and public-key encoding.
3. Implement deterministic signature verification and require a failing result for altered signed content.
4. Distinguish **mathematically valid self-signature** from a **trusted publisher**. The latter requires a separately authenticated public-key fingerprint/trust store, not a public key merely embedded in the same untrusted file.
5. Validate with authentic creator signatures, negative tests, and dedicated security review.

Until then, **outer signature cannot be verified**. The browser UI explicitly says `AEAD verified (creator signature not verified)` on decrypted content and inspection explicitly marks `creatorSignature: unverified`. This avoids the earlier misleading generic `authenticated` label.

## Separate from the supplied test sample

The user's uploaded file is an **open NPVO1 JSON export**, even though it ends in `.npvs`. It contains no Gen-2 outer creator signature. Its 68 valid share-link mappings do not prove Gen-2 signature support or universal NPVS decryption.

## Security note

No unknown creator passphrase, unavailable recipient secret or incompatible AppKey may be bypassed merely by recognizing a file format. Never treat a successful parse, URI generation or payload AEAD tag as proof of publisher identity.
