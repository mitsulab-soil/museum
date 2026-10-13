/* 碧（依代）の自然な動きと表情 ── aoi_motion.js（v4・2026-10-13）
   v4（2026-10-13 本人「碧の動きは全体のキモなので、８５点まで上げて。動きと表情を自然な感じに仕上げて。」「碧の表情について、不気味の谷を乗り越えてください。」）：
   - 立ち姿の記録 4 本×左右＝8 通りをくじで選び、2.4 秒かけて入れかえる。力を抜いた手が体から離れすぎない。
   - 歩き：歩数を速さに合わせる（秒速 0.85 m で 1 秒 1.75 歩）・かかとから着き、かかとを軸につま先を下ろす・かかとを上げるときはつま先の付け根を軸に・届かないときは腰を下げる・腕の振りは速さに合わせる。
   - 顔：笑み・眉を左右に分けた形（左右対称すぎない）・頬の血色（addCheekTint）・目の光が黒目の半分だけ動く（softenEyeHighlight）・まばたきの速さを毎回変える・
     見る人の両目と口元を行き来する視線・止まった顔にしない小さな気分の動き・口の開きを控え、音の頭で閉じ、次の母音へ寄せる。
   - 裾（aoi_robe.js）：脚の表面より内へ布を入れない（鎖のあいだも）。API は v3 と同じ（足したものはすべて任意）。調べ＝mitsulab の資料 碧の自然な動き_調べ.md §9。
   v3.1（2026-10-13 本人「HPの碧はまっすぐ立っていてください。姿勢は良くしていながら、自然な仕草にしてください。」「碧左右に揺れすぎです。もう少し揺れを抑えて」）：
   - 既定の立ち姿・歩きの左右の揺れを v3 の半分以下に（重心の移し 45%・骨盤の横の傾き・体の横揺れ・記録の胴の横の傾き 35%・記録の腰の横の動き 4 割・息の肩の傾き 半分・歩くときの骨盤の傾き 半分）。
   - 新しいオプション posture:"upright"（"formal" も同じ）＝まっすぐ立つ（HP）。骨盤は水平・背を立て・肩を少し引いて水平・手は脇。仕草は息・まばたき・小さな視線・小さく首をかしげるだけ。
     既定は posture:"natural"（ほかのアプリはこのまま）。
   本人（2026-10-12）：「碧の動きを極限まで人間の自然な動作に近づけて」「表情も大事です」
   調べたこと・数値の出どころ＝mitsulab の資料 碧の自然な動き_調べ.md。
   v3（2026-10-13）：
   - 人が動いた記録（モーションキャプチャ・CMU Graphics Lab Motion Capture Database。aoi_mocap.json／aoi_mocap.js）を土台にした。
     立つ（女性 2 人の記録を交互に）・歩く（女性の歩きの一周期を、この部品の足の運びの位相に合わせて）・話す（胴と首だけ）。
     脚は記録を使わず、これまでどおり足を地面に着けたまま IK で決める（すべらない）。目・まばたき・口・身ぶり・指す・礼は上に重ねる。
   - ローブの裾を布のように揺らす（aoi_robe.js）。脚の骨に直に付いていた裾を、腰から下がる鎖に付けかえる。
   - 表情：下まぶただけ上がる形（目を細める）と、頬が上がる形を、読み込んだときに顔の形から作って足した（.vrm はさわらない）。
   同じフォルダに aoi_mocap.js・aoi_mocap.json・aoi_robe.js を置く（json が無いときは、記録なしの動きで続ける）。

   使い方（どのアプリでも同じ）：
     import { AoiMotion } from "./kit/aoi_motion.js";
     const m = new AoiMotion(vrm, { root });        // root＝碧を置く入れ物（vrm.scene の親。無ければ vrm.scene）
     毎こま：m.update(dt, camera);                   // 中で vrm.update(dt) まで呼ぶ（{ vrmUpdate:false } で外せる）
     m.place(x, z, yaw)    いきなり置く（足もそろえる）
     m.walkTo(v3)          ばねで歩いて行く（足は地面に着いたまま、すべらない）
     m.drive(x, z)         アプリが自分で位置を決めるとき（壁の当たり判定など）。毎こま呼ぶ
     m.faceTo(yaw|null)    その向きへ足を踏みかえて向く（null＝見る人の方へ）
     m.lookAt(v3|Object3D|null)  見る先（null＝見る人）
     m.speak({ timeline, kana, text, dur, clock, level })  話す（口・身ぶり・視線・まばたき）。clock＝声の再生位置（秒）を返す関数
     m.stopSpeaking()      話し終わり
     m.listen(on)          聞く（うなずき・首をかしげる・目を合わせる）
     m.point(v3, sec)      指さす（目→手→見る人の順）
     m.bow("eshaku"|"keirei")  お辞儀（会釈 15°・敬礼 30°。腰から曲げ、背は伸ばす）
     m.express(name, w, sec)   表情（calm・warm・smile・curious・thinking・concern・surprise）。ふだんは calm
   m.eyesClosed = 0..1   目を閉じたままにする（0 で戻す）
   新しいオプション（なくても動く）：{ posture: "natural"（既定）| "upright"（まっすぐ立つ）, groundAt: (x, z) => 地面の高さ（坂・段。氷川道中のため）, mocap: "auto"（既定・隣の aoi_mocap.json を読む）| URL | 読んだ JSON | false, robe: true | false }
   何もしなくても：息（3.4〜4.8 秒で一回・吸う 4 割／吐く 6 割）・重心の移しかえ（片足に体重をのせ、骨盤が傾き、肩が逆に傾く）・
   小さな揺れ・まばたき（間隔は対数正規・話すと増える・視線を大きく動かすとき・二度まばたき）・目が先に動き頭が追う・
   ときどき目をそらす・腕は振り子として遅れてついてくる・表情の小さなゆらぎ。
   動きを減らす設定（reducedMotion）：揺れ・身ぶりを止め、まばたき・口・視線だけ残す。 */
