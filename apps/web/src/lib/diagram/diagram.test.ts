import { Cell, Geometry, GraphDataModel, ModelXmlSerializer, Point } from '@maxgraph/core';
import { deflateSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  DrawioError,
  modelOptions,
  modelToXml,
  readDrawio,
  styleToString,
  toDrawioFile,
} from './drawio';
import { FLOWCHART, GENERAL, LIBRARY, searchLibrary } from './library';
import { STENCILS } from './stencils';

describe('style ke string .drawio', () => {
  it('nama gaya dulu, lalu kunci=nilai; boolean jadi 1/0', () => {
    expect(
      styleToString({
        baseStyleNames: ['text'],
        rounded: true,
        dashed: false,
        fontSize: 12,
        fillColor: '#fff',
      }),
    ).toBe('text;rounded=1;dashed=0;fontSize=12;fillColor=#fff;');
    expect(styleToString({ autoSize: true })).toBe('autosize=1;');
    expect(styleToString({ ignoreDefaultStyle: true, shape: 'ellipse' })).toBe(';shape=ellipse;');
    expect(styleToString(null)).toBe('');
  });
});

/** Model kecil: dua shape, satu garis (id kosong seperti buatan ConnectionHandler). */
function sampleModel(): GraphDataModel {
  const model = new GraphDataModel();
  const layer = model.getRoot()!.getChildAt(0);
  const a = new Cell('Mulai & "uji"', new Geometry(10, 20, 120, 50), {
    rounded: true,
    arcSize: 50,
  });
  a.setVertex(true);
  const b = new Cell('Proses<br>dua', new Geometry(10, 120, 120, 60), { shape: 'process' });
  b.setVertex(true);
  const geo = new Geometry();
  geo.relative = true;
  geo.points = [new Point(70, 100)];
  const e = new Cell('', geo, { endArrow: 'block' });
  e.setEdge(true);
  model.batchUpdate(() => {
    model.add(layer, a);
    model.add(layer, b);
    model.add(layer, e);
    model.setTerminal(e, a, true);
    model.setTerminal(e, b, false);
  });
  e.setId('');
  return model;
}

describe('tulis dan baca .drawio', () => {
  it('model ke XML mxGraphModel', () => {
    const xml = modelToXml(sampleModel(), { background: '#fffbe6', gridSize: 20 });
    expect(xml).toContain('gridSize="20"');
    expect(xml).toContain('background="#fffbe6"');
    expect(xml).toContain('value="Mulai &amp; &quot;uji&quot;"');
    expect(xml).toContain('value="Proses&lt;br&gt;dua"');
    expect(xml).toContain('style="rounded=1;arcSize=50;html=1;"');
    expect(xml).toContain('style="shape=process;html=1;"');
    expect(xml).toContain('<Array as="points"><mxPoint x="70" y="100"/></Array>');
    // Id kosong diganti id unik, dan rujukan source/target tetap benar.
    expect(xml).not.toContain('id=""');
    expect(xml).toMatch(
      /<mxCell id="c\d+" style="endArrow=block;html=1;" edge="1" parent="1" source="\d+" target="\d+">/,
    );
  });

  it('hasil tulis bisa dibaca maxGraph lagi', () => {
    const file = toDrawioFile([{ name: 'Alur', model: modelToXml(sampleModel()) }]);
    const pages = readDrawio(file);
    expect(pages.map((p) => p.name)).toEqual(['Alur']);
    const model = new GraphDataModel();
    new ModelXmlSerializer(model).import(pages[0].model);
    const cells = model.getRoot()!.getChildAt(0).children;
    expect(cells).toHaveLength(3);
    const edge = cells.find((c) => c.isEdge())!;
    expect(edge.getTerminal(true)?.getValue()).toBe('Mulai & "uji"');
    expect(edge.getStyle().endArrow).toBe('block');
    expect(cells[0].getStyle().rounded).toBe(1);
  });

  it('membaca diagram terkompresi (deflate + base64)', () => {
    const inner =
      '<mxGraphModel grid="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="Ä ok" vertex="1" parent="1"><mxGeometry width="10" height="10" as="geometry"/></mxCell></root></mxGraphModel>';
    const raw = deflateSync(strToU8(encodeURIComponent(inner)));
    let bin = '';
    for (const byte of raw) bin += String.fromCharCode(byte);
    const file = `<mxfile><diagram name="Satu">${btoa(bin)}</diagram><diagram name="Dua"><mxGraphModel><root><mxCell id="0"/></root></mxGraphModel></diagram></mxfile>`;
    const pages = readDrawio(file);
    expect(pages.map((p) => p.name)).toEqual(['Satu', 'Dua']);
    expect(pages[0].model).toBe(inner);
    expect(modelOptions(pages[0].model).grid).toBe(false);
  });

  it('mxGraphModel langsung dan berkas rusak', () => {
    expect(readDrawio('<mxGraphModel><root/></mxGraphModel>')).toHaveLength(1);
    expect(() => readDrawio('<html></html>')).toThrow(DrawioError);
    expect(() => readDrawio('bukan xml <')).toThrow(DrawioError);
    expect(() => readDrawio('<mxfile><diagram>!!!</diagram></mxfile>')).toThrow(DrawioError);
  });

  it('opsi halaman', () => {
    expect(modelOptions('<mxGraphModel grid="1" gridSize="25" background="#eee">')).toEqual({
      background: '#eee',
      grid: true,
      gridSize: 25,
    });
    expect(modelOptions('<mxGraphModel background="none">').background).toBeUndefined();
  });
});

describe('pustaka shape', () => {
  it('id unik dan setiap shape stencil terdaftar', () => {
    const items = LIBRARY.flatMap((g) => g.items);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    const builtin = new Set([
      'rectangle',
      'ellipse',
      'rhombus',
      'triangle',
      'hexagon',
      'cylinder',
      'cloud',
      'actor',
    ]);
    for (const it of items) {
      const shape = it.style.shape;
      if (shape) expect(builtin.has(shape) || shape in STENCILS, `${it.id}: ${shape}`).toBe(true);
    }
    expect(GENERAL.items.length).toBeGreaterThan(20);
    expect(FLOWCHART.items.length).toBeGreaterThan(20);
  });

  it('stencil XML valid', () => {
    for (const [name, xml] of Object.entries(STENCILS)) {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      expect(doc.getElementsByTagName('parsererror').length, name).toBe(0);
      expect(doc.documentElement.getAttribute('name')).toBe(name);
    }
  });

  it('pencarian dua bahasa', () => {
    expect(searchLibrary(LIBRARY, 'keputusan').map((i) => i.id)).toEqual(['fcDecision']);
    expect(searchLibrary(LIBRARY, 'decision').map((i) => i.id)).toEqual(['fcDecision']);
    expect(searchLibrary(LIBRARY, 'database').map((i) => i.id)).toContain('fcDatabase');
    expect(searchLibrary(LIBRARY, '  ')).toEqual([]);
  });
});
