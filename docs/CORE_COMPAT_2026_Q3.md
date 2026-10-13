# Proxy Core Compatibility: 2026 Q3 Review

Research window: **2026-07-13 through 2026-10-13**. Verified from official project changelogs/releases. This document records upstream changes and *actual implementation scope*. A release appearing here does **not** imply universal interoperability.

## Reference releases

| Core | Reference version | Date | Track | Material change and implication |
| --- | --- | --- | --- | --- |
| Xray-core | 26.10.10 | 2026-10-10 | prerelease | Track VLESS encryption, REALITY and XHTTP version-specific options; do not assume links alone preserve all fields |
| sing-box | 1.14.3 | 2026-10-09 | stable | Hysteria2 Gecko/Realm/hop randomization, Snell, TLS spoof, new native schemas and migration requirements |
| sing-box | 1.15.0-alpha | Sep/Oct 2026 | **experimental** | MASQUE endpoints, new HTTP proxy modes, whole-certificate SHA256 pinning and Tailcat; do not emit alpha-only fields into 1.14 JSON |
| Mihomo | 1.19.32 | 2026-09-30 | stable | XHTTP extra.headers converter change, and recent AmneziaWG 3.0/3.1, AnyTLS metadata and Hysteria2 timeout features |
| V2Fly/v2ray-core | 5.53.0 | 2026-08-02 | release | Dependency and runtime upgrades; legacy V2Ray/VMess compatibility still needed |
| Hysteria | app/v2.13.0 | 2026-10-05 | release | QUIC ClientHello sniffing fix for multi-packet messages; v2.12.3 introduced an ECH helper command |

## Feature matrix

| Family / feature | Browser converter | Core validation | Next action |
| --- | --- | --- | --- |
| NPVT1 | existing import/export | protocol regression checks only | test with genuine current NPV Tunnel files |
| VLESS, VMess, Trojan | URI and Xray JSON | Xray 26.7.28 | test current Xray preview versions and unknown fields |
| VLESS PQ encryption | opaque encoding preserved in URI/JSON | not cryptographic handshake validation | version-specific live handshake tests |
| XHTTP (mode, extra) | URI/JSON mapped | basic Xray test | expand fixtures for extra.headers, xmux, downloadSettings; check older-client compatibility |
| AnyTLS | URI ↔ sing-box JSON, constrained | sing-box 1.14.2 | update validator to 1.14.3; preserve client_metadata in native JSON |
| Hysteria2 Gecko/Realm/ECH | constrained URI ↔ sing-box JSON | sing-box 1.14.2 | 1.14.3 validation and certificate pin version gating |
| Shadowsocks SIP002/SIP022 | SS 2022 raw URI output | JS regression tests | validate with native core |
| Shadowsocks SIP003 | supported plugins to native sing-box JSON, no NPVT | CI fixture added | reject unrecognized plugins; add reverse mapping separately |
| Snell, TrustTunnel, Mieru, ShadowQUIC, MASQUE | no complete share exporter | none | native format adapters with target-specific fixtures |
| AmneziaWG 3.0/3.1 | no AWG importer/exporter | none | document INI-to-Mihomo mappings before implementation |
| Mihomo YAML | not supported natively | none | add YAML parser and official Mihomo config checks as a separate feature |

## Compatibility rules

1. Treat a protocol and its transport/security options separately. Do not relabel an unsupported proxy type to VLESS.
2. Keep any unrepresentable advanced fields in the original native JSON. If an exported link would lose connection-critical fields, report the limitation.
3. The NPVT1 writer uses a verified subset, not universal protocol support. New transport/encryption/plug-in support in other cores never implies NPV Tunnel support.
4. Use stable Core validators as release gates. Evaluate prerelease cores in separate compatibility tracks.
5. Version the fixture inputs and keep a brief changelog. Browser-only offline conversion has no dynamic executable plugins.

## Official sources

- Xray releases: https://github.com/XTLS/Xray-core/releases
- Xray XHTTP notes: https://github.com/XTLS/Xray-core/discussions/4113
- sing-box changelog: https://sing-box.sagernet.org/changelog/
- sing-box Hysteria2 schema: https://sing-box.sagernet.org/configuration/outbound/hysteria2/
- Mihomo releases: https://github.com/MetaCubeX/mihomo/releases
- V2Fly releases: https://github.com/v2fly/v2ray-core/releases
- Hysteria releases: https://github.com/HyNetworks/hysteria/releases
- Shadowsocks SIP002/SIP022 rules: https://shadowsocks.org/doc/sip002.html

All listed dates and compatibility statements should be rechecked before a public product release.
