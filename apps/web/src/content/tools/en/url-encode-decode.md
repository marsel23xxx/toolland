---
name: 'URL Encode'
title: 'URL Encode and Decode Online'
description: 'Encode text so it is safe in URLs and query strings, or decode URLs containing %20 and similar sequences. Free and in your browser.'
summary: 'Encode and decode text for URLs and query strings.'
category: 'developer'
idSlug: 'url-encode-decode'
keywords: ['url encoder', 'url decoder', 'percent encoding', 'encodeURIComponent']
howTo:
  - 'Choose Encode or Decode.'
  - 'Type or paste text or a URL. The result appears immediately.'
  - 'Copy the result for your link or code.'
faq:
  - q: 'What is the difference between URL component and full URL?'
    a: 'Component mode (encodeURIComponent) encodes every special character including / ? & =, which suits parameter values. Full URL mode (encodeURI) keeps the URL structure intact.'
  - q: 'Why does a space become %20 or +?'
    a: 'The URL standard uses %20 for spaces; old HTML forms use +. When decoding form data, enable Treat + as a space.'
  - q: 'Why does decoding fail?'
    a: 'There is a % not followed by two valid hexadecimal digits, such as %G1 or a % at the end.'
  - q: 'Is my data sent to a server?'
    a: 'No. Encoding and decoding run in your browser.'
related: ['base64-encode-decode', 'regex-tester', 'qr-code-generator']
---

## Why encode URLs?

URLs may only contain certain characters. Spaces, accented letters, and characters like & or = inside parameter values must be percent-encoded or the link breaks.
