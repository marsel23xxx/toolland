---
name: 'Diff Checker'
title: 'Diff Checker & Plagiarism Check Between Two Documents'
description: 'Find differences between two texts, or check similarity (plagiarism) between two Word, PDF, or TXT documents. Matches are highlighted. Text stays on your device.'
summary: 'Find text differences or check plagiarism between two documents.'
category: 'teks'
idSlug: 'bandingkan-teks'
keywords:
  [
    'compare text',
    'text diff',
    'compare documents',
    'text comparison',
    'plagiarism checker',
    'document similarity',
    'compare two documents for plagiarism',
  ]
howTo:
  - 'Paste text or upload a file (TXT, Word, ODT, PDF) on the left and right.'
  - 'Use the Differences tab to see changes, or the Similarity Check tab to measure how similar two documents are.'
  - 'In Differences, green was added and red was removed. In Similarity Check, matching passages are highlighted in both documents.'
faq:
  - q: 'How do I check two documents for plagiarism?'
    a: 'Open the Similarity Check tab and paste or upload two documents. The tool calculates the share of identical content and highlights matching passages in both, even if paragraphs were reordered or capitalisation and punctuation changed.'
  - q: 'Is this the same as Turnitin?'
    a: 'No. It compares two documents with each other, such as two students’ assignments, not with the internet or a journal database. It is ideal for spotting copied work or comparing a draft with its source.'
  - q: 'Is my text sent to a server?'
    a: 'No. The comparison runs in your browser, so even confidential documents are safe to compare here.'
  - q: 'When should I compare by line, word, or character?'
    a: 'By line suits code and lists, by word suits documents and articles, and by character finds small typos.'
  - q: 'Can I compare source code?'
    a: 'Yes. Use line mode to see code changes the way git diff shows them.'
  - q: 'What about very long texts?'
    a: 'Long texts still work. If character mode would be too heavy, it stops automatically and suggests line mode.'
related: ['word-counter', 'json-formatter', 'case-converter']
---

## See exactly what changed

Revisions to a thesis, contract changes, or two versions of a config file: instead of rereading line by line, paste both versions and see what was added or removed.

## Plagiarism check between documents

The **Similarity Check** tab looks for identical runs of words in both documents (at least 5 in a
row by default), ignoring capitalisation, punctuation, and paragraph order. You get an overall
similarity percentage, the share of each document that matches, and a list of matching passages.
Click a highlighted passage to jump to its match in the other document.

Choose **Strict** sensitivity to catch lightly edited sentences, or **Loose** to ignore common
phrases that naturally repeat.
