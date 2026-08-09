export const LAYERS = 64

export const MODELS = {
  vase: { height: 2.6 },
  cup: { height: 2.35 },
  bowl: { height: 1.35 },
}

export function visibleLayers(progress) {
  return Math.min(LAYERS, Math.max(0, Math.ceil(progress * LAYERS)))
}

export function outlinePoint(model, layerProgress, angle) {
  if (model === 'cup') {
    const twist = layerProgress * Math.PI * 1.7
    const radius = (0.48 + Math.sin(layerProgress * Math.PI) * 0.16) * (1 + 0.12 * Math.cos(angle * 10 + twist))
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }
  }

  if (model === 'bowl') {
    const radius = 0.28 + Math.sin(layerProgress * Math.PI / 2) * 0.64
    const ripple = 1 + 0.11 * Math.cos(angle * 7 + layerProgress * 0.8)
    return { x: Math.cos(angle) * radius * ripple, z: Math.sin(angle) * radius * ripple }
  }

  const radius = 0.36 + layerProgress * 0.16 + Math.sin(layerProgress * Math.PI * 5) * 0.06
    + Math.sin(angle * 6 + layerProgress * Math.PI * 3) * 0.075
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }
}

export function printerMotion(model, progress, time) {
  const layerProgress = Math.min(1, progress)
  const point = outlinePoint(model, layerProgress, time * 0.008)
  return {
    x: point.x,
    bedZ: -point.z,
    height: 1.98 + layerProgress * MODELS[model].height,
  }
}
