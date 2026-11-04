---
name: 'UUID Generator'
title: 'UUID v4 and v7 Generator'
description: 'Generate random UUID v4 or time-ordered UUID v7, up to 1,000 at once, using your browser’s cryptographic random generator.'
summary: 'Generate UUID v4 or v7, up to 1,000 at once.'
category: 'developer'
idSlug: 'generator-uuid'
keywords: ['uuid generator', 'guid generator', 'uuid v4', 'uuid v7', 'random uuid']
howTo:
  - 'Choose the UUID version and how many you need.'
  - 'Pick a format: uppercase or without hyphens if needed.'
  - 'Copy all UUIDs or download them as a .txt file.'
faq:
  - q: 'What is the difference between UUID v4 and v7?'
    a: 'UUID v4 is fully random. UUID v7 starts with its creation time, so values sort in order, which keeps database indexes efficient as primary keys.'
  - q: 'Are the UUIDs really unique?'
    a: 'They are generated with the browser’s cryptographic random generator (crypto.randomUUID and crypto.getRandomValues). The chance of a collision is negligible.'
  - q: 'Is a UUID the same as a GUID?'
    a: 'Yes. GUID is Microsoft’s name for a UUID; the format is the same.'
  - q: 'Are the UUIDs logged by Toolland?'
    a: 'No. They are generated in your browser and never sent anywhere.'
related: ['password-generator', 'hash-generator', 'lorem-ipsum']
---

## Unique IDs without coordination

A UUID is a 128-bit identifier that can be created anywhere without a central server, which makes it ideal for database IDs, file names, transaction IDs, and test data.
