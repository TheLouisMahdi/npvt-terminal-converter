# NPVS Gen-2 AppKey: Authorized Offline Import (Phase 3)

Date: 2026-10-28
Status: Code complete for supplied, matching key material; **not** a universal automatic unlocker. Awaiting genuine NPV Tunnel export interoperability tests.

## What works

The standalone desktop and mobile converters now recognize an NPVS Gen-2 v5 `app-key` envelope and attempt authenticated decryption **without asking for a creator passphrase**, when matching authorized key material has been provisioned in the current browser session.

1. Select the NPVS file in the unified converter. If matching key material is absent, the file remains locked and only safe inspection is exposed.
2. Select **Load authorized Gen-2 AppKey file** and choose your JSON keyring.
3. The last NPVS selection is retried automatically. If authentication succeeds, the existing loss-aware converter offers VLESS, VMess, Trojan, Shadowsocks or JSON outputs **only when representable**.
4. Other files matching the loaded keyring may be imported in the same browser session without any further passphrase or key-file prompt. Clear wipes the loaded keys and session file selection.

Everything runs locally. No network, uploads, localStorage, or external JavaScript assets are introduced.

## Key-file format

An authorized key provider must supply the Gen-2 `A16` (16 bytes) **or** the already-derived KDK (32 bytes) for each `configId` and `salt` pair. Values are lowercase or uppercase hex. Each entry needs **exactly one** of `a16` or `kdk`:

```json
{
  "format": "npvs-gen2-keys-v1",
  "entries": [
    {
      "configId": "00112233445566778899aabbccddeeff",
      "salt": "11223344556677889900aabbccddeeff",
      "a16": "ffeeddccbbaa00998877665544332211"
    }
  ]
}
```

These values are **illustrative only** and cannot unlock real files. A matching KDK can be entered instead of A16, but never both.

Security: The key file is a secret. Anyone holding this material and the matching encrypted NPVS file may be able to decrypt its connection credentials. Do not publish the keys in GitHub, commit fixtures, screenshots or logs. Do not include actual server passwords in public tests.

### What is automatic and what is not

The app computes, using WebCrypto:

```
KDK = SHA256( UTF8("npvtunnel/appkey/v2 ") || A16 || configId )
DEK = ChaCha20-Poly1305.open(KDK, wrapNonce, wrappedDEK, AAD=salt)
```

Metadata and every NPF field are independently authenticated using the Phase-2 HKDF/ChaCha20-Poly1305 code. An incorrect key fails authentication; no guessed share link is emitted.

The **A16 value itself is derived from the file's salt using generation-specific app-key material**. That derivation is **not bundled or implemented** in the MIT browser converter because the currently inspected upstream binary tables and reverse-engineered white-box implementation are separately licensed or have uncertain redistribution rights. A16 varies with salt, so this patch does **not** allow unattended decryption of arbitrary Gen-2 AppKey exports out of the box. It is a working final-stage unlocking path given authorized per-file key material, not a password bypass.

Implementing fully unattended import for a wider set of authorized Gen-2 AppKey files will require a redistributable, independently verified A16 derivation provider and valid user consent. Do not embed unlicensed white-box tables.

## Implementation and validation

Files:
- `tools/npvs-browser-runtime.js`: session-only, bounded (32 entries per import) validated keyring; authorized A16/KDK lookup by `configId + salt`; no key logging.
- `Index.html` and `mobile.html`: runtime inlined to preserve existing offline single-file operation; optional local keyfile input; automatic retry and clear.
- `tests/npvs-browser-runtime.test.cjs`: synthetic Gen-2 AppKey A16 and KDK success, mismatched key, invalid input, and legacy tests.
- `tests/browser-smoke.cjs`: synthetic end-to-end AppKey keyfile import, link output, no visible key leakage, and clearing.

Validation commands:

```sh
node --test tests/npvs-browser-runtime.test.cjs
node tools/build_mobile.cjs --check
node --test tests/*.test.cjs
node tests/browser-smoke.cjs
```

The JavaScript source and inline versions were syntax-checked. Full test execution and real NPV export compatibility checks remain pending in this environment. Do not merge/deploy without these checks.

Known limitations:
- No bundled or derived Gen-2 white-box A16 key material. Unknown per-file AppKeys stay locked.
- No bypass or guessing of creator passphrases or recipient private keys.
- The envelope's 64-byte outer creator signature is not independently verified.
- Only authenticated JSON and existing verified link mappings are exposed, never fabricated URLs.
- Key-file count capped at 32 entries per import and 32 KiB per file; no persistence.
- Licensing: no Pantegnos AGPL-3.0 code or tables, or unlicensed third-party binary assets, are copied.

## References

- [NPVS Phase 1](NPVS_PHASE1.md)
- [NPVS Phase 2](NPVS_PHASE2.md)
- [Pantegnos](https://github.com/FrontierTM/Pantegnos), AGPL-3.0 source and separate binary assets reviewed only
- [RFC 8439](https://www.rfc-editor.org/rfc/rfc8439), authenticated encryption
