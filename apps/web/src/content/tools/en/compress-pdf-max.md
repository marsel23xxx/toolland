---
name: 'Compress PDF Max'
title: 'Maximum PDF Compression (Ghostscript)'
description: 'The strongest PDF compression with Ghostscript on the server: images, fonts, and structure are optimized. Up to 15 MB, deleted right away.'
summary: 'The strongest PDF compression with Ghostscript.'
category: 'pdf'
processing: 'server'
idSlug: 'kompres-pdf-maksimal'
keywords: ['compress pdf max', 'reduce pdf size', 'ghostscript', 'shrink pdf']
howTo:
  - 'Choose or drag a PDF (up to 15 MB) into the box above.'
  - 'Choose a compression level, then wait for the server to process it.'
  - 'See how much was saved, then download the result.'
faq:
  - q: 'How is this different from Compress PDF?'
    a: 'Compress PDF runs in your browser and only recompresses photos. The max version uses Ghostscript on the server, which also optimizes fonts, non-photo images, and the PDF structure, so results are usually smaller.'
  - q: 'Is my file stored?'
    a: 'No. The file only exists in server RAM while it is processed and is deleted as soon as the result is sent to you, even if an error occurs. No copies, history, or reopenable links.'
  - q: 'Why is there a 15 MB limit?'
    a: 'To keep the server fast for everyone. For bigger PDFs, use Compress PDF, which runs in your browser without a size limit, or split the PDF first.'
  - q: 'Which level should I choose?'
    a: 'Medium suits documents read on screen. Light suits documents that will be printed. Strong gives the smallest size, for example for a 500 KB upload limit.'
related: ['compress-pdf', 'split-pdf', 'merge-pdf']
---

## When to use maximum compression

If browser compression is not small enough, for example for PDFs with complex vector graphics, many fonts, or design-app exports, Ghostscript can rebuild the whole PDF far more compactly.
