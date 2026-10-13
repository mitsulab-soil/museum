/* © mitsulab. 生きものの写実の造形（2026-10-12）。
   図鑑・教科書の形態（脚・翅・羽・指の数と並び、模様）にそって、画面の中でその場で組み立てる。外から取りこんだ 3D はない。
   向き：頭が +Z、背が +Y。長さの単位は「体の長さ＝1」（呼ぶ側で縮める）。歩く生きものは足もとが y=0。
   形の根拠：資料/調べたこと/形態の確かめ.md（2026-10-12 追記）。 */
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2, clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// 折れ線の表：[[t, 値], …] を t で引く
const tab = rows => t => { if (t <= rows[0][0]) return rows[0][1]; for (let i = 1; i < rows.length; i++) if (t <= rows[i][0]) { const [a, va] = rows[i - 1], [b, vb] = rows[i]; const u = (t - a) / (b - a), s = u * u * (3 - 2 * u); return lerp(va, vb, s); } return rows[rows.length - 1][1]; };
const C = new T.Color(), C2 = new T.Color();
const mixc = (a, b, t) => C2.setHex(a).lerp(C.setHex(b), clamp(t, 0, 1)).clone();

// 既定の質感（呼ぶ側が受けとり方の質感を渡すときは、それを使う）
//   2026-10-13：o.phys があれば MeshPhysicalMaterial（クリアコート＝濡れた艶・シーン＝毛や鱗粉のやわらかな照り・薄膜の虹色）。
//   o.nmap＝法線の地図、o.hook＝シェーダーへの書き足し（毛・透け）。呼ぶ側（umwelt.js の M）も同じ名前で受ける。
export function stdMat(hex, o = {}) {
  const base = { color: hex, map: o.map || null, vertexColors: !!o.vc, roughness: o.rough ?? .7, metalness: 0, side: o.side ?? T.FrontSide, transparent: !!o.transparent, alphaTest: o.alphaTest || 0, normalMap: o.nmap || null };
  const m = o.phys ? new T.MeshPhysicalMaterial({ ...base, ...o.phys }) : new T.MeshStandardMaterial(base);
  if (o.nmap && o.ns != null) m.normalScale.set(o.ns, o.ns);
  if (o.hook) { m.onBeforeCompile = sh => o.hook(sh); m.customProgramCacheKey = () => 'cr' + (o.key || '') + m.type; }
  return m;
}
function mk(mat, hex, o = {}) {
  const m = mat(hex, { std: true, rough: .7, ...o });
  if (o.opacity != null) { m.opacity = o.opacity; m.transparent = true; }
  if (o.depthWrite === false) m.depthWrite = false;
  return m;
}

// ---------------------------------------------------------------- 絵の具（一度だけ描いて、みなで使う）
const TEX = {};
function ctex(key, w, h, draw, rep = [1, 1], srgb = true) {
  if (!TEX[key]) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); if (srgb) t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; TEX[key] = t; }
  const t = TEX[key]; if (rep[0] === 1 && rep[1] === 1) return t; const k = key + rep.join('x'); if (!TEX[k]) { TEX[k] = t.clone(); TEX[k].repeat.set(...rep); TEX[k].needsUpdate = true; } return TEX[k];
}
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
// 毛並み：細い筋の明暗（白に近い灰。頂点の色にかける）
const furTex = rep => ctex('fur', 128, 128, (g, w, h) => { g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { const v = 150 + rnd() * 105 | 0; g.strokeStyle = `rgba(${v},${v},${v},.55)`; g.lineWidth = .8; const x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 2, y + 3 + rnd() * 5); g.stroke(); } }, rep);
// 羽：重なった小羽のうろこ
const plumeTex = rep => ctex('plume', 128, 128, (g, w, h) => { g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, w, h); for (let y = -8; y < h + 8; y += 8) for (let x = (y / 8 % 2) * 6 - 6; x < w + 8; x += 12) { const gr = g.createRadialGradient(x, y, 1, x, y + 3, 8); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(.75, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(60,60,60,.35)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y + 2, 7, 6, 0, 0, Math.PI); g.fill(); } }, rep);
// へびの鱗：竜骨のある菱形の並び
const scaleTex = rep => ctex('scale', 64, 64, (g, w, h) => { g.fillStyle = '#e0e0e0'; g.fillRect(0, 0, w, h); for (let y = 0; y <= h; y += 8) for (let x = (y / 8 % 2) * 8; x <= w; x += 16) { g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 7, y); g.lineTo(x, y + 7); g.lineTo(x - 7, y); g.closePath(); g.fill(); g.strokeStyle = 'rgba(40,40,40,.45)'; g.lineWidth = 1; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x, y + 5); g.stroke(); } }, rep);

// ---------------------------------------------------------------- 形の道具
// 曲線にそって楕円の断面をつなぐ（体・首・頭・脚・尾）。colorFn(t, sx, cy, x, y, z)：sx＝横（+X 側が +1）、cy＝上が +1
function sweep(pts, rx, ry, colorFn, o = {}) {
  const curve = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p)), false, 'centripetal');
  const N = o.n ?? 28, R = o.r ?? 14, n = (N + 1) * (R + 1);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const P = new T.Vector3(), Tg = new T.Vector3(), side = new T.Vector3(), up = new T.Vector3(), ref = new T.Vector3(...(o.up || [0, 1, 0]));
  let k = 0;
  for (let i = 0; i <= N; i++) {
    const t = i / N; curve.getPointAt(t, P); curve.getTangentAt(t, Tg);
    side.crossVectors(ref, Tg); if (side.lengthSq() < 1e-8) side.set(1, 0, 0); side.normalize(); up.crossVectors(Tg, side).normalize();
    const ax = typeof rx === 'function' ? rx(t) : rx, ay = typeof ry === 'function' ? ry(t) : ry;
    for (let j = 0; j <= R; j++, k++) {
      const a = j / R * TAU, sx = Math.sin(a), cy = Math.cos(a), m = o.k ? o.k(t, sx, cy) : 1;
      const x = P.x + (side.x * sx * ax + up.x * cy * ay) * m, y = P.y + (side.y * sx * ax + up.y * cy * ay) * m, z = P.z + (side.z * sx * ax + up.z * cy * ay) * m;
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      const c = colorFn ? colorFn(t, sx, cy, x, y, z) : 0xffffff; if (c.isColor) C.copy(c); else C.setHex(c);
      col[k * 3] = C.r; col[k * 3 + 1] = C.g; col[k * 3 + 2] = C.b; uv[k * 2] = t; uv[k * 2 + 1] = j / R;
    }
  }
  const idx = []; for (let i = 0; i < N; i++) for (let j = 0; j < R; j++) { const a = i * (R + 1) + j, b = a + R + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); seam(g, N, R); return g;
}
function seam(g, N, R) { const nr = g.attributes.normal; for (let i = 0; i <= N; i++) { const a = i * (R + 1), b = a + R; const x = nr.getX(a) + nr.getX(b), y = nr.getY(a) + nr.getY(b), z = nr.getZ(a) + nr.getZ(b), l = Math.hypot(x, y, z) || 1; nr.setXYZ(a, x / l, y / l, z / l); nr.setXYZ(b, x / l, y / l, z / l); } }
const ell = (mat, cx, cy, cz, rx, ry, rz, segs = 16) => { const m = new T.Mesh(new T.SphereGeometry(1, segs, Math.max(8, segs * .7 | 0)), mat); m.position.set(cx, cy, cz); m.scale.set(rx, ry, rz); return m; };
// 平らな形（翅・羽・耳）。2D（x＝外へ, y＝前へ）を 3D（x, 0, y）へ。uv は外形の枠に合わせる
function flatShape(pts, smoothN = 0) {
  const s = new T.Shape(); s.moveTo(...pts[0]); if (smoothN) s.splineThru(pts.slice(1).map(p => new T.Vector2(...p)).concat([new T.Vector2(...pts[0])])); else { for (const p of pts.slice(1)) s.lineTo(...p); s.closePath(); }
  const g = new T.ShapeGeometry(s, smoothN || 1); g.computeBoundingBox(); const bb = g.boundingBox, w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y, p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - bb.min.x) / w, (p.getY(i) - bb.min.y) / h);
  g.userData.bb = { x0: bb.min.x, x1: bb.max.x, y0: bb.min.y, y1: bb.max.y }; g.rotateX(Math.PI / 2); return g;
}
// 外形をなめらかに（閉じた折れ線を Catmull-Rom で細かく分ける）。2026-10-13：翅のふちが多角形で角ばって見えたため。
//   sharp に入れた番号の点（アゲハの尾の先など）は、角を残す
function smoothPts(pts, sub = 4, sharp = []) {
  const n = pts.length, out = [], P = i => pts[(i + n) % n];
  for (let i = 0; i < n; i++) { const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2); out.push(p1);
    if (sharp.includes(i) || sharp.includes((i + 1) % n)) continue;
    for (let k = 1; k < sub; k++) { const t = k / sub, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); } }
  return out;
}
// 外形の枠の座標で描く絵の具
function shapeTex(key, geo, pts, draw, size = 512) {
  const bb0 = geo.userData.bb, ar = (bb0.y1 - bb0.y0) / (bb0.x1 - bb0.x0);
  return ctex(key, size, Math.max(32, Math.round(size * ar / 8) * 8), (g, W, H) => { const b = geo.userData.bb, sx = W / (b.x1 - b.x0), sy = H / (b.y1 - b.y0);
    g.setTransform(sx, 0, 0, -sy, -b.x0 * sx, b.y1 * sy); const path = new Path2D(); path.moveTo(...pts[0]); for (const p of pts.slice(1)) path.lineTo(...p); path.closePath();
    g.save(); g.clip(path); draw(g, path, 1 / sx); g.restore(); });
}
const tube = (mat, pts, r0, r1, colorFn, n = 10, rs = 6) => new T.Mesh(sweep(pts, t => lerp(r0, r1, t), t => lerp(r0, r1, t), colorFn, { n, r: rs }), mat);