import * as THREE from "three";
import { loadMocap, decodeMocap, sampleClip } from "./aoi_mocap.js";
import { AoiRobe } from "./aoi_robe.js";

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sstep = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const _v = [...Array(10)].map(() => new THREE.Vector3()), _q = [...Array(6)].map(() => new THREE.Quaternion()), _e = new THREE.Euler(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

// 臨界減衰のばね（行き過ぎない・急に止まらない）
class Spr {
  constructor(v = 0, w = 6) { this.v = v; this.d = 0; this.t = v; this.w = w; }
  step(dt, w = this.w) { const x = this.v - this.t, c = this.d + w * x, e = Math.exp(-w * dt); this.v = this.t + (x + c * dt) * e; this.d = (this.d - c * w * dt) * e; return this.v; }
  set(v) { this.v = this.t = v; this.d = 0; }
}
function rng(seed) { let a = seed >>> 0 || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// なめらかな揺らぎ（周期のそろわない三つの正弦の和。-1..1）
const wob = (t, s) => .55 * Math.sin(t * .31 + s) + .3 * Math.sin(t * .73 + s * 2.3) + .15 * Math.sin(t * 1.61 + s * 4.1);

// ---------------------------------------------------------------- 口の時刻表
// timeline＝{ m:[[開始秒, 長さ, 母音, 唇を閉じる子音か], …], b:[拍（強く読む音の時刻）…], p:[句の始まり…], d:全体の秒 }
// 母音＝a i u e o、N（ん）、cl（っ）、pau（間）。大文字の A I U E O は無声化（口はほとんど動かない）
const KV = {}; { const rows = { a: "アカガサザタダナハバパマヤラワャァヮ", i: "イキギシジチヂニヒビピミリィ", u: "ウクグスズツヅヌフブプムユルュゥヴ", e: "エケゲセゼテデネヘベペメレェ", o: "オコゴソゾトドノホボポモヨロヲョォ" }; for (const [v, s] of Object.entries(rows)) for (const c of s) KV[c] = v; }
const LIP = new Set("マミムメモバビブベボパピプペポ");
// かな（VOICEVOX の kana＝「ヨオコソ、/シンラ/…」）と長さから、時刻表をつくる（正確な時刻表が無いアプリ用）
export function timelineFromKana(kana, dur, { pre = .05, post = .12 } = {}) {
  const ms = []; let phrase = true, ph = [];
  for (const c of kana || "") {
    if (c === "/") { phrase = true; continue; }
    if (c === "、" || c === "，" || c === "。") { ms.push({ v: "pau", w: 1.8 }); phrase = true; continue; }
    if ("ャュョァィゥェォヮ".includes(c) && ms.length && ms[ms.length - 1].v !== "pau") { ms[ms.length - 1].v = KV[c]; continue; }
    const m = c === "ー" ? { v: ms.length ? ms[ms.length - 1].v : "a", w: 1 } : c === "ッ" ? { v: "cl", w: .8 } : c === "ン" ? { v: "N", w: .9 } : KV[c] ? { v: KV[c], w: 1, c: LIP.has(c) ? 1 : 0 } : null;
    if (!m) continue; if (phrase) { m.ph = 1; phrase = false; } ms.push(m);
  }
  const W = ms.reduce((s, m) => s + m.w, 0) || 1, k = Math.max(.1, dur - pre - post) / W; let t = pre; const out = { m: [], b: [], p: [], d: dur };
  for (const m of ms) { if (m.ph) { out.p.push(t); out.b.push(t + k * .5); } out.m.push([+t.toFixed(3), +(m.w * k).toFixed(3), m.v, m.c || 0]); t += m.w * k; }
  return out;
}
// 漢字まじりの字幕しかないとき（声のない文）：字の数から、おおよその口の動きをつくる（母音は字ごとに決まった並び）
export function timelineFromText(text, dur) {
  const K = "アイウエオカキクケコサシスセソタチツテトナニヌネノマミムメモ"; let s = "";
  for (const c of text || "") { if ("、。，．！？!?…".includes(c)) s += "、"; else if (/\s/.test(c)) s += "/"; else if (KV[c] || "ンッー".includes(c)) s += c; else s += K[c.charCodeAt(0) % K.length]; }
  return timelineFromKana(s, dur);
}
// v4：口の開きを v3 より小さく（アニメの口を大きく開けると「ゴムの口」に見える）。日本語の「う」は唇を突き出さないので ou は控えめ
const VIS = { a: { aa: .6, oh: .08 }, i: { ih: .5, ee: .14 }, u: { ou: .42, ih: .06 }, e: { ee: .55, aa: .1 }, o: { oh: .58, ou: .1 }, N: { ou: .08 }, A: { aa: .1 }, I: { ih: .08 }, U: { ou: .08 }, E: { ee: .1 }, O: { oh: .1 } };
const MOUTH = ["aa", "ih", "ou", "ee", "oh"];

// ---------------------------------------------------------------- 表情（VRoid の顔の形から、アニメの誇張を避けた小さな動きを組む）
// 目を閉じて笑う「happy」や、口を大きく開ける形は使わない。頬が上がり目尻が締まる（デュシェンヌ）を、下まぶたの小さな上がりで表す
// v3：lidLow（下まぶただけ上がる）・cheek（頬が上がる）は、読み込んだときに addFaceMorphs() が顔の形から作る
// v4：笑み・眉は左右に分けた形（[形, 重み, 左右＝1 左・-1 右]）。分けた形が無い顔では、もとの形（FB）を使う
const CH = { smile: [["AoiSmileL", 1, 1], ["AoiSmileR", 1, -1]], squint: [["Fcl_EYE_Fun", 1]], lidLow: [["AoiLidLow", 1]], cheek: [["AoiCheek", 1]], browUp: [["AoiBrowUpL", 1, 1], ["AoiBrowUpR", 1, -1]], browSad: [["Fcl_BRW_Sorrow", 1]], browJoy: [["AoiBrowJoyL", 1, 1], ["AoiBrowJoyR", 1, -1]], wide: [["Fcl_EYE_Spread", 1]], eyeSad: [["Fcl_EYE_Sorrow", 1]] };
const CH_FB = { smile: [["Fcl_MTH_Fun", 1]], browUp: [["Fcl_BRW_Surprised", 1]], browJoy: [["Fcl_BRW_Fun", 1]] };
const CHMAX = { squint: .2, lidLow: .62, cheek: 1 };   // 目を細めるのは 0.2 まで（閉じきるとまばたきに見える）。下まぶただけなら 0.62 まで
export const EMOTIONS = {
  calm:     { smile: .14, squint: .02, lidLow: .1, cheek: .12, browJoy: .10 },
  warm:     { smile: .3, squint: .05, lidLow: .3, cheek: .5, browJoy: .2 },
  smile:    { smile: .48, squint: .08, lidLow: .48, cheek: .85, browJoy: .3 },
  curious:  { smile: .08, browUp: .34, wide: .1 },
  thinking: { lidLow: .16, browSad: .2, eyeSad: .05 },
  concern:  { browSad: .42, eyeSad: .12, browUp: .06 },
  surprise: { browUp: .62, wide: .32 },
};

// ---------------------------------------------------------------- 顔の形を足す（v3）
// VRoid の顔には「下まぶただけ上がる」「頬が上がる」形がない。笑うと頬が上がり下まぶたが押し上げられる（目の周りの筋・デュシェンヌの笑み）。
// 1) AoiLidLow：目を細める形（Fcl_EYE_Fun）のうち、目の中心より下の動きだけを取り出す（上まぶたは下ろさない＝目を閉じたように見えない）。
// 2) AoiCheek：目の下・外寄りの頬を、ごく小さく（最大 1.6 mm）上と前へふくらませる。法線は変えない（陰の付き方を変えない＝不気味にしない）。
export function addFaceMorphs(vrm) {
  const ms = []; vrm.scene.traverse(o => { if (o.isMesh && o.morphTargetDictionary?.Fcl_EYE_Fun != null && o.morphTargetDictionary.AoiLidLow == null) ms.push(o); });
  if (!ms.length) return false;
  const iris = ms.find(m => [].concat(m.material).some(mt => /iris/i.test(mt.name)));
  const ctr = { L: new THREE.Vector3(), R: new THREE.Vector3() }, n = { L: 0, R: 0 }; let yLo = 1e9, yHi = -1e9;
  if (iris) { const P = iris.geometry.attributes.position; for (let i = 0; i < P.count; i++) { const k = P.getX(i) >= 0 ? "L" : "R"; ctr[k].x += P.getX(i); ctr[k].y += P.getY(i); ctr[k].z += P.getZ(i); n[k]++; yLo = Math.min(yLo, P.getY(i)); yHi = Math.max(yHi, P.getY(i)); } }
  if (!n.L || !n.R) return false;
  ctr.L.divideScalar(n.L); ctr.R.divideScalar(n.R); const eh = Math.max(.008, yHi - yLo);   // 目の高さ（黒目の高さ）
  const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  for (const m of ms) {
    const G = m.geometry, P = G.attributes.position, MA = G.morphAttributes.position, fi = m.morphTargetDictionary.Fcl_EYE_Fun, D = MA[fi];
    const lid = new Float32Array(P.count * 3), ck = new Float32Array(P.count * 3), skin = [].concat(m.material).some(mt => /face.*skin|skin.*face/i.test(mt.name));
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), c = x >= 0 ? ctr.L : ctr.R;
      const w = sst(c.y + .12 * eh, c.y - .18 * eh, y);   // 中心より下＝1、上＝0（あいだはなめらかに）
      if (w > 0) for (let a = 0; a < 3; a++) lid[i * 3 + a] = D.getComponent(i, a) * w;
      if (skin) {   // 頬の山：目の中心の少し外・黒目の高さ 1.6 個ぶん下
        const dx = (Math.abs(x) - Math.abs(c.x) * 1.08) / (eh * 1.05), dy = (y - (c.y - eh * 1.6)) / (eh * .95), g = Math.exp(-(dx * dx + dy * dy)) * sst(c.z - eh * 2.5, c.z - eh * .8, z);
        if (g > .01) { ck[i * 3 + 1] = .09 * eh * g; ck[i * 3 + 2] = .05 * eh * g; }
      }
    }
    const a1 = new THREE.Float32BufferAttribute(lid, 3), a2 = new THREE.Float32BufferAttribute(ck, 3); a1.name = "AoiLidLow"; a2.name = "AoiCheek";
    MA.push(a1, a2);
    if (G.morphAttributes.normal) { const N = G.morphAttributes.normal, nf = G.morphAttributes.normal[fi]; const ln = new Float32Array(P.count * 3); for (let i = 0; i < P.count; i++) { const c = P.getX(i) >= 0 ? ctr.L : ctr.R, w = sst(c.y + .12 * eh, c.y - .18 * eh, P.getY(i)); if (w > 0) for (let a = 0; a < 3; a++) ln[i * 3 + a] = nf.getComponent(i, a) * w; } N.push(new THREE.Float32BufferAttribute(ln, 3), new THREE.Float32BufferAttribute(new Float32Array(P.count * 3), 3)); }
    // v4：笑み（口）・眉を左右に分けた形（AoiSmileL/R・AoiBrowUpL/R・AoiBrowJoyL/R）。人の顔は左右で少し違う（左右対称すぎると不気味に見える）。
    // 真ん中の 6 mm でなめらかにつなぐ。L＋R＝もとの形（両方 1 なら左右対称のまま）
    for (const [src, dst] of [["Fcl_MTH_Fun", "AoiSmile"], ["Fcl_BRW_Surprised", "AoiBrowUp"], ["Fcl_BRW_Fun", "AoiBrowJoy"]]) {
      const si = m.morphTargetDictionary[src]; if (si == null) continue; const S0 = MA[si], SN = G.morphAttributes.normal?.[si];
      for (const side of [1, -1]) { const pa = new Float32Array(P.count * 3), na = SN ? new Float32Array(P.count * 3) : null;
        for (let i = 0; i < P.count; i++) { const w = sst(-.003, .003, side * P.getX(i)); if (w <= 0) continue; for (let a = 0; a < 3; a++) { pa[i * 3 + a] = S0.getComponent(i, a) * w; if (na) na[i * 3 + a] = SN.getComponent(i, a) * w; } }
        const at = new THREE.Float32BufferAttribute(pa, 3); at.name = dst + (side > 0 ? "L" : "R"); MA.push(at); if (G.morphAttributes.normal) G.morphAttributes.normal.push(new THREE.Float32BufferAttribute(na || new Float32Array(P.count * 3), 3)); } }
    if (skin) G.userData.aoiCheekG = (() => { const g = new Float32Array(P.count); for (let i = 0; i < P.count; i++) g[i] = Math.hypot(ck[i * 3 + 1], ck[i * 3 + 2]) / (.103 * eh); return g; })();   // 頬の色（下の addCheekTint）に使う重み 0..1
    const keep = m.morphTargetInfluences ? [...m.morphTargetInfluences] : []; m.updateMorphTargets(); keep.forEach((v, i) => m.morphTargetInfluences[i] = v);
  }
  return true;
}

// ---------------------------------------------------------------- 目の光（v4）
// 人の目の光（角膜に映る光）は、目が動いても黒目ほどは動かない（角膜のふくらみに映るため）。VRoid では光が黒目に貼りついて一緒に動き、
// 目を動かすたびに光も同じだけ動く＝絵に見える・目が乾いて見える。光の頂点の重みを「目の骨 55%・頭 45%」に分け、黒目の半分ほどしか動かないようにする。
export function softenEyeHighlight(vrm) {
  const H = vrm.humanoid, head = H?.getRawBoneNode("head"), eyes = new Set(["leftEye", "rightEye"].map(n => H?.getRawBoneNode(n)).filter(Boolean)); if (!head || !eyes.size) return 0; let n = 0;
  vrm.scene.traverse(o => { if (!o.isSkinnedMesh || o.userData.aoiHL || ![].concat(o.material).some(m => /highlight/i.test(m.name))) return;
    const sk = o.skeleton, hi = sk.bones.indexOf(head), ei = new Set(sk.bones.map((b, i) => eyes.has(b) ? i : -1).filter(i => i >= 0)); if (hi < 0 || !ei.size) return;
    const SI = o.geometry.attributes.skinIndex, SW = o.geometry.attributes.skinWeight;
    for (let i = 0; i < SI.count; i++) { let e = -1; for (let k = 0; k < 4; k++) if (SW.getComponent(i, k) > .99 && ei.has(SI.getComponent(i, k))) e = SI.getComponent(i, k); if (e < 0) continue;
      SI.setXYZW(i, e, hi, 0, 0); SW.setXYZW(i, .55, .45, 0, 0); n++; }
    SI.needsUpdate = SW.needsUpdate = true; o.userData.aoiHL = true; });
  return n;
}

// ---------------------------------------------------------------- 頬の色（v4）
// アニメ調の陰（MToon）では、頬の形を少しふくらませても陰が変わらず、笑みが頬に出ない（第 7 回の指摘）。
// そこで、頬のところだけ、肌の色にごく薄い暖色を「掛け合わせる」薄い面を重ねる（同じ骨・同じ顔の形で動く。光の強さに左右されない＝夜に光らない）。
// 頬紅のように描くのではなく、笑ったときに頬の血色が少し上がる程度（最大で肌の明るさが 5% ほど下がり、少し赤みが寄る）。.vrm はさわらない。
export function addCheekTint(vrm) {
  let face = null; vrm.scene.traverse(o => { if (!face && o.isSkinnedMesh && o.geometry.userData.aoiCheekG) face = o; });
  if (!face) return null;
  const G = face.geometry, g = G.userData.aoiCheekG, idx = G.index, mats = [].concat(face.material);
  const grp = G.groups.length ? G.groups.filter(gr => !/outline/i.test(mats[gr.materialIndex]?.name || "")) : [{ start: 0, count: idx ? idx.count : G.attributes.position.count }];
  const tri = []; for (const gr of grp) for (let i = gr.start; i < gr.start + gr.count; i += 3) { const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2; if (g[a] > .03 || g[b] > .03 || g[c] > .03) tri.push(a, b, c); }
  if (!tri.length) return null;
  const G2 = new THREE.BufferGeometry(); for (const k of ["position", "normal", "uv", "skinIndex", "skinWeight"]) if (G.attributes[k]) G2.setAttribute(k, G.attributes[k]);
  G2.setAttribute("aG", new THREE.Float32BufferAttribute(g, 1)); G2.setIndex(tri); G2.morphAttributes = G.morphAttributes; G2.morphTargetsRelative = G.morphTargetsRelative;
  G2.boundingSphere = G.boundingSphere?.clone() || null;
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .78, .74), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, fog: false, toneMapped: false });
  mat.name = "AoiCheekTint"; const uAmt = { value: 0 };   // 濃さは自前の値で持つ（アプリの「現れ方」が材質の opacity を書きかえても影響されない）
  mat.onBeforeCompile = sh => { sh.uniforms.uAmt = uAmt; sh.vertexShader = "attribute float aG;\nvarying float vG;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vG = aG;");
    sh.fragmentShader = "varying float vG;\nuniform float uAmt;\n" + sh.fragmentShader.replace("#include <dithering_fragment>", "#include <dithering_fragment>\n gl_FragColor = vec4(mix(vec3(1.0), diffuse, clamp(vG, 0.0, 1.0) * uAmt), 1.0);"); };
  const m = new THREE.SkinnedMesh(G2, mat); m.name = "AoiCheekTint"; m.userData.aoiOverlay = true; m.frustumCulled = false; m.renderOrder = (face.renderOrder || 0) + 1; m.castShadow = m.receiveShadow = false;
  m.morphTargetInfluences = face.morphTargetInfluences; m.morphTargetDictionary = face.morphTargetDictionary;   // 顔と同じ配列（顔が動けば頬の面も動く）
  face.parent.add(m); m.position.copy(face.position); m.quaternion.copy(face.quaternion); m.scale.copy(face.scale); m.bind(face.skeleton, face.bindMatrix);
  return { mesh: m, mat, face, set(v) { uAmt.value = clamp(v, 0, 1); mat.opacity = 1; m.visible = v > .004; if (m.material !== mat) m.material = mat; m.morphTargetInfluences = face.morphTargetInfluences; } };   // アプリが材質を差しかえても戻す
}

