---
name: 'JSON to CSV'
title: 'Convert JSON to CSV and CSV to JSON'
description: 'Convert JSON to CSV for Excel or Google Sheets, and back. Supports comma, semicolon, and tab delimiters. Free and private.'
summary: 'Convert JSON to CSV for Excel, and back.'
category: 'developer'
idSlug: 'json-ke-csv'
keywords: ['json to csv', 'csv to json', 'json to excel', 'convert csv']
howTo:
  - 'Choose the direction: JSON to CSV or CSV to JSON.'
  - 'Paste your data or click Open file to choose a .json or .csv file.'
  - 'Copy the result or download it as a new file.'
faq:
  - q: 'Why does my CSV look wrong in Excel?'
    a: 'Excel in some regions uses a semicolon as the separator. Choose Semicolon (;) before downloading so columns open correctly.'
  - q: 'What about nested JSON?'
    a: 'Nested objects are flattened into dotted columns such as address.city. Arrays are stored as JSON text in one cell.'
  - q: 'Are data types detected when converting CSV to JSON?'
    a: 'Yes. Numbers and true/false values become numbers and booleans, not strings.'
  - q: 'Is my file uploaded?'
    a: 'No. Files are read and converted in your browser.'
related: ['json-formatter', 'diff-checker', 'hash-generator']
---

## A bridge between APIs and spreadsheets

API data usually comes as JSON, while finance and operations teams prefer spreadsheets. Convert between the two without writing a script.