// ================================================================ 質感の道具（2026-10-13 毛・艶・透け）
//   本人「動物の３dについて造形だけでなく、毛や光沢感、生き物らしさなどこだわってください」。
//   絵の具・法線の地図は、すべてこの画面の中で描く（外から取りこんだ画像はない）。
const MOBILE = typeof window !== 'undefined' && (innerWidth < 700 || (window.matchMedia && matchMedia('(pointer:coarse)').matches));
// 毛の層の数（スマホは少なく）。0 にすると毛の層を作らない
export const FUR = { shells: MOBILE ? 7 : 14 };
// 高さの絵から、法線の地図を作る（線形の色。凹凸の向きは OpenGL の流儀）
function nmap(key, w, h, draw, k = 2, rep = [1, 1]) {
  return ctex(key, w, h, (g, W, H) => { draw(g, W, H); const s = g.getImageData(0, 0, W, H).data, out = g.createImageData(W, H), o = out.data, hg = (x, y) => s[(((y + H) % H) * W + ((x + W) % W)) * 4] / 255;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (hg(x + 1, y) - hg(x - 1, y)) * k, dy = (hg(x, y + 1) - hg(x, y - 1)) * k, l = Math.hypot(dx, dy, 1), i = (y * W + x) * 4;
      o[i] = (-dx / l * .5 + .5) * 255; o[i + 1] = (dy / l * .5 + .5) * 255; o[i + 2] = (1 / l * .5 + .5) * 255; o[i + 3] = 255; }
    g.putImageData(out, 0, 0); }, rep, false);
}
// 複眼：六角の小さな面（個眼）が並ぶ
const facetN = rep => nmap('facet', 96, 96, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const r = 6; for (let y = -r; y < h + r; y += r * 1.5) for (let x = -r; x < w + r; x += r * Math.sqrt(3)) { const ox = (Math.round(y / (r * 1.5)) % 2) * r * Math.sqrt(3) / 2; const gr = g.createRadialGradient(x + ox, y, 0, x + ox, y, r); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.beginPath(); g.arc(x + ox, y, r, 0, TAU); g.fill(); } }, 1.4, rep);
// 目：濡れた角膜の映りこみ（脊椎動物）。複眼は細かな面の照り
const wetEye = (mat, hex, o = {}) => mk(mat, hex, { rough: .22, phys: { clearcoat: 1, clearcoatRoughness: .03, ior: 1.376, specularIntensity: 1 }, temp: .9, ...o });
const compoundEye = (mat, hex, o = {}) => mk(mat, hex, { rough: .38, nmap: facetN([10, 6]), ns: .6, phys: { clearcoat: .55, clearcoatRoughness: .12 }, ...o });
// 層の順（どこで打ちきっても高さが散らばる＝遠くで層を減らしても毛の長さは変わらない）
const bitrev = n => { const a = []; for (let i = 0; i < n; i++) a.push(i); const key = i => { let r = 0, x = i, b = 1; while (b < n) { r = r * 2 + (x & 1); x >>= 1; b *= 2; } return r; }; return a.sort((p, q) => key(p) - key(q)); };
// 毛（シェル）：同じ形を、法線の向きへ少しずつずらして重ね、外の層ほど毛の本数を減らす。
//   根もとは暗く（毛のあいだの影）、先は明るい。毛は下へ少したれる。画面の上で小さいときは層を減らし、遠いと描かない。
//   o.len：長さ（数、または (u, v) → 長さ）。o.dens：毛の細かさ。o.thick：毛の太さ。o.root：根もとの暗さ。o.droop：たれ。
function furHook(o) { return sh => {
  sh.uniforms.uDroop = { value: o.droop ?? .4 }; sh.uniforms.uDens = { value: o.dens ?? 140 }; sh.uniforms.uRootK = { value: o.root ?? .55 }; sh.uniforms.uThick = { value: o.thick ?? .42 }; sh.uniforms.uComb = { value: new T.Vector3(...(o.comb || [0, 0, 0])) };
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aShell; attribute float aLen; uniform float uDroop, uDens; uniform vec3 uComb; varying float vShell; varying vec3 vFurP;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShell = aShell; vFurP = position * uDens;\ntransformed += normalize(objectNormal) * aShell * aLen; transformed.y -= aShell * aShell * aLen * uDroop; transformed += uComb * aShell * aShell * aLen;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uRootK, uThick; varying float vShell; varying vec3 vFurP;\nfloat fh13(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}')
    .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
{ vec3 c = floor(vFurP), f = fract(vFurP) - .5; float hh = .4 + .6 * fh13(c);
  vec3 j = vec3(fh13(c + 7.1), fh13(c + 3.7), fh13(c + 1.3)) - .5; float d = length(f - j * .3);
  vec3 c2 = floor(vFurP * 2.3 + 11.), f2 = fract(vFurP * 2.3 + 11.) - .5; float h2 = .25 + .3 * fh13(c2), d2 = length(f2);   // 下毛（細く短い）
  bool g1 = vShell < hh && d < uThick * (1.0 - vShell / hh) + .05, g2 = vShell < h2 && d2 < uThick * .8 * (1.0 - vShell / h2) + .04;
  if (!(g1 || g2)) discard;
  diffuseColor.rgb *= mix(uRootK, 1.0, smoothstep(0.0, .8, vShell)); }`);
}; }
function addFur(mesh, mat, o = {}) {
  const NS = o.n ?? FUR.shells; if (!NS) return null;
  const src = mesh.geometry, n = src.attributes.position.count, I = src.index.array, uvA = src.attributes.uv;
  const L = new Float32Array(n); for (let i = 0; i < n; i++) L[i] = typeof o.len === 'function' ? Math.max(0, o.len(uvA.getX(i), uvA.getY(i))) : o.len;
  const tri = []; for (let k = 0; k < I.length; k += 3) if (Math.max(L[I[k]], L[I[k + 1]], L[I[k + 2]]) > 1e-5) tri.push(I[k], I[k + 1], I[k + 2]);   // 毛のない所の面は重ねない
  const g = new T.BufferGeometry();
  for (const key of ['position', 'normal', 'color', 'uv']) { const a = src.attributes[key]; if (!a) continue; const out = new Float32Array(n * NS * a.itemSize); for (let s = 0; s < NS; s++) out.set(a.array, s * n * a.itemSize); g.setAttribute(key, new T.BufferAttribute(out, a.itemSize)); }
  const sh = new Float32Array(n * NS), ln = new Float32Array(n * NS), ord = bitrev(NS);
  for (let s = 0; s < NS; s++) { const hgt = (ord[s] + 1) / NS; for (let i = 0; i < n; i++) { sh[s * n + i] = hgt; ln[s * n + i] = L[i]; } }
  g.setAttribute('aShell', new T.BufferAttribute(sh, 1)); g.setAttribute('aLen', new T.BufferAttribute(ln, 1));
  const idx = new Uint32Array(tri.length * NS); for (let s = 0; s < NS; s++) for (let k = 0; k < tri.length; k++) idx[s * tri.length + k] = tri[k] + s * n; g.setIndex(new T.BufferAttribute(idx, 1));
  const m = new T.Mesh(g, mk(mat, 0xffffff, { vc: !!src.attributes.color, rough: o.rough ?? .92, key: 'fur', hook: furHook(o), phys: MOBILE ? undefined : (o.phys ?? { sheen: .35, sheenRoughness: .55, sheenColor: o.sheen ?? 0xfff0dc }), temp: o.temp ?? .9, uv: o.uv ?? .04 }));
  m.userData.noCast = true; m.raycast = () => {};
  // 画面の上の大きさで層を減らす（体の長さ 1 が、見る所からどれほどの大きさか）
  const per = tri.length, P = new T.Vector3(), Q = new T.Vector3(), lod = o.lod ?? [.012, .1];
  m.onBeforeRender = (r, s, cam) => { m.getWorldPosition(P); cam.getWorldPosition(Q); const f = m.matrixWorld.getMaxScaleOnAxis() / Math.max(1e-4, P.distanceTo(Q)); g.setDrawRange(0, per * Math.round(NS * clamp((f - lod[0]) / (lod[1] - lod[0]), 0, 1))); };
  mesh.add(m); return m;
}
// 透ける薄い膜（コウモリの皮膜・翅）：うしろから日が当たると、膜の色が明るく透ける。o.trans＝透ける色の強さ
function transHook(o) { return sh => {
  sh.uniforms.uTransC = { value: new T.Color(o.trans ?? 0xb0563c) };
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uTransC;')
    .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
for (int i = 0; i < NUM_DIR_LIGHTS; i++) { float bl = max(0.0, -dot(normal, directionalLights[i].direction)); reflectedLight.directDiffuse += diffuseColor.rgb * uTransC * directionalLights[i].color * bl; }
#endif`);
}; }
// 透明な翅：映りこみ（薄膜の虹色）が見えるぶんだけ、不透明に近づける（透明なまま照りを消さない）
function glintHook(o) { return sh => {
  sh.uniforms.uGlint = { value: o.glint ?? 1.6 };
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uGlint;')
    .replace('#include <opaque_fragment>', 'diffuseColor.a = clamp(diffuseColor.a + dot(reflectedLight.directSpecular + reflectedLight.indirectSpecular, vec3(.3, .59, .11)) * uGlint, 0.0, 1.0);\n#include <opaque_fragment>');
}; }
// 翅の薄膜の厚さのむら（根もとから先へ帯になる）：虹色の帯の地図（緑の値＝厚さ）
const thinFilm = key => ctex(key, 128, 64, (g, w, h) => { for (let x = 0; x < w; x++) { const u = x / w, v = .5 + .5 * Math.sin(u * 9 + Math.sin(u * 23) * .6); g.fillStyle = `rgb(${v * 255 | 0},${v * 255 | 0},${v * 255 | 0})`; g.fillRect(x, 0, 1, h); } for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * .15})`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 8 + rnd() * 20, 4 + rnd() * 10, rnd() * 3, 0, TAU); g.fill(); } }, [1, 1], false);
// ゆらぎ（いくつかの周期の和。乱数のように見えて、こまごとに飛ばない）
const wob = (t, s = 0) => (Math.sin(t * 1.13 + s) * .5 + Math.sin(t * 2.71 + s * 1.7) * .3 + Math.sin(t * 5.3 + s * 2.3) * .2);
// 間をおいて起きる動き（周期 per 秒のうち、len 秒だけ 0→1→0）。seed で生きものごとにずらす
const bout = (t, per, len, seed = 0) => { const k = Math.floor((t + seed) / per), x = (t + seed) - k * per, off = (Math.sin(k * 12.9898 + seed) * 43758.5453 % 1 + 1) % 1 * (per - len); return sstep(off, off + len * .2, x) * (1 - sstep(off + len * .8, off + len, x)); };
const hash1 = k => (Math.sin(k * 12.9898) * 43758.5453 % 1 + 1) % 1;

// ================================================================ ミツバチ（セイヨウミツバチの働き蜂・体長 12〜15 mm）
//   頭・胸・腹。複眼 2・単眼 3・膝状の触角 2。翅 4（前翅が大きい・前後は鉤でつながり一緒に動く）。脚 6（後脚の脛は平たい花粉かご）。
export function makeBee(mat = stdMat, o = {}) {
  const g = new T.Group(), parts = {}, body = new T.Group(); g.add(body);   // body＝ホバリングの小さなゆれ・姿勢（外側の g は呼ぶ側が動かす）
  const vc = (o2 = {}) => mk(mat, 0xffffff, { vc: true, rough: .6, ...o2 });
  // 腹（6 節の背板。前の 3 節は琥珀色に黒い後縁、後ろの 3 節は黒褐色に淡い毛の帯）。キチンの背板はつやがある
  //   2026-10-13：腹は胸とのつけ根を軸に、伸び縮み（腹のポンプ＝呼吸の動き）
  const abT = (t, cy) => { const s = clamp(t * 6.2, 0, 5.99), seg = s | 0, f = s - seg; return { seg, f, under: cy < -.35 }; };
  const ab = sweep([[0, .03, .13], [0, 0, -.05], [0, -.05, -.26], [0, -.1, -.45], [0, -.12, -.53]], tab([[0, .05], [.12, .13], [.32, .158], [.55, .14], [.8, .085], [1, 0]]), tab([[0, .05], [.12, .12], [.32, .145], [.55, .13], [.8, .08], [1, 0]]),
    (t, sx, cy) => { const { seg, f, under } = abT(t, cy); if (under) return mixc(0x8a6232, 0x4a3420, seg / 5); const amber = seg < 3; if (amber) return f > .62 ? 0x2a1c12 : f < .14 ? 0xd9b46a : 0xc98a2b; return f < .28 ? 0xb9a37a : 0x2c2016; }, { n: 40, r: 16 });
  ab.translate(0, -.02, -.12);
  const abG = new T.Group(); abG.position.set(0, .02, .12); body.add(abG);
  const abM = new T.Mesh(ab, vc({ temp: .3, rough: .42, phys: { clearcoat: .45, clearcoatRoughness: .3 } })); abG.add(abM);
  // 腹の毛：淡い帯（各節の前のふち）は長め、ほかは短くまばら
  addFur(abM, mat, { len: (u, v) => { const cy = Math.cos(v * TAU), { seg, f, under } = abT(u, cy); if (u > .97) return 0; if (under) return .004; return (seg < 3 ? f < .16 : f < .3) ? .016 : .0045; }, dens: 170, thick: .32, root: .7, droop: .25, temp: .3, sheen: 0xfff2d0 });
  // 胸（茶褐色の羽のように枝分かれした毛で厚くおおわれる。飛ぶ筋肉で温かい）
  const thC = (t, sx, cy) => cy > .2 ? 0xb08a56 : cy < -.4 ? 0x6b5236 : 0x957243;
  const thM = new T.Mesh(sweep([[0, .02, .13], [0, .05, .25], [0, .03, .37]], tab([[0, .07], [.25, .13], [.6, .135], [1, .06]]), tab([[0, .07], [.25, .13], [.6, .13], [1, .06]]), thC, { n: 16, r: 16 }), vc({ temp: .6, rough: .85 }));
  body.add(thM);
  addFur(thM, mat, { len: (u, v) => .034 * (1 - .4 * sstep(.7, 1, u)), dens: 150, thick: .4, root: .5, droop: .35, temp: .6, sheen: 0xfff0d0 });
  // 頭（前から見ると逆三角）。顔にも短い毛
  const head = new T.Mesh(sweep([[0, .0, .39], [0, .02, .45], [0, .01, .52]], tab([[0, .05], [.35, .125], [.7, .115], [1, .04]]), tab([[0, .06], [.35, .14], [.7, .13], [1, .05]]), (t, sx, cy) => cy > .6 ? 0x3a2c1e : 0x2a2018,
    { n: 12, r: 16, k: (t, sx, cy) => 1 - .3 * Math.max(0, -cy) }), vc({ temp: .4 }));
  body.add(head);
  addFur(head, mat, { len: (u, v) => u > .92 ? 0 : .014, dens: 170, thick: .35, root: .6, temp: .4, sheen: 0xf0e0c0 });
  // 複眼（個眼の六角の面が光る）と、単眼 3（つやのある小さな玉）
  const eyeM = compoundEye(mat, 0x2e2820, { uv: .05, temp: .35 });
  for (const s of [-1, 1]) { const e = ell(eyeM, s * .1, .04, .45, .045, .105, .07, 20); e.rotation.y = s * .25; body.add(e); }
  const ocM = wetEye(mat, 0x15110c, { temp: .35 });
  for (const [x, y, z] of [[0, .155, .45], [-.035, .145, .425], [.035, .145, .425]]) body.add(ell(ocM, x, y, z, .013, .013, .013, 8));
  const dark = mk(mat, 0x2a2018, { rough: .5, temp: .3, phys: { clearcoat: .3, clearcoatRoughness: .35 } });
  const ants = [];
  for (const s of [-1, 1]) {   // 触角：柄節（まっすぐ）→ ひじ → 鞭節。付け根を軸に、ゆっくり動かす
    const an = new T.Group(); an.position.set(s * .03, .05, .51); body.add(an); ants.push({ s, an });
    an.add(tube(dark, [[0, 0, 0], [s * .02, .08, .04], [s * .035, .14, .06]], .013, .011));
    an.add(tube(dark, [[s * .035, .14, .06], [s * .07, .15, .15], [s * .1, .1, .25], [s * .11, .05, .29]], .011, .009));
    body.add(ell(mk(mat, 0x5a3c1c, { rough: .5 }), s * .022, -.085, .495, .012, .022, .012, 8));   // 大あご
  }
  // 脚 6：基節・腿節・脛節・跗節。飛ぶときは垂らす
  const legs = new T.Group(); body.add(legs);
  const L = [[.32, [[.1, -.06, .05], [.12, -.17, .1], [.11, -.25, .13]], .016, false], [.25, [[.17, -.09, 0], [.22, -.22, -.04], [.24, -.32, -.07]], .017, false], [.17, [[.16, -.1, -.07], [.19, -.27, -.17], [.17, -.4, -.25]], .018, true]];
  for (const s of [-1, 1]) for (const [z, pts, r, hind] of L) {
    const a = [s * .055, -.07, z], P = [a, ...pts.map(([x, y, zz]) => [a[0] + s * x, a[1] + y, a[2] + zz])];
    // 脚の毛（2026-10-13）：働き蜂の脚は毛が多い（腿節・脛節に短い毛、跗節にも）。後脚の脛節の外側（花粉かご）はつるりとして、ふちを長い毛が囲む
    const legFur = (m, len) => addFur(m, mat, { n: MOBILE ? 4 : 8, len, dens: 260, thick: .34, root: .62, droop: .15, temp: .3, sheen: 0xf0e0c0, lod: [.02, .14] });
    const femur = tube(dark, [P[0], P[1]], r * 1.15, r); legs.add(femur); legFur(femur, .009); for (const J of [P[1], P[2]]) legs.add(ell(dark, J[0], J[1], J[2], r * 1.05, r * 1.05, r * 1.05, 8));   // 関節
    if (hind) { const tb = new T.Mesh(sweep([P[1], P[2]], .02, .034, () => 0x3a2a1a, { n: 6, r: 8 }), dark); legs.add(tb);   // 花粉かご（平たく幅の広い脛節。外側はなめらかでつやがあり、ふちを長い毛が囲む）
      legFur(tb, (u, v) => Math.abs(Math.cos(v * TAU)) > .75 ? .024 : 0);   // ふちの長い毛（かごの柵）
      if (o.pollen ?? true) { const m = [(P[1][0] + P[2][0]) / 2 + s * .03, (P[1][1] + P[2][1]) / 2, (P[1][2] + P[2][2]) / 2], pel = ell(pollenM(), m[0], m[1], m[2], .045, .062, .055, 14); pel.rotation.x = .5; legs.add(pel); } }   // 花粉だんご（花粉を蜜でかためて運ぶ）
    else { const ti = tube(dark, [P[1], P[2]], r, r * .85); legs.add(ti); legFur(ti, .008); }
    { const ta = tube(dark, [P[2], P[3], [P[3][0] + s * .01, P[3][1] - .025, P[3][2] + .02]], r * .7, r * .45); legs.add(ta); legFur(ta, .005); }
  }
  function pollenM() { return pollenM.m ||= mk(mat, 0xe2a23a, { rough: .95, nmap: nmap('pollen', 64, 64, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { const x = rnd() * w, y = rnd() * h, r = 1.5 + rnd() * 2.5, gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); } }, 2.5, [2, 2]), uv: .1, temp: .3 }); }
  // 翅：前翅（長さ 0.68）と後翅（0.48）。翅脈の絵（前縁の太い脈・縁紋・亜縁室 3）
  const fwP = smoothPts([[0, .01], [.18, .06], [.42, .085], [.6, .075], [.68, .04], [.67, -.005], [.6, -.05], [.44, -.1], [.24, -.105], [.09, -.06], [.02, -.03]], 4, [0]);
  const hwP = smoothPts([[0, 0], [.15, .03], [.34, .04], [.46, .02], [.48, -.012], [.42, -.05], [.26, -.08], [.1, -.06]], 4, [0]);
  const fwG = flatShape(fwP), hwG = flatShape(hwP);
  const wingTex = (key, geo, pts, fore) => shapeTex(key, geo, pts, (c, path, px) => { c.fillStyle = 'rgba(232,238,244,.34)'; c.fill(path); c.strokeStyle = 'rgba(70,52,34,.85)'; c.lineWidth = 2.2 * px;
    if (fore) { c.lineWidth = 4.5 * px; c.beginPath(); c.moveTo(0, .01); c.lineTo(.42, .08); c.lineTo(.6, .07); c.stroke(); c.lineWidth = 2.2 * px;
      c.beginPath(); c.moveTo(0, -.005); c.lineTo(.3, .04); c.lineTo(.44, .055); c.lineTo(.6, .05); c.stroke();                        // 径脈と縁紋のつけね
      c.beginPath(); c.ellipse(.52, .052, .085, .016, .05, 0, TAU); c.stroke();                                                       // 縁室（細長い）
      for (const x of [.35, .42, .5]) { c.beginPath(); c.moveTo(x, .045); c.lineTo(x - .03, -.04); c.stroke(); }                     // 亜縁室を区切る脈
      c.beginPath(); c.moveTo(.05, -.02); c.lineTo(.25, -.02); c.lineTo(.32, -.045); c.lineTo(.47, -.04); c.stroke();
      c.beginPath(); c.moveTo(.12, .02); c.lineTo(.18, -.07); c.stroke(); c.beginPath(); c.moveTo(.25, -.02); c.lineTo(.28, -.09); c.stroke(); }
    else { c.beginPath(); c.moveTo(0, .0); c.lineTo(.34, .035); c.stroke(); c.beginPath(); c.moveTo(.02, -.01); c.lineTo(.22, -.02); c.lineTo(.32, -.05); c.stroke(); c.beginPath(); c.moveTo(.15, -.015); c.lineTo(.2, -.07); c.stroke(); } }, 256);
  // 翅の膜は薄く透明で、厚さのむらで虹色が出る（薄膜の干渉）。翅脈は茶色
  const wingPhys = { iridescence: 1, iridescenceIOR: 1.56, iridescenceThicknessRange: [220, 680], iridescenceThicknessMap: thinFilm('beeFilm'), specularIntensity: 1 };
  const fwM = mk(mat, 0xffffff, { map: wingTex('beeFW', fwG, fwP, true), transparent: true, side: T.DoubleSide, depthWrite: false, rough: .12, uv: .25, temp: .3, phys: wingPhys, key: 'glint', hook: glintHook({ glint: 1.4 }) });
  const hwM = mk(mat, 0xffffff, { map: wingTex('beeHW', hwG, hwP, false), transparent: true, side: T.DoubleSide, depthWrite: false, rough: .12, uv: .25, temp: .3, phys: wingPhys, key: 'glint', hook: glintHook({ glint: 1.4 }) });
  // 羽ばたきの残像：1 秒に約 230 回・はばたきの振れ幅は約 90°（Altshuler ら 2005）。画面のこま数では止まって見えないので、
  //   翅がいちばん長くとどまる「折り返し」（振れの両はし）を濃く、まん中を淡くした扇のかすみで示す（写真のぶれと同じ見え方）
  const SW0 = -.68, SW1 = .88;   // 振れの範囲（前へ .88・後ろへ .68）
  const blurTex = ctex('beeBlur', 128, 128, (c, W, H) => { const im = c.createImageData(W, H), d = im.data; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = x / (W - 1) * 2 - 1, v = (1 - y / (H - 1)) * 2 - 1, r = Math.hypot(u, v), th = Math.atan2(v, u), xx = (th - (-SW1 + -SW0) / 2) / ((SW1 - SW0) / 2);
    const k = Math.abs(xx) < 1 ? 1 / Math.sqrt(Math.max(.06, 1 - xx * xx)) : 0, rad = sstep(.12, .3, r) * (1 - sstep(.9, 1, r)), i = (y * W + x) * 4; d[i] = 214; d[i + 1] = 220; d[i + 2] = 224; d[i + 3] = Math.min(255, 255 * .045 * k * rad * (1 + .4 * Math.sin(r * 40) ** 8)); } c.putImageData(im, 0, 0); });
  const blurM = mk(mat, 0xffffff, { map: blurTex, transparent: true, side: T.DoubleSide, depthWrite: false, uv: .2, temp: .3, rough: .3 });
  const wings = [];
  for (const s of [-1, 1]) {
    const fw = new T.Group(), hw = new T.Group(); fw.position.set(s * .07, .12, .3); hw.position.set(s * .07, .105, .22);
    const fm = new T.Mesh(fwG, fwM), hm = new T.Mesh(hwG, hwM); if (s < 0) { fm.scale.x = -1; hm.scale.x = -1; } fw.add(fm); hw.add(hm);
    const blur = new T.Mesh(new T.CircleGeometry(.7, 24, 0, TAU).rotateX(-Math.PI / 2), blurM); blur.position.copy(fw.position); blur.rotation.z = s * .14; if (s < 0) blur.scale.x = -1; blur.visible = false; body.add(blur);
    body.add(fw, hw); wings.push({ s, fw, hw, blur });
  }
  parts.wings = wings; parts.legs = legs; parts.body = body;
  g.userData = { kind: 'hachi', parts, state: o.state || 'fly', speed: 0, ph: o.ph || 0 };
  // 動き：飛ぶとき＝翅は毎こま違う位置（ストロボのように）＋残像の扇。体は小さくゆれ（ホバリングの修正）、速く進むほど体を前へ倒す。
  //   止まっているとき＝翅は腹の上にたたむ。腹をゆっくり伸び縮み（呼吸）、触角を動かす
  g.userData.animate = (t, moving = true) => {
    const fly = g.userData.state !== 'rest', ph = g.userData.ph, spd = clamp(g.userData.speed || 0, 0, 2);
    for (const w of wings) {
      if (fly) { const p = Math.random() * TAU, sw = (SW0 + SW1) / 2 + (SW1 - SW0) / 2 * Math.sin(p); w.fw.rotation.set(0, -w.s * sw, w.s * (.12 + .1 * Math.cos(p))); w.hw.rotation.copy(w.fw.rotation); w.blur.visible = true; }
      else { w.fw.rotation.set(0, w.s * 1.42, w.s * .06); w.hw.rotation.set(0, w.s * 1.38, w.s * .05); w.blur.visible = false; }
    }
    fwM.opacity = hwM.opacity = fly ? .5 : 1;
    if (fly) {   // ホバリングの小さなゆれと、進む速さに応じた体の傾き
      body.position.set(wob(t * 2.1, ph) * .035, wob(t * 1.7, ph + 2) * .045, wob(t * 1.5, ph + 4) * .03);
      body.rotation.set(lerp(-.32, -.08, spd / 2) + wob(t * 2.6, ph + 1) * .06, 0, wob(t * 2.2, ph + 3) * .07);
      legs.rotation.x = lerp(.16, .35, spd / 2);
    } else { body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); legs.rotation.x = 0; }
    abG.scale.z = 1 + (fly ? .02 : .045) * Math.sin(t * (fly ? 6 : 2.4) * TAU / 2 + ph); abG.rotation.x = -(fly ? .1 : .03) + .03 * Math.sin(t * 1.1 + ph);   // 腹のポンプ・飛ぶときは腹を少し下げる
    for (const a of ants) { a.an.rotation.x = .18 * wob(t * 1.4, ph + a.s) - (fly ? .12 : 0); a.an.rotation.y = a.s * .12 * wob(t * 1.1, ph + a.s * 3); }
  };
  g.userData.animate(0);
  return g;
}

// ================================================================ 蝶（ナミアゲハ・モンシロチョウの雌雄）と夜の蛾
//   翅 4（前翅・後翅）・脚 6（アゲハチョウ科もシロチョウ科も 6 本とも歩く脚）・先がこん棒状の触角 2・巻いた口吻。蛾の触角は糸状。
const WING = {
  ageha: { fw: smoothPts([[0, .02], [.35, .2], [.8, .37], [1.2, .5], [1.45, .56], [1.42, .4], [1.33, .1], [1.2, -.18], [1.08, -.34], [.75, -.3], [.4, -.18], [.12, -.06]], 4, [0]),
    hw: smoothPts((() => { const o = [[0, 0], [.4, .05], [.8, .02], [1.0, -.12], [1.04, -.32]]; const sc = [[1.0, -.48], [.93, -.64]]; for (const p of sc) o.push(p); o.push([.86, -.72], [.82, -1.18], [.76, -1.22], [.72, -.82], [.6, -.88], [.48, -.92], [.38, -.86], [.3, -.72], [.2, -.5], [.08, -.24]); return o; })(), 4, [0, 7, 8, 9, 10]), len: 1.45 },   // 尾状突起の角は残す
  monshiro: { fw: smoothPts([[0, .02], [.35, .17], [.75, .3], [1.05, .38], [1.2, .36], [1.18, .15], [1.06, -.12], [.9, -.3], [.6, -.28], [.3, -.16], [.08, -.05]], 4, [0]),
    hw: smoothPts([[0, 0], [.35, .05], [.7, .0], [.88, -.15], [.9, -.38], [.8, -.6], [.6, -.72], [.38, -.7], [.2, -.52], [.07, -.24]], 4, [0]), len: 1.2 },
  moth: { fw: smoothPts([[0, .02], [.3, .12], [.7, .2], [.95, .22], [1.05, .12], [.95, -.12], [.75, -.26], [.45, -.22], [.15, -.08]], 4, [0]),
    hw: smoothPts([[0, 0], [.3, .02], [.6, -.06], [.72, -.22], [.62, -.4], [.4, -.46], [.18, -.34], [.05, -.15]], 4, [0]), len: 1.05 },
};
function paintWing(kind, fore, c, path, px, under = false) {
  const line = (pts, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(...pts[0]); for (const p of pts.slice(1)) c.lineTo(...p); c.stroke(); };
  const dot = (x, y, r, col, sy = 1) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, r, r * sy, 0, 0, TAU); c.fill(); };
  // 翅脈（2026-10-13 直し）：根もとから数本が出て「中室」を囲み、中室のふちから外へ枝分かれする（扇の骨のように一点から放射しない）
  const veinsTo = (ends, w, col, A, B) => { const L = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)], O = [0, 0];
    line([O, A], w * 1.2, col); line([O, B], w * 1.2, col); line([A, B], w * .8, col);                                    // 中室
    const path = [L(O, A, .55), A, L(A, B, .5), B, L(O, B, .6)], n = ends.length;
    ends.forEach((e, k) => { const u = n > 1 ? k / (n - 1) * (path.length - 1) : 0, i = Math.min(path.length - 2, Math.floor(u)), o = L(path[i], path[i + 1], u - i); line([o, L(o, e, .5), e], w, col); }); };
  if (kind === 'ageha') {
    // 裏面（2026-10-13）：翅を閉じて止まると見えるのは裏。ナミアゲハの裏は地の黄が淡く、黒い帯は細めで褐色がかり、後翅の外側の黒帯の中に橙の斑が並ぶ
    const Y = under ? '#f4ebbd' : '#f2e39c', K = under ? '#2c2418' : '#16130f';
    c.fillStyle = Y; c.fill(path);
    if (fore) {
      // 基部：黄色地に黒い縦の筋（ナミアゲハ。キアゲハは基部が黒く塗りつぶされる）
      c.save(); c.clip(new Path2D('M0 0')); c.restore();
      for (let k = 0; k < 6; k++) line([[0, .01 - k * .03], [.62, .2 - k * .07]], 9 * px, K);
      line([[0, .03], [1.45, .56]], 22 * px, K);                                                                // 前縁の黒
      for (const x of [.62, .8]) line([[x, .32 + (x - .62) * .3], [x + .08, -.02]], 18 * px, K);              // 中室の端の黒い横帯
      c.fillStyle = K; c.beginPath(); c.moveTo(1.0, .5); c.lineTo(1.5, .6); c.lineTo(1.35, .1); c.lineTo(1.12, -.4); c.lineTo(.92, -.36); c.lineTo(1.03, .05); c.closePath(); c.fill();   // 外側の黒帯
      for (let k = 0; k < 8; k++) { const u = k / 7; dot(lerp(1.3, 1.05, u) + .02, lerp(.42, -.26, u), .028, Y, 1.3); }     // 外縁にそった黄色い斑
      for (let k = 0; k < 7; k++) { const u = k / 6; dot(lerp(1.13, .9, u), lerp(.38, -.22, u), .05 - u * .012, Y, .75); }    // 黒帯の内の黄色い斑
      veinsTo([[1.45, .5], [1.42, .35], [1.36, .15], [1.28, -.02], [1.2, -.18], [1.12, -.3], [.9, -.32]], 4 * px, K, [.72, .3], [.62, .02]);
    } else {
      line([[0, -.02], [.28, -.72], [.4, -.9]], 30 * px, K);                                                     // 内縁（腹の側）の黒
      c.fillStyle = K; c.beginPath(); c.moveTo(.98, .02); c.lineTo(1.08, -.35); c.lineTo(.9, -.78); c.lineTo(.42, -.95); c.lineTo(.38, -.78); c.lineTo(.72, -.62); c.lineTo(.86, -.3); c.lineTo(.84, -.05); c.closePath(); c.fill();   // 外側の黒帯
      for (let k = 0; k < 5; k++) { const u = k / 4; dot(lerp(.92, .62, u), lerp(-.25, -.7, u), .045, under ? '#6f86b8' : '#4a6fc0', .7); }         // 黒帯の中の青い斑（裏は淡い）
      if (under) for (let k = 0; k < 5; k++) { const u = k / 4; dot(lerp(.86, .55, u) + .02, lerp(-.18, -.6, u) + .03, .032, '#d98a3a', .6); }   // 裏：青い斑の内側に橙の斑
      for (let k = 0; k < 6; k++) { const u = k / 5; dot(lerp(1.02, .55, u), lerp(-.3, -.88, u), .03, Y, .6); }                // 外縁の黄色い三日月
      dot(.36, -.82, .065, '#e2632a'); dot(.36, -.82, .03, K);                                                                  // 後角の橙の目玉もよう
      c.fillStyle = K; c.fillRect(.7, -1.25, .14, .45);                                                                         // 尾状突起（黒）
      veinsTo([[.98, -.1], [1.0, -.32], [.92, -.55], [.82, -.72], [.65, -.82], [.5, -.9]], 4 * px, K, [.62, -.2], [.42, -.45]);
    }
  } else if (kind.startsWith('monshiro')) {
    const W = under && !fore ? '#f1edcf' : '#f4f2e8', K = '#2f2f31', fem = kind === 'monshiro-f';   // 裏：後翅は淡い黄みを帯びる
    c.fillStyle = W; c.fill(path);
    if (under && fore) { const gy = c.createLinearGradient(.7, 0, 1.2, 0); gy.addColorStop(0, 'rgba(240,232,180,0)'); gy.addColorStop(1, 'rgba(240,232,180,.9)'); c.fillStyle = gy; c.fill(path); }   // 裏：前翅の先も黄みを帯びる
    const gr = c.createRadialGradient(0, 0, 0, 0, 0, fore ? .38 : .3); gr.addColorStop(0, fem ? 'rgba(70,72,72,.75)' : 'rgba(80,82,82,.5)'); gr.addColorStop(1, 'rgba(80,82,82,0)'); c.fillStyle = gr; c.fill(path);   // 付け根の黒っぽい鱗粉（雌で広い）
    if (fore) {
      c.fillStyle = K; c.beginPath(); c.moveTo(.85, .36); c.lineTo(1.25, .4); c.lineTo(1.16, .08); c.quadraticCurveTo(1.02, .2, .85, .36); c.fill();   // 前翅の先の黒
      dot(.82, .02, fem ? .06 : .045, K);                                                                                     // 黒い斑（雄は 1 つ）
      if (fem) { dot(.72, -.17, .055, K); line([[.25, -.17], [.5, -.25]], 14 * px, K); }                                     // 雌：もう 1 つと、内縁の黒い帯
    } else dot(.55, .02, .045, K);                                                                                             // 後翅の前縁の小さな黒斑
    if (fore) veinsTo([[1.2, .36], [1.18, .25], [1.15, .1], [1.08, -.06], [1.0, -.18], [.88, -.28]], 2 * px, 'rgba(110,112,100,.35)', [.6, .22], [.55, -.04]); else veinsTo([[.88, -.12], [.88, -.32], [.8, -.55], [.62, -.68], [.42, -.7]], 2 * px, 'rgba(110,112,100,.35)', [.45, -.1], [.33, -.3]);
  } else {
    c.fillStyle = fore ? '#7d6b55' : '#a19685'; c.fill(path);
    for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(${40 + rnd() * 80 | 0},${30 + rnd() * 60 | 0},20,${rnd() * .35})`; c.beginPath(); c.arc(rnd() * 1.1, rnd() * .8 - .45, .01 + rnd() * .02, 0, TAU); c.fill(); }
    if (fore) { for (const x of [.35, .7]) { c.strokeStyle = 'rgba(40,30,20,.6)'; c.lineWidth = 5 * px; c.beginPath(); c.moveTo(x, .2); for (let y = .2; y > -.3; y -= .1) c.lineTo(x + Math.sin(y * 20) * .03, y); c.stroke(); } dot(.55, .02, .035, 'rgba(40,30,20,.7)'); }
  }
}
export function makeButterfly(kind = 'ageha', mat = stdMat, o = {}) {
  const key = kind.startsWith('monshiro') ? 'monshiro' : kind, W = WING[key], uvW = o.uv ?? (kind === 'monshiro-f' ? .7 : kind === 'monshiro-m' ? .02 : .15);
  const g = new T.Group(), body = new T.Group(); g.add(body);   // body＝はばたきに合わせた体の上下・傾き、不規則なゆれ（外側の g は呼ぶ側が動かす）
  const vc = (o2 = {}) => mk(mat, 0xffffff, { vc: true, rough: .65, map: furTex([3, 2]), temp: .35, uv: .05, ...o2 });
  const ag = kind === 'ageha', moth = kind === 'moth';
  // 腹・胸・頭。胸と腹のつけ根は毛（鱗毛）でおおわれる。蛾は全体が毛深い
  const abM = new T.Mesh(sweep([[0, .05, .22], [0, .02, 0], [0, -.03, -.3], [0, -.05, -.5]], tab([[0, .06], [.15, .075], [.6, .06], [1, .012]]), tab([[0, .065], [.15, .08], [.6, .062], [1, .012]]),
    (t, sx, cy) => ag ? (cy > .45 ? 0x17140f : Math.abs(Math.abs(sx) - .8) < .12 && cy > -.4 ? 0x2a2418 : 0xe6d58c) : moth ? 0x6e5c48 : (cy > .2 ? 0x3a3a3c : 0xe9e7e0), { n: 20, r: 12 }), vc());
  const thM = new T.Mesh(sweep([[0, .05, .2], [0, .07, .3], [0, .06, .41]], tab([[0, .06], [.4, .1], [1, .06]]), tab([[0, .06], [.4, .1], [1, .07]]),
    (t, sx, cy) => ag ? (Math.abs(sx) > .55 && cy > -.2 && cy < .5 ? 0xe9d98e : 0x17140f) : moth ? 0x7a6650 : 0x45464a, { n: 12, r: 14 }), vc());
  body.add(abM, thM);
  addFur(thM, mat, { comb: [0, .2, -1], len: moth ? .045 : .03, dens: 150, thick: .38, root: .6, droop: .3, temp: .35, sheen: ag ? 0xfff2c0 : 0xf4f4f0 });
  addFur(abM, mat, { len: (u) => (moth ? .028 : .014) * (1 - sstep(.5, 1, u)), dens: 130, thick: .34, root: .65, temp: .35 });
  body.add(ell(mk(mat, ag ? 0x1d1a14 : moth ? 0x6a5844 : 0x3a3b3d, { rough: .7, temp: .3 }), 0, .065, .46, .07, .07, .065, 12));
  const eyeM = compoundEye(mat, ag ? 0x3b3325 : moth ? 0x2a2018 : 0x6e7466, { temp: .3 });
  for (const s of [-1, 1]) body.add(ell(eyeM, s * .055, .07, .48, .045, .055, .05, 16));
  const dk = mk(mat, ag ? 0x1d1a14 : 0x2e2e30, { rough: .6, temp: .3 });
  const ants = [];
  for (const s of [-1, 1]) {   // 触角（付け根を軸に、ゆっくり動かす）
    const an = new T.Group(); an.position.set(s * .025, .11, .5); body.add(an); ants.push({ s, an });
    const tip = moth ? [s * .255, .11, .22] : [s * .175, .31, .48];
    an.add(tube(dk, [[0, 0, 0], [s * .055, .15, .18], tip], .009, moth ? .004 : .007));
    if (!moth) an.add(ell(dk, tip[0] * 1.03, tip[1] * 1.02, tip[2] * 1.02, .018, .018, .045, 8));                       // こん棒（先がふくらむ）
  }
  { const sp = []; for (let i = 0; i <= 20; i++) { const a = i / 20 * TAU * 1.6, r = .035 * (1 - i / 26); sp.push([0, -.02 - r * Math.cos(a) - .02, .52 + r * Math.sin(a)]); } body.add(tube(dk, sp, .006, .005, null, 24, 4)); }   // 巻いた口吻
  const legs = new T.Group(); body.add(legs);
  for (const s of [-1, 1]) for (const [z, dz, dy] of [[.36, .12, -.12], [.3, -.02, -.16], [.24, -.12, -.15]]) legs.add(tube(dk, [[s * .04, .0, z], [s * .1, -.06, z + dz * .4], [s * .12, dy, z + dz]], .009, .005, null, 8, 4));
  // 翅：鱗粉は瓦のように重なった小さな鱗で、つやの少ない面にやわらかな照り（シーン）。
  //   ナミアゲハの後翅の青い斑は、見る向きで青が強まる（鱗粉の薄い膜の反射が色素と重なる＝構造色の寄与。Stavenga, Matsushita & Arikawa 2015）
  const fwG = flatShape(W.fw), hwG = flatShape(W.hw);
  const scaleN = nmap('wingScale', 64, 64, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); for (let y = -4; y < h + 4; y += 4) for (let x = (y / 4 % 2) * 3 - 3; x < w + 6; x += 6) { const gr = c.createLinearGradient(x, y - 3, x, y + 3); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#202020'); c.fillStyle = gr; c.beginPath(); c.ellipse(x, y, 3, 3.4, 0, 0, TAU); c.fill(); } }, 1.2, [36, 26]);
  const sheenMap = fore => ag && !fore ? shapeTex('agehaHsheen', hwG, W.hw, (c, path, px) => { c.fillStyle = '#2a2620'; c.fill(path); for (let k = 0; k < 5; k++) { const u = k / 4; c.fillStyle = '#5a8cff'; c.beginPath(); c.ellipse(lerp(.92, .62, u), lerp(-.25, -.7, u), .055, .04, 0, 0, TAU); c.fill(); } }, 256) : null;
  const sheenC = ag ? 0xffffff : moth ? 0x4a4030 : 0x55554e;
  // 表と裏（2026-10-13）：形の表側（FrontSide）は翅の裏面（腹側）、BackSide は表面（背側）。止まって閉じると、外に見えるのは裏面
  const wingMat = (fore, under) => mk(mat, 0xffffff, { map: shapeTex(`${kind}${fore ? 'F' : 'H'}${under ? 'u' : ''}`, fore ? fwG : hwG, fore ? W.fw : W.hw, (c, path, px) => paintWing(kind, fore, c, path, px, under)), side: under ? T.FrontSide : T.BackSide, rough: .78, uv: uvW, temp: .2,
    nmap: scaleN, ns: .3, phys: { sheen: ag && !fore && !under ? 1 : .6, sheenRoughness: .45, sheenColor: ag && (fore || under) ? 0x2a2620 : sheenC, sheenColorMap: under ? null : sheenMap(fore) } });
  const mats = [[wingMat(true, false), wingMat(true, true)], [wingMat(false, false), wingMat(false, true)]];
  const wings = [];
  for (const s of [-1, 1]) {
    const fp = new T.Group(), hp = new T.Group(); fp.position.set(s * .045, .1, .3); hp.position.set(s * .045, .096, .26); fp.rotation.order = hp.rotation.order = 'ZXY';
    for (const k of [0, 1]) { const f = new T.Mesh(fwG, mats[0][k]), h = new T.Mesh(hwG, mats[1][k]); f.rotation.y = -.12; if (s < 0) { f.scale.x = -1; h.scale.x = -1; f.rotation.y = .12; } fp.add(f); hp.add(h); }
    body.add(fp, hp); wings.push({ s, piv: fp, hp });
  }
  g.userData = { kind: moth ? 'ga' : 'chou', wings, ph: o.ph || 0, state: o.state || 'fly' };
  // 羽ばたき：下ろす（約 -25°）〜上げる（約 +85°。上で左右の翅が近づく）。後翅は前翅に少し遅れ、翅は打ち下ろしで前縁を下げる（ねじれ）。
  //   体は打ち下ろしで持ち上がり、打ち上げで沈む。腹も上下にゆれる（Sunada ら 1993）。進む道は小さく不規則にぶれる（Chai & Srygley 1990）。
  //   アゲハは時おり翅を少し上げたまま滑空する。はばたきの速さは見やすく実物より少し遅い。
  g.userData.flap = (t, k = 1) => { const ph = g.userData.ph, f = ag ? 5 : moth ? 9 : 7, glide = ag ? sstep(.55, .8, Math.sin(t * .9 + ph)) : 0, P = t * f * TAU + ph * 3;
    const a = (1 - glide) * (Math.sin(P) * .5 + .5), a2 = (1 - glide) * (Math.sin(P - .45) * .5 + .5), up = Math.cos(P);   // up>0＝打ち上げ中
    const ang = lerp(-.42, 1.48, a) * k + glide * .22, ang2 = lerp(-.38, 1.4, a2) * k + glide * .2, tw = (1 - glide) * .22 * up;
    for (const w of wings) { w.piv.rotation.set(-tw, 0, w.s * ang); w.hp.rotation.set(-tw * .7, 0, w.s * ang2); }
    const lift = (1 - glide) * Math.sin(P - 1.2);   // 打ち下ろしの少しあとに体が上がる
    body.position.set(wob(t * 1.3, ph) * .22, lift * .1 + wob(t * 1.1, ph + 5) * .16, wob(t * .9, ph + 2) * .12);
    body.rotation.set(-lift * .2 + wob(t * 1.7, ph + 1) * .08, wob(t * .8, ph + 4) * .12, wob(t * 1.4, ph + 6) * .14);
    abM.rotation.x = -lift * .12;
    for (const an of ants) { an.an.rotation.x = .1 * wob(t * 1.2, ph + an.s); an.an.rotation.y = an.s * .06 * wob(t * .9, ph + an.s * 2); }
    return a; };
  // 止まっているとき：翅は背の上で閉じる。ときどき、ゆっくり開いて閉じる（日を受ける）。触角を動かす
  g.userData.animate = (t, moving = true) => { const ph = g.userData.ph;
    if (g.userData.state === 'rest') { const op = bout(t, 9, 3.2, ph * 5) * (moth ? 0 : 1), ang = lerp(1.47, .45, op);
      for (const w of wings) { w.piv.rotation.set(0, 0, w.s * ang); w.hp.rotation.set(0, 0, w.s * (ang - .03)); }
      body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); abM.rotation.x = .02 * Math.sin(t * 1.3 + ph);
      for (const an of ants) { an.an.rotation.x = .12 * wob(t * .9, ph + an.s); an.an.rotation.y = an.s * .08 * wob(t * .7, ph + an.s * 2); }
      return; }
    g.userData.flap(t); };
  g.userData.pl = wings[0].piv; g.userData.pr = wings[1].piv;
  g.userData.animate(0);
  return g;
}

