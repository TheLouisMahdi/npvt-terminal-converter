# NPVS Gen-2: Authorized A16 Lookup Table Adapter

**Status:** Implemented on `main` (October 2026). The application includes the evaluator, **not** the third-party lookup table bytes. The published-vector compatibility suite runs with temporary, external reference data.

## When this unlocks a file

An NPVS **Gen-2 v5 AppKey** file can be decrypted when the user explicitly supplies either a matching A16/KDK keyring or compatible, legally obtained lookup tables. For a lookup table, the engine derives per-file A16 from the salt, then derives KDK and authenticates the wrapped DEK, sealed metadata and individual NPF fields.

Neither input will unlock an unknown **creator-passphrase** file or recipient-private-key file. The private `configId`/salt pair and encryption generation must match; an unfamiliar or invalid key never produces invented share links.

## Local use

1. Open `Index.html` or `mobile.html` and import an encrypted NPVS AppKey file.
2. Click **Load authorized Gen-2 lookup tables** and choose a compatible table blob that you have a right to use.
3. The app performs validation and reruns the selected file(s) locally; correct key material enables authenticated extraction.
4. Export supported VLESS/VMess/Trojan/Shadowsocks links or decoded JSON. If link conversion would lose settings, use available JSON instead.
5. Use **Reset** to discard session-provisioned secrets.

**No table upload, backend, remote fetch, WASM or runtime library is needed.** Both HTML apps remain standalone and operate offline. The table is held in session memory, with best-effort cleanup on reset.

## Accepted table contract

| Property | Requirement |
| --- | --- |
| Raw table | Exactly **749,568 bytes** |
| Compressed table | zlib-deflate; browser support for `DecompressionStream('deflate')` required |
| Expansion | Strict size cap; truncated, malformed or oversized inputs rejected |
| Generation | Must match the implemented Gen-2 A16 transform |
| Activation | **Six published salt/A16 verification vectors must pass** before any table is accepted |
| Runtime storage | Session RAM only; no persistent credential store |
| Distribution | Third-party proprietary or copyleft assets **are not shipped** with this MIT project |

The evaluator runs **13 rounds** over a 16-byte state, using generation-specific lookup transformations. It is an independently written JavaScript adapter for caller-supplied tables, not a bundled implementation of a separately licensed white-box table.

```text
NPVS Gen-2 v5 (AppKey method)
  -> validate envelope + key method
  -> supplied authorized table: A16 = transform(salt)
  -> KDK = SHA256("npvtunnel/appkey/v2 " || A16 || configId)
  -> authenticated DEK unwrap (ChaCha20-Poly1305; salt as AAD)
  -> authenticated HKDF-derived metadata and NPF fields
  -> reconstruct NPV config JSON
  -> strict, non-lossy share-link mapping where supported
```

Users with **per-file authorized A16/KDK** can instead load a matching keyring using the separate **Load authorized Gen-2 AppKey file** control; see the [NPVS guide](NPVS.md).

## Validation and limitations

- The ordinary test suite covers the offline adapter and bad-input behavior using synthetic values.
- The optional `.github/workflows/npvs-gen2-compat.yml` retrieves publicly published reference table/fixture data into **temporary CI storage**, verifies A16 vectors and an authenticated real-format Gen-2 AppKey envelope, then removes the downloaded bytes. The tests do **not** ship those bytes with the page.
- Known Gen-2 NPF bodies may have a **32-byte post-record trailer**. The parser accepts only 0- or 32-byte trailers; the 32-byte trailer's independent meaning is **unverified**.
- The outer 64-byte **creator signature is not verified**. AEAD success authenticates content to the supplied decryption key, not the purported creator or trusted publisher. See [signature status](NPVS_SIGNATURE_STATUS.md).
- Public reference-compatibility tests **do not guarantee** interoperability with every NPV Tunnel version, advanced profile or source policy. A real target client's config validation and authorized server connectivity test are distinct checks.
- JavaScript garbage collection may retain temporary copies of sensitive bytes; never distribute or publish the table, decrypted credentials or keyring casually.
- Redistributing third-party white-box assets/code may be restricted by separate licenses, including the upstream project's **AGPL-3.0**. Obtain legal permission before redistribution.

## Tests

```sh
node --test tests/npvs-gen2-tables.test.cjs
node --test tests/npvs-browser-runtime.test.cjs
node --test tests/*.test.cjs
node tools/build_mobile.cjs --check
```

The public compatibility workflow runs separately on relevant code changes or by manual dispatch.

Reference: [published Gen-2 test vectors](https://github.com/FrontierTM/Pantegnos/blob/main/internal/modules/impl/npvs_gen2_test.go) (separate AGPL-3.0 source); [RFC 8439](https://www.rfc-editor.org/rfc/rfc8439).
