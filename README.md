<div align="center">

<img src="assets/brand-preview.svg" alt="NPVT Terminal Converter social preview" width="100%" />

# 🟢 NPVT Terminal Converter

### A colorful offline terminal-style converter for NPVT files and V2Ray links.

<p>
  <img alt="Single HTML" src="https://img.shields.io/badge/Single_HTML-Portable-39ff88?style=for-the-badge&labelColor=06140b">
  <img alt="Offline" src="https://img.shields.io/badge/Offline-Local_First-00d46a?style=for-the-badge&labelColor=06140b">
  <img alt="No Upload" src="https://img.shields.io/badge/No_Server-Browser_Only-b8ffd2?style=for-the-badge&labelColor=06140b">
  <img alt="Theme" src="https://img.shields.io/badge/UI-Green_Terminal-39ff88?style=for-the-badge&labelColor=06140b">
</p>

<p>
  <a href="#-features">Features</a> ·
  <a href="#-quick-start">Quick Start</a> ·
  <a href="#-supported-inputs">Supported Inputs</a> ·
  <a href="#-privacy">Privacy</a> ·
  <a href="#-brand-style">Brand Style</a>
</p>

</div>

---

## ✨ Overview

**NPVT Terminal Converter** is a polished single-file HTML tool for converting supported NPVT, JSON, raw text, and Base64 subscription data into V2Ray-style links — plus a reverse converter that builds a portable NPVT-style bundle from pasted links.

It is designed like a small cyber-terminal utility: dark glass panels, green glow, clean protocol chips, animated sections, drag-and-drop import, keyboard shortcuts, and a floating bubble menu.

> Built for local use. Open `index.html`, convert, copy, download. No backend required.

---

## 🚀 Features

<table>
<tr>
<td width="50%">

### 🧩 Two-way conversion

- NPVT / JSON / subscription → V2Ray links
- V2Ray links → NPVT-style bundle
- Supports multiple links at once

</td>
<td width="50%">

### 🖥️ Terminal-grade UI

- Green cyber-terminal theme
- Animated right-side bubble menu
- Responsive desktop/mobile layout

</td>
</tr>
<tr>
<td width="50%">

### 📂 Local file workflow

- Drag-and-drop file import
- Fallback file picker
- Copy and download output

</td>
<td width="50%">

### ⌨️ Fast shortcuts

- Press `Enter` to convert
- Use `Shift + Enter` for a new line
- Clear table, logs, and panels quickly

</td>
</tr>
</table>

---

## ⚡ Quick Start

```bash
# Clone the repository
git clone https://github.com/TheLouisMahdi/npvt-terminal-converter.git

# Open the project folder
cd npvt-terminal-converter

# Open index.html in your browser
```

Or simply download the repository and double-click:

```text
index.html
```

---

## 📥 Supported Inputs

### NPVT / File to V2Ray Links

The first converter can read supported local files and scan for links from:

- `.npvt` files compatible with the supported NPVT-style structure
- JSON exports
- Raw text files containing V2Ray-style links
- Base64 subscription text
- Mixed files containing multiple configs

### V2Ray Links to NPVT-style Bundle

The second converter accepts links such as:

```text
vless://...
vmess://...
trojan://...
ss://...
```

Then it generates a downloadable local bundle.

---

## 🎨 Brand Style

This repository now uses a strong visual identity:

| Element | Style |
|---|---|
| Main color | Neon green |
| Background | Deep black / dark terminal |
| Mood | Clean cyber utility |
| Typography | Code editor / monospace feel |
| Signature | `TheLouisMahdi` |

Recommended GitHub social preview prompt is available in:

```text
docs/SOCIAL_PREVIEW_PROMPT.md
```

---

## 🔐 Privacy

Everything runs locally inside your browser. The project does not need a backend server for the conversion workflow.

For public bug reports or screenshots, replace real connection details with dummy values.

---

## 🗂️ Repository Structure

```text
npvt-terminal-converter/
├── assets/
│   └── brand-preview.svg
├── docs/
│   ├── BRAND_GUIDE.md
│   └── SOCIAL_PREVIEW_PROMPT.md
├── index.html
├── README.md
├── LICENSE
├── CHANGELOG.md
├── SECURITY.md
├── CONTRIBUTING.md
└── .github/
    └── ISSUE_TEMPLATE/
```

---

## 🌐 Browser Support

Recommended browsers:

- Google Chrome
- Microsoft Edge
- Firefox
- Brave

The app uses modern browser APIs such as FileReader, Blob, TextEncoder, TextDecoder, and clipboard access.

---

## 👤 Author

<div align="center">

Made with a green terminal soul by **Mahdi Gh**  
GitHub: [TheLouisMahdi](https://github.com/TheLouisMahdi)

</div>

---

## 📄 License

This project is released under the MIT License.