// ================================================================ シジュウカラ（Parus minor・全長 約 14.5 cm）
//   黒い頭・白い頬・うなじの白い斑・のどから腹の中央へ黒いネクタイ・背の上は黄緑・腰は青灰・腹は白っぽい灰。
//   翼は青灰で、大雨覆の先が白い帯になる。尾は 12 枚（いちばん外は白が多い）。足指 4 本（前 3・後 1）。
//   飛び方：数回はばたいては翼をたたむ、波形の飛び方。
const FEATHER = (len, wid, asym = 0) => { const p = []; for (const [u, v] of [[0, -.28], [.25, -.5], [.6, -.48], [.85, -.34], [.97, -.12], [1, 0], [.97, .14], [.85, .36], [.6, .5], [.25, .5], [0, .28]]) p.push([v * wid * (v < 0 ? 1 - asym : 1 + asym), u * len]); return p; };
function featherGeo(len, wid, asym) { const pts = FEATHER(len, wid, asym), s = new T.Shape(); s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p); s.closePath(); const g = new T.ShapeGeometry(s); const P = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < P.count; i++) uv.setXY(i, P.getX(i) / wid * .5 + .5, P.getY(i) / len); g.rotateX(-Math.PI / 2); return g; }   // 根もとが原点、羽の先が -Z
const featherTex = (key, base, edge, tip, tipW) => ctex(key, 64, 128, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, edge); gr.addColorStop(.42, base); gr.addColorStop(.5, '#2a2c30'); gr.addColorStop(.58, base); gr.addColorStop(1, base); c.fillStyle = gr; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 3) { c.strokeStyle = 'rgba(0,0,0,.08)'; c.beginPath(); c.moveTo(0, y + 6); c.lineTo(w / 2, y); c.lineTo(w, y + 6); c.stroke(); }
  if (tip) { c.fillStyle = tip; c.fillRect(0, 0, w, h * tipW); } }, [1, 1]);
