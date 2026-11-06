---
name: 'WHOIS Lookup'
title: 'WHOIS Domain Lookup: Registrar, Expiry Date, and Name Servers'
description: 'Look up who registered a domain through which registrar, when it expires, its name servers, and status. Uses official registry RDAP data, free with no sign-up.'
summary: 'Registrar, expiry date, and name servers of a domain.'
category: 'developer'
processing: 'server'
idSlug: 'cek-whois'
keywords:
  [
    'whois',
    'domain lookup',
    'rdap',
    'domain expiry',
    'registrar lookup',
    'name servers',
    'check domain',
  ]
howTo:
  - 'Type a domain name, for example example.com. You can also paste a full address or an email.'
  - 'Click Check WHOIS. Toolland asks the official registry server for that domain.'
  - 'Read the registrar, registration and expiry dates, name servers, and status. Copy the result if needed.'
faq:
  - q: 'What are WHOIS and RDAP?'
    a: 'WHOIS is the registration data of a domain: its registrar, when it was registered, when it expires, and which name servers it uses. RDAP is the modern version of WHOIS set by ICANN, with structured data. Toolland queries RDAP straight from the registry, such as Verisign for .com.'
  - q: 'Why is the owner name not shown?'
    a: 'Most registries hide the name, address, and contact details of domain owners for privacy (rules such as GDPR). Toolland only shows data the registry publishes.'
  - q: 'My domain was not found. What does that mean?'
    a: 'The registry has no record of it, so the domain is most likely not registered and may still be available to buy. Also check the spelling.'
  - q: 'Which domain extensions are supported?'
    a: 'Every extension whose registry offers RDAP, including .com, .net, .org, .id, .co.id, and hundreds more. A few country extensions do not have RDAP yet, and Toolland will tell you so.'
  - q: 'Are the domains I look up stored?'
    a: 'They are not written to the logs. Results are kept in server RAM for at most 1 hour so the registry is not asked repeatedly, then deleted.'
related: ['json-formatter', 'hash-generator', 'base64-encode-decode']
---

## When to check WHOIS

- **Before buying a domain**: see whether the name you want is already taken.
- **Remembering renewal dates**: a domain you forget to renew can go offline and be taken by
  someone else. Toolland shows the days left until expiry and flags anything under 30 days.
- **Moving hosting or checking DNS**: confirm the name servers point to the right provider.
- **Checking a suspicious site**: a domain only a few days old that imitates a bank or shop name
  deserves caution.

## What domain statuses mean

A status such as _client transfer prohibited_ means the domain is locked against moving to another
registrar without the owner's approval. This is normal and protects the domain. _Redemption period_
or _pending delete_ means the domain has expired and will soon be released.
