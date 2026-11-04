---
name: 'Regex Tester'
title: 'Online Regex Tester (JavaScript)'
description: 'Test JavaScript regular expressions with live match highlighting, capture groups, and replace. Safe from regexes that freeze the browser.'
summary: 'Test regular expressions with highlights and groups.'
category: 'developer'
idSlug: 'regex-tester'
keywords: ['regex', 'regular expression', 'regexp tester', 'javascript regex']
howTo:
  - 'Write a regex pattern and choose the flags you need.'
  - 'Paste test text. Matches are highlighted along with their capture groups.'
  - 'Enable Replace with to try replacements using $1 or $<name>.'
faq:
  - q: 'Which regex flavor is used?'
    a: 'JavaScript (ECMAScript) regex built into the browser, exactly the same as in your JavaScript and TypeScript code.'
  - q: 'What if a regex runs forever?'
    a: 'Regexes run in a separate Web Worker with a 1-second limit. If it is exceeded, the run is stopped and the page stays responsive.'
  - q: 'What do the g, i, m, s, u, and y flags mean?'
    a: 'g finds all matches, i ignores case, m makes ^ and $ work per line, s lets the dot match newlines, u enables Unicode, and y matches only at the last position.'
  - q: 'How do I use named groups?'
    a: 'Write (?<name>pattern), then use $<name> in the replacement field. Named group values are also listed under each match.'
related: ['url-encode-decode', 'json-formatter', 'diff-checker']
---

## Test regexes before shipping them

Regular expressions are easy to get wrong. Live highlighting and a list of capture groups show exactly what matches before you use the pattern for validation or data processing.