// ---------------------------------------------------------------- 本体
// 記録（モーションキャプチャ）を、どの骨にどれだけ使うか。首と頭は視線が主なので少し、手首は話す身ぶりと合わせて半分ほど
const MOCAP_W = { hips: .85, spine: .85, chest: .85, upperChest: .85, neck: .22, head: .15, leftShoulder: .7, rightShoulder: .7, leftUpperArm: .9, rightUpperArm: .9, leftLowerArm: .85, rightLowerArm: .85, leftHand: .55, rightHand: .55 };
// v4：立ち姿の記録ごとの効き（腕・胴）。140 の二本は手を体の前に出しがちなので、腕は休めの形へ半分ほど寄せ、胴の前かがみも少し控える
const IDLE_K = { "140_06": { arm: .4, torso: .7 }, "140_07": { arm: .45, torso: .75 } };
const TALK_BONES = ["spine", "chest", "upperChest", "neck", "leftShoulder", "rightShoulder"];
let _mocapShared = null;   // 同じページで何人分読んでも、記録は一度だけ読む
export class AoiMotion {
  constructor(vrm, { root = null, seed = 0, reducedMotion = false, wind = .6, faceViewer = true, startCalm = 2.2, mocap = "auto", robe = true, groundAt = null, posture = "natural" } = {}) {
    this.groundAt = groundAt;
    // 姿勢の型（v3.1・2026-10-13 本人「HPの碧はまっすぐ立っていてください。姿勢は良くしていながら、自然な仕草にしてください。」「碧左右に揺れすぎです。もう少し揺れを抑えて」）
    //  natural（既定）＝これまでの立ち姿・歩き。ただし左右の揺れ（重心の移し・骨盤の傾き・体の横揺れ・記録の胴の横の傾き・息の肩の傾き）は v3 の半分以下に抑えた。
    //  upright（"formal" も同じ）＝まっすぐ立つ。骨盤は水平・背は立てる・肩は少し引いて水平・手は脇に力を抜いて。重心の移し・揺れ・記録の胴の動きをさらに小さくし、
    //  息・まばたき・小さな視線の動き・小さく首をかしげる、だけを残す（HP の顔の碧）。
    this.posture = posture === "upright" || posture === "formal" ? "upright" : "natural";
    this.pz = this.posture === "upright"
      ? { ws: .3, sway: .4, lat: .2, mT: .15, mN: .1, mA: .35, mH: .15, tilt: .45, gest: .6, away: .45, chestUp: .02, shBack: .035 }
      : { ws: 1, sway: 1, lat: .25, mT: 1, mN: 1, mA: 1, mH: 1, tilt: 1, gest: 1, away: 1, chestUp: 0, shBack: 0 };   // (x, z) => 地面の高さ（世界）。坂・段のある場所で、足をその高さに着ける（なければ root の高さ＝平ら）
    this.vrm = vrm; this.root = root || vrm.scene; this.rand = seed ? rng(seed) : Math.random;
    this.live = !reducedMotion; this.wind = wind; this.faceViewer = faceViewer; this.t = 0; this.calm = startCalm;
    const H = vrm.humanoid; this.N = n => H.getNormalizedBoneNode(n);
    this.bones = {}; for (const n of ["hips", "spine", "chest", "upperChest", "neck", "head", "leftShoulder", "rightShoulder", "leftUpperArm", "rightUpperArm", "leftLowerArm", "rightLowerArm", "leftHand", "rightHand", "leftUpperLeg", "rightUpperLeg", "leftLowerLeg", "rightLowerLeg", "leftFoot", "rightFoot", "leftToes", "rightToes"]) this.bones[n] = this.N(n);
    this.fingers = []; for (const s of ["left", "right"]) for (const f of ["Index", "Middle", "Ring", "Little", "Thumb"]) for (const j of ["Metacarpal", "Proximal", "Intermediate", "Distal"]) { const b = this.N(s + f + j); if (b) this.fingers.push([b, s, f, j]); }
    // 静止の形を測る（足首の高さ・腰の高さ・脚の長さ・足の長さ）
    H.resetNormalizedPose(); this.root.updateMatrixWorld(true);
    const B = this.bones, wp = (o, v) => o.getWorldPosition(v), rootInv = _m.copy(this.root.matrixWorld).invert();
    const loc = o => wp(o, new THREE.Vector3()).applyMatrix4(rootInv);
    this.rest = { hips: loc(B.hips), L: { up: loc(B.leftUpperLeg), foot: loc(B.leftFoot), toe: B.leftToes ? loc(B.leftToes) : null }, R: { up: loc(B.rightUpperLeg), foot: loc(B.rightFoot), toe: B.rightToes ? loc(B.rightToes) : null } };
    this.rest.hip0 = B.hips.position.clone();
    this.ankleH = (this.rest.L.foot.y + this.rest.R.foot.y) / 2; this.halfW = Math.abs(this.rest.L.foot.x - this.rest.R.foot.x) / 2;
    this.legLen = this.rest.hips.y - this.ankleH; this.footLen = this.rest.L.toe ? Math.max(.06, this.rest.L.toe.z - this.rest.L.foot.z) : .12;
    this.toeDy = this.rest.L.toe ? Math.max(0, this.rest.L.foot.y - this.rest.L.toe.y) : .05;   // v4：足首とつま先の付け根の高さの差（かかとを上げるとき、つま先の付け根を軸にするため）
    this.scale = new THREE.Vector3(); this.root.getWorldScale(this.scale); this.sc = this.scale.x || 1; this.vs = vrm.scene.getWorldScale(new THREE.Vector3()).x || 1; this.hk = this.sc / this.vs;
    // 状態
    const r0 = this.root;
    this.pos = new THREE.Vector3(r0.position.x, r0.position.y, r0.position.z); this.vel = new THREE.Vector3(); this.goal = null; this.driven = false; this._last = this.pos.clone();
    this.yaw = r0.rotation.y; this.faceYaw = null; this.speed = 0; this.k = 0;
    this.feet = { L: this._foot(1), R: this._foot(-1) }; this.lastStep = "R"; this._placeFeet();
    this.s = { br: 0, brP: 4.2, brU: 0, ws: new Spr(0, 1.6), wsHold: 3 + 4 * this.rand(), wsLvl: 0, lean: new Spr(0, 3), talk: new Spr(0, 3.2), listen: new Spr(0, 2.5), gest: new Spr(0, 5), point: new Spr(0, 4.5), bow: new Spr(0, 3), tilt: new Spr(0, 2), nod: new Spr(0, 9), armL: new Spr(0, 3.2), armR: new Spr(0, 3.2), armLz: new Spr(0, 3.2), armRz: new Spr(0, 3.2), beat: 0, beatSide: 1, hipY: new Spr(0, 7), turnLead: new Spr(0, 5) };
    this.seedPh = this.rand() * 100;
    // 目・頭
    this.gazeObj = new THREE.Object3D(); if (vrm.lookAt) vrm.lookAt.target = this.gazeObj;   // 親を持たない（位置＝世界の座標。場面の固定化の影響を受けない）
    this.look = { target: null, cur: new THREE.Vector3(0, 1.5, 3), sac: new THREE.Vector3(), sacT: .5, away: 0, awayDir: new THREE.Vector3(), awayT: 4 + 4 * this.rand(), hy: new Spr(0, 7), hp: new Spr(0, 7), last: new THREE.Vector3() };
    this.blink = { next: 1.5 + this.rand() * 2, t: -1, amp: 1, dbl: 0, v: 0 };
    // 表情
    this.face = { emo: "calm", emoW: new Spr(1, 3), hold: 0, ch: {}, mouth: Object.fromEntries(MOUTH.map(k => [k, new Spr(0, 26)])), spk: null, flash: 0 };
    try { addFaceMorphs(vrm); } catch (e) { console.warn("addFaceMorphs", e); }
    try { softenEyeHighlight(vrm); } catch (e) { console.warn("softenEyeHighlight", e); }
    this._initFace();
    // 揺れもの
    this.springs = (vrm.springBoneManager?.joints ? [...vrm.springBoneManager.joints] : []).map(j => ({ j, g: j.settings.gravityDir.clone(), p: j.settings.gravityPower }));
    // v3：体がいつも少し動く（人の記録）ので、髪が揺れ続けて顔にかからないよう、髪の戻る力と空気の抵抗を少し強める（.vrm はさわらない）
    for (const s of this.springs) if (/hair/i.test(s.j.bone?.name || "")) { s.j.settings.stiffness *= 1.5; s.j.settings.dragForce = Math.max(s.j.settings.dragForce, .6); }
    this.pointing = null; this.bowing = null; this.listening = false; this.speaking = null;
    // ローブの裾（v3）
    this.robe = null; if (robe) { try { const r = new AoiRobe(vrm, { wind: wind * .7 }); if (r.ok) this.robe = r; } catch (e) { console.warn("AoiRobe", e); } }
    this._robeReset = true;
    // 人が動いた記録（v3）
    this.mc = null; this.mcW = new Spr(0, 1.2); this._mq = {}; this._mp = new THREE.Vector3(); this._mt = {}; this._phi = 0;
    this.mi = { cur: "idle_a", t: 0, prev: null, pt: 0, x: 1 };
    const use = lib => { if (lib?.clips) { this.mc = lib; const ids = Object.keys(lib.clips).filter(k => lib.clips[k].type === "idle"); this.mi.cur = ids[Math.floor(this.rand() * ids.length)] || ids[0]; this.mi.t = this.rand() * (lib.clips[this.mi.cur]?.sec || 1); } };
    this.mcReady = Promise.resolve(null);   // 記録を読み終えたら解ける（確かめの台で待つため）
    if (mocap && typeof mocap === "object") use(mocap.clips && mocap.bones && mocap.idx ? mocap : decodeMocap(mocap));
    else if (mocap) { const url = mocap === "auto" ? new URL("./aoi_mocap.json", import.meta.url).href : mocap;
      (_mocapShared ||= {})[url] ||= loadMocap(url).catch(e => { console.warn("aoi_mocap", e.message || e); return null; });
      this.mcReady = _mocapShared[url].then(lib => { use(lib); return lib; }); }
  }
  _foot(side) { return { side, p: new THREE.Vector3(), yaw: 0, swing: null, heel: 0 }; }
  _home(f, out, lead = 0) {   // その足の置き場所（体の向き・左右の幅・少し外へ開いたつま先）
    const sx = f.side * this.halfW * this.sc * 1.05, c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    const x = this.pos.x + sx * c + this.vel.x * lead, z = this.pos.z - sx * s + this.vel.z * lead;
    out.set(x, (this.groundAt ? this.groundAt(x, z) : this.pos.y) + this.ankleH * this.sc, z);
    return out;
  }
  _placeFeet() { for (const f of Object.values(this.feet)) { this._home(f, f.p); f.yaw = this.yaw + f.side * .1; f.swing = null; } }
  _initFace() {
    const em = this.vrm.expressionManager; this.morph = []; if (!em) return;
    const meshes = []; this.vrm.scene.traverse(o => { if (o.isMesh && o.morphTargetDictionary && (o.morphTargetDictionary.Fcl_MTH_A != null || o.morphTargetDictionary.Fcl_EYE_Fun != null)) meshes.push(o); });
    for (const [ch, list] of Object.entries(CH)) {
      const find = l => { const b = []; for (const [name, w, sd] of l) for (const m of meshes) { const i = m.morphTargetDictionary?.[name]; if (i != null) b.push([m, i, w, sd || 0]); } return b; };
      let binds = find(list); if (!binds.length && CH_FB[ch]) binds = find(CH_FB[ch]);
      this.face.ch[ch] = { v: new Spr(0, 6), binds };
    }
    // v4：左右の差（笑みは片側が少し強い人が多い。いつもの側＋そのたびの揺らぎ）・頬の色
    this.face.side = (this.rand() < .5 ? 1 : -1) * (.06 + .06 * this.rand()); this.face.asym = new Spr(this.face.side, 1.5); this.face.asymT = 2 + 4 * this.rand();
    try { this.tint = addCheekTint(this.vrm); } catch (e) { console.warn("addCheekTint", e); this.tint = null; }
  }

