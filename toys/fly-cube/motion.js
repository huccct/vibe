export const DIRECTIONS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
export function response(direction, strength, time) {
  if (!Number.isInteger(direction) || direction < 0 || direction > 7 || !Number.isFinite(strength) || strength < .1 || strength > 1 || !Number.isFinite(time) || time < 0) throw new RangeError('Invalid vibration input')
  const angle = direction * Math.PI / 4
  const triggered = strength >= .3
  const fall = triggered ? Math.min(1, Math.max(0, (time - 1.2) / .8) ** 2) : 0
  return { x: Math.sin(angle), z: -Math.cos(angle), shake: Math.sin(time * 24) * Math.exp(-time * 2.2) * strength, fall, triggered, phase: time < .4 ? 0 : time < 1.2 || !triggered ? 1 : time < 2 ? 2 : 3, finished: time >= 3 }
}
// ponytail: illustrative threshold and timed release, not a calibrated historical or seismic simulation.
