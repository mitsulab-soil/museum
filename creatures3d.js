/* 絵から抜け出た生きものの立体 v2（2026-10-13・胡蝶の夢の質へ）。
   本人（2026-10-13）：「森羅博物館について、飛び出る生き物を、胡蝶の夢のクオリティに高めて。」
   作り方：《胡蝶の夢》の生きものの道具（creatures_kochou.js＝胡蝶の夢 ★実行データ/creatures.js の写し）で組む。
     体は断面をつないだ形（sweep）に部位ごとの色、毛はシェル法、羽は一枚ずつ、目は濡れた角膜、翅は薄膜の虹色と翅脈、鯉は粘液の艶と鱗の凹凸。
     外から取りこんだ 3D・画像はない（絵の具・凹凸の地図はすべてこの画面の中で描く）。
   種（モデルにした種）と形の根拠・動きの典拠＝資料/生き物の形と動き_典拠.md（2026-10-13）。
     雀＝スズメ／燕＝ツバメ／鶯＝ウグイス／雁＝マガン／白鷺＝ダイサギ（非繁殖期）／鯉＝コイ（野生型の黒い鯉）／
     蝶＝モンシロチョウ（胡蝶の夢の型そのまま）／蜻蛉＝アキアカネ（成熟した雄）／野うさぎ＝ノウサギ（ニホンノウサギの形）。
   呼ぶ側（anim3d.js）との約束はこれまでと同じ：make(style, img) → { G, update(st), setOpacity(o), footY, kind }。
     向きは頭が +Z・背が +Y、体の長さ＝1（蝶・蜻蛉は翅をひろげた幅がほぼ 1）。地面のもの（野うさぎ・鷺）は足もとが y=0。
     st：{ t, ph（0 抜け出る・1 近づく・2 回る・3 手へ・31 手にとまる・5 そばに寄る・4 絵へ帰る）, pt（その段の秒）, spd（m/秒）, L（体の長さ m）, hop, look }
   重さ：出ている生きものだけを描く。毛の層はスマホ 7・PC 14（胡蝶の夢と同じ）。 */
