---
name: 'Encrypt File & Text'
title: 'Encrypt Files and Text with a Password (AES-256)'
description: 'Turn text or a file into a password-locked code. The recipient opens it on Toolland. Runs in your browser, nothing is sent to a server.'
summary: 'Lock text or files into a password-protected code.'
category: 'developer'
idSlug: 'kunci-file'
keywords:
  [
    'encrypt file',
    'encrypt text',
    'password protect file',
    'send file securely',
    'secret message',
    'aes',
    'decrypt',
  ]
howTo:
  - 'Choose Text or File, then enter text or select the file to lock.'
  - 'Use the generated password or type your own, then press Lock now.'
  - 'Send the code or .toolland file to the recipient and share the password through another channel. They open it in the Unlock tab.'
faq:
  - q: 'Is my data sent to Toolland servers?'
    a: 'No. Locking and unlocking happen in your browser. The data only exists inside the code or .toolland file you send yourself, so Toolland stores nothing and cannot see anything.'
  - q: 'How secure is the code?'
    a: 'Data is encrypted with AES-256-GCM, and the password goes through 600,000 rounds of PBKDF2-SHA256 so guessing it is very slow. Strength depends on the password: the generated one is strong, a short one like a birthday is easy to guess.'
  - q: 'Why is the result sometimes a file instead of a code?'
    a: 'The code is as long as the data. Text and small files (about 40 KB) fit as a code you can paste into chat. Larger files become a .toolland file you can send by WhatsApp or email.'
  - q: 'What if I forget the password?'
    a: 'Nobody can open the data again, including Toolland, because the password is never stored. Write it down somewhere safe before sending the code.'
  - q: 'How should I share the password?'
    a: 'Use a different channel from the code, for example the code by email and the password by phone or a separate message. Someone who sees only one message cannot open the data.'
  - q: 'Is there a file size limit?'
    a: 'Up to 200 MB per file, so phones do not run out of memory. Larger files take longer to lock on your device.'
related: ['hash-generator', 'base64-encode-decode']
---

## Send sensitive data without leaks

Account numbers, ID photos, or contracts often get sent over chat and stay in the message history
forever. With Encrypt File & Text, only a random-looking code is sent. The content can only be
read by someone who knows the password.

- **Text**: a short message becomes a code you can paste into WhatsApp, Telegram, or email.
- **Files**: photos, PDFs, or documents are locked into a `.toolland` file.
- **No account and no server**: nothing is uploaded, so nothing can leak from our servers.

## Staying safe

Use the generated password or a long one of your own. Never send the password in the same
message as the code. Once the recipient has opened the data, you can delete the message with the
code from your chat.
