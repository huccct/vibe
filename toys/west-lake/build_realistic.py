"""Reference-based Leifeng exterior, meter scale. Run with Blender --background --python.
Official dimensions are fixed; inferred facade details and planting are documented in SOURCES.md.
"""
import bpy, math, random, json
from pathlib import Path
from mathutils import Vector
from collections import defaultdict

ROOT=Path(__file__).parent; OUT=ROOT/'assets'
random.seed(71)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system='METRIC'
bpy.context.scene.unit_settings.scale_length=1
terrain=json.loads((OUT/'geo/terrain.json').read_text());GROUND=terrain['pagodaGround']

def material(name,rgb,rough=.7,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*rgb,1)
 b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*rgb,1);b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal
 return m
mats={
 'plaster':material('Warm lime plaster',(.66,.63,.54),.88),
 'red':material('Oxidised red-brown columns',(.18,.055,.027),.65),
 'roof':material('Weathered grey copper tiles',(.12,.135,.129),.48,.45),
 'ridge':material('Raised tile rolls',(.17,.18,.17),.5,.35),
 'stone':material('White marble foundation',(.62,.65,.63),.78),
 'paving':material('Grey stone paving',(.25,.27,.25),.9),
 'dark':material('Deep door and window recesses',(.016,.019,.018),.6),
 'rail':material('Dark bronze balustrade',(.10,.095,.076),.54,.5),
 'gold':material('Gilded copper finial',(.65,.40,.10),.30,.82),
 'bark':material('Tree bark',(.095,.075,.05),.95),
 'terrain':material('Terrain earth',(.12,.145,.09),1),
}
normal=bpy.data.images.load(str(OUT/'stone-normal.png'))
normal.colorspace_settings.name='Non-Color'
for key in ('stone','plaster','paving'):
 m=mats[key];nodes=m.node_tree.nodes;links=m.node_tree.links
 tex=nodes.new('ShaderNodeTexImage');tex.image=normal
 coord=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='SCALE';mapping.inputs[3].default_value=5
 # UV coordinates are written per face below for portable baked normal maps.
 nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.32;links.new(tex.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs[0],nodes.get('Principled BSDF').inputs['Normal'])