import * as K from "./creatures_kochou.js";
import { mergeGeometries as mergeG0 } from "three/addons/utils/BufferGeometryUtils.js";
const { T, TAU, clamp, lerp, sstep, tab, mk, ctex, rnd, furTex, plumeTex, sweep, seam, ell, flatShape, smoothPts, shapeTex, tube, MOBILE, nmap, wetEye, compoundEye, addFur, transHook, glintHook, thinFilm, wob, bout, hash1, featherGeo, featherTex, stdMat, makeButterfly } = K;
const M = stdMat;
const V3 = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const hx = c => (c && c.isColor ? c.getHex() : c);
const mixh = (a, b, t) => new T.Color(hx(a)).lerp(new T.Color(hx(b)), clamp(t, 0, 1));
// 羽の面：羽枝の細い筋（法線の地図）。シジュウカラと同じ描き方
const plumeN = () => nmap('mu_plumeN', 64, 64, (c, w, h) => { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); for (let y = -8; y < h + 8; y += 8) for (let x = (y / 8 % 2) * 6 - 6; x < w + 8; x += 12) { const gr = c.createLinearGradient(x, y - 2, x, y + 7); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#303030'); c.fillStyle = gr; c.beginPath(); c.ellipse(x, y + 2, 7, 6, 0, 0, Math.PI); c.fill(); } }, 1.5, [7, 5]);
// 虹彩のある目（鷺・鯉・雁）：目玉（虹彩の色）＋瞳＋濡れた角膜（透明なクリアコート）。s＝左右
function irisEye(parent, s, pos, r, iris, o = {}) {
  const gE = new T.Group(); gE.position.set(...pos); gE.rotation.y = s * (o.yaw ?? 1.25); parent.add(gE);
  gE.add(ell(mk(M, iris, { rough: .45 }), 0, 0, 0, r, r, r * .7, 16));
  gE.add(ell(mk(M, 0x050505, { rough: .3 }), 0, 0, r * .55, r * (o.pupil ?? .5), r * (o.pupil ?? .5), r * .2, 12));
  const cor = ell(mk(M, 0xffffff, { rough: .05, phys: { clearcoat: 1, clearcoatRoughness: .02, ior: 1.376, transmission: 0, specularIntensity: 1 } }), 0, 0, r * .12, r * 1.04, r * 1.04, r * .78, 16);
  cor.material.transparent = true; cor.material.opacity = .22; cor.material.depthWrite = false; cor.userData.dw0 = false; gE.add(cor);
  return gE;
}

// ================================================================ 小鳥の翼（羽一枚ずつ。胡蝶の夢のシジュウカラの組み方を、種ごとの長さで）
//   W：{ k（全体の大きさ）, SH（肩の位置）, prim（初列風切の長さの倍率）, sec（次列）, texs（風切・三列・大雨覆・小雨覆の絵）, nP（初列の枚数＝10、いちばん外は小さい） }
function buildWings(body, W) {
  const k = W.k, pK = W.prim ?? 1, sK = W.sec ?? 1, F = [];
  for (let i = 0; i < 3; i++) F.push({ seg: 0, x: (.05 + i * .045) * k, a0: .12 - i * .05, aF: -1.15, len: .2 * k * sK, wid: .07 * k, layer: .006 * k, m: 1 });                                    // 三列風切
  for (let i = 0; i < 9; i++) F.push({ seg: 1, x: i * .018 * k, a0: -.05 - i * .03, aF: 1.35, len: .25 * k * sK, wid: .065 * k, layer: (.004 - i * .0002) * k, m: 0 });                         // 次列風切 9
  for (let i = 0; i < 10; i++) { const tiny = i === 9; F.push({ seg: 2, x: i * .0055 * k, a0: -.4 - i * .12 * (W.spread ?? 1), aF: -1.45 + i * .01, len: (tiny ? .09 : (.25 + .12 * Math.sin(Math.min(1, i / 7) * Math.PI / 2)) * pK) * k, wid: .06 * k * (W.pw ?? 1), asym: .3, layer: -.002 * i * k, m: 0 }); }   // 初列風切 10（いちばん外は小さい）
  for (let i = 0; i < 9; i++) F.push({ seg: 1, x: i * .018 * k, a0: -.05 - i * .03, aF: 1.35, len: .11 * k * sK, wid: .06 * k, layer: (.012 + i * .0009) * k, m: 2 });                         // 大雨覆
  for (let i = 0; i < 5; i++) F.push({ seg: 2, x: i * .008 * k, a0: -.5 - i * .2, aF: -1.45, len: .1 * k, wid: .05 * k, layer: (.01 + i * .0009) * k, m: 1 });                                    // 初列雨覆
  for (let i = 0; i < 6; i++) F.push({ seg: 0, x: (.01 + i * .024) * k, a0: -.2 - i * .03, aF: -1.1, len: .11 * k, wid: .055 * k, layer: (.02 + i * .0009) * k, m: 3 });                         // 小・中雨覆
  for (let i = 0; i < 7; i++) F.push({ seg: 1, x: (.005 + i * .02) * k, a0: -.15 - i * .03, aF: 1.32, len: .085 * k, wid: .05 * k, layer: (.026 + i * .0009) * k, m: 3 });
  const wingMats = W.texs.map((tx, m) => { const wm = mk(M, 0xffffff, { map: tx, side: T.DoubleSide, rough: W.rough ?? .8, phys: W.phys }); if (m >= 2) { wm.polygonOffset = true; wm.polygonOffsetFactor = -(m - 1); wm.polygonOffsetUnits = -(m - 1) * 2; } return wm; });
  function wingMesh(side) {
    const geos = [], base = [];
    for (const f of F) { const fg = featherGeo(f.len, f.wid, f.asym || 0); base.push(Float32Array.from(fg.attributes.position.array)); geos.push(fg); }
    const groups = [0, 1, 2, 3].map(m => F.map((f, i) => [f, i]).filter(([f]) => f.m === m)), ordered = groups.flat();
    const geo = mergeG(ordered.map(([, i]) => geos[i]));
    { const gs = geo.groups.slice(); geo.clearGroups(); let gi = 0; for (let m = 0; m < 4; m++) { let start = null, count = 0; for (let q = 0; q < groups[m].length; q++, gi++) { if (start == null) start = gs[gi].start; count += gs[gi].count; } if (count) geo.addGroup(start, count, m); } }
    const mesh = new T.Mesh(geo, wingMats); mesh.wd = { side, F: ordered.map(([f, i]) => ({ f, b: base[i] })) }; mesh.frustumCulled = false; return mesh;
  }
  const wings = [wingMesh(-1), wingMesh(1)]; body.add(...wings);
  const SH = W.SH, LH = .15 * k, LF = .15 * k;
  function poseWing(mesh, elev, fold, sweepK = 0) {
    const s = mesh.wd.side, P = mesh.geometry.attributes.position, N = mesh.geometry.attributes.normal;
    const a1 = lerp(-.05 + sweepK, 1.25, fold), a2 = lerp(.05, -2.7, fold), a3 = lerp(-.02, 2.9, fold);
    const E = [LH * Math.cos(a1), -LH * Math.sin(a1)], W2 = [E[0] + LF * Math.cos(a1 + a2), E[1] - LF * Math.sin(a1 + a2)];
    const ce = Math.cos(elev), se = Math.sin(elev), nx = -se, ny = ce; let q2 = 0;
    for (const { f, b } of mesh.wd.F) {   // wd：館が mesh.userData を書きかえるので、羽の並びは別の名前に置く
      const segA = f.seg === 0 ? a1 : f.seg === 1 ? a1 + a2 : a1 + a2 + a3, root = f.seg === 0 ? [0, 0] : f.seg === 1 ? E : W2;
      const rx = root[0] + f.x * Math.cos(segA), rz = root[1] - f.x * Math.sin(segA), ang = segA + lerp(f.a0, f.aF, fold), ca = Math.cos(ang), sa = Math.sin(ang);
      for (let q = 0; q < b.length; q += 3, q2++) {
        const fx = b[q], fy = b[q + 1] + f.layer + fold * (f.layer * 1.5), fz = b[q + 2];
        const lx = rx + fx * ca + fz * sa, lz = rz - fx * sa + fz * ca, wx = lx * ce - fy * se, wy = lx * se + fy * ce;
        P.setXYZ(q2, s * (SH[0] + wx), SH[1] + wy, SH[2] + lz); N.setXYZ(q2, nx, s * ny, 0);
      }
    }
    P.needsUpdate = true; N.needsUpdate = true;
  }
  return { wings, poseWing };
}
const mergeG = geos => mergeG0(geos, true);
// 尾羽：n 枚の扇。fork＝外側ほど長く（燕の燕尾）、round＝外側ほど短く（鶯の丸い尾）。spot＝白斑（燕の尾羽の内弁の白い斑）
function buildTail(body, o) {
  const geos = [];
  for (let i = 0; i < o.n; i++) {
    const u = i / (o.n - 1) - .5, au = Math.abs(u) * 2, len = o.len * (1 + (o.fork || 0) * au ** 3 - (o.round || 0) * au * au), fg = featherGeo(len, o.wid, 0);
    fg.rotateY(-u * (o.spread ?? .5)); fg.translate(u * o.wid * .9, -.004 + au * -.006, o.z - .002 * au);
    const n = fg.attributes.position.count, cA = new Float32Array(n * 3), P = fg.attributes.position;
    for (let v = 0; v < n; v++) { const z = (o.z - P.getZ(v)) / len; let c = new T.Color(o.col(au, z)); if (o.spot && au > .1 && au < .9 && z > .55 && z < .75 && Math.abs(P.getX(v) - u * o.wid * .9) < o.wid * .3) c = new T.Color(0xf2efe8); cA.set([c.r, c.g, c.b], v * 3); }
    fg.setAttribute('color', new T.BufferAttribute(cA, 3)); geos.push(fg);
  }
  const tail = new T.Mesh(mergeG0(geos), mk(M, 0xffffff, { vc: true, map: o.tex, side: T.DoubleSide, rough: o.rough ?? .8, phys: o.phys }));
  const piv = new T.Group(); piv.position.set(0, o.y ?? 0, o.z); tail.position.set(0, -(o.y ?? 0), -o.z); piv.add(tail); body.add(piv); return piv;
}

// ================================================================ 小鳥（スズメ・ツバメ・ウグイス）
//   スズメ目：初列風切 10 枚（いちばん外は小さい）・次列風切 9 枚前後・足指は前 3・後 1。尾羽はスズメ・ツバメとも 12 枚。
//   形の根拠：資料/生き物の形と動き_典拠.md（各種の図鑑の記載）
const SMALL = {
  sparrow: {   // スズメ：頭は栗色、白い頬に黒い斑、のどは黒い（小さなよだれかけ）、背は褐色に黒い縦斑、翼に細い白帯 2 本、腹は灰白色。くちばしは太い円錐で黒い
    rx: 1.06, ry: 1.04, headK: 1.08,
    col: (t, sx, cy, x, y, z) => {
      const ax = Math.abs(sx);
      if (z > .175) {
        if (cy < -.62 && z > .23 && ax < .55) return 0x191613;                         // のどの黒（小さなよだれかけ）
        if (z > .235 && z < .29 && cy > -.36 && cy < -.08 && ax > .7) return 0x161412;   // 頬の黒い斑（白い頬の中に離れて）
        if (z > .2 && cy > -.6 && cy < .2) return z > .31 && cy > -.1 ? 0x2a1d16 : 0xefebe2;   // 白い頬（目先は黒っぽい）
        return 0x7b4024;                                                           // 頭頂からうなじは栗色
      }
      if (z > .15 && cy > -.35 && cy < .45) return 0xe4ded2;                         // 首の白っぽい輪（後ろで途切れる）
      if (cy < -.62 && z > .14) return 0x1d1915;                                     // のどの黒が胸へ少し
      if (cy < -.15) return z < -.1 ? 0xe2dccf : 0xd6cfc0;
      if (cy < .35) return 0xc3b49a;
      return Math.abs(Math.sin(sx * 23 + z * 9)) > .8 ? 0x2e2218 : (z > 0 ? 0x8b6345 : 0x8a7a62);   // 背の黒い縦斑・腰は灰褐色
    },
    bill: { len: .062, r0: .03, ry0: .028, col: 0x1d1a18, y: .07 },
    eye: { pos: [.049, .098, .292], r: .0135 },
    legs: { col: 0xb48f78, len: 1 },
    tail: { n: 12, len: .3, wid: .05, col: (au, z) => mixh(0x6e5038, 0x9a7a58, au * .4).getHex(), tex: () => featherTex('mu_spTail', '#c9b8a4', '#e8dccc', null) },
    wing: { k: 1.0, SH: [.072, .07, .12], prim: 1, sec: 1, texs: () => [featherTex('mu_spWf', '#4a3424', '#b08a62', null), featherTex('mu_spWt', '#3e2a1c', '#c89a6a', null), featherTex('mu_spWc', '#3a281a', '#a88058', '#f2ece0', .1), featherTex('mu_spWl', '#7a5236', '#a07050', '#efe8da', .1)] },
    fly: { hz: 9, beats: 4, pause: 2 },   // 数回はばたいて翼をたたむ波形の飛び方（はばたきは見やすく遅く）
  },
  swallow: {   // ツバメ：額とのどは赤茶、背・頭は光沢のある青黒（構造色）、胸に青黒い帯、腹は白〜淡い黄白。翼は長くとがる。尾は深い燕尾で、外側の尾羽が長い。尾羽の内側に白い斑。足は短い
    rx: .86, ry: .9, headK: .96, flat: true,
    col: (t, sx, cy, x, y, z) => {
      if (z > .175) { if (z > .31 && cy > -.25) return 0x8a2f1e; if (cy < -.2) return 0x8e3220; return 0x18203a; }
      if (z > .1 && cy < -.1) return 0x1b2440;                                       // 胸の帯
      if (cy < -.15) return 0xefe7d8;
      if (cy < .25) return mixh(0xe6dccb, 0x1d2540, (cy + .15) / .4);
      return 0x17203a;
    },
    coat: { clearcoat: .9, clearcoatRoughness: .25, sheen: .6, sheenRoughness: .4, sheenColor: 0x3a5aa8, iridescence: .35, iridescenceIOR: 1.6, iridescenceThicknessRange: [300, 500] },
    bill: { len: .035, r0: .03, ry0: .012, col: 0x141416, y: .066 },
    eye: { pos: [.058, .094, .29], r: .016 },
    legs: { col: 0x2e2a28, len: .55 },
    tail: { n: 12, len: .28, wid: .045, fork: 1.5, spread: .7, spot: true, col: (au, z) => 0x1a2034, tex: () => featherTex('mu_swTail', '#7f88a0', '#a6aec2', null), phys: { clearcoat: .6, clearcoatRoughness: .3 } },
    wing: { k: 1.0, SH: [.064, .068, .13], prim: 1.75, sec: .8, pw: .85, spread: .55, texs: () => [featherTex('mu_swWf', '#1e2438', '#3a4462', null), featherTex('mu_swWt', '#1a2034', '#344060', null), featherTex('mu_swWc', '#1c2440', '#36446a', null), featherTex('mu_swWl', '#1a2240', '#2e3c66', null)], phys: { clearcoat: .7, clearcoatRoughness: .3, sheen: .5, sheenColor: 0x3050a0 } },
    fly: { hz: 7, beats: 3, pause: 3, glide: true },   // はばたきと滑空をまぜる（Park ら 2001）
  },
  warbler: {   // ウグイス：背は褐色がかったオリーブ、淡い眉斑、目を通る暗い線、下面は灰白色でわきは淡い褐色。尾はやや長く、先が丸い。くちばしは細い
    rx: .9, ry: .94, headK: .95,
    col: (t, sx, cy, x, y, z) => {
      const ax = Math.abs(sx);
      if (z > .175) {
        if (z > .22 && z < .34 && cy > .16 && cy < .4 && ax > .35) return 0xe0dbc4;   // 眉斑
        if (z > .23 && z < .34 && cy > -.02 && cy < .16 && ax > .45) return 0x4e4630; // 過眼線
        if (cy < -.3) return 0xe6e3d6;
        if (cy < .16 && ax > .4) return 0xa9a082;
        return 0x766c44;
      }
      if (cy < -.15) return z < -.1 ? 0xe2dccb : 0xdcd8ca;
      if (cy < .3) return 0xb9ad8a;
      return z > 0 ? 0x7a7046 : 0x82754a;
    },
    bill: { len: .06, r0: .014, ry0: .014, col: 0x4a4232, y: .072 },
    eye: { pos: [.056, .1, .29], r: .014 },
    legs: { col: 0xc29a86, len: 1.05 },
    tail: { n: 12, len: .34, wid: .045, round: .3, spread: .45, col: (au, z) => 0x6e6440, tex: () => featherTex('mu_wbTail', '#b8b090', '#d4cdb0', null) },
    wing: { k: .92, SH: [.066, .07, .12], prim: .95, sec: 1, texs: () => [featherTex('mu_wbWf', '#5e5536', '#8e8458', null), featherTex('mu_wbWt', '#5a5234', '#8a8056', null), featherTex('mu_wbWc', '#6a6040', '#8e855c', null), featherTex('mu_wbWl', '#746a46', '#8e8660', null)] },
    fly: { hz: 13, beats: 9, pause: 1 },   // 藪の中を短く低く飛ぶ（はばたきが続く）
  },
};
function makeSmallBird(kind) {
  const sp = SMALL[kind], g = new T.Group(), body = new T.Group(); g.add(body);
  const rxK = sp.rx, ryK = sp.ry;
  const bodyG = sweep([[0, -.015, -.2], [0, 0, -.09], [0, .02, .05], [0, .05, .16], [0, .08, .245], [0, .085, .3], [0, .078, .338]],
    tab([[0, .022 * rxK], [.1, .07 * rxK], [.32, .098 * rxK], [.52, .09 * rxK], [.66, .066 * sp.headK], [.8, .068 * sp.headK], [.93, .05 * sp.headK], [1, .018]]),
    tab([[0, .02 * ryK], [.1, .072 * ryK], [.32, .108 * ryK], [.52, .095 * ryK], [.66, .07 * sp.headK], [.8, .071 * sp.headK * (sp.flat ? .9 : 1)], [.93, .05 * sp.headK], [1, .018]]), sp.col,
    { n: 44, r: 24, k: (t, sx, cy) => 1 + .07 * Math.max(0, -cy) * sstep(.15, .35, t) * (1 - sstep(.45, .6, t)) });
  const bm = new T.Mesh(bodyG, mk(M, 0xffffff, { vc: true, map: plumeTex([7, 5]), rough: .74, nmap: plumeN(), ns: .45, phys: sp.coat || { sheen: .45, sheenRoughness: .5, sheenColor: 0xa09888 } })); body.add(bm);
  // 胸・腹の羽毛がふくらむ（短い毛の層）
  addFur(bm, M, { len: (u, v) => { const cy = Math.cos(v * TAU), env = sstep(.12, .28, u) * (1 - sstep(.56, .66, u)); return cy < -.15 ? .018 * env : cy < .3 ? .009 * env * sstep(.3, -.15, cy) : 0; }, dens: 150, thick: .58, root: .82, droop: .12, comb: [0, -.2, -1.4], sheen: 0xf8f8f0 });
  const headG = new T.Group(), HP = V3(0, .07, .2); headG.position.copy(HP); body.add(headG);
  const B = sp.bill, bz = .335;
  const bill = new T.Mesh(sweep([[0, B.y + .004, bz - .01], [0, B.y, bz + B.len * .55], [0, B.y - .006, bz + B.len]], tab([[0, B.r0], [1, .002]]), tab([[0, B.ry0], [1, .002]]), () => B.col, { n: 8, r: 10 }), mk(M, 0xffffff, { vc: true, rough: .32, phys: { clearcoat: .5, clearcoatRoughness: .25 } }));
  bill.position.sub(HP); headG.add(bill);
  const eyeM = wetEye(M, 0x050506); for (const s of [-1, 1]) { const e = ell(eyeM, s * sp.eye.pos[0], sp.eye.pos[1], sp.eye.pos[2], sp.eye.r, sp.eye.r * 1.12, sp.eye.r, 14); e.position.sub(HP); headG.add(e); }
  const P0 = Float32Array.from(bodyG.attributes.position.array), hW = new Float32Array(P0.length / 3); for (let i = 0; i < hW.length; i++) hW[i] = sstep(.15, .225, P0[i * 3 + 2]);
  let hy0 = 0, hp0 = 0; const _q = new T.Quaternion(), _e = new T.Euler(), _v = V3();
  function poseHead(yaw, pitch) {
    if (Math.abs(yaw - hy0) < 1e-3 && Math.abs(pitch - hp0) < 1e-3) return; hy0 = yaw; hp0 = pitch; headG.rotation.set(pitch, yaw, 0, 'YXZ');
    const P = bodyG.attributes.position; for (let i = 0; i < hW.length; i++) { const w = hW[i]; if (w <= 0) { P.setXYZ(i, P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2]); continue; } _e.set(pitch * w, yaw * w, 0, 'YXZ'); _q.setFromEuler(_e); _v.set(P0[i * 3] - HP.x, P0[i * 3 + 1] - HP.y, P0[i * 3 + 2] - HP.z).applyQuaternion(_q).add(HP); P.setXYZ(i, _v.x, _v.y, _v.z); }
    P.needsUpdate = true; bodyG.computeVertexNormals(); seam(bodyG, 44, 24);
  }
  const tailPiv = buildTail(body, { ...sp.tail, tex: sp.tail.tex(), z: -.15, y: -.005 });
  // 脚と足指（前 3・後 1）。とまるときの足先が footY
  const legs = new T.Group(); body.add(legs); const legM = mk(M, sp.legs.col, { rough: .5 }), Lk = sp.legs.len, fy = -.06 - .095 * Lk;
  for (const s of [-1, 1]) { legs.add(tube(legM, [[s * .03, -.06, .03], [s * .032, -.06 - .06 * Lk, .045], [s * .032, fy, .05]], .008, .006, null, 4, 5));
    for (const a of [-.4, 0, .4]) legs.add(tube(legM, [[s * .032, fy, .05], [s * .032 + Math.sin(a) * .05, fy - .01, .05 + Math.cos(a) * .05]], .005, .003, null, 3, 4));
    legs.add(tube(legM, [[s * .032, fy, .05], [s * .032, fy - .01, .005]], .005, .003, null, 3, 4)); }
  const { wings, poseWing } = buildWings(body, { ...sp.wing, texs: sp.wing.texs() });
  const footY = fy - .012;
  // 動き（典拠＝資料/生き物の形と動き_典拠.md）
  //   とまる：頭はすばやく向きを変えては止める（見回す）・尾をときどき上へはね上げる・胸がふくらんでは戻る（息）・ときどき翼を小さくふるわせる・まれに羽をふくらませて身ぶるい
  //   飛ぶ：スズメは数回はばたいて翼をたたむ（波形）、ツバメは長い翼ではばたきと滑空、ウグイスは短く速いはばたき
  //   抜け出る：翼をひろげて一度大きく打ち下ろし、体を起こしてから飛ぶ
  let lastFold = -1;
  const perch = (t, look) => {
    const tt = t + sp.eye.r * 999, kk = Math.floor(tt / .7), sw = kk * .7 + hash1(kk + .5) * .5;
    const tgt = j => [(hash1(j * 3.1) - .5) * 1.4, (hash1(j * 7.7) - .5) * .45 - .05], a = tgt(kk), b = tgt(kk - 1), u = sstep(sw, sw + .08, tt);
    const ruffle = bout(t, 11, 1.1, 3);   // 身ぶるい
    poseHead(lerp(b[0], a[0], u) * .7 + look * .9 + Math.sin(t * 38) * .12 * ruffle, lerp(b[1], a[1], u));
    legs.visible = true; legs.rotation.x = 0; body.rotation.set(0, 0, Math.sin(t * 34) * .06 * ruffle); body.position.y = 0;
    const br = 1 + .018 * Math.sin(tt * TAU * 1.1) + .09 * ruffle; body.scale.set(br, br, 1 + .03 * ruffle);
    tailPiv.rotation.x = -.1 + .05 * Math.sin(t * 1.7) - .45 * bout(t, 3.3, .35, 1) + (kind === 'warbler' ? -.15 * Math.max(0, Math.sin(t * 2.3)) : 0);
    const fl = bout(t, 7.5, .5, 2); if (fl > .01 || ruffle > .01 || lastFold !== 0) { for (const w of wings) poseWing(w, -.32 + .15 * fl * Math.abs(Math.sin(t * 40)), 1 - .15 * fl - .08 * ruffle); lastFold = fl > .01 || ruffle > .01 ? 1 : 0; }
  };
  const fly = (t, st) => {
    poseHead(st.look * .4, 0); body.rotation.set(0, 0, 0); body.position.y = 0; body.scale.set(1, 1, 1); legs.visible = false; lastFold = -1;
    const F = sp.fly, cyc = t * F.hz, beat = cyc % (F.beats + F.pause);
    if (beat > F.beats && st.ph !== 0) { const u = sstep(F.beats, F.beats + .3, beat) * (1 - sstep(F.beats + F.pause - .3, F.beats + F.pause, beat));
      if (F.glide) { for (const w of wings) poseWing(w, .18 + .04 * Math.sin(t * 3), .1 + .25 * u); } else for (const w of wings) poseWing(w, lerp(.3, -.28, u), u);
      tailPiv.rotation.x = .05; return; }
    const p = cyc * TAU, s1 = Math.sin(p), elev = .25 + .85 * s1, fold = .38 * Math.max(0, -Math.cos(p));
    for (const w of wings) poseWing(w, elev, fold, -.1 * Math.max(0, s1));
    tailPiv.rotation.x = .08 * Math.sin(p + 1); body.position.y = -.012 * s1;
  };
  const update = st => {
    const t = st.t, look = st.look || 0;
    if (st.ph === 31) { perch(t, look); return; }
    if (st.ph === 0) {   // 抜け出る：翼をひろげ、ゆっくり大きく二度打ち下ろす
      const k = clamp(st.pt / .9, 0, 1), p = k * 2 * TAU; poseHead(0, -.15 * (1 - k)); legs.visible = k < .5; tailPiv.rotation.x = -.2 * (1 - k); body.scale.set(1, 1, 1);
      for (const w of wings) poseWing(w, .2 + .9 * Math.sin(p) * sstep(0, .2, k), (1 - sstep(0, .25, k)) * .9);
      body.rotation.x = -.35 * (1 - k); return;
    }
    body.rotation.x = 0; fly(t, st);
  };
  update({ t: 0, ph: 31, look: 0 });
  return { g, footY, update, perchAt: 31 };
}

// 白い羽（ダイサギ）：羽軸も白い。羽枝の細い筋と、ふちのやわらかな明るさだけ
const whiteFeather = key => ctex(key, 64, 128, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.45, '#efede6'); gr.addColorStop(.5, '#f8f7f2'); gr.addColorStop(.55, '#efede6'); gr.addColorStop(1, '#f6f5f0'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 3) { c.strokeStyle = 'rgba(120,115,100,.06)'; c.beginPath(); c.moveTo(0, y + 6); c.lineTo(w / 2, y); c.lineTo(w, y + 6); c.stroke(); } });
// ================================================================ 大きな鳥（マガン・ダイサギ）：胴＋首（二つの姿勢のあいだを動く）＋頭は首の先に付いていく
function neckFrame(geo, N, R, i) {   // i 番目の輪の中心と、前への向き
  const P = geo.attributes.position, c = V3(), c2 = V3();
  for (let j = 0; j < R; j++) c.add(V3(P.getX(i * (R + 1) + j), P.getY(i * (R + 1) + j), P.getZ(i * (R + 1) + j))); c.divideScalar(R);
  const i2 = Math.max(0, i - 2); for (let j = 0; j < R; j++) c2.add(V3(P.getX(i2 * (R + 1) + j), P.getY(i2 * (R + 1) + j), P.getZ(i2 * (R + 1) + j))); c2.divideScalar(R);
  return { c, f: c.clone().sub(c2).normalize() };
}
function makeBigBird(kind) {
  const goose = kind === 'goose', g = new T.Group(), body = new T.Group(); g.add(body);
  // 色・形（典拠＝資料/生き物の形と動き_典拠.md）
  //   マガン：頭と首は灰褐色、くちばしのつけ根を額の白い羽が囲む、くちばしは桃色（東アジアの亜種）、胴は灰褐色に淡い羽縁、腹に黒い横斑、下尾筒は白、脚は橙色で水かき
  //   ダイサギ：全身が白、首は長く S 字に曲げる、くちばしは長くまっすぐ（非繁殖期は黄色）、目先は黄緑、虹彩は黄色、脚と足指は黒く長い
  const WH = 0xf3f1ea;
  const bodyCol = goose
    ? (t, sx, cy) => { if (t < .16) return cy < 0 ? 0xf6f4ee : 0x3e342c; if (cy < -.35) return t < .4 ? 0xf2efe8 : (Math.abs(Math.sin(t * 40 + sx * 3)) > .78 ? 0x1e1a18 : 0xb7aa98); if (cy < .2) return 0x8c7a66; return 0x6e5e4e; }
    : (t, sx, cy) => cy < -.2 ? 0xf6f4ee : WH;
  const torso = goose
    ? sweep([[0, .02, -.46], [0, .02, -.3], [0, .02, -.05], [0, .03, .15], [0, .06, .24]], tab([[0, .03], [.12, .1], [.4, .16], [.75, .14], [1, .07]]), tab([[0, .03], [.12, .09], [.4, .14], [.75, .13], [1, .08]]), bodyCol, { n: 36, r: 22 })
    : sweep([[0, .02, -.42], [0, .03, -.28], [0, .05, -.05], [0, .07, .1], [0, .1, .17]], tab([[0, .02], [.14, .07], [.45, .1], [.8, .085], [1, .05]]), tab([[0, .02], [.14, .07], [.45, .11], [.8, .1], [1, .06]]), bodyCol, { n: 36, r: 22 });
  const tM = new T.Mesh(torso, mk(M, 0xffffff, { vc: true, map: plumeTex([9, 6]), rough: .8, nmap: plumeN(), ns: .4, phys: { sheen: .5, sheenRoughness: .5, sheenColor: goose ? 0xb0a490 : 0xffffff } })); body.add(tM);
  addFur(tM, M, { len: (u, v) => { const cy = Math.cos(v * TAU); return (cy < -.1 ? .02 : .008) * sstep(.08, .25, u) * (1 - sstep(.85, 1, u)); }, dens: 120, thick: .55, root: .85, droop: .1, comb: [0, -.2, -1.4], sheen: goose ? 0xe8e0d0 : 0xffffff });
  // 首：引いた姿勢（A）と、伸ばした姿勢（B）。頭は首の先
  const NN = 30, NR = 16;
  const neckPts = ext => goose
    ? [[0, .07, .2], [0, lerp(.16, .1, ext), lerp(.27, .34, ext)], [0, lerp(.25, .13, ext), lerp(.3, .46, ext)], [0, lerp(.32, .15, ext), lerp(.33, .56, ext)], [0, lerp(.35, .15, ext), lerp(.38, .62, ext)]]
    : [[0, .1, .15], [0, lerp(.2, .16, ext), lerp(.24, .28, ext)], [0, lerp(.3, .26, ext), lerp(.18, .34, ext)], [0, lerp(.42, .36, ext), lerp(.18, .42, ext)], [0, lerp(.5, .42, ext), lerp(.26, .52, ext)], [0, lerp(.52, .43, ext), lerp(.31, .57, ext)]];
  const nrx = goose ? tab([[0, .07], [.3, .045], [.85, .042], [.93, .055], [1, .05]]) : tab([[0, .05], [.3, .034], [.85, .03], [.92, .042], [1, .04]]);
  const nry = goose ? tab([[0, .08], [.3, .05], [.85, .046], [.93, .06], [1, .05]]) : tab([[0, .055], [.3, .038], [.85, .033], [.92, .046], [1, .042]]);
  const neckCol = goose ? (t, sx, cy) => t > .3 ? 0x5a4c40 : 0x6a5a4a : (t, sx, cy) => WH;
  // 首は縦に立つので、断面の向きの基準を横（x）にとる（上向きを基準にすると、縦の所で断面がねじれる）
  const nA = sweep(neckPts(0), nry, nrx, neckCol, { n: NN, r: NR, up: [1, 0, 0] }), nB = sweep(neckPts(1), nry, nrx, neckCol, { n: NN, r: NR, up: [1, 0, 0] });
  const PA = Float32Array.from(nA.attributes.position.array), PB = Float32Array.from(nB.attributes.position.array);
  const NB = V3(...neckPts(0)[0]), nPiv = new T.Group(); nPiv.position.copy(NB); body.add(nPiv);   // 首の付け根を軸に、左右を向く
  const nM = new T.Mesh(nA, tM.material); nM.position.copy(NB).negate(); nPiv.add(nM);
  const headG = new T.Group(); body.add(headG);
  // くちばし（頭の座標：+Z が前）
  if (goose) {
    headG.add(new T.Mesh(sweep([[0, 0, -.01], [0, -.004, .04], [0, -.01, .085]], tab([[0, .03], [.6, .024], [1, .014]]), tab([[0, .028], [.6, .018], [1, .01]]), (t, sx, cy) => t > .88 ? 0xe8e2d6 : 0xe7959a, { n: 10, r: 12 }), mk(M, 0xffffff, { vc: true, rough: .45, phys: { clearcoat: .4, clearcoatRoughness: .3 } })));   // 桃色、先の爪は白っぽい
    headG.add(ell(mk(M, 0xf6f4ee, { rough: .85 }), 0, .012, .018, .03, .028, .016, 12));   // 額の白（くちばしのつけ根を囲む）
    for (const s of [-1, 1]) irisEye(headG, s, [s * .04, .02, -.04], .009, 0x2a1a10, { pupil: .7 });
  } else {
    headG.add(new T.Mesh(sweep([[0, 0, -.01], [0, -.004, .07], [0, -.012, .15]], tab([[0, .016], [.5, .011], [1, .001]]), tab([[0, .02], [.5, .013], [1, .001]]), () => 0xe3b52c, { n: 12, r: 10 }), mk(M, 0xffffff, { vc: true, rough: .35, phys: { clearcoat: .6, clearcoatRoughness: .2 } })));
    for (const s of [-1, 1]) { const lore = ell(mk(M, 0xb6c072, { rough: .6 }), s * .02, .01, .0, .007, .009, .024, 8); headG.add(lore); irisEye(headG, s, [s * .034, .014, -.02], .0085, 0xe8c832, { pupil: .45 }); }   // 目先の黄緑・黄色い虹彩
  }
  const headBall = ell(mk(M, 0xffffff, { vc: false, map: plumeTex([3, 2]), rough: .8 }), 0, 0, -.03, goose ? .045 : .038, goose ? .046 : .04, goose ? .06 : .056, 16);
  headBall.material.color.set(goose ? 0x5c4e42 : WH); headG.add(headBall);
  let ext0 = -1, look0 = 0;
  function poseNeck(ext, look, pitch = 0) {
    if (Math.abs(ext - ext0) > 1e-3) { ext0 = ext; const P = nA.attributes.position; for (let i = 0; i < PA.length; i++) P.array[i] = PA[i] + (PB[i] - PA[i]) * ext; P.needsUpdate = true; nA.computeVertexNormals(); seam(nA, NN, NR); }
    const { c, f } = neckFrame(nA, NN, NR, NN), ny = look * .35; nPiv.rotation.y = ny;
    headG.position.copy(c).sub(NB).applyAxisAngle(V3(0, 1, 0), ny).add(NB);
    const yaw = Math.atan2(f.x, f.z) + look, pit = -Math.asin(clamp(f.y, -1, 1)) * .25 + pitch;
    headG.rotation.set(pit, yaw, 0, 'YXZ');
  }
  // 尾（マガン 16 枚前後・ダイサギ 12 枚）
  const tailPiv = buildTail(body, goose ? { n: 16, len: .17, wid: .05, spread: .55, z: -.4, y: .04, col: (au, z) => z > .8 ? 0xf2efe8 : 0x3a3029, tex: featherTex('mu_gTail', '#c8c0b4', '#e6e0d6', null) }
    : { n: 12, len: .13, wid: .04, spread: .45, z: -.38, y: .04, col: () => WH, tex: whiteFeather('mu_hTail') });
  // 翼（たたむと背の上に重なる）
  const wk = goose ? 1.35 : 1.3;
  const { wings, poseWing } = buildWings(body, goose
    ? { k: wk, SH: [.075, .1, .08], prim: 1.05, sec: 1, pw: 1.5, texs: [featherTex('mu_gWf', '#3a322c', '#6a5e52', null), featherTex('mu_gWt', '#6a5a4a', '#b8a890', null), featherTex('mu_gWc', '#76685a', '#9a8c7c', '#d8d0c2', .18), featherTex('mu_gWl', '#8a7c6c', '#a09282', '#d6cec0', .2)] }
    : { k: wk, SH: [.055, .1, .07], prim: .95, sec: 1.05, pw: 1.6, texs: [whiteFeather('mu_hWf'), whiteFeather('mu_hWt'), whiteFeather('mu_hWc'), whiteFeather('mu_hWl')] });
  // 脚：股（羽の中）→ かかと（関節）→ 足。マガン＝橙色で水かき、ダイサギ＝黒く長い
  const legM = mk(M, goose ? 0xe8893a : 0x1c1b19, { rough: .55, phys: { clearcoat: .25, clearcoatRoughness: .5 } }), legs = [];
  const LT = goose ? .14 : .32, LS = goose ? .1 : .3, hipY = goose ? -.06 : -.04;
  for (const s of [-1, 1]) {
    const hip = new T.Group(); hip.position.set(s * (goose ? .07 : .05), hipY, goose ? -.04 : 0); body.add(hip);
    hip.add(tube(legM, [[0, 0, 0], [0, -LT * .5, .01], [0, -LT, 0]], goose ? .016 : .011, goose ? .012 : .008, null, 6, 6));
    const ank = new T.Group(); ank.position.set(0, -LT, 0); hip.add(ank); ank.add(ell(legM, 0, 0, 0, goose ? .014 : .011, goose ? .014 : .011, goose ? .014 : .011, 8));
    ank.add(tube(legM, [[0, 0, 0], [0, -LS * .5, .006], [0, -LS, .01]], goose ? .012 : .008, goose ? .01 : .007, null, 6, 6));
    const foot = new T.Group(); foot.position.set(0, -LS, .01); ank.add(foot);
    const toeL = goose ? .07 : .095;
    for (const a of [-.5, 0, .5]) foot.add(tube(legM, [[0, 0, 0], [Math.sin(a) * toeL, -.004, Math.cos(a) * toeL]], .006, .003, null, 4, 4));
    foot.add(tube(legM, [[0, 0, 0], [0, -.002, -toeL * (goose ? .3 : .55)]], .005, .003, null, 3, 4));
    if (goose) { const web = new T.Mesh(new T.CircleGeometry(toeL * .95, 10, Math.PI / 2 - .5, 1.0), mk(M, 0xd87a30, { side: T.DoubleSide, rough: .6 })); web.rotation.x = -Math.PI / 2; web.position.y = -.003; foot.add(web); }   // 前 3 本の指のあいだの水かき
    legs.push({ s, hip, ank, foot });
  }
  const groundY = hipY - LT - LS - .006;   // 足の裏
  body.position.y = -groundY;   // 足もとを y=0 に
  let walkPh = 0, lastT = null;
  // 動き（典拠＝資料/生き物の形と動き_典拠.md）
  //   ダイサギ：浅瀬をゆっくり歩き、一歩ごとに脚を高く上げる。立ち止まると首を伸ばして見つめ、またゆっくり縮める。抜け出るとき翼をひろげてから、たたむ
  //   マガン：ゆっくり深いはばたき（大きな鳥ほど遅い＝Pennycuick 1996）。首はまっすぐ前へ伸ばして飛ぶ。そばでは首を伸ばして見回す
  const update = st => {
    const t = st.t, dt = lastT == null ? 0 : clamp(t - lastT, 0, .1); lastT = t; const look = st.look || 0;
    const flying = goose && st.ph !== 31;
    if (flying) {
      const p = t * 2.6 * TAU + (st.ph === 0 ? 0 : 0), s1 = Math.sin(p);
      for (const w of wings) poseWing(w, .15 + .75 * s1, .3 * Math.max(0, -Math.cos(p)), -.08 * Math.max(0, s1));
      poseNeck(1, look * .5, .05); body.position.y = -groundY - .015 * s1; body.rotation.x = 0;
      for (const L of legs) { L.hip.rotation.x = 1.3; L.ank.rotation.x = .3; L.foot.rotation.x = .6; }   // 脚は後ろへたたむ
      tailPiv.rotation.x = .05 * Math.sin(p + 1);
      if (st.ph === 0) { const k = clamp(st.pt / .9, 0, 1); body.rotation.x = -.3 * (1 - k); }
      return;
    }
    // 地面（ダイサギ）
    const moving = (st.spd || 0) > .08, L = st.L || .6, stride = .34 * L;
    walkPh += moving ? (st.spd / Math.max(.05, stride)) * dt * Math.PI : 0;
    for (const Lg of legs) {
      const p = walkPh + (Lg.s > 0 ? Math.PI : 0), lift = moving ? Math.max(0, Math.sin(p)) : 0;
      Lg.hip.rotation.x = moving ? -.35 * Math.cos(p) - .25 * lift : 0; Lg.ank.rotation.x = moving ? .9 * lift : 0; Lg.foot.rotation.x = moving ? .8 * lift : 0;
    }
    let ext = .15 + .1 * Math.sin(t * .5), pitch = 0;
    if (!moving) { const stare = bout(t, 9, 4.5, 1.7); ext = lerp(.1, .95, stare); pitch = .25 * stare; }   // 立ち止まって首を伸ばし、見つめる
    else ext = .2 + .08 * Math.sin(walkPh);
    let open = 0; if (st.ph === 0) { const k = clamp(st.pt / 1.0, 0, 1); open = Math.sin(Math.PI * k); }
    if (st.ph === 4) open = .5 * sstep(0, .4, st.pt);
    if (open > .01) { for (const w of wings) poseWing(w, .35 + .55 * open, 1 - open * .9); }
    else for (const w of wings) poseWing(w, -.85, 1);
    poseNeck(ext, look * .8, pitch); body.rotation.x = moving ? -.04 : 0; body.position.y = -groundY + (moving ? .006 * Math.sin(walkPh * 2) : 0);
    tailPiv.rotation.x = -.05;
    const br = 1 + .012 * Math.sin(t * TAU * .35); tM.scale.set(br, br, 1);
  };
  update({ t: 0, ph: goose ? 31 : 5, spd: 0 });
  return { g, footY: goose ? groundY : 0, update, ground: !goose };
}

