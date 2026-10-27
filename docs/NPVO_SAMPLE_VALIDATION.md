# Private Sample Validation — NPVO1 Payload in an .npvs File

**Date:** 2026-10-28
**Repository branch:** `feature/npvo-real-fixture-and-hardening-20261028`
**User-supplied sample:** Kept private; **not** committed, copied into fixtures, or printed to CI logs.

## Format finding

A real user sample with extension `.npvs` is **not an encrypted NPVS Gen-2 v5 envelope**.
Its actual bytes start with `NPVO1\n`, followed by an open JSON document.
The file extension is therefore not a reliable indicator of the cryptographic format.

- File size: **26,341 bytes**.
- Root JSON field: `configs`.
- Number of configurations: **68**.
- Number of valid Base64 encoded `npvs1:` inline fields: **420**.
- Strict UTF-8 decode failures: **0**.
- Protocol coverage: **51 Shadowsocks**, **7 VLESS**, **6 Trojan**, **4 VMess**.
- Successful URI mappings: **68 of 68**.
- Mapping losses reported by the converter: **0**.

## Validation performed

1. Loaded the uploaded file into an isolated, in-memory invocation of the actual current `Index.html` script. No real credentials were emitted from the diagnostic tool.
2. Confirmed the actual converter's `smartRecognizeText` detects **NPVO1** rather than encrypted NPVS, despite the misleading suffix.
3. Confirmed the actual converter emits **68 share links** and an additional decoded JSON export retaining **all 68 profiles**.
4. Independently checked the links against the decoded source for endpoint, port and protocol credentials, SS method, VMess transport, VLESS/Trojan TLS and REALITY options, gRPC service names, TLS-insecure flags and relevant query fields. Mismatches: **0**.
5. Added tests using separate **synthetic** 68-profile documents, not the private sample. Tests cover malformed Base64 markers, non-UTF-8 input, unsupported fields and conflicted TLS settings; incomplete batches must not advertise partial subscriptions as complete.

### Explicit limits

- This is a successful **format/field/URI round-trip inspection**, not an active network connection test or verification of server availability.
- It does **not** test Gen-2 AppKey decryption: the supplied file was not encrypted.
- A complete file-to-URI mapping does not establish that an upstream service is reachable.
- Some historical UUIDs use nonstandard version bits. Their exact textual values are preserved; credential semantics are not guessed.
- A 64-byte outer creator signature occurs only in some encrypted NPVS generations and its signing algorithm/trust model have not been established. The converter must not claim to have verified creator identity.
- No private credentials, decoded links or original sample bytes should be committed to GitHub.

## Regression commands

```bash
node --test tests/*.test.cjs
node tools/build_mobile.cjs --check
node tests/browser-smoke.cjs
```

**Release gate:** CI green plus an authorized encrypted v5 sample and independently verified signer format are still required before calling all NPVS variants universally supported.
