---
name: 'Website Checker'
title: 'Website Checker: Security Grade, SSL, Headers, and Tech Stack'
description: 'Check website security (SSL, HTTPS, security headers, SPF, DMARC) with an A to F grade, plus the technology it runs on, such as WordPress, Laravel, or Next.js.'
summary: 'Security grade, SSL certificate, and tech stack of a site.'
category: 'developer'
processing: 'server'
idSlug: 'cek-website'
keywords:
  [
    'website checker',
    'website security check',
    'ssl checker',
    'security headers',
    'tech stack checker',
    'what is this site built with',
    'hsts check',
    'spf dmarc check',
  ]
howTo:
  - 'Type a domain, for example example.com. You can also paste a full address with https://.'
  - 'Click Check website. The Toolland server opens the home page once, like a normal visitor.'
  - 'Read the security grade, the list of checks with suggested fixes, the SSL certificate details, and the detected technology.'
faq:
  - q: 'What is checked?'
    a: 'HTTPS and the http redirect, the SSL certificate and TLS version, security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy), cookie flags, software version leaks, mixed content, security.txt, and the SPF, DMARC, and CAA DNS records.'
  - q: 'How is the A to F grade calculated?'
    a: 'Each check has a weight. Good earns full points, check this earns half, and problem earns zero. A score of 90 or more is an A. A site without https or with an invalid certificate gets an F straight away, because browsers already warn its visitors.'
  - q: 'Does this scan for vulnerabilities or attack the site?'
    a: "No. Toolland only opens the home page, the http address, and /.well-known/security.txt with ordinary requests, exactly like a visitor. There is no port scanning, vulnerability probing, or login attempt, so it is safe to use on anyone's site."
  - q: 'How is the technology detected?'
    a: 'From publicly visible traces: headers such as Server and X-Powered-By, cookie names, the generator meta tag, and script addresses in the HTML. Toolland recognises over 100 technologies. Anything the owner hides will not show up.'
  - q: 'Why can I not check a local site or an IP address?'
    a: 'For safety, Toolland refuses raw IP addresses and domains that point to a local or private network. Only public sites on the standard ports (80 and 443) can be checked.'
  - q: 'Are the sites I check stored?'
    a: 'They are not written to the logs. Results are kept in server RAM for at most 10 minutes so the same site is not opened repeatedly, then deleted.'
related: ['whois-lookup', 'subdomain-finder', 'hash-generator']
---

## When to check a website

- **After building a site or moving hosts**: confirm https, the redirect, and security headers
  are set up correctly.
- **Before the certificate runs out**: Toolland shows the days left on the SSL certificate and
  flags anything under 14 days.
- **Checking domain email**: without SPF and DMARC, anyone can easily send fake email from your
  domain.
- **Curious what another site is built with**: see the CMS, framework, hosting, CDN, and even the
  analytics and payment tools in use.

## What each status means

**Good** means the setting follows best practice. **Check this** means it can be strengthened,
with the suggested fix written right below. **Problem** should be fixed soon. **Info** covers
optional settings that do not affect the grade.
