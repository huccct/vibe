"""Decode public Terrarium DEM and generate original PBR relief/foliage textures."""
import json, math, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT=Path(__file__).parent; OUT=ROOT/'assets'; GEO=OUT/'geo'
LAT,LON=30.233889,120.145
images={x:Image.open(GEO/f'terrain-13-{x}-3373.png').convert('RGB') for x in (6829,6830)}
def height(x,y):
    lat=LAT+y/111320;lon=LON+x/(111320*math.cos(math.radians(LAT)))
    gx=(lon+180)/360*8192;gy=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*8192
    tile=math.floor(gx);px=(gx-tile)*256;py=(gy-3373)*256
    if tile not in images or not 0<=py<255: return 0
    def p(ix,iy):
        r,g,b=images[tile].getpixel((min(ix,255),min(iy,255)));return r*256+g+b/256-32768-10
    ix,iy=int(px),int(py);u,v=px-ix,py-iy
    return (p(ix,iy)*(1-u)+p(ix+1,iy)*u)*(1-v)+(p(ix,iy+1)*(1-u)+p(ix+1,iy+1)*u)*v
# 16m grid: no fictitious high-resolution detail claimed for a coarse DEM.
xs=list(range(-2000,1505,16));ys=list(range(-1300,1405,16))
json.dump({'origin':[LAT,LON],'waterDatum':10,'step':16,'xs':xs,'ys':ys,'heights':[[round(height(x,y),3) for x in xs] for y in ys],'pagodaGround':height(0,0)},open(GEO/'terrain.json','w'))

# Original twig atlas, transparent between individual pointed leaves.
random.seed(2026)
img=Image.new('RGBA',(1024,1024));d=ImageDraw.Draw(img)
d.line([(505,930),(510,640),(480,300),(540,65)], fill=(68,60,35,255),width=9)
for j in range(17):
    yy=850-j*43;side=1 if j%2 else -1;end=(510+side*random.randint(220,390),yy-160)
    d.line([(505,yy),end],fill=(75,70,40,255),width=5)
    for k in range(7):
        t=(k+1)/8;cx=505+(end[0]-505)*t;cy=yy+(end[1]-yy)*t
        direction=side*1.0+random.uniform(-.9,.9)
        length=random.uniform(47,79);wid=length*.36
        ax,ay=math.cos(direction),-abs(math.sin(direction))
        for flip in [-1,1]:
            lx=cx;ly=cy+flip*19
            pts=[(lx,ly),(lx+ax*length*.48-ay*wid,ly+ay*length*.48+ax*wid),(lx+ax*length,ly+ay*length),(lx+ax*length*.48+ay*wid,ly+ay*length*.48-ax*wid)]
            c=random.randint(0,24);d.polygon(pts,fill=(67+c,89+c,40+c//2,255));d.line([(lx,ly),(lx+ax*length*.91,ly+ay*length*.91)],fill=(94+c,111+c,59,255),width=2)
img.save(OUT/'foliage.png')
# Bake a seamless mortar/stone micro-height field into tangent-space normals.
N=512;h=Image.new('L',(N,N));p=h.load();random.seed(18)
for y in range(N):
 for x in range(N): p[x,y]=int(125+random.uniform(-17,17))
h=h.filter(ImageFilter.GaussianBlur(.7));p=h.load();normal=Image.new('RGB',(N,N));n=normal.load()
for y in range(N):
 for x in range(N):
  dx=(p[(x+1)%N,y]-p[(x-1)%N,y])/255*.65;dy=(p[x,(y+1)%N]-p[x,(y-1)%N])/255*.65;l=math.sqrt(dx*dx+dy*dy+1)
  n[x,y]=(round(127.5*(1-dx/l)),round(127.5*(1-dy/l)),round(127.5*(1+1/l)))
normal.save(OUT/'stone-normal.png')
assert abs(height(0,0)-37)<10
assert normal.size==(512,512)
print('Terrain decoded; pagoda ground above lake:',height(0,0))
