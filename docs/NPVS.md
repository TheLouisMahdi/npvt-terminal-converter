# NPV file formats and authenticated imports

This is the **current** NPVT / NPVO / NPVS guide for the standalone desktop `Index.html` and mobile `mobile.html`. The converter runs locally in a browser. File extensions are hints, not proof of the underlying format.

## Format recognition

| Content marker | Format | What the converter can do |
| --- | --- | --- |
| `NPVT1` / `NPVTSUB1` | Legacy NPV container | Extract supported profiles or build a legacy NPVT1 from a compatible subset of share links. Source-to-source rewrites are not assumed lossless. |
| `NPVO1\n` | Open JSON-style NPV export | Decode `npvs1:`-wrapped UTF-8 fields and convert **all** supported profiles; retain JSON when any link would be incomplete. A file named `.npvs` can contain this unencrypted format. |
| `NPVS`, version 0 or 1 | Encrypted NPVS Gen-1 | Authenticate content when a valid creator passphrase or compatible legacy AppKey is available. |
| `NPVS`, version 5 | Encrypted NPVS Gen-2 | Inspect the authenticated envelope and unlock via the appropriate creator-passphrase or authorized AppKey path. |
| Unsupported NPVS version | Unknown encryption generation | Report unsupported or locked; never manufacture decrypted profiles. |

Files are capped at 1 MiB each; the main converter accepts at most 80 files per selection. Other supported text, proxy URI, native JSON/YAML, WireGuard INI and NetMod inputs are documented in [the conversion matrix](SMART_FORMAT_MATRIX.md).

## Unlock methods

| Method | Required input | Current behavior |
| --- | --- | --- |
| Creator passphrase (Gen-1 / Gen-2) | Valid creator password | Local PBKDF2-SHA256 followed by authenticated decryption; **one password** or **batch of already-known passwords** can be supplied. |
| Gen-1 AppKey | Compatible existing legacy key generation | Attempts authentication automatically; incompatible generations stay locked. |
| Gen-2 AppKey | Authorized matching A16/KDK key file **or** compatible, authorized Gen-2 lookup tables | Authenticates the key wrap, metadata and record contents; no creator password for AppKey mode. |
| Recipient private key | Matching recipient secret and a dedicated adapter | **Not implemented**: safe structure inspection only. |

**The browser never invents passphrases or derives unavailable recipient private keys.** A format inspection is not proof that content is decrypted.

### Creator passphrases: single or batch

The unified converter provides a single-password field and a **Known passphrases · batch** dialog. Supply exact previously obtained values by pasting one per line or importing a local TXT. The app tests the values against selected creator-passphrase files, automatically reuses a verified match on later files, and shows count-only progress. No dictionary generation, alterations or network requests.

The dialog accepts **128** unique passphrases, up to **256 characters each**, with a **16 KiB** input cap. Blank lines are skipped; spaces in nonblank entries are significant. **Stop** takes effect between costly PBKDF2 checks, and **Forget** clears the session list and single-password field. Successful and still-locked files remain distinguishable; link export includes only successfully decrypted/verified sources.

The list is held only in tab memory (not localStorage or uploaded). Because JavaScript strings are immutable, erasure of every browser-internal copy cannot be guaranteed. See [batch passphrase instructions](NPVS_KNOWN_PASSPHRASES.md).

### Gen-2 AppKey: authorized keyring

Click **Load authorized Gen-2 AppKey file** and select a JSON file containing matching `configId` and `salt` values, plus **exactly one** `a16` (16 bytes) or `kdk` (32 bytes) per entry. Values are hex. Example entries are **synthetic and cannot unlock real user files**:

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

Alternatively, load **authorized Gen-2 lookup tables** to derive A16 from the per-file salt for a compatible generation. Neither tables nor proprietary key material are bundled into the released HTML. Full file contract, compatibility verification, licensing constraints and test coverage: [Gen-2 table adapter](NPVS_GEN2_TABLES.md).

For an A16 entry the final-stage derivation is:

```text
KDK = SHA256(UTF8("npvtunnel/appkey/v2 ") || A16 || configId)
DEK = ChaCha20-Poly1305.open(KDK, wrapNonce, wrappedDEK, AAD=salt)
```

The envelope's sealed metadata and encrypted NPF fields are separately decrypted only after their corresponding authentication tags verify. The keyring and tables must be treated as confidential secrets, not committed or uploaded.

## Gen-2 v5 envelope (developer reference)

The input starts with `NPVS` (4 bytes), version `0x05` (1 byte), and a 4-byte big-endian header length. The compact header has revision byte `1`; a 16-byte config ID; a 33-byte creator-key field; method byte at header offset 50 (0 recipient, 1 passphrase, 2 AppKey); and 2-byte recipient count at 51–52. Recipient records occupy 125 bytes each. The method-specific wrap block is 80 bytes for creator passphrase or 78 bytes for AppKey; then come a length-prefixed encrypted metadata block and an NPF record body after the 12-byte nonce and 4-byte body size.

NPF field records are individually authenticated with HKDF-derived keys and ChaCha20-Poly1305. The current parser accepts a 0-byte or 32-byte trailing post-record segment as documented by the public reference fixture, **but has not independently verified its semantics**. The envelope also has a 64-byte outer signature-like field. **Its creator-signature verification is not implemented.** `AEAD verified` means the encrypted data authenticated to the supplied key; it does **not** prove the creator's identity. See [signature status](NPVS_SIGNATURE_STATUS.md).

## Conversion guarantees and limitations

- A real open `NPVO1` sample with a misleading `.npvs` extension was locally tested: **68/68** configurations mapped and **420** encoded fields decoded with zero structural mismatches. The private source, credentials and recovered links were **not committed**. This test does not validate arbitrary encrypted NPVS files.
- The Gen-2 compatibility workflow uses publicly available reference fixtures and ephemeral table bytes in CI only; it checks published A16 vectors and a reference AppKey envelope. That is not universal interoperability with every NPV Tunnel release.
- Missing or incorrect keys yield a **locked** result; corrupt AEAD tags fail. Unsupported transport, TLS or profile fields block shortened link export rather than being silently discarded. Authenticated original JSON can still be available when a link mapping is incomplete.
- A decoded VLESS/VMess/Trojan/Shadowsocks URI is **not** evidence of a successful real server connection. Validate any resulting configuration with the target client/core.
- Creator signing/trust, unrecognized encryption generations, arbitrary unknown creator passwords, unavailable recipient private keys and incompatible AppKey tables remain unsupported.

## Testing

```sh
node tools/npvs-inspect.cjs path/to/file.npvs
node --test tests/*.test.cjs
node tools/build_mobile.cjs --check
```

The browser smoke suite needs the pinned Playwright Chromium test dependency. GitHub Actions runs desktop and mobile UI smoke tests and Xray/sing-box/Mihomo config checks. The optional Gen-2 workflow downloads its separately licensed reference data **only to temporary CI storage**. Do not copy that third-party code/tables into this MIT repository without checking licensing rights.

References: [RFC 8439](https://www.rfc-editor.org/rfc/rfc8439), [Pantegnos reference implementation](https://github.com/FrontierTM/Pantegnos) (AGPL-3.0; studied but not incorporated), and [the maintained format matrix](SMART_FORMAT_MATRIX.md).
