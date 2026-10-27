# NPVS Phase 2 - Authenticated Offline Import

Date: 2026-10-27
Status: Implemented on feature branch; integration should be reviewed before merging. Validation uses synthetic samples, not official real exports.

## Product behavior

The unified desktop/mobile converter accepts `.npvt`, `.npvs`, or a mislabeled file and determines the format from its actual bytes. NPVS Gen-1 (v0/v1) and Gen-2 (v5) files are parsed locally. When valid key material is available, authenticated payloads are converted using the existing JSON-to-links engine. When unlocking is not possible, the UI shows only safe inspection metadata. Unknown encrypted payloads are never guessed or represented as successful conversion.

## Implemented

- Inlined, dependency-free browser runtime (`tools/npvs-browser-runtime.js` is the readable maintenance source), synchronized into both `Index.html` and generated `mobile.html`.
- RFC 8439 ChaCha20-Poly1305 with tag verification prior to returning plaintext; browser WebCrypto PBKDF2-HMAC-SHA256 and HKDF-SHA256.
- Gen-1 creator passphrase unlock, when provided by the user and authenticated.
- Gen-1 app-key generation 1: attempts an unattended unlock using the converter's **existing** legacy white-box CTR routine (no newly imported third-party key tables). If incompatible with the source file's key generation, AEAD authentication fails; there is no false success.
- Gen-2 v5 creator passphrase unlock, including authenticated metadata, authenticated per-field NPF records, and recursive sentinel reconstruction.
- Locked states for Gen-2 app-key (additional generation-specific white-box tables not bundled) and recipient-private-key (no matching private key available).
- Optional password input for authorized exports, retained only in the UI state; no localStorage, logging, or transmission. Re-entering a password reprocesses the last selection; clearing the workspace clears the password and file list.
- Only successfully decoded profiles may become share links. Native JSON remains available when source settings cannot be mapped losslessly.
- Tests validate authenticated success, wrong passphrases, bad tags, missing key methods and known-good ChaCha20-Poly1305 interoperability with Node crypto.

## Support matrix

| Container | Auto-import without user password | Optional authorized passphrase | Status |
| --- | --- | --- | --- |
| NPVT1 / NPVO1 | Existing converter | Not needed | Existing behavior unchanged |
| NPVS v0/v1 (appKey generation 1) | Attempt with existing compatible legacy key material | N/A | AEAD must validate; real sample pending |
| NPVS v0/v1 (creator passphrase) | No | Yes | Implemented, synthetic-tested |
| NPVS v5 (creator passphrase) | No | Yes | Implemented, synthetic-tested |
| NPVS v5 (app key) | Not yet | N/A | Inspection only; special generation-2 tables unavailable |
| NPVS (recipient ECDH) | No | Not sufficient | Requires matching private key and dedicated adapter |
| Unsupported NPVS version | No | No | Explicit rejection |

## Security and caveats

1. Authenticated encryption (AEAD) is checked for Gen-1 body, Gen-2 metadata and **every** Gen-2 record. Wrong passwords or modified authenticated ciphertexts are rejected. Do not report `decrypted` merely because an envelope looks plausible.
2. This phase **does not verify the container's 64-byte outer creator signature**. A successfully decrypted file is authenticated to the unlocked content key, but the signer identity and signature have not been verified. Do not claim creator authenticity.
3. The pure-JavaScript ChaCha20-Poly1305 implementation uses BigInt for Poly1305. It was tested against Node OpenSSL but has not undergone a formal security audit; avoid using it for unrelated production cryptography.
4. The PBKDF2 work factor is capped at 2,000,000 to protect browser responsiveness. Unsupported or extremely expensive parameters fail explicitly.
5. No dictionary guessing, cracking, private-key extraction, or bypass of unknown creator passwords. A passphrase-protected file is not converted without the correct passphrase. Do not advertise universal password-free NPVS support.
6. The app-key generation 1 pathway only uses legacy key material already present in the original converter. Different key generations may be incompatible; genuine exports must be tested before claiming compatibility.
7. The Gen-2 metadata and field records follow published implementations, but official format specifications, sample provenance and real-world interoperability are unverified.
8. Sentinel replacement preserves unsupported payload fields in source JSON; link mapping is delegated to the existing converter and must reject incomplete mappings instead of silently dropping options.
9. No third-party lookup assets or AGPL source code were copied; the implementation was written independently using published format descriptions and standard cryptographic constructions.

## Test commands

```sh
node --test tests/npvs-browser-runtime.test.cjs
node --test tests/npvs-inspect.test.cjs
node tools/build_mobile.cjs --check
node --test tests/*.test.cjs
```

The new crypto tests use only synthetic credentials/domains, and do not include real imported secrets. Browser UI smoke tests require Playwright/Chromium and should be run before deployment.

## Next engineering gates

- Run end-to-end import against deliberately generated, authorized NPVS exports from **each** generation and unlocking method. Collect only anonymized fixtures with fake credentials and the owner's consent.
- Verify creator signatures with an agreed canonical signed message format and supplied trust model; add signature-failure tests.
- Audit field substitution and VLESS/VMess/Trojan/SS URI fidelity against Xray/sing-box and NPV Tunnel samples, including XHTTP/REALITY/WS/gRPC and invalid options.
- Evaluate legally distributable Gen-2 app-key support with the right key tables and an explicit upstream license review. Recipient-key mode requires explicit private-key import, if desired.
- Add browser interaction regression tests for passphrase retry, locked preview, offline single-file mobile import, multiple files and no plaintext logging.

## Reviewed references

- [Existing phase-1 analysis](NPVS_PHASE1.md)
- [Existing converter format matrix](SMART_FORMAT_MATRIX.md)
- [Pantegnos format adapters](https://github.com/FrontierTM/Pantegnos/tree/main/internal/modules/impl) (AGPL-3.0: reference only, not copied)
- [NPVT-NPVS-Decrypter](https://github.com/aminbaghaeidev/NPVT-NPVS-Decrypter) (reference only, not copied)
- [RFC 8439: ChaCha20 and Poly1305 for IETF protocols](https://www.rfc-editor.org/rfc/rfc8439)