export function makeTit(mat = stdMat, o = {}) {
  const g = new T.Group(), body = new T.Group(); g.add(body);
  const K = 0x141518, Wt = 0xeceee8, GRN = 0x96a05a, BG = 0x74818f, BEL = 0xdfe1db, FL = 0xc6c9c0;
  const col = (t, sx, cy, x, y, z) => {
    if (z > .175) {   // 頭
      if (z > .215 && z < .322 && cy < -.02 && cy > -.52) return Wt;   // 白い頬（目より下。目は黒い頭の中）
      if (z < .215 && cy > .72) return 0xd9dcd2;                    // うなじの白い斑
      return K;
    }
    if (cy < -.5 && Math.abs(sx) < (z > .08 ? .62 : .42)) return K;  // 黒いネクタイ（雄は太く、腹の下まで）
    if (cy < -.15) return z < -.1 ? 0xf2f2ee : BEL;                  // 腹（下尾筒は白）
    if (cy < .35) return z < -.05 ? 0xb8bcb4 : FL;                   // わき
    return z > 0 ? GRN : BG;                                         // 背の上は黄緑・腰は青灰
  };
  const bodyG = sweep([[0, -.015, -.2], [0, 0, -.09], [0, .02, .05], [0, .05, .16], [0, .08, .245], [0, .085, .3], [0, .078, .338]],
    tab([[0, .022], [.1, .07], [.32, .098], [.52, .09], [.66, .066], [.8, .068], [.93, .05], [1, .018]]), tab([[0, .02], [.1, .072], [.32, .108], [.52, .095], [.66, .07], [.8, .071], [.93, .05], [1, .018]]), col,
    { n: 44, r: 24, k: (t, sx, cy) => 1 + .07 * Math.max(0, -cy) * sstep(.15, .35, t) * (1 - sstep(.45, .6, t)) });
  // 2026-10-13：羽の面に、羽枝の細い筋（法線の地図）とやわらかな照り。黒い頭は青みのつや（クリアコートを頭だけに＝下の地図）。
  //   胸・腹は羽毛がふくらむ（毛の層を短く）。頭は首を軸に、すばやく向きを変える（頂点を首のまわりで回す）
  const plumeN = nmap('plumeN', 64, 64, (c, w, h) => { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); for (let y = -8; y < h + 8; y += 8) for (let x = (y / 8 % 2) * 6 - 6; x < w + 8; x += 12) { const gr = c.createLinearGradient(x, y - 2, x, y + 7); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#303030'); c.fillStyle = gr; c.beginPath(); c.ellipse(x, y + 2, 7, 6, 0, 0, Math.PI); c.fill(); } for (let i = 0; i < 500; i++) { c.strokeStyle = `rgba(255,255,255,${rnd() * .25})`; const x = rnd() * w, y = rnd() * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 2, y + 3); c.stroke(); } }, 1.2, [7, 5]);
  const capMap = ctex('titCap', 128, 32, (c, w, h) => { c.fillStyle = '#0d0d0d'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.fillRect(w * .7, 0, w * .3, h * .2); c.fillRect(w * .7, h * .82, w * .3, h * .18); c.fillRect(w * .82, h * .2, w * .18, h * .62); }, [1, 1], false);
  const bm = new T.Mesh(bodyG, mk(mat, 0xffffff, { vc: true, map: plumeTex([7, 5]), rough: .74, temp: .95, uv: .06, nmap: plumeN, ns: .45, phys: { clearcoat: 1, clearcoatMap: capMap, clearcoatRoughness: .32, sheen: .45, sheenRoughness: .5, sheenColor: 0x8090a8 } })); body.add(bm);
  addFur(bm, mat, { len: (u, v) => { const cy = Math.cos(v * TAU), env = sstep(.12, .28, u) * (1 - sstep(.56, .66, u)); return cy < -.15 ? .018 * env : cy < .3 ? .009 * env * sstep(.3, -.15, cy) : 0; }, dens: 150, thick: .58, root: .82, droop: .12, comb: [0, -.2, -1.4], temp: .95, sheen: 0xf8f8f0 });
  const headG = new T.Group(), HP = new T.Vector3(0, .07, .2); headG.position.copy(HP); body.add(headG);   // 首の軸
  const bill = new T.Mesh(sweep([[0, .074, .33], [0, .07, .37], [0, .064, .392]], tab([[0, .02], [1, .002]]), tab([[0, .018], [1, .002]]), () => 0x1d1e21, { n: 6, r: 8 }), mk(mat, 0xffffff, { vc: true, rough: .32, temp: .6, uv: .04, phys: { clearcoat: .5, clearcoatRoughness: .25 } })); bill.position.sub(HP); headG.add(bill);
  const eyeM = wetEye(mat, 0x050506, { temp: .9 }); for (const s of [-1, 1]) { const e = ell(eyeM, s * .057, .1, .287, .014, .016, .015, 14); e.position.sub(HP); headG.add(e); }
  const P0 = Float32Array.from(bodyG.attributes.position.array), hW = new Float32Array(P0.length / 3); for (let i = 0; i < hW.length; i++) hW[i] = sstep(.15, .225, P0[i * 3 + 2]);
  let hy0 = 0, hp0 = 0; const _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3();
  function poseHead(yaw, pitch) {   // 首から上の頂点を、重みつきで回す（くちばしと目は一緒に回る）
    if (Math.abs(yaw - hy0) < 1e-3 && Math.abs(pitch - hp0) < 1e-3) return; hy0 = yaw; hp0 = pitch; headG.rotation.set(pitch, yaw, 0, 'YXZ');
    const P = bodyG.attributes.position; for (let i = 0; i < hW.length; i++) { const w = hW[i]; if (w <= 0) { P.setXYZ(i, P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2]); continue; } _e.set(pitch * w, yaw * w, 0, 'YXZ'); _q.setFromEuler(_e); _v.set(P0[i * 3] - HP.x, P0[i * 3 + 1] - HP.y, P0[i * 3 + 2] - HP.z).applyQuaternion(_q).add(HP); P.setXYZ(i, _v.x, _v.y, _v.z); }
    P.needsUpdate = true; bodyG.computeVertexNormals(); seam(bodyG, 44, 24); }
  // 尾：12 枚の扇（外側ほど白い）
  const tailGeos = [];
  for (let i = 0; i < 12; i++) { const u = i / 11 - .5, fg = featherGeo(.35, .055, 0); fg.rotateY(-u * .5); fg.translate(u * .05, -.004 + Math.abs(u) * -.006, -.15 - .002 * Math.abs(u)); const w = Math.abs(u) > .44 ? 1 : 0; const n = fg.attributes.position.count; fg.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3).fill(0), 3)); const cA = fg.attributes.color, cc = new T.Color(w ? 0xe8e8e2 : 0x56606e); for (let k = 0; k < n; k++) cA.setXYZ(k, cc.r, cc.g, cc.b); tailGeos.push(fg); }
  const tail = new T.Mesh(mergeGeometries(tailGeos), mk(mat, 0xffffff, { vc: true, map: featherTex('tf', '#c9cdd4', '#e8ebee', null), side: T.DoubleSide, rough: .8, temp: .8, uv: .2 }));
  const tailPiv = new T.Group(); tailPiv.position.set(0, -.005, -.15); tail.position.set(0, .005, .15); tailPiv.add(tail); body.add(tailPiv);
  // 脚と足指（前 3・後 1）
  const legs = new T.Group(); body.add(legs); const legM = mk(mat, 0x5d636d, { rough: .5, temp: .7 });
  for (const s of [-1, 1]) { legs.add(tube(legM, [[s * .03, -.06, .03], [s * .032, -.12, .045], [s * .032, -.155, .05]], .008, .006, null, 4, 5));
    for (const a of [-.4, 0, .4]) legs.add(tube(legM, [[s * .032, -.155, .05], [s * .032 + Math.sin(a) * .05, -.165, .05 + Math.cos(a) * .05]], .005, .003, null, 3, 4));
    legs.add(tube(legM, [[s * .032, -.155, .05], [s * .032, -.165, .005]], .005, .003, null, 3, 4)); }
  // 翼：はばたき・たたみを、羽一枚ずつの位置から毎こま組み直す（一枚の形にまとめて描く）
  const F = []; // { seg, x, ang0, angF, len, wid, asym, layer, tex }
  for (let i = 0; i < 3; i++) F.push({ seg: 0, x: .05 + i * .045, a0: .12 - i * .05, aF: -1.15, len: .2, wid: .07, layer: .006, m: 1 });            // 三列風切
  for (let i = 0; i < 8; i++) F.push({ seg: 1, x: i * .02, a0: -.05 - i * .03, aF: 1.35, len: .25, wid: .065, layer: .004 - i * .0002, m: 0 });       // 次列風切
  for (let i = 0; i < 9; i++) F.push({ seg: 2, x: i * .006, a0: -.4 - i * .13, aF: -1.45 + i * .01, len: .25 + .12 * Math.sin(Math.min(1, i / 7) * Math.PI / 2), wid: .06, asym: .3, layer: -.002 * i, m: 0 });   // 初列風切
  // 雨覆は、重なる羽どうしの高さを一枚ずつずらす（2026-10-13：同じ高さの羽が重なり、寄りで面に縞のちらつきが出ていた）
  for (let i = 0; i < 8; i++) F.push({ seg: 1, x: i * .02, a0: -.05 - i * .03, aF: 1.35, len: .11, wid: .06, layer: .012 + i * .0009, m: 2 });                      // 大雨覆（先が白い＝翼の帯）
  for (let i = 0; i < 5; i++) F.push({ seg: 2, x: i * .008, a0: -.5 - i * .2, aF: -1.45, len: .1, wid: .05, layer: .01 + i * .0009, m: 1 });                          // 初列雨覆
  // 小・中雨覆（前縁）：2026-10-13 大きな丸い板 2 枚をやめ、細い羽を並べて重ねた（たたんだ翼が板の重なりに見えたため）
  for (let i = 0; i < 6; i++) F.push({ seg: 0, x: .01 + i * .024, a0: -.2 - i * .03, aF: -1.1, len: .11, wid: .055, layer: .02 + i * .0009, m: 3 });
  for (let i = 0; i < 7; i++) F.push({ seg: 1, x: .005 + i * .02, a0: -.15 - i * .03, aF: 1.32, len: .085, wid: .05, layer: .026 + i * .0009, m: 3 });
  const texs = [featherTex('wf', '#5c6878', '#9fb0c2', null), featherTex('wt', '#3c4450', '#eef0ea', null), featherTex('wc', '#6c7a8c', '#8394a8', '#f0f0ea', .32), featherTex('wl', '#7a8898', '#8696a8', null)];
  const wingMats = texs.map((tx, m) => { const wm = mk(mat, 0xffffff, { map: tx, side: T.DoubleSide, rough: .8, temp: .85, uv: .18 }); if (m >= 2) { wm.polygonOffset = true; wm.polygonOffsetFactor = -(m - 1); wm.polygonOffsetUnits = -(m - 1) * 2; } return wm; });   // 雨覆は風切より手前に描く（深さの取りあいで縞にならない）
  function wingMesh(side) {
    const geos = [], base = [];
    for (const f of F) { const fg = featherGeo(f.len, f.wid, f.asym || 0); base.push(Float32Array.from(fg.attributes.position.array)); geos.push(fg); }
    const groups = [0, 1, 2, 3].map(m => F.map((f, i) => [f, i]).filter(([f]) => f.m === m));
    const ordered = groups.flat(), geo = mergeGeometries(ordered.map(([, i]) => geos[i]), true);
    { const gs = geo.groups.slice(); geo.clearGroups(); let gi = 0; for (let m = 0; m < 4; m++) { let start = null, count = 0; for (let q = 0; q < groups[m].length; q++, gi++) { if (start == null) start = gs[gi].start; count += gs[gi].count; } if (count) geo.addGroup(start, count, m); } }
    const mesh = new T.Mesh(geo, wingMats); mesh.userData = { side, F: ordered.map(([f, i]) => ({ f, b: base[i] })) }; mesh.frustumCulled = false; return mesh;
  }
  const wings = [wingMesh(-1), wingMesh(1)]; body.add(...wings);
  const SH = [.072, .065, .12], LH = .15, LF = .15;
  const v = new T.Vector3();
  function poseWing(mesh, elev, fold, sweepK = 0) {
    const s = mesh.userData.side, P = mesh.geometry.attributes.position, N = mesh.geometry.attributes.normal;
    const a1 = lerp(-.05 + sweepK, 1.25, fold), a2 = lerp(.05, -2.7, fold), a3 = lerp(-.02, 2.9, fold);
    const E = [LH * Math.cos(a1), -LH * Math.sin(a1)], W2 = [E[0] + LF * Math.cos(a1 + a2), E[1] - LF * Math.sin(a1 + a2)];
    const ce = Math.cos(elev), se = Math.sin(elev), nx = -se, ny = ce;
    let k = 0;
    for (const { f, b } of mesh.userData.F) {
      const segA = f.seg === 0 ? a1 : f.seg === 1 ? a1 + a2 : a1 + a2 + a3, root = f.seg === 0 ? [0, 0] : f.seg === 1 ? E : W2;
      const rx = root[0] + f.x * Math.cos(segA), rz = root[1] - f.x * Math.sin(segA), ang = segA + lerp(f.a0, f.aF, fold), ca = Math.cos(ang), sa = Math.sin(ang);
      for (let q = 0; q < b.length; q += 3, k++) {
        const fx = b[q], fy = b[q + 1] + f.layer + fold * (f.layer * 1.5), fz = b[q + 2];
        const lx = rx + fx * ca + fz * sa, lz = rz - fx * sa + fz * ca;   // 羽を回して、根もとへ
        const wx = lx * ce - fy * se, wy = lx * se + fy * ce;             // はばたき（肩を軸に上下）
        P.setXYZ(k, s * (SH[0] + wx), SH[1] + wy, SH[2] + lz); N.setXYZ(k, nx, s * ny, 0);
      }
    }
    P.needsUpdate = true; N.needsUpdate = true;
  }
  g.userData = { kind: 'tori', body, wings, tailPiv, legs, head: headG, cap: bm, state: o.state || 'fly', ph: o.ph || 0 };
  // とまっているとき（2026-10-13）：頭はすばやく向きを変えては止める（見回す）・尾をときどき上へはね上げる・数秒ごとに枝の上で跳ねて向きを変える・
  //   胸がふくらんでは戻る（息）・ときどき翼を小さくふるわせる。くわしくは 資料/調べたこと/生き物の動き_典拠.md
  let heading = 0, hopFrom = 0, hopTo = 0, hopK = -1, lastPose = -1;
  const perch = t => {
    const ph = g.userData.ph * 7, tt = t + ph;
    // 見回す：0.3〜1.4 秒ごとに次の向きへ、0.08 秒ほどで移る
    const kk = Math.floor(tt / .7), sw = kk * .7 + hash1(kk + .5) * .5;
    const tgt = j => [(hash1(j * 3.1) - .5) * 1.5, (hash1(j * 7.7) - .5) * .5 - .05];
    const a = tgt(kk), b = tgt(kk - 1), u = sstep(sw, sw + .08, tt);
    poseHead(lerp(b[0], a[0], u), lerp(b[1], a[1], u));
    // 跳ねて向きを変える（およそ 4〜8 秒ごと・0.3 秒）
    const hk = Math.floor(tt / 6), hx = tt - hk * 6 - hash1(hk + 9) * 3;
    if (hk !== hopK) { hopK = hk; hopFrom = heading; hopTo = heading + (hash1(hk * 5.3) < .5 ? -1 : 1) * (.7 + hash1(hk * 2.9) * 2.4); }
    const hu = clamp(hx / .3, 0, 1); heading = hx < 0 ? hopFrom : lerp(hopFrom, hopTo, sstep(0, 1, hu));
    body.rotation.y = heading; body.position.y = hu > 0 && hu < 1 ? Math.sin(Math.PI * hu) * .07 : 0;
    legs.visible = true; legs.rotation.x = hu > 0 && hu < 1 ? .5 * Math.sin(Math.PI * hu) : 0;
    // 息（1 秒に 1 回ほど）・尾のはね上げ・翼のふるえ
    const br = 1 + .018 * Math.sin(tt * TAU * 1.1); body.scale.set(br, br, 1);
    tailPiv.rotation.x = -.1 + .05 * Math.sin(t * 1.7) - .45 * bout(t, 3.3, .35, ph) - .3 * (hu > .8 && hu < 1 ? 1 : 0);
    const fl = bout(t, 7.5, .5, ph + 2); if (fl > .01 || lastPose !== 0) { for (const w of wings) poseWing(w, -.32 + .15 * fl * Math.abs(Math.sin(t * 40)), 1 - .15 * fl); lastPose = fl > .01 ? 1 : 0; }
  };
  // はばたき（見やすさのため 1 秒に約 9 回にゆっくりしてある）と、たたんで弾む「波形の飛び方」
  g.userData.animate = (t, moving = true) => {
    const st = g.userData.state;
    if (st === 'perch') { perch(t); return 0; }
    poseHead(0, 0); body.rotation.y = 0; body.position.y = 0; body.scale.set(1, 1, 1); legs.rotation.x = 0;
    legs.visible = false;
    const cyc = (t + g.userData.ph) * 9, beat = cyc % 6;               // 4 回はばたいて、2 拍ぶんたたむ
    if (beat > 4 && moving !== 'hover') { const u = sstep(4, 4.3, beat) * (1 - sstep(5.7, 6, beat)); for (const w of wings) poseWing(w, lerp(.3, -.28, u), u); tailPiv.rotation.x = .05; return -1; }
    const p = cyc * TAU, s1 = Math.sin(p), up = Math.cos(p) > 0 ? 0 : 1;   // 下ろすときは広げ、上げるときは少したたむ
    const elev = .25 + .85 * s1, fold = .38 * Math.max(0, -Math.cos(p));
    for (const w of wings) poseWing(w, elev, fold, -.1 * Math.max(0, s1));
    tailPiv.rotation.x = .08 * Math.sin(p + 1); return s1;
  };
  g.userData.animate(0);
  return g;
}

