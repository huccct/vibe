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

export function nearestColor(r,g,b,palette=PALETTE) {
  let best=palette[0],bestDistance=Infinity
  for(const color of palette){const [cr,cg,cb]=color.rgb;const d=(r-cr)**2+(g-cg)**2+(b-cb)**2;if(d<bestDistance){best=color;bestDistance=d}}
  return best
}

export function quantize(data,palette=PALETTE,maxColors=12) {
  const first=[];const counts=new Map()
  for(let i=0;i<data.length;i+=4){
    if(data[i+3]<80){first.push(null);continue}
    const color=nearestColor(data[i],data[i+1],data[i+2],palette);first.push(color);counts.set(color,(counts.get(color)||0)+1)
  }
  const selected=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,maxColors).map(([color])=>color)
  return first.map((color,i)=>color===null?null:nearestColor(data[i*4],data[i*4+1],data[i*4+2],selected))
}
