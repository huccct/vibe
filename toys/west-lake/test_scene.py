"""Run: python3 toys/west-lake/test_scene.py"""
import json, struct, math
from pathlib import Path
root=Path(__file__).parent
raw=(root/'assets/leifeng-realistic.glb').read_bytes()
assert raw[:4]==b'glTF' and struct.unpack_from('<I',raw,8)[0]==len(raw)
length=struct.unpack_from('<I',raw,12)[0]
gltf=json.loads(raw[20:20+length])
nodes=gltf['nodes'];accessors=gltf['accessors']
assert sum(n['name'].startswith('GEO-Canopy-') for n in nodes)>500
assert any(n['name']=='GEO-Survey-terrain' for n in nodes)
gold=next(n for n in nodes if n['name']=='GEO-Leifeng-gold')
mesh=gltf['meshes'][gold['mesh']]
height=max(accessors[p['attributes']['POSITION']]['max'][1] for p in mesh['primitives'])
ground=json.loads((root/'assets/geo/terrain.json').read_text())['pagodaGround']
assert abs(height-ground-71.679)<.02,(height,ground)
shore=json.loads((root/'assets/geo/shore.json').read_text())
assert len(shore['outer'])==2 and len(shore['inner'])>20
assert all(p[0]==p[-1] for rings in shore.values() for p in rings)
assert all(math.isfinite(v) for a in accessors for k in ['min','max'] for v in a.get(k,[]))
print('PASS: GLB structure, 71.679m total height, forest instances, closed OSM shoreline rings.')
