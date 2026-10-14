# Smart Converter: detected input → compatible output

Updated October 13, 2026. This table describes **implemented, test-covered conversions**, not claims of universal protocol interoperability.

The application is still a fully local, single-file `Index.html`. It has **one visible input workspace** (paste, click-to-select, or drag/drop up to 80 files, each at most 1 MB) and **one output workspace** (format selector, copy, download). Existing parsers continue to run behind this UI.

## Detection and output matrix

| Detected content (extension is only a hint) | Output offered | Not offered / reasons |
| --- | --- | --- |
| VLESS / VMess / Trojan / SS / SOCKS URI | Plain link, Base64 subscription, Xray JSON; legacy NPVT1 only when verified; Mihomo YAML/JSON for basic VLESS/VMess/Trojan/SS | Advanced options and unsupported Core mappings |
| AnyTLS, Hysteria2 / Realm / Gecko, TUIC share URI | Link, Base64 subscription, sing-box JSON where supported | NPVT1 and Xray JSON |
| TrustTunnel `tt://?` v2 deep link | Mihomo YAML/JSON and TT link when losslessly mappable | Deep-link-only options and subscription pointers are not silently discarded |
| Mihomo / Clash native YAML/JSON (supported node types) | Mihomo YAML/JSON, single-node WG INI or TT link; basic VLESS/VMess/Trojan/SS → link and Xray JSON when fully representable | NPVT1 and Xray URI where no verified mapping exists |
| WireGuard / AmneziaWG client INI | Mihomo YAML/JSON, WireGuard INI | VLESS, Trojan and other unrelated VPN protocols |
| Xray / V2Ray / NPV JSON | Original JSON, share URI (only when verified), Xray JSON | Unmappable extra fields block lossy short URI conversion |
| sing-box JSON | Original JSON, sing-box JSON, supported share URI | Unsupported native-only fields block shortened URI output |
| NPVT1 (legacy encrypted container) | Supported link extraction and Base64 link subscriptions | Rewriting NPVT1 from extracted links would lose source metadata |
| NPVO1 (open export) | Known share URIs and Base64 subscription | Repacking without loss not yet proven |
| NetMod Syna encrypted `.nm` / same blob with an unknown extension | Recovered **original** NetMod SSH/Proxy JSON | No fabricated VLESS/VMess links |
| NPVS binary v5, app-key / passphrase / recipient locked | Inspected, nonsecret header details | **Cannot decrypt authenticated payload without available key** |
| Generic JSON | Original JSON | No guessed proxy protocol |
| Unsupported external URI, e.g. SSR/SSD/EHI/HAT/other | Recognition message | No fabricated conversion results |

#### Additional basic Mihomo link adapter

For **VLESS, VMess, Trojan, Shadowsocks**, TCP and simple WebSocket plus TLS fields can now be converted to/from a Mihomo native node. This is a deliberately strict subset: unsupported options (including XHTTP, plugin-specific Shadowsocks options, advanced WebSocket headers and unknown source properties) are rejected instead of dropped. The resulting URI-to-native VLESS sample is validated by the pinned official Mihomo Core in CI.

## Protocol correctness updates (October 14, 2026)

- Trojan and SOCKS share URIs now bracket IPv6 literals so standard URL parsers recover the original address.
- VLESS, Trojan and VMess links preserve Xray TLS `pcs` (SHA-256 certificate pin) and `vcn` (certificate verification names) through supported JSON conversions. VMess's `insecure` property is retained in VMess share links.
- Xray JSON generation rejects `insecure=1`/`allowInsecure=1` rather than creating a configuration rejected by current Xray releases. It does **not** silently upgrade insecure links or invent certificate pins. Invalid `pcs` fingerprints are rejected.
- REALITY links no longer default to `allowInsecure=true` when the source omits that option.
- In the smart workspace, unsupported Xray transport/TLS/REALITY/WS/gRPC options prevent link/subscription export instead of being discarded; original native JSON remains available.
- When a native JSON cannot be safely exported as a link, the smart workspace reports why. Oversized batch archives are skipped before allocating a huge JSON result.

Compatibility references:
- [Xray TLS config fields](https://github.com/XTLS/Xray-core/blob/main/infra/conf/transport_internet.go)
- [VMess share-link fields (v2rayN)](https://github.com/2dust/v2rayN/wiki/Description-of-VMess-share-link)
- [Xray VLESS/VMessAEAD link specification](https://github.com/XTLS/Xray-core/discussions/716)

## Batch mode

- Multiple URI and subscription files are combined into a link list or Base64 subscription.
- Multiple supported Mihomo or WireGuard files can be merged into Mihomo JSON/YAML, preserving node types.
- Duplicate Mihomo proxy names block the merge rather than silently overwriting proxies.
- A JSON source bundle option preserves files as text for later processing; it is **not** a native Xray/Mihomo config.
- Native per-Core JSON and wireguard/TT outputs are restricted to one suitable source unless a batch mapping has been verified.
- An NPVS file in a batch restricts the selection appropriately; encrypted content cannot be used as decrypted profile data.

## Why a password-free NPVS converter is not universal

The supplied NPVS v5 sample uses the **creator-passphrase unlock method**, PBKDF2-HMAC-SHA256 and authenticated ChaCha20-Poly1305 encryption. Its ciphertext cannot be reliably converted to proxy settings without the actual unlocking key or plaintext. An app-key or recipient-key variant has **different** requirements. The converter never invents passwords or represents a successful format check as successful decryption.

Open NPV exports (`NPVO1`), legacy NPVT1 and certain NetMod generations can be decoded without creator passphrases because their formats differ. The format is identified from binary/text structure, not from file names alone.

## Research and compatibility references

The following existing projects were examined for supported formats and routing ideas. Their conversion matrices also have **partial or unsupported pairs**, reflecting genuine differences between proxy cores.

- [Sub-Store](https://github.com/sub-store-org/Sub-Store): Surge, QX, Loon, Mihomo, sing-box, Shadowrocket and other clients. Its core is AGPL-3.0; no code has been copied.
- [subconverter-rs](https://github.com/lonelam/subconverter-rs): diverse subscription formats; its compatibility matrix explicitly distinguishes supported vs partial routes.
- [subscription-converter](https://github.com/cnfatal/subscription-converter): Mihomo/Base64 to sing-box, with restrictions on routing/DNS/group semantics.
- [Pantegnos](https://github.com/FrontierTM/Pantegnos): NetMod, NPV families and other proprietary configuration envelopes; GPL/AGPL licensing and separate white-box assets must be considered before integrating any code.
- [Official sing-box outbound schemas](https://sing-box.sagernet.org/configuration/outbound/).
- [Official sing-box WireGuard endpoint schema](https://sing-box.sagernet.org/configuration/endpoint/wireguard/).

**Out of scope of this implementation:** importing every Surge/Loon/Quantumult X/EHI/HAT/NM generation, password-free unlocking of protected NPVS, full YAML (anchors/aliases/scripts), and server handshake verification. Those require separate documented adapters and Core/client validation fixtures.

## Tests

```sh
node --test tests/*.test.cjs
```

GitHub Actions additionally validates representative configs using real Xray, sing-box and Mihomo binaries, and checks the single-workspace UI on desktop and mobile Chromium. No real user files, passphrases or decrypted configuration data are committed to the repository.
