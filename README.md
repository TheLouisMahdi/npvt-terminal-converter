# NPVT Terminal Converter

A clean, offline, terminal-inspired converter for working with NPVT files and V2Ray links directly inside the browser.

The app is a single-file HTML tool with a green cyber-terminal interface, animated sections, drag-and-drop file handling, keyboard shortcuts, and a floating bubble menu.

> Built for local use. No server, no upload, no external dependency.

## Features

- Convert `.npvt`, exported JSON, raw link files, and Base64 subscriptions into V2Ray-compatible links.
- Convert V2Ray links back into an encrypted NPVT1-style bundle.
- Works completely offline by opening `index.html` in a browser.
- Drag-and-drop file import with fallback file picker.
- Separate conversion panels for both directions.
- Copy, download TXT, and download Base64 subscription outputs.
- Clear buttons for inputs, output, logs, and result tables.
- Enter-to-convert shortcut.
- Animated right-side bubble navigation menu.
- Terminal/code-inspired green UI.
- Small footer credit for `TheLouisMahdi`.

## Supported Input Types

### NPVT / File to V2Ray Links

The first converter can handle:

- `.npvt` files using the NPVT1-style structure supported by this tool
- NapsternetV / NPV Tunnel-style exported JSON files
- Raw text files containing V2Ray links
- Base64 subscription text
- Mixed files containing multiple configs

### V2Ray Links to NPVT

The second converter accepts one or more links such as:

- `vless://`
- `vmess://`
- `trojan://`
- `ss://`

It then creates a downloadable encrypted NPVT1-style bundle.

## Privacy

Everything runs locally inside your browser. The tool does not send files, links, configs, or generated output to any server.

## Usage

1. Download or clone this repository.
2. Open `index.html` in any modern browser.
3. Use the first panel to import NPVT/JSON/subscription files and extract V2Ray links.
4. Use the second panel to paste V2Ray links and generate an NPVT file.
5. Press `Enter` to run the active conversion.
6. Press `Shift + Enter` inside text areas to insert a new line.

## Repository Structure

```text
npvt-terminal-converter/
├── index.html
├── README.md
├── LICENSE
├── CHANGELOG.md
├── SECURITY.md
├── CONTRIBUTING.md
├── REPO_DETAILS.md
└── .github/
    └── ISSUE_TEMPLATE/
        ├── bug_report.md
        └── feature_request.md
```

## Browser Support

Recommended browsers:

- Google Chrome
- Microsoft Edge
- Firefox
- Brave

The app uses modern browser APIs such as FileReader, Blob, TextEncoder, TextDecoder, and clipboard access.

## Notes

NPVT compatibility can vary depending on the app version and the exact encryption/export format used by the source client. If a newer NPVT variant changes its structure, decryption may not work until the parser is updated.

## Author

Created for **Mahdi Gh**.

GitHub: [TheLouisMahdi](https://github.com/TheLouisMahdi)

## License

This project is released under the MIT License.
