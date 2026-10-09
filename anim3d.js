/* 企画展「絵から出てくる生きもの」（2026-10-07）。
   本人（2026-10-07）：「手前の 10 作品をアニメーションで作る：絵から生き物を切り抜いて動かす（鳥が額から飛び立って部屋を一周して戻る、魚が泳ぐ、など）。
   10 点とも品よく、動きは生き物として正しく」「企画展として中央の踊り場に：各セクションから一つずつ……それぞれが自分のセクションへ案内する」
   素材＝data/anim.js（_dev/anim.py の生成物。CC0／パブリックドメインの作品だけ）。
   動きの型（style）は、その生きものの移動のしかたに合わせた（README の表）：
     sparrow＝はばたきと、翼をたたむ短い滑空をくり返す波形の飛び方／swallow＝速く、はばたきと長い滑空、上下に大きく弧を描く／
     goose＝ゆっくり一定のはばたき、列になって飛ぶ／butterfly＝大きくはばたき、ふらふらと向きを変える／
     dragonfly＝すばやく直線に動いては空中で止まる（翅は速すぎて見えにくい）／carp＝体の後ろ半分を左右にくねらせて、ゆっくり泳ぐ／
     hare＝後ろ足でそろって跳ぶ（跳躍）／warbler＝短く速い羽ばたきで、枝から枝へ短く飛び移る（2026-10-07 本人「うぐいすが絵から出るが飛べていない」）／heron＝一歩ずつゆっくり歩き、止まって待つ。
   2026-10-07 本人「絵から飛び出るキャラクターは平面でなく立体に（厚みと陰のある 3D の生き物。元の絵の色と筆致を生かした質感で）」→ 切り抜きの形（アルファ）から体のふくらみを作り、
   表と裏に厚みを持たせ、ふくらみの向きで陰をつける（元の絵の色と筆致はそのまま）。「タッチすると反応する」→ 種に合った反応（飛び上がる・跳ねる・身をひるがえす）。 */

import * as THREE_ from "three";
import { createCreatures } from "./creatures3d.js";
const CR = createCreatures(THREE_);
const VS = `uniform float uA, uB, uMode, uWave, uWaveK, uWaveP, uShim, uT, uThick; uniform vec2 uP0, uDir, uTexel; uniform float uLen, uSide; uniform sampler2D uMap;
varying vec2 vUv; varying float vShade; varying vec3 vN;
float H(vec2 u){ return textureLod(uMap, u, 3.5).a; }
void main(){
  vUv = uv; vec3 p = position; vec2 q = p.xy - uP0; float al = dot(q, uDir); vec2 perp = vec2(-uDir.y, uDir.x); float s = dot(q, perp);
  vShade = 1.;
  // 体のふくらみ：切り抜きの形の内側ほど厚く（板ではなく、厚みのある生きもの）
  float h = H(uv), hx = H(uv + vec2(uTexel.x, 0.)) - H(uv - vec2(uTexel.x, 0.)), hy = H(uv + vec2(0., uTexel.y)) - H(uv - vec2(0., uTexel.y));
  p.z += uThick * sqrt(max(h, 0.)); vN = normalize(vec3(-hx * 2.2, -hy * 2.2, 1.));
  if (uMode < .5) {                       // はばたき：体の軸から外の翼を、軸のまわりに回す
    float e = abs(s) - uB;
    if (e > 0. && (uSide == 0. || sign(s) == uSide)) { float a = uA; float ns = sign(s) * (uB + e * cos(a)); p.xy = uP0 + uDir * al + perp * ns; p.z += e * sin(a); vShade = .82 + .18 * cos(a); }
  } else if (uMode < 1.5) {               // 泳ぐ：頭から尾へ、後ろほど大きくくねる
    float t = clamp(al / uLen, 0., 1.); p.z += uWave * t * t * sin(uWaveK * t - uWaveP);
  }
  if (uShim > 0.) { float e = abs(s) - uB; if (e > 0.) p.z += uShim * sin(uT * 180. + al * 40.) * e; }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
}`;
const FS = `uniform sampler2D uMap; uniform float uOp, uBright; varying vec2 vUv; varying float vShade; varying vec3 vN;
void main(){ vec4 c = texture2D(uMap, vUv); if (c.a < .04) discard;
  vec3 L = normalize(vec3(-.35, .6, .72)); float lam = .55 + .55 * max(dot(normalize(vN), L), 0.); float rim = pow(1. - abs(normalize(vN).z), 2.) * .25;
  vec3 col = c.rgb * uBright * vShade * lam + rim * .35; if (!gl_FrontFacing) col *= .62;   // 裏は暗く（厚みの陰）
  gl_FragColor = vec4(col, c.a * uOp); }`;

// life＝外に出たときの体の長さ（m・いちばん長いところ）。おおよその実物の大きさ（雀・燕は翼を広げて 20〜30 cm 台、雁は 1.3 m 以上、鯉 60 cm、野うさぎ 50 cm、鶯 15 cm、鷺 90 cm）。
//   小さすぎて見えない蝶・蜻蛉・鶯は、見える大きさの下限（.28 m）にそろえた（README に書いた）
//   2026-10-07 本人「飛び出たアニメーションは少し大きくして目立たせる」→ 実物の 1.4 倍、下限 .45 m
const LIFE = Object.fromEntries(Object.entries({ sparrow: .26, swallow: .32, goose: 1.35, smallbird: .26, butterfly: .28, dragonfly: .28, carp: .65, hare: .55, warbler: .28, heron: .9 }).map(([k, v]) => [k, Math.max(.45, v * 1.4)]));
const STYLE = {
  sparrow:   { mode: 0, dur: 15, flapHz: 9, amp: .95, glide: [.42, .2], alt: 4.6, rad: 9.5, bob: .5 },
  swallow:   { mode: 0, dur: 11, flapHz: 7, amp: .85, glide: [.5, .55], alt: 5.2, rad: 12.5, bob: 1.6 },
  goose:     { mode: 0, dur: 21, flapHz: 3, amp: .7, glide: null, alt: 6.4, rad: 13.5, bob: .15, flock: true },
  smallbird: { mode: 0, dur: 13, flapHz: 10, amp: .9, glide: [.4, .2], alt: 4.4, rad: 8, bob: .5 },
  butterfly: { mode: 0, dur: 16, flapHz: 6, amp: 1.25, side: true, wander: true },
  dragonfly: { mode: 2, dur: 14, dart: true },
  carp:      { mode: 1, dur: 17, swim: true },
  hare:      { mode: 2, dur: 13, ground: "hop", step: 1.15, peak: .45, beat: .42 },
  warbler:   { mode: 0, dur: 11, flapHz: 15, amp: .95, glide: [.28, .14], hopper: true },
  heron:     { mode: 2, dur: 19, ground: "walk", step: .38, beat: .9 },
};

