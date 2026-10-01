// Run: node toys/tiananmen/check.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root=new URL('./',import.meta.url);
const glb=await readFile(new URL('assets/tiananmen-imported.glb',root));
assert.equal(glb.readUInt32LE(0),0x46546c67,'glTF magic');
assert.equal(glb.readUInt32LE(4),2,'glTF 2');
assert.equal(glb.readUInt32LE(8),glb.length,'complete binary');
assert.ok(glb.length<100*1024*1024,'detailed imported model under 100 MB');
const model=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
for(const mesh of model.meshes)for(const p of mesh.primitives){
 const position=model.accessors[p.attributes.POSITION];
 assert.ok(position.count>0,'nonempty mesh');
 for(const bound of [position.min,position.max])assert.ok(bound.every(Number.isFinite),'finite mesh bounds');
 if(p.indices!==undefined){const index=model.accessors[p.indices];if(index.max)assert.ok(index.max[0]<position.count,'triangle indices within mesh');}
}
assert.ok(model.images.length>=20,'original textures embedded');
const cloth=model.materials.findIndex(m=>m.name==='Mat3d66-10107180-63-37768');
assert.ok(cloth>=0&&model.meshes.some(m=>m.primitives.some(p=>p.material===cloth&&model.accessors[p.attributes.POSITION].count>=8880)),'source cloth identifiable for reversible hiding');
assert.ok(model.materials.some(m=>m.name==='Mat3d66-10107180-62-24149'),'original balcony poles retained');
assert.ok(model.materials.some(m=>m.name.startsWith('Facade left inscription')),'left inscription isolated');
const report=JSON.parse(await readFile(new URL('assets/imported-model-check.json',root),'utf8'));
assert.equal(report.assetId,'A127140214');assert.ok(report.repairedMaterials>=100,'V-Ray texture links repaired');
const registry=JSON.parse(await readFile(new URL('../registry.json',root),'utf8'));
assert.equal(registry.filter(t=>t.slug==='tiananmen').length,1,'one gallery entry');
const page=await readFile(new URL('index.html',root),'utf8');
for(const id of ['scene','night','detail','aerial','orbit','reset','fireworks','save'])assert.ok(page.includes(`id="${id}"`),`control ${id}`);
console.log(`Imported model, embedded textures, bounds, indices and gallery passed (${(glb.length/1024/1024).toFixed(1)} MB).`);
