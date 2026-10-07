import * as T from '../../src/vendor/three.module.min.js';
import { TOYS } from './physics.js';

// One closed surface: the five arms share their center and rim vertices.
export function createStarGeometry() {
  const tips = [2,6,10,9,5].map(i => new T.Vector3(...TOYS.star.rest[i]));
  const outline = [];
  for (let i = 0; i < tips.length; i++) {
    outline.push(tips[i]);
    outline.push(tips[i].clone().add(tips[(i + 1) % tips.length]).normalize().multiplyScalar(.30));
  }
  const curve = new T.CatmullRomCurve3(outline, true, 'centripetal');
  const segments = 100, rings = 8, positions = [0,0,.13, 0,0,-.08], indices = [];
  const layers = [];
  for (let side = 0; side < 2; side++) {
    const rows = [];
    for (let ring = 1; ring <= rings; ring++) {
      if (side === 1 && ring === rings) { rows.push(layers[0][rings - 1]); continue; }
      const row = [], r = ring / rings;
      for (let j = 0; j < segments; j++) {
        const p = curve.getPoint(j / segments);
        row.push(positions.length / 3);
        positions.push(p.x * r, p.y * r, (side === 0 ? .13 : -.08) * Math.sqrt(1 - r * r));
      }
      rows.push(row);
    }
    layers.push(rows);
    const triangle = (a,b,c) => indices.push(...(side === 0 ? [a,b,c] : [a,c,b]));
    for (let j = 0; j < segments; j++) {
      const next = (j + 1) % segments;
      triangle(side, rows[0][j], rows[0][next]);
      for (let ring = 1; ring < rings; ring++) {
        triangle(rows[ring-1][j], rows[ring][j], rows[ring][next]);
        triangle(rows[ring-1][j], rows[ring][next], rows[ring-1][next]);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}