export function createExhibit(o) {
  const { THREE, world, rooms, FACES, WF, clickables, giltMat, brassMat, camera, getRM, onLanded } = o;
  const ANIM = window.ANIM || [];
  const TL = new THREE.TextureLoader();
  const items = [];
  const room = slug => rooms.find(r => r.slug === slug);
  // 置き場：円堂のまん中の踊り場に、部屋ごとの台（その部屋の扉へ向かう道の少しわき・円堂のまん中を向く）。
  //   いきもの百景のほかの三点は、玄関わきの壁（もう一方の面は書架の部屋の扉）。2026-10-07 本人「企画展として中央の踊り場に」
  const NF = FACES.length, side = FACES[NF - 1];
  const extraSlots = [{ f: side, v: -2.4 }, { f: side, v: 0 }, { f: side, v: 2.4 }];
  const used = new Set();
  const order = ANIM.filter(a => a.where !== "room").sort((a, b) => (a.id === "koi" ? -1 : 0) - (b.id === "koi" ? -1 : 0));
  for (const a of order) {
    const r = room(a.room); if (!r) continue;
    if (!used.has(a.room)) {
      used.add(a.room);
      const ang = r.th + .22, rE = o.R - 6.2, x = Math.sin(ang) * rE, z = -Math.cos(ang) * rE;
      const nrm = new THREE.Vector2(-x, -z).normalize();
      items.push(build(a, r, { p: new THREE.Vector2(nrm.y, -nrm.x), th: Math.atan2(-x, -z), easel: true, x, z }, 1, false));
      o.OBST?.push({ x, z, r: .85 });
    } else { const sl = extraSlots.shift(); if (!sl) continue; items.push(build(a, r, sl.f, sl.v, true)); }
  }

  function build(a, r, f, v, big) {
    const [iw, ih] = a.size, ar = iw / ih, maxW = big ? 1.9 : 1.7, maxH = big ? 2.2 : 2.0;   // 2026-10-07 本人「企画展の絵をもう少し大きく」
    let w = maxW, h = w / ar; if (h > maxH) { h = maxH; w = h * ar; }
    const g = new THREE.Group();
    if (f.easel) {   // 自立の台（木の脚・真鍮の受け）
      g.position.set(f.x, 2.02, f.z); g.rotation.y = f.th; world.add(g);
      const legM = o.darkWood || giltMat;
      for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.08, 2.6, .08), legM); leg.position.set(sx * (w / 2 + .05), -.72, -.12); leg.rotation.z = sx * .05; g.add(leg); }
      const back = new THREE.Mesh(new THREE.BoxGeometry(.07, 2.4, .07), legM); back.position.set(0, -.8, -.5); back.rotation.x = -.32; g.add(back);
      const ledge = new THREE.Mesh(new THREE.BoxGeometry(w + .3, .06, .16), brassMat); ledge.position.set(0, -h / 2 - .1, .02); g.add(ledge);
      if (o.poolMat) { const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), o.poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(0, -2.01, .6); g.add(pool); }
    } else { const p = WF(f, -.62, v); g.position.set(p.x, 2.35, p.z); g.rotation.y = -f.th; world.add(g); }
    const fr = .08;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 2 * fr, h + 2 * fr, .07), giltMat); frame.position.z = .035; g.add(frame);
    const lin = new THREE.Mesh(new THREE.PlaneGeometry(w + .03, h + .03), new THREE.MeshBasicMaterial({ color: 0x1a120a })); lin.position.z = .071; g.add(lin);
    const tex = u => { const t = TL.load(u); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    const mk = (map, z, tr) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .42, roughness: .8, envMapIntensity: .2, transparent: tr }));
    // 2026-10-07 本人「生き物が飛び出しても絵からはいなくならない。絵には元の生き物が残ったまま、そこから写しが飛び出る」
    const full = mk(tex(a.full), 0, false); full.position.z = .076; g.add(full); const empty = full;
    // 絵の上の真鍮の灯りと、下の小さな札（企画展のしるし）
    const bar = new THREE.Mesh(new THREE.BoxGeometry(Math.min(.9, w * .5), .05, .07), brassMat); bar.position.set(0, h / 2 + fr + .16, .2); g.add(bar);
    const label = o.labelCard(a, r, Math.max(.7, Math.min(1.25, w))); label.position.set(0, -h / 2 - fr - .17, .12); g.add(label);
    const it = { a, r, f, v, g, w, h, full, empty, frame, parts: [], state: "rest", t: 0, next: 4 + Math.random() * 14, mode: "show", wait: 0 };
    full.userData = frame.userData = { anim: it }; clickables.push(full, frame);
    addParts(it, a, w, h);
    return it;
  }
  // 部屋の中の絵（2026-10-08 本人「部屋の中の絵からも生きものが抜け出るように」）：掛かっている絵の上に、写しを重ねて置く。
  //   parent＝その絵の掛かる場所の group（bay.g）、(x, y)＝絵のまん中、w×h＝絵の大きさ、r＝部屋、v＝壁の側（±）、u＝部屋の奥行き
  const roomItems = [];
  function attach(a, r, parent, x, y, z, w, h, v, u) {
    const g = new THREE.Group(); g.position.set(x, y, z - .07); parent.add(g);
    const it = { a, r, f: r, v, u, g, w, h, inRoom: true, parts: [], state: "rest", t: 0, next: 1.5 + Math.random() * 2, mode: "show", wait: 0 };
    addParts(it, a, w, h); roomItems.push(it); return it;
  }
  function addParts(it, a, w, h) {
    const [iw, ih] = a.size, s = w / iw, tex = u => { const t = TL.load(u); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    for (const P of a.parts) {
      const [x0, y0, x1, y1] = P.box, bw = (x1 - x0) * s, bh = (y1 - y0) * s;
      const geo = new THREE.PlaneGeometry(bw, bh, 28, 28);
      // 体の軸（頭→尾）を、この板のローカル座標で
      const L = (x, y) => new THREE.Vector2((x - (x0 + x1) / 2) * s, ((y0 + y1) / 2 - y) * s);
      const hd = L(...P.head), tl = L(...P.tail), dir = tl.clone().sub(hd), len = dir.length(); dir.normalize();
      const st = STYLE[a.style] || STYLE.sparrow;
      const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, side: THREE.DoubleSide, depthWrite: false,
        uniforms: { uMap: { value: tex(P.f) }, uOp: { value: 0 }, uBright: { value: 1.18 }, uA: { value: 0 }, uB: { value: Math.min(bw, bh) * (a.style === "butterfly" ? .06 : .16) },
          uThick: { value: Math.min(bw, bh) * .22 }, uTexel: { value: new THREE.Vector2(1 / 28, 1 / 28) },
          uMode: { value: st.mode }, uWave: { value: 0 }, uWaveK: { value: 5.5 }, uWaveP: { value: 0 }, uShim: { value: 0 }, uT: { value: 0 },
          uP0: { value: hd }, uDir: { value: dir }, uLen: { value: len }, uSide: { value: st.side ? (P.up ? 1 : -1) : 0 } } });
      const m = new THREE.Mesh(geo, mat); m.visible = false; m.renderOrder = 5; world.add(m);
      m.userData = { animPart: it }; clickables.push(m);
      // 絵の中での場所（g の中の座標）
      const cx = ((x0 + x1) / 2 / iw - .5) * w, cy2 = (.5 - (y0 + y1) / 2 / ih) * h;
      // 絵の中での向き：頭の向き（画像の座標、上向きが +y）
      const fimg = new THREE.Vector2(P.head[0] - P.tail[0], -(P.head[1] - P.tail[1])).normalize();
      const S = Math.max(1, Math.min(7, (LIFE[a.style] || .3) / Math.max(bw, bh)));
      it.parts.push({ P, m, mat, local: new THREE.Vector3(cx, cy2, .08), fimg, bw, bh, st, S, ph: Math.random() * 6 });
    }
  }

  // ---------------------------------------------------------------- 道すじ
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  function restPose(it, pt) { const p = pt.local.clone().applyMatrix4(it.g.matrixWorld); const n = V(0, 0, 1).applyQuaternion(it.g.getWorldQuaternion(new THREE.Quaternion())); return { p, n }; }
  // 2026-10-09 本人「絵から出た生きものは、すぐ視野の外へ行かず、画面の中で動く。碧に近づく・碧のまわりを回る・碧の手や肩にとまる・碧が目で追う・手を差し出す」
  //   → 碧が近く（9 m 以内）にいるときは「碧へ」の道（kind＝aoi）。毎こま碧の位置から組みなおす（碧は動くので）。
  //   段：抜け出る → 碧へ近づく → 碧のまわりを回る → 小さな鳥・蝶・蜻蛉は碧の差し出した手にとまる（大きな鳥・魚・地面のものは、碧のそばで止まる）→ 絵へもどる
  const NEAR = { sparrow: .26, swallow: .3, warbler: .24, butterfly: .2, dragonfly: .22, goose: .9, heron: .8, carp: .5, hare: .45, smallbird: .26 };
  const PERCH = new Set(["sparrow", "swallow", "warbler", "butterfly", "dragonfly", "smallbird"]);
  let watch = null;   // 碧が目で追うもの：{ pos, perch }
  function makePath(it, pt, k, mode) {
    if (mode === "show") return { kind: "aoi" };   // 2026-10-09 本人「絵を見たときに出てきて、説明が終わるときには絵に帰る」：説明のあいだだけ、碧と関わる
    const { p, n } = restPose(it, pt), st = pt.st, pts = [p.clone(), p.clone().addScaledVector(n, .7)];
    const door = mode === "guide" ? WF(it.r, .9, 0) : null;
    if (st.ground) {
      const floor = p.clone().addScaledVector(n, 1.2); floor.y = 0;
      const side = V(it.f.p.x, 0, it.f.p.y), sgn = it.v > 0 ? -1 : 1;   // 壁にそって、扉のほう（v＝0）へ
      const dest = door ? door.clone().addScaledVector(n, 0) : floor.clone().addScaledVector(side, sgn * (st.ground === "walk" ? 2.6 : 3.4)).addScaledVector(n, .6);
      return { kind: "ground", up: pts, floor, dest, back: true };
    }
    if (st.swim) {   // 絵の前で、ゆっくり大きな輪を描いて泳ぐ（案内のときは扉まで）
      const side = V(n.z, 0, -n.x), c = p.clone().addScaledVector(n, 2.2);
      if (door) { pts.push(p.clone().lerp(door, .5).setY(p.y + .3), door.clone().setY(1.7)); return { kind: "curve", pts, hold: true }; }
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) pts.push(c.clone().addScaledVector(side, Math.sin(a) * 2.4).addScaledVector(n, -Math.cos(a) * 1.4).setY(p.y + Math.sin(a * 2) * .35));
      pts.push(p.clone().addScaledVector(n, .7), p.clone()); return { kind: "curve", pts };
    }
    if (st.hopper) {   // 鶯：絵の前の宙に「枝」の点を三つ置き、短い弧で飛び移る（止まるたびに少し休む）
      if (door) { pts.push(p.clone().lerp(door, .5).setY(2.4), door.clone().setY(2.0)); return { kind: "curve", pts, hold: true }; }
      const side = V(n.z, 0, -n.x), perch = [[1.2, .9, .3], [2.0, -1.1, -.2], [1.6, 1.4, .5], [.9, -.4, .1]];
      let prev = p.clone().addScaledVector(n, .7);
      for (const [f, l, dy] of perch) { const q = p.clone().addScaledVector(n, f).addScaledVector(side, l); q.y = p.y + dy; pts.push(prev.clone().lerp(q, .5).setY(Math.max(prev.y, q.y) + .45)); pts.push(q.clone(), q.clone()); prev = q; }
      pts.push(p.clone().addScaledVector(n, .6), p.clone()); return { kind: "curve", pts };
    }
    if (st.wander || st.dart) {
      if (door) { pts.push(p.clone().lerp(door, .5).setY(2.6), door.clone().setY(2.2)); return { kind: "curve", pts, hold: true }; }
      const side = V(n.z, 0, -n.x); let q = p.clone().addScaledVector(n, 1.2);
      const R = st.dart ? 3.2 : 2.6, nPts = st.dart ? 6 : 8;
      for (let j = 0; j < nPts; j++) { q = p.clone().addScaledVector(n, 1.4 + Math.random() * R).addScaledVector(side, (Math.random() - .5) * 2 * R).setY(1.4 + Math.random() * 1.8); pts.push(q); }
      pts.push(p.clone().addScaledVector(n, .7), p.clone()); return { kind: st.dart ? "dart" : "curve", pts };
    }
    if (it.inRoom) {   // 部屋の鳥：部屋のまん中の上へ出て、奥と手前を一往復して絵へもどる
      const u0 = it.u, far = u0 + (k % 2 ? 7 : -7), mid = (a, b, s) => a + (b - a) * s;
      for (const [s, vv, y] of [[.15, .3, st.alt * .62], [.45, -.6, st.alt * .7], [.85, .5, st.alt * .66], [1, -.2, st.alt * .6], [.6, -.9, st.alt * .68], [.25, .2, st.alt * .62]]) pts.push(WF(it.r, Math.max(1.5, mid(u0, far, s)), vv + Math.sin(s * 5) * .4).setY(y));
      pts.push(p.clone().addScaledVector(n, 1.2).setY(p.y + .3), p.clone().addScaledVector(n, .5), p.clone());
      return { kind: "curve", pts };
    }
    // 鳥：円堂をひとまわり（案内のときは扉へ）
    if (door) { const up = p.clone().addScaledVector(n, 2).setY(st.alt * .8); pts.push(up, door.clone().setY(3.2)); return { kind: "curve", pts, hold: true }; }
    const a0 = Math.atan2(p.x, p.z), dirSign = k % 2 ? 1 : -1;
    for (let j = 1; j <= 9; j++) { const a = a0 + dirSign * j / 9 * Math.PI * 2, rr = Math.min(st.rad, o.R - 3.4) + Math.sin(j * 1.7) * .7; pts.push(V(Math.sin(a) * rr, st.alt + Math.sin(j * 2.1) * st.bob, Math.cos(a) * rr)); }
    pts.push(p.clone().addScaledVector(n, 1.4).setY(p.y + .4), p.clone().addScaledVector(n, .6), p.clone());
    return { kind: "curve", pts };
  }

  // ---------------------------------------------------------------- 再生
  function start(it, mode = "show") {
    if (it.state !== "rest") return false;
    it.state = "out"; it.mode = mode; it.t = 0; it.wait = 0;
    it.g.updateMatrixWorld(true);
    it.parts.forEach((pt, k) => {
      pt.path = makePath(it, pt, k, mode); pt.m.visible = true; pt.mat.uniforms.uOp.value = 1;
      pt.delay = pt.st.flock ? k * .55 : k * .35;
      if (pt.path.kind === "aoi") { pt.ap = { ph: 0, pt: 0, pos: restPose(it, pt).p.clone(), ang: Math.random() * 6.28, dir: k % 2 ? 1 : -1 }; pt.curve = null; pt.done = false; return; }
      if (pt.path.kind === "curve" || pt.path.kind === "dart") pt.curve = new THREE.CatmullRomCurve3(pt.path.pts, false, "centripetal", .5);
      else pt.curve = new THREE.CatmullRomCurve3(pt.path.up.concat([pt.path.floor]), false, "centripetal", .5);
      pt.done = false;
    });
    return true;
  }
  const tmpQ = new THREE.Quaternion(), M4 = new THREE.Matrix4(), UP = V(0, 1, 0), tmpT = new THREE.Vector3();
  function orient(pt, pos, F, upright) {
    const cam = camera.position.clone().sub(pos);
    let X, Y, N;
    if (upright) {   // 地面の生きもの・蝶：板は立てたまま、進む向きへ
      const h = V(F.x, 0, F.z); if (h.lengthSq() < 1e-6) h.set(1, 0, 0); h.normalize();
      X = pt.fimg.x >= 0 ? h : h.clone().negate(); Y = UP.clone(); N = X.clone().cross(Y);
      if (N.dot(cam) < 0) { N.negate(); X.negate(); }   // 見る人に面を向ける（頭は進む向きのまま：鏡に映した形で見える）
      if (pt.fimg.x >= 0 ? X.dot(h) < 0 : X.dot(h) > 0) { /* 頭の向きは保つ */ }
    } else {         // 飛ぶ鳥：進む向きに頭を向け、板は見る人のほうへ
      const f = F.clone().normalize(); N = cam.clone().sub(f.clone().multiplyScalar(cam.dot(f))); if (N.lengthSq() < 1e-6) N.set(0, 1, 0); N.normalize();
      const S = N.clone().cross(f), th = Math.atan2(pt.fimg.y, pt.fimg.x);
      X = f.clone().multiplyScalar(Math.cos(th)).addScaledVector(S, -Math.sin(th)); Y = f.clone().multiplyScalar(Math.sin(th)).addScaledVector(S, Math.cos(th));
    }
    M4.makeBasis(X, Y, N); tmpQ.setFromRotationMatrix(M4); pt.m.quaternion.slerp(tmpQ, .25); pt.m.position.copy(pos); pt.m.scale.setScalar(pt.sc || 1);
  }
  function restAt(it, pt) { const { p } = restPose(it, pt); pt.m.position.copy(p); pt.m.scale.setScalar(1); pt.m.quaternion.copy(it.g.getWorldQuaternion(new THREE.Quaternion())); }

  function tickPart(it, pt, dt, T) {
    const st = pt.st, u = pt.mat.uniforms, t = Math.max(0, it.t - pt.delay);
    u.uT.value = T;
    // はばたき・泳ぎ・翅のふるえ
    if (st.flapHz) {
      const glide = st.glide && ((t % (st.glide[0] + st.glide[1])) > st.glide[0]);
      const hz = st.flapHz * (it.react > 0 ? 1.6 : 1);
      const target = glide && !(it.react > 0) ? -.12 : Math.sin(t * hz * Math.PI * 2 + pt.ph) * st.amp * (it.react > 0 ? 1.15 : 1);
      u.uA.value += (target - u.uA.value) * Math.min(1, dt * (glide ? 10 : 40));
      if (st.side) u.uA.value = (.5 + .5 * Math.sin(t * st.flapHz * Math.PI * 2)) * st.amp;
    }
    if (st.swim) { u.uWave.value = pt.bh * .07; u.uWaveP.value = t * 1.3 * Math.PI * 2; }
    if (st.dart) u.uShim.value = .015;
    if (pt.path.kind === "aoi") return aoiTick(it, pt, dt, T, t);
    const D = it.mode === "show-back" ? 4.5 : it.mode === "guide" ? (st.ground ? st.dur : Math.min(st.dur * .55, 9)) : st.dur;
    if (pt.path.kind === "ground") return groundTick(it, pt, t, D);
    let s = clamp01(t / D);
    if (pt.path.kind === "dart") { const nSeg = pt.path.pts.length - 1, f = s * nSeg, i = Math.floor(f), r = f - i; s = (i + easeDart(r)) / nSeg; }
    else s = smooth(s);
    if (pt.path.hold && s >= 1) { pt.hold = true; }
    if (it.mode === "show-back") grow(pt, s, true); else if (pt.path.hold) pt.sc = 1 + (pt.S - 1) * smooth(clamp01((s - .03) / .2)); else grow(pt, s);
    fadeOp(pt, t, pt.path.hold ? 0 : s);
    const pos = pt.curve.getPointAt(Math.min(1, s)), F = pt.curve.getTangentAt(Math.min(.999, Math.max(.001, s)));
    orient(pt, pos, F, !!(st.wander || st.swim || st.dart));
    if (s >= 1 && !pt.path.hold) { pt.done = true; restAt(it, pt); }
    return s >= 1;
  }
  // 手のひらから体の中心までの高さ：立体の生きものは足の先（footY）を手のひらに合わせる（2026-10-09 HP の担当「手より 20 cm 上に浮いて見える」）
  const lift = (pt, st) => pt.m3 && pt.m3.footY != null ? -pt.m3.footY * pt.sc * Math.max(pt.bw, pt.bh) * (st.ground ? .95 : st.swim ? .95 : .8) : .05 + pt.bh * pt.sc * .35;
  // 2026-10-09 本人「碧が動物との触れ合いをもっと楽しそうに。動きが少し硬い。鳴き声や動きの音を。静かに動きすぎ」
  //   → 速さを少しずつ上げ下げし（急に止まらない）、碧へは弧を描いて近づく。手の上では小さく跳ねる・向きを変える、地面のものは足もとに寄り添う。
  //     音は onEvent で館へ知らせる（out＝抜け出る／flap・flutter・dart・swirl＝動きの音／step＝跳ねた足音／call＝鳴き声／land＝とまる／back＝絵へ帰る）
  const emit = (type, it, pos) => { try { o.onEvent?.(type, it, pos); } catch (e) { console.warn(e); } };
  const CALLER = new Set(["sparrow", "swallow", "warbler", "goose", "heron", "smallbird"]);
  const rnd = (a, b) => a + Math.random() * (b - a);
  function aoiTick(it, pt, dt, T, t) {
    const st = pt.st, S = pt.ap, { p, n } = restPose(it, pt), u = pt.mat.uniforms, sty = it.a.style, lead = pt === it.parts[0];
    let A = o.getAoi && o.getAoi();
    if (A && A.pos.distanceTo(V(p.x, 0, p.z)) > 12) A = null;
    if (!A) { const c = p.clone().addScaledVector(n, 1.8); A = { pos: V(c.x, 0, c.z), hand: c.clone().setY(1.25), head: c.clone().setY(1.5), none: true }; }   // 碧がいないとき：絵の前の宙で
    const near = Math.max(1, Math.min(7, (NEAR[sty] || .3) / Math.max(pt.bw, pt.bh)));
    const ground = !!st.ground, perch = PERCH.has(sty), hop = st.ground === "hop";
    const spd = ground ? (hop ? 1.5 : .7) : st.swim ? .9 : sty === "butterfly" ? 1.1 : sty === "goose" ? 1.6 : 2.0;
    if (!S.v) { S.v = V(0, 0, 0); S.side = Math.random() < .5 ? 1 : -1; S.seed = Math.random() * 6; S.nCall = rnd(1.4, 2.6); S.nMove = rnd(.3, .9); S.hopT = rnd(1.2, 2.2); S.hk = 0; S.hi = 0; }
    S.pt += dt; let pos = S.pos, F = V(n.x, 0, n.z);
    // 説明が終わったら（bound が外れたら）、どの段からでも絵へ帰る
    if (!it.bound && S.ph >= 1 && S.ph !== 4) { S.ph = 4; S.pt = 0; S.from = pos.clone(); S.curve = null; if (lead) emit("back", it, pos); }
    const head = A ? A.head : null, hand = A ? A.hand : null, base = A ? A.pos : null;
    const flyH = st.swim ? 1.25 : sty === "goose" ? 2.6 : 1.95;
    const orbitR = (ground ? 1.05 : st.swim ? 1.0 : sty === "goose" ? 1.8 : .85) * (1 + .12 * Math.sin(S.pt * .7 + S.seed));   // 輪は少し息をするように
    const wob = sty === "butterfly" ? Math.sin(T * 2.3 + S.seed) * .2 : sty === "dragonfly" ? Math.sin(T * 1.3 + S.seed) * .1 : 0;
    const orbitPt = ang => ground ? V(base.x + Math.cos(ang) * orbitR, 0, base.z + Math.sin(ang) * orbitR) : V(base.x + Math.cos(ang) * orbitR, flyH + Math.sin(ang * 2) * .14 + wob, base.z + Math.sin(ang) * orbitR);
    // なめらかに進む：着くまえに速さを落とし、向きも速さも少しずつ変える。arc＝横へふくらむ弧（鳥と虫は少し上へも）
    const steer = (to, v, arc, k = ground ? 5 : 3.2) => {
      const d = to.clone().sub(pos), L = d.length(); let aim = to;
      if (arc && L > .3) { const sd = V(-d.z, 0, d.x); if (sd.lengthSq() > 1e-6) sd.normalize(); aim = to.clone().addScaledVector(sd, S.side * Math.min(1.1, L * .45)); if (!ground) aim.y += Math.min(.45, L * .18); }
      const want = aim.clone().sub(pos), wl = want.length(); if (wl > 1e-4) want.multiplyScalar(Math.min(v, wl * 2.2) / wl); else want.set(0, 0, 0);
      S.v.lerp(want, 1 - Math.exp(-dt * k)); pos.addScaledVector(S.v, dt); if (S.v.lengthSq() > 1e-5) F = S.v.clone();
      return L;
    };
    const hopY = () => hop ? Math.abs(Math.sin(S.pt * 4.2)) * .3 : 0;
    if (S.ph === 0) {   // 抜け出る：絵の前へ浮かび出て、大きくなる
      if (lead && S.pt <= dt + 1e-6) emit("out", it, p);
      const k = Math.min(1, S.pt / 1.0); pos.copy(p).addScaledVector(n, .2 + .8 * k); pt.sc = 1 + (near - 1) * smooth(k);
      if (ground) pos.y = Math.max(p.y - k * (p.y - pt.bh * pt.sc / 2), pt.bh * pt.sc / 2);
      if (k >= 1) { S.ph = 1; S.pt = 0; S.ang = Math.atan2(pos.z - base.z, pos.x - base.x); S.v.copy(n).multiplyScalar(.4); }
    } else if (S.ph === 1) {   // 碧へ近づく（弧を描いて、回りはじめの点へ）
      const L = steer(orbitPt(S.ang), spd, true); if (ground) pos.y = pt.bh * pt.sc / 2 + hopY();
      if (L < .3 || S.pt > 8) { S.ph = 2; S.pt = 0; }
    } else if (S.ph === 2) {   // 碧のまわりを回る
      const w = spd / orbitR * (st.swim ? .8 : 1); S.ang += S.dir * w * dt; const q = orbitPt(S.ang), was = pos.clone(); F = q.clone().sub(pos); pos.lerp(q, Math.min(1, dt * 4));
      S.v.copy(pos).sub(was).divideScalar(Math.max(dt, 1e-3));
      if (ground) pos.y = pt.bh * pt.sc / 2 + hopY();
      const loops = ground ? 1 : 1.4;
      if (S.pt * w > loops * Math.PI * 2) { S.ph = perch && hand && !A.none ? 3 : 5; S.pt = 0; S.nest = S.ang; }
    } else if (S.ph === 3) {   // 差し出した手へ（最後はふわりと速さを落とす）
      pt.sc += (near * .72 - pt.sc) * Math.min(1, dt * 3);   // 手にとまるときは、少し小さく（手の大きさに合わせて）
      const to = hand.clone().add(V(0, lift(pt, st), 0)); const L = steer(to, 1.5, S.pt < 1.2, 4.5);
      if (L < .05 || S.pt > 3.5) { S.ph = 31; S.pt = 0; S.v.set(0, 0, 0); S.hopT = rnd(1.4, 2.4); if (lead) emit("land", it, pos); }
    } else if (S.ph === 31) {   // 手にとまる（翼をたたむ）。ときどき小さく跳ねて向きを変える・首をかしげる
      let hy = 0; S.hopT -= dt;
      if (S.hopT < 0 && sty !== "butterfly" && sty !== "dragonfly") { const k = Math.min(1, -S.hopT / .26); hy = Math.sin(Math.PI * k) * .035; if (k >= 1) { S.hopT = rnd(1.6, 3.2); S.face = (S.face || 0) + rnd(-.9, .9); } }
      pos.copy(hand).add(V(0, lift(pt, st) + hy, 0)); F = V(head.x - pos.x, 0, head.z - pos.z).negate();
      if (st.flapHz) u.uA.value += (-.15 - u.uA.value) * Math.min(1, dt * 8);
      if (S.pt > 6.5) { S.ph = 2; S.pt = 0; S.ang = Math.atan2(pos.z - base.z, pos.x - base.x); if (lead) emit("flap", it, pos); }   // 説明が続くあいだは、手にとまる → また回る
    } else if (S.ph === 5) {   // 大きな鳥・魚・地面のもの：碧のそばに寄り添う（地面のものは足もとへ、魚は胸の前へ）
      const rr = ground ? (hop ? .62 : .85) : st.swim ? .78 : sty === "goose" ? 1.3 : .8, a = S.nest + S.dir * .35;
      const to = ground ? V(base.x + Math.cos(a) * rr, 0, base.z + Math.sin(a) * rr) : V(base.x + Math.cos(a) * rr, (st.swim ? 1.15 : flyH * .8) + Math.sin(T * .9 + S.seed) * .06, base.z + Math.sin(a) * rr);
      steer(to, spd * .6, false, 3);
      if (ground) { let hy = 0; S.hopT -= dt; if (hop && S.hopT < 0) { const k = Math.min(1, -S.hopT / .3); hy = Math.sin(Math.PI * k) * .12; if (k >= 1) { S.hopT = rnd(1.8, 3.4); if (lead) emit("step", it, pos); } } pos.y = pt.bh * pt.sc / 2 + hy; }
      if (S.v.lengthSq() < .01) F = V(base.x - pos.x, 0, base.z - pos.z);
      if (st.flapHz && sty !== "goose") u.uA.value += (-.15 - u.uA.value) * Math.min(1, dt * 8);
      if (S.pt > (ground ? 5 : 3.5)) { S.ph = 2; S.pt = 0; S.ang = Math.atan2(pos.z - base.z, pos.x - base.x); }
    } else if (S.ph === 4) {   // 絵へもどる
      if (!S.curve) S.curve = new THREE.CatmullRomCurve3([S.from, S.from.clone().lerp(p, .5).setY(Math.max(p.y, S.from.y) + (ground ? .2 : .5)), p.clone().addScaledVector(n, .5), p.clone()], false, "centripetal", .5);
      const D = Math.max(1.6, S.from.distanceTo(p) / (spd * 1.2)), k = Math.min(1, S.pt / D), s = smooth(k);
      pos.copy(S.curve.getPointAt(s)); F = S.curve.getTangentAt(Math.min(.999, Math.max(.001, s))); pt.sc = 1 + (near - 1) * smooth(1 - Math.max(0, (k - .55) / .45));
      pt.mat.uniforms.uOp.value = 1 - smooth(Math.max(0, (k - .92) / .08));
      if (k < .85) watch = { pos: pos.clone(), perch: false, ret: true, ph: 4, id: it.a.id, style: sty, t: performance.now() };
      if (k >= 1) { pt.done = true; restAt(it, pt); S.curve = null; pt.m3?.setOpacity(0); return true; }
    }
    // 音（いちばんはじめの写しだけが鳴らす）：鳴き声はときどき、動きの音は動いているあいだ
    if (lead && S.ph >= 1 && S.ph !== 4) {
      S.nCall -= dt; if (S.nCall <= 0) { S.nCall = sty === "heron" ? rnd(13, 20) : sty === "goose" ? rnd(8, 12) : rnd(6.5, 11); if (CALLER.has(sty)) emit("call", it, pos); }
      const moving = S.ph === 1 || S.ph === 2 || S.ph === 3;
      S.nMove -= dt;
      if (moving && S.nMove <= 0) {
        const ty = st.swim ? "swirl" : sty === "butterfly" ? "flutter" : sty === "dragonfly" ? "dart" : st.flapHz ? "flap" : null;
        S.nMove = st.swim ? rnd(3, 5) : sty === "butterfly" ? rnd(3.5, 6) : sty === "dragonfly" ? rnd(2.5, 4.5) : rnd(1.8, 3.2);
        if (ty) emit(ty, it, pos);
      }
      if (hop && (S.ph === 1 || S.ph === 2)) { const hi = Math.floor(S.pt * 4.2 / Math.PI); if (hi !== S.hi) { S.hi = hi; emit("step", it, pos); } }
    }
    if (S.ph !== 4) pt.mat.uniforms.uOp.value = Math.min(1, t / .5);
    orient(pt, pos, F, !!(ground || st.wander || st.swim || st.dart));
    // 立体の生きもの（creatures3d.js）：平らな写しは絵から出る一瞬と、絵へもどる一瞬だけ。外にいるあいだは立体（2026-10-09 本人「3D をしっかり作り込んで」）
    if (!pt.m3) { const img = pt.mat.uniforms.uMap.value.image; if (img && img.width) { pt.m3 = CR.make(sty, img); world.add(pt.m3.G); pt.m3.G.traverse(m => { if (m.isMesh) { m.userData = { animPart: it }; clickables.push(m); } }); } }
    if (pt.m3) {
      let k3 = 1;
      if (S.ph === 0) k3 = smooth(Math.min(1, S.pt / .8));
      else if (S.ph === 4) { const D = Math.max(1.6, (S.from ? S.from.distanceTo(p) : 1) / (spd * 1.2)); k3 = 1 - smooth(Math.max(0, Math.min(1, (S.pt / D - .68) / .26))); }
      pt.mat.uniforms.uOp.value *= (1 - k3); pt.m3.setOpacity(k3);
      const G = pt.m3.G, L3 = pt.sc * Math.max(pt.bw, pt.bh) * (st.ground ? .95 : st.swim ? .95 : .8);
      G.scale.setScalar(L3); G.position.copy(pos);
      let F3 = F.clone(); if (ground || S.ph === 31 || S.ph === 5) F3.y = 0;
      if (S.ph === 31) { const c = camera.position.clone().sub(pos); c.y = 0; F3 = V(-c.z, 0, c.x).applyAxisAngle(UP, S.face || 0); }   // 手にとまったら、見る人に横顔を見せる（跳ねるたびに少し向きを変える）
      if (F3.lengthSq() < 1e-6) F3.set(0, 0, 1); F3.normalize();
      if (ground) G.position.y = pos.y - pt.bh * pt.sc / 2;   // 足もとを床に
      // 向きは少しずつ変える（急に振り向かない）
      tmpT.copy(G.position).add(F3); M4.lookAt(tmpT, G.position, UP); tmpQ.setFromRotationMatrix(M4);
      if (!pt.q3 || S.ph === 0) pt.q3 = tmpQ.clone(); else pt.q3.slerp(tmpQ, 1 - Math.exp(-dt * (S.ph === 31 ? 5 : 7)));
      G.quaternion.copy(pt.q3);
      const fold = S.ph === 31 || (S.ph === 5 && sty !== "goose") ? 1 : 0;
      pt.m3.f = (pt.m3.f ?? 0) + (fold - (pt.m3.f ?? 0)) * Math.min(1, dt * 4);
      // 碧の顔の向き（手の上・そばでは、ときどき碧を見上げる）
      let look = 0; if ((S.ph === 31 || S.ph === 5) && head) { const toH = V(head.x - pos.x, 0, head.z - pos.z).normalize(), fw = V(0, 0, 1).applyQuaternion(G.quaternion); fw.y = 0; fw.normalize(); look = Math.atan2(fw.clone().cross(toH).y, fw.dot(toH)) * (.5 + .5 * Math.sin(T * .8 + S.seed)); }
      const bflap = sty === "butterfly" && S.ph === 31 ? .55 + .45 * Math.abs(Math.sin(T * 1.1 + S.seed)) : null;   // 蝶は手の上で、ゆっくり翅をひらいて閉じる
      pt.m3.update({ flap: u.uA.value, fold: bflap ?? pt.m3.f, t: T, swim: u.uWaveP.value || T * 8, amp: .06 + (it.react > 0 ? .06 : 0) + (S.ph === 5 && st.swim ? .03 : 0), hop: hop && S.ph >= 1 && S.ph <= 2 ? Math.abs(Math.sin(S.pt * 4.2)) : 0, look: Math.max(-1, Math.min(1, look)) });
    }
    if (S.ph >= 1 && S.ph !== 4) watch = { pos: pos.clone(), perch: S.ph === 3 || S.ph === 31, landed: S.ph === 31, near: S.ph === 5, ph: S.ph, id: it.a.id, style: sty, t: performance.now() };
    it.cpos = pos; it.cph = S.ph;
    return false;
  }
  function groundTick(it, pt, t, D) {
    const st = pt.st, ph = pt.path;
    // 0〜.12：絵から床へ　.12〜.5：歩く／跳ぶ（行き）　.5〜.62：止まる　.62〜.88：もどる　.88〜1：絵へ
    let s = clamp01(t / D);
    if (it.mode === "guide" && !it.arrived && s > .5) { s = .5; it.t = .5 * D + pt.delay; }
    grow(pt, s); fadeOp(pt, t, s);
    let pos, F;
    if (s < .12) { const k = smooth(s / .12); pos = pt.curve.getPointAt(k); F = pt.curve.getTangentAt(Math.max(.01, Math.min(.99, k))); }
    else if (s < .88) {
      const go = s < .5, stay = s >= .5 && s < .62, k = go ? (s - .12) / .38 : stay ? 1 : 1 - (s - .62) / .26;
      if (it.mode === "guide" && s >= .5 && !it.arrived) { pos = ph.dest.clone(); F = ph.dest.clone().sub(ph.floor); }
      else {
        const dist = ph.floor.distanceTo(ph.dest), nSteps = Math.max(1, Math.round(dist / st.step)), f = k * nSteps, i = Math.floor(f), r = f - i;
        const rr = st.ground === "walk" ? (r < .55 ? smooth(r / .55) : 1) : smooth(r);   // 鷺：一歩、止まる
        pos = ph.floor.clone().lerp(ph.dest, (i + rr) / nSteps);
        if (st.ground === "hop") pos.y = Math.sin(rr * Math.PI) * st.peak * (r < .999 ? 1 : 0);
        else pos.y = Math.abs(Math.sin(rr * Math.PI)) * .015;
        F = (go || stay ? ph.dest.clone().sub(ph.floor) : ph.floor.clone().sub(ph.dest));
      }
      pos.y += pt.bh * pt.sc / 2 * .98;   // 足もとを床に
    } else { const k = smooth(1 - (s - .88) / .12); pos = pt.curve.getPointAt(k); pos.y = Math.max(pos.y, pt.bh / 2); F = pt.curve.getTangentAt(Math.max(.01, Math.min(.99, k))).negate(); }
    if (s < .12) pos.y = Math.max(pos.y, pt.bh / 2);
    orient(pt, pos, F, true);
    if (s >= 1) { pt.done = true; restAt(it, pt); }
    return s >= 1;
  }
  const grow = (pt, s, back) => { const k = back ? smooth(clamp01((.8 - s) / .35)) : smooth(clamp01((s - .03) / .12)) * smooth(clamp01((.97 - s) / .12)); pt.sc = 1 + (pt.S - 1) * k; };
  // 写しが絵から「抜け出てくる」：出はじめに浮かび上がり、もどりきる前に絵へ溶ける
  const fadeOp = (pt, t, s) => { pt.mat.uniforms.uOp.value = Math.min(1, t / .7) * (1 - smooth(clamp01((s - .94) / .06))); };
  const clamp01 = x => Math.max(0, Math.min(1, x)), smooth = x => x * x * (3 - 2 * x), easeDart = r => r < .35 ? smooth(r / .35) : 1;

  const WP = new THREE.Vector3();
  function tick(dt, T, active) {
    let playing = 0;
    for (const it of items) if (it.state !== "rest") playing++;
    for (const it of roomItems) if (it.state !== "rest") playing++;
    for (const it of [...items, ...roomItems]) {
      if (it.state === "rest") {
        if (!active || getRM()) continue;
        continue;   // 2026-10-09 本人「それ以外の時は飛んでないでください」：ひとりでには出ない（碧が説明を始めたときだけ・bind）
        if (it.inRoom) {   // （旧）部屋の絵：近づく（6.5 m）と、少しして出てくる
          if (!it.g.parent?.visible) continue;
          const d = camera.position.distanceTo(it.g.getWorldPosition(WP));
          if (d < 6.5) { it.next -= dt; if (it.next <= 0 && playing < 2) { start(it, "show"); playing++; } } else if (d > 10) it.next = Math.max(it.next, 1.5 + Math.random() * 2);
          continue;
        }
        const d = camera.position.distanceTo(it.g.position);
        if (d < 26) { it.next -= dt; if (it.next <= 0 && playing < 2) { start(it, "show"); playing++; } }
        continue;
      }
      it.t += dt;
      // 絵の中の姿を消す／もどす
      let allDone = true, holding = false;
      for (const pt of it.parts) {
        if (pt.done) continue;
        if (pt.hold) { holding = true; allDone = false; hover(pt, dt, T); continue; }
        tickPart(it, pt, dt, T); if (!pt.done) allDone = false;
      }
      if (it.react > 0) {   // さわったときの反応（種に合わせて）：鳥と虫は飛び上がる、地面のものは跳ねる、魚は身をひるがえす
        it.react = Math.max(0, it.react - dt); const k = Math.sin(Math.PI * (1 - it.react / .9));
        for (const pt of it.parts) if (pt.m.visible) {
          if (pt.st.swim) pt.mat.uniforms.uWave.value = pt.bh * (.07 + .12 * k);
          else pt.m.position.y += (pt.st.ground ? .45 : .7) * k;
          if (pt.st.ground) pt.m.rotateZ(.25 * k * (pt.fimg.x >= 0 ? 1 : -1));
        }
      }
      if (holding && it.release) { it.release = false; for (const pt of it.parts) if (pt.hold) { pt.hold = false; returnFromDoor(it, pt); } }
      if (allDone && it.state !== "rest") { it.state = "rest"; it.next = it.inRoom ? 20 + Math.random() * 20 : 25 + Math.random() * 35; for (const pt of it.parts) { pt.m.visible = false; } onLanded?.(it); }
    }
  }
  function hover(pt, dt, T) {   // 扉の前で待つ（鳥は小さく輪を描き、魚はその場でくねる）
    const st = pt.st, u = pt.mat.uniforms; const base = pt.curve.getPointAt(1); pt.sc = pt.S;
    if (st.flapHz) u.uA.value = Math.sin(T * st.flapHz * Math.PI * 2) * st.amp * .8;
    if (st.swim) u.uWaveP.value = T * 1.3 * Math.PI * 2;
    const pos = base.clone().add(V(Math.sin(T * 1.1) * .5, Math.sin(T * 1.7) * .15, Math.cos(T * 1.1) * .5));
    orient(pt, pos, V(Math.cos(T * 1.1), 0, -Math.sin(T * 1.1)), !!(st.wander || st.swim || st.dart));
  }
  function returnFromDoor(it, pt) {
    const { p, n } = restPose(it, pt), from = pt.m.position.clone();
    pt.curve = new THREE.CatmullRomCurve3([from, from.clone().lerp(p, .5).setY(Math.max(p.y, from.y) + .6), p.clone().addScaledVector(n, .6), p.clone()], false, "centripetal", .5);
    pt.path = { kind: "curve", pts: [] }; pt.delay = 0; it.t = 0; it.mode = "show-back";
  }
  // 案内：生きものが扉まで行って待つ。見る人が着いたら release() で絵へもどる
  function guide(it) { if (it.state !== "rest") return false; it.arrived = false; return start(it, "guide"); }
  function release(it) { it.release = true; it.arrived = true; }
  function react(it) { if (it.state === "rest") return false; it.react = .9; return true; }
  function abort(it) { for (const pt of it.parts) { pt.m.visible = false; pt.m3?.setOpacity(0); pt.done = true; pt.hold = false; } it.state = "rest"; it.release = false; }
  const outs = () => [...items, ...roomItems].filter(it => it.state !== "rest" && it.cpos);
  return { items, roomItems, attach, outs, watch: () => (watch && performance.now() - watch.t < 300 ? watch : null), tick, start, guide, release, abort, react, find: id => items.find(i => i.a.id === id) };
}
