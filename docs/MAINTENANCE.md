# Protocol maintenance

The converter's published `Index.html` must remain usable offline. GitHub Actions performs remote maintenance checks; the page itself does not fetch protocol updates.

## Upstream sources

Daily scheduled checks cover Xray-core, sing-box, Mihomo, Hysteria, AnyTLS, TUIC, ShadowTLS, TrustTunnel, Juicity, and shadowsocks-rust. Official release tags are preferred. If a project does not publish a stable GitHub release, the latest listed tag is used as a change signal, not a compatibility guarantee.

The workflow creates or updates **one** GitHub issue titled `[protocol-watch] Upstream protocol compatibility`. It posts a comment only when tracked versions change and includes relevant release-note lines. The first run establishes a baseline. No downloaded code is executed, and no parser changes or releases are published automatically.

## Protocol change review

1. Read the upstream specification and changelog. Record the minimum supported core version.
2. Classify the change: new protocol, URI syntax, JSON schema, transport, TLS, or incompatible behavior.
3. Update both import and export mappings only if a documented, reversible representation exists.
4. Preserve the full native JSON when a share URI cannot represent all connection-critical fields.
5. Add synthetic fixtures and round-trip tests. Run the exact core's configuration validator and test real client import when available.
6. Merge only after code review and green checks; publish a new release separately.

## Safety boundaries

- New protocols cannot be made compatible with NPVT1 merely by changing a protocol label. Validate exported files against NPV Tunnel first.
- Unknown fields must not disappear silently from outputs claimed to be lossless.
- Do not dynamically execute upstream code, copy unknown scripts into the HTML, or auto-merge cryptographic changes.
- A green unit test does not prove that a server connection works.

Run watch tests locally:

```sh
python -m unittest discover -s tests -p 'test_protocol_watch.py' -v
```

Scheduled Actions only run from GitHub's default branch after the workflow is merged and enabled.