// ================================================================ 犬（柴犬・体高 35〜41 cm）
//   赤毛に「裏白」（頬・のど・胸・腹・脚の内・尾の裏が白っぽい）。立った三角の耳、巻いた尾、黒い鼻、奥まった三角の目。
export function makeDog(mat = stdMat, o = {}) {
  //   2026-10-13：赤毛（毛の先が赤く、根もとの下毛は淡い）と裏白。二重の毛（上毛と、密な下毛）を毛の層で。尾はふさふさ。
  //   鼻は湿って細かい粒のある面（鼻鏡）、目は濡れた映りこみ、まぶたのふちは黒い。
  const g = new T.Group(); const R = 0xb8692f, Cr = 0xf3e9d6, RD = 0x9c5326, RL = 0xc98a50;
  const fur = mk(mat, 0xffffff, { vc: true, map: furTex([8, 4]), rough: .9, temp: .95, uv: .04, phys: MOBILE ? undefined : { sheen: .5, sheenRoughness: .5, sheenColor: 0xffe2c0 } });
  const urajiro = (cyLim) => (t, sx, cy) => cy < cyLim ? Cr : cy < cyLim + .2 ? mixc(Cr, RL, (cy - cyLim) / .2) : cy < cyLim + .4 ? mixc(RL, R, (cy - cyLim - .2) / .2) : cy > .6 ? RD : R;
  const ellC = (m, c, ...a) => { const e = ell(m, ...a); e.geometry = e.geometry.clone(); const n = e.geometry.attributes.position.count, cA = new Float32Array(n * 3), cc = new T.Color(c); for (let i = 0; i < n; i++) cA.set([cc.r, cc.g, cc.b], i * 3); e.geometry.setAttribute('color', new T.BufferAttribute(cA, 3)); return e; };
  const FD = { dens: 210, thick: .5, root: .72, droop: .6, comb: [0, -.3, -1.6], temp: .95, sheen: 0xffe6c8 };   // 毛は尾の側へ寝る（comb）
  // 胴（胸の中ほどを軸に、息でふくらむ）
  const trunk = new T.Group(); trunk.position.set(0, .64, 0); g.add(trunk);
  const bodyG = sweep([[0, .63, -.5], [0, .66, -.36], [0, .65, -.12], [0, .64, .14], [0, .63, .33], [0, .62, .47]],
    tab([[0, .03], [.06, .12], [.2, .13], [.42, .115], [.7, .145], [.9, .13], [1, .05]]), tab([[0, .03], [.06, .15], [.2, .165], [.42, .14], [.7, .2], [.9, .19], [1, .06]]),
    (t, sx, cy) => { const c = urajiro(-.42)(t, sx, cy), k = sstep(.76, .86, t) * sstep(.4, .1, cy); return k > 0 ? mixc(c.isColor ? c.getHex() : c, Cr, k) : c; }, { n: 30, r: 18 }); bodyG.translate(0, -.64, 0);   // 胸の白は、境をぼかして毛の色へ
  const bodyM = new T.Mesh(bodyG, fur); trunk.add(bodyM);
  addFur(bodyM, mat, { ...FD, len: (u, v) => { const cy = Math.cos(v * TAU); return u < .03 ? 0 : (cy < -.5 ? .014 : cy > .4 ? .026 : .022) * (u > .8 ? 1.3 : 1); } });
  const neckM = new T.Mesh(sweep([[0, .7, .3], [0, .82, .42], [0, .9, .5]], tab([[0, .11], [1, .095]]), tab([[0, .14], [1, .1]]), (t, sx, cy) => cy < -.35 ? Cr : cy < -.05 ? mixc(Cr, RL, (cy + .35) / .3) : cy < .25 ? mixc(RL, R, (cy + .05) / .3) : R, { n: 10, r: 16 }), fur);   // のどの白は、境をぼかして赤毛へ（2026-10-13：板のふちのような切れ目をなくす）
  const neckP = new T.Group(); neckP.position.set(0, .7, .3); g.add(neckP); neckM.geometry.translate(0, -.7, -.3); neckP.add(neckM);   // 首の付け根を軸に、頭を下げる・振り向く
  addFur(neckM, mat, { ...FD, len: .032, comb: [0, -.8, -.6] });
  { const th = ellC(fur, Cr, 0, .17, .17, .085, .075, .08, 14); neckP.add(th); addFur(th, mat, { ...FD, len: .02, comb: [0, -.8, -.4] }); }   // のどと頭のつなぎ目（毛の層で、まわりの毛となじませる）
  // 頭：額（ストップ）でくぼみ、細めのマズル。頬・口のまわり・のど・目の上の斑が白い（裏白）
  const head = new T.Group(); head.position.set(0, .23, .2); head.scale.set(1.13, 1.08, .82); neckP.add(head);   // マズルを短く太く・額を広く（2026-10-13：柴は丸顔で、マズルは中くらい）
  const headM = new T.Mesh(sweep([[0, .02, -.07], [0, .035, .04], [0, .01, .13], [0, -.03, .22], [0, -.04, .27]], tab([[0, .07], [.25, .112], [.5, .09], [.66, .066], [.92, .05], [1, .012]]), tab([[0, .07], [.25, .1], [.5, .08], [.66, .058], [.92, .044], [1, .012]]),
    (t, sx, cy, x, y, z) => { if (t > .5 && cy < -.05) return Cr; if (t > .3 && t < .52 && cy < .25 && Math.abs(sx) > .5) return Cr; if (t > .38 && t < .5 && cy > .55 && Math.abs(sx) > .35 && Math.abs(sx) < .7) return Cr; return t > .55 ? mixc(R, 0xd08a50, (t - .55) * 2) : R; }, { n: 24, r: 16, k: (t, sx, cy) => (1 - .12 * Math.max(0, cy) * sstep(.45, .6, t)) * (1 + .14 * Math.abs(sx) * sstep(.2, .4, t) * (1 - sstep(.5, .7, t)) * sstep(.6, -.2, cy)) }), fur);   // 頬を張らせた丸顔
  head.add(headM);
  addFur(headM, mat, { ...FD, len: (u, v) => { const cy = Math.cos(v * TAU), sx = Math.abs(Math.sin(v * TAU)); return u > .9 ? 0 : u > .55 ? .006 : (u > .25 && sx > .5 && cy < .3) ? .022 : .012; }, droop: .3, comb: [0, 0, -1.4] });
  // 鼻（鼻鏡）：湿った艶と、小さな粒の凹凸。鼻の穴
  const noseN = nmap('noseN', 64, 64, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 5) for (let x = (y / 5 % 2) * 2.5; x < w; x += 5) { const gr = c.createRadialGradient(x, y, 0, x, y, 3); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(x - 3, y - 3, 6, 6); } }, 2.2, [3, 3]);
  const nose = new T.Group(); nose.position.set(0, -.03, .275); head.add(nose);
  nose.add(ell(mk(mat, 0x141416, { rough: .5, nmap: noseN, ns: .8, phys: { clearcoat: .75, clearcoatRoughness: .3 }, temp: .5 }), 0, 0, 0, .028, .022, .022, 16));
  const dark = mk(mat, 0x0c0c0e, { rough: .6, temp: .8 });
  for (const s of [-1, 1]) { nose.add(ell(dark, s * .011, -.004, .018, .006, .004, .004, 8));                                              // 鼻の穴
  }
  // 目：奥まった三角の目。濡れた角膜の映りこみと、黒いまぶたのふち
  const eyeM = wetEye(mat, 0x2a160b, { temp: .9 }); for (const s of [-1, 1]) { const ry = s * .4, rz = s * -.25; const rim = ell(dark, s * .059, .05, .122, .021, .0145, .012, 12); rim.rotation.set(0, ry, rz); head.add(rim); const e = ell(eyeM, s * .061, .05, .125, .018, .012, .012, 16); e.rotation.set(0, ry, rz); head.add(e); }
  // 耳：立った三角。付け根を軸に、音のするほうへ向きを変える
  const earM = mk(mat, 0xffffff, { vc: true, map: furTex([2, 2]), rough: .85, temp: .9, side: T.DoubleSide });
  const ears = [];
  for (const s of [-1, 1]) { const ep = new T.Group(); ep.position.set(s * .066, .095, .0); ep.rotation.set(.25, 0, -s * .25); ep.scale.set(.85, .82, 1.5); head.add(ep);   // 小さく厚い三角の耳
    const ear = new T.Mesh(sweep([[0, 0, 0], [0, .06, .01], [0, .12, .02]], tab([[0, .055], [1, .003]]), tab([[0, .02], [1, .002]]), (t, sx, cy) => cy > .2 ? Cr : R, { n: 6, r: 8, up: [0, 0, 1] }), earM); ep.add(ear); ears.push({ s, ep }); }
  // 脚：前は肩→肘→手首→足、後ろは腰→膝→かかと→足。肘と膝で曲げる。関節のすき間は丸みでつなぐ
  const legs = [];
  const leg = (s, front) => { const top = new T.Group(); top.position.set(s * (front ? .085 : .095), front ? .6 : .63, front ? .32 : -.38); g.add(top);
    const up = new T.Mesh(sweep(front ? [[0, 0, 0], [0, -.1, -.03], [0, -.2, -.02]] : [[0, 0, 0], [0, -.12, .06], [0, -.24, .08]], tab([[0, .07], [1, .045]]), tab([[0, .08], [1, .05]]), (t, sx, cy) => mixc(R, Cr, sstep(-.05, -.55, s * sx) * sstep(0, .35, t)), { n: 8, r: 12, up: [0, 0, 1] }), fur); top.add(up);   // 脚の内の白は、つけ根では胴の毛にとけこむ
    addFur(up, mat, { ...FD, len: .012, comb: [0, -1.4, 0] });
    const knee = new T.Group(); knee.position.set(0, front ? -.2 : -.24, front ? -.02 : .08); top.add(knee);
    knee.add(ellC(fur, R, 0, 0, 0, .045, .05, .05, 10));
    const lo = new T.Mesh(sweep(front ? [[0, 0, 0], [0, -.18, .01], [0, -.33, .03]] : [[0, 0, 0], [0, -.12, -.1], [0, -.22, -.14]], tab([[0, .042], [1, .032]]), tab([[0, .045], [1, .034]]), (t, sx, cy) => t > .55 || s * sx < -.2 ? Cr : R, { n: 8, r: 10, up: [0, 0, 1] }), fur); knee.add(lo);
    addFur(lo, mat, { ...FD, len: .006, comb: [0, -1.4, 0] });
    const ank = new T.Group(); ank.position.set(0, front ? -.33 : -.22, front ? .03 : -.14); knee.add(ank);
    ank.add(ellC(fur, Cr, 0, 0, 0, .034, .036, .036, 10));
    if (!front) ank.add(new T.Mesh(sweep([[0, 0, 0], [0, -.09, .03], [0, -.16, .06]], .03, .033, () => Cr, { n: 5, r: 8, up: [0, 0, 1] }), fur));
    const paw = ellC(fur, Cr, 0, front ? -.045 : -.135, front ? .045 : .09, .045, .028, .06, 12);
    for (const tx of [-.03, -.01, .01, .03]) ank.add(ellC(fur, Cr, tx, front ? -.06 : -.15, (front ? .045 : .09) + .045 - Math.abs(tx) * .4, .014, .014, .018, 8));   // 指（足先の丸み）
    ank.add(paw); addFur(paw, mat, { ...FD, len: .15, dens: 210 * .05, comb: [0, 0, 0], droop: .2 }); legs.push({ top, knee, ank, s, front }); };
  for (const s of [-1, 1]) { leg(s, true); leg(s, false); }
  // 巻いた尾（背の上で巻く。裏は白い。毛が長くふさふさ）。付け根を軸に左右へ振る
  const tailP = new T.Group(); tailP.position.set(0, .74, -.48); g.add(tailP);
  const tailG = sweep([[0, .74, -.48], [0, .92, -.56], [0, 1.03, -.46], [.03, 1.02, -.33], [.08, .93, -.31], [.1, .87, -.38]], tab([[0, .055], [.5, .06], [1, .025]]), tab([[0, .055], [.5, .065], [1, .025]]), (t, sx, cy) => cy < -.1 ? Cr : R, { n: 20, r: 12 }); tailG.translate(0, -.74, .48);
  const tailM = new T.Mesh(tailG, fur); tailP.add(tailM);
  addFur(tailM, mat, { ...FD, len: (u) => .055 * sstep(0, .15, u) * (1 - .4 * sstep(.8, 1, u)), droop: .25, thick: .5, comb: [0, 0, 0] });
  g.userData = { kind: 'inu', head, legs, ears, tail: tailP };
  // 歩き方（2026-10-13）：動きはじめは「なみ足」（4 拍・左後→左前→右後→右前の順に一本ずつ）、速くなると「速足（トロット）」（対角の前後が一緒）へ移る。
  //   足が地面にある割合はなみ足で長く（約 6 割）、速足で短い（半分弱）。速足では体が一歩ごとに小さく上下し、なみ足では頭が前脚に合わせてうなずく（Hildebrand 1965・Maes ら 2008）。
  //   止まると：息で胸がふくらむ・耳を別々に動かす・見回す・ときどき地面を嗅ぐ（嗅ぐときは鼻を 1 秒に数回ひくつかせる。Craven ら 2010）・尾をゆるく振る。
  let spd = 0, gph = 0, last = 0, yawH = 0, ytgt = 0, sniffK = 0;
  const OFF = { w: { LH: 0, LF: .25, RH: .5, RF: .75 }, t: { LH: 0, LF: .5, RH: .5, RF: 1 } };
  g.userData.animate = (t, moving = true) => {
    const dt = clamp(t - last, 0, .1); last = t;
    spd += ((moving ? 1 : 0) - spd) * Math.min(1, dt * (moving ? .9 : 2.2));
    const trot = sstep(.5, .85, spd), go = sstep(.02, .2, spd), f = lerp(1.5, 2.4, trot);   // 一歩の回数（1 秒あたり）
    gph = (gph + dt * f * go) % 1;
    const duty = lerp(.62, .45, trot), A = lerp(.28, .42, trot) * go;
    for (const L of legs) { const id = (L.s < 0 ? 'L' : 'R') + (L.front ? 'F' : 'H'), off = lerp(OFF.w[id], OFF.t[id], trot), p = ((gph - off) % 1 + 1) % 1;
      let ang, lift = 0; if (p < duty) ang = lerp(-A, A, p / duty); else { const q = (p - duty) / (1 - duty); ang = lerp(A, -A, sstep(0, 1, q)); lift = Math.sin(Math.PI * q) * go; }
      L.top.rotation.x = ang; L.knee.rotation.x = L.front ? -lift * .95 : lift * .75; L.ank.rotation.x = L.front ? lift * .55 : -lift * .45; }
    // 体の上下・左右のゆれ（速足は一歩に 2 回）と、息
    trunk.position.y = .64 - go * lerp(.004, .012, trot) * Math.cos(gph * TAU * 2); trunk.rotation.z = go * (1 - trot) * .02 * Math.sin(gph * TAU);
    const breath = Math.sin(t * TAU * lerp(.4, 1.2, clamp(spd * 1.5, 0, 1))); bodyM.scale.set(1 + .012 * breath, 1 + .016 * breath, 1);
    // 頭：歩くときは前へ。止まると見回し、ときどき嗅ぐ
    const idle = 1 - go, sn = idle * bout(t, 9, 3.2, 1.7);
    if (hash1(Math.floor(t / 2.3)) !== sniffK) { sniffK = hash1(Math.floor(t / 2.3)); ytgt = (sniffK - .5) * 1.0; }
    yawH += ((idle * (1 - sn) * ytgt) - yawH) * Math.min(1, dt * 3.5);
    neckP.rotation.set(go * (.08 + (1 - trot) * .04 * Math.sin(gph * TAU * 2)) + sn * .85, yawH * .55, 0);
    head.rotation.set(sn * .45 + idle * .04 * Math.sin(t * .7) - go * .05, yawH * .45, idle * .06 * Math.sin(t * .37));
    nose.scale.setScalar(1 + sn * .06 * Math.max(0, Math.sin(t * TAU * 5)));                  // 嗅ぐ：鼻をひくつかせる
    // 耳：止まっているときは別々に向きを変える。走ると少し後ろへ
    for (const e of ears) e.ep.rotation.set(.25 - trot * .3 + sn * .15, e.s * .25 * idle * bout(t, 4.1 + e.s * .7, .9, e.s * 3), -e.s * .25);
    // 尾：巻いた尾を左右に振る（歩くと速く）
    tailP.rotation.set(0, 0, .1 * Math.sin(t * TAU * lerp(.6, 1.8, go)) * lerp(.6, 1, go));
  };
  g.userData.animate(0, false);
  return g;
}

