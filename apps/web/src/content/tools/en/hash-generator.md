---
name: 'Hash Generator'
title: 'MD5, SHA-1, SHA-256, SHA-512 Hash Generator'
description: 'Calculate MD5, SHA-1, SHA-256, SHA-384, and SHA-512 hashes for text or files and verify checksums. Files are never uploaded.'
summary: 'MD5 and SHA hashes for text or files, verify checksums.'
category: 'developer'
idSlug: 'hash-md5-sha'
keywords: ['md5 generator', 'sha256', 'checksum', 'file hash', 'sha512', 'sha1']
howTo:
  - 'Choose Text or File, then type text or select files.'
  - 'MD5, SHA-1, SHA-256, SHA-384, and SHA-512 are calculated automatically.'
  - 'Paste a checksum from a download page to confirm the file is intact.'
faq:
  - q: 'Are my files uploaded?'
    a: 'No. Files are read in chunks and hashed in your browser, so even very large files never leave your device.'
  - q: 'How do I verify a downloaded file?'
    a: 'Select the file in the File tab, then paste the official checksum into Compare with a hash. Toolland tells you whether it matches and which algorithm.'
  - q: 'Is MD5 still safe?'
    a: 'MD5 and SHA-1 are no longer secure for cryptography, but they are still fine for detecting corrupted files. For security, use SHA-256 or higher.'
  - q: 'Can a hash be reversed to the original text?'
    a: 'No. Hashes are one-way. To store passwords, use a dedicated algorithm such as Argon2 or bcrypt, not a plain hash.'
related: ['base64-encode-decode']
---

## Make sure files are intact

A hash is a digital fingerprint: change one bit and the hash changes completely. That is why hashes are used to verify downloads, operating system images, and backups.
