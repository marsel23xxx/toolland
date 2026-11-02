/**
 * Editor CodeMirror 6 minimal. Modul ini hanya dimuat lewat import() dinamis
 * oleh CodeEditor.vue, sehingga tidak masuk JavaScript awal halaman.
 */
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder,
} from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

// Warna dari variabel CSS di global.css, sehingga ikut mode gelap/terang.
const highlight = HighlightStyle.define([
  { tag: t.propertyName, color: 'var(--cm-property)' },
  { tag: t.string, color: 'var(--cm-string)' },
  { tag: t.number, color: 'var(--cm-number)' },
  { tag: [t.bool, t.null], color: 'var(--cm-keyword)' },
  { tag: [t.brace, t.squareBracket, t.separator], color: 'var(--cm-punctuation)' },
]);

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px', backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'var(--cm-gutter)' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--cm-active-line)' },
  '.cm-cursor': { borderLeftColor: 'currentColor' },
  '.cm-placeholder': { color: 'var(--cm-placeholder)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--cm-selection) !important',
  },
});

export interface EditorOptions {
  doc: string;
  language?: 'json' | 'plain';
  placeholder?: string;
  label: string;
  onChange: (value: string) => void;
}

/**
 * Editor dipasang di dalam Shadow DOM: di sana CodeMirror memakai constructable
 * stylesheet (adoptedStyleSheets) yang tidak diblokir CSP, bukan tag <style> inline.
 */
export function createEditor(host: HTMLElement, o: EditorOptions): EditorView {
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  const parent = document.createElement('div');
  parent.style.height = '100%';
  root.append(parent);
  return new EditorView({
    root,
    parent,
    state: EditorState.create({
      doc: o.doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        foldGutter(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        highlightActiveLine(),
        syntaxHighlighting(highlight),
        keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, indentWithTab]),
        o.language === 'json' ? json() : [],
        o.placeholder ? placeholder(o.placeholder) : [],
        EditorView.contentAttributes.of({ 'aria-label': o.label }),
        EditorView.lineWrapping,
        theme,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) o.onChange(u.state.doc.toString());
        }),
      ],
    }),
  });
}

/** Ganti seluruh isi editor tanpa memicu loop update. */
export function setEditorText(view: EditorView, text: string): void {
  if (view.state.doc.toString() === text) return;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
}
