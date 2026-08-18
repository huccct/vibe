import { PALETTE, quantize } from './beads.js'

const canvas=document.getElementById('pattern')
const ctx=canvas.getContext('2d')
const fileInput=document.getElementById('file')
const sizeInput=document.getElementById('size')
const colorsInput=document.getElementById('colors')
const modeInput=document.getElementById('mode')
const zoomInput=document.getElementById('zoom')
const panXInput=document.getElementById('pan-x')
const panYInput=document.getElementById('pan-y')
const codesInput=document.getElementById('codes')
const swatches=document.getElementById('swatches')
const dropzone=document.getElementById('dropzone')
const CELL=24,MARGIN=38
let source=makeSample(),cols=0,rows=0,cells=[],selectedColor=undefined

fileInput.addEventListener('change',()=>loadFile(fileInput.files[0]))
sizeInput.addEventListener('input',()=>{document.getElementById('size-out').textContent=sizeInput.value;generate()})
colorsInput.addEventListener('input',()=>{document.getElementById('colors-out').textContent=colorsInput.value;generate()})
modeInput.addEventListener('change',generate)
for(const input of [zoomInput,panXInput,panYInput])input.addEventListener('input',generate)
codesInput.addEventListener('change',draw)
document.getElementById('eraser').addEventListener('click',()=>selectColor(null))
document.getElementById('download').addEventListener('click',download)
document.getElementById('print').addEventListener('click',()=>window.print())
canvas.addEventListener('pointerdown',paint)
for(const name of ['dragenter','dragover'])dropzone.addEventListener(name,event=>{event.preventDefault();dropzone.classList.add('dragging')})
for(const name of ['dragleave','drop'])dropzone.addEventListener(name,event=>{event.preventDefault();dropzone.classList.remove('dragging')})
dropzone.addEventListener('drop',event=>loadFile([...event.dataTransfer.files].find(file=>file.type.startsWith('image/'))))

generate()

function makeSample(){
  const c=document.createElement('canvas');c.width=c.height=400;const g=c.getContext('2d')
  g.translate(200,190)
  const colors=['#ef5b49','#f3a647','#f1d34f','#e98aab','#8d69ad','#56a6c2']
  colors.forEach((color,index)=>{const a=index*Math.PI/3;g.fillStyle=color;g.beginPath();g.ellipse(Math.cos(a)*82,Math.sin(a)*82,62,38,a,0,Math.PI*2);g.fill()})
  g.fillStyle='#f3c84d';g.beginPath();g.arc(0,0,54,0,Math.PI*2);g.fill()
  g.fillStyle='#262a28';g.beginPath();g.arc(-18,-8,6,0,Math.PI*2);g.arc(18,-8,6,0,Math.PI*2);g.fill();g.lineWidth=7;g.beginPath();g.arc(0,5,24,.15*Math.PI,.85*Math.PI);g.stroke()
  g.strokeStyle='#4b8a59';g.lineWidth=22;g.beginPath();g.moveTo(0,125);g.lineTo(0,205);g.stroke()
  return c
}

async function loadFile(file){
  if(!file)return
  const url=URL.createObjectURL(file);const image=new Image()
  try{
    image.src=url;await image.decode();source=image
    modeInput.value=detectMode(image);sizeInput.value=modeInput.value==='pixel'?64:48;colorsInput.value=modeInput.value==='pixel'?16:18
    zoomInput.value=100;panXInput.value=panYInput.value=50
    document.getElementById('size-out').textContent=sizeInput.value;document.getElementById('colors-out').textContent=colorsInput.value
    generate();document.getElementById('tip').textContent=`已按${modeInput.value==='pixel'?'像素 / 插画':'照片'}优化 · ${sizeInput.value} 格 · 可继续调整`
  }
  finally{URL.revokeObjectURL(url)}
}

function detectMode(image){
  const probe=document.createElement('canvas');probe.width=probe.height=64
  const p=probe.getContext('2d',{willReadFrequently:true});p.imageSmoothingEnabled=false;p.drawImage(image,0,0,64,64)
  const data=p.getImageData(0,0,64,64).data,colors=new Set();let transparent=0
  for(let i=0;i<data.length;i+=4){if(data[i+3]<80){transparent++;continue}colors.add(`${data[i]>>4},${data[i+1]>>4},${data[i+2]>>4}`)}
  return transparent>300||colors.size<180?'pixel':'photo'
}

