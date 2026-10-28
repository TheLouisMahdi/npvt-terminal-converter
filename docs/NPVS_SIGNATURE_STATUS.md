# NPVS Creator Signature: Current Trust Boundary

**Status:** Outer creator signature **not independently verified**. Updated October 2026.

## What can be trusted

The NPVS Gen-1/Gen-2 decoders verify the applicable authenticated encryption (AEAD) tags when a valid passphrase or authorized AppKey material is provided. For Gen-2, the wrapped DEK, sealed metadata and NPF record fields must pass their respective checks. This prevents the converter from accepting corrupted ciphertext or an incorrect passphrase as decrypted plaintext.

**But AEAD authentication does not identify the publisher.** In Gen-2 reference data, the header includes a 33-byte compressed creator-public-key-like field, and the envelope ends with a 64-byte signature-like field. The exact signed message, signer scheme, hashing rule and external trust anchor have **not** been established.

Accordingly, the application deliberately labels unlocked files:

> AEAD verified (creator signature not verified)

and marks structural inspections with `creatorSignature: unverified`. It does **not** display “trusted creator” or “verified publisher.”

## Remaining work before claiming signature verification

1. Obtain an authoritative signing specification or a test vector with a known signing key, message and verified signature.
2. Establish the exact canonical byte representation, signature algorithm and digest, if any.
3. Implement a positive verifier and tamper-negative tests for the actual format.
4. Establish a separate **trust policy**: validating a signature using a public key embedded in an untrusted file is not sufficient to establish a trusted identity.
5. Independently review cryptographic code and verify negative cases against actual authorized exports.

A **diagnostic, non-enforcing** tool exists at `tests/npvs-signature-diagnostic.cjs`. It tries plausible ECDSA/secp256k1 message regions on an upstream public fixture and found no supported match. That does not prove a bad file; it only means the chosen signing interpretation has not been confirmed. This diagnostic runs on ephemeral public CI input and is **not** a successful signature validation test.

## Do not conflate unrelated validation

- A decoded **NPVO1** open JSON export has no encrypted Gen-2 creator-signature verification requirement. Detect file contents, not `.npvs` extensions.
- A successful Gen-2 **AppKey** table-vector test proves compatibility with reference key derivation/authentication, **not** identity verification.
- Valid **share links** prove representable profile syntax, **not** reachable servers or a genuine configuration publisher.
- Unknown creator passphrases and missing recipient private keys remain inaccessible.

See [NPVS formats and authenticated import](NPVS.md) for supported methods and [Gen-2 lookup tables](NPVS_GEN2_TABLES.md) for external asset constraints.
