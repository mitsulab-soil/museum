/* Original architectural detail, 2026-10-18. Existing CC0 maps stay credited.
   No work image, creature, book, audio, or movement is edited here. Metres. */
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const stats={status:'waiting',materials:0,frames:0,trees:0,glass:0,contact:0,artMapsChanged:0};
const idle=()=>new Promise(r=>(window.requestIdleCallback||((f)=>setTimeout(f,24)))(r,{timeout:150}));
function relief(kind){const c=document.createElement('canvas');c.width=c.height=128;const q=c.getContext('2d'),im=q.createImageData(128,128);let seed=431;for(let y=0;y<128;y++)for(let x=0;x<128;x++){seed=(seed*1664525+1013904223)>>>0;const noise=(seed/4294967296-.5),wave=kind==='wood'?Math.sin(x*.21+Math.sin(y*.037)*1.4)*12+Math.sin(x*.75+y*.01)*5:noise*12;const v=128+wave+noise*5,k=(y*128+x)*4;im.data[k]=im.data[k+1]=im.data[k+2]=v;im.data[k+3]=255;}q.putImageData(im,0,0);const tx=new T.CanvasTexture(c);tx.wrapS=tx.wrapT=T.RepeatWrapping;tx.name='自作の微細'+kind;return tx;}
const woodRelief=()=>relief('wood'),wallRelief=()=>relief('plaster');
function outline(w,h){const s=new T.Shape();s.moveTo(-w/2,-h/2);s.lineTo(w/2,-h/2);s.lineTo(w/2,h/2);s.lineTo(-w/2,h/2);s.closePath();return s;}
function ring(ww,hh,fr){const outer=outline(ww+fr*2,hh+fr*2),hole=new T.Path();hole.moveTo(-ww/2-.004,-hh/2-.004);hole.lineTo(-ww/2-.004,hh/2+.004);hole.lineTo(ww/2+.004,hh/2+.004);hole.lineTo(ww/2+.004,-hh/2-.004);hole.closePath();outer.holes.push(hole);const g=new T.ExtrudeGeometry(outer,{depth:.052,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:Math.min(.006,fr*.15),bevelThickness:.004,curveSegments:1});g.translate(0,0,-.026);g.name='実寸の面取りと開口を持つ額';return g;}
function refineFrame(o,ww,hh,fr){if(!o||o.userData.architectureFrame)return;o.geometry.dispose();o.geometry=ring(ww,hh,fr);o.userData.architectureFrame=true;stats.frames++;}
function alphaLeaf(){const c=document.createElement('canvas');c.width=c.height=64;const q=c.getContext('2d');q.clearRect(0,0,64,64);q.fillStyle='#b5c597';q.beginPath();q.moveTo(8,58);q.bezierCurveTo(-2,29,27,10,57,6);q.bezierCurveTo(56,35,38,62,8,58);q.fill();q.strokeStyle='#dce0b6';q.lineWidth=1.5;q.beginPath();q.moveTo(8,58);q.lineTo(55,8);q.stroke();const m=new T.CanvasTexture(c);m.colorSpace=T.SRGBColorSpace;return m;}
function twig(a,b,r,geos){const d=b.clone().sub(a),g=new T.CylinderGeometry(r*.35,r,d.length(),5,1);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*(2*Math.PI*r/1.8),uv.getY(i)*(d.length()/1.8));g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());geos.push(g);}
async function buildTree(){const geos=[];twig(new T.Vector3(0,0,0),new T.Vector3(.10,5.5,.06),.28,geos);const leafTransforms=[],dummy=new T.Object3D();for(let k=0;k<18;k++){const ang=k*2.3999,y=2.3+k*.19,length=2.4*(1-k*.028),a=new T.Vector3(.04,y,.03),b=new T.Vector3(Math.cos(ang)*length,y+1.3,Math.sin(ang)*length);twig(a,b,.09*(1-k*.025),geos);for(let j=0;j<4;j++){const f=(j+1)/4,start=a.clone().lerp(b,f),tip=start.clone().add(new T.Vector3(Math.cos(ang+j)*.65,.3,Math.sin(ang+j)*.65));twig(start,tip,.027,geos);for(let n=0;n<8;n++){const t=(n+.5)/8,p=start.clone().lerp(tip,t);p.x+=Math.sin(n*4.3+k)*.22;p.z+=Math.cos(n*3.7+k)*.22;dummy.position.copy(p);dummy.rotation.set(Math.sin(k+n)*.8,ang+n*1.7,Math.sin(n+k)*1.2);dummy.scale.set(.27,.44,1);dummy.updateMatrix();leafTransforms.push(dummy.matrix.clone());}}}const geo=mergeGeometries(geos,false);for(const g of geos)g.dispose();const loader=new T.TextureLoader();let maps={};try{const [map,normalMap]=await Promise.all([loader.loadAsync('tex/architecture_bark_c.jpg'),loader.loadAsync('tex/architecture_bark_n.png')]);map.colorSpace=T.SRGBColorSpace;for(const t of [map,normalMap]){t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;}maps={map,normalMap,normalScale:new T.Vector2(.32,.32)};}catch(e){console.warn('館外の樹皮は単色で続けます',e);}const bark=new T.MeshStandardMaterial({color:0xe1d9ca,roughness:.94,...maps});const leaves=new T.MeshStandardMaterial({color:0x718857,map:alphaLeaf(),alphaTest:.45,side:T.DoubleSide,roughness:.92});const root=new T.Group();root.name='枝と透過葉で作った創作の館外樹木';root.add(new T.Mesh(geo,bark));const im=new T.InstancedMesh(new T.PlaneGeometry(1,1),leaves,leafTransforms.length);leafTransforms.forEach((m,i)=>im.setMatrixAt(i,m));root.add(im);return root;}
function contactMap(){const c=document.createElement('canvas');c.width=c.height=64;const q=c.getContext('2d'),g=q.createRadialGradient(32,32,2,32,32,31);g.addColorStop(0,'rgba(17,13,8,.36)');g.addColorStop(.3,'rgba(17,13,8,.16)');g.addColorStop(1,'rgba(17,13,8,0)');q.fillStyle=g;q.fillRect(0,0,64,64);return new T.CanvasTexture(c);}
let ped=null;
export async function install(ctx){if(stats.status!=='waiting')return;stats.status='refining';stats.startedAt=performance.now();window.__museumArchitecture={stats,refineFrame};const {scene,world,mats,floors,bays,E,STEPS,PLAZA_Y}=ctx,wood=woodRelief(),plaster=wallRelief(),seen=new Set();
 // Explicit architecture material references only. Never traverse/replace art materials.
 for(const m of [mats.woodMat,mats.darkWood,mats.frameMat]){m.metalness=0;m.roughness=.55;m.bumpMap=wood;m.bumpScale=.003;m.needsUpdate=true;seen.add(m);}
 for(const m of [mats.brassMat,mats.giltMat]){m.roughness=.36;m.envMapIntensity=.8;m.needsUpdate=true;seen.add(m);}
 for(const o of world.children){const tag=o.userData.tag||'';if(/^wall/.test(tag)&&o.material?.isMeshStandardMaterial){o.material.bumpMap=plaster;o.material.bumpScale=.0025;o.material.roughness=.92;o.material.needsUpdate=true;seen.add(o.material);}}
 for(const f of floors){const m=f.material;if(!m?.isMeshStandardMaterial)continue;/* Keep parquet's existing metre UVs and normal/roughness maps. */if(m.normalScale)m.normalScale.setScalar(.16);if(m.roughnessMap)m.roughness=Math.max(.38,m.roughness);m.envMapIntensity=Math.min(m.envMapIntensity??1,.75);m.needsUpdate=true;seen.add(m);}
 stats.materials=seen.size;await idle();
 // The introductory creature paintings share this explicit gilt frame material. Only their empty border geometry changes.
 world.traverse(o=>{const p=o.geometry?.parameters;if(o.material===mats.giltMat&&o.geometry?.type==='BoxGeometry'&&p.depth===.07&&p.width>.3&&p.height>.3)refineFrame(o,p.width-.16,p.height-.16,.08);});
 for(const b of bays)for(const sl of b.slots){if(!sl.mesh||sl.quote)continue;const f=sl.mesh.children.find(o=>o.material===mats.frameMat||o.material===mats.giltMat);const img=sl.mesh.children.find(o=>o.material?.emissiveMap&&o.geometry?.type==='PlaneGeometry');if(f&&img)refineFrame(f,img.geometry.parameters.width,img.geometry.parameters.height,sl.w.t==='photo'?.02:.07);}
 await idle();const template=await buildTree();for(let k=0;k<10;k++){const sgn=k%2?1:-1,u=STEPS+3+Math.floor(k/2)*7,p=E(u,sgn*(15+k%3*2.5)),g=template.clone(true);g.position.set(p.x,PLAZA_Y,p.z);g.rotation.y=k*2.4;g.scale.setScalar(.91+(k%4)*.08);world.add(g);stats.trees++;}for(const o of world.children)if(['bark','leaf'].includes(o.userData.tag))o.visible=false;
 await idle();const cm=new T.MeshBasicMaterial({map:contactMap(),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});for(let k=0;k<10;k++){const p=E(STEPS+3+Math.floor(k/2)*7,(k%2?1:-1)*(15+k%3*2.5)),s=new T.Mesh(new T.PlaneGeometry(1.7,1.7),cm);s.rotation.x=-Math.PI/2;s.position.set(p.x,PLAZA_Y+.012,p.z);world.add(s);stats.contact++;}
 // Thin glass rim of the central digital-map display. No full-scene transmission pass.
 const glass=new T.MeshPhysicalMaterial({color:0xd9ece8,metalness:0,roughness:.12,transparent:true,opacity:.10,depthWrite:false,side:T.DoubleSide,ior:1.5,reflectivity:.45,clearcoat:1,clearcoatRoughness:.12});const rim=new T.Mesh(new T.CylinderGeometry(.79,.79,.20,48,1,true),glass);rim.name='地図展示台の薄いガラス縁';rim.position.set(0,1.02,-1.9);scene.add(rim);stats.glass++;
 ped=scene.children.find(g=>g.isGroup&&g.position.z===-1.9&&g.children.some(o=>o.geometry?.type==='CylinderGeometry'));if(ped){const col=ped.children.find(o=>o.geometry?.parameters?.height===.86);if(col){const old=col.geometry;col.geometry=new T.LatheGeometry([new T.Vector2(.72,-.43),new T.Vector2(.72,-.38),new T.Vector2(.67,-.34),new T.Vector2(.61,.32),new T.Vector2(.65,.36),new T.Vector2(.65,.43)],32);old.dispose();col.material.roughness=.66;}}
 await idle();SCN=scene;await aged(mats);await idle();patina({scene,world,mats,ped});
 stats.finishedAt=performance.now();stats.status='ready';}
