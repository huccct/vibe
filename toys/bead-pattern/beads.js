export const PALETTE = [
  ['B01','雪白','#f5f2e9'],['B02','奶油','#f4dca0'],['B03','柠檬黄','#f5cf3b'],['B04','橙黄','#f39a37'],
  ['B05','珊瑚橙','#ec6b4d'],['B06','正红','#d93a3a'],['B07','酒红','#8c2f3d'],['B08','樱花粉','#f2a8b8'],
  ['B09','桃粉','#e96f9d'],['B10','玫红','#bd3d7d'],['B11','浅紫','#c8a8dc'],['B12','葡萄紫','#755096'],
  ['B13','天蓝','#87c9e8'],['B14','湖蓝','#399cc4'],['B15','宝蓝','#3766ad'],['B16','藏蓝','#27375f'],
  ['B17','薄荷绿','#9bd5b5'],['B18','草绿','#62ad68'],['B19','森林绿','#327052'],['B20','橄榄绿','#81864b'],
  ['B21','浅棕','#c99a6b'],['B22','焦糖','#a86d43'],['B23','咖啡','#6d4937'],['B24','深棕','#40312c'],
  ['B25','浅灰','#d1d2cc'],['B26','中灰','#929a9a'],['B27','深灰','#50595c'],['B28','黑色','#202426'],
  ['B29','荧光黄','#dff24c'],['B30','青绿','#35b9a5'],['B31','肤色','#e8b98f'],['B32','透明感蓝','#b7dde1'],
].map(([code,name,hex])=>({code,name,hex,rgb:hex.match(/\w\w/g).map(v=>parseInt(v,16))}))

function oklab(r,g,b){
  const linear=value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}
  r=linear(r);g=linear(g);b=linear(b)
  const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b)
  const m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b)
  const s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b)
  return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s]
}

function distance(a,b){return (a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2}

export function nearestColor(r,g,b,palette=PALETTE) {
  const lab=oklab(r,g,b);let best=palette[0],bestDistance=Infinity
  for(const color of palette){const d=distance(lab,color.lab||(color.lab=oklab(...color.rgb)));if(d<bestDistance){best=color;bestDistance=d}}
  return best
}

export function quantize(data,palette=PALETTE,maxColors=12,width=0) {
  const pixels=[]
  for(let i=0;i<data.length;i+=4){
    if(data[i+3]<80)continue
    let weight=1
    if(width){
      const x=(i/4)%width
      for(const neighbor of [x?i-4:-1,i>=width*4?i-width*4:-1])if(neighbor>=0&&data[neighbor+3]>=80){
        const delta=(Math.abs(data[i]-data[neighbor])+Math.abs(data[i+1]-data[neighbor+1])+Math.abs(data[i+2]-data[neighbor+2]))/3
        weight=Math.max(weight,1+Math.min(3,delta/64))
      }
    }
    pixels.push({offset:i,lab:oklab(data[i],data[i+1],data[i+2]),weight})
  }
  if(!pixels.length)return Array(data.length/4).fill(null)
  const labs=palette.map(color=>color.lab||(color.lab=oklab(...color.rgb)))
  const costs=pixels.map(pixel=>labs.map(lab=>distance(pixel.lab,lab)))
  const best=Array(pixels.length).fill(Infinity),selected=[]
  while(selected.length<Math.min(maxColors,palette.length)){
    let winner=-1,winnerCost=Infinity
    for(let candidate=0;candidate<palette.length;candidate++)if(!selected.includes(candidate)){
      let cost=0;for(let p=0;p<pixels.length;p++)cost+=Math.min(best[p],costs[p][candidate])*pixels[p].weight
      if(cost<winnerCost){winner=candidate;winnerCost=cost}
    }
    selected.push(winner);for(let p=0;p<pixels.length;p++)best[p]=Math.min(best[p],costs[p][winner])
  }
  const result=Array(data.length/4).fill(null)
  pixels.forEach((pixel,p)=>{let winner=selected[0];for(const candidate of selected)if(costs[p][candidate]<costs[p][winner])winner=candidate;result[pixel.offset/4]=palette[winner]})
  return result
}
