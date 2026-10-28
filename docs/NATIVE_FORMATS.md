# Native Mihomo and WireGuard format adapters

The unified **Universal converter** workspace in standalone `Index.html` and `mobile.html` handles supported Mihomo/Clash YAML, native JSON, WireGuard/AmneziaWG client INI and TrustTunnel deep links entirely offline. There is no separate native-format panel in the current UI.

## Supported native formats

| Protocol family | Input | Output | Tested against |
| --- | --- | --- | --- |
| Snell (v1-v5 Mihomo node) | Mihomo YAML or equivalent JSON | YAML/JSON | Mihomo 1.19.32 (v4 sample) |
| TrustTunnel (HTTP/2 + HTTP/3) | Mihomo YAML/JSON; selected `tt://?` v2 links | YAML/JSON; `tt://?` v2 when losslessly representable | Mihomo 1.19.32 + binary round-trip tests |
| ShadowQUIC | Mihomo YAML/JSON | YAML/JSON | Mihomo 1.19.32 |
| Mieru | Mihomo YAML/JSON | YAML/JSON | Mihomo 1.19.32 |
| WireGuard and AmneziaWG v3/v3.1 | Mihomo YAML/JSON, WG client INI | YAML/JSON, WG client INI | Mihomo 1.19.32 and round-trip tests |
| Existing Mihomo proxy types | Mihomo YAML/JSON | YAML/JSON | Syntax tests; only selected families exercised with Core |

### Workflow

1. Open the unified **Universal converter** workspace on desktop or mobile.
2. Paste a `proxies:` Mihomo YAML node list, equivalent JSON, a supported `tt://?` deep link or a WireGuard `[Interface]` + `[Peer]` client INI; alternatively select a local file.
3. Choose a currently **available** target such as **Mihomo YAML**, **Native JSON**, **WireGuard INI**, or **TT deep link**. Targets unsupported by the recognized input are intentionally absent.
4. Review any rejection or conversion warning. Validate the output with a matching Core before deployment; syntax-valid output is not evidence of server reachability.

The YAML importer deliberately implements a **restricted subset**: plain nested maps, sequences, quoted/unquoted scalar values and simple inline arrays/maps. YAML anchors, aliases, merge keys, tags, folded/literal blocks and templates are **not supported** and must be processed with a full YAML parser outside this panel. Unsupported constructs are rejected rather than guessed. The native JSON/YAML round-trip keeps all fields for supported nodes, including unknown vendor extension fields, but Mihomo may reject fields it does not recognize.

### TrustTunnel deep-link v2

The `tt://?<base64url>` format uses TLV fields and QUIC variable-length integers according to the [official specification](https://github.com/TrustTunnel/TrustTunnel/blob/master/DEEP_LINK.md). The converter decodes/encodes static credentials, hostname, endpoint list, TLS settings, optional certificate bytes, subscription URL, DNS upstreams, anti-DPI options and unknown TLVs (by retaining their raw bytes).

**Important:** only simple static, single-address deep links can be mapped to Mihomo `type: trusttunnel` without loss. Subscription-only links, certificate chains, DNS upstream policies, client-random authentication and other deep-link-only settings remain in deep-link JSON / `tt://?` form. Credentials are merely base64url-encoded in TT links, **not encrypted**. Treat them as passwords.

### WireGuard / AmneziaWG

A client INI can contain one interface and one or more peers. Supported keys cover address, keys, endpoint, allowed IP ranges, keepalive, MTU, `Jc`/`Jmin`/`Jmax`, `S1`-`S4`, `H1`-`H4`, `I1`-`I5`, v3 header protection, content padding, timer parameters, and v3.1 random trailers/cookie flags.

When a 32-byte `HeaderProtectionKey` is present, the exporter requires all `S1`-`S4` padding sizes to be at least 12 bytes. The version is inferred from protocol options, not emitted as a nonstandard INI key. Unknown fields such as system `PostUp` hooks and unsupported DNS settings are rejected to avoid silently losing behavior.

Because native-core config checks validate syntax, **they do not prove a correct handshake or reachable server**. New configuration formats must be tested against an authorized server before being described as fully interoperable.

### Deliberate limitations

- Native adapters are not equivalent to universal share URI exporters. No `snell://`, `sq://` or `mieru://` URLs are generated without a verified compatible URI specification.
- Mihomo YAML is not automatically convertible to NPVT1; unknown NPVT protocols remain unsupported.
- Full-feature YAML with anchors/templates, provider lists, complex references, and nested configuration constructs needs a production YAML library, not this restricted parser.
- Juicity, MASQUE, NaiveProxy, ShadowTLS and many protocol-specific wrappers still need dedicated interoperable adapters where the target Core supports them.

### Tests

```sh
node --test tests/*.test.cjs
node tools/export_mihomo_fixture_configs.cjs
```

GitHub Actions validates sample outputs against a digest-pinned `metacubex/mihomo:v1.19.32` image. These tests run together with Xray and sing-box checks.