// ================================================================ ヘビとミミズ：背骨にそって毎こま組み直す体
function spineBody(mat, opts) {
  const { N, R, radius, color, map, len = 1 } = opts, n = (N + 1) * (R + 1);
  const g = new T.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= R; j++) { const k = i * (R + 1) + j, c = new T.Color(color(i / N, j / R)); col.set([c.r, c.g, c.b], k * 3); uv.set([i / N, j / R], k * 2); }
  for (let i = 0; i < N; i++) for (let j = 0; j < R; j++) { const a = i * (R + 1) + j, b = a + R + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }   // 面の向きを外へ（2026-10-13 直し：内向きで、上から見ると腹の側が見えていた）
  g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setIndex(idx);
  const mesh = new T.Mesh(g, mk(mat, 0xffffff, { vc: true, map, rough: opts.rough ?? .5, temp: opts.temp ?? .3, uv: .04, ...(opts.mo || {}) })); mesh.frustumCulled = false;
  const S = Array.from({ length: N + 1 }, () => ({ p: new T.Vector3(), t: new T.Vector3(), r: 1 }));
  // shape(i/N, S) で背骨を決めたら update で肉づけ
  mesh.userData.update = (rMul = () => 1, flat = .85) => {
    const side = new T.Vector3(), up = new T.Vector3(), Y = new T.Vector3(0, 1, 0);
    for (let i = 0; i <= N; i++) { const s = S[i], u = i / N, r = radius(u) * rMul(u);
      side.crossVectors(Y, s.t).normalize(); up.crossVectors(s.t, side).normalize();
      for (let j = 0; j <= R; j++) { const a = j / R * TAU, sx = Math.sin(a), cy = Math.cos(a), k = (i * (R + 1) + j) * 3, yy = cy < 0 ? cy * flat * .9 : cy * flat;
        pos[k] = s.p.x + side.x * sx * r + up.x * yy * r; pos[k + 1] = s.p.y + side.y * sx * r + up.y * yy * r + r * flat * .9; pos[k + 2] = s.p.z + side.z * sx * r + up.z * yy * r; } }
    g.attributes.position.needsUpdate = true; g.computeVertexNormals(); seam(g, N, R);
  };
  return { mesh, S };
}
// 体の向き（角度）の列から背骨をつなぐ：頭（u=1）から尾（u=0）へ積み上げる
function lay(S, len, ang, headPos = [0, 0, .45]) {
  const N = S.length - 1, ds = len / N; let x = headPos[0], z = headPos[2];
  for (let i = N; i >= 0; i--) { const a = ang(i / N); S[i].p.set(x, 0, z); S[i].t.set(Math.sin(a), 0, Math.cos(a)); x -= Math.sin(a) * ds; z -= Math.cos(a) * ds; }
}

