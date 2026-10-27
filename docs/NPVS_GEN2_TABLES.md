# NPVS Gen-2 A16 Table Adapter (Phase 4)

Date: 2026-10-28
Status: Feature branch / pending real-export acceptance. The CI compatibility suite checks public A16 vectors using ephemeral reference data. No lookup-table bytes are bundled in distributable files.

## User outcome

The converter automatically recognizes `.npvs` Gen-2 v5 AppKey envelopes. When a compatible generation-2 lookup table has been **legitimately supplied by the user**, the converter derives the per-file A16 from the 16-byte salt, derives KDK from A16 and the 16-byte config ID, authenticates the wrapped DEK, decrypts the metadata and each NPF field, and offers only the output links/JSON supported by its existing conversion validation. **No per-file password or per-file A16/KDK entry is needed for that session.**

Without a compatible table or individual authorized key material, the encrypted payload remains locked. This is not universal decryption of arbitrary files and does not defeat creator-passphrase or recipient-private-key encryption.

## Exact processing architecture

```text
NPVS upload
  -> binary/version/header validation
  -> detect unlock method 0 recipient / 1 creator-passphrase / 2 app-key
  -> for app-key:
       session keyring matching configId + salt (existing Phase 3), OR
       locally loaded compatible generation-2 lookup tables (new Phase 4)
  -> A16 = gen2_table_transform(salt)  [no built-in secret tables]
  -> KDK = SHA256("npvtunnel/appkey/v2 " || A16 || configId)
  -> DEK = ChaCha20-Poly1305.open(KDK, wrapNonce, wrappedDEK, AAD=salt)
  -> metadata = authenticated HKDF-derived ChaCha20-Poly1305
  -> fields = authenticated HKDF-derived ChaCha20-Poly1305
  -> sentinel reconstruction -> loss-aware profile conversion
  -> VLESS / VMess / Trojan / SS link only if representable; otherwise JSON
```

The A16 evaluator performs 13 table-based rounds on a 16-byte state, with a 16-entry state permutation, two 4-byte transforms per group, and a 4096-byte terminal lookup page. The independent JavaScript implementation uses an explicitly indexed 6-table nibble network for each output byte rather than embedding the upstream compiled implementation.

## Local table file contract

- Uncompressed binary table size: **749568 bytes**, exactly.
- Compatible compressed source: zlib-deflate, imported locally through browser `DecompressionStream('deflate')` with a strict expansion cap.
- No external JS, WASM, HTTP fetch, backend or storage is needed at runtime.
- The importer refuses malformed, wrong-generation, truncated, oversized and incompatible table blobs.
- A compatibility gate derives A16 for **six publicly documented salts**, compares all six outputs with expected 16-byte reference values, and activates tables only if all match. The optional compatibility test also checks a seventh published vector.
- Once imported, the entire table resides in RAM only. **Clear** invalidates pending imports and zeros the in-memory keyring and table arrays best-effort before releasing references. JavaScript engines may retain temporary copies until garbage collection.
- User-facing paths never print secrets, salt-derived A16, KDK or DEK.
- If a supplied table fails verification, no value is installed and the file stays in inspection mode.

## Offline use

1. Open `Index.html` or `mobile.html` locally.
2. Import a Gen-2 `.npvs` AppKey file. If compatible keys are missing the file remains locked.
3. Click **Load authorized Gen-2 lookup tables**, and select a table binary or zlib-compressed table for which you have distribution/use rights. Do not upload private tables to any website.
4. The last file selection is reprocessed automatically; no passphrase is requested for matching AppKey imports.
5. Copy/download compatible outputs. For creator-passphrase/recipient-locked files this facility does not replace the required authorization.

These optional generation-specific lookup tables are **not distributed** with this MIT project. A binary shipped by a third party can carry its own copyright and license obligations. Do not add third-party lookup data to the repository or any release assets without documented permission.

## Test and validation plan

The following run as part of the repository's ordinary suite:

```sh
node --test tests/npvs-gen2-tables.test.cjs
node --test tests/npvs-browser-runtime.test.cjs
node --test tests/*.test.cjs
node tools/build_mobile.cjs --check
node tests/browser-smoke.cjs
```

A dedicated `npvs-gen2-compat.yml` workflow additionally downloads a public reference table into an **ephemeral CI workspace**, inflates it, verifies published A16 vectors, then deletes it. It never commits, publishes or includes the table in downloadable application builds. Refer to the upstream license (currently AGPL-3.0) before making any third-party assets available to users.

### Verified integration test results (October 28, 2026)

GitHub Actions **passed**:

- Published A16/KDK compatibility vectors using an ephemeral external table asset, with no bundled third-party bytes.
- Authentic NPVS Gen-2 AppKey reference envelope from a public upstream test fixture: file is initially **locked**, then unlocks and reconstructs configuration fields after the compatible table is installed.
- 108 native protocol and regression tests, including a new fix for a pre-existing NPVT1 bug that incorrectly stripped valid leading `+` and `/` Base64 characters.
- Desktop, responsive mobile and standalone mobile browser smoke tests; generated-mobile consistency; Xray, sing-box and Mihomo validations.
- The real-format NPF body includes a **32-byte post-record trailer**. The importer now accepts *only* 0-byte or 32-byte post-record lengths, rejecting any others. This trailer's independent checksum/signature semantics have **not** been established, and it is not represented as verified. AEAD tags on the wrapped key, metadata and each field remain mandatory.

These checks prove interoperability with **one public, real-format AppKey fixture**. They do not prove that every current NPV Tunnel build, future generation or unsupported protocol variant works.

### Required acceptance gates before production merge

- Green unit, browser-smoke and table-compatibility CI checks.
- Real-world NPV Tunnel v5 AppKey export test generated with **dummy, authorized credentials**. Verify the resulting VLESS/VMess/Trojan/SS link by importing it into a compatible Core and verifying network/security settings, not by checking that it merely starts with a scheme.
- Explicitly reject unknown/unsupported profile fields and source policies rather than silently claiming lossless URI conversion.
- Decide on a trust model and implement independent 64-byte outer-creator signature verification. Current code authenticates the encrypted content but does **not** verify the creator identity/signature.
- Security review of the pure-JavaScript ChaCha20/Poly1305 implementation, tamper handling, browser memory behavior, and denial-of-service limits.

## Security limits

1. AppKey derivation differs fundamentally from creator passphrases and recipient private keys. No password guessing, cracking or unknown private-key bypass is attempted.
2. A correct table permits opening app-key exports of its **compatible generation**, so treat it as high-sensitivity key material and do not distribute it casually.
3. The 64-byte outer signature is not verified; successful decryption authenticates data to a key, not necessarily the claimed publisher's identity.
4. Successful extraction of proxy credentials does not guarantee a server is online or that a particular client supports every advanced option.
5. The universal all-variant objective remains limited by missing authorized key material, evolving format generations, runtime interoperability, third-party redistribution rights, and unimplemented signer verification.

## References

- [NPVS Phase 1](NPVS_PHASE1.md)
- [NPVS Phase 2](NPVS_PHASE2.md)
- [Phase 3: authorized AppKey](NPVS_GEN2_APPKEY.md)
- [Public reference vector tests](https://github.com/FrontierTM/Pantegnos/blob/main/internal/modules/impl/npvs_gen2_test.go) (source license: AGPL-3.0)
- [RFC 8439](https://www.rfc-editor.org/rfc/rfc8439)