function generate(){
  const size=Number(sizeInput.value),ratio=source.width/source.height
  if(ratio>=1){cols=size;rows=Math.max(1,Math.round(size/ratio))}else{rows=size;cols=Math.max(1,Math.round(size*ratio))}
  const sample=document.createElement('canvas');sample.width=cols;sample.height=rows
  const s=sample.getContext('2d',{willReadFrequently:true}),zoom=Number(zoomInput.value)/100
  const cropWidth=source.width/zoom,cropHeight=source.height/zoom
  const cropX=(source.width-cropWidth)*Number(panXInput.value)/100,cropY=(source.height-cropHeight)*Number(panYInput.value)/100
  s.imageSmoothingEnabled=modeInput.value==='photo';s.imageSmoothingQuality='high';s.clearRect(0,0,cols,rows);s.drawImage(source,cropX,cropY,cropWidth,cropHeight,0,0,cols,rows)
  cells=quantize(s.getImageData(0,0,cols,rows).data,PALETTE,Number(colorsInput.value),cols)
  selectedColor=undefined;draw();updateMaterials()
}

function draw(){
  canvas.width=MARGIN*2+cols*CELL;canvas.height=MARGIN*2+rows*CELL
  ctx.fillStyle='#fffdf7';ctx.fillRect(0,0,canvas.width,canvas.height)
  ctx.font='9px ui-monospace,monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#8e887c'
  for(let x=0;x<cols;x++)if(x%5===0||x===cols-1)ctx.fillText(String(x+1),MARGIN+x*CELL+CELL/2,MARGIN-17)
  for(let y=0;y<rows;y++)if(y%5===0||y===rows-1)ctx.fillText(String(y+1),MARGIN-18,MARGIN+y*CELL+CELL/2)
  ctx.strokeStyle='rgba(54,49,42,.11)';ctx.lineWidth=1
  for(let x=0;x<=cols;x++){ctx.beginPath();ctx.moveTo(MARGIN+x*CELL,MARGIN);ctx.lineTo(MARGIN+x*CELL,MARGIN+rows*CELL);ctx.stroke()}
  for(let y=0;y<=rows;y++){ctx.beginPath();ctx.moveTo(MARGIN,MARGIN+y*CELL);ctx.lineTo(MARGIN+cols*CELL,MARGIN+y*CELL);ctx.stroke()}
  cells.forEach((color,index)=>{if(!color)return;const x=index%cols,y=Math.floor(index/cols),cx=MARGIN+x*CELL+CELL/2,cy=MARGIN+y*CELL+CELL/2
    ctx.fillStyle=color.hex;ctx.beginPath();ctx.arc(cx,cy,CELL*.43,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(0,0,0,.14)';ctx.stroke()
    ctx.fillStyle='rgba(255,255,255,.28)';ctx.beginPath();ctx.arc(cx-3,cy-3,CELL*.12,0,Math.PI*2);ctx.fill()
    ctx.fillStyle='rgba(0,0,0,.2)';ctx.beginPath();ctx.arc(cx,cy,CELL*.1,0,Math.PI*2);ctx.fill()
    if(codesInput.checked){const [r,g,b]=color.rgb;ctx.fillStyle=r*.299+g*.587+b*.114>150?'#292722':'#fff';ctx.font='600 6px ui-monospace,monospace';ctx.fillText(color.code,cx,cy+.5)}
  })
  document.getElementById('dimensions').textContent=`${cols} × ${rows}`
}

function updateMaterials(){
  const counts=new Map();for(const color of cells)if(color)counts.set(color,(counts.get(color)||0)+1)
  document.getElementById('total').textContent=`${[...counts.values()].reduce((a,b)=>a+b,0)} 颗`
  swatches.replaceChildren(...[...counts].sort((a,b)=>b[1]-a[1]).map(([color,count])=>{
    const button=document.createElement('button');button.className=`swatch${selectedColor===color?' active':''}`
    const dot=document.createElement('i');dot.style.background=color.hex
    const label=document.createElement('span');label.textContent=`${color.code} · ${color.name}`
    const amount=document.createElement('code');amount.textContent=`× ${count}`
    button.append(dot,label,amount);button.addEventListener('click',()=>selectColor(color));return button
  }))
  document.getElementById('eraser').classList.toggle('active',selectedColor===null)
}

function selectColor(color){selectedColor=color;updateMaterials();document.getElementById('tip').textContent=color?`画笔：${color.code} ${color.name}`:'橡皮已选中 · 点击豆子可留空'}

function paint(event){
  const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*canvas.width/rect.width,y=(event.clientY-rect.top)*canvas.height/rect.height
  const col=Math.floor((x-MARGIN)/CELL),row=Math.floor((y-MARGIN)/CELL)
  if(col<0||col>=cols||row<0||row>=rows)return
  const index=row*cols+col
  if(selectedColor===undefined){if(cells[index])selectColor(cells[index]);return}
  cells[index]=selectedColor;draw();updateMaterials()
}

function download(){
  canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`拼豆图纸-${cols}x${rows}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)},'image/png')
}