// ================================================================ ノウサギ（ニホンノウサギの形）
//   耳は長く先が黒い・目は大きく顔の横・後脚が長く大きい・尾は短く、下面が白い。毛は褐色の地に黒っぽい差し毛（霜降り）、腹は白っぽい。
function makeHare() {
  const g = new T.Group(), body = new T.Group(); g.add(body);
  const BR = 0x8a6a4a, BRD = 0x5e4630, BL = 0xb39070, WH = 0xece6da, RU = 0x9a6a42;
  // 霜降り：褐色の地に、黒っぽい差し毛が細かく混じる（大きな斑にはしない）
  const agouti = (x, z) => mixh(BR, BRD, .18 + .3 * Math.abs(Math.sin(x * 211 + z * 157) * Math.sin(z * 131 - x * 97)));
  const fur = mk(M, 0xffffff, { vc: true, map: furTex([8, 4]), rough: .9, phys: MOBILE ? undefined : { sheen: .5, sheenRoughness: .5, sheenColor: 0xffe8cc } });
  const FD = { dens: 200, thick: .5, root: .62, droop: .5, comb: [0, -.2, -1.6], sheen: 0xffe8cc };
  // 胴（座った姿勢：腰が高く丸い、胸は低い）
  const trunk = new T.Group(); trunk.position.set(0, .2, -.05); body.add(trunk);
  const tG = sweep([[0, .14, -.36], [0, .2, -.24], [0, .2, -.06], [0, .18, .1], [0, .2, .2]], tab([[0, .03], [.12, .13], [.4, .14], [.75, .1], [1, .07]]), tab([[0, .03], [.12, .18], [.4, .18], [.75, .14], [1, .1]]),
    (t, sx, cy, x, y, z) => cy < -.5 ? WH : cy < -.2 ? mixh(WH, BL, (cy + .5) / .3) : agouti(x, z), { n: 30, r: 20 }); tG.translate(0, -.2, .05);
  const tMesh = new T.Mesh(tG, fur); trunk.add(tMesh);
  addFur(tMesh, M, { ...FD, len: (u, v) => { const cy = Math.cos(v * TAU); return u < .03 ? 0 : cy < -.4 ? .016 : .022; } });
  // 首と頭（首の付け根を軸に向きを変える）
  const neck = new T.Group(); neck.position.set(0, .4, .2); neck.scale.setScalar(1.25); body.add(neck);   // 頭は大きめ・胸の上に高く
  const hG = sweep([[0, .0, -.06], [0, .04, .03], [0, .03, .1], [0, .0, .17], [0, -.02, .2]], tab([[0, .05], [.3, .075], [.6, .065], [.9, .04], [1, .012]]), tab([[0, .06], [.3, .08], [.6, .068], [.9, .042], [1, .012]]),
    (t, sx, cy, x, y, z) => t > .82 && cy < .2 ? WH : (cy < -.45 ? WH : t > .55 && cy < .1 ? BL : (t < .3 && cy > .3 ? RU : agouti(x, z))), { n: 20, r: 18 });
  const headM = new T.Mesh(hG, fur); neck.add(headM);
  { const nk = new T.Mesh(sweep([[0, .22, .08], [0, .3, .14], [0, .38, .18]], tab([[0, .1], [1, .075]]), tab([[0, .11], [1, .08]]), (t, sx, cy, x, y, z) => cy < -.3 ? WH : agouti(x, z), { n: 10, r: 16 }), fur); body.add(nk); addFur(nk, M, { ...FD, len: .02 }); }   // 胸から首へ（頭とつなぐ）
  addFur(headM, M, { ...FD, len: (u) => u > .88 ? .004 : u > .6 ? .009 : .016, comb: [0, -.2, -1.2] });
  // 鼻（ひくつく）とひげ
  const nose = new T.Group(); nose.position.set(0, -.012, .2); neck.add(nose);
  nose.add(ell(mk(M, 0x6a4a3e, { rough: .45, phys: { clearcoat: .6, clearcoatRoughness: .3 } }), 0, 0, 0, .014, .01, .008, 10));
  const whM = mk(M, 0xf0ece4, { rough: .4 }); const whiskers = new T.Group(); nose.add(whiskers);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const a = -.3 + i * .2; whiskers.add(tube(whM, [[s * .012, -.006, -.004], [s * .06, -.006 + a * .05, -.01], [s * .1, -.01 + a * .08, -.03]], .0013, .0005, null, 6, 3)); }
  // 目：大きく顔の横。濡れた角膜、濃い褐色
  const eyeM = wetEye(M, 0x241408);
  for (const s of [-1, 1]) { const e = ell(eyeM, s * .058, .045, .06, .019, .022, .022, 14); neck.add(e); neck.add(ell(mk(M, 0xcdb48e, { rough: .9 }), s * .054, .045, .06, .022, .025, .025, 12)); }   // 目のまわりの淡い輪
  // 耳：長く、先が黒い。内側は毛が少なく淡い。付け根を軸に一つずつ向きを変える
  const ears = [];
  for (const s of [-1, 1]) {
    const ep = new T.Group(); ep.position.set(s * .03, .085, -.02); neck.add(ep);
    const earG = sweep([[0, 0, 0], [0, .1, -.01], [0, .2, -.02], [0, .28, -.03]], tab([[0, .022], [.4, .036], [.8, .03], [1, .004]]), tab([[0, .012], [.4, .016], [.8, .013], [1, .003]]),
      (t, sx, cy) => t > .84 ? 0x1a1612 : (cy > .3 ? 0xd8bca8 : agouti(sx, t)), { n: 14, r: 12, up: [0, 0, 1] });
    const ear = new T.Mesh(earG, fur); ep.add(ear);
    addFur(ear, M, { ...FD, n: MOBILE ? 4 : 8, len: (u, v) => Math.cos(v * TAU) > .3 ? .002 : .007 * (1 - sstep(.85, 1, u)), droop: .1, comb: [0, .3, 0] });
    ears.push({ s, ep });
  }
  // 脚：後脚は太い腿（胴の中）と、長い足（座ると地面に平らにつく）。前脚は細い
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new T.Group(); hip.position.set(s * .1, .14, -.2); body.add(hip);
    const thigh = ell(fur, 0, 0, 0, .06, .1, .12, 14); thigh.geometry = thigh.geometry.clone(); { const n = thigh.geometry.attributes.position.count, cA = new Float32Array(n * 3), c = new T.Color(BR); for (let i = 0; i < n; i++) cA.set([c.r, c.g, c.b], i * 3); thigh.geometry.setAttribute('color', new T.BufferAttribute(cA, 3)); } hip.add(thigh);
    addFur(thigh, M, { ...FD, len: .018 });
    const shank = new T.Group(); shank.position.set(0, -.1, -.04); hip.add(shank);
    const footM = new T.Mesh(sweep([[0, -.055, -.06], [0, -.06, .05], [0, -.062, .13]], tab([[0, .032], [1, .024]]), tab([[0, .026], [1, .018]]), (t, sx, cy) => cy < -.3 ? mixh(BL, WH, .4) : BR, { n: 8, r: 10 }), fur); shank.add(footM);
    addFur(footM, M, { ...FD, n: MOBILE ? 4 : 8, len: .012 });
    const fore = new T.Group(); fore.position.set(s * .05, .2, .12); body.add(fore);
    const fl = new T.Mesh(sweep([[0, 0, 0], [0, -.1, .01], [0, -.19, .03]], tab([[0, .026], [1, .018]]), tab([[0, .028], [1, .019]]), (t, sx, cy) => cy < -.2 ? mixh(BL, WH, .35) : BL, { n: 8, r: 10 }), fur); fore.add(fl);
    addFur(fl, M, { ...FD, n: MOBILE ? 4 : 8, len: .013, comb: [0, -1, 0] });
    legs.push({ s, hip, shank, fore });
  }
  // 尾：短く、上は褐色・下は白
  const tail = new T.Group(); tail.position.set(0, .21, -.4); body.add(tail);
  const tailM = new T.Mesh(sweep([[0, 0, 0], [0, .02, -.03], [0, .02, -.05]], tab([[0, .03], [.6, .035], [1, .01]]), tab([[0, .03], [.6, .033], [1, .01]]), (t, sx, cy) => cy > .3 ? BRD : WH, { n: 6, r: 10 }), fur); tail.add(tailM);
  addFur(tailM, M, { ...FD, len: .02, droop: .2 });
  let lastT = null, hopK = 0;
  // 動き（典拠＝資料/生き物の形と動き_典拠.md）
  //   跳ねる：後脚でけり出して体を伸ばし、前脚から着いて、後脚が前脚より前へ出る（Hildebrand 1977 の非対称の歩き方）
  //   座っているとき：鼻をひくつかせる（間をおいて速く）・耳を左右べつべつに向ける・息で胴がふくらむ・ときどき後脚で伸び上がって見回す
  const update = st => {
    const t = st.t; lastT = t; const look = st.look || 0;
    let hop = st.hop || 0; if (st.ph === 0) hop = Math.sin(Math.PI * clamp(st.pt / .9, 0, 1));   // 抜け出る：ひと跳び
    hopK += (hop - hopK) * .5;
    const h = hopK, sit = 1 - h;
    const alert = st.ph === 5 ? bout(t, 10, 2.6, .8) : 0;   // 伸び上がって見回す
    trunk.rotation.x = -.35 * alert + .18 * h; trunk.scale.set(1, 1, 1 + .18 * h);
    body.position.y = .03 * alert;
    for (const L of legs) { L.hip.rotation.x = -1.1 * h + .15 * alert; L.shank.rotation.x = .9 * h; L.fore.rotation.x = .9 * h - .3 * alert; L.fore.position.y = .2 + .06 * alert; }
    neck.rotation.set(-.15 * alert + .1 * h + .04 * Math.sin(t * .7), look * .7 + .25 * Math.sin(t * .23) * sit, 0, 'YXZ'); neck.position.y = .4 + .07 * alert;
    const twitch = bout(t, 3.2, 1.6, .4); nose.position.y = -.012 + Math.sin(t * 30) * .0018 * twitch; whiskers.rotation.x = Math.sin(t * 30) * .05 * twitch;
    ears.forEach((e, i) => { const swiv = bout(t, 4.5 + i * 1.3, 1.2, i * 2.1); e.ep.rotation.set(-.35 - .25 * h + .12 * swiv, (i ? 1 : -1) * (.12 + .5 * swiv), -e.s * (.22 + .05 * swiv), 'YXZ'); });
    const br = 1 + .02 * Math.sin(t * TAU * .8) * sit; tMesh.scale.set(br, br, 1);
    tail.rotation.x = -.3 * h + .1 * Math.sin(t * 1.3);
  };
  update({ t: 0, ph: 5 });
  return { g, footY: 0, update, ground: true };
}