// ================================================================ マムシ（Gloydius blomhoffii・全長 45〜60 cm）
//   太く短い体・短い尾・三角の頭。目と鼻孔のあいだにピット（熱を感じるくぼみ）。目は縦長の瞳。
//   背に、ふちの黒い丸い斑（銭形）が左右に並ぶ。目の後ろに黒い帯。
export function makeMamushi(mat = stdMat, o = {}) {
  const g = new T.Group(); const N = 90, R = 12;
  const tex = ctex('mamushi', 1024, 128, (c, w, h) => {
    // 地の色（2026-10-13 直し：淡いベージュ → 実物に近い褐色〜灰褐色。背の中央はやや暗く、わきは赤みの褐色）
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5a4433'); gr.addColorStop(.3, '#6b5039'); gr.addColorStop(.42, '#4f4339'); gr.addColorStop(.5, '#3a3530'); gr.addColorStop(.58, '#4f4339'); gr.addColorStop(.7, '#6b5039'); gr.addColorStop(1, '#5a4433'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(${rnd() < .5 ? '30,22,16' : '120,96,72'},${.12 + rnd() * .18})`; c.fillRect(rnd() * w, rnd() * h, 2, 2); }   // 鱗ごとの色のむら
    // 銭形：ふちの黒い輪の中が、地より少し明るい褐色。背の左右に、少しずらして並ぶ。輪は少し大きく、ふちを太く（上から読めるように）
    for (let i = 0; i < 26; i++) { const u = (.06 + i * .036) * w; for (const [v, off] of [[.16, 0], [.84, .018]]) { const x = u + off * w, y = v * h; c.fillStyle = '#1e1610'; c.beginPath(); c.ellipse(x, y, 17, 15, 0, 0, TAU); c.fill(); c.fillStyle = '#8a6c4c'; c.beginPath(); c.ellipse(x, y, 10, 8.5, 0, 0, TAU); c.fill(); c.fillStyle = '#3e3024'; c.beginPath(); c.ellipse(x - 1, y, 3.2, 3.2, 0, 0, TAU); c.fill(); } }
    for (let i = 0; i < 60; i++) { c.fillStyle = 'rgba(30,26,22,.6)'; c.beginPath(); c.arc((i / 60) * w, h * .5 + (i % 2 ? 6 : -6), 3, 0, TAU); c.fill(); }   // 腹の斑
  }, [1, 1]);
  const radius = u => .035 * Math.pow(sstep(0, .14, u), .7) * (1 - .45 * sstep(.9, 1, u)) + .0015;   // 太く短い体（2026-10-13 少し太く）
  // 2026-10-13：鱗の凹凸（法線の地図）。背の鱗は細長く、まん中に稜（竜骨＝キール）が通り、尾の側へ瓦のように重なる。腹は幅の広い腹板。
  //   乾いた鱗のやわらかな艶（濡れてぬめる艶ではない）。横（v）は体のまわり、腹は v＝0.5 のあたり
  const scaleN = nmap('mamushiN', 256, 512, (c, w, h) => { c.fillStyle = '#404040'; c.fillRect(0, 0, w, h);
    const rows = 21, bel0 = .39 * h, bel1 = .61 * h, dorsal = h - (bel1 - bel0), rowH = dorsal / rows, colW = w / 15;
    for (let r = 0; r < rows; r++) { const yc = (bel1 + (r + .5) * rowH) % h; for (let k = -1; k <= 15; k++) { const xc = (k + (r % 2) * .5) * colW;
      const gr = c.createLinearGradient(xc + colW * .6, 0, xc - colW * .6, 0); gr.addColorStop(0, '#202020'); gr.addColorStop(.75, '#c8c8c8'); gr.addColorStop(1, '#7a7a7a'); c.fillStyle = gr;
      c.beginPath(); c.ellipse(xc, yc, colW * .62, rowH * .5, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(xc + colW * .45, yc); c.lineTo(xc - colW * .5, yc); c.stroke(); } }   // 稜
    for (let k = 0; k <= 15; k++) { const x = k * colW, gr = c.createLinearGradient(x + colW, 0, x, 0); gr.addColorStop(0, '#303030'); gr.addColorStop(.85, '#b0b0b0'); gr.addColorStop(1, '#606060'); c.fillStyle = gr; c.fillRect(x, bel0, colW, bel1 - bel0); } }, 2.4, [10, 1]);
  const { mesh, S } = spineBody(mat, { N, R, radius, color: () => 0xffffff, map: tex, rough: .5, temp: .3, mo: { nmap: scaleN, ns: .55, phys: { clearcoat: .3, clearcoatRoughness: .35, sheen: .35, sheenRoughness: .45, sheenColor: 0xe6dcc4 } } });
  mesh.material.map = tex; g.add(mesh);
  // 頭（三角で、首よりはっきり幅が広い）
  const head = new T.Group(); g.add(head); const headS = new T.Group(); headS.scale.set(1.35, 1.15, 1.1); head.add(headS);
  const hc = (t, sx, cy) => { if (cy < -.3) return 0xd8cdb4; if (t > .3 && t < .78 && cy > -.25 && cy < .2 && Math.abs(sx) > .55) return 0x231b14; if (t > .3 && t < .8 && cy > .2 && cy < .38 && Math.abs(sx) > .5) return 0xcfc2a2; return 0x664e3a; };   // 頭の地も体と同じ褐色に（2026-10-13）
  headS.add(new T.Mesh(sweep([[0, .0, -.01], [0, .002, .03], [0, .0, .065], [0, -.002, .08]], tab([[0, .017], [.35, .027], [.75, .02], [1, .006]]), tab([[0, .015], [.35, .014], [.75, .011], [1, .005]]), hc, { n: 16, r: 14, k: (t, sx, cy) => (cy > .5 ? .95 : 1) * (1 + .35 * sstep(.15, .4, t) * (1 - sstep(.45, .75, t)) * Math.abs(sx)) }), mk(mat, 0xffffff, { vc: true, map: scaleTex([6, 3]), rough: .45, temp: .3, phys: { clearcoat: .4, clearcoatRoughness: .3, sheen: .3, sheenColor: 0xe6dcc4 } })));
  const eyeM = wetEye(mat, 0xb88a3a, { temp: .3 }), pupM = mk(mat, 0x050505, { rough: .1 }), pitM = mk(mat, 0x0c0907, { rough: .9 });   // 目は透明な鱗（ブリル）におおわれ、つやがある
  for (const s of [-1, 1]) { headS.add(ell(eyeM, s * .019, .009, .05, .006, .0065, .0065, 12)); headS.add(ell(pupM, s * .0245, .009, .051, .0012, .0052, .0022, 6));   // 縦長の瞳
    headS.add(ell(pitM, s * .0175, .002, .064, .0028, .0024, .002, 8)); headS.add(ell(pitM, s * .009, .006, .077, .0018, .0015, .0015, 6)); }   // ピット・鼻孔
  const tongue = new T.Group(); tongue.position.set(0, -.002, .078); headS.add(tongue); const tM = mk(mat, 0x1a1214, { rough: .35, phys: { clearcoat: .8, clearcoatRoughness: .15 } });
  tongue.add(tube(tM, [[0, 0, 0], [0, -.002, .018]], .0012, .001, null, 3, 4)); for (const s of [-1, 1]) tongue.add(tube(tM, [[0, -.002, .018], [s * .004, -.004, .028]], .001, .0006, null, 3, 4));
  g.userData = { kind: 'hebi', head };
  let ph = 0, lastT = 0, hy = 0;
  g.userData.animate = (t, moving = true) => { const dt = clamp(t - lastT, 0, .1); lastT = t; ph += dt * (moving ? 1.6 : .15);
    // 蛇行（横うねり）：波は頭から尾へ伝わり、体は頭の通った道すじをたどる（Gray 1946・Jayne 1986）。頭のゆれは小さい
    lay(S, 1, u => (.55 * sstep(.0, .25, u) * (1 - .8 * sstep(.75, 1, u)) + .08) * Math.sin(TAU * (1.25 * u + ph)) * (moving ? 1 : .55), [0, 0, .42]);
    mesh.userData.update(u => 1 + .025 * Math.sin(t * .9) * sstep(.3, .6, u), .78);   // 息（胴の前半がゆっくりふくらむ）
    const hd = S[N], ya = Math.atan2(hd.t.x, hd.t.z); hy += (ya - hy) * Math.min(1, dt * 6);
    const lift = moving ? 0 : .006 * bout(t, 6, 2.5, 1.3);   // 止まっていると、ときどき頭を少し上げる
    head.position.set(hd.p.x, radius(1) * .2 + .012 + lift, hd.p.z); head.rotation.set(-lift * 8, hy, 0, 'YXZ');
    // 舌：出して上下に数回ふるわせ、引っこめる（においの粒を集める。Schwenk 1994）。動いているときは回数が多い
    const per = moving ? 1.8 : 3.2, k = Math.floor(t / per), x = t - k * per, d = .35 + hash1(k + 4) * .35;
    if (x < d) { tongue.visible = true; const ex = sstep(0, .07, x) * (1 - sstep(d - .07, d, x)); tongue.scale.set(1, 1, Math.max(.05, ex)); tongue.rotation.x = .5 * Math.sin(x * TAU * 6) * ex; }
    else tongue.visible = false; };
  g.userData.animate(0, false);
  return g;
}

// ================================================================ ミミズ（フトミミズのなかま・体長 10〜20 cm）
//   目はない。体は百あまりの体節の輪。頭の側から 14〜16 節めに輪の形の環帯（色と太さが違う）。
//   はう：輪の筋がしまって細く長く、縦の筋がしまって太く短く、その波が頭から尾へ伝わる（蠕動）。
export function makeWorm(mat = stdMat, o = {}) {
  const g = new T.Group(); const N = 120, R = 10;
  const tex = ctex('worm', 1024, 64, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8a4a40'); gr.addColorStop(.35, '#a8665a'); gr.addColorStop(.5, '#d0a294'); gr.addColorStop(.65, '#a8665a'); gr.addColorStop(1, '#8a4a40'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(214,150,118,.95)'; c.fillRect(w * .84, 0, w * .035, h);                                    // 環帯（頭の側から 14〜16 節）
    for (let i = 0; i < 115; i++) { const x = i / 115 * w; c.fillStyle = 'rgba(60,24,20,.4)'; c.fillRect(x, 0, 1.2, h); }
    c.fillStyle = 'rgba(110,28,30,.55)'; c.fillRect(0, 0, w, 2.5); c.fillRect(0, h - 2.5, w, 2.5); }, [1, 1]);   // 背の血管が皮ふを透けて見える
  const radius = u => .018 * Math.pow(sstep(0, .06, u), .5) * Math.pow(1 - sstep(.955, 1, u), .45) * (1 - .3 * sstep(.9, .97, u)) * (1 + .12 * sstep(.835, .845, u) * (1 - sstep(.87, .88, u))) + .002;
  // 2026-10-13：体節の輪のくびれ（法線の地図・体節の数にそろえる）。粘液で湿った艶（クリアコート）と、皮ふが薄く赤く透ける見え方（赤みのシーン＋うしろからの光）
  const ringN = nmap('wormRing', 32, 8, (c, w, h) => { for (let x = 0; x < w; x++) { const v = Math.pow(Math.sin(Math.PI * (x + .5) / w), .6) * 255 | 0; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(x, 0, 1, h); } }, 3, [115, 1]);
  const { mesh, S } = spineBody(mat, { N, R, radius, color: () => 0xffffff, map: tex, rough: .42, temp: .15, mo: { nmap: ringN, ns: .7, phys: { clearcoat: .8, clearcoatRoughness: .12, sheen: .35, sheenRoughness: .4, sheenColor: 0xb05a48 }, key: 'trans', hook: transHook({ trans: 0x6a2418 }) } }); mesh.material.map = tex; g.add(mesh);
  g.userData = { kind: 'mimizu' };
  // はう（蠕動）：輪の筋が縮むと細く長く、縦の筋が縮むと太く短くなる（体の中の液の量は同じ＝太さ²×長さが一定）。
  //   この波が頭から尾へ伝わる。太く短い節は剛毛を土に立てて止まり（いかり）、細く長い節が前へ伸びる（Gray & Lissmann 1938・Quillin 1999）。
  //   止まった節は動かないように全体の位置を決め、頭の通った道すじを体がたどる。見る人の体では、頭を画面の同じ所に置く。
  let ph = 0, lastT = 0, sTail = 0, init = false; const sArr = new Float32Array(N + 1), sPrev = new Float32Array(N + 1), rArr = new Float32Array(N + 1);
  const px = s => .05 * Math.sin(s * 2.1) + .022 * Math.sin(s * 5.3 + 1);
  g.userData.animate = (t, moving = true) => { const dt = clamp(t - lastT, 0, .1); lastT = t; ph += dt * (moving ? .75 : .2);
    const amp = moving ? .2 : .07, ds0 = 1 / N;
    for (let i = 0; i <= N; i++) { const u = i / N; rArr[i] = 1 + amp * Math.sin(TAU * (2.6 * (1 - u) - ph)) * sstep(0, .08, u); }
    const place = () => { let a = sTail; for (let i = 0; i <= N; i++) { sArr[i] = a; a += ds0 / (rArr[i] * rArr[i]); } };
    place();
    if (init) { let sw = 0, sd = 0; for (let i = 0; i <= N; i++) { const w = Math.max(0, rArr[i] - 1) ** 2; sw += w; sd += w * (sPrev[i] - sArr[i]); } if (sw > 1e-6) { sTail += sd / sw; place(); } }
    init = true; sPrev.set(sArr);
    const sH = sArr[N], probe = .035 * wob(t * .7, 3);
    for (let i = 0; i <= N; i++) { const u = i / N, s = sArr[i], hb = probe * sstep(.86, 1, u) ** 2; S[i].p.set(px(s) - px(sH) + hb, 0, .5 - (sH - s)); }
    for (let i = 0; i <= N; i++) { const a = S[Math.max(0, i - 1)].p, b = S[Math.min(N, i + 1)].p; S[i].t.set(b.x - a.x, 0, b.z - a.z).normalize(); }
    mesh.userData.update(u => rArr[Math.round(u * N)], .92); };
  g.userData.animate(0);
  return g;
}

