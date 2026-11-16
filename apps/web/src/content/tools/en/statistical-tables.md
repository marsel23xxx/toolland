---
name: 'Statistical Tables'
title: 'Critical Value Tables: r, t, F, and Chi-Square'
description: 'Find critical values of r, t, F, and chi-square for any degrees of freedom and significance level. Compare with your statistic, then download Excel or PDF tables.'
summary: 'Find critical r, t, F, and chi-square values.'
category: 'teks'
group: 'skripsi'
idSlug: 'tabel-statistik'
keywords:
  [
    't table',
    'f table',
    'chi square table',
    'pearson r critical values',
    'critical value calculator',
    'degrees of freedom',
    'statistical tables',
  ]
howTo:
  - 'Pick a table: r, t, F, or chi-square. Enter the sample size (for r) or degrees of freedom, then choose the significance level.'
  - 'The critical value appears immediately. Enter your calculated statistic to see whether it is significant, with the p-value.'
  - 'Set the df range of the full table, then copy it or download it as Excel or PDF for your appendix.'
faq:
  - q: 'How do I read the r table?'
    a: 'Compute df = N − 2, where N is the number of respondents. For N = 30, df = 28 and the critical r at α 0.05 two-tailed is 0.3610. Here you just enter N.'
  - q: 'One-tailed or two-tailed?'
    a: 'Use two-tailed when the hypothesis only states an effect or relationship. Use one-tailed when it states a direction, such as a positive effect.'
  - q: 'Which df do I use for regression?'
    a: 'With n observations and k predictors, the partial t test uses df = n − k − 1 and the overall F test uses df1 = k and df2 = n − k − 1.'
  - q: 'Do the values match printed tables?'
    a: 'Yes. Values are computed from the distribution formulas with high precision, so they match printed tables to the last digit shown, for any df.'
related: ['validity-reliability-test', 'sample-size-calculator', 'thesis-format-checker']
---

## Every statistical table in one place

Validity tests, t tests, F tests, and chi-square tests all need critical values. Instead of a PDF
with a limited number of rows, this tool computes critical values for any df and significance
level.

## Tables

- **Pearson r**: for questionnaire validity and correlation tests, with df = N − 2.
- **t**: for one-sample, paired, independent, and regression t tests.
- **F**: for regression and ANOVA, at α 0.10, 0.05, 0.025, and 0.01.
- **Chi-square**: for tests of independence and goodness of fit.