// ================================================================ コイ（野生型の黒い鯉）
//   体は紡錘形で左右にやや平たい・大きな円鱗（側線に沿っておよそ 33〜40 枚）・口ひげ 2 対（上あごの短い 1 対と口角の長い 1 対）。
//   ひれ＝背びれ 1（長い・前に硬い棘）・胸びれ 2・腹びれ 2・しりびれ 1・尾びれ 1（二叉）。体は粘液で濡れた艶。
function makeCarp() {
  const g = new T.Group(), body = new T.Group(); g.add(body);
  const N = 48, R = 26;
  const col = (t, sx, cy) => { if (t > .815 && t < .835 && cy < .7) return 0x3a3020;   // 鰓ぶたのふち（頭には鱗がない＝鱗の絵は鰓ぶたの手前まで）
    if (cy > .55) return mixh(0x2e2c1c, 0x3a3622, t); if (cy > .1) return mixh(0x5a5030, 0x7a6a3c, (.55 - cy) / .45); if (cy > -.35) return mixh(0x8a7642, 0xb39a5a, (.1 - cy) / .45); return 0xd8cfae; };
  const bodyG = sweep([[0, .0, -.5], [0, .005, -.34], [0, .02, -.1], [0, .02, .14], [0, .0, .36], [0, -.02, .5]],
    tab([[0, .02], [.1, .028], [.25, .055], [.5, .09], [.72, .092], [.88, .075], [1, .02]]), tab([[0, .045], [.1, .05], [.25, .1], [.5, .17], [.72, .16], [.88, .115], [1, .03]]), col,
    { n: N, r: R, k: (t, sx, cy) => 1 - .06 * sstep(.82, .84, t) * (1 - sstep(.84, .86, t)) });   // 鰓ぶたのふち
  // 鱗：大きな円鱗が瓦のように重なる（根もとが暗く、ふちが明るい）。側線の鱗に小さな孔の点
  const scaleMap = ctex('mu_carpScale', 256, 128, (c, w, h) => { c.fillStyle = '#d8d8d8'; c.fillRect(0, 0, w, h); const sx = w / 36, sy = h / 24;
    for (let j = 0; j < 25; j++) for (let i = 0; i < 30; i++) { const x = i * sx + (j % 2) * sx / 2, y = j * sy; const gr = c.createRadialGradient(x - sx * .3, y, 1, x, y, sx * .9); gr.addColorStop(0, 'rgba(255,255,255,.65)'); gr.addColorStop(.75, 'rgba(240,240,240,.2)'); gr.addColorStop(1, 'rgba(40,40,40,.55)'); c.fillStyle = gr; c.beginPath(); c.ellipse(x, y, sx * .75, sy * .62, 0, -Math.PI / 2, Math.PI / 2); c.fill(); }
    c.fillStyle = 'rgba(30,30,30,.6)'; for (let i = 0; i < 30; i++) for (const v of [.25, .75]) { c.beginPath(); c.arc(i * sx, h * v, 1.4, 0, TAU); c.fill(); } });
  const scaleN = nmap('mu_carpScaleN', 128, 64, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); const sx = w / 36, sy = h / 24; for (let j = 0; j < 25; j++) for (let i = 0; i < 30; i++) { const x = i * sx + (j % 2) * sx / 2, y = j * sy, gr = c.createLinearGradient(x - sx * .6, y, x + sx * .6, y); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#222'); c.fillStyle = gr; c.beginPath(); c.ellipse(x, y, sx * .75, sy * .62, 0, -Math.PI / 2, Math.PI / 2); c.fill(); } }, 2.2);
  scaleMap.wrapS = scaleMap.wrapT = T.RepeatWrapping;
  // uv：sweep の uv は (t, 周) なので、鱗の向きに合わせて使う
  const bm = new T.Mesh(bodyG, mk(M, 0xffffff, { vc: true, map: scaleMap, rough: .38, nmap: scaleN, ns: .55, phys: { clearcoat: .7, clearcoatRoughness: .22, sheen: .4, sheenRoughness: .4, sheenColor: 0xd8c890, iridescence: .25, iridescenceIOR: 1.4, iridescenceThicknessRange: [250, 450] } }));
  body.add(bm);
  const P0 = Float32Array.from(bodyG.attributes.position.array);
  // ひれ：鰭条の筋を描いた、薄く透ける膜（後ろから光が当たると透ける）
  const finTex = ctex('mu_carpFin', 128, 128, (c, w, h) => { const gr = c.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(70,58,34,.95)'); gr.addColorStop(1, 'rgba(110,90,52,.7)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(40,30,16,.85)'; c.lineWidth = 1.5; for (let i = 0; i < 20; i++) { c.beginPath(); c.moveTo(w / 2, h); c.quadraticCurveTo(i * w / 19, h * .5, i * w / 19, 0); c.stroke(); } });
  const finM = mk(M, 0xffffff, { map: finTex, side: T.DoubleSide, rough: .5, phys: { clearcoat: .6, clearcoatRoughness: .2 }, key: 'carpFin', hook: transHook({ trans: 0x8a6a30 }) }); finM.transparent = true; finM.opacity = .9;
  const fin = (pts, sm = 0) => { const geo = flatShape(smoothPts(pts, 4)); return new T.Mesh(geo, finM); };   // 平らな形（x＝外、y＝前）→ 3D は (x, 0, y)
  const mkFinV = (pts, z, y, side = 1) => { const m = fin(pts); m.rotation.z = Math.PI / 2 * side; const gF = new T.Group(); gF.position.set(0, y, z); gF.add(m); body.add(gF); return gF; };
  const dorsal = mkFinV([[0, .0], [.13, .02], [.12, -.05], [.07, -.2], [.04, -.3], [0, -.32]], .12, .15);   // 背びれ（長い。前の棘が高い）
  dorsal.add(tube(mk(M, 0x2e2616, { rough: .4 }), [[0, 0, .0], [0, .13, .02]], .005, .002, null, 4, 4));
  const anal = mkFinV([[0, 0], [.09, -.01], [.07, -.08], [0, -.09]], -.24, -.08, -1);
  const pair = (pts, pos, rot) => { const out = []; for (const s of [-1, 1]) { const gF = new T.Group(); gF.position.set(s * pos[0], pos[1], pos[2]); const m = fin(pts); if (s < 0) m.scale.x = -1; gF.add(m); gF.rotation.set(rot[0], 0, s * rot[2]); body.add(gF); out.push({ s, gF }); } return out; };
  const pect = pair([[0, 0], [.05, -.02], [.12, -.1], [.08, -.13], [0, -.05]], [.06, -.09, .3], [.2, 0, -.5]);
  const pelv = pair([[0, 0], [.04, -.02], [.09, -.09], [.05, -.1], [0, -.04]], [.04, -.13, .02], [.1, 0, -.6]);
  // 尾びれ（二叉）
  const tailG = new T.Group(); tailG.position.set(0, .005, -.48); body.add(tailG);
  const caud = fin([[0, .02], [.2, -.06], [.28, -.17], [.12, -.11], [.04, -.12], [0, -.13], [-.04, -.12], [-.12, -.11], [-.28, -.17], [-.2, -.06]]);
  caud.rotation.z = Math.PI / 2; tailG.add(caud);
  // 頭：口（くちびる）と口ひげ 2 対・目（金色の虹彩）・鼻の穴
  const head = new T.Group(); head.position.set(0, -.02, .5); body.add(head);
  const lipM = mk(M, 0x9a7c4c, { rough: .35, phys: { clearcoat: .8, clearcoatRoughness: .15 } });
  const lips = new T.Mesh(new T.TorusGeometry(.013, .006, 8, 16), lipM); lips.position.set(0, -.005, -.002); head.add(lips);
  const mouthIn = ell(mk(M, 0x2a1810, { rough: .6 }), 0, -.005, -.006, .014, .012, .006, 10); head.add(mouthIn);
  const barM = mk(M, 0x8a6e44, { rough: .4, phys: { clearcoat: .7, clearcoatRoughness: .2 } }), barbels = [];
  for (const s of [-1, 1]) { const b1 = new T.Group(); b1.position.set(s * .016, .006, -.01); head.add(b1); b1.add(tube(barM, [[0, 0, 0], [s * .01, -.012, -.006], [s * .015, -.024, -.008]], .0045, .002, null, 6, 5));
    const b2 = new T.Group(); b2.position.set(s * .022, -.016, -.012); head.add(b2); b2.add(tube(barM, [[0, 0, 0], [s * .014, -.022, -.01], [s * .022, -.046, -.018]], .0055, .002, null, 8, 5)); barbels.push(b1, b2); }
  for (const s of [-1, 1]) irisEye(body, s, [s * .055, .035, .4], .017, 0xc9a24a, { pupil: .5, yaw: 1.35 });
  // 動き（典拠＝資料/生き物の形と動き_典拠.md）
  //   泳ぐ：体の後ろ半分と尾びれのうねり（波は頭から尾へ。振れは尾へ行くほど大きい）。胸びれは止まるときにひろげ、ゆっくり進むときは小さくあおぐ
  //   そばで止まるとき：胸びれ・腹びれを交互にあおいで体を保ち、口と鰓ぶたをゆっくり開け閉めする（息）
  //   抜け出る：尾をひとふりして、ぐっと前へ
  let ph = 0, lastT = null;
  const P = bodyG.attributes.position;
  const update = st => {
    const t = st.t, dt = lastT == null ? 0 : clamp(t - lastT, 0, .1); lastT = t;
    const slow = st.ph === 5 || st.ph === 31, burst = st.ph === 0 ? Math.sin(Math.PI * clamp(st.pt / .8, 0, 1)) : 0;
    const f = slow ? .9 : 1.6 + 2.2 * burst, A = slow ? .035 : .07 + .07 * burst;
    ph += f * TAU * dt;
    for (let i = 0; i < P.count; i++) { const z = P0[i * 3 + 2], u = clamp((.5 - z), 0, 1), env = .08 + .92 * u * u; P.array[i * 3] = P0[i * 3] + Math.sin(ph - u * 4.5) * A * env; }
    P.needsUpdate = true; bodyG.computeVertexNormals(); seam(bodyG, N, R);
    const tailX = Math.sin(ph - 4.5) * A * 1.0, tailAng = Math.cos(ph - 4.5) * A * 5.5;
    tailG.position.x = tailX; tailG.rotation.y = tailAng;
    dorsal.position.x = Math.sin(ph - 1.9) * A * .3; dorsal.rotation.y = Math.cos(ph - 1.9) * A * 1.4; anal.position.x = Math.sin(ph - 4) * A * .7; anal.rotation.y = Math.cos(ph - 4) * A * 2;
    head.position.x = Math.sin(ph) * A * .08; body.rotation.y = -Math.sin(ph) * A * .5;
    const scull = slow ? Math.sin(t * 2.2) : Math.sin(t * 1.4) * .4;
    for (const p of pect) p.gF.rotation.set(.2 + .25 * scull * p.s, 0, p.s * (slow ? -.9 + .2 * scull : -.35));
    for (const p of pelv) p.gF.rotation.set(.1 - .2 * scull * p.s, 0, p.s * (slow ? -.75 : -.45));
    const br = slow ? .5 + .5 * Math.sin(t * 1.6) : .3 + .2 * Math.sin(t * 2.4); lips.scale.set(1 + .15 * br, 1 + .3 * br, 1); mouthIn.scale.set(.01 * (1 + .25 * br), .008 * (1 + .5 * br), .005);
    barbels.forEach((b, i) => { b.rotation.x = .2 * Math.sin(t * 1.3 + i) + (slow ? 0 : .3); b.rotation.z = .1 * Math.sin(t * 1.7 + i * 2); });
  };
  update({ t: 0, ph: 5 });
  return { g, footY: -.15, update };
}

// ================================================================ アキアカネ（成熟した雄）
//   頭（左右の複眼は大きく、頭の上で接する）・胸（太い）・腹（細長い 10 節・成熟した雄は赤い）・翅 4（前翅と後翅は形が少し違い、後翅は付け根が広い。
//   網目の翅脈・前縁の中ほどに結節・先の近くに縁紋）・脚 6（とげが並ぶ）。止まると翅を水平にひろげる。
function makeDragonfly() {
  const g = new T.Group(), body = new T.Group(); g.add(body);
  const RED = 0xb4301c, RDK = 0x6a1c12, TH = 0x9a5a2e;
  const abG = sweep([[0, .0, .04], [0, -.005, -.2], [0, -.01, -.45], [0, -.012, -.6]], tab([[0, .028], [.06, .02], [.14, .016], [.75, .018], [.92, .014], [1, .008]]), tab([[0, .03], [.06, .022], [.14, .018], [.75, .02], [.92, .015], [1, .008]]),
    (t, sx, cy) => { const s = t * 10, f = s - Math.floor(s); if (f < .08) return RDK; if (cy < -.5) return 0x8a2a1a; return Math.abs(sx) > .82 && cy < .2 ? 0x2a120c : RED; }, { n: 50, r: 12 });
  const abM = new T.Mesh(abG, mk(M, 0xffffff, { vc: true, rough: .35, phys: { clearcoat: .6, clearcoatRoughness: .25 } })); const abP = new T.Group(); abP.position.set(0, 0, .02); abG.translate(0, 0, -.02); abP.add(abM); body.add(abP);
  for (const s of [-1, 1]) abP.add(tube(mk(M, 0x3a1810, { rough: .5 }), [[s * .004, -.01, -.6], [s * .008, -.005, -.64]], .003, .0015, null, 3, 4));   // 尾部付属器
  const thM = new T.Mesh(sweep([[0, .0, .03], [0, .02, .1], [0, .02, .17]], tab([[0, .03], [.4, .052], [1, .04]]), tab([[0, .035], [.4, .058], [1, .045]]),
    (t, sx, cy) => (Math.abs(Math.abs(sx) - .55) < .06 && cy > -.3) ? 0x3a2414 : (cy < -.4 ? 0x7a5a36 : TH), { n: 14, r: 16 }), mk(M, 0xffffff, { vc: true, rough: .6 }));
  body.add(thM); addFur(thM, M, { n: MOBILE ? 4 : 8, len: .006, dens: 220, thick: .3, root: .7, droop: .2, sheen: 0xf0e0c0 });
  // 頭：大きな複眼（上は赤褐色・下は淡い）、顔は淡い黄褐色
  const head = new T.Group(); head.position.set(0, .025, .19); body.add(head);
  head.add(ell(mk(M, 0xc8a070, { rough: .6 }), 0, -.012, .028, .032, .026, .018, 12));
  const eyeU = compoundEye(M, 0x6a2a1e), eyeL = compoundEye(M, 0xa48a6a);
  for (const s of [-1, 1]) { head.add(ell(eyeU, s * .026, .014, .0, .036, .034, .036, 18)); head.add(ell(eyeL, s * .03, -.008, -.002, .032, .024, .03, 14)); }
  // 脚 6：胸の下から前へ。とげ（細い毛）が並ぶ
  const legM = mk(M, 0x1e1410, { rough: .5 }), legs = new T.Group(); body.add(legs);
  for (const s of [-1, 1]) for (const [z, reach] of [[.15, .08], [.11, .06], [.07, .04]]) {
    const a = [s * .012, -.03, z], k1 = [s * .045, -.05, z + reach * .4], e = [s * .05, -.09, z + reach];
    legs.add(tube(legM, [a, k1], .0045, .0035, null, 4, 4)); legs.add(tube(legM, [k1, e], .0035, .0022, null, 4, 4));
    for (let i = 1; i < 4; i++) { const p = [lerp(k1[0], e[0], i / 4), lerp(k1[1], e[1], i / 4), lerp(k1[2], e[2], i / 4)]; legs.add(tube(legM, [p, [p[0] - s * .006, p[1] + .004, p[2] + .006]], .001, .0005, null, 2, 3)); }
  }
  // 翅：網目の翅脈・結節・縁紋（赤褐色）。膜は透明で、厚さのむらで虹色。後翅は付け根が広い
  const CH = 1.9;   // 翅の幅（前後）の倍率：長さと幅の比が実物（およそ 4 対 1）に近くなるように
  const fwP = smoothPts([[0, .012], [.2, .03], [.45, .04], [.62, .035], [.7, .02], [.69, -.005], [.6, -.03], [.4, -.04], [.18, -.035], [.05, -.02]].map(([x, y]) => [x * .9, y * CH]), 4, [0]);
  const hwP = smoothPts([[0, .012], [.2, .03], [.45, .038], [.6, .03], [.67, .015], [.65, -.015], [.5, -.05], [.3, -.07], [.12, -.085], [.03, -.06]].map(([x, y]) => [x * .9, y * CH]), 4, [0]);
  const fwG = flatShape(fwP), hwG = flatShape(hwP);
  const wingTex = (key, geo, pts, hind) => shapeTex(key, geo, pts, (c, path, px) => {
    c.fillStyle = 'rgba(236,236,228,.12)'; c.fill(path); c.scale(.9, CH); px /= CH; c.strokeStyle = 'rgba(40,26,18,.85)';
    const L = hind ? .66 : .69, lines = hind ? [.03, .02, .008, -.006, -.022, -.04, -.058] : [.03, .02, .008, -.004, -.016, -.028];
    c.lineWidth = 3.4 * px; c.beginPath(); c.moveTo(0, .012); c.quadraticCurveTo(.35, .04, L, .022); c.stroke();                          // 前縁脈
    c.lineWidth = 1.6 * px; for (const y of lines) { c.beginPath(); c.moveTo(0, y * .6); c.quadraticCurveTo(.3, y * 1.05, L * .97, y * .7); c.stroke(); }   // 縦の脈
    c.lineWidth = .9 * px; for (let x = .02; x < L; x += .011) { c.beginPath(); c.moveTo(x, .032); c.lineTo(x + .002, hind ? -.08 : -.04); c.stroke(); }    // 横脈（網目）
    c.lineWidth = .6 * px; for (let x = .3; x < L; x += .006) { c.beginPath(); c.moveTo(x, -.01); c.lineTo(x + .004, -.045); c.stroke(); }
    c.lineWidth = 2.4 * px; c.beginPath(); c.moveTo(.31, .038); c.lineTo(.31, .02); c.stroke();                                            // 結節
    c.fillStyle = 'rgba(120,40,24,.95)'; c.fillRect(L * .83, .018, L * .08, .012);                                                         // 縁紋
  }, 512);
  const wingPhys = { iridescence: 1, iridescenceIOR: 1.5, iridescenceThicknessRange: [200, 650], iridescenceThicknessMap: thinFilm('mu_dfFilm'), specularIntensity: 1 };
  const fwM = mk(M, 0xffffff, { map: wingTex('mu_dfFW', fwG, fwP, false), transparent: true, side: T.DoubleSide, depthWrite: false, rough: .1, phys: wingPhys, key: 'glint', hook: glintHook({ glint: 1.3 }) });
  const hwM = mk(M, 0xffffff, { map: wingTex('mu_dfHW', hwG, hwP, true), transparent: true, side: T.DoubleSide, depthWrite: false, rough: .1, phys: wingPhys, key: 'glint', hook: glintHook({ glint: 1.3 }) });
  // 羽ばたきの残像：実物は 1 秒に数十回で、画面のこま数では止まって見えない。翅を毎こま違う位置に置き、うすい残像の翅を 2 枚ずつ重ねる（写真のぶれと同じ見え方）
  const ghostM = mk(M, 0xffffff, { map: fwM.map, transparent: true, side: T.DoubleSide, depthWrite: false, rough: .3 }); ghostM.opacity = .22;
  const ghostH = mk(M, 0xffffff, { map: hwM.map, transparent: true, side: T.DoubleSide, depthWrite: false, rough: .3 }); ghostH.opacity = .22;
  const wings = [];
  for (const s of [-1, 1]) {
    const fw = new T.Group(), hw = new T.Group(); fw.position.set(s * .02, .035, .14); hw.position.set(s * .02, .033, .09);
    const fm = new T.Mesh(fwG, fwM), hm = new T.Mesh(hwG, hwM); if (s < 0) { fm.scale.x = -1; hm.scale.x = -1; } fw.add(fm); hw.add(hm); body.add(fw, hw);
    const ghosts = [];
    for (let k = 0; k < 2; k++) for (const [geo, m, at] of [[fwG, ghostM, fw], [hwG, ghostH, hw]]) { const gp = new T.Group(); gp.position.copy(at.position); const gm = new T.Mesh(geo, m); if (s < 0) gm.scale.x = -1; gp.add(gm); gp.visible = false; body.add(gp); ghosts.push(gp); }
    wings.push({ s, fw, hw, blur: { set visible(v) { for (const q of ghosts) q.visible = v; } }, ghosts });
  }
  let face = 0, lastT = null;
  // 動き（典拠＝資料/生き物の形と動き_典拠.md）
  //   飛ぶ：前翅と後翅はずれて打つ（後翅が少し先）。止まって浮く（ホバリング）ことができる。画面では毎こま違う位置＋残像
  //   止まる：翅を水平にひろげ、頭をすばやく回して見回す。ときどき翅を少し下げる・腹を少し上げる
  const update = st => {
    const t = st.t, fly = st.ph !== 31, look = st.look || 0;
    for (const w of wings) {
      if (fly) { const p = Math.random() * TAU, a = .55 * Math.sin(p), b = .55 * Math.sin(p + .9); w.fw.rotation.set(-.1 * Math.cos(p), 0, w.s * a); w.hw.rotation.set(-.1 * Math.cos(p + .9), 0, w.s * b); w.blur.visible = true;
        w.ghosts.forEach((q, i) => { const pp = p + (1 + (i >> 1)) * 2.1 + (i & 1) * .9; q.rotation.set(0, 0, w.s * .55 * Math.sin(pp)); }); }
      else { const droop = .05 + .08 * bout(t, 6, 1.4, w.s + 3); w.fw.rotation.set(0, -w.s * .06, -w.s * droop); w.hw.rotation.set(0, w.s * .04, -w.s * droop); w.blur.visible = false; }
    }
    fwM.opacity = hwM.opacity = fly ? .6 : 1;
    if (fly) { body.position.set(wob(t * 1.6, 1) * .02, wob(t * 1.3, 3) * .03, 0); body.rotation.set(-.08 + wob(t * 2, 2) * .05, 0, wob(t * 1.7, 4) * .06); legs.rotation.x = .35; }
    else { body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); legs.rotation.x = 0; }
    // 頭：すばやく向きを変えて止まる
    const kk = Math.floor(t / .9), tgt = (hash1(kk * 3.7) - .5) * 1.1 + look * .6, prev = (hash1((kk - 1) * 3.7) - .5) * 1.1 + look * .6, u = sstep(kk * .9, kk * .9 + .06, t);
    head.rotation.set((hash1(kk * 5.1) - .5) * .3, lerp(prev, tgt, u) * (fly ? .3 : 1), 0, 'YXZ');
    abP.rotation.x = fly ? .04 * Math.sin(t * 3) : -.08 * bout(t, 7, 2, 1);
  };
  update({ t: 0, ph: 31 });
  return { g, footY: -.09, update };
}

// ================================================================ 蝶（胡蝶の夢のモンシロチョウの型そのまま）
function makeChou() {
  const b = makeButterfly('monshiro-f'), g = new T.Group(); g.add(b);
  b.scale.setScalar(.38);   // 翅をひろげた幅をほぼ 1 に
  const update = st => {
    const rest = st.ph === 31; b.userData.state = rest ? 'rest' : 'fly';
    if (rest) { b.userData.animate(st.t); return; }
    if (st.ph === 0) { const k = clamp(st.pt / .8, 0, 1); b.userData.flap(st.t, .4 + .6 * k); return; }   // 抜け出る：閉じた翅を少しずつひろげる
    b.userData.flap(st.t);
  };
  update({ t: 0, ph: 31 });
  return { g, footY: -.07, update };
}

// ================================================================ 作る
export function createCreatures(THREE) {
  const BUILD = { sparrow: () => makeSmallBird('sparrow'), smallbird: () => makeSmallBird('sparrow'), swallow: () => makeSmallBird('swallow'), warbler: () => makeSmallBird('warbler'),
    goose: () => makeBigBird('goose'), heron: () => makeBigBird('heron'), carp: makeCarp, butterfly: makeChou, dragonfly: makeDragonfly, hare: makeHare };
  // 大きさをそろえる：体の長さ（くちばし〜尾の先・鼻〜尾）＝1。蝶・蜻蛉は翅をひろげた幅をほぼ 1
  const NORM = { sparrow: 1 / .9, smallbird: 1 / .9, swallow: 1 / 1.15, warbler: 1 / .95, goose: 1 / 1.25, heron: 1 / 1.05, carp: 1 / 1.1, butterfly: 1, dragonfly: 1 / 1.4, hare: 1 / .85 };
  function make(style, img) {
    const kind = BUILD[style] ? style : "sparrow", c = BUILD[kind](), G = new THREE.Group(), inner = new THREE.Group(); inner.add(c.g); G.add(inner);
    const n = NORM[kind]; inner.scale.setScalar(n);
    const p = { G, kind: kind === "smallbird" ? "sparrow" : kind, footY: (c.footY ?? 0) * n, ground: !!c.ground };
    const mats = []; G.traverse(m => { if (m.isMesh) { m.castShadow = false; for (const x of [].concat(m.material)) if (!mats.includes(x)) { x.userData.op0 = x.opacity; x.userData.dw0 = x.depthWrite; x.userData.tr0 = x.transparent; mats.push(x); } } });
    let op = -1;
    p.setOpacity = o => { if (Math.abs(o - op) < 1e-3) return; const was = op; op = o;
      for (const x of mats) { const tr = o < .999 || x.userData.tr0; if (tr !== x.transparent) { x.transparent = tr; x.needsUpdate = true; } x.opacity = o * x.userData.op0; x.depthWrite = o > .95 && x.userData.dw0 !== false; }
      G.visible = o > .01; };
    p.update = st => { try { c.update(st); } catch (e) { console.warn(e); } };
    return p;
  }
  return { make };
}
