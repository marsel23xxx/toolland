/**
 * Ujung garis ERD (notasi crow's foot) untuk maxGraph. Namanya sama dengan yang dipakai file
 * .drawio (ERone, ERmandOne, ERmany, ERoneToMany, ERzeroToOne, ERzeroToMany).
 */
import { EdgeMarkerRegistry, type MarkerFactoryFunction } from '@maxgraph/core';

type Kind = 'one' | 'mandOne' | 'many' | 'oneToMany' | 'zeroToOne' | 'zeroToMany';

export const ER_MARKERS: Record<string, Kind> = {
  ERone: 'one',
  ERmandOne: 'mandOne',
  ERmany: 'many',
  ERoneToMany: 'oneToMany',
  ERzeroToOne: 'zeroToOne',
  ERzeroToMany: 'zeroToMany',
};

function erMarker(kind: Kind): MarkerFactoryFunction {
  return (canvas, _shape, _type, pe, ux, uy, size) => {
    const s = Math.max(size, 6);
    // ux/uy menunjuk ke arah ujung garis; n tegak lurus garis.
    const nx = -uy;
    const ny = ux;
    const at = (back: number, side: number): [number, number] => [
      pe.x - ux * back + nx * side,
      pe.y - uy * back + ny * side,
    ];
    return () => {
      const line = (a: [number, number], b: [number, number]) => {
        canvas.begin();
        canvas.moveTo(a[0], a[1]);
        canvas.lineTo(b[0], b[1]);
        canvas.stroke();
      };
      const bar = (d: number) => line(at(d, s * 0.8), at(d, -s * 0.8));
      const crow = () => {
        line(at(s, 0), at(0, s * 0.8));
        line(at(s, 0), at(0, -s * 0.8));
      };
      const ring = (d: number) => {
        const rad = s * 0.4;
        const [cx, cy] = at(d, 0);
        canvas.setFillColor('#ffffff');
        canvas.ellipse(cx - rad, cy - rad, rad * 2, rad * 2);
        canvas.fillAndStroke();
      };
      if (kind === 'one') bar(s);
      else if (kind === 'mandOne') {
        bar(s * 0.8);
        bar(s * 1.3);
      } else if (kind === 'many') crow();
      else if (kind === 'oneToMany') {
        crow();
        bar(s * 1.4);
      } else if (kind === 'zeroToOne') {
        bar(s * 0.8);
        ring(s * 1.7);
      } else {
        crow();
        ring(s * 1.7);
      }
    };
  };
}

let done = false;
export function registerMarkers(): void {
  if (done) return;
  done = true;
  for (const [name, kind] of Object.entries(ER_MARKERS))
    EdgeMarkerRegistry.add(name, erMarker(kind));
}
