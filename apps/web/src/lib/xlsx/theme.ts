/**
 * Tema Office minimal. Excel memakai tema untuk warna dan font bawaan; semua warna template
 * Toolland ditulis langsung (RGB), jadi tema ini hanya pelengkap agar file sah.
 */
const clr = (tag: string, hex: string) => `<a:${tag}><a:srgbClr val="${hex}"/></a:${tag}>`;
const fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
const line = (w: number) =>
  `<a:ln w="${w}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>`;
const fonts = (latin: string) =>
  `<a:latin typeface="${latin}" panose="020F0502020204030204"/><a:ea typeface=""/><a:cs typeface=""/>`;

export const THEME_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Toolland">' +
  '<a:themeElements>' +
  '<a:clrScheme name="Toolland">' +
  '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>' +
  '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
  clr('dk2', '1E1A15') +
  clr('lt2', 'F4EFE6') +
  clr('accent1', '983C09') +
  clr('accent2', '2F4A7A') +
  clr('accent3', 'C28A12') +
  clr('accent4', '3D6B3F') +
  clr('accent5', '8E2F4F') +
  clr('accent6', '5F574C') +
  clr('hlink', '2F4A7A') +
  clr('folHlink', '8E2F4F') +
  '</a:clrScheme>' +
  `<a:fontScheme name="Toolland"><a:majorFont>${fonts('Calibri Light')}</a:majorFont><a:minorFont>${fonts('Calibri')}</a:minorFont></a:fontScheme>` +
  '<a:fmtScheme name="Toolland">' +
  `<a:fillStyleLst>${fill}${fill}${fill}</a:fillStyleLst>` +
  `<a:lnStyleLst>${line(6350)}${line(12700)}${line(19050)}</a:lnStyleLst>` +
  '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
  `<a:bgFillStyleLst>${fill}${fill}${fill}</a:bgFillStyleLst>` +
  '</a:fmtScheme>' +
  '</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/>' +
  '</a:theme>';
