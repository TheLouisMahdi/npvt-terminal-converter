# Offline Known-Passphrase Batch Dialog

This feature verifies **only exact creator passphrases already supplied by the user**. It does not generate new guesses, fetch remote password lists, scan services, or claim to recover unknown encryption keys.

## Workflow

1. Open `Index.html` or the standalone `mobile.html`.
2. Click **Known passphrases · batch** in the converter.
3. Paste existing passphrases, **one exact value per line**, or select an existing plaintext `.txt` containing the list.
4. Select **Use these passphrases**. The input textarea is erased from the page. The unique values stay in the current tab's runtime memory only.
5. Choose/drag up to 80 NPVS files. Each creator-passphrase file is checked automatically with the provided values. Successful matching permits the existing authenticated profile converter to run. A valid password for one file is promoted first for later files.
6. See the count-only progress, choose **Stop current scan** to stop after the current password-derivation operation, or choose **Forget list** to remove saved values from the app state. The main **Reset** also forgets the list.

The original one-file **Optional single NPVS creator passphrase** input is still supported; when both that field and the list are present, the single value is tested first, with deduplication.

## Security and correctness

- Only explicit user values are tested, in their provided form. Leading/trailing spaces **are significant**; blank lines and duplicate values are skipped. Passwords are neither fabricated nor mutated.
- Strict limits: 16 KB input, 128 unique values, 256 characters/value, 1 MiB/source file, 80 files/import.
- Match verification checks the **ChaCha20-Poly1305 authentication tag of the wrapped content key** after the actual PBKDF2-SHA256 computation. Wrong keys do not produce decrypted content.
- Supported: NPVS Gen-1 and Gen-2 creator-passphrase exports with compatible KDF and envelope structure. Gen-2 AppKey and recipient private-key exports are **not** password-based and remain on their independent authorized-key paths.
- Progress and errors never display a guessed/matched password. Results are not persisted, uploaded or written into logs. The standalone HTML continues to function without a network connection.
- Passwords remain JavaScript strings in tab memory. Browser runtimes do not guarantee that immutable strings are physically zeroed when cleared. Therefore this is **best-effort session-only storage**, not a hardened secure vault. Do not use this feature on untrusted/shared browsers.
- No universal recovery claim: if no supplied password matches, the source stays locked and inspection-only. Unsupported or damaged files are not treated as successful decryptions.
- PBKDF2 with hundreds of thousands of iterations may be slow for larger lists. Checks run serially to keep the browser usable and support cancellation between attempts.

## Acceptance coverage

Automated tests use **synthetic test-only files** to check Gen-1/Gen-2 matching, negative keys, cancellation, per-session list validation, separate AppKey/private-key methods, standalone mobile modal and browser TXT import/batch use. Neither the user's NPVS samples nor any real passphrases are stored in this repository.

Implementation: `tools/npvs-known-passphrases.js`, inlined into `Index.html` and generated `mobile.html`.