// 2026-11-23 本人「歴史がつみ重なった重厚感」：明治〜昭和初期の石造の館（表慶館の円堂・石の壁・寄木の床）を手本に、
// 手続きで描いた石・漆喰・床の絵を Poly Haven の CC0 写真の質感（Marble 01＝石灰岩の切石・Plastered Wall 04・Herringbone Parquet・Dark Paneled Wood）に差しかえる。
// 起動を待たせないよう、建物を出したあとに絵（image）だけを入れかえる（材質の組み直しは起きない）。
function img(u){return new Promise(r=>{const i=new Image();i.decoding='async';i.onload=()=>r(i);i.onerror=()=>r(null);i.src=u;});}
let SCN=null;const KEYS=['map','normalMap','roughnessMap'];
// 絵の大きさが違うので image を差しかえず、新しい質感を作り、同じ質感を使っている材質（写しを含む）をすべて付けかえる（材質の組み直しは起きない）
async function swap(t,u){if(!t)return;const i=await img(u);if(!i)return;const n=new T.Texture(i);n.wrapS=t.wrapS;n.wrapT=t.wrapT;n.repeat.copy(t.repeat);n.offset.copy(t.offset);n.colorSpace=t.colorSpace;n.anisotropy=t.anisotropy||8;n.needsUpdate=true;
 SCN.traverse(o=>{const ms=Array.isArray(o.material)?o.material:o.material?[o.material]:[];for(const m of ms)for(const k of KEYS)if(m[k]&&(m[k]===t||m[k].source===t.source)){const r=m[k].repeat.clone(),of=m[k].offset.clone();const c=n.clone();c.repeat.copy(r);c.offset.copy(of);m[k]=c;}});
 stats.swapped=(stats.swapped||0)+1;return n;}
