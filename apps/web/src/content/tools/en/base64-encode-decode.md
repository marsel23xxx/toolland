---
name: 'Base64'
title: 'Base64 Encode and Decode Online'
description: 'Encode text to Base64 or decode Base64 to text, with full UTF-8 and URL-safe support. Free, instant, and processed in your browser.'
summary: 'Encode and decode Base64, UTF-8 and URL-safe.'
category: 'developer'
idSlug: 'base64-encode-decode'
keywords: ['base64 encoder', 'base64 decoder', 'base64 url safe', 'decode base64']
howTo:
  - 'Choose Encode or Decode.'
  - 'Type or paste text. The result appears on the right immediately.'
  - 'Copy the result, or click Swap to process it back.'
faq:
  - q: 'Is Base64 encryption?'
    a: 'No. Base64 only turns data into letters and numbers so it can travel as text. Anyone can decode it, so never use it to hide secrets.'
  - q: 'What is URL-safe Base64?'
    a: 'A variant that replaces + with - and / with _ and drops the = padding, so it is safe in URLs and tokens such as JWT.'
  - q: 'Are emoji and non-Latin scripts supported?'
    a: 'Yes. Text is converted to UTF-8 first, so emoji and scripts like 日本 stay intact after decoding.'
  - q: 'Why do I get an invalid Base64 message?'
    a: 'The input contains characters outside the Base64 alphabet, has a wrong length, or decodes to binary data rather than UTF-8 text.'
related: ['url-encode-decode', 'hash-generator', 'json-formatter']
---

## Where is Base64 used?

Base64 appears in email attachments, HTTP Basic Auth headers, JWT tokens, and config files. This tool helps you read and create Base64 values quickly while debugging.
