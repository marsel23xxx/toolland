---
name: 'Validity & Reliability Test'
title: "Questionnaire Validity and Reliability Test Online (Cronbach's Alpha)"
description: "Test questionnaire validity and reliability without SPSS: paste data from Excel and get item-total r, critical r, Cronbach's alpha, and a ready-to-use interpretation."
summary: "Item validity and Cronbach's alpha without SPSS."
category: 'teks'
group: 'skripsi'
idSlug: 'uji-validitas-reliabilitas'
keywords:
  [
    'validity test',
    'reliability test',
    'cronbach alpha calculator',
    'item total correlation',
    'questionnaire validity',
    'without spss',
  ]
howTo:
  - 'Select the questionnaire scores in Excel or Google Sheets (rows = respondents, columns = items), copy them, and paste them into the data box.'
  - 'Set the significance level, correlation type, and alpha cutoff. With column names like X1.1, X1.2, Y.1, each variable is tested separately.'
  - 'Read the calculated r, critical r, and alpha for each item. Copy the table and interpretation, or download everything as Excel.'
faq:
  - q: 'Are the results the same as SPSS?'
    a: "Yes. Calculated r is the Pearson correlation of each item with the total score, as in Correlate → Bivariate. Corrected item-total and Cronbach's alpha match Reliability Analysis, including alpha if item deleted."
  - q: 'Pearson item-total or corrected item-total?'
    a: 'Pearson item-total correlates the item with a total that includes it. Corrected item-total removes the item from the total, so it is stricter. Use the one your supervisor or reference requires.'
  - q: 'What happens to invalid items?'
    a: "They are flagged and named in the interpretation, and Cronbach's alpha is recalculated without them."
  - q: 'Is my data uploaded?'
    a: 'No. Everything runs in your browser. Pasted data is only kept in your browser so it survives a reload. Click Clear to remove it.'
related: ['statistical-tables', 'citation-generator', 'sample-size-calculator']
---

## Test your research instrument without SPSS

Questionnaire data must be shown to be valid and reliable before analysis. This tool gives the
same results as SPSS right in your browser: copy the data from Excel and paste it.

## What it calculates

- **Validity**: calculated r for each item against critical r (df = N − 2), with Sig.
- **Reliability**: Cronbach's alpha for all items and for valid items only, plus alpha if item
  deleted.
- **Interpretation**: a ready-to-paste paragraph with the critical r, invalid items, and alpha.
