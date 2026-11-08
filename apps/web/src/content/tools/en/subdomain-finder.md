---
name: 'Subdomain Finder'
title: 'Subdomain Finder: Find All Subdomains of a Domain Online'
description: 'Find the subdomains of any domain (api, mail, staging, and more) from public SSL certificate logs. Passive, never scans the target server, free with no sign-up.'
summary: 'List subdomains from public SSL certificate logs.'
category: 'developer'
processing: 'browser'
idSlug: 'cari-subdomain'
keywords:
  [
    'subdomain finder',
    'find subdomains',
    'subdomain lookup',
    'subdomain scanner',
    'certificate transparency',
    'crt.sh',
    'subdomain enumeration',
  ]
howTo:
  - 'Type a domain name, for example example.com. A full URL or an email also works.'
  - 'Click Find subdomains. Your browser fetches the data from public SSL certificate logs (crt.sh).'
  - 'Filter the list if needed, then copy it or download it as TXT or CSV.'
faq:
  - q: 'Where does this subdomain list come from?'
    a: 'From Certificate Transparency logs, the public record of every SSL certificate ever issued. Whenever a subdomain uses HTTPS, its name is logged there. Toolland reads them through crt.sh, with Certspotter as a fallback when crt.sh is not responding.'
  - q: 'Does this tool scan or attack the target server?'
    a: 'No. The search is passive: it only reads public certificate records and never contacts the servers of the domain. That makes it safe to use for mapping your own assets or for security research.'
  - q: 'Why are some subdomains missing?'
    a: 'Subdomains that never had their own SSL certificate are not logged, for example ones covered only by a wildcard certificate (*.example.com) or used only on an internal network. Old, inactive subdomains may still appear because the log is permanent.'
  - q: 'Why is it limited to 10 searches per hour?'
    a: 'The data comes from free public services run by others. The limit keeps those services from being overloaded so everyone can keep using them. A domain you already searched on the same page can be reopened without using your quota.'
  - q: 'Does Toolland store the domains I search?'
    a: 'No. Searches do not go through Toolland servers: your browser contacts crt.sh (or Certspotter) directly, so only that service sees the domain name. Toolland only keeps your search quota count in your browser.'
related: ['whois-lookup', 'json-formatter', 'hash-generator']
---

## When do you need a subdomain list?

- **Mapping your own assets**: companies often forget old subdomains such as _staging_ or _dev_
  that are still online. This list helps you find them before someone else does.
- **Security research and bug bounties**: the first step of an authorized test is usually mapping
  every subdomain of the target.
- **Moving hosts or renewing certificates**: make sure no subdomain is left behind.

## What the date next to a subdomain means

It shows when the latest certificate for that name expires. If it is still valid, the subdomain is
most likely still active. If it expired long ago, the subdomain may be unused, but it is still
worth checking so nobody else can abuse it.