  // ---------------------------------------------------------------- 外から呼ぶ
  place(x, z, yaw = this.yaw) { this.pos.set(x, this.root.position.y, z); this.vel.set(0, 0, 0); this.goal = null; this.yaw = yaw; this.faceYaw = null; this._last.copy(this.pos); this._apply(); this._placeFeet(); this._robeReset = true; return this; }
  walkTo(v) { this.goal = v ? new THREE.Vector3(v.x, this.pos.y, v.z) : null; this.driven = false; return this; }
  drive(x, z) { this.driven = true; this.goal = null; this.pos.x = x; this.pos.z = z; return this; }
  faceTo(yaw) { this.faceYaw = yaw; return this; }
  lookAt(t) { this.look.target = t || null; return this; }
  express(name, w = 1, sec = 2.5) { if (!EMOTIONS[name]) return this; this.face.emo = name; this.face.emoW.t = clamp(w, 0, 1.2); this.face.hold = sec; return this; }
  listen(on = true) { this.listening = !!on; if (on) this.express("warm", .8, 1e9); else this.express("calm", 1, 0); return this; }
  speak({ timeline = null, kana = "", text = "", dur = 3, clock = null, level = null } = {}) {
    const tl = timeline || (kana ? timelineFromKana(kana, dur) : timelineFromText(text, dur)); const t0 = this.t;
    this.speaking = { tl, clock: clock || (() => this.t - t0), level, i: 0, bi: 0, nb: 0, pi: 0, dur: tl.d || dur, startAway: this.rand() < .55 };
    this.listening = false; this.blink.next = Math.min(this.blink.next, .25 + this.rand() * .4);
    if (this.rand() < .6) this.face.flash = .45;   // 話しはじめに眉が小さく上がる
    if (this.face.emo === "calm" || this.face.hold <= 0) this.express("warm", .9, (tl.d || dur) + 1);
    return this;
  }
  stopSpeaking() { this.speaking = null; return this; }
  point(v, sec = 2.6) { this.pointing = { p: v.clone ? v.clone() : new THREE.Vector3(v.x, v.y, v.z), t: 0, sec, side: 0 }; return this; }
  bow(kind = "eshaku") { const deg = kind === "keirei" ? 30 : kind === "saikeirei" ? 45 : 15; this.bowing = { a: deg * Math.PI / 180, t: 0, down: deg > 20 ? 1.15 : .8, hold: deg > 20 ? .8 : .45, up: deg > 20 ? 1.6 : 1.1 }; return this; }
  get busy() { return !!(this.speaking || this.pointing || this.bowing); }
  debug() { const f = this.feet; return `速さ ${this.speed.toFixed(2)}  足 L${f.L.swing ? "↑" : "_"} R${f.R.swing ? "↑" : "_"}  重心 ${this.s.ws.v.toFixed(2)}  ${this.speaking ? "話す" : this.listening ? "聞く" : ""}${this.bowing ? " 礼" : ""}${this.pointing ? " 指す" : ""}`; }

  // ---------------------------------------------------------------- 毎こま
  update(dt, camera, { vrmUpdate = true } = {}) {
    dt = Math.min(dt, .05); if (dt <= 0) return; this.t += dt; const S = this.s;
    this._locomotion(dt, camera);
    this._apply();
    const cam = camera ? camera.getWorldPosition(this._cam || (this._cam = new THREE.Vector3())) : null;
    this._body(dt);
    this.root.updateMatrixWorld(true);
    this._legs(dt);
    this._arms(dt);
    this._headEyes(dt, cam);
    this._faceTick(dt);
    if (this.springs.length && this.live && this.calm <= 0 && this.wind) { const t = this.t, a = this.wind; for (const s of this.springs) { s.j.settings.gravityDir.set(s.g.x + .18 * a * Math.sin(t * .63 + s.g.y), s.g.y, s.g.z + .1 * a * Math.sin(t * .41)).normalize(); s.j.settings.gravityPower = Math.max(s.p, .05); } }
    if (vrmUpdate) { this.vrm.update(dt); this.afterVrmUpdate(dt); }
    if (this.calm > 0) { this.calm -= dt; this.vrm.springBoneManager?.setInitState?.(); this.vrm.springBoneManager?.reset?.(); this._robeReset = true; }
  }
  // { vrmUpdate:false } で vrm.update をアプリが呼ぶときは、そのあとでこれを呼ぶ（裾の布）
  afterVrmUpdate(dt) {
    if (!this.robe) return;
    if (this._robeReset) { this.robe.reset(); this._robeReset = false; }   // 揺れを止めて静止の形へ（そのあと脚との当たりだけは直す）
    this.robe.update(dt, { groundY: this.groundAt ? this.groundAt(this.pos.x, this.pos.z) : this.root.getWorldPosition(_v[9]).y, live: this.live });
  }
  _apply() { if (this.groundAt) { const F = this.feet, g = this.groundAt(this.pos.x, this.pos.z), gl = F ? Math.min(F.L.p.y, F.R.p.y) - this.ankleH * this.sc : g; this.pos.y = Math.min(g, gl + .02 * this.sc); }   // 坂では低いほうの足に合わせて腰を下げる（脚が伸びきらない）
    this.root.position.set(this.pos.x, this.pos.y, this.pos.z); this.root.rotation.y = this.yaw; }

  _locomotion(dt, camera) {
    const P = this.pos;
    if (this.goal && !this.driven) {   // ばねで目標へ（歩き出しはゆっくり、着く前にゆるめる）
      const w = 2.6, n = Math.max(1, Math.ceil(dt / .02)), h = dt / n;
      for (let i = 0; i < n; i++) { this.vel.x += (w * w * (this.goal.x - P.x) - 2 * w * this.vel.x) * h; this.vel.z += (w * w * (this.goal.z - P.z) - 2 * w * this.vel.z) * h; const m = Math.hypot(this.vel.x, this.vel.z); if (m > .85) this.vel.multiplyScalar(.85 / m); P.x += this.vel.x * h; P.z += this.vel.z * h; }
      if (P.distanceTo(this.goal) < .03 && this.vel.length() < .05) { this.goal = null; this.vel.set(0, 0, 0); }
    } else if (this.driven) {
      const vx = (P.x - this._last.x) / dt, vz = (P.z - this._last.z) / dt, a = 1 - Math.exp(-10 * dt);
      this.vel.x += (vx - this.vel.x) * a; this.vel.z += (vz - this.vel.z) * a;
    } else this.vel.multiplyScalar(Math.exp(-8 * dt));
    if (Math.hypot(P.x - this._last.x, P.z - this._last.z) > 1.6) { this._last.copy(P); this._apply(); this._placeFeet(); this._robeReset = true; }   // とんだときは足をそろえ直す
    this._last.copy(P);
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    const kT = clamp((this.speed - .12) / .6, 0, 1); this.k += (kT - this.k) * (1 - Math.exp(-4 * dt));
    // 向き：歩くときは進む方へ、止まっているときは決めた向きか見る人の方へ（大きく違うときだけ。足を踏みかえて向く）
    let want = this.yaw;
    if (this.speed > .25) want = Math.atan2(this.vel.x, this.vel.z);
    else if (this.faceYaw != null) want = this.faceYaw;
    else if (this.pointing) want = Math.atan2(this.pointing.p.x - P.x, this.pointing.p.z - P.z) * .5 + this._toCam(camera) * .5;
    else if (this.faceViewer && camera) { const tc = this._toCam(camera); if (Math.abs(wrapA(tc - this.yaw)) > .5 || this.speaking || this.listening) want = tc; }
    const d = wrapA(want - this.yaw), rate = this.speed > .25 ? 2.6 : 1.5;
    this.yaw += clamp(d * (1 - Math.exp(-3.2 * dt)), -rate * dt, rate * dt);
    this.s.turnLead.t = clamp(d, -.9, .9); this.s.turnLead.step(dt);
  }
  _toCam(camera) { const c = camera.getWorldPosition(_v[8]); return Math.atan2(c.x - this.pos.x, c.z - this.pos.z); }

