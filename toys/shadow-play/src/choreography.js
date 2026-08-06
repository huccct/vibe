/**
 * 22 秒上场样片。角度用度数写，方便照着幕上效果直接校准。
 * 躯干与头同向，避免亮相、探身时颈部脱节。
 */
const KEYS = [
  { t: 0, x: -180, y: 415, torso: -90, head: -90, farUpperArm: 126, farForeArm: 96, nearUpperArm: 30, nearForeArm: 98, staff: -90 },
  { t: 0.35, x: -180, y: 415, torso: -90, head: -90, farUpperArm: 126, farForeArm: 96, nearUpperArm: 30, nearForeArm: 98, staff: -90 },
  { t: 4.2, x: 430, y: 415, torso: -90, head: -90, farUpperArm: 126, farForeArm: 96, nearUpperArm: 30, nearForeArm: 98, staff: -90 },
  { t: 6.5, x: 430, y: 410, torso: -88, head: -88, farUpperArm: 146, farForeArm: 174, nearUpperArm: 26, nearForeArm: 95, staff: -90 },
  { t: 10.8, x: 466, y: 420, torso: -84, head: -84, farUpperArm: 136, farForeArm: 108, nearUpperArm: 42, nearForeArm: 105, staff: -86 },
  { t: 15.2, x: 472, y: 415, torso: -88, head: -88, farUpperArm: 142, farForeArm: 116, nearUpperArm: 18, nearForeArm: -42, staff: -90 },
  { t: 18.4, x: 472, y: 415, torso: -88, head: -88, farUpperArm: 142, farForeArm: 116, nearUpperArm: 18, nearForeArm: -42, staff: -90 },
  { t: 22, x: 450, y: 415, torso: -90, head: -90, farUpperArm: 126, farForeArm: 96, nearUpperArm: 30, nearForeArm: 98, staff: -90 },
];

const FIELDS = ['x', 'y', 'torso', 'head', 'farUpperArm', 'farForeArm', 'nearUpperArm', 'nearForeArm', 'staff'];

export function stagePoseAt(time) {
  const next = KEYS.findIndex((key) => time < key.t);
  if (next <= 0) return { ...KEYS[next < 0 ? KEYS.length - 1 : 0] };
  const a = KEYS[next - 1];
  const b = KEYS[next];
  const u = (time - a.t) / (b.t - a.t);
  const ease = u * u * (3 - 2 * u);
  return Object.fromEntries(FIELDS.map((field) => [field, a[field] + (b[field] - a[field]) * ease]));
}
