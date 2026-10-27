# NPVS Phase 1: Format Research, Safe Inspection, and Acceptance Gates

**Date:** 2026-10-27  
**Repository:** `TheLouisMahdi/npvt-terminal-converter`  
**Status:** Phase 1 implemented as a standalone, read-only diagnostic. **Not a decryptor.**

## Product goal

A user drops a `.npvt` or `.npvs` file (or a file with the wrong extension). The program identifies its actual **content** and version, determines which conversion routes can be trusted, and eventually emits **valid** VLESS, VMess, Trojan, Shadowsocks or compatible native JSON, without requiring the NPV Tunnel application. It must never fabricate proxy links or claim that a locked container was decrypted.

## What was implemented

- `tools/npvs-inspect.cjs`: dependency-free Node.js diagnostic for NPVT1, NPVTSUB1, NPVO1, NPVS Gen-1 (`v0/v1`) and NPVS Gen-2 (`v5`). Recognizes Base64-wrapped NPVS binary.
- Gen-1: bounds-checks a JSON header and encrypted body, reports only unlock classes and size.
- Gen-2: validates the binary envelope, unlock-method discriminator, header lengths, recipient count, sealed metadata bounds, `NPF\x01` record table bounds, and outer signature length.
- Reports **only nonsecret structural metadata**. No salt, wrap, key material, decrypted config, creator message, or payload is printed.
- `tests/npvs-inspect.test.cjs`: synthetic, noncredential fixtures for marker detection, all three v5 unlock classes, Base64, malformed lengths, privacy, and size limits.
- Existing desktop/mobile conversion UIs and legacy decryption logic are **unchanged** in Phase 1. This diagnostic is a separate verification tool, not yet integrated into the browser pipeline.

## Run locally

```bash
node tools/npvs-inspect.cjs example.npvs old.npvt
node --test tests/npvs-inspect.test.cjs
```

One JSON result is printed per input. Encrypted Gen-1/Gen-2 reports `conversionReady: false`; format inspection never constitutes decryption or successful conversion. The tool reads no more than 1 MiB per file. Unsupported and corrupt inputs return explicit states/errors.

## Verified structural findings from published implementations

| Family | Recognition | Structural content | Unlock dependency | Current project status |
| --- | --- | --- | --- | --- |
| NPVT1 / NPVTSUB1 | Text marker | Legacy encoded config container | Existing legacy pipeline | Already supported by current converter |
| NPVO1 | Text marker | Open JSON-style export | None when valid | Existing pipeline; Phase 1 checks marker only |
| NPVS Gen-1 | `NPVS`, version byte `0` or `1`; 4-byte big-endian header length | JSON header; 12-byte nonce; 4-byte big-endian sealed-body length; encrypted body; 64-byte signature | App-key wrap, creator passphrase, or recipient key depending on header | Structural inspection only |
| NPVS Gen-2 | `NPVS`, version byte `5`; 4-byte big-endian header length | Compact binary header and sealed metadata; 12-byte nonce; length-prefixed `NPF\x01` record body; 64-byte signature | Method `0` recipient key, `1` creator passphrase, `2` app-key | Structural inspection only |
| Other NPVS versions | `NPVS` with different version byte | Unknown | Unknown | Explicitly unsupported |

### Gen-2 v5 header details (offsets relative to the header after the first 9 bytes)

- Byte `0`: compact header version (published implementation expects `1`).
- Bytes `1..16`: config ID (do not log); bytes `17..49`: creator key data (do not log).
- Byte `50`: unlock method (`0`: recipient, `1`: passphrase, `2`: app key).
- Bytes `51..52`: recipient count, big-endian; recipient entries use 125 bytes per entry in the published implementation.
- From offset `53 + 125 * recipient_count`: method-specific wrap (`80` bytes for passphrase, `78` for app key, no further method block for recipient).
- Next `4` bytes: sealed metadata length, followed by its ciphertext.
- After the header: 12-byte nonce, 4-byte big-endian body length, an `NPF\x01` record collection with a content ID and per-field ciphertexts, and a 64-byte signature.
- Gen-2 passphrase method uses PBKDF2-HMAC-SHA256; the published code opens authenticated content using ChaCha20-Poly1305 and derives further field keys using HKDF-SHA256. Merely parsing fields or a signature-sized trailer **does not** authenticate the file.

### Critical cryptographic distinction

1. **App-key mode:** can potentially support unattended import only when the correct key derivation is legitimately available and validated. Do not assume every app-key file works with one universal constant.
2. **Creator-passphrase mode:** an unknown high-entropy passphrase cannot generally be bypassed by code. The product should request an authorized passphrase when needed or report `locked`.
3. **Recipient-key mode:** requires the matching recipient private key (not merely the public key in the header).
4. A successful key unwrap is not enough: require the authenticated content and field tags to verify before emitting any link.
5. A VLESS/VMess share URI may not express every source option. Preserve rich configuration in the appropriate native JSON rather than dropping settings silently.

## Reference and licensing notes

- [Pantegnos](https://github.com/FrontierTM/Pantegnos) claims Gen-1 and Gen-2 support and offers a local browser-based engine. The project currently advertises **AGPL-3.0**; do not copy its implementation/assets into this repository without a license compatibility assessment.
- [NPVT-NPVS-Decrypter](https://github.com/aminbaghaeidev/NPVT-NPVS-Decrypter) documents NPVS Open, Gen-1, Gen-2, and explicit passphrase handling. Its documentation is not evidence that all real-world samples decrypt without a password.
- [Existing converter compatibility matrix](SMART_FORMAT_MATRIX.md) already distinguishes open/legacy inputs from cryptographically locked NPVS. Phase 1 follows the same policy.

The diagnostic implementation in this branch was written independently. It does not incorporate code, lookup tables, or key material from third-party projects.

## Acceptance results and limits

- [x] NPVT1 / NPVTSUB1 / NPVO1 recognition from content.
- [x] Gen-1 `v0/v1` and Gen-2 `v5` classification with structural checks.
- [x] Distinguish passphrase, app-key, and recipient-key wrappers.
- [x] Fail safely on malformed, oversize, unknown-version input.
- [x] Unit tests pass using synthetic files, with no real credentials.
- [ ] Real-world compatibility across multiple NPV Tunnel versions **not tested**.
- [ ] Independent cryptographic decryption, authenticated output and automated V2Ray conversion **not implemented**.
- [ ] Integration with `Index.html` and generated `mobile.html` **not implemented**.
- [ ] Signature verification and post-decryption schema fidelity tests **not implemented**.

## Next-phase engineering gates

1. Obtain authorized, nonproduction sample exports for **each** variant (Open, Gen-1 app-key/passphrase, Gen-2 app-key/passphrase, recipient), including corrupted samples. Never commit configs, passwords, IDs, wrap/salt values or decrypted credentials.
2. Establish positive and negative known-answer tests for authorized keys and passwords; verify failures for wrong passwords, altered authenticated data, invalid signatures, truncated records and unknown versions.
3. Implement and test an isolated browser-compatible decoder **without network calls**; return a structured profile or an explicit `locked/unsupported/invalid` result, never a guessed link.
4. Connect successful, authenticated profiles to the **existing** normalizer and conversion compatibility matrix. Verify each produced link against a target client; prefer native JSON for unmappable fields.
5. Synchronize desktop and mobile via existing `node tools/build_mobile.cjs` and run the existing regression suite plus browser smoke tests before release.

**No-password workflow success criterion:** Fully automatic only for open/legacy or genuinely available-key variants. Unknown creator passphrases and private recipient keys remain explicit blockers, not targets for fabricated bypasses.