  // 姿勢の層（息・重心・揺れ・お辞儀・話す・聞く）を、骨の回転に重ねる
  _body(dt) {
    const S = this.s, B = this.bones, t = this.t, L = this.live, k = this.k, sp = this.seedPh;
    // 息：一回ごとに長さを少し変える。吸う 4 割・吐く 6 割
    if (L) { S.brU += dt / S.brP; if (S.brU >= 1) { S.brU -= 1; S.brP = (this.speaking ? 3.2 : 4.2) * (.85 + .3 * this.rand()); } }
    const u = S.brU, br = L ? (u < .4 ? sstep(u / .4) : 1 - sstep((u - .4) / .6)) : 0;
    // 重心：数秒〜十数秒ごとに、片足へ（体重の移し）。歩くときと、指す・礼のときは真ん中へ
    // v3.1：重心を移す量は v3 の 45%（左右の揺れを抑える）。upright ではさらに 3 割
    if (L) { S.wsHold -= dt; if (S.wsHold <= 0) { const r = this.rand(); S.wsLvl = r < .15 ? 0 : (S.wsLvl > 0 ? -1 : 1) * (.55 + .45 * this.rand()) * .45; S.wsHold = 5 + 9 * this.rand(); } }
    S.ws.t = (this.bowing || this.pointing) ? 0 : S.wsLvl * (1 - k) * this.pz.ws; S.ws.step(dt); const ws = S.ws.v;
    const swX = L ? .45 * this.pz.sway * wob(t * .9, sp) : 0, swZ = L ? this.pz.sway * wob(t * .7, sp + 5) : 0;   // 静かに立つときの小さな揺れ（前後に数 mm・左右はその半分以下）
    // お辞儀
    let bw = 0; const bo = this.bowing; if (bo) { bo.t += dt; const a = bo.t, d1 = bo.down, d2 = d1 + bo.hold, d3 = d2 + bo.up; bw = a < d1 ? sstep(a / d1) : a < d2 ? 1 : a < d3 ? 1 - sstep((a - d2) / bo.up) : 0; if (a >= d3) this.bowing = null; }
    const bA = bo ? bo.a * bw : 0; this._bowA = bA;
    S.talk.t = this.speaking ? 1 : 0; S.talk.step(dt); S.listen.t = this.listening ? 1 : 0; S.listen.step(dt);
    const tk = S.talk.v * (L ? 1 : 0), ls = S.listen.v * (L ? 1 : 0);
    // 歩く：骨盤の回り・傾き、胸は逆にひねる（足の位置から）
    const g = this._gait || { u: 0, side: 0, ph: 0 }, gs = .5 * g.side * Math.sin(Math.PI * g.u) * k;   // 歩くときの骨盤の横の傾き（v3.1 で半分）
    // 人が動いた記録（立つ・歩く・話す）を、骨ごとの土台にする（mw＝記録の効き。読めていないときは 0＝これまでの動きだけ）
    const mw = this._mocapPose(dt, k, tk);
    // 各骨：base＝立ち姿・歩きの土台（記録があれば記録に置きかわる）、act＝その上に重ねる動き（息・礼・話す・聞く・首をかしげる）
    this._pose = {}; this._poseB = {};
    const P = (n, b, a) => { this._poseB[n] = b; this._pose[n] = a; };
    const leanB = .05 * k, leanA = .02 * tk + .025 * ls, bt = this._beat || 0;
    P("hips", [.02 * k, -.12 * g.ph * k, .055 * ws - .035 * gs], [bA * .7, S.turnLead.v * .2, 0]);
    P("spine", [leanB * .4 + .004 * swZ, .07 * g.ph * k, -.05 * ws + .02 * gs], [leanA * .4 + bA * .1 + .008 * br + .015 * bt, S.turnLead.v * .15, 0]);
    P("chest", [leanB * .3, .06 * g.ph * k, -.025 * ws + .012 * gs], [leanA * .3 + bA * .05 - .018 * br, S.turnLead.v * .12, 0]);
    const cu = this.pz.chestUp, sb = this.pz.shBack;   // upright：胸を少し起こし（首と頭で戻して目線は水平）、肩を少し後ろへ引く
    P("upperChest", [leanB * .2 - cu, .02 * g.ph * k, -.01 * ws], [leanA * .2 - .012 * br, 0, 0]);
    P("leftShoulder", [0, sb, .01 * ws], [0, 0, .006 * br]); P("rightShoulder", [0, -sb, .01 * ws], [0, 0, -.006 * br]);   // 息で肩が上がる（v3.1 で半分＝左右に傾いて見えない）
    // 頭の位置（首から上）は、見る先へ向ける前の基本の形。首・頭は胴の傾きを半分ほど打ち消す（目線を水平に保つ）
    const tilt = this._tilt(dt, ls);
    P("neck", [-leanB * .3 + cu * .5, 0, .025 * ws], [-.06 * bA + .01 * br - leanA * .3, 0, tilt * .4]);
    P("head", [.02 * k - leanB * .3 + cu * .5, 0, .02 * ws], [-.04 * bA - leanA * .3 + S.nod.step(dt), 0, tilt * .6]); this._tiltA = tilt;
    // 腰の位置：重心の側へ寄る・前後の揺れ・礼では後ろへ引く・歩くとき少し沈み、片足立ちの真ん中で高くなる
    S.hipY.t = -.024 * k + .02 * k * Math.sin(Math.PI * g.u) * (1 - mw) - .006 * Math.abs(ws) * (1 - mw) - .004 * br * (1 - k) - .06 * Math.sin(bA);   /* 礼では膝を少しゆるめる */ S.hipY.step(dt);
    const L0 = this.legLen / this.sc, mp = this._mp;   // 記録の腰の揺れ（脚の長さに対する比）→ 碧の長さへ。腰が左右に寄りすぎないよう少し控える
    const mh = this.pz.mH;   // 記録の腰の横の揺れは v3 の 4 割（左右の揺れを抑える）。upright ではさらに小さく
    this._hipOff = [(.03 * ws + .004 * swX - .02 * gs) * (1 - mw) + mp.x * L0 * .11 * mh * mw, S.hipY.v + mp.y * L0 * .6 * mw, (.005 * swZ) * (1 - mw) + mp.z * L0 * .3 * mh * mw - .07 * Math.sin(bA)];
    this._ws = ws; this._br = br; this._tk = tk; this._ls = ls; this._bw = bw;
    // 骨へ：土台（手続きの形と記録を、記録の効きで混ぜる）× 重ねる動き
    const hips = B.hips; if (hips) { const h0 = this.rest.hip0; hips.position.set(h0.x + this._hipOff[0] * this.hk, h0.y + this._hipOff[1] * this.hk, h0.z + this._hipOff[2] * this.hk); }
    for (const [n, a] of Object.entries(this._pose)) { const b = B[n]; if (!b) continue; const base = this._poseB[n];
      b.quaternion.setFromEuler(_e.set(base[0], base[1], base[2]));
      const it = (n === "hips" || n === "spine" || n === "chest" || n === "upperChest") ? 1 + ((this._idleTorso ?? 1) - 1) * (1 - this.k) : 1, w = mw * (MOCAP_W[n] || 0) * this._ms(n) * (1 - .6 * bw) * it; if (w > 1e-3 && this._mq[n]) b.quaternion.slerp(this._latQ(n, this._mq[n]), w);
      b.quaternion.multiply(_q[5].setFromEuler(_e.set(a[0], a[1], a[2]))); }
  }
  // 記録をどれだけ効かせるか（姿勢の型ごと）：胴＝mT・首と頭＝mN・肩と腕＝mA
  _ms(n) { const p = this.pz; return n === "hips" || n === "spine" || n === "chest" || n === "upperChest" ? p.mT : n === "neck" || n === "head" ? p.mN : p.mA; }
  // 記録の胴の「横の傾き」（体の前後の軸まわり＝左右に揺れて見える成分）だけを小さくする（v3.1：既定 35%・upright 20%）。前後・ねじれはそのまま
  _latQ(n, q) { if (!(n === "hips" || n === "spine" || n === "chest" || n === "upperChest" || n === "neck" || n === "leftShoulder" || n === "rightShoulder")) return q;
    const e = _e.setFromQuaternion(q, "YXZ"); e.z *= this.pz.lat; return (this._lq ||= {})[n] = ((this._lq[n]) || new THREE.Quaternion()).setFromEuler(e); }
  // 記録のこまを取り出す：立つ（二つの記録を、終わるたびに 1 秒かけて入れかえる）・歩く（足の運びの位相）・話す（胴と首）
  _mocapPose(dt, k, tk) {
    const lib = this.mc; this.mcW.t = lib && this.live ? 1 : 0; const mw = this.mcW.step(dt); if (!lib || mw < 1e-3) return 0;
    const C = lib.clips, mi = this.mi, Q = this._mq, T = this._mt;
    // 立つ
    const durOf = id => C[id]?.sec || 1;
    // v4：立ち姿の記録は 4 本×左右＝8 通り。次の記録は、いまと直前を除いてくじで選び、2.4 秒かけて入れかえる（入れかえの最中に、もとの記録は終わらせない）
    const XF = 2.4;
    mi.t += dt * (mi.rate || 1); if (mi.prev) { mi.pt += dt * (mi.prate || 1); mi.x = Math.min(1, mi.x + dt / XF); if (mi.x >= 1) mi.prev = null; }
    if (!mi.prev && mi.t > durOf(mi.cur) - XF - .1) { const ids = Object.keys(C).filter(k2 => C[k2].type === "idle"); let pool = ids.filter(k2 => k2 !== mi.cur && k2 !== mi.last && k2.replace(/_m$/, "") !== mi.cur.replace(/_m$/, "")); if (!pool.length) pool = ids.filter(k2 => k2 !== mi.cur); if (!pool.length) pool = ids;
      const nx = pool[Math.floor(this.rand() * pool.length)]; mi.last = mi.cur; mi.prev = mi.cur; mi.pt = mi.t; mi.prate = mi.rate || 1; mi.cur = nx; mi.t = this.rand() * Math.max(.1, durOf(nx) - XF - 3); mi.x = 0; mi.rate = .85 + .25 * this.rand(); }   /* 速さと始まりも毎回すこし変える（同じ記録のくり返しに見せない） */
    sampleClip(lib, C[mi.cur], mi.t / durOf(mi.cur), Q, this._mp);
    { const kc = IDLE_K[C[mi.cur]?.src] || {}, kp = mi.prev ? IDLE_K[C[mi.prev]?.src] || {} : kc, x = mi.prev ? sstep(mi.x) : 1;
      this._idleArm = (kc.arm ?? 1) * x + (kp.arm ?? 1) * (1 - x); this._idleTorso = (kc.torso ?? 1) * x + (kp.torso ?? 1) * (1 - x); }
    if (mi.prev) { const x = sstep(mi.x); sampleClip(lib, C[mi.prev], mi.pt / durOf(mi.prev), T, _v[8]); for (const n in Q) Q[n].slerp(T[n], 1 - x); this._mp.lerp(_v[8], 1 - x); }   // 前の記録→いまの記録
    // 話す：胴と首だけ（手は、この部品の話す身ぶり）
    if (tk > .01 && C.talk_a) { mi.tt = (mi.tt ?? this.rand() * 5) + dt; sampleClip(lib, C.talk_a, mi.tt / C.talk_a.sec, T); for (const n of TALK_BONES) if (T[n]) Q[n].slerp(T[n], .6 * tk); }
    // 歩く：足の運びの位相（0＝左が着く・0.5＝右が着く）
    if (k > .01 && C.walk_a) { sampleClip(lib, C.walk_a, this._phi, T, _v[8]); for (const n in Q) if (T[n]) Q[n].slerp(T[n], k); this._mp.lerp(_v[8], k); }
    return mw;
  }

  _tilt(dt, ls) {   // 首をかしげる（聞くとき多く、ふだんは 20〜40 秒に一度）
    const S = this.s; if (!this.live) return 0;
    S._tl = (S._tl ?? 8) - dt * (1 + 2 * ls);
    if (S._tl <= 0) { S._tl = 18 + 20 * this.rand(); S.tilt.t = (this.rand() < .5 ? 1 : -1) * (.05 + .06 * this.rand()) * this.pz.tilt; S._tlHold = 1.8 + 2.5 * this.rand(); }
    if (S._tlHold != null) { S._tlHold -= dt; if (S._tlHold <= 0) { S.tilt.t = ls > .5 ? .03 : 0; S._tlHold = null; } }
    if (ls > .5 && this.rand() < dt * .25) S.nod.d += 2.2;   // 聞くときの小さなうなずき（数秒に一度）
    return S.tilt.step(dt);
  }

