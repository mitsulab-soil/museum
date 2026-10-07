/* 企画展「絵から出てくる生きもの」（2026-10-07）。
   本人（2026-10-07）：「手前の 10 作品をアニメーションで作る：絵から生き物を切り抜いて動かす（鳥が額から飛び立って部屋を一周して戻る、魚が泳ぐ、など）。
   10 点とも品よく、動きは生き物として正しく」「企画展として中央の踊り場に：各セクションから一つずつ……それぞれが自分のセクションへ案内する」
   素材＝data/anim.js（_dev/anim.py の生成物。CC0／パブリックドメインの作品だけ）。
   動きの型（style）は、その生きものの移動のしかたに合わせた（README の表）：
     sparrow＝はばたきと、翼をたたむ短い滑空をくり返す波形の飛び方／swallow＝速く、はばたきと長い滑空、上下に大きく弧を描く／
     goose＝ゆっくり一定のはばたき、列になって飛ぶ／butterfly＝大きくはばたき、ふらふらと向きを変える／
     dragonfly＝すばやく直線に動いては空中で止まる（翅は速すぎて見えにくい）／carp＝体の後ろ半分を左右にくねらせて、ゆっくり泳ぐ／
     hare＝後ろ足でそろって跳ぶ（跳躍）／warbler＝地面を小さく跳ねて、止まる／heron＝一歩ずつゆっくり歩き、止まって待つ。 */

const VS = `uniform float uA, uB, uMode, uWave, uWaveK, uWaveP, uShim, uT; uniform vec2 uP0, uDir; uniform float uLen, uSide;
varying vec2 vUv; varying float vShade;
void main(){
  vUv = uv; vec3 p = position; vec2 q = p.xy - uP0; float al = dot(q, uDir); vec2 perp = vec2(-uDir.y, uDir.x); float s = dot(q, perp);
  vShade = 1.;
  if (uMode < .5) {                       // はばたき：体の軸から外の翼を、軸のまわりに回す
    float e = abs(s) - uB;
    if (e > 0. && (uSide == 0. || sign(s) == uSide)) { float a = uA; float ns = sign(s) * (uB + e * cos(a)); p.xy = uP0 + uDir * al + perp * ns; p.z += e * sin(a); vShade = .82 + .18 * cos(a); }
  } else if (uMode < 1.5) {               // 泳ぐ：頭から尾へ、後ろほど大きくくねる
    float t = clamp(al / uLen, 0., 1.); p.z += uWave * t * t * sin(uWaveK * t - uWaveP);
  }
  if (uShim > 0.) { float e = abs(s) - uB; if (e > 0.) p.z += uShim * sin(uT * 180. + al * 40.) * e; }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
}`;
const FS = `uniform sampler2D uMap; uniform float uOp, uBright; varying vec2 vUv; varying float vShade;
void main(){ vec4 c = texture2D(uMap, vUv); if (c.a < .04) discard; gl_FragColor = vec4(c.rgb * uBright * vShade, c.a * uOp); }`;

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
  warbler:   { mode: 2, dur: 12, ground: "hop", step: .22, peak: .12, beat: .26 },
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
  const order = [...ANIM].sort((a, b) => (a.id === "koi" ? -1 : 0) - (b.id === "koi" ? -1 : 0));
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
    const [iw, ih] = a.size, ar = iw / ih, maxW = big ? 1.5 : 1.25, maxH = big ? 1.8 : 1.45;
    let w = maxW, h = w / ar; if (h > maxH) { h = maxH; w = h * ar; }
    const g = new THREE.Group();
    if (f.easel) {   // 自立の台（木の脚・真鍮の受け）
      g.position.set(f.x, 1.78, f.z); g.rotation.y = f.th; world.add(g);
      const legM = o.darkWood || giltMat;
      for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.07, 2.3, .07), legM); leg.position.set(sx * (w / 2 + .05), -.65, -.12); leg.rotation.z = sx * .05; g.add(leg); }
      const back = new THREE.Mesh(new THREE.BoxGeometry(.06, 2.1, .06), legM); back.position.set(0, -.7, -.45); back.rotation.x = -.32; g.add(back);
      const ledge = new THREE.Mesh(new THREE.BoxGeometry(w + .3, .06, .16), brassMat); ledge.position.set(0, -h / 2 - .1, .02); g.add(ledge);
      if (o.poolMat) { const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), o.poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(0, -1.77, .6); g.add(pool); }
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
    const it = { a, r, f, v, g, w, h, full, empty, frame, parts: [], state: "rest", t: 0, next: 8 + Math.random() * 25, mode: "show", wait: 0 };
    full.userData = frame.userData = { anim: it }; clickables.push(full, frame);
    const s = w / iw;
    for (const P of a.parts) {
      const [x0, y0, x1, y1] = P.box, bw = (x1 - x0) * s, bh = (y1 - y0) * s;
      const geo = new THREE.PlaneGeometry(bw, bh, 28, 28);
      // 体の軸（頭→尾）を、この板のローカル座標で
      const L = (x, y) => new THREE.Vector2((x - (x0 + x1) / 2) * s, ((y0 + y1) / 2 - y) * s);
      const hd = L(...P.head), tl = L(...P.tail), dir = tl.clone().sub(hd), len = dir.length(); dir.normalize();
      const st = STYLE[a.style] || STYLE.sparrow;
      const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, side: THREE.DoubleSide, depthWrite: false,
        uniforms: { uMap: { value: tex(P.f) }, uOp: { value: 0 }, uBright: { value: 1.18 }, uA: { value: 0 }, uB: { value: Math.min(bw, bh) * (a.style === "butterfly" ? .06 : .16) },
          uMode: { value: st.mode }, uWave: { value: 0 }, uWaveK: { value: 5.5 }, uWaveP: { value: 0 }, uShim: { value: 0 }, uT: { value: 0 },
          uP0: { value: hd }, uDir: { value: dir }, uLen: { value: len }, uSide: { value: st.side ? (P.up ? 1 : -1) : 0 } } });
      const m = new THREE.Mesh(geo, mat); m.visible = false; m.renderOrder = 5; world.add(m);
      // 絵の中での場所（g の中の座標）
      const cx = ((x0 + x1) / 2 / iw - .5) * w, cy2 = (.5 - (y0 + y1) / 2 / ih) * h;
      // 絵の中での向き：頭の向き（画像の座標、上向きが +y）
      const fimg = new THREE.Vector2(P.head[0] - P.tail[0], -(P.head[1] - P.tail[1])).normalize();
      const S = Math.max(1, Math.min(7, (LIFE[a.style] || .3) / Math.max(bw, bh)));
      it.parts.push({ P, m, mat, local: new THREE.Vector3(cx, cy2, .08), fimg, bw, bh, st, S, ph: Math.random() * 6 });
    }
    return it;
  }

  // ---------------------------------------------------------------- 道すじ
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  function restPose(it, pt) { const p = pt.local.clone().applyMatrix4(it.g.matrixWorld); const n = V(0, 0, 1).applyQuaternion(it.g.getWorldQuaternion(new THREE.Quaternion())); return { p, n }; }
  function makePath(it, pt, k, mode) {
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
    if (st.wander || st.dart) {
      if (door) { pts.push(p.clone().lerp(door, .5).setY(2.6), door.clone().setY(2.2)); return { kind: "curve", pts, hold: true }; }
      const side = V(n.z, 0, -n.x); let q = p.clone().addScaledVector(n, 1.2);
      const R = st.dart ? 3.2 : 2.6, nPts = st.dart ? 6 : 8;
      for (let j = 0; j < nPts; j++) { q = p.clone().addScaledVector(n, 1.4 + Math.random() * R).addScaledVector(side, (Math.random() - .5) * 2 * R).setY(1.4 + Math.random() * 1.8); pts.push(q); }
      pts.push(p.clone().addScaledVector(n, .7), p.clone()); return { kind: st.dart ? "dart" : "curve", pts };
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
      if (pt.path.kind === "curve" || pt.path.kind === "dart") pt.curve = new THREE.CatmullRomCurve3(pt.path.pts, false, "centripetal", .5);
      else pt.curve = new THREE.CatmullRomCurve3(pt.path.up.concat([pt.path.floor]), false, "centripetal", .5);
      pt.done = false;
    });
    return true;
  }
  const tmpQ = new THREE.Quaternion(), M4 = new THREE.Matrix4(), UP = V(0, 1, 0);
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
      const target = glide ? -.12 : Math.sin(t * st.flapHz * Math.PI * 2 + pt.ph) * st.amp;
      u.uA.value += (target - u.uA.value) * Math.min(1, dt * (glide ? 10 : 40));
      if (st.side) u.uA.value = (.5 + .5 * Math.sin(t * st.flapHz * Math.PI * 2)) * st.amp;
    }
    if (st.swim) { u.uWave.value = pt.bh * .07; u.uWaveP.value = t * 1.3 * Math.PI * 2; }
    if (st.dart) u.uShim.value = .015;
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

  function tick(dt, T, active) {
    let playing = 0;
    for (const it of items) if (it.state !== "rest") playing++;
    for (const it of items) {
      if (it.state === "rest") {
        if (!active || getRM()) continue;
        const d = camera.position.distanceTo(it.g.position);
        if (d < 15) { it.next -= dt; if (it.next <= 0 && playing < 2) { start(it, "show"); playing++; } }
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
      if (holding && it.release) { it.release = false; for (const pt of it.parts) if (pt.hold) { pt.hold = false; returnFromDoor(it, pt); } }
      if (allDone && it.state !== "rest") { it.state = "rest"; it.next = 25 + Math.random() * 35; for (const pt of it.parts) { pt.m.visible = false; } onLanded?.(it); }
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
  function abort(it) { for (const pt of it.parts) { pt.m.visible = false; pt.done = true; pt.hold = false; } it.state = "rest"; it.release = false; }
  return { items, tick, start, guide, release, abort, find: id => items.find(i => i.a.id === id) };
}
