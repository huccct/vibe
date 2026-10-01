"""Blender --background --python import_model.py -- /path/to/extracted/source [import.blend]."""
import bpy, sys, json, math
from pathlib import Path
from mathutils import Vector, Matrix
from io_scene_fbx import parse_fbx
args=sys.argv[sys.argv.index('--')+1:]; source=Path(args[0]); output=Path(__file__).resolve().parent/'assets'
if len(args)>1: bpy.ops.wm.open_mainfile(filepath=args[1])
else:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.fbx(filepath=str(next(source.glob('*.fbx'))),use_image_search=True)
root,_=parse_fbx.parse(str(next(source.glob('*.fbx'))))
objects=next(e for e in root.elems if e.id==b'Objects'); connections=next(e for e in root.elems if e.id==b'Connections'); db={e.props[0]:e for e in objects.elems}
def name(e): return e.props[1].split(b'\x00')[0].decode('utf8')
textures={}; opacity={}
for e in connections.elems:
 p=e.props
 if len(p)<4 or p[1] not in db or p[2] not in db: continue
 a,b=db[p[1]],db[p[2]]
 if a.id!=b'Texture' or b.id!=b'Material': continue
 paths=[x.props[0].decode('utf8').replace('\\','/').split('/')[-1] for x in a.elems if x.id==b'FileName']
 if paths and (source/paths[0]).exists():
  if b'diffuse' in p[3].lower(): textures[name(b)]=source/paths[0]
  if b'opacity' in p[3].lower(): opacity[name(b)]=source/paths[0]
# FBX keeps V-Ray custom links; rebuild the standard shader from their diffuse maps.
loaded={}; repaired=0
for m in bpy.data.materials:
 path=textures.get(m.name)
 if not path: continue
 if str(path) not in loaded:
  im=bpy.data.images.load(str(path),check_existing=True)
  if max(im.size)>1024:
   ratio=1024/max(im.size); im.scale(max(1,int(im.size[0]*ratio)),max(1,int(im.size[1]*ratio)))
  loaded[str(path)]=im
 m.use_nodes=True; ns=m.node_tree.nodes; ns.clear(); shader=ns.new('ShaderNodeBsdfPrincipled'); shader.inputs['Roughness'].default_value=.8
 out=ns.new('ShaderNodeOutputMaterial'); m.node_tree.links.new(shader.outputs['BSDF'],out.inputs['Surface'])
 t=ns.new('ShaderNodeTexImage'); t.image=loaded[str(path)]; m.node_tree.links.new(t.outputs['Color'],shader.inputs['Base Color'])
 if m.name in opacity:
  a=ns.new('ShaderNodeTexImage'); a.image=bpy.data.images.load(str(opacity[m.name]),check_existing=True); m.node_tree.links.new(a.outputs['Color'],shader.inputs['Alpha']); m.surface_render_method='DITHERED'
 repaired+=1
# Preserve evaluated transforms before removing imported FBX hierarchy nodes.
for o in list(bpy.context.scene.objects):
 if o.type=='MESH':
  world=o.matrix_world.copy();o.parent=None;o.matrix_world=world
# V-Ray procedural roof colors have no bitmap; restore glazed ochre explicitly.
for m in bpy.data.materials:
 if m.name.startswith('wa') or m.name in ['Mat3d66-10107180-6-76453','Mat3d66-10107180-8-13364']:
  shader=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
  for link in list(shader.inputs['Base Color'].links):m.node_tree.links.remove(link)
  shader.inputs['Base Color'].default_value=(.52,.255,.055,1);shader.inputs['Roughness'].default_value=.42
kept=[]
for o in list(bpy.context.scene.objects):
 if o.type!='MESH': bpy.data.objects.remove(o,do_unlink=True); continue
 pts=[o.matrix_world@Vector(c) for c in o.bound_box]; lo=[min(p[i] for p in pts) for i in range(3)]; hi=[max(p[i] for p in pts) for i in range(3)]
 # ponytail: retain the source's gate precinct, omit its enormous distant backdrop.
 if max(hi[0]-lo[0],hi[1]-lo[1])>400 or lo[1]>180 or hi[2]>80 or lo[2]<-10:
  bpy.data.objects.remove(o,do_unlink=True);continue
 # Source is Z-up, its south facade faces -Y. glTF export maps -Y to +Z.
 # The source repeats the right-hand slogan on both sides; isolate the left face.
 for i,m in enumerate(o.data.materials):
  if m and textures.get(m.name) and textures[m.name].name.endswith('-59.jpg') and (lo[0]+hi[0])<0:
   corrected=m.copy();corrected.name='Facade left inscription';o.data.materials[i]=corrected
 kept.append(o)
# Group imported pieces by their existing shader slots, preserving geometry and UVs.
groups={}
for o in kept:
 if len(o.data.polygons)>140000 or (int(o.name.split('-')[-2])>2400 and len(o.data.polygons)>10000):
  bpy.context.view_layer.objects.active=o
  mod=o.modifiers.new('Web detail budget','DECIMATE');mod.ratio=.18
  bpy.ops.object.modifier_apply(modifier=mod.name)
for o in kept: groups.setdefault(tuple(m.name if m else '' for m in o.data.materials),[]).append(o)
for group in groups.values():
 bpy.ops.object.select_all(action='DESELECT')
 for o in group: o.select_set(True)
 bpy.context.view_layer.objects.active=group[0]
 if len(group)>1:bpy.ops.object.join()
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in meshes:
 for uv in list(o.data.uv_layers)[1:]:o.data.uv_layers.remove(uv)
 o.matrix_world=Matrix.Scale(1.7,4)@o.matrix_world
bpy.ops.object.select_all(action='SELECT')
output.mkdir(exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output/'tiananmen-imported.glb'),export_format='GLB',use_selection=True,export_image_format='JPEG',export_jpeg_quality=85,export_materials='EXPORT',export_cameras=False,export_lights=False,export_animations=False)
report={'source':'https://www.aigei.com/item/zhong_shi_tia_5.html','assetId':'A127140214','license':'Free download; non-commercial use only; redistribution permission unverified','objects':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),'repairedMaterials':repaired,'diffuseTextures':len(loaded),'scale':1.7}
(output/'imported-model-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('EXPORTED',report,flush=True)
