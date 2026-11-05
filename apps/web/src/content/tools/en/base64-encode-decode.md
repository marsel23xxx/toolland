---
name: 'Base64 & URL Encode'
title: 'Base64 Encode/Decode, URL Encode, and Image to Base64'
description: 'Encode and decode Base64 (UTF-8, URL-safe), URL-encode text, or turn images into Base64 Data URLs. One page, free, processed in your browser.'
summary: 'Base64, URL encoding, and image to Data URL.'
category: 'developer'
idSlug: 'base64-encode-decode'
keywords: ['base64 encoder', 'base64 decoder', 'url encode', 'url decode', 'image to base64', 'data url', 'encodeURIComponent']
howTo:
  - 'Choose a tab: Text ↔ Base64, URL encode, or Image to Base64.'
  - 'Type, paste, or drop an image. The result appears immediately.'
  - 'Copy the result, or click Swap to process it back.'
faq:
  - q: 'Is Base64 encryption?'
    a: 'No. Base64 only turns data into letters and numbers so it can travel as text. Anyone can decode it, so never use it to hide secrets.'
  - q: 'What is URL-safe Base64?'
    a: 'A variant that replaces + with - and / with _ and drops the = padding, so it is safe in URLs and tokens such as JWT.'
  - q: 'What is the difference between URL component and full URL?'
    a: 'Component mode (encodeURIComponent) encodes every special character including / ? & =, which suits parameter values. Full URL mode (encodeURI) keeps the URL structure intact.'
  - q: 'When should I use Base64 images?'
    a: 'For icons and small images (roughly under 10 KB), HTML emails, or JSON data. Base64 is about 33% larger than the original file.'
  - q: 'Is my data sent to a server?'
    a: 'No. Everything runs in your browser.'
related: ['hash-generator', 'json-formatter', 'qr-code-generator']
---

## Encoding and decoding in one place

Base64 appears in email, HTTP headers, JWT tokens, and config files. URL encoding makes spaces and special
characters safe in links. Base64 images let you embed small icons directly in CSS or HTML. All three live on
this page.