class Batch:
 def __init__(self):self.v=[];self.f=[];self.uv=[]
 def add(self,verts,faces):
  n=len(self.v);self.v.extend(verts);self.f.extend(tuple(n+i for i in f) for f in faces)
 def box(self,center,size,angle=0):
  x,y,z=center;a,b,c=[s/2 for s in size];ca,sa=math.cos(angle),math.sin(angle)
  self.add([(x+dx*ca-dy*sa,y+dx*sa+dy*ca,z+dz) for dx,dy,dz in [(-a,-b,-c),(a,-b,-c),(a,b,-c),(-a,b,-c),(-a,-b,c),(a,-b,c),(a,b,c),(-a,b,c)]],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
 def tube(self,p1,p2,r,r2=None,sides=8):
  a,b=Vector(p1),Vector(p2);axis=(b-a).normalized();u=axis.cross(Vector((0,0,1)))
  if u.length<.01:u=axis.cross(Vector((0,1,0)))
  u.normalize();v=axis.cross(u);r2=r if r2 is None else r2
  verts=[tuple(p+rr*(math.cos(i*math.tau/sides)*u+math.sin(i*math.tau/sides)*v)) for p,rr in [(a,r),(b,r2)] for i in range(sides)]
  self.add(verts,[tuple(range(sides-1,-1,-1)),tuple(range(sides,2*sides))]+[(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)])
 def ring(self,z,r,height,r2=None,sides=8):self.tube((0,0,z),(0,0,z+height),r,r2,sides)
 def object(self,name,mat,smooth=False):
  mesh=bpy.data.meshes.new(name);mesh.from_pydata(self.v,[],self.f);mesh.update();obj=bpy.data.objects.new('GEO-'+name,mesh);bpy.context.collection.objects.link(obj);mesh.materials.append(mat)
  uv=mesh.uv_layers.new(name='SurfaceUV')
  for poly in mesh.polygons:
   axis=max(range(3),key=lambda k:abs(poly.normal[k]));axes=[k for k in range(3) if k!=axis]
   for li in poly.loop_indices:
    co=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(co[axes[0]]*.5,co[axes[1]]*.5)
  if smooth:
   for p in mesh.polygons:p.use_smooth=True
  return obj
B=defaultdict(Batch)

def octpoint(r,side,t,z):
 a=side*math.pi/4; b=a+math.pi/4
 return (r*((1-t)*math.cos(a)+t*math.cos(b)),r*((1-t)*math.sin(a)+t*math.sin(b)),GROUND+z)

def railing(r,z,white=False):
 key='stone' if white else 'rail'
 for side in range(8):
  a=Vector(octpoint(r,side,0,z));b=Vector(octpoint(r,side,1,z));axis=(b-a).normalized();angle=math.atan2(axis.y,axis.x);length=(b-a).length
  for zz in [.14,.95,1.16]:B[key].box(tuple((a+b)/2+Vector((0,0,zz))), (length,.12,.10),angle)
  count=max(3,int(length/.50))
  for k in range(count+1):
   p=a.lerp(b,k/count);B[key].box(tuple(p+Vector((0,0,.60))),(.115,.115,1.2),angle)
   if white: B[key].tube(tuple(p+Vector((0,0,1.18))),tuple(p+Vector((0,0,1.34))),.11,.075,8)
  # Rectangular openwork bronze panels.
  for k in range(count):
   p=a.lerp(b,(k+.5)/count);B[key].box(tuple(p+Vector((0,0,.49))), (length/count-.16,.06,.065),angle)

def roof(z,outer,inner,height,level):
 # Profile fitted to photo: shallow outward flare, steeper near the upper wall.
 def point(side,t,s):
  r=outer*(1-s)+inner*s
  corner=(abs(2*t-1)**9)*.55*(1-s)**3
  return octpoint(r,side,t,z+height*s**1.65+corner)
 for side in range(8):
  NU,NV=46,18;verts=[point(side,u/NU,v/NV) for v in range(NV+1) for u in range(NU+1)]
  faces=[(v*(NU+1)+u,v*(NU+1)+u+1,(v+1)*(NU+1)+u+1,(v+1)*(NU+1)+u) for v in range(NV) for u in range(NU)]
  B['roof'].add(verts,faces)
  for u in range(NU+1):
   for v in range(12):
    p=Vector(point(side,u/NU,v/12))+Vector((0,0,.035));q=Vector(point(side,u/NU,(v+1)/12))+Vector((0,0,.035))
    B['ridge'].tube(p,q,.045 if level else .062,sides=5)
  # Cross seams on individual tile courses.
  for v in range(1,12):
   for u in range(NU):
    p=point(side,u/NU,v/12);q=point(side,(u+1)/NU,v/12);B['roof'].tube(p,q,.019,sides=4)
  # Corner ridge ornaments, hanging wind bell and structural ribs.
  for v in range(18): B['ridge'].tube(point(side,0,v/18),point(side,0,(v+1)/18),.13,sides=8)
  tip=Vector(point(side,0,0));B['gold'].tube(tip,tip-Vector((0,0,.7)),.012,sides=5)
  B['gold'].tube(tip-Vector((0,0,.76)),tip-Vector((0,0,1.02)),.08,.14,12)
  for k in range(4):
   p=Vector(point(side,0,.025+k*.035))+Vector((0,0,.17));B['ridge'].tube(p,p+Vector((0,0,.28)),.09,.045,6)
  for u in range(0,NU+1,2):

   for v in range(8):
    p=Vector(point(side,u/NU,.05+.75*v/8))-Vector((0,0,.20));q=Vector(point(side,u/NU,.05+.75*(v+1)/8))-Vector((0,0,.20));B['red'].tube(p,q,.09,sides=6)

# The official 60m podium surrounds the 35.25m lower roof and 28m main body.
B['stone'].ring(GROUND,30,9.7)
for z,r,h in [(0,30.2,.45),(8.7,30.4,.30),(9.4,30.6,.30)]:B['stone'].ring(GROUND+z,r,h)
B['paving'].ring(GROUND+9.7,29.8,.06)
railing(29.4,9.76,True)
# Northern stairway with two side marble parapets.
for j in range(42):
 z=(j+1)*9.7/42;y=47-j*.43
 B['paving'].box((0,y,GROUND+z/2),(8,.48,z))
 for x in [-4.35,4.35]:
  B['stone'].box((x,y,GROUND+z+.5),(.30,.44,1.0))

floors=[(9.7,14,6.5,17.625,4.2),(21.0,13.0,4.2,15.6,2.5),(29.0,12.4,4.2,14.9,2.5),(37.0,11.8,4.2,14.2,2.5),(45.0,11.2,3.5,13.5,7.009)]
for level,(z,r,h,rr,rh) in enumerate(floors):
 B['paving'].ring(GROUND+z,r+1.05,.35)
 B['stone'].ring(GROUND+z-.30,r+1.15,.30)
 for side in range(8):
  a=Vector(octpoint(r*.87,side,0,z));b=Vector(octpoint(r*.87,side,1,z));tangent=(b-a).normalized();angle=math.atan2(tangent.y,tangent.x);width=(b-a).length
  # Light wall panels behind a real outside gallery; central doors and narrow side windows.
  B['plaster'].box(tuple((a+b)/2+Vector((0,0,h/2))), (width,.30,h),angle)
  for t in [.12,.32,.5,.68,.88]:
   p=a.lerp(b,t);out=Vector((p.x,p.y,0)).normalized();door=t==.5
   B['dark'].box(tuple(p+out*.19+Vector((0,0,(2.3 if door else 1.9)/2))),(.95 if door else .65,.075,2.3 if door else 1.9),angle)
   for offset in [-.48,.48] if door else [-.34,.34]: B['red'].box(tuple(p+out*.24+tangent*offset+Vector((0,0,1.17))),(.07,.12,2.4),angle)
   if not door:
    for dz in [.5,1.,1.5]:B['red'].box(tuple(p+out*.26+Vector((0,0,dz))),(.64,.10,.04),angle)
  for t in [0,.25,.5,.75]:
   p=Vector(octpoint(r,side,t,z));B['red'].tube(p,p+Vector((0,0,h)),.19,.16,12)
   B['stone'].tube(p,p+Vector((0,0,.23)),.29,.27,12)
   # Layered dougong blocks project inwards/outwards under the roof.
   for k in range(3):
    q=p+Vector((0,0,h-.7+k*.22));B['red'].box(q,(.48+k*.30,.4,.17),angle);B['red'].box(q+Vector((0,0,.10)),(.25,.70+k*.30,.13),angle)
  for zz in [h-.22,h-.60]:B['red'].tube(octpoint(r,side,0,z+zz),octpoint(r,side,1,z+zz),.13,sides=6)
 if level:railing(r+.9,z+.38)
 roof(z+h,rr,2.6 if level==4 else r*.84,rh,level)
 if level:
  for side in range(8):
   for j in range(7):
    p=Vector(octpoint(r+.48,side,(j+.5)/7,z-.80));B['plaster'].tube(p,p+Vector((0,0,.50)),.31,.13,3)

# 16.10m finial plus the 0.07m published-dimension discrepancy at its connection; see SOURCES.md.
Z=GROUND+55.509
B['gold'].ring(Z,2.4,.5,2.15)
B['gold'].ring(Z+.5,2.15,1.8,1.35)
B['gold'].ring(Z+2.3,1.35,1.0,1.1)
B['gold'].tube((0,0,Z+3.1),(0,0,GROUND+71.679),.16,.028,16)
for j in range(9):
 z=Z+3.2+j*.61;r=1.45-j*.065
 B['gold'].ring(z,r,.10,r*1.04,48);B['gold'].ring(z+.10,r*1.04,.09,r*.5,48)
# Open flame / pearl halo, visible in both photos.
for plane in [0,math.pi/2]:
 for j in range(48):
  a=j*math.tau/48;b=(j+1)*math.tau/48
  p=(math.cos(plane)*.86*math.sin(a),math.sin(plane)*.86*math.sin(a),Z+11.1+1.35*math.cos(a))
  q=(math.cos(plane)*.86*math.sin(b),math.sin(plane)*.86*math.sin(b),Z+11.1+1.35*math.cos(b))
  B['gold'].tube(p,q,.055,sides=6)
for j in range(3):B['gold'].ring(Z+13.2+j*.95,.19,.18,.12,16)
for side in range(8):B['rail'].tube(octpoint(3.2,side,0,55.509),(math.cos(side*math.pi/4)*1.35,math.sin(side*math.pi/4)*1.35,Z+8.9),.009,sides=4)
for name,batch in B.items():
 if batch.v: batch.object('Leifeng-'+name,mats[name])
print('TOWER_BUILT',sum(len(b.f)*2 for b in B.values()),flush=True)

# Terrain from real elevations. Shore masking is added from OSM where available.
xs,ys,hs=terrain['xs'],terrain['ys'],terrain['heights'];NX=len(xs);NY=len(ys)
shorefile=OUT/'geo/shore.json';polygons=json.loads(shorefile.read_text())
bounds={id(p):(min(a[0] for a in p),min(a[1] for a in p),max(a[0] for a in p),max(a[1] for a in p)) for rings in polygons.values() for p in rings}
def inside(x,y,poly):
 xmin,ymin,xmax,ymax=bounds[id(poly)]
 if not xmin<=x<=xmax or not ymin<=y<=ymax:return False
 c=False;j=len(poly)-1
 for i in range(len(poly)):
  a,b=poly[i],poly[j]
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:c=not c
  j=i
 return c
def wet(x,y):return any(inside(x,y,p) for p in polygons['outer']) and not any(inside(x,y,p) for p in polygons['inner'])
def elevation(x,y):
 ix=max(0,min(NX-2,int((x-xs[0])/16)));iy=max(0,min(NY-2,int((y-ys[0])/16)));u=(x-xs[ix])/16;v=(y-ys[iy])/16
 return (hs[iy][ix]*(1-u)+hs[iy][ix+1]*u)*(1-v)+(hs[iy+1][ix]*(1-u)+hs[iy+1][ix+1]*u)*v
land=Batch()
for y,row in zip(ys,hs):
 for x,h in zip(xs,row):
  # DEM is coarse near the shore: OSM water polygons keep forest out of the lake.
  if wet(x,y):h=-2
  if x*x+y*y<32**2:h=min(h,GROUND)
  land.v.append((x,y,h))
dry=[not wet(x,y) for x,y,h in land.v]
def clip_triangle(indices):
 # Intersect mixed shore triangles against the observed OSM water boundary.
 if all(dry[i] for i in indices):land.f.append(indices);return
 if not any(dry[i] for i in indices):return
 poly=[]
 for a,b in zip(indices,indices[1:]+indices[:1]):
  if dry[a]:poly.append(a)
  if dry[a]!=dry[b]:
   p=Vector(land.v[a]);q=Vector(land.v[b]);lo,hi=0,1
   for _ in range(18):
    mid=(lo+hi)/2;r=p.lerp(q,mid)
    if (not wet(r.x,r.y))==dry[a]:lo=mid
    else:hi=mid
   r=p.lerp(q,(lo+hi)/2);r.z=.22;poly.append(len(land.v));land.v.append(tuple(r))
 for k in range(1,len(poly)-1):land.f.append((poly[0],poly[k],poly[k+1]))
for j in range(NY-1):
 for i in range(NX-1):
  a=j*NX+i;clip_triangle((a,a+1,a+NX));clip_triangle((a+1,a+NX+1,a+NX))
landobj=land.object('Survey-terrain',mats['terrain'],True)
# Vertex colors add spatial variation without making unrelated polygons look faceted.
colors=landobj.data.color_attributes.new(name='TerrainColor',type='FLOAT_COLOR',domain='POINT')
for i,(x,y,h) in enumerate(land.v):
 v=.75+.18*math.sin(x*.021)*math.cos(y*.019)+random.uniform(-.07,.07);colors.data[i].color=(.14*v,.17*v,.09*v,1)
vc=mats['terrain'].node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='TerrainColor';mats['terrain'].node_tree.links.new(vc.outputs['Color'],mats['terrain'].node_tree.nodes.get('Principled BSDF').inputs['Base Color'])

# Six shared botanical meshes, not polygonal balls. Individual twig cards have cutout leaves.
foliage=material('Broadleaf cutout foliage',(.18,.24,.08),.92)
nodes=foliage.node_tree.nodes;links=foliage.node_tree.links
tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(OUT/'foliage.png'))
links.new(tex.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color']);links.new(tex.outputs['Alpha'],nodes.get('Principled BSDF').inputs['Alpha'])
foliage.surface_render_method='DITHERED';foliage.use_backface_culling=False
leafmeshes=[];lowleaves=[];trunkmeshes=[]
for variant in range(6):
 leaves=Batch();trunk=Batch();height=12+variant*.9
 trunk.tube((0,0,0),(0,0,height*.72),.33,.08,8)
 for branch in range(11):
  a=branch*2.399;z=height*(.30+branch*.046);reach=3.8*math.sin((branch+2)/14*math.pi)
  end=Vector((math.cos(a)*reach,math.sin(a)*reach,z+2.2));trunk.tube((0,0,z),end,.13,.025,6)
 for j in range(440):
  a=random.random()*math.tau;u=random.uniform(-1,1);r=random.random()**.34
  center=Vector((math.cos(a)*math.sqrt(1-u*u)*r*4.6,math.sin(a)*math.sqrt(1-u*u)*r*4.1,height*.68+u*r*height*.35))
  normal=Vector((random.uniform(-1,1),random.uniform(-1,1),random.uniform(-.5,1))).normalized();axis=normal.cross(Vector((0,0,1)))
  if axis.length<.05:axis=Vector((1,0,0))
  axis.normalize();other=normal.cross(axis);size=random.uniform(1.65,2.25)
  leaves.add([tuple(center+axis*dx*size+other*dy*size) for dx,dy in [(-.5,-.5),(.5,-.5),(.5,.5),(-.5,.5)]],[(0,1,2,3)])
 obj=leaves.object('Broadleaf-prototype-'+str(variant),foliage)
 uv=obj.data.uv_layers.active
 for p in obj.data.polygons:
  for index,co in zip(p.loop_indices,[(0,0),(1,0),(1,1),(0,1)]):uv.data[index].uv=co
 # Outward normals soften card lighting while keeping the photographed leafy silhouette.
 leafmeshes.append(obj.data);bpy.data.objects.remove(obj,do_unlink=True)
 low=Batch();low.v=leaves.v[:150*4];low.f=leaves.f[:150];obj=low.object('Broadleaf-LOD-'+str(variant),foliage)
 uv=obj.data.uv_layers.active
 for p in obj.data.polygons:
  for index,co in zip(p.loop_indices,[(0,0),(1,0),(1,1),(0,1)]):uv.data[index].uv=co
 lowleaves.append(obj.data);bpy.data.objects.remove(obj,do_unlink=True)
 obj=trunk.object('Trunk-prototype-'+str(variant),mats['bark'],True);trunkmeshes.append(obj.data);bpy.data.objects.remove(obj,do_unlink=True)

positions=[]
# Dense near-shore woodland and lower-detail surrounding terrain, fixed seeded placement.
for attempt in range(53000):
 if attempt<22000:
  if len(positions)>=6000:continue
  x=random.uniform(-600,600);y=random.uniform(-450,380)
 else:
  x=random.uniform(-1900,1400);y=random.uniform(-1250,800)
 h=elevation(x,y)
 if h<1.8 or wet(x,y) or x*x+y*y<34**2:continue
 if abs(x)<6 and 28<y<70:continue
 near=x*x+y*y<550**2
 if not near and random.random()>.35:continue
 if len(positions)>12000:break
 positions.append((x,y,h))
for index,(x,y,h) in enumerate(positions):
 variant=index%6;scale=random.uniform(.72,1.38);angle=random.random()*math.tau
 for mesh,name in [((leafmeshes if x*x+y*y<400**2 else lowleaves)[variant],'Canopy'),(trunkmeshes[variant],'Trunk')]:
  obj=bpy.data.objects.new('GEO-'+name+'-'+str(index),mesh);bpy.context.collection.objects.link(obj);obj.location=(x,y,h-.7);obj.scale=(scale,scale,scale);obj.rotation_euler.z=angle
# Irregular understory conceals the bare, evenly spaced trunks at the lakeshore.
for index,(x,y,h) in enumerate(positions):
 if x*x+y*y>900**2 or index%2:continue
 obj=bpy.data.objects.new('GEO-Canopy-understory-'+str(index),lowleaves[index%6]);bpy.context.collection.objects.link(obj)
 obj.location=(x+random.uniform(-3,3),y+random.uniform(-3,3),h-.3);s=random.uniform(.38,.67);obj.scale=(s*1.3,s*1.3,s*.8);obj.rotation_euler.z=random.random()*math.tau
print('FOREST_BUILT',len(positions),'trees',flush=True)
# A 1.7m hidden measuring reference, excluded from export.
bpy.ops.object.empty_add(location=(0,0,GROUND+9.7));bpy.context.object.name='REFERENCE-human-1.7m';bpy.context.object.empty_display_size=1.7

scene=bpy.context.scene
world=bpy.data.worlds.new('Overcast lakeside daylight');scene.world=world;world.use_nodes=True
world.node_tree.nodes.get('Background').inputs[0].default_value=(.58,.69,.76,1);world.node_tree.nodes.get('Background').inputs[1].default_value=.7
bpy.ops.object.light_add(type='SUN',location=(200,400,600));bpy.context.object.rotation_euler=(math.radians(28),math.radians(-22),math.radians(-30));bpy.context.object.data.energy=2;bpy.context.object.data.angle=.15
bpy.ops.object.camera_add(location=(-90,450,12));cam=bpy.context.object;cam.name='CAM-Lake-reference';cam.rotation_euler=(Vector((0,0,GROUND+36))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=52;cam.data.clip_end=8000;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
# Blender-native lake for the editable scene, exported separately by the browser water renderer.
water=material('Lake source material',(.07,.13,.12),.16,.12)
bpy.ops.mesh.primitive_plane_add(size=12000);lake=bpy.context.object;lake.name='GEO-Lake-source';lake.data.materials.append(water)
noise=water.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=8;noise.inputs['Detail'].default_value=2
bump=water.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.22;bump.inputs['Distance'].default_value=.09;water.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);water.node_tree.links.new(bump.outputs[0],water.node_tree.nodes.get('Principled BSDF').inputs['Normal'])
assert abs((9.7+45.809+.07+16.10)-71.679)<1e-6
assert abs(max(v[2] for v in B['gold'].v)-GROUND-71.679)<.02
assert len(positions)>500
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'leifeng-realistic.blend'))
bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
 if obj.type=='MESH' and obj!=lake:obj.select_set(True)
kwargs=dict(filepath=str(OUT/'leifeng-realistic.glb'),export_format='GLB',use_selection=True,export_cameras=False,export_lights=False)
props=bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
if 'export_gpu_instances' in props:kwargs['export_gpu_instances']=True
bpy.ops.export_scene.gltf(**kwargs)
print('REALISTIC_OK', (OUT/'leifeng-realistic.glb').stat().st_size,flush=True)