// ================================================================ コウモリ（アブラコウモリ・頭胴 4〜6 cm・前腕 3〜3.6 cm・翼開長 約 20 cm）
//   翼は、長く伸びた指（第 2〜5 指）と前腕・後ろ脚のあいだに張った皮膜。親指は外に出て爪がある。
//   尾は脚のあいだの膜（腿間膜）に包まれ、かかとの軟骨（距）が膜のふちを支える。
export function makeBat(mat = stdMat, o = {}) {
  const g = new T.Group();
  const fur = mk(mat, 0xffffff, { vc: true, map: furTex([4, 3]), rough: .9, temp: .95, uv: .03 });
  // 2026-10-13：体と頭はやわらかな毛（背は暗い褐色、腹は淡い）。毛の層で
  const torsoM = new T.Mesh(sweep([[0, .0, -.42], [0, .02, -.2], [0, .03, .05], [0, .03, .22]], tab([[0, .04], [.2, .12], [.55, .145], [1, .1]]), tab([[0, .04], [.2, .11], [.55, .13], [1, .1]]), (t, sx, cy) => cy > -.1 ? 0x4b3a2c : 0x7a6654, { n: 16, r: 14 }), fur);
  g.add(torsoM); addFur(torsoM, mat, { n: MOBILE ? 4 : 10, comb: [0, 0, -1.4], len: (u) => .045 * sstep(0, .2, u), dens: 170, thick: .42, root: .5, droop: .3, temp: .95, sheen: 0xe8d8c4 });
  const head = new T.Group(); head.position.set(0, .05, .27); g.add(head);
  const headM = new T.Mesh(sweep([[0, 0, -.04], [0, .01, .08], [0, -.01, .2], [0, -.02, .25]], tab([[0, .09], [.4, .1], [.8, .055], [1, .02]]), tab([[0, .09], [.4, .095], [.8, .05], [1, .02]]), (t, sx, cy) => t > .65 ? 0x2a2019 : 0x4b3a2c, { n: 12, r: 14 }), fur);
  head.add(headM); addFur(headM, mat, { n: MOBILE ? 4 : 10, comb: [0, 0, -1.2], len: (u) => .03 * (1 - sstep(.55, .75, u)), dens: 170, thick: .4, root: .5, temp: .95, sheen: 0xe8d8c4 });
  const skin = mk(mat, 0x2b201b, { rough: .7, temp: .8, side: T.DoubleSide });
  for (const s of [-1, 1]) { const ear = new T.Mesh(sweep([[0, 0, 0], [0, .07, .0], [0, .13, -.01]], tab([[0, .055], [.6, .045], [1, .008]]), tab([[0, .02], [1, .004]]), () => 0x2b201b, { n: 6, r: 8, up: [0, 0, 1] }), skin); ear.position.set(s * .06, .07, .04); ear.rotation.set(-.2, s * -.5, s * -.35); ear.scale.set(1.35, 1.25, 1.6); head.add(ear);   // 毛より上に出る耳（2026-10-13 直し：head.add がコメントの中に入っていて、耳が付いていなかった）
    { const tr = new T.Mesh(sweep([[0, 0, 0], [0, .035, .004]], tab([[0, .012], [1, .003]]), tab([[0, .006], [1, .002]]), () => 0x4a3a30, { n: 3, r: 6, up: [0, 0, 1] }), skin); tr.position.set(s * .048, .07, .07); tr.rotation.set(-.1, s * -.5, s * -.2); head.add(tr); }   // 耳珠（耳の前の小さな突起。アブラコウモリは短く丸い）
    head.add(ell(wetEye(mat, 0x060606), s * .055, .025, .17, .013, .013, .013, 12)); }
  // 皮膜と骨：皮膜は薄い皮ふで、血管と弾性繊維の筋が走る。うしろから光が当たると赤褐色に透け、血管が暗い線になって浮かぶ
  const veinTex = ctex('batVein', 256, 128, (c, w, h) => { c.fillStyle = '#3d2c25'; c.fillRect(0, 0, w, h);
    for (let y = 2; y < h; y += 5) { c.strokeStyle = 'rgba(30,20,16,.35)'; c.lineWidth = .8; c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= w; x += 16) c.lineTo(x, y + Math.sin(x * .05 + y) * 1.5); c.stroke(); }   // 弾性繊維（細い平行の筋）
    const br = (x, y, a, len, wd) => { if (wd < .5 || len < 6) return; const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; c.strokeStyle = 'rgba(28,14,12,.85)'; c.lineWidth = wd; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo((x + x2) / 2 + (rnd() - .5) * 10, (y + y2) / 2 + (rnd() - .5) * 10, x2, y2); c.stroke();
      br(x2, y2, a + (rnd() - .5) * .9, len * .7, wd * .7); if (rnd() < .6) br(x2, y2, a + (rnd() < .5 ? -1 : 1) * (.5 + rnd() * .5), len * .55, wd * .55); };
    for (let k = 0; k < 6; k++) br(0, (k + .5) / 6 * h, (rnd() - .5) * .3, 60, 2.6); });   // 血管（付け根から先へ枝分かれ）
  const memM = mk(mat, 0xffffff, { map: veinTex, rough: .62, side: T.DoubleSide, temp: .55, uv: .03, phys: MOBILE ? undefined : { sheen: .25, sheenRoughness: .4, sheenColor: 0x806050, clearcoat: .15, clearcoatRoughness: .4 }, key: 'trans', hook: transHook({ trans: 0xc8603e }) }), boneM = mk(mat, 0x3a2c24, { rough: .6, temp: .7 });
  const NB = 16, bones = [];
  for (let i = 0; i < NB * 2; i++) { const b = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 5).translate(0, .5, 0).rotateX(Math.PI / 2), boneM); g.add(b); bones.push(b); }
  const patches = [];
  const patch = (nA, nB) => { const n = (nA + 1) * (nB + 1), geo = new T.BufferGeometry(), idx = []; geo.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3));
    for (let i = 0; i < nA; i++) for (let j = 0; j < nB; j++) { const a = i * (nB + 1) + j, b = a + nB + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); } geo.setIndex(idx);
    const uv = new Float32Array(n * 2); for (let i = 0; i <= nA; i++) for (let j = 0; j <= nB; j++) uv.set([i / nA, j / nB], (i * (nB + 1) + j) * 2); geo.setAttribute('uv', new T.BufferAttribute(uv, 2));   // 付け根→先＝u
    const m = new T.Mesh(geo, memM); m.frustumCulled = false; g.add(m); return { m, nA, nB }; };
  for (let s = 0; s < 2; s++) patches.push([patch(10, 6), patch(6, 5), patch(6, 5), patch(6, 4)]);
  const uro = patch(6, 6);
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const fillStrip = (P, A, B, scal = 0, toward = null, bulge = 0) => {   // A・B の折れ線のあいだに膜を張る。最後の列（後ろのふち）を内へ弧に
    const pos = P.m.geometry.attributes.position, pa = poly(A, P.nA), pb = poly(B, P.nA);
    for (let i = 0; i <= P.nA; i++) for (let j = 0; j <= P.nB; j++) { const u = j / P.nB, p = pa[i].clone().lerp(pb[i], u);
      if (scal && toward && i === P.nA) p.lerp(toward, scal * Math.sin(Math.PI * u)); else if (scal && toward) p.lerp(toward, scal * Math.sin(Math.PI * u) * Math.pow(i / P.nA, 3));
      p.y += bulge * Math.sin(Math.PI * u) * Math.sin(Math.PI * i / P.nA); pos.setXYZ(i * (P.nB + 1) + j, p.x, p.y, p.z); }
    pos.needsUpdate = true; P.m.geometry.computeVertexNormals(); };
  function poly(pts, n) { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + pts[i].distanceTo(pts[i - 1])); const out = []; for (let i = 0; i <= n; i++) { const d = L[L.length - 1] * i / n; let k = 1; while (k < pts.length - 1 && L[k] < d) k++; const u = (d - L[k - 1]) / ((L[k] - L[k - 1]) || 1); out.push(pts[k - 1].clone().lerp(pts[k], clamp(u, 0, 1))); } return out; }
  const ZA = new T.Vector3(0, 0, 1), _bd = new T.Vector3();   // 骨の向き（親の回転に左右されないよう、自分の座標で向ける）
  let bi = 0; const bone = (a, b, r) => { const m = bones[bi++]; m.position.copy(a); m.quaternion.setFromUnitVectors(ZA, _bd.subVectors(b, a).normalize()); m.scale.set(r, r, a.distanceTo(b)); };
  function pose(elev, fold) {
    bi = 0;
    const A = [];
    for (const s of [-1, 1]) {
      const rot = (x, y, z) => { const c = Math.cos(elev), sn = Math.sin(elev), X = x * c - y * sn, Y = x * sn + y * c; return V(s * (.1 + X), .04 + Y, .1 + z); };
      const pl = (x, z, y = 0) => rot(x, y, z);
      const fa = lerp(0, .9, fold), E = [.36 * Math.cos(.25 + fa * .3), -.36 * Math.sin(.25 + fa * .3)], fwA = lerp(-.12, -1.2, fold);
      const W = [E[0] + .68 * Math.cos(fwA), E[1] - .68 * Math.sin(fwA)];
      const dig = (ang, len, sag) => { const a = ang + lerp(0, -.9 - ang * .5, fold), l = len * lerp(1, .75, fold), m = [W[0] + l * .55 * Math.cos(a), W[1] - l * .55 * Math.sin(a)], tip = [W[0] + l * Math.cos(a - .08), W[1] - l * Math.sin(a - .08)]; return [pl(m[0], m[1], -sag * .5), pl(tip[0], tip[1], -sag)]; };
      const Sh = pl(0, 0), El = pl(...E), Wr = pl(...W), [d2m, d2] = dig(.42, .72, .02), [d3m, d3] = dig(.12, 1.2, .07), [d4m, d4] = dig(-.5, .95, .06), [d5m, d5] = dig(-1.12, .82, .05);
      const hip = V(s * .07, -.02, -.3), knee = V(s * .2, -.03, -.36), ank = V(s * .24, -.06, -.5), calc = V(s * .14, -.07, -.66);
      bone(Sh, El, .028); bone(El, Wr, .022); bone(Wr, d2m, .01); bone(d2m, d2, .008); bone(Wr, d3m, .012); bone(d3m, d3, .009); bone(Wr, d4m, .011); bone(d4m, d4, .008); bone(Wr, d5m, .011); bone(d5m, d5, .008);
      bone(Wr, pl(W[0] + .06, W[1] + .1, .03), .012);    // 親指
      bone(hip, knee, .02); bone(knee, ank, .016); bone(ank, calc, .007);
      const P = patches[s < 0 ? 0 : 1], toW = Wr.clone();
      // 腕と脚のあいだ（2026-10-13 直し：第 5 指の側を手首へ引き寄せていたため、手首で膜がくびれて二枚の板に見えた。
      //   第 5 指は手首から後ろのふちへ伸びて膜の幅を保つので、膜の外のふちは第 5 指の骨（中ほどの点を通る）にそわせる）
      fillStrip(P[0], [Sh, El, Wr, Wr.clone().lerp(d5m, .5), d5m], [V(s * .1, .0, .05), hip, knee, ank, d5], 0, null, .03 * (1 - fold));
      fillStrip(P[1], [Wr, d5m, d5], [Wr, d4m, d4], .22, toW, .02);
      fillStrip(P[2], [Wr, d4m, d4], [Wr, d3m, d3], .22, toW, .02);
      fillStrip(P[3], [Sh, El, Wr, d2m, d2], [Sh.clone().add(V(0, .0, .05)), El.clone().add(V(0, 0, .06)), Wr.clone().add(V(0, 0, .03)), d3m, d3], 0, null, 0);   // 腕の前・第 2〜3 指のあいだ
      A.push({ ank, calc });
    }
    const tb = V(0, -.02, -.42), tm = V(0, -.04, -.7), tt = V(0, -.06, -.95); bone(tb, tm, .012); bone(tm, tt, .009);
    fillStrip(uro, [A[0].ank, A[0].calc, tt], [A[1].ank, A[1].calc, tt], .1, tb, -.02);
    for (let k = 0; k < bones.length; k++) bones[k].visible = k < bi;
  }
  g.userData = { kind: 'koumori', head, ph: o.ph || 0 };
  // 飛び方（2026-10-13）：打ち下ろしで翼をいっぱいに広げ、打ち上げでは指と肘を曲げて翼をたたむ（Norberg 1976・Riskin ら 2008）。
  //   虫を追う飛び方は不規則で、ときどき急に向きを変える（Griffin ら 1960）。羽ばたきは見やすく少し遅い（小型のコウモリは 1 秒に 10 回をこえるとされる。Jones 1994）
  g.userData.animate = (t, moving = true) => { const ph = g.userData.ph, p = t * 6.5 * TAU, s1 = Math.sin(p);
    pose(lerp(.35, -.5, (s1 + 1) / 2) * -1, .62 * Math.max(0, Math.cos(p + .6)));
    const buzz = bout(t, 5.5, .7, ph * 3), dir = hash1(Math.floor((t + ph * 3) / 5.5)) < .5 ? -1 : 1;
    g.position.set(wob(t * .9, ph) * .06 + dir * buzz * .08, -.035 * Math.sin(p - .9) + wob(t * .7, ph + 2) * .05, 0);
    g.rotation.set(.06 * Math.sin(p - 1.2) + wob(t * 1.1, ph + 4) * .06, wob(t * .6, ph + 1) * .1 + dir * buzz * .35, wob(t * .8, ph + 3) * .12 + dir * buzz * .55);
    head.rotation.set(wob(t * 1.3, ph + 5) * .08, wob(t * 1.1, ph + 6) * .15 - g.rotation.y * .5, 0); };
  g.userData.animate(0);
  return g;
}

// ---------------------------------------------------------------- 森羅博物館の写し（2026-10-13）
//   これは《胡蝶の夢》の ★実行データ/creatures.js の写し（上はそのまま）。森羅博物館が、同じ道具で別の種（鷺・雁・燕・雀・鶯・鯉・蜻蛉・野うさぎ）を
//   作るため、下の一行で中の道具を外へ出しているだけ。共通の部品（12_ブランド/_共通3D/kit/）に生き物ができたら、そちらへ切り替える。
export { T, TAU, clamp, lerp, sstep, tab, mixc, mk, ctex, rnd, furTex, plumeTex, scaleTex, sweep, seam, ell, flatShape, smoothPts, shapeTex, tube, MOBILE, nmap, facetN, wetEye, compoundEye, addFur, transHook, glintHook, thinFilm, wob, bout, hash1, featherGeo, featherTex };
