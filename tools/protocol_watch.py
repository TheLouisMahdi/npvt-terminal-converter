"""Watch official protocol implementations for version changes.

This watcher intentionally never downloads or executes upstream code and never
changes conversion logic. It maintains one GitHub issue for review.
"""
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

SOURCES = (
    "XTLS/Xray-core",
    "v2fly/v2ray-core",
    "amnezia-vpn/amneziawg-go",
    "klzgrad/naiveproxy",
    "enfein/mieru",
    "SagerNet/sing-box",
    "MetaCubeX/mihomo",
    "HyNetworks/hysteria",
    "anytls/anytls-go",
    "tuic-protocol/tuic",
    "ihciah/shadow-tls",
    "TrustTunnel/TrustTunnel",
    "juicity/juicity",
    "shadowsocks/shadowsocks-rust",
)
ISSUE_TITLE = "[protocol-watch] Upstream protocol compatibility"
STATE_PATTERN = re.compile(r"<!-- protocol-watch-state:(\{[^\n]*\}) -->")
RELEVANT = re.compile(
    r"vless|reality|xhttp|hysteria|gecko|realm|anytls|tuic|"
    r"shadowtls|trusttunnel|juicity|quic|transport|protocol|"
    r"breaking|deprecated|schema|subscription|uri|tls|encryption",
    re.I,
)


def api(path, token, method="GET", data=None, allow_not_found=False):
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(
        "https://api.github.com/" + path.lstrip("/"),
        data=body,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": "Bearer " + token,
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "npvt-protocol-watch",
            **({"Content-Type": "application/json"} if body is not None else {}),
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        if allow_not_found and exc.code == 404:
            return None
        raise


def latest_version(repo, token):
    release = api(f"repos/{repo}/releases/latest", token, allow_not_found=True)
    if release:
        return {
            "version": release["tag_name"],
            "url": release["html_url"],
            "notes": release.get("body") or "",
        }
    tags = api(f"repos/{repo}/tags?per_page=1", token)
    if tags:
        return {
            "version": tags[0]["name"],
            "url": f"https://github.com/{repo}/releases/tag/"
            + urllib.parse.quote(tags[0]["name"], safe=""),
            "notes": "",
        }
    return {"version": "unversioned", "url": f"https://github.com/{repo}", "notes": ""}


def read_snapshot(body):
    match = STATE_PATTERN.search(body or "")
    if not match:
        return {}
    data = json.loads(match.group(1))
    return data if isinstance(data, dict) else {}


def changes(previous, current):
    return {
        repo: (previous.get(repo), version)
        for repo, version in current.items()
        if repo in previous and previous[repo] != version
    }


def relevant_notes(text, limit=6):
    items = [line.strip().lstrip("-* ")[:240] for line in (text or "").splitlines()]
    return [line for line in items if line and RELEVANT.search(line)][:limit]


def issue_body(current, records):
    lines = [
        "Automated watch of upstream releases and tags. Changes are **review items**,",
        "not verified compatibility or automatic implementation.",
        "",
        "| Upstream | Observed version | Release / tag |",
        "| --- | --- | --- |",
    ]
    for repo in SOURCES:
        record = records[repo]
        lines.append(
            f"| `{repo}` | `{current[repo]}` | [Source]({record['url']}) |"
        )
    lines.extend([
        "",
        "New protocols and schema changes require fixture-based testing and code review.",
        "Do not automatically merge generated parser or cryptography changes.",
        "",
        "<!-- protocol-watch-state:" + json.dumps(current, sort_keys=True) + " -->",
    ])
    return "\n".join(lines)


def find_issue(repo, token):
    # One standing issue prevents a new issue being created for each release.
    for page in range(1, 11):
        items = api(f"repos/{repo}/issues?state=all&per_page=100&page={page}", token)
        for item in items:
            if item.get("title") == ISSUE_TITLE and "pull_request" not in item:
                return item
        if len(items) < 100:
            break
    return None


def update_watch(repo, token, records):
    current = {source: records[source]["version"] for source in SOURCES}
    existing = find_issue(repo, token)
    if existing is None:
        created = api(f"repos/{repo}/issues", token, "POST", {
            "title": ISSUE_TITLE, "body": issue_body(current, records)
        })
        print("Created baseline issue:", created["html_url"])
        return

    old = read_snapshot(existing.get("body") or "")
    changed = changes(old, current)
    if not changed and old:
        print("No new upstream release/tag versions.")
        return

    number = existing["number"]
    api(f"repos/{repo}/issues/{number}", token, "PATCH", {
        "body": issue_body(current, records), "state": "open"
    })
    if changed:
        lines = ["Upstream version changes detected:"]
        for source, (before, after) in changed.items():
            lines.append(f"- **{source}**: `{before}` -> `{after}` ([source]({records[source]['url']}))")
            lines.extend("  - " + line for line in relevant_notes(records[source]["notes"]))
        api(f"repos/{repo}/issues/{number}/comments", token, "POST", {
            "body": "\n".join(lines)
        })
    print("Updated watch issue:", number, "changes:", len(changed))


def main():
    token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    if not token or not repo:
        raise SystemExit("GITHUB_TOKEN and GITHUB_REPOSITORY are required")
    records = {source: latest_version(source, token) for source in SOURCES}
    update_watch(repo, token, records)


if __name__ == "__main__":
    main()
