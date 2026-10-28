<div align="center">

# NPV Tunnel NPVT Converter

**Offline, local-first config converter · Desktop and mobile · Standalone HTML**

[![Desktop](https://img.shields.io/badge/Desktop-Index.html-80d8ad?style=for-the-badge&labelColor=07110d)](https://thelouismahdi.github.io/npvt-terminal-converter/download.html?file=desktop)
[![Mobile](https://img.shields.io/badge/Mobile-mobile.html-59c194?style=for-the-badge&labelColor=07110d)](https://thelouismahdi.github.io/npvt-terminal-converter/download.html?file=mobile)
[![License](https://img.shields.io/badge/License-MIT-d9f2e4?style=for-the-badge&labelColor=07110d)](LICENSE)

[**Open desktop app**](https://thelouismahdi.github.io/npvt-terminal-converter/Index.html) · [**Open mobile app**](https://thelouismahdi.github.io/npvt-terminal-converter/mobile.html) · [**Download standalone files**](https://thelouismahdi.github.io/npvt-terminal-converter/download.html) · [**Repository ZIP**](https://github.com/TheLouisMahdi/npvt-terminal-converter/archive/refs/heads/main.zip)

<img src="assets/Prev.png" alt="NPVT Terminal Converter desktop interface preview" width="100%" />

</div>

## Overview

**NPVT Terminal Converter** reads and converts supported NPV Tunnel containers, proxy share links, subscriptions and native proxy configurations inside the browser. Its unified workspace detects file content, shows only compatible output options, and prevents known lossy mappings.

Two complete, portable applications are provided:

- **`Index.html`** — desktop-oriented single-file HTML.
- **`mobile.html`** — touch-friendly, independently runnable single-file HTML generated from the same engine.

Both embed their parsing, conversion and cryptographic code. **No server, account, external runtime script or API is needed for conversion.** Opening the GitHub Pages version requires a network connection to load the page initially; processing happens locally after load.

This project is **not** a VPN client, proxy core, server connectivity tester or a universal encrypted-file unlocker.

## Get started

1. [Open](https://thelouismahdi.github.io/npvt-terminal-converter/Index.html) the desktop page, [open](https://thelouismahdi.github.io/npvt-terminal-converter/mobile.html) the mobile page, or download the appropriate `.html` to use offline.
2. Paste supported configuration text **or** select/drop files in the single **Universal converter** input area. Import up to **80 files at once**, each at most **1 MiB**.
3. Inspect recognized sources, choose an **available** output format, then **Copy** or **Download**. If an option is absent, no verified conversion is available for that input.

> **Downloading HTML:** GitHub Raw may display HTML source instead of executing or downloading it. Use the [download page](https://thelouismahdi.github.io/npvt-terminal-converter/download.html) or download the repository ZIP and open `Index.html` / `mobile.html` locally. Some mobile file preview apps block local JavaScript; open the saved file in a browser that supports it.

## Supported inputs and outputs

The format is recognized by its **contents**, not simply its filename or extension.

| Input | Available conversions | Key limitation |
| --- | --- | --- |
| **NPVT1 / NPVTSUB1** legacy containers | Extract supported profile links; build *new* NPVT1 containers from a verified subset of share links | Converting an existing container back to NPVT1 is not automatically lossless |
| **NPVO1** open NPV JSON exports (even if named `.npvs`) | Decode inline `npvs1:` fields and extract supported share links; preserve decoded JSON | Unsupported profile fields prevent incomplete links from being presented as complete |
| **NPVS Gen-1 (v0/v1)** | Authenticated import with known creator password or compatible Gen-1 AppKey | Missing keys remain locked |
| **NPVS Gen-2 (v5)** | Authenticated creator-passphrase or authorized AppKey import; compatible JSON/link output | Recipient private-key mode and unverified creator signature remain limitations |
| **VLESS / VMess / Trojan / Shadowsocks / SOCKS** links | Links, Base64 subscriptions, supported Xray/native JSON; verified basic Mihomo mappings | Advanced options may require native JSON |
| **Hysteria2, AnyTLS, TUIC, TrustTunnel** links | Supported share links and relevant sing-box / Mihomo/native representations | No fabricated NPVT1 or unrelated protocol link |
| **Xray / V2Ray / sing-box JSON** | Native JSON and share links where all necessary settings map | Unrecognized transport/TLS fields block lossy URI export |
| **Mihomo/Clash YAML and JSON** | Supported YAML/JSON; selected basic URI, TrustTunnel and WireGuard mappings | Restricted YAML syntax; not a general-purpose YAML interpreter |
| **WireGuard / AmneziaWG client INI** | Native INI and compatible Mihomo YAML/JSON | No conversion into unrelated VLESS/Trojan links |
| **NetMod `.nm`** | Decrypted original SSH/Proxy JSON for supported NetMod generations | SSH credentials are not misrepresented as V2Ray links |

Additional modern options handled in supported native models include VLESS XHTTP/REALITY, WebSocket/TLS, certain post-quantum settings, Hysteria2 Gecko/Realm, Shadowsocks 2022, TrustTunnel v2, and AmneziaWG v3/v3.1. **Support is format- and option-specific, not universal across cores.**

Detailed coverage: [format compatibility matrix](docs/SMART_FORMAT_MATRIX.md) · [native formats](docs/NATIVE_FORMATS.md).

## Encrypted NPVS: correct keys, automatic matching

The converter recognizes NPVS **Gen-1** and **Gen-2** envelopes and distinguishes their unlocking methods.

| Lock type | What you supply | Current support |
| --- | --- | --- |
| **Creator passphrase** | One password or a list of **existing** passwords | ✅ Authenticate and import Gen-1 / Gen-2 |
| **Gen-1 AppKey** | Compatible existing legacy key generation | ✅ Attempt where compatible |
| **Gen-2 AppKey** | Authorized per-file A16/KDK keyring, or authorized compatible Gen-2 tables | ✅ Authenticate and import supported Gen-2 AppKey files |
| **Recipient private key (ECDH)** | Matching private key | 🔒 Inspection only; decoder not implemented |
| **Unknown password or unsupported generation** | No matching key | 🔒 Stays locked; no password bypass |

### Known passphrases · batch

The **Known passphrases · batch** button opens a **separate dialog**. Paste the creator passwords you already have, **one exact password per line**, or import a local `.txt` file. Then select multiple NPVS files. The app checks those provided values automatically, reuses confirmed matches on later files, and displays only counts/progress—not the passwords.

- Maximum **128 distinct passwords**, **256 characters per entry**, **16 KiB list**, and **80 input files** per batch.
- **Stop** interrupts between PBKDF2 attempts; **Forget** clears the saved session list. Main **Reset** clears it too.
- Valid matches are confirmed with authenticated encryption, not by plausible-looking text. Locked files are still shown; verified successfully unlocked links remain exportable.
- Passwords remain **in this tab's memory only**; no cloud request, localStorage persistence or credential logging. Browser garbage collection cannot guarantee perfect physical erasure of immutable strings.
- **Only supplied passwords are tested.** No password-generation, dictionary cracking or universal recovery is claimed.

[Complete batch-password guide](docs/NPVS_KNOWN_PASSPHRASES.md).

### Gen-2 AppKey imports

Use **Load authorized Gen-2 AppKey file** for a JSON keyring matching a file's `configId` and `salt`, or **Load authorized Gen-2 lookup tables** for a compatible legally obtained table. The keyring or table is used **locally**, only for the current browser session. No proprietary AppKey tables, real passwords or credentials ship with this repository.

The Gen-2 lookup evaluator is tested with published vectors and a public authenticated AppKey fixture, but these tests **do not** prove compatibility with every NPV Tunnel build or encrypted file.

[NPV formats and keyring structure](docs/NPVS.md) · [Gen-2 table file contract](docs/NPVS_GEN2_TABLES.md).

### What “verified” means

The browser verifies the **ChaCha20-Poly1305 authentication tags** of the applicable key wrap, metadata and content. However, the file's separate **outer creator signature is not independently verified**. Successful decryption is **not** proof of a trusted publisher or a reachable proxy server.

If any profile cannot be represented completely as a share link, **the app withholds partial link results and retains supported original/decoded JSON** instead of silently dropping important settings. Do not interpret file inspection alone as successful decryption.

[Signature and trust limitations](docs/NPVS_SIGNATURE_STATUS.md).

## Offline design and privacy

```text
Local file(s) or pasted text
   → content-based detection and bounded parsing
   → optional authorized authentication/decryption
   → normalization and strict compatibility checks
   → available output formats → copy/download (on this device)
```

- The public web page does not upload your configs or passwords for conversion.
- The converter does not attempt connections to imported proxy servers.
- The standalone HTML builds do not fetch remote runtime dependencies. **GitHub Actions** uses network downloads separately for testing against upstream cores and public reference fixtures.
- Secrets are not intentionally written to browser storage; treat exported links, native JSON and optional key files as **sensitive**.
- Unsupported/corrupted encryption, unknown fields, size-limit violations and missing keys fail closed.

## Develop and test

The app has **no npm runtime dependencies**. Node.js is used for developer checks; the browser smoke suite needs test-only Playwright.

```sh
# Unit and format regression tests
node --test tests/*.test.cjs

# Confirm that mobile.html matches the desktop engine
node tools/build_mobile.cjs --check

# Rebuild the standalone mobile file after changing Index.html
node tools/build_mobile.cjs

# Inspect a local NPVS file's structure only (no secret output)
node tools/npvs-inspect.cjs /path/to/file.npvs

# Browser smoke tests (after installing test-only Playwright + Chromium)
npm install --no-save --no-package-lock --ignore-scripts playwright@1.56.1
npx playwright install chromium
node tests/browser-smoke.cjs
node tests/download-page.cjs
```

GitHub Actions runs protocol regression tests, desktop/mobile Chromium smoke tests, selected official **Xray**, **sing-box** and **Mihomo** configuration validators, an optional Gen-2 reference compatibility test, and a scheduled upstream-change watcher. Config validator success does **not** prove live VPN/proxy connectivity.

### Repository map

| Path | Purpose |
| --- | --- |
| `Index.html`, `mobile.html` | Ready-to-use, self-contained desktop/mobile apps |
| `download.html` | Browser-friendly downloads of those single-file apps |
| `tools/npvs-browser-runtime.js` | Authenticated NPVS decoding and key adapters |
| `tools/npvs-known-passphrases.js` | Bounded verifier for *user-provided* creator passwords |
| `tools/npvo-open-runtime.js` | Open NPVO1 field decoder |
| `tools/npvs-inspect.cjs` | Safe CLI envelope inspector |
| `tools/build_mobile.cjs` | Reproducible desktop → standalone mobile build |
| `tests/` | Synthetic regression fixtures; browser/core validation tests |
| `docs/` | Maintained compatibility, native-format, NPVS and security guides |

### Documentation

- [NPV/NPVS format, keys and authenticated import guide](docs/NPVS.md)
- [Batch known-passphrase dialog](docs/NPVS_KNOWN_PASSPHRASES.md)
- [Gen-2 authorized lookup tables](docs/NPVS_GEN2_TABLES.md)
- [NPVS creator signature trust model](docs/NPVS_SIGNATURE_STATUS.md)
- [Input/output compatibility matrix](docs/SMART_FORMAT_MATRIX.md)
- [Mihomo, WireGuard and TrustTunnel native adapters](docs/NATIVE_FORMATS.md)
- [Maintenance and upstream version tracking](docs/MAINTENANCE.md)

## Security, references and licensing

**MIT License**, © 2026 Mahdi Gh. See [LICENSE](LICENSE). This repository does **not** include separately licensed white-box key tables, real users' config exports, decrypted secrets or AGPL-licensed source code.

Protocol interoperability draws on publicly documented behavior from [Xray-core](https://github.com/XTLS/Xray-core), [sing-box](https://github.com/SagerNet/sing-box), [Mihomo](https://github.com/MetaCubeX/mihomo), [TrustTunnel](https://github.com/TrustTunnel/TrustTunnel), [Shadowsocks](https://shadowsocks.org/doc/sip002.html), and [RFC 8439](https://www.rfc-editor.org/rfc/rfc8439). [Pantegnos](https://github.com/FrontierTM/Pantegnos) (AGPL-3.0) was consulted as a **separately licensed format reference**, not incorporated into the distributed application.

Use this tool only with configuration files and keys you are authorized to access. Check generated configs in their target client/core before deployment. No guarantee is made of complete format coverage, issuer authentication, remote server reachability or future-version support.

---

<div align="center"><sub>Local-first conversion · Explicit compatibility boundaries · No fabricated credentials</sub></div>
