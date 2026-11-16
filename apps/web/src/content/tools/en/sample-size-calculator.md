---
name: 'Sample Size Calculator'
title: 'Sample Size Calculator: Slovin, Cochran, Lemeshow, Krejcie-Morgan'
description: 'Calculate research sample size with the Slovin, Lemeshow, Cochran, and Krejcie-Morgan formulas, with step-by-step working and stratified allocation.'
summary: 'Calculate research sample size with full working.'
category: 'teks'
group: 'skripsi'
idSlug: 'kalkulator-sampel'
keywords:
  [
    'sample size calculator',
    'slovin formula',
    'cochran formula',
    'krejcie morgan',
    'lemeshow',
    'research sample size',
    'stratified sampling',
  ]
howTo:
  - 'Enter the population size, or choose Unknown if it cannot be counted. Set the confidence level and margin of error for your study.'
  - 'Compare the formulas, then click the one your thesis uses to see its working. Click Copy steps to paste it into your methodology chapter.'
  - 'For stratified random sampling, enter the name and size of each stratum. The sample per stratum is calculated automatically.'
faq:
  - q: 'Which formula should I use?'
    a: 'Follow your supervisor or the methodology book you cite. Slovin is common when the population size is known. Lemeshow is used when it is unknown, such as all users of an app. Krejcie-Morgan and Cochran give nearly identical results and are common in international journals.'
  - q: 'What margin of error is typical?'
    a: 'Social research usually uses 5% or 10%. A 5% margin is more precise but needs a larger sample.'
  - q: 'Why are results rounded up?'
    a: 'The formula gives the minimum sample size. Rounding down would fall below that minimum, so 79.2 becomes 80 respondents.'
  - q: 'What is the non-response allowance for?'
    a: 'Not every questionnaire comes back complete. With a 10% allowance, you send it to more people so the number collected still meets the minimum.'
  - q: 'Why does Krejcie-Morgan differ slightly from the published table?'
    a: 'The 1970 table does not round consistently. This calculator uses the same formula and always rounds up, so results can be one respondent higher.'
related: ['thesis-format-checker', 'word-counter', 'diff-checker']
---

## Sample size without calculation mistakes

A methodology chapter usually needs the sample size along with the formula and its working. This
calculator runs the four most common formulas at once so you can compare them, then copy the full
working with its legend.

## Formulas

- **Slovin**: n = N / (1 + N·e²).
- **Lemeshow**: n = Z²·p(1 − p) / e², for an unknown population.
- **Cochran**: Lemeshow with finite population correction.
- **Krejcie-Morgan**: the formula behind the Krejcie & Morgan (1970) table.

## Stratified allocation

With proportionate stratified random sampling, the sample is split in proportion to each stratum.
Rounding is balanced so the total always equals the sample size.