  // ---------------------------------------------------------------- 足：着いた足は動かさず、離れすぎたら一歩ずつ踏みかえる＋二関節の IK
  _legs(dt) {
    const F = this.feet, k = this.k, moving = this.speed > .15;
    // 踏みかえの判断
    const home = _v[0];
    // 歩く：片足を振る 0.38〜0.44 秒＋両足が着いている 0.1 秒（1 秒に 2 歩ほど・歩幅は身長の 4 割ほど）。着く足は、体より半歩先へ
    // v4：歩く調子（1 秒の歩数）を速さに合わせる（人は速いほど歩数も歩幅も増える。秒速 0.85 m で約 1.75 歩・歩幅 0.49 m、1.3 m で約 1.9 歩）。
    // 一歩＝振る 8 割＋両足が着いている 2 割（歩きの一周期の 4 割が振り・1 割ずつ両足）。小さな碧に合わせ、身長の比で少し縮める
    const cad = clamp(1.42 + .38 * this.speed / Math.max(.5, this.sc), 1.5, 2.1), Tst = 1 / cad;
    const swingT = moving ? .78 * Tst : .5, ds = moving ? .22 * Tst : .07, landLead = moving ? .5 * Tst : 0;
    const swinging = F.L.swing || F.R.swing; this._ds = (this._ds || 0) - dt;
    if (!swinging && this._ds <= 0) {
      let best = null, bestE = 0;
      for (const key of ["L", "R"]) { const f = F[key]; this._home(f, home, moving ? swingT + landLead : 0); const e = Math.hypot(home.x - f.p.x, home.z - f.p.z), ye = Math.abs(wrapA(this.yaw + f.side * .1 - f.yaw)); const sc = e + ye * .25 + (key === this.lastStep ? -.04 : 0); if (sc > bestE) { bestE = sc; best = key; } }
      const th = moving ? .1 : .16;
      if (best && bestE > th) { const f = F[best]; f.swing = { from: f.p.clone(), fy: f.yaw, u: 0, T: swingT }; this.lastStep = best; }
    }
    let gait = { u: 0, side: 0, ph: 0 };
    for (const key of ["L", "R"]) {
      const f = F[key], sw = f.swing; if (!sw) continue;
      sw.u += dt / sw.T; const u = clamp(sw.u, 0, 1);
      this._home(f, home, moving ? (1 - u) * sw.T + landLead : 0);
      // 着く場所は振り出しの 7 割までに決め、横の動きは 85% で終える（下ろすあいだは横に動かさない＝着いてからすべらない）
      if (u < .7 || !sw.to) sw.to = (sw.to || new THREE.Vector3()).copy(home);
      const e = sstep(u / .85), to = sw.to; f.p.x = sw.from.x + (to.x - sw.from.x) * e; f.p.z = sw.from.z + (to.z - sw.from.z) * e;
      const lift = (moving ? .05 : .03) * this.sc * Math.pow(Math.sin(Math.PI * u), .7);   // すぐ地面から離れ、着く直前に下りる
      f.p.y = home.y + lift; f.yaw = sw.fy + wrapA(this.yaw + f.side * .1 - sw.fy) * e;
      // v4：かかとから着く。振り出しはつま先が下（けり出しの続き）→ 半ばで水平 → 着く前につま先を 10° ほど上げる。着いたあとは、かかとを軸につま先を下ろす（下の roll）
      f.pitch = moving ? (.22 * Math.sin(Math.PI * clamp(u / .45, 0, 1)) * (1 - u) - .17 * sstep((u - .55) / .4)) : .12 * Math.sin(Math.PI * u);
      gait = { u, side: f.side, ph: f.side * (2 * u - 1) };
      if (sw.u >= 1) { f.swing = null; f.p.x = sw.to.x; f.p.z = sw.to.z; f.p.y = home.y; f.roll = moving ? f.pitch : 0; f.rollT = 0; f.pitch = 0; this._ds = moving ? ds : .15; }
    }
    this._gait = gait;
    // 歩きの位相（記録の歩きと合わせる）：0＝左が着く・0.5＝右が着く。両足が着いているあいだは、次の振り出しへ向けてゆっくり進める
    { const dS = .08; let want;
      if (gait.side > 0) want = .5 + dS + (.5 - dS) * gait.u; else if (gait.side < 0) want = dS + (.5 - dS) * gait.u; else want = this._phi + dt * .35;
      const d = ((want - this._phi + 1.5) % 1) - .5; this._phi = (this._phi + d * (1 - Math.exp(-25 * dt)) + 1) % 1; }
    // 二関節の IK
    const tg = this._tg ||= { L: new THREE.Vector3(), R: new THREE.Vector3() }, pit = this._pit ||= {};
    for (const key of ["L", "R"]) {
      const f = F[key];
      // 後ろに残った足は、かかとから上がる（つま先を軸に）
      let heel = 0; if (!f.swing && moving) { const fw = _v[1].set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); const behind = -((f.p.x - this.pos.x) * fw.x + (f.p.z - this.pos.z) * fw.z); heel = clamp((behind - .12 * this.sc) * 1.6 / this.sc, 0, .25) * k; /* 長い裾をけり上げないよう、かかとの上がりは小さめ */ }
      f.heel += (heel - f.heel) * (1 - Math.exp(-14 * dt));
      // v4：着いたあとの「かかとを軸につま先を下ろす」（0.12 秒）
      if (!f.swing && f.roll) { f.rollT += dt; f.rollV = f.roll * (1 - sstep(f.rollT / .12)); if (f.rollT >= .12) { f.roll = 0; f.rollV = 0; } } else if (!f.swing) f.rollV = 0;
      const tgt = tg[key].copy(f.p), toeUp = f.swing ? Math.min(0, f.pitch) : (f.rollV || 0), pitch = (f.swing ? f.pitch : toeUp) + f.heel;
      const fl = this.footLen * this.sc, cy = Math.cos(f.yaw), sy = Math.sin(f.yaw);
      if (f.heel > 1e-3) { const h = f.heel, dy = this.toeDy * this.sc, fz = fl * (1 - Math.cos(h)) + dy * Math.sin(h); tgt.x += sy * fz; tgt.z += cy * fz; tgt.y += fl * Math.sin(h) + dy * (Math.cos(h) - 1); }   // つま先の付け根を軸に回す（v4：高さの差も入れた＝つま先が後ろへずれない）
      if (toeUp < -1e-3) { const a = -toeUp, hd = .22 * fl, ah = this.ankleH * this.sc;   // つま先を上げるときは、かかとを軸に（足首は少し上がり、少し後ろへ）
        tgt.y += ah * (Math.cos(a) - 1) + hd * Math.sin(a); const dz = hd * (Math.cos(a) - 1) - ah * Math.sin(a); tgt.x += sy * dz; tgt.z += cy * dz; }
      pit[key] = pitch;
    }
    // v4：足が届かないときは腰を下げる（脚が伸びきって、着いた足が引きずられる＝すべるのを防ぐ）。両足とも届く高さまで、その場で
    { const B = this.bones, hips = B.hips; let drop = 0;
      for (const key of ["L", "R"]) { const s = key === "L" ? "left" : "right", up = B[s + "UpperLeg"], lo = B[s + "LowerLeg"], ft = B[s + "Foot"]; if (!up || !lo || !ft) continue;
        const A = up.getWorldPosition(_v[3]), T = tg[key], Lm = (lo.position.length() + ft.position.length()) * this.vs * .985, h2 = (A.x - T.x) ** 2 + (A.z - T.z) ** 2;
        const vy = A.y - T.y, need = h2 < Lm * Lm ? Math.sqrt(Lm * Lm - h2) : 0; if (vy > need) drop = Math.max(drop, vy - need); }
      this._drop = Math.max(drop, (this._drop || 0) * Math.exp(-10 * dt));   // 下げるのはすぐ・戻すのはなめらかに（腰が跳ねない）
      if (hips && this._drop > 1e-5) hips.position.y -= this._drop / this.vs; }   // 世界の行列は、下の IK が太ももの親（腰）から順に取り直す（全身の更新はしない＝軽い）
    for (const key of ["L", "R"]) this._ik(key === "L" ? "left" : "right", tg[key], F[key].yaw, pit[key]);
  }
  _ik(s, T, footYaw, footPitch) {
    const up = this.bones[s + "UpperLeg"], lo = this.bones[s + "LowerLeg"], ft = this.bones[s + "Foot"]; if (!up || !lo || !ft) return;
    up.parent.updateWorldMatrix(true, false);
    const A = up.getWorldPosition(_v[3]), sc = this.sc, l1 = lo.position.length() * this.vs, l2 = ft.position.length() * this.vs;
    const AT = _v[4].subVectors(T, A); let d = AT.length(); const dir = AT.divideScalar(d || 1);
    d = clamp(d, Math.abs(l1 - l2) + 1e-4, (l1 + l2) * .9995);
    const ca = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
    // 膝の向き：体の前と、足の向きのあいだ
    const pole = _v[5].set(Math.sin(footYaw) + Math.sin(this.yaw), 0, Math.cos(footYaw) + Math.cos(this.yaw)).normalize();
    pole.addScaledVector(dir, -pole.dot(dir)).normalize();
    const K = _v[6].copy(A).addScaledVector(dir, l1 * ca).addScaledVector(pole, l1 * sa);
    const Tc = _v[7].copy(A).addScaledVector(dir, d);
    // 太もも
    const pq = up.parent.getWorldQuaternion(_q[0]), pqi = _q[1].copy(pq).invert();
    const w1 = _v[8].subVectors(K, A).normalize().applyQuaternion(pqi);
    const q1 = _q[2].setFromUnitVectors(_v[9].copy(lo.position).normalize(), w1);
    // ねじれ：膝のお皿が pole を向くように
    const fwdL = _v[3].set(0, 0, 1).applyQuaternion(q1), pl = _v[4].copy(pole).applyQuaternion(pqi);
    fwdL.addScaledVector(w1, -fwdL.dot(w1)); pl.addScaledVector(w1, -pl.dot(w1));
    if (fwdL.lengthSq() > 1e-6 && pl.lengthSq() > 1e-6) { fwdL.normalize(); pl.normalize(); const ang = Math.atan2(_v[5].crossVectors(fwdL, pl).dot(w1), fwdL.dot(pl)); q1.premultiply(_q[3].setFromAxisAngle(w1, ang)); }
    up.quaternion.copy(q1); up.updateWorldMatrix(false, false);
    // すね
    const uq = up.getWorldQuaternion(_q[0]), uqi = _q[1].copy(uq).invert();
    const w2 = _v[8].subVectors(Tc, K).normalize().applyQuaternion(uqi);
    lo.quaternion.setFromUnitVectors(_v[9].copy(ft.position).normalize(), w2); lo.updateWorldMatrix(false, false);
    // 足首：地面に平ら（足の向き・つま先の上げ下げ）
    const lq = lo.getWorldQuaternion(_q[0]).invert();
    const fq = _q[4].setFromEuler(_e.set(footPitch, footYaw, 0, "YXZ"));
    ft.quaternion.copy(lq.multiply(fq));
    if (this.bones[s + "Toes"]) this.bones[s + "Toes"].quaternion.setFromEuler(_e.set(-Math.min(.5, footPitch > .15 ? footPitch * .8 : 0), 0, 0));
  }

  // ---------------------------------------------------------------- 腕：振り子のように遅れてついてくる・歩くと脚と逆に振れる・話すと手が上がる・指す
  _arms(dt) {
    const S = this.s, B = this.bones, k = this.k, t = this.t, L = this.live, ws = this._ws, br = this._br;
    // 歩くときの腕の振り：反対の足の前後の位置から（右腕は左足と一緒に前へ）
    const fw = _v[0].set(Math.sin(this.yaw), 0, Math.cos(this.yaw)), F = this.feet;
    const fl = ((F.L.p.x - this.pos.x) * fw.x + (F.L.p.z - this.pos.z) * fw.z) / (.17 * this.sc), fr = ((F.R.p.x - this.pos.x) * fw.x + (F.R.p.z - this.pos.z) * fw.z) / (.17 * this.sc);
    // v4：振りの大きさは速さに合わせる（ゆっくりは小さく。秒速 0.85 m で前後に約 ±17°）。足の位置から決めるので、脚と必ず逆に振れる
    const sa = (.26 + .2 * clamp((this.speed / Math.max(.5, this.sc) - .5) / .8, 0, 1)) * k;
    S.armL.t = -clamp(fr / 1.4, -1, 1) * sa; S.armR.t = -clamp(fl / 1.4, -1, 1) * sa;   // 歩幅が v3 の 1.4 倍になったので、足の前後の位置を 1.4 で割る
    // 体の揺れ・向きの変化で、腕が少し遅れる（振り子）
    S.armLz.t = -.6 * S.turnLead.v * (1 - k) * .1 + .04 * ws; S.armRz.t = -.6 * S.turnLead.v * (1 - k) * .1 + .04 * ws;
    for (const n of ["armL", "armR"]) S[n].step(dt, 7);   // 腕は少し遅れてついてくる（振り子）
    for (const n of ["armLz", "armRz"]) S[n].step(dt);
    // 話すときの手：右手が主、ときどき両手。拍で小さく打つ
    // 話す身ぶり：句ごとに「手を下ろしたまま／右手／両手／左手」を選び、長い間では手を下ろす（いつも同じ構えにしない）。
    // 拍（強く読む音）は全部は打たない（6 割ほど・強さもまちまち）。うなずき・眉も拍の一部にだけ
    const sp = this.speaking; let beat = 0;
    if (sp) { const c = sp.clock(), b = sp.tl.b || [], Pp = sp.tl.p || [], Mm = sp.tl.m || [];
      if (!sp.amp) sp.amp = b.map(() => this.rand() < .38 ? 0 : .45 + .55 * this.rand());
      while (sp.pi < Pp.length && Pp[sp.pi] <= c + .3) { const r = this.rand(); sp.plan = sp.pi === 0 && r < .5 ? 1 : r < .3 ? 0 : r < .62 ? 1 : r < .84 ? 2 : 3; sp.var = this.rand(); sp.var2 = this.rand(); if (sp.pi > 0 && L && this.rand() < .22 && this.look.away <= 0) { this.look.away = .45 + .4 * this.rand(); this._pickAway(); } sp.pi++; }   /* 句の切れ目で、ときどき目をそらして考える */
      const mo = Mm[sp.i]; if (mo && mo[2] === "pau" && mo[1] > .26 && c > mo[0] + .05) sp.plan = 0;
      while (sp.bi < b.length && b[sp.bi] < c - .35) sp.bi++;
      for (let i = Math.max(0, sp.bi - 1); i < Math.min(b.length, sp.bi + 2); i++) { const x = c - (b[i] - .06); if (x > -.18 && x < .45) beat = Math.max(beat, sp.amp[i] * (x < 0 ? sstep(1 + x / .18) : 1 - sstep(x / .45))); }
      while (sp.nb < b.length && b[sp.nb] - .06 <= c) { const a = sp.amp[sp.nb]; if (L && a > 0 && this.rand() < .4) S.nod.d += .6 + 1.1 * a * this.rand(); if (L && a > .8 && this.rand() < .3) this.face.flash = .32; sp.nb++; }
      if (c > (sp.dur || 0) + .35) this.speaking = null; }
    const pl = sp && L ? (sp.plan ?? 1) : 0, gon = (1 - k * .7) * (1 - this._bw) * this.pz.gest;
    S.gest.t = (pl === 1 || pl === 2 ? 1 : pl === 3 ? .3 : 0) * gon; S.gest.step(dt, 4.2);
    S.gestL = S.gestL || new Spr(0, 4.2); S.gestL.t = (pl === 2 || pl === 3 ? 1 : pl === 1 ? .3 : 0) * gon; S.gestL.step(dt);
    S.gVar = (S.gVar ?? .5) + ((sp?.var ?? .5) - (S.gVar ?? .5)) * (1 - Math.exp(-3 * dt)); S.gVar2 = (S.gVar2 ?? .5) + ((sp?.var2 ?? .5) - (S.gVar2 ?? .5)) * (1 - Math.exp(-3 * dt));
    const g = S.gest.v, g2 = S.gestL.v, bt = beat; this._beat = beat;
    // 指す
    let pw = 0, aimY = 0, aimP = 0, side = 1; const po = this.pointing;
    if (po) { po.t += dt; const a = po.t, T = po.sec; pw = sstep((a - .35) / .45) * (1 - sstep((a - T + .5) / .5)); if (a > T) this.pointing = null;
      const toT = Math.atan2(po.p.x - this.pos.x, po.p.z - this.pos.z); aimY = wrapA(toT - this.yaw); side = aimY >= 0 ? 1 : -1;   // 左にあるものは左手
      const dist = Math.hypot(po.p.x - this.pos.x, po.p.z - this.pos.z); aimP = Math.atan2(po.p.y - 1.3 * this.sc, dist); po.side = side; }
    S.point.t = pw; S.point.step(dt); const pe = S.point.v;
    // お辞儀：腕は下へ垂れる（胴が前へ傾いた分、肩で戻す）・手は体の前で重ねる
    const bA = this._bowA || 0, bw = this._bw;
    // 休めの形（上腕：脇へ下ろす・前腕：少し曲げる・手首：腿へ向く）
    const rest = (sd, swing, swingZ) => { const sg = sd === "left" ? 1 : -1;
      return { ua: [-.06 + swing - bA * .3, sg * (.06 - .62 * bw), sg * (-1.3 + .02 * br + swingZ * sg) - sg * .02 * bw], la: [0, sg * -(.3 + .12 * k + .1 * Math.max(0, -swing / .45) * k * 2 + .38 * bw), 0], h: [.04 - .35 * bw, sg * (.05 + .25 * bw), sg * .1] }; };
    const sides = { left: rest("left", S.armL.v, S.armLz.v), right: rest("right", S.armR.v, S.armRz.v) };
    const rests = { left: rest("left", S.armL.v, S.armLz.v), right: rest("right", S.armR.v, S.armRz.v) };   // 身ぶりを足す前（記録と混ぜる土台）
    // 話す身ぶり（手のひらを少し上へ、体の前、腰〜胸の高さ）
    const gestPose = (sd, w, b) => { const sg = sd === "left" ? 1 : -1, o = sides[sd];
      // 肘は脇の近く（上腕はほぼ縦・少し内へ回す）、前腕は水平より 25〜45° 下、手は腰の前に寄る。構えの高さは句ごとに少し変える
      const v = S.gVar, bb = b * w;
      o.ua = [o.ua[0] + (-.03 - .05 * v) * w, o.ua[1] - sg * (.32 + .12 * v) * w, o.ua[2] + sg * .06 * w];
      o.la = [o.la[0], o.la[1] + sg * -(.52 + .3 * v - .2 * bb) * w, o.la[2]];
      const v2 = S.gVar2; o.h = [o.h[0] - (.3 + .4 * v2) * w, o.h[1] + sg * (-.3 + .35 * v2) * w, o.h[2] + sg * (-.12 + .18 * b) * w]; };
    gestPose("right", g, bt); gestPose("left", g2, bt * .7);
    // 指す腕
    if (pe > 1e-3) { const sd = side > 0 ? "left" : "right", sg = side > 0 ? 1 : -1, o = sides[sd];
      const yawL = clamp(aimY * sg, -.4, 1.5);   // 体の前を 0、外へ広がる向きを正
      const tgtUA = [-(Math.PI / 2 - .25) * Math.cos(yawL) * .95 - aimP * .6, sg * (Math.PI / 2 - .25) * Math.sin(Math.max(0, yawL)) * .5, sg * (-1.24 + 1.0 + .6 * Math.max(0, yawL))];
      o.ua = o.ua.map((v, i) => v + (tgtUA[i] - v) * pe); o.la = o.la.map((v, i) => v + ([0, sg * -.15, 0][i] - v) * pe); o.h = o.h.map((v, i) => v + ([0, 0, sg * .05][i] - v) * pe);
      this._pointSide = sd; this._pointW = pe; } else this._pointW = 0;
    // 骨へ：土台（休めの形と記録を混ぜる）× 身ぶりの差。指すときは、ねらいがずれないよう身ぶりの形そのものへ寄せる
    const mw = this.mcW.v * (this.mc ? 1 : 0) * (1 - bw), qr = _q[3], qf = _q[4];
    for (const sd of ["left", "right"]) { const o = sides[sd], r0 = rests[sd], pw2 = this._pointSide === sd ? this._pointW : 0;
      for (const [bn, key] of [["UpperArm", "ua"], ["LowerArm", "la"], ["Hand", "h"]]) { const b = B[sd + bn]; if (!b) continue;
        qf.setFromEuler(_e.set(...o[key])); const w = mw * (MOCAP_W[sd + bn] || 0) * this.pz.mA * (1 + ((this._idleArm ?? 1) - 1) * (1 - this.k) * (1 - this._tk)), mq = this._mq[sd + bn];
        if (w < 1e-3 || !mq) { b.quaternion.copy(qf); continue; }
        qr.setFromEuler(_e.set(...r0[key])); const dq = _q[0].copy(qr).invert().multiply(qf);   // 身ぶりの差（休めの形から）
        b.quaternion.copy(qr).slerp(mq, w).multiply(dq); if (pw2 > 1e-3) b.quaternion.slerp(qf, pw2); }
      // v4：力を抜いた手が体から離れすぎない（記録によっては肘が横へ張り、手が腰から 20 cm 以上も離れる＝人形・構えに見える）。
      // 手の位置（碧の向きで見た横・前）が、横 15 cm・前 12 cm を越えたら、上腕を内へ・後ろへ戻す。指す・話す身ぶり・礼のときは外す
      const ua = B[sd + "UpperArm"], hd = B[sd + "Hand"], sg = sd === "left" ? 1 : -1, free = (1 - pw2) * (1 - (sd === "right" ? g : g2)) * (1 - this._bw) * (1 - this.k * .7);
      if (ua && hd && free > .01) { const h = this.root.worldToLocal(hd.getWorldPosition(_v[1])), ex = sg * h.x - .15, ez = h.z - .12, Lr = .42;   /* 碧の入れ物から見た位置（大きさをそろえた体の寸法） */
        if (ex > 0) ua.quaternion.premultiply(_q[0].setFromAxisAngle(_v[2].set(0, 0, 1), -sg * Math.atan(ex / Lr) * 1.1 * free));
        if (ez > 0) ua.quaternion.premultiply(_q[0].setFromAxisAngle(_v[2].set(1, 0, 0), Math.atan(ez / Lr) * free)); } }
    // 指：力を抜いた曲がり（人差し指から小指へ深く）。指すときは人差し指を伸ばす
    const cu = .3 + .06 * k + (L ? .03 * wob(t * .4, this.seedPh + 2) : 0);
    for (const [b, sd, f, j] of this.fingers) { const sg = sd === "left" ? 1 : -1;
      if (f === "Thumb") { b.quaternion.setFromEuler(_e.set(0, sg * (j === "Metacarpal" ? .25 : j === "Proximal" ? .2 : .12), sg * -(j === "Distal" ? .18 : .06))); continue; }
      const m = { Index: .78, Middle: 1, Ring: 1.08, Little: 1.2 }[f] * (j === "Proximal" ? 1 : j === "Intermediate" ? 1.15 : .8);
      let c = cu * m; if (sd === (this._pointSide || "") && this._pointW > 0) c = f === "Index" ? c * (1 - this._pointW) : c + .5 * this._pointW;
      if (sd === "right" && g > 0) c *= 1 - .35 * g; if (sd === "left" && g2 > 0) c *= 1 - .35 * g2;   // 話すとき、手は少しひらく
      b.quaternion.setFromEuler(_e.set(0, 0, -sg * c)); }
  }

  // ---------------------------------------------------------------- 目と頭：目が先に（サッカード）、頭は 0.1〜0.2 秒遅れてついていく。ときどき目をそらす
  _headEyes(dt, cam) {
    const Lk = this.look, B = this.bones, L = this.live;
    const head = B.head; if (!head) return;
    // 見る先
    const tgt = _v[0];
    const po = this.pointing;
    if (po && po.t < po.sec - .6 && po.t > .05) tgt.copy(po.p);
    else if (Lk.target) { if (Lk.target.isObject3D) Lk.target.getWorldPosition(tgt); else tgt.copy(Lk.target); }
    else if (cam) tgt.copy(cam); else tgt.set(this.pos.x + Math.sin(this.yaw) * 3, 1.5 * this.sc, this.pos.z + Math.cos(this.yaw) * 3);
    // 歩くとき：ふだんは 5〜8 m 先の道を見て、ときどき（3〜6 秒ごとに 1 秒ほど）見る人を見る
    if (!Lk.target && !(po && po.t < po.sec - .6) && this.k > .45) { Lk.wg = (Lk.wg ?? 2) - dt; if (Lk.wg < -1.1) Lk.wg = 3 + 3 * this.rand();
      if (Lk.wg > 0) { const d = 6.5 * this.sc; tgt.set(this.pos.x + Math.sin(this.yaw) * d, 1.15 * this.sc + this.pos.y, this.pos.z + Math.cos(this.yaw) * d); } }
    if (this._bowA > .05) { const hp = head.getWorldPosition(_v[1]); tgt.set(hp.x + Math.sin(this.yaw) * 2, this.pos.y, hp.z + Math.cos(this.yaw) * 2); }   // 礼のときは足もとの少し先（目を伏せる）
    // 目をそらす：話しはじめ・考えるとき・ふだんもときどき（下や横へ。上はまれ）
    if (L) { Lk.awayT -= dt;
      const sp = this.speaking, startAway = sp && sp.startAway && sp.clock() < .9;
      if (startAway && Lk.away <= 0) { Lk.away = .7 + .5 * this.rand(); this._pickAway(); sp.startAway = false; }
      if (Lk.awayT <= 0 && !po && this._bowA < .05 && this.k < .3) { Lk.awayT = (this.listening ? 9 : sp ? 3.5 : 5) + 6 * this.rand(); if (!this.listening) { Lk.away = .5 + 1.1 * this.rand(); this._pickAway(); } } }
    if (Lk.away > 0) { Lk.away -= dt; const hp = head.getWorldPosition(_v[1]); tgt.copy(hp).add(Lk.awayDir); }
    // 大きく動いたら：目は一気に（サッカード）、頭はばねで。視線が大きく動くときにまばたき
    const hpos = head.getWorldPosition(_v[2]);
    const dNew = _v[3].subVectors(tgt, hpos).normalize(), dOld = _v[4].subVectors(Lk.cur, hpos).normalize();
    const jump = dNew.angleTo(dOld);
    if (jump > .04) { if (jump > .25 && this.rand() < clamp(.35 + jump, 0, .9)) this.blink.next = Math.min(this.blink.next, .02); Lk.cur.copy(tgt); }   // v4：大きく見る先を変えるほど、まばたきしやすい（目の動きとまばたきの結びつき）
    else Lk.cur.lerp(tgt, 1 - Math.exp(-12 * dt));   // ゆっくり動くものは目で追う
    // 頭の向き：胸から見た角度の 7 割（目が残りを受け持つ）。首 4 割・頭 6 割
    const ch = (B.upperChest || B.chest || B.spine); const cq = ch.getWorldQuaternion(_q[0]).invert();
    const dl = _v[5].subVectors(Lk.cur, hpos).applyQuaternion(cq);
    const yawT = Math.atan2(dl.x, dl.z), pitT = Math.atan2(-dl.y, Math.hypot(dl.x, dl.z));
    Lk.hy.t = clamp(yawT * .72, -1.0, 1.0) * (L ? 1 : .6); Lk.hp.t = clamp(pitT * .6, -.35, .45);
    Lk.hy.step(dt); Lk.hp.step(dt);
    const nk = B.neck; const qy = _q[1], qn = _q[2];
    // 大きく振り向くときは、胸も少し回す（首だけで回さない）。目→頭→胸の順に遅れて
    const hyv = Lk.hy.v, big = Math.sign(hyv) * Math.max(0, Math.abs(hyv) - .3) * .45; Lk.cy = (Lk.cy ?? 0) + (big - (Lk.cy ?? 0)) * (1 - Math.exp(-4 * dt));
    const cb = B.upperChest || B.chest; if (cb && Math.abs(Lk.cy) > 1e-4) cb.quaternion.premultiply(_q[3].setFromEuler(_e.set(0, Lk.cy, 0)));
    const hy2 = hyv - Lk.cy;
    if (nk) { qn.setFromEuler(_e.set(Lk.hp.v * .4, hy2 * .4, 0)); nk.quaternion.premultiply(qn); }
    qy.setFromEuler(_e.set(Lk.hp.v * .6, hy2 * .6, 0)); head.quaternion.premultiply(qy);
    // 頭を水平に保つ（立ち直り反射）：胴の揺れ（人の記録）で頭が左右に傾いた分の 7 割を、首から上で戻す。首をかしげる動きは残す
    if (this.mc && this.mcW.v > .01) { head.updateWorldMatrix(true, false); const hq = head.getWorldQuaternion(_q[3]), u = _v[6].copy(UP).applyQuaternion(hq.invert());
      const roll = Math.atan2(-u.x, u.y), want = (this._tiltA || 0); head.quaternion.multiply(_q[4].setFromAxisAngle(_v[7].set(0, 0, 1), (roll + want) * .7 * this.mcW.v));   // roll＝いまの傾き（かしげる分は −tilt）
      // 上下も：記録の背の丸みで頭が下を向いた分を、見る先の高さに合わせて半分戻す（前髪の下から上目づかいに見ない）。礼・うなずきの最中はしない
      if (this._bowA < .03) { head.updateWorldMatrix(true, false); const f = _v[6].set(0, 0, 1).applyQuaternion(head.getWorldQuaternion(_q[3])), e = Math.asin(clamp(f.y, -1, 1));
        const et = Math.atan2(Lk.cur.y - hpos.y, Math.hypot(Lk.cur.x - hpos.x, Lk.cur.z - hpos.z)) * .6; head.quaternion.multiply(_q[4].setFromAxisAngle(_v[7].set(1, 0, 0), -clamp(et - e, -.2, .2) * .5 * this.mcW.v)); } }
    // 目の小さな動き（固視中のマイクロサッカード：1 秒に 1〜2 回、1° 未満）
    if (L) { Lk.sacT -= dt; if (Lk.sacT <= 0) { Lk.sacT = .35 + .7 * this.rand(); const d = Lk.cur.distanceTo(hpos) * .012; Lk.sac.set((this.rand() - .5) * d, (this.rand() - .5) * d * .7, (this.rand() - .5) * d); } }
    // v4：見る人の顔を見るときは、相手の左の目・右の目・ときどき口元へと、0.5〜1.6 秒ごとに小さく跳ぶ（ずっと一点を見つめると、目が据わって見える）
    let scan = Lk.scan || (Lk.scan = new THREE.Vector3());
    if (L && cam && !Lk.target && !po && Lk.away <= 0 && this.k < .3 && this._bowA < .05 && cam.distanceTo(Lk.cur) < .05) { Lk.scanT = (Lk.scanT ?? .8) - dt;
      if (Lk.scanT <= 0) { Lk.scanT = .5 + 1.1 * this.rand(); const r = this.rand(), side = (Lk.scanSide = -(Lk.scanSide || 1)), sp2 = this.speaking ? .25 : .12, cr = _v[6].set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        if (r < sp2) scan.set(0, -.065 * this.sc, 0); else scan.copy(cr).multiplyScalar(side * .032 * this.sc); } }
    else scan.multiplyScalar(Math.exp(-10 * dt));
    this.gazeObj.position.copy(Lk.cur).add(Lk.sac).add(scan);
    // 下を見るとき、上まぶたも少し下がる
    { const el = Math.atan2(Lk.cur.y - hpos.y, Math.hypot(Lk.cur.x - hpos.x, Lk.cur.z - hpos.z)); this._lidDown = clamp(-el - .12, 0, .5) * .45; this._lidUp = clamp(el - .1, 0, .4) * .3; }   // v4：上を見るときは上まぶたが少し上がる
  }
  _pickAway() { const a = this.pz.away, r = this.rand(), s = this.rand() < .5 ? -1 : 1, y = this.yaw + s * (.22 + .3 * this.rand()) * a;   /* v4：目をそらす幅を 13〜30° に（大きく振り向くと唐突） */ const dn = (r < .5 ? -(.2 + .3 * this.rand()) : r < .9 ? -.04 : .15) * a;   /* upright：目をそらす幅を小さく（うつむかない） */
    this.look.awayDir.set(Math.sin(y) * 2, dn * 2, Math.cos(y) * 2); }

  // ---------------------------------------------------------------- まばたき・表情・口
  _faceTick(dt) {
    const em = this.vrm.expressionManager; if (!em) return; const Bk = this.blink, Fc = this.face, L = this.live, sp = this.speaking;
    // まばたき：間隔は対数正規（ふだん中央値 3.4 秒・話すと 2.4 秒・聞くと 4 秒・考えるとき少し多い）。一割ほど二度まばたき。
    // v4：一回ごとに速さを変える（閉じる 55〜90ms・止まる 20〜60ms・ひらく 120〜220ms）。ときどき半分だけ・ゆっくりのまばたき（考えるとき）
    Bk.next -= dt;
    if (Bk.t < 0 && Bk.next <= 0) { Bk.t = 0; const r = this.rand(); Bk.amp = r < .12 ? .55 + .25 * this.rand() : 1; const slow = Fc.emo === "thinking" || this.rand() < .08 ? 1.5 : 1;
      Bk.c = (.055 + .035 * this.rand()) * slow; Bk.h = .02 + .04 * this.rand(); Bk.o = (.12 + .1 * this.rand()) * slow; }
    if (Bk.t >= 0) { Bk.t += dt; const u = Bk.t, c = Bk.c || .07, h = Bk.h || .04, o = Bk.o || .16; Bk.v = Bk.amp * (u < c ? sstep(u / c) : u < c + h ? 1 : 1 - sstep((u - c - h) / o));
      if (u >= c + h + o) { Bk.t = -1; Bk.v = 0; const med = sp ? 2.4 : this.listening ? 4 : Fc.emo === "thinking" ? 2.8 : 3.4; Bk.next = this.rand() < .09 ? .12 + .1 * this.rand() : Math.max(.7, med * Math.exp(.5 * this._gauss())); } }
    // まぶたは視線についていく：下を見ると上まぶたが下がり、上を見ると少し上がる（v4：上を見るときも）
    em.setValue("blink", Math.min(1, Math.max(Bk.v + (this._lidDown || 0) + .02, this.eyesClosed || 0)));   // eyesClosed（0..1）＝アプリが目を閉じさせたいとき（胡蝶の夢の「感じている」窓）
    // 表情：いまの感情へゆっくり寄せ、小さな揺らぎを足す。話すと口の笑みは半分（口の形とぶつかるので）
    if (Fc.hold > 0 && Fc.hold < 1e8) { Fc.hold -= dt; if (Fc.hold <= 0) { Fc.emo = this.listening ? "warm" : "calm"; Fc.emoW.t = 1; } }
    Fc.emoW.step(dt); const E = EMOTIONS[Fc.emo] || EMOTIONS.calm, t = this.t, sd = this.seedPh;
    if (Fc.flash > 0) Fc.flash -= dt;
    const fl = Fc.flash > 0 ? Math.sin(Math.PI * clamp(1 - Fc.flash / .45, 0, 1)) : 0;   // 眉を上げる（あいさつ・話しはじめ。約 0.2〜0.4 秒）
    // v4：立っているだけのときも顔を止めない。6〜14 秒ごとに、ごく小さな気分の動き（ふっと口元がゆるむ・少し考える・眉が動く）を 1.5〜3 秒
    if (L && !sp && !this.listening && Fc.emo === "calm") { Fc.idleT = (Fc.idleT ?? 4 + 4 * this.rand()) - dt;
      if (Fc.idleT <= 0) { Fc.idleT = 6 + 8 * this.rand(); const r = this.rand(); Fc.mic = r < .45 ? { smile: .08, cheek: .2, lidLow: .1 } : r < .7 ? { browSad: .1, lidLow: .06 } : r < .9 ? { browUp: .1 } : { smile: -.05 }; Fc.micT = 1.5 + 1.5 * this.rand(); Fc.micA = 0; } }
    if (Fc.micT > 0) { Fc.micT -= dt; Fc.micA = Math.min(1, (Fc.micA || 0) + dt / .6); } else Fc.micA = Math.max(0, (Fc.micA || 0) - dt / .9);
    // v4：左右の差を、ときどき（2〜6 秒ごと）少し変える。いつもの側は保つ
    Fc.asymT -= dt; if (Fc.asymT <= 0) { Fc.asymT = 2 + 4 * this.rand(); Fc.asym.t = Fc.side + (this.rand() - .5) * .14; } Fc.asym.step(dt);
    const talkMouth = sp ? .45 : 1, asym = L ? Fc.asym.v : 0;
    for (const [ch, o] of Object.entries(Fc.ch)) {
      let v = (E[ch] || 0) * Fc.emoW.v + (Fc.mic?.[ch] || 0) * (Fc.micA || 0);
      if (ch === "smile") v *= talkMouth;
      if (ch === "browUp") v += .35 * fl + .14 * (this._beat || 0);   // 強く読む音で眉が少し上がる
      if (ch === "wide") v += (this._lidUp || 0);   // 上を見ると上まぶたが少し上がる
      if (sp && (ch === "smile" || ch === "lidLow" || ch === "cheek")) { const c = sp.clock(), e = sstep((c - (sp.dur - .9)) / .5); v += (ch === "smile" ? .16 : ch === "cheek" ? .3 : .12) * e; }   // 言い終わりに、頬が少し上がる
      if (ch === "lidLow" || ch === "cheek") v *= 1 - .7 * (this.blink.v || 0);   // まばたきの最中は下まぶたを戻す（目を閉じきったように見せない）
      if (L) v += (ch === "smile" ? .035 : ch.startsWith("brow") ? (sp ? .07 : .03) : .015) * wob(t * (sp ? .9 : .5), sd + ch.length);
      if (ch === "browUp" && this.listening) v += .08;
      o.v.t = clamp(v, 0, CHMAX[ch] ?? 1); o.v.step(dt);
      const ak = ch === "smile" ? 1 : ch.startsWith("brow") ? (ch === "browUp" && this._beat ? 1.6 : .7) : 0;   // 眉は拍のとき片方が少し強い
      for (const [m, i, w, s] of o.binds) m.morphTargetInfluences[i] = clamp(o.v.v * w * (1 + s * asym * ak * 2), 0, 1);
    }
    if (this.tint) this.tint.set((Fc.ch.cheek?.v.v || 0) * .26);   // 頬が上がるほど、頬の血色を少し上げる
    // 口：時刻表の母音へ（音より 40ms 先に形をつくる）。声の大きさで開きを変える。唇を閉じる子音は閉じる
    // v4：①音の頭（子音）で口を少し閉じる（同じ母音が続いても口が動く＝ゴムの口にしない）②音の終わり 3 割で次の母音へ寄せる（調音結合）③句の切れ目では閉じきらず少しあける
    const want = { aa: 0, ih: 0, ou: 0, ee: 0, oh: 0 };
    if (sp) { const c = sp.clock() + .04, M = sp.tl.m || []; while (sp.i < M.length - 1 && M[sp.i][0] + M[sp.i][1] <= c) sp.i++;
      const mo = M[sp.i]; if (mo && c >= mo[0] && c < mo[0] + mo[1] + .02) { const [st, len, v, cl] = mo; const vis = VIS[v]; const ph = (c - st) / Math.max(.01, len);
        const open = sp.level ? clamp(.55 + .6 * sp.level(), .5, 1.1) : 1; const close = cl && ph < .35 ? sstep(ph / .35) : 1, onset = v === "pau" || v === "cl" ? 1 : .72 + .28 * sstep(ph / .22);
        if (vis) for (const [kk, w] of Object.entries(vis)) want[kk] = w * open * close * onset;
        const nx = M[sp.i + 1], nv = nx && VIS[nx[2]]; if (nv && ph > .7 && nx[0] - (st + len) < .05) { const b = sstep((ph - .7) / .3) * .45 * (nx[3] ? .4 : 1); for (const kk of MOUTH) want[kk] = want[kk] * (1 - b) + (nv[kk] || 0) * open * b; } } }
    for (const kk of MOUTH) { const s = Fc.mouth[kk]; s.t = want[kk]; s.step(dt, want[kk] > s.v ? 30 : 22); em.setValue(kk, clamp(s.v, 0, 1)); }   // 開くのは速く・閉じるのは少しゆっくり
  }
  _gauss() { let u = 0, v = 0; while (!u) u = this.rand(); while (!v) v = this.rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
}