function tl(u,srgb){return img(u).then(i=>{if(!i)return null;const t=new T.Texture(i);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;if(srgb)t.colorSpace=T.SRGBColorSpace;t.needsUpdate=true;return t;});}
// 2 周目：繰り返しを崩す汚れ・擦れ（広間の床の縁ほど煤け、歩く所は磨かれて明るい）、窓からの斜光とほこりの光、台座を古びさせる
function canvas(n,draw){const c=document.createElement('canvas');c.width=c.height=n;draw(c.getContext('2d'),n);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
function patina({scene,world,mats,ped}){let seed=97;const r=()=>(seed=(seed*16807)%2147483647)/2147483647;
 let lob=null;world.traverse(o=>{if(!lob&&o.isMesh&&o.material===mats.lobbyFloorMat)lob=o;});
 if(lob){lob.geometry.computeBoundingBox();const b=lob.geometry.boundingBox.clone().applyMatrix4(lob.matrixWorld),sz=new T.Vector3(),c=new T.Vector3();b.getSize(sz);b.getCenter(c);const R=Math.max(sz.x,sz.z);
  const tex=canvas(512,(g,n)=>{const h=n/2;let gr=g.createRadialGradient(h,h,n*.18,h,h,h);gr.addColorStop(0,'rgba(40,28,14,.04)');gr.addColorStop(.55,'rgba(40,28,14,.16)');gr.addColorStop(1,'rgba(30,20,10,.5)');g.fillStyle=gr;g.fillRect(0,0,n,n);
   for(let i=0;i<260;i++){const x=r()*n,y=r()*n,rr=6+r()*48,a=.05+r()*.1;const q=g.createRadialGradient(x,y,0,x,y,rr);q.addColorStop(0,`rgba(${r()<.5?'52,36,18':'20,14,8'},${a})`);q.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=q;g.fillRect(x-rr,y-rr,rr*2,rr*2);}
   for(let i=0;i<90;i++){g.strokeStyle=`rgba(28,20,10,${.04+r()*.05})`;g.lineWidth=.6+r();g.beginPath();const x=r()*n,y=r()*n;g.moveTo(x,y);g.lineTo(x+(r()-.5)*90,y+(r()-.5)*90);g.stroke();}});
  const ov=new T.Mesh(new T.PlaneGeometry(R,R),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));ov.rotation.x=-Math.PI/2;ov.position.set(c.x,b.max.y+.006,c.z);ov.renderOrder=1;ov.name='床の汚れと擦れ';world.add(ov);
  // 高い窓から差す斜めの光（ほこりの光）。三本、床へ斜めに落ちる
  const sh=canvas(128,(g,n)=>{const gr=g.createLinearGradient(0,0,n,0);gr.addColorStop(0,'rgba(255,230,180,0)');gr.addColorStop(.5,'rgba(255,230,180,1)');gr.addColorStop(1,'rgba(255,230,180,0)');g.fillStyle=gr;g.fillRect(0,0,n,n);const v=g.createLinearGradient(0,0,0,n);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(.25,'rgba(0,0,0,1)');v.addColorStop(1,'rgba(0,0,0,.2)');g.globalCompositeOperation='destination-in';g.fillStyle=v;g.fillRect(0,0,n,n);});
  const sm=new T.MeshBasicMaterial({map:sh,transparent:true,opacity:.24,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false,fog:false});
  for(const [x,z,ry,len] of [[-3.2,-4.5,.35,10],[3.6,-3.8,-.4,11],[-.6,-6.2,.1,12]]){const q=new T.Mesh(new T.PlaneGeometry(1.6,len),sm);q.position.set(c.x+x,b.max.y+len*.42,c.z+z);q.rotation.set(0,ry,0);q.rotateX(-.5);q.name='斜光';world.add(q);}
 }
 // 台座：新品の白でなく、手ずれと年月で黄ばんだ石
 if(ped){const o=ped.children.find(o=>o.isMesh);if(o){o.material=new T.MeshStandardMaterial({color:0xc9b896,roughness:.62,map:mats.marbleMat?.map||null,normalMap:mats.marbleMat?.normalMap||null,envMapIntensity:.5});stats.ped=1;}}
}
async function aged(m){const P='tex/ph/';
 // 石の壁：切石の目地と、手と年月でついた汚れ・艶むら
 await swap(m.T_STONE,P+'marb_c.webp');await swap(m.stoneMat?.normalMap,P+'marb_n.webp');if(m.stoneMat){m.stoneMat.color.set(0xd6c6aa);m.stoneMat.normalScale.set(.9,.9);m.stoneMat.roughness=.78;}
 await idle();
 // 部屋の漆喰：時を経て少しくすんだ鏝むら
 await swap(m.T_PLASTER,P+'plas_c.webp');
 await idle();
 // 寄木（ヘリンボーン）の床。歩く筋に擦れ・艶
 if(m.parquet){for(const [k,f] of [['map','herr_c'],['normalMap','herr_n'],['roughnessMap','herr_r']]){const n=await swap(m.parquet[k],P+f+'.webp');if(n)m.parquet[k]=n;}}
 await idle();
 // 腰板・梁の木：鏡板の組み（重い色の古材）
 await swap(m.T_WOOD,P+'pnl_c.webp');if(m.woodMat)m.woodMat.color.set(0xe6d2bd);
 // 大理石の柱と市松の床：真っ白でなく、年月で黄みを帯びた石に
 if(m.marbleMat){const t=await tl(P+'marb_c.webp',true);if(t){t.repeat.set(.7,1.6);m.marbleMat.map=t;}const n=await tl(P+'marb_n.webp');if(n&&m.marbleMat.normalMap){n.repeat.set(.7,1.6);m.marbleMat.normalMap=n;}m.marbleMat.color.set(0xf2e6d0);m.marbleMat.roughness=.42;}
 if(m.lobbyFloorMat){m.lobbyFloorMat.color.set(0xcfc2aa);m.lobbyFloorMat.roughness=.5;m.lobbyFloorMat.normalScale?.set(.5,.5);}
}

