/* 森羅美術館（Shinra Museum）── 森羅百景の 3D 美術館。依代の碧が、となりを歩きながら声で案内する。2026-10-04 試作、2026-10-07 作り直し。
   本人（2026-10-07）：「ホワイトキューブより、重厚で歴史が積み重なった博物館のようなデザインの方がいいです。また、雨、月、野菜などテーマに応じて
   部屋に入ると空間が切り替わるようなイメージに仕上げてください。また、雨では雨音もつけるなど、音の体験も合わせてお願いします。……
   美術館では、文字のキャプションを読む体験でなく、碧と巡る体験にしてください。」
   展示の表＝data/museum.js（_dev/build.py の生成物。碧の台本 M.tour も入っている）。碧の声＝data/voice.js（_dev/build_voice.py の生成物）。
   図版・音・碧の VRM は森羅百景のもの（data/museum.js の src が指す。公開版は s/ に写す）。
   館の形：八角の広間（石の床・アーチ・丸天井）から、八つの連作の部屋が放射状にのびる。部屋ごとに壁の色・窓の外・光・粒・音が違う。
   碧の言葉：森羅百景のデータ（題・作者・年・土地・所蔵・解説・録音の台帳）からだけ組んだ事実と、新しい事実を入れない雑談。字幕＝話す言葉そのもの。 */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import * as TX from "./tex.js";
import { esc, fname, licHTML, credit } from "./common.js";
import { LIB, libWalkable, buildLibrary, createReader, bookList } from "./library.js";
import { createExhibit } from "./anim3d.js";
import { createHolo } from "./holo.js";

const M = window.MUSEUM, T = M.tour, VOICE = window.VOICE || {}, NAMES = M.names;   // 表示する名前は names.json だけから
window.__muBoot = true;
const $ = id => document.getElementById(id);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const isTouch = matchMedia("(pointer:coarse)").matches;
let RM = store.get("smm-rm", matchMedia("(prefers-reduced-motion: reduce)").matches);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (dt, r) => 1 - Math.exp(-dt * r);
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let mode = "start";            // start（入口の前の題）／walk（歩いている）
let space = "museum";          // いま立っている所：museum／library（書架の部屋）。歩いて行き来する（tick で region から決める）

// ---------------------------------------------------------------- 館の寸法
//   2026-10-07 本人「入口から３dで制作してください。同じ３dモデルで中央にワープするところがあって、はじめは博物館に入って、ワープすると図書館に移動する」
//   広間（hub）は十一角の円堂。正面（+z）が玄関、その両わきは壁、残りの八面から八つの部屋がのびる。まん中にワープ（光の輪）。図書館はその真下（y＝LIB.Y）
const NF = 11, HA = Math.PI / NF;
// 2026-10-07 本人「美術館をもう少し狭く：いまは広すぎる。部屋と通路を詰め……人が歩いて心地よい密度に（重厚さは保つ）」→ 円堂の半径 19→15、部屋の幅 10→8.4、景の間 6.6→5.6
const R = 15, WALL_H = 6.2, LOBBY_H = 8.6, HALF = 4.2, BAY = 5.6, FOY = 3, DOOR = 2.5, FIN = .9, EYE = 1.6;
const SPRING = 2.7;
const VEST = 7, PORT = VEST + 5.5, STEPS = PORT + 2.4, PLAZA = STEPS + 34, PLAZA_Y = -1.2;
const faceTh = k => Math.PI + k * 2 * HA;
const mkFace = th => { const d = new THREE.Vector2(Math.sin(th), -Math.cos(th)); return { th, d, p: new THREE.Vector2(-d.y, d.x) }; };
const ENT = mkFace(faceTh(0));
const rooms = M.rooms.map((r, i) => {
  const f = mkFace(faceTh(i + 2));
  // 区画（鳥・けもの…）ごとに、新しい列からはじめる（2026-10-07 本人「見てすぐ分かる区画にする」）。左右に一景ずつ
  let row = 0, col = 0, prevG = null;
  r.kei.forEach((k, j) => {
    if (prevG !== null && k.genre !== prevG && col === 1) { row++; col = 0; }
    k.room = i; k.j = j; k.row = row; k.side = col ? 1 : -1; k.u = FOY + row * BAY + BAY / 2; prevG = k.genre;
    if (++col === 2) { col = 0; row++; }
  });
  const rows = row + (col ? 1 : 0), L = FOY + rows * BAY + 3;
  const keiAt = (rw, sd) => r.kei.find(k => k.row === rw && k.side === sd) || r.kei.find(k => k.row === rw) || null;
  const n = r.kei.reduce((a, k) => a + k.works.length, 0);
  return Object.assign(r, f, { i, rows, L, n, keiAt });
});
const FACES = [ENT, mkFace(faceTh(1)), ...rooms, mkFace(faceTh(NF - 1))];
// 書架の部屋（図書館）：円堂の玄関わきの面（FACES[1]）の扉の奥の一室。中の座標は library.js の LIB（+z が入口）
const LIB_FACE = FACES[1];
const LIBO = (() => { const p = new THREE.Vector3(LIB_FACE.d.x * (R + LIB.Z + .5), 0, LIB_FACE.d.y * (R + LIB.Z + .5)); return { p, th: Math.atan2(-LIB_FACE.d.x, -LIB_FACE.d.y) }; })();
const libLocal = (x, z) => { const dx = x - LIBO.p.x, dz = z - LIBO.p.z, c = Math.cos(LIBO.th), s_ = Math.sin(LIBO.th); return { x: dx * c - dz * s_, z: dx * s_ + dz * c }; };
const libWorld = v => { const c = Math.cos(LIBO.th), s_ = Math.sin(LIBO.th); return new THREE.Vector3(LIBO.p.x + v.x * c + v.z * s_, 0, LIBO.p.z - v.x * s_ + v.z * c); };
const inLib = (x, z) => { const l = libLocal(x, z); return Math.abs(l.x) < LIB.X + .2 && l.z > -LIB.Z - .2 && l.z < LIB.Z + .55; };
const STELE = { x: 0, z: 999, w: 0, d: 0, r: 0 };   // 入口の一枚の衝立は外した
const WARP = { x: 0, z: 0, r: -1, keep: 0 };   // 光の輪（ワープ）は 2026-10-07 にやめた（本人「中央の図書館へのワープは不要」）
const OBST = [];   // 円堂の中の置きもの（企画展の台など）：{x, z, r}
const inStele = (x, z, m = .4) => Math.abs(x - STELE.x) < STELE.w / 2 + m && Math.abs(z - STELE.z) < STELE.d / 2 + m;
const RR = R / Math.cos(HA);
const COLS = Array.from({ length: NF }, (_, k) => { const a = faceTh(k) + HA; return new THREE.Vector2(Math.sin(a) * (RR - 1.0), -Math.cos(a) * (RR - 1.0)); });
const WF = (f, u, v) => new THREE.Vector3(f.d.x * (R + u) + f.p.x * v, 0, f.d.y * (R + u) + f.p.y * v);
const W = (i, u, v) => WF(rooms[i], u, v);
const E = (u, v = 0) => WF(ENT, u, v);
const entLocal = (x, z) => ({ u: x * ENT.d.x + z * ENT.d.y - R, v: x * ENT.p.x + z * ENT.p.y });
const PCOLS = [2.8, 7.6, 12.4].flatMap(v => [v, -v]);
function local(x, z) {
  let best = null;
  for (const r of rooms) { const a = x * r.d.x + z * r.d.y - R, b = x * r.p.x + z * r.p.y; if (a > -2.5 && Math.abs(b) < HALF + .5 && (!best || a > best.u)) best = { i: r.i, u: a, v: b }; }
  return best;
}
function region(x, z) {
  if (inLib(x, z)) return { kind: "library" };
  const e = entLocal(x, z); if (e.u > -.35 && Math.abs(e.v) < 40) return { kind: "entrance", u: e.u, v: e.v };
  const l = local(x, z);
  if (l && l.u > -0.35) return { kind: "room", ...l };
  return { kind: "lobby", l };
}
function groundY(x, z) {
  if (inLib(x, z)) return 0;
  const e = entLocal(x, z);
  if (e.u <= PORT) return 0;
  return e.u >= STEPS ? PLAZA_Y : PLAZA_Y * (e.u - PORT) / (STEPS - PORT);
}
function walkable(x, z, wallGap = 1.6) {
  if (inLib(x, z)) { const l = libLocal(x, z); return libWalkable(l.x, l.z); }
  const e = entLocal(x, z);
  if (e.u > -.6) {                                                       // 玄関の間・扉・柱廊・階段・前庭
    if (e.u < VEST - .3) return Math.abs(e.v) < DOOR - .55;
    return false;   // 外へは出ない（2026-10-07）
    if (e.u < VEST + 1.1) return Math.abs(e.v) < 1.5;
    if (e.u < PORT) return Math.abs(e.v) < 14.5 && PCOLS.every(v => Math.hypot(e.u - (VEST + 4.2), e.v - v) > 1.0);
    return e.u < PLAZA && Math.abs(e.v) < (e.u < STEPS ? 14.5 : 22);
  }
  let inLobby = true, libDoorway = false;
  for (const f of FACES) if (x * f.d.x + z * f.d.y > R - 1.0) { if (f === LIB_FACE && Math.abs(x * f.p.x + z * f.p.y) < LIB.DOOR - .4) libDoorway = true; else inLobby = false; }
  if (libDoorway && inLobby) return true;
  if (inLobby) return !inStele(x, z) && COLS.every(c => Math.hypot(x - c.x, z - c.y) > 1.05) && OBST.every(o => Math.hypot(x - o.x, z - o.z) > o.r);
  const l = local(x, z); if (!l) return false; const r = rooms[l.i];
  if (l.u < 0.25) return l.u > -1.2 && Math.abs(l.v) < DOOR - .5;
  if (l.u > r.L - .5) return false;
  const lim = l.u > FOY - .2 && l.u < FOY + r.rows * BAY + .2 ? HALF - wallGap : HALF - .45;
  return Math.abs(l.v) <= lim;
}

// ---------------------------------------------------------------- 部屋ごとの空気（光・霧・窓の外・粒・音）
//   win：窓の外（1 雨・2 風の雲・3 雪・4 森・5 畑の昼・6 月夜・7 夜明け・8 夕の土）、part：粒（ほこり・葉・雪・ほたる・花粉・星・金の塵）
const ATMO = {
  lobby:   { hs: 0xfff1da, hg: 0x6b5a44, hi: 1.1, kc: 0xffe6c0, ki: .9, exp: 1.0, fog: 0x2a2219, part: "dust", fn: 22, ff: 95 },
  outside: { hs: 0xc8d6f0, hg: 0x5a4a38, hi: 1.05, kc: 0xffd2a0, ki: 1.25, exp: 1.0, fog: 0xd9b48e, part: "none", fn: 60, ff: 250 },
  library: { hs: 0xffe2b8, hg: 0x3a2414, hi: .75, kc: 0xffd6a0, ki: .45, exp: 1.02, fog: 0x1a120a, part: "dust", fn: 12, ff: 40 },
  tsuchi:  { wall: 0x7a4a30, ceil: 0x3a2516, run: ["#5e2a1c", "#c9a45c"], hs: 0xffdcae, hg: 0x5a3a22, hi: 1.0, kc: 0xffc58a, ki: .85, exp: 1.0, fog: 0x3a2414, lay: 0xffd7a0, layI: .95, win: 8, part: "dust", shaft: 0xffc890 },
  ame:     { wall: 0x3a4652, ceil: 0x1d242c, run: ["#2a333d", "#8ea6bd"], hs: 0xa9b8c8, hg: 0x22282e, hi: .78, kc: 0xb8c8dc, ki: .35, exp: .94, fog: 0x1b2229, lay: 0x8fa3b8, layI: .42, win: 1, part: "none", wet: true },
  kaze:    { wall: 0x52665a, ceil: 0x26322b, run: ["#2f4436", "#c8d8b0"], hs: 0xe2f0e8, hg: 0x44544a, hi: 1.0, kc: 0xf0fff4, ki: .7, exp: 1.0, fog: 0x2b362f, lay: 0xe8f5ee, layI: .85, win: 2, part: "leaf" },
  yuki:    { wall: 0x8d99a6, ceil: 0x4c5560, run: ["#4b5866", "#e8eef6"], hs: 0xeef4ff, hg: 0x6a7684, hi: 1.2, kc: 0xe8f0ff, ki: .55, exp: 1.02, fog: 0x8794a3, lay: 0xf4f8ff, layI: 1.15, win: 3, part: "snow" },
  hyakkei: { wall: 0x33503d, ceil: 0x18261c, run: ["#4a2a1a", "#d0a468"], hs: 0xd8efc8, hg: 0x2a3820, hi: .95, kc: 0xf6ffd8, ki: .6, exp: 1.0, fog: 0x18241a, lay: 0xdff3c8, layI: .75, win: 4, part: "firefly", shaft: 0xd6f0a8 },
  yasai:   { wall: 0x8c6d3a, ceil: 0x45351c, run: ["#4f5a24", "#e3cf8a"], hs: 0xfff6dc, hg: 0x6a5430, hi: 1.25, kc: 0xfff0c8, ki: 1.0, exp: 1.05, fog: 0x463820, lay: 0xfff4d8, layI: 1.25, win: 5, part: "pollen", shaft: 0xfff0c0 },
  tsuki:   { wall: 0x262c48, ceil: 0x0d1020, run: ["#1b2140", "#c9c3a0"], hs: 0x6070a6, hg: 0x0c1020, hi: .6, kc: 0xa6b8ff, ki: .5, exp: .92, fog: 0x070a14, lay: 0x5866a0, layI: .22, win: 6, part: "star" },
  taiyo:   { wall: 0x8a4228, ceil: 0x3e1d10, run: ["#5a1e14", "#e8b060"], hs: 0xffd6a0, hg: 0x5a2e18, hi: 1.05, kc: 0xffb070, ki: 1.05, exp: 1.03, fog: 0x40220f, lay: 0xffd09a, layI: 1.0, win: 7, part: "gold", shaft: 0xffb878 },
};
const PART = {
  none:    { op: 0, vel: [0, 0, 0], sway: 0, size: 2, col: [1, 1, 1], tw: 0 },
  dust:    { op: .32, vel: [.03, .02, .01], sway: .15, size: 2.2, col: [1, .9, .72], tw: 0 },
  leaf:    { op: .5, vel: [.9, -.06, .5], sway: .5, size: 3.4, col: [.86, .95, .74], tw: 0 },
  snow:    { op: .85, vel: [0, -.42, 0], sway: .35, size: 4.4, col: [1, 1, 1], tw: 0 },
  firefly: { op: .95, vel: [0, .03, 0], sway: .55, size: 4.6, col: [.86, 1, .42], tw: 1 },
  pollen:  { op: .45, vel: [.02, .05, .01], sway: .25, size: 2.6, col: [1, .95, .62], tw: 0 },
  star:    { op: .6, vel: [0, .01, 0], sway: .1, size: 2.6, col: [.78, .85, 1], tw: 1 },
  gold:    { op: .55, vel: [.02, -.015, .01], sway: .2, size: 2.6, col: [1, .82, .5], tw: 0 },
};

// ---------------------------------------------------------------- three の場
const stage = $("stage"); stage.setAttribute("role", "img"); stage.setAttribute("aria-label", "館の中の 3D の眺め。操作は下のボタンと、碧のことばから");
const renderer = new THREE.WebGLRenderer({ antialias: !isTouch || devicePixelRatio < 2, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(ATMO.lobby.fog);
scene.fog = new THREE.Fog(ATMO.lobby.fog, 22, 95);
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .5;
const camera = new THREE.PerspectiveCamera(60, 1, .05, 300);
const hemi = new THREE.HemisphereLight(0xfff1da, 0x6b5a44, 1.1); scene.add(hemi);
const key = new THREE.DirectionalLight(0xffe6c0, .9); key.position.set(4, 12, 6); scene.add(key);
const MAXANI = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const TL = new THREE.TextureLoader();
function tex(url, srgb = true) { const t = TL.load(url); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = MAXANI; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }
// 材質
const parquet = { map: tex("tex/floor_diff.webp"), normalMap: tex("tex/floor_nor.webp", false), roughnessMap: tex("tex/floor_rough.webp", false) };
const T_PLASTER = TX.plaster(), T_WOOD = TX.woodPanel(), T_STONE = TX.limestone(), T_MARBLE = TX.marble(), T_LAY = TX.laylight(), T_SOOT = TX.soot(), T_SHAFT = TX.shaft();
// 2026-10-07 本人「床材・壁の素材感もこだわる」：石の壁に凹凸（Poly Haven「Castle Brick 02 White」の法線・CC0）、大理石の床に磨きのむら（「Marble 01」の粗さと法線・CC0）
const stoneMat = new THREE.MeshStandardMaterial({ map: T_STONE, normalMap: tex("tex/b_nor.webp", false), normalScale: new THREE.Vector2(.45, .45), roughness: .85, envMapIntensity: .4 });
const marbleMat = new THREE.MeshStandardMaterial({ map: T_MARBLE, roughness: .28, metalness: 0, envMapIntensity: .9 });
const lobbyFloorMat = new THREE.MeshStandardMaterial({ map: TX.lobbyFloor(), roughnessMap: tex("tex/m_rough.webp", false), normalMap: tex("tex/m_nor.webp", false), normalScale: new THREE.Vector2(.3, .3), roughness: .55, envMapIntensity: 1.0 });
const woodMat = new THREE.MeshStandardMaterial({ map: T_WOOD, color: 0xd8c0a8, roughness: .55, envMapIntensity: .55 });
const darkWood = new THREE.MeshStandardMaterial({ color: 0x3a2516, roughness: .5, envMapIntensity: .5 });
const brassMat = new THREE.MeshStandardMaterial({ color: 0xc19a4b, metalness: .9, roughness: .3, envMapIntensity: 1.2 });
const giltMat = new THREE.MeshStandardMaterial({ color: 0xb08a3e, metalness: .85, roughness: .32, envMapIntensity: 1.1 });
const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a1d12, roughness: .5, metalness: .1 });
const sootMat = new THREE.MeshBasicMaterial({ map: T_SOOT, transparent: true, depthWrite: false });
const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff1c8, toneMapped: false });
// 2026-10-08 本人「広間の天井を 3D で」：格間は絵ではなく、丸天井から内へ出た枠（梁）で組む。丸天井そのものは格間の奥の色
const domeMat = new THREE.MeshStandardMaterial({ color: 0x86714f, side: THREE.BackSide, roughness: .9, envMapIntensity: .3 });
const oculusMat = new THREE.MeshBasicMaterial({ color: 0xfff6e2, toneMapped: false });
// 絨毯の毛足（Poly Haven「Dirty Carpet」の法線だけ・CC0。2026-10-08）。部屋の通路の UV は 2.4 m で一巡 → 毛足は 0.6 m ごと
const C_NOR = tex("tex/c_nor.webp", false); C_NOR.repeat.set(4, 4);
function runnerMat(cols) { const t = TX.runner(cols[0], cols[1]); return new THREE.MeshStandardMaterial({ map: t, normalMap: C_NOR, normalScale: new THREE.Vector2(.6, .6), roughness: .95, envMapIntensity: .2 }); }
// 窓の外（部屋ごとに一つの ShaderMaterial。空は見る向きで引くので、月や太陽は窓をまたいで同じ場所に見える）
const WIN_VS = `varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
const WIN_FS = `uniform float uT; uniform int uM; uniform vec3 uSun; varying vec2 vUv; varying vec3 vW;
float h1(float n){return fract(sin(n)*43758.5453);} float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn(p);p*=2.03;a*=.5;}return s;}
void main(){
  vec2 q=vec2((vUv.x-.5)*2.4, vUv.y*1.6); float Rr=1.2, sy=.4;
  float rr = q.y<sy ? abs(q.x) : length(vec2(q.x,q.y-sy));
  if(rr>Rr) discard;
  float edge=min(Rr-rr,q.y); vec3 fr=vec3(.13,.09,.05);
  if(edge<.07){ gl_FragColor=vec4(fr,1.); return; }
  float o=(vW.x+vW.z)*.13; vec2 u=vUv; vec3 d=normalize(vW-cameraPosition); float m=dot(d,normalize(uSun)); vec3 c;
  if(uM==1){ c=mix(vec3(.33,.37,.42),vec3(.19,.22,.27),u.y);
    if(u.y<.2+.07*fbm(vec2(u.x*3.+o,1.))) c=vec3(.11,.14,.14);
    float col=floor(u.x*70.+o*30.), r=h1(col); float y=fract(u.y*1.3+uT*(1.3+r)+r*13.);
    c+=vec3(.33,.37,.42)*smoothstep(0.,.03,y)*smoothstep(.17,.03,y)*step(.5,r);
    vec2 g=u*vec2(24.,17.); g.y+=uT*.05*h1(floor(g.x)); vec2 id=floor(g); vec2 f=fract(g)-.5; float dr=smoothstep(.2,.08,length(f*vec2(1.,1.5)))*step(.7,h2(id+o));
    c=mix(c,c*1.5+.06,dr*.7);
  } else if(uM==2){ c=mix(vec3(.64,.74,.8),vec3(.38,.5,.63),u.y);
    float n=fbm(vec2(u.x*2.2+uT*.14+o,u.y*3.)); c=mix(c,vec3(.92,.94,.95),smoothstep(.48,.78,n));
    if(u.y<.16+.05*sin(u.x*7.+o*3.)+.015*sin(u.x*40.+uT*3.)) c=vec3(.24,.35,.25);
  } else if(uM==3){ c=mix(vec3(.82,.86,.9),vec3(.63,.69,.76),u.y); if(u.y<.15+.04*fbm(vec2(u.x*4.+o,2.))) c=vec3(.92,.94,.97);
    for(int i=0;i<3;i++){ float fi=float(i); vec2 p=u*vec2(16.+fi*9.,11.+fi*6.); p.y+=uT*(.5+.3*fi); p.x+=sin(uT*.6+p.y*.4+fi)*.3; vec2 id=floor(p); vec2 f=fract(p)-.5-(vec2(h2(id+3.+fi),h2(id+5.+fi))-.5)*.5;
      c+=smoothstep(.13-.03*fi,0.,length(f))*step(.45,h2(id+fi*7.+o))*.6; }
  } else if(uM==4){ float n=fbm(u*vec2(5.,4.)+vec2(uT*.03+o,0.)); c=mix(vec3(.08,.19,.1),vec3(.27,.45,.22),n);
    c+=vec3(.9,.95,.5)*pow(fbm(u*vec2(14.,10.)+vec2(o,uT*.04)),3.)*1.1;
    c*=1.-.55*step(fract(u.x*3.+o)*1.,.07);
  } else if(uM==5){ c=mix(vec3(.99,.9,.7),vec3(.52,.7,.9),smoothstep(.2,1.,u.y)); c+=vec3(1.,.9,.6)*pow(max(m,0.),30.)*.5;
    if(u.y<.3){ float k=(u.x-.5)/(.33-u.y); c=mix(vec3(.58,.64,.27),vec3(.44,.5,.18),step(.5,fract(k*1.6+o))); c*=.85+.3*u.y/.3; }
    if(u.y>.29&&u.y<.34+.03*fbm(vec2(u.x*6.+o,0.))) c=vec3(.25,.33,.18);
  } else if(uM==6){ c=mix(vec3(.06,.08,.17),vec3(.01,.02,.06),u.y); vec2 id=floor((u+vec2(o,0.))*vec2(110.,78.)); float s=h2(id);
    c+=step(.984,s)*(.5+.5*sin(uT*2.+s*60.))*vec3(.9,.92,1.);
    c+=vec3(.97,.95,.85)*smoothstep(.9986,.9990,m)+vec3(.45,.5,.7)*pow(max(m,0.),250.)*.6;
    if(u.y<.14+.05*fbm(vec2(u.x*3.+o,4.))) c=vec3(.02,.03,.05);
  } else if(uM==7){ c=mix(vec3(1.,.6,.3),vec3(.3,.44,.7),smoothstep(0.,1.,u.y)); c+=vec3(1.,.92,.75)*smoothstep(.9975,.9982,m)*1.5+vec3(1.,.6,.3)*pow(max(m,0.),40.)*.7;
    if(u.y<.12+.04*fbm(vec2(u.x*5.+o,3.))) c=vec3(.18,.1,.08);
  } else if(uM==8){ c=mix(vec3(.93,.64,.38),vec3(.42,.37,.44),u.y); c+=vec3(1.,.7,.4)*pow(max(m,0.),30.)*.4;
    if(u.y<.24+.08*fbm(vec2(u.x*2.5+o,1.))) c=mix(vec3(.24,.14,.08),vec3(.34,.2,.11),fbm(u*vec2(30.,8.)));
  } else { c=mix(vec3(.9,.88,.82),vec3(.7,.76,.84),u.y); }
  if(abs(q.x)<.022 || abs(q.y-sy)<.02 || (q.y<sy && abs(abs(q.x)-.6)<.016)) c=fr*1.4;
  gl_FragColor=vec4(c,1.);
}`;
function winMat(mode, sun) { return new THREE.ShaderMaterial({ vertexShader: WIN_VS, fragmentShader: WIN_FS, uniforms: { uT: { value: 0 }, uM: { value: mode }, uSun: { value: sun } } }); }
const winMats = [];
// UV を世界の寸法に合わせる（1 枚＝s メートル）
function planeUV(w, h, sx, sy = sx) { const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * w / sx, uv.getY(k) * h / sy); return g; }
function boxUV(w, h, d, s) { const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv, n = g.attributes.normal; for (let k = 0; k < uv.count; k++) { const ax = Math.abs(n.getX(k)) > .5 ? [d, h] : Math.abs(n.getY(k)) > .5 ? [w, d] : [w, h]; uv.setXY(k, uv.getX(k) * ax[0] / s, uv.getY(k) * ax[1] / s); } return g; }
function radial(stops, size = 128) {
  const c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d");
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const poolMat = new THREE.MeshBasicMaterial({ map: radial([[0, "rgba(255,236,200,.62)"], [.45, "rgba(255,230,190,.24)"], [1, "rgba(255,230,190,0)"]]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const shadowMat = new THREE.MeshBasicMaterial({ map: radial([[0, "rgba(0,0,0,.5)"], [.6, "rgba(0,0,0,.2)"], [1, "rgba(0,0,0,0)"]]), transparent: true, depthWrite: false });
const blobMat = new THREE.MeshBasicMaterial({ map: radial([[0, "rgba(10,6,2,.45)"], [1, "rgba(10,6,2,0)"]]), transparent: true, depthWrite: false });

// 文字の板
const MINCHO = '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP","KRsub",serif', GOTH = '"Hiragino Sans","Yu Gothic","Noto Sans JP","KRsub",sans-serif';
document.fonts?.load('20px "KRsub"', "ᄆᆞᆰ구").catch(() => {});   // 3D の札（canvas）に描く前に、韓国語の字の書体を読んでおく（2026-10-08）
function textPlane(wm, hm, draw, px = 512) {
  const c = document.createElement("canvas"); c.width = px; c.height = Math.round(px * hm / wm); const g = c.getContext("2d"); draw(g, c.width, c.height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAXANI;
  return new THREE.Mesh(new THREE.PlaneGeometry(wm, hm), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
}
function fit(g, s, max, font, size) { let z = size; do { g.font = font.replace("%", z); z -= 2; } while (g.measureText(s).width > max && z > 10); }
function wrapLines(g, s, max) { const out = []; let line = ""; for (const ch of s) { if (g.measureText(line + ch).width > max) { out.push(line); line = ch; } else line += ch; } if (line) out.push(line); return out; }

// ---------------------------------------------------------------- 館を建てる（静かな部分は、部屋ごと・材質ごとに一つの形へまとめる＝描く回数を減らす）
const world = new THREE.Group(); scene.add(world);
const floors = [], clickables = [], bays = [], blockers = [], ceils = [];
const BUCKET = new Map();
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(1, 1, 1);
function put(tag, mat, geo, pos, rotY = 0, rotX = 0) {
  _e.set(rotX, rotY, 0, "YXZ"); _q.setFromEuler(_e); _m.compose(pos, _q, _s);
  const g = (geo.index ? geo.toNonIndexed() : geo); g.applyMatrix4(_m);
  for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
  const kk = tag + "|" + mat.uuid; if (!BUCKET.has(kk)) BUCKET.set(kk, { mat, geos: [], tag }); BUCKET.get(kk).geos.push(g);
}
const putAt = (tag, mat, geo, i, u, v, y, rotY) => { const p = W(i, u, v); p.y = y; put(tag, mat, geo, p, rotY); };
function flush() {
  for (const { mat, geos, tag } of BUCKET.values()) {
    const m = new THREE.Mesh(mergeGeometries(geos, false), mat); m.userData.tag = tag; world.add(m);
    if (/wall|wood|stone/.test(tag)) blockers.push(m);
    if (/ceil/.test(tag)) ceils.push(m);
  }
  BUCKET.clear();
}

const ctxDoors = [], SKY = {};
// 広間（hub）：大理石の床・石のアーチの壁（部屋の八面と玄関）・柱・丸天井・天の窓（オクルス）・まん中のワープ
const putF = (tag, mat, geo, f, u, v, y, rotY) => { const p = WF(f, u, v); p.y = y; put(tag, mat, geo, p, rotY); };
{
  const sh = new THREE.Shape();
  for (let k = 0; k < NF; k++) { const a = faceTh(k) + HA; const x = Math.sin(a) * RR, y = Math.cos(a) * RR; k ? sh.lineTo(x, y) : sh.moveTo(x, y); }
  const g = new THREE.ShapeGeometry(sh); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / 2.4, uv.getY(k) / 2.4);
  const f = new THREE.Mesh(g, lobbyFloorMat); f.rotation.x = -Math.PI / 2; world.add(f); floors.push(f);
  const face = 2 * R * Math.tan(HA);
  FACES.forEach((F, k) => {
    const room = rooms.includes(F) ? F : null, isLib = F === LIB_FACE, open = room || F === ENT || isLib;
    const DW = DOOR, SP = SPRING;   // 書架の間の入口も、ほかの部屋と同じ大きさ（2026-10-08 本人）
    const s = new THREE.Shape(); s.moveTo(-face / 2 - .3, 0); s.lineTo(face / 2 + .3, 0); s.lineTo(face / 2 + .3, LOBBY_H); s.lineTo(-face / 2 - .3, LOBBY_H); s.closePath();
    if (open) { const hole = new THREE.Path(); hole.moveTo(-DW, 0); hole.lineTo(DW, 0); hole.lineTo(DW, SP); hole.absarc(0, SP, DW, 0, Math.PI, false); hole.lineTo(-DW, 0); s.holes.push(hole); }
    const eg = new THREE.ExtrudeGeometry(s, { depth: .5, bevelEnabled: false, curveSegments: 20 });
    const ua = eg.attributes.uv; for (let q = 0; q < ua.count; q++) ua.setXY(q, ua.getX(q) / 2.2, ua.getY(q) / 2.2);
    putF("stone", stoneMat, eg, F, 0, 0, 0, -F.th);
    for (const sx of [-1, 1]) putF("stone2", marbleMat, new THREE.BoxGeometry((face - 2 * DW) / 2 - .3, .9, .1), F, -.53, sx * (DW + (face - 2 * DW) / 4 + .15), .45, -F.th);
    if (open) {
      putF("stone2", marbleMat, new THREE.TorusGeometry(DW + .08, .13, 8, 28, Math.PI), F, -.52, 0, SP, -F.th);
      for (const sx of [-1, 1]) putF("stone2", marbleMat, new THREE.BoxGeometry(.32, SP, .14), F, -.52, sx * (DW + .08), SP / 2, -F.th);
      putF("stone2", marbleMat, new THREE.BoxGeometry(.5, .7, .24), F, -.55, 0, SP + DW + .05, -F.th);
    }
    // 扉の上の題字（石に刻んだ）。部屋の名／玄関は館の名／壁の面は館の名と英語
    const title = room ? room.name : isLib ? NAMES.library : NAMES.museum, sub = room ? room.desc : isLib ? "本を手にとって読む部屋" : F === ENT ? "出口 ・ 玄関へ" : NAMES.museum_en;
    const t = textPlane(4.8, .95, (c, w, h) => {
      c.fillStyle = "rgba(60,44,26,.12)"; c.fillRect(0, 0, w, h);
      c.strokeStyle = "rgba(120,92,52,.65)"; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
      c.fillStyle = "#3a2a18"; fit(c, title, w * .8, `600 %px ${MINCHO}`, 104); c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(title, w / 2, h * .44);
      c.fillStyle = "#6b5332"; fit(c, sub, w * .86, `%px ${GOTH}`, 32); c.fillText(sub, w / 2, h * .82);
      if (room) { c.fillStyle = room.acc; c.fillRect(w / 2 - 60, h - 20, 120, 6); }
    }, 1024);
    const ty = open ? 6.4 : 4.2;
    const p = WF(F, -.53, 0); t.position.set(p.x, ty, p.z); t.rotation.y = -F.th; world.add(t);
    putF("brass", brassMat, new THREE.BoxGeometry(2.2, .06, .05), F, -.54, 0, ty + .55, -F.th);
    putF("wood", darkWood, new THREE.BoxGeometry(face + .8, .5, .7), F, -.7, 0, LOBBY_H - .25, -F.th);
  });
  for (const c of COLS) {
    put("marble", marbleMat, new THREE.CylinderGeometry(.48, .56, LOBBY_H - 1.3, 20), new THREE.Vector3(c.x, (LOBBY_H - 1.3) / 2 + .55, c.y));
    put("stone2", marbleMat, new THREE.BoxGeometry(1.35, .55, 1.35), new THREE.Vector3(c.x, .275, c.y));
    put("stone2", marbleMat, new THREE.BoxGeometry(1.25, .45, 1.25), new THREE.Vector3(c.x, LOBBY_H - .5, c.y));
  }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(RR, 44, 14, 0, Math.PI * 2, 0, Math.PI / 2 * .94), domeMat); dome.scale.y = .42; dome.position.y = LOBBY_H; world.add(dome); ceils.push(dome);
  // 2026-10-07 本人「広間の天井をさらにこだわる（格天井・ドーム・天窓・梁・装飾の彫り・間接光）」：
  //   丸天井の付け根に金の蛇腹（二段の輪）と、その上の間接光の帯、柱の上から天窓へのびる十一本の肋（リブ）、肋のあいだの格間の金の花（ロゼット）
  { const ringM = new THREE.MeshStandardMaterial({ color: 0xc9a45c, metalness: .8, roughness: .3, envMapIntensity: 1.1 });
    for (const [rr, y, t] of [[RR - .35, LOBBY_H + .02, .16], [RR - .6, LOBBY_H + .3, .09]]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, t, 8, 88), ringM); ring.rotation.x = Math.PI / 2; ring.position.y = y; world.add(ring); }
    const cove = new THREE.Mesh(new THREE.CylinderGeometry(RR - .7, RR - .7, .22, 88, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: .55, side: THREE.BackSide, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
    cove.position.y = LOBBY_H + .5; world.add(cove);
    const ribM = new THREE.MeshStandardMaterial({ map: T_MARBLE, color: 0xe8dcc4, roughness: .35, envMapIntensity: .8 });
    // 3D の格天井（2026-10-08）：丸天井の面に沿って、横の輪（6 本）と縦の枠（一面に 2 本×11）を内へ 0.3 m 出し、その奥に格間。格間ごとに金の花（一つの InstancedMesh）
    { const frameM = new THREE.MeshStandardMaterial({ color: 0xd9ccb0, roughness: .6, envMapIntensity: .6, side: THREE.DoubleSide });
      const PH = [.06, .3, .52, .74, .95, 1.16, 1.36].map(x => Math.min(x, Math.PI / 2 * .94 - .04));
      const at = (a, ph, k = .992) => { const rr = RR * Math.cos(ph) * k; return new THREE.Vector3(Math.sin(a) * rr, LOBBY_H + RR * .42 * Math.sin(ph) * k - .02, -Math.cos(a) * rr); };
      const geos = [];
      for (const ph of PH.slice(1)) {   // 横の輪：四角い断面の輪（下向きに厚み）
        const rr = RR * Math.cos(ph) * .985, y = LOBBY_H + RR * .42 * Math.sin(ph) * .985 - .02;
        const lat = new THREE.LatheGeometry([new THREE.Vector2(rr + .05, y + .12), new THREE.Vector2(rr - .28, y + .1), new THREE.Vector2(rr - .3, y - .12), new THREE.Vector2(rr + .05, y - .14)], 88);
        geos.push(lat);
      }
      for (let k = 0; k < NF; k++) for (const m of [1, 2]) {   // 縦の枠（主な肋のあいだに二本ずつ）
        const a = faceTh(k) + HA + m * 2 * HA / 3, pts = []; for (let j = 0; j <= 12; j++) pts.push(at(a, PH[0] + (PH.at(-1) - PH[0]) * j / 12, .975));
        geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, .13, 4, false));
      }
      for (const gg of geos) { const ms = new THREE.Mesh(gg, frameM); world.add(ms); }
      const rosG = new THREE.SphereGeometry(.16, 10, 6); rosG.scale(1, 1, .45);
      const n = NF * 3 * (PH.length - 1), ros = new THREE.InstancedMesh(rosG, ringM, n), mm = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1); let c = 0;
      for (let k = 0; k < NF; k++) for (let m = 0; m < 3; m++) for (let j = 0; j < PH.length - 1; j++) {
        const a = faceTh(k) + HA + (m + .5) * 2 * HA / 3, ph = (PH[j] + PH[j + 1]) / 2, p = at(a, ph, .995);
        const nrm = new THREE.Vector3(p.x, (p.y - LOBBY_H) / (.42 * .42), p.z).normalize().negate();   // 丸天井の内向きの法線
        q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm); mm.compose(p, q, one); ros.setMatrixAt(c++, mm);
      }
      ros.count = c; world.add(ros);
      // 付け根の蛇腹（段のついた張り出し）。間接光の帯はこの段の上に隠れる
      const cor = new THREE.LatheGeometry([[RR - .02, LOBBY_H - .35], [RR - .55, LOBBY_H - .35], [RR - .55, LOBBY_H - .2], [RR - .8, LOBBY_H - .1], [RR - .8, LOBBY_H + .02], [RR - 1.0, LOBBY_H + .1], [RR - 1.0, LOBBY_H + .3], [RR - .7, LOBBY_H + .34]].map(([x, y]) => new THREE.Vector2(x, y)), 88);
      world.add(new THREE.Mesh(cor, new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: .5, envMapIntensity: .7, side: THREE.DoubleSide })));
    }
    for (let k = 0; k < NF; k++) {
      const a = faceTh(k) + HA, pts = [];
      for (let j = 0; j <= 16; j++) { const ph = (j / 16) * Math.PI / 2 * .94, rr = (RR - .15) * Math.sin(Math.PI / 2 - ph) * .995; pts.push(new THREE.Vector3(Math.sin(a) * rr, LOBBY_H + (RR - .15) * .42 * Math.sin(ph) - .05, -Math.cos(a) * rr)); }
      const rib = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, .22, 4, false), ribM); world.add(rib);
      const mid = Math.PI / 2 * .5, ra = faceTh(k), rr2 = (RR - .3) * Math.sin(Math.PI / 2 - mid) * .98;
      const ros = new THREE.Mesh(new THREE.CircleGeometry(.32, 12), ringM); ros.position.set(Math.sin(ra) * rr2, LOBBY_H + (RR - .3) * .42 * Math.sin(mid) - .12, -Math.cos(ra) * rr2); ros.lookAt(0, LOBBY_H - 4, 0); world.add(ros);
    } }
  const ocuY = LOBBY_H + RR * .42 * Math.cos(Math.PI / 2 * .94) - .02, ocuR = RR * Math.sin(Math.PI / 2 * .06) + .4;
  const ocu = new THREE.Mesh(new THREE.CircleGeometry(ocuR, 40), oculusMat); ocu.rotation.x = Math.PI / 2; ocu.position.y = ocuY; world.add(ocu);
  // 外から見える丸屋根（緑青）と、その下の胴
  const outDome = new THREE.Mesh(new THREE.SphereGeometry(RR + .6, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5f8a78, roughness: .6, metalness: .3, envMapIntensity: .6 })); outDome.scale.y = .46; outDome.position.y = LOBBY_H + .2; world.add(outDome);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(RR + .6, RR + .6, 1.2, 44, 1, true), stoneMat); drum.position.y = LOBBY_H - .3; world.add(drum);
  // オクルスから落ちる光の柱（まん中のワープへ）
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(ocuR * .8, 1.5, LOBBY_H + 6, 32, 1, true), new THREE.MeshBasicMaterial({ map: T_SHAFT, color: 0xfff0d0, transparent: true, opacity: .2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beam.position.y = (LOBBY_H + 6) / 2; world.add(beam);
}

// ワープ（光の輪）：広間のまん中と、図書館のまん中の二つ。踏むと、もう一方へ移る
const warpMat = new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform float uT; varying vec2 vUv; void main(){ vec2 p=vUv-.5; float r=length(p)*2.; float a=atan(p.y,p.x);
    float sw=.5+.5*sin(a*5.+r*9.-uT*1.6); float ring=smoothstep(1.,.86,r); float edge=smoothstep(.78,.9,r)*smoothstep(1.,.92,r);
    vec3 c=mix(vec3(1.,.86,.55),vec3(.45,.86,.8),r)*(.35+.4*sw)+vec3(1.,.9,.6)*edge*1.2; gl_FragColor=vec4(c*ring,ring*(.4+.35*sw)+edge); }`,
});
const warps = [];
function makeWarp(y, label) {
  const g = new THREE.Group(); g.position.set(WARP.x, y, WARP.z); world.add(g);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.25, 48), warpMat); disc.rotation.x = -Math.PI / 2; disc.position.y = .012; g.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.32, .06, 8, 64), brassMat); ring.rotation.x = Math.PI / 2; ring.position.y = .03; g.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.62, .03, 6, 64), brassMat); ring2.rotation.x = Math.PI / 2; ring2.position.y = .02; g.add(ring2);
  const t = textPlane(3.2, .5, (c, w, h) => { c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "rgba(231,207,147,.95)"; fit(c, label, w * .95, `600 %px ${MINCHO}`, Math.round(h * .62)); c.fillText(label, w / 2, h / 2); }, 1024);
  t.rotation.x = -Math.PI / 2; t.position.set(0, .015, 2.2); g.add(t);
  disc.userData = { warp: true }; clickables.push(disc);
  warps.push({ g, disc, ring });
  return g;
}
// 光の輪（ワープ）は 2026-10-07 にやめた。図書館は円堂の扉の奥の一室

// 入口の外：玄関の間・正面（柱廊・破風・扉）・階段・前庭・街灯・木・空
{
  const vf = new THREE.MeshStandardMaterial({ map: TX.lobbyFloor(), roughness: .25, envMapIntensity: .8 });
  const fl = new THREE.Mesh(planeUV(2 * DOOR + .6, VEST + .4, 2.4), vf); fl.rotation.x = -Math.PI / 2; const c = E(VEST / 2); fl.position.set(c.x, .002, c.z); fl.rotation.z = -ENT.th; world.add(fl); floors.push(fl);
  for (const s of [-1, 1]) putF("stone", stoneMat, boxUV(VEST, 6.6, .4, 2.2), ENT, VEST / 2, s * (DOOR + .4), 3.3, Math.PI / 2 - ENT.th);
  { const p = E(VEST / 2); p.y = 6.6; put("ceilv", darkWood, new THREE.PlaneGeometry(2 * DOOR + .8, VEST), p, -ENT.th, Math.PI / 2); }
  for (let u = .6; u < VEST; u += 1.4) putF("wood", darkWood, new THREE.BoxGeometry(2 * DOOR + .8, .3, .22), ENT, u, 0, 6.45, -ENT.th);
  // 正面の壁（扉の穴）
  const FW = 3.4, FH = 7.4;   // 2026-10-07：外へは出ないので、正面の壁は扉のまわりだけ（書架の部屋とぶつからないように）
  const s = new THREE.Shape(); s.moveTo(-FW, 0); s.lineTo(FW, 0); s.lineTo(FW, FH); s.lineTo(-FW, FH); s.closePath();
  const hole = new THREE.Path(); hole.moveTo(-2.2, 0); hole.lineTo(2.2, 0); hole.lineTo(2.2, 3.6); hole.absarc(0, 3.6, 2.2, 0, Math.PI, false); hole.lineTo(-2.2, 0); s.holes.push(hole);
  const fg = new THREE.ExtrudeGeometry(s, { depth: .8, bevelEnabled: false, curveSegments: 20 }); const fu = fg.attributes.uv; for (let q = 0; q < fu.count; q++) fu.setXY(q, fu.getX(q) / 2.2, fu.getY(q) / 2.2);
  putF("stone", stoneMat, fg, ENT, VEST, 0, 0, Math.PI - ENT.th);
  putF("stone2", marbleMat, new THREE.TorusGeometry(2.32, .16, 8, 28, Math.PI), ENT, VEST + .85, 0, 3.6, Math.PI - ENT.th);
  // 扉（二枚・厚い木・真鍮の把手）。近づくと内へひらく
  const doorMat = new THREE.MeshStandardMaterial({ map: T_WOOD, color: 0x8a6a52, roughness: .5 });
  ctxDoors.length = 0;
  for (const sgn of [-1, 1]) {
    const pivot = new THREE.Group(); const hp = E(VEST - .08, sgn * 2.2); pivot.position.set(hp.x, 0, hp.z); pivot.rotation.y = -ENT.th; world.add(pivot);
    const leaf = new THREE.Mesh(boxUV(2.2, 5.6, .14, 2.4), doorMat); leaf.position.set(-sgn * 1.1 * 1, 2.8, 0); pivot.add(leaf);
    const hd = new THREE.Mesh(new THREE.BoxGeometry(.06, .5, .1), brassMat); hd.position.set(-sgn * 1.95, 1.2, .12); pivot.add(hd);
    for (let y = .8; y < 5.4; y += 1.1) for (let x = .35; x < 2.1; x += .55) { const st = new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 4), brassMat); st.position.set(-sgn * x, y, .08); pivot.add(st); }
    ctxDoors.push({ pivot, sgn });
  }
  // 柱廊・階段・破風は 2026-10-07 に外した（はじめから館の中に立つので、外は見えない。書架の部屋の場所をあけた）
  // 前庭（石畳）と、まわりの地面
  const gm = new THREE.MeshStandardMaterial({ map: T_STONE, color: 0x9a8a74, roughness: .95 });
  const gr = new THREE.Mesh(planeUV(500, 500, 3), gm); gr.rotation.x = -Math.PI / 2; gr.position.y = PLAZA_Y - .01; world.add(gr); floors.push(gr);
  const lawn = new THREE.MeshStandardMaterial({ color: 0x3e5a32, roughness: 1 });
  for (const sgn of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(26, PLAZA - STEPS), lawn); m.rotation.x = -Math.PI / 2; const p = E((STEPS + PLAZA) / 2, sgn * 22); m.position.set(p.x, PLAZA_Y + .005, p.z); world.add(m); }
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe2a8, toneMapped: false });
  for (const u of [STEPS + 5, STEPS + 15, STEPS + 25]) for (const sgn of [-1, 1]) {
    const p = E(u, sgn * 6);
    put("ironpost", darkWood, new THREE.CylinderGeometry(.07, .1, 3.6, 8), new THREE.Vector3(p.x, PLAZA_Y + 1.8, p.z));
    const gl = new THREE.Mesh(new THREE.SphereGeometry(.24, 14, 10), lampGlow); gl.position.set(p.x, PLAZA_Y + 3.75, p.z); world.add(gl);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(p.x, PLAZA_Y + .02, p.z); world.add(pool);
  }
  const leafM = new THREE.MeshStandardMaterial({ color: 0x2f4a2a, roughness: 1, flatShading: true }), barkM = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 });
  for (let k = 0; k < 10; k++) { const sgn = k % 2 ? 1 : -1, u = STEPS + 3 + Math.floor(k / 2) * 7, p = E(u, sgn * (15 + (k % 3) * 2.5));
    put("bark", barkM, new THREE.CylinderGeometry(.18, .3, 4, 7), new THREE.Vector3(p.x, PLAZA_Y + 2, p.z));
    for (let q = 0; q < 3; q++) put("leaf", leafM, new THREE.IcosahedronGeometry(2.2 - q * .4, 1), new THREE.Vector3(p.x + (q - 1) * .6, PLAZA_Y + 4.2 + q * 1.3, p.z + (q % 2) * .5)); }
  // 空（夕方の色。霧の外）
  const sky = new THREE.Mesh(new THREE.SphereGeometry(260, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 vP; void main(){ float h=normalize(vP).y; vec3 c=mix(vec3(.94,.74,.54),vec3(.24,.36,.6),smoothstep(-.02,.55,h)); c=mix(c,vec3(.5,.42,.36),smoothstep(.0,-.2,h)); gl_FragColor=vec4(c,1.); }` }));
  sky.renderOrder = -10; world.add(sky); SKY.mesh = sky;
}

const ZONE_COL = ["#b0703a", "#5f8a4a", "#3f7a9a", "#8a5a7a", "#a08a3a", "#4a8a7a", "#7a7a7a"];
// 部屋：寄木の床と絨毯・漆喰の壁と木の腰板・真鍮の手すり・軒・高窓・格天井と天窓・袖壁（ベイの区切り）・題字
const roomMats = [];
for (const r of rooms) {
  const A = ATMO[r.slug] || ATMO.tsuchi, i = r.i;
  const fm = new THREE.MeshStandardMaterial({ ...parquet, color: A.wet ? 0x6e5a48 : 0xa88464, roughness: A.wet ? .22 : .62, envMapIntensity: A.wet ? 1.5 : .5 });
  fm.normalScale.set(.6, .6);
  const wm = new THREE.MeshStandardMaterial({ map: T_PLASTER, color: A.wall, roughness: .9, envMapIntensity: .35 });
  const cm = new THREE.MeshStandardMaterial({ color: A.ceil, roughness: .9 });
  const lm = new THREE.MeshBasicMaterial({ map: T_LAY, color: A.lay, toneMapped: false });
  const sun = new THREE.Vector3(r.p.x + r.d.x * .35, .62, r.p.y + r.d.y * .35).normalize();
  const wn = winMat(A.win || 0, sun); winMats.push(wn);
  roomMats.push({ fm, wm, cm, lm, wn });
  const rot = -r.th, L = r.L, c = W(i, L / 2, 0);
  const f = new THREE.Mesh(planeUV(2 * HALF, L, 2.2), fm); f.rotation.set(-Math.PI / 2, 0, rot); f.position.set(c.x, 0, c.z); world.add(f); floors.push(f);
  const rn = new THREE.Mesh(planeUV(2.4, L - 1.2, 2.4, 2.4), runnerMat(A.run)); rn.rotation.set(-Math.PI / 2, 0, rot); const rc = W(i, (L - 1.2) / 2 + .6, 0); rn.position.set(rc.x, .004, rc.z); world.add(rn);
  if (A.wet) {   // 雨の部屋：床に水たまり（映り込みのつよい暗い面）
    const pud = new THREE.MeshStandardMaterial({ color: 0x0f141a, roughness: .04, metalness: .3, transparent: true, opacity: .55, envMapIntensity: 2 });
    for (let k = 0; k < Math.floor(L / 6); k++) { const q = W(i, 5 + k * 6 + (k % 2) * 2, (k % 3 - 1) * 1.6); const pdm = new THREE.Mesh(new THREE.CircleGeometry(.9 + (k % 3) * .3, 28), pud); pdm.rotation.x = -Math.PI / 2; pdm.scale.set(1.4, .8, 1); pdm.rotation.z = k; pdm.position.set(q.x, .007, q.z); world.add(pdm); }
  }
  for (const s of [-1, 1]) {
    const face = s < 0 ? Math.atan2(r.p.x, r.p.y) : Math.atan2(-r.p.x, -r.p.y);
    putAt("wall" + i, wm, boxUV(L, WALL_H, .3, 2.5), i, L / 2, s * (HALF + .15), WALL_H / 2, Math.PI / 2 - r.th);
    putAt("wood" + i, woodMat, planeUV(L, 1.05, 2.4, 1.05), i, L / 2, s * (HALF - .035), .525, face);
    putAt("wood" + i, darkWood, new THREE.BoxGeometry(L, .08, .1), i, L / 2, s * (HALF - .06), 1.08, Math.PI / 2 - r.th);
    putAt("brass" + i, brassMat, new THREE.BoxGeometry(L, .035, .05), i, L / 2, s * (HALF - .12), 1.14, Math.PI / 2 - r.th);
    putAt("wood" + i, darkWood, new THREE.BoxGeometry(L, .07, .06), i, L / 2, s * (HALF - .03), 4.02, Math.PI / 2 - r.th);
    putAt("wood" + i, darkWood, new THREE.BoxGeometry(L, .32, .34), i, L / 2, s * (HALF - .17), WALL_H - .16, Math.PI / 2 - r.th);
    putAt("soot" + i, sootMat, new THREE.PlaneGeometry(L, 1.3), i, L / 2, s * (HALF - .01), WALL_H - .97, face);
    for (let m = 0; m < r.rows; m++) {
      const u = FOY + m * BAY + BAY / 2;
      putAt("win" + i, wn, new THREE.PlaneGeometry(2.4, 1.6), i, u, s * (HALF - .012), 4.22 + .8, face);
      putAt("wood" + i, darkWood, new THREE.BoxGeometry(2.7, .08, .14), i, u, s * (HALF - .07), 4.18, Math.PI / 2 - r.th + Math.PI / 2);
      if (A.shaft && s > 0) {   // 窓から斜めに落ちる光の筋
        const top = W(i, u, s * (HALF - .2)); top.y = 4.9; const bot = W(i, u + 1.4, -s * .8); bot.y = 0;
        const dir = bot.clone().sub(top), len = dir.length(); dir.normalize();
        const yAx = dir.clone().negate(), zAx = new THREE.Vector3(r.d.x, 0, r.d.y); zAx.sub(yAx.clone().multiplyScalar(zAx.dot(yAx))).normalize(); const xAx = yAx.clone().cross(zAx);
        const sm = new THREE.Mesh(new THREE.PlaneGeometry(2.0, len), new THREE.MeshBasicMaterial({ map: T_SHAFT, color: A.shaft, transparent: true, opacity: .13, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
        sm.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAx, yAx, zAx)); sm.position.copy(top).addScaledVector(dir, len / 2); world.add(sm);
      }
    }
    for (let m = 0; m <= r.rows; m++) {
      putAt("wood" + i, woodMat, boxUV(.18, 3.75, FIN, 2.4), i, FOY + m * BAY, s * (HALF - FIN / 2), 1.875, -r.th);
      putAt("brass" + i, brassMat, new THREE.BoxGeometry(.22, .05, FIN + .04), i, FOY + m * BAY, s * (HALF - FIN / 2), 3.77, -r.th);
    }
  }
  putAt("wall" + i, wm, boxUV(2 * HALF + .6, WALL_H, .3, 2.5), i, L + .15, 0, WALL_H / 2, -r.th);
  putAt("wood" + i, woodMat, planeUV(2 * HALF, 1.05, 2.4, 1.05), i, L - .035, 0, .525, Math.PI - r.th);
  // 格天井：天井の面・梁（横と縦）・天窓のガラス
  { const p = W(i, L / 2, 0); p.y = WALL_H; put("ceil" + i, cm, new THREE.PlaneGeometry(2 * HALF, L), p, rot, Math.PI / 2); }
  { const p = W(i, L / 2, 0); p.y = WALL_H - .03; put("lay" + i, lm, planeUV(3.2, L - 2, 1.6, 1.6), p, rot, Math.PI / 2); }
  for (let u = .8; u < L; u += 1.6) putAt("wood" + i, darkWood, new THREE.BoxGeometry(2 * HALF, .24, .2), i, u, 0, WALL_H - .12, -r.th);
  for (const v of [-1.65, 1.65, -HALF + .35, HALF - .35]) putAt("wood" + i, darkWood, new THREE.BoxGeometry(L, .26, .22), i, L / 2, v, WALL_H - .13, Math.PI / 2 - r.th);
  // 奥の壁の題字
  const t = textPlane(6, 1.5, (g, w, h) => {
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = r.acc; g.fillRect(w / 2 - 50, 8, 100, 8);
    g.fillStyle = "#f3e9d3"; fit(g, r.name, w * .9, `600 %px ${MINCHO}`, 140); g.fillText(r.name, w / 2, h * .45);
    g.fillStyle = "#d8c9a8"; fit(g, r.desc, w * .9, `%px ${GOTH}`, 44); g.fillText(r.desc, w / 2, h * .85);
  }, 1024);
  { const p = W(i, L - .02, 0); t.position.set(p.x, 2.6, p.z); t.rotation.y = Math.PI - r.th; world.add(t); }
  for (const k of r.kei) makeBay(r, k);
  // 区画（鳥・けもの…）：区画のはじまりに吊り札、床の縁に区画の色の帯（2026-10-07 本人「見てすぐ分かる区画にする（床の色・棚・札・照明・音で区切る）」）
  (r.zones || []).forEach((z, zi) => {
    const ks = r.kei.filter(k => k.genre === zi); if (!ks.length) return;
    const r0 = Math.min(...ks.map(k => k.row)), r1 = Math.max(...ks.map(k => k.row)), u0 = FOY + r0 * BAY, u1 = FOY + (r1 + 1) * BAY, col = ZONE_COL[zi % ZONE_COL.length];
    z.u0 = u0; z.u1 = u1; z.col = col;
    for (const sx of [-1, 1]) { const st = new THREE.Mesh(new THREE.PlaneGeometry(.16, u1 - u0 - .3), new THREE.MeshStandardMaterial({ color: col, roughness: .7 })); const c = W(i, (u0 + u1) / 2, sx * 1.42); st.rotation.set(-Math.PI / 2, 0, rot); st.position.set(c.x, .006, c.z); world.add(st); }
    if (r.zones.length < 2) return;
    const t = textPlane(2.6, .62, (g, w, h) => { g.fillStyle = "rgba(24,17,10,.92)"; g.fillRect(0, 0, w, h); g.fillStyle = col; g.fillRect(0, 0, 18, h); g.fillRect(w - 18, 0, 18, h);
      g.strokeStyle = "#c9a45c"; g.lineWidth = 5; g.strokeRect(3, 3, w - 6, h - 6); g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = "#f3e7cf"; fit(g, z.name, w * .8, `600 %px ${MINCHO}`, Math.round(h * .5)); g.fillText(z.name, w / 2, h * .42);
      g.fillStyle = "#d8c9a8"; fit(g, `${z.sub}　${ks.length} 景`, w * .8, `%px ${GOTH}`, Math.round(h * .2)); g.fillText(`${z.sub}　${ks.length} 景`, w / 2, h * .8); }, 1024);
    const c = W(i, u0 + .25, 0); t.position.set(c.x, 4.15, c.z); t.rotation.y = -r.th; world.add(t);   // 円堂の側から来る人に向ける
    for (const sx of [-1, 1]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, WALL_H - 4.46, 4), brassMat); const q = W(i, u0 + .25, sx * 1.1); ch.position.set(q.x, 4.46 + (WALL_H - 4.46) / 2, q.z); world.add(ch); }
  });
}
flush();

// 入口の一枚：木の衝立に、いきもの百景「蛙」のモチェの蛙の壺（シカゴ美術館・CC0）を掛ける
const FEAT = (() => {
  for (const r of rooms) for (const k of r.kei) if (k.id === "kaeru") { const w = k.works.find(x => fname(x.f) === "kaeru03.jpg"); if (w) return { r, k, w }; }
  const r = rooms[0], k = r.kei[0]; return { r, k, w: k.works.find(x => x.f) };
})();
// 入口の一枚は 2026-10-07 にやめた（本人「入口の一枚（作品）は不要」）
const featBay = null;

// 鳴き声（さわったとき）：商用可（CC BY）の、その種の録音だけ。無い種は鳴かせない（素材台帳 M-0786〜0788）
const CALLS = {
  uguisu: { f: "snd/call_uguisu.m4a", label: "ウグイスのさえずり", who: "nnn（日本語版ウィキペディアの利用者）", lic: "CC BY 2.1 JP", licurl: "https://creativecommons.org/licenses/by/2.1/jp/", page: "https://commons.wikimedia.org/wiki/File:Uguisu5707.ogg" },
  tsubame: { f: "snd/call_tsubame.m4a", label: "ツバメの声（北米の亜種）", who: "Justin Wasack", lic: "CC BY 3.0", licurl: "https://creativecommons.org/licenses/by/3.0/", page: "https://commons.wikimedia.org/wiki/File:BarnSwallows.ogg" },
  sagi: { f: "snd/call_sagi.m4a", label: "ダイサギの声", who: "Stanislas Wroza", lic: "CC BY 4.0", licurl: "https://creativecommons.org/licenses/by/4.0/", page: "https://commons.wikimedia.org/wiki/File:Great_Egret_(Ardea_alba_alba)_call.ogg" },
  suzume: { f: "snd/call_suzume.m4a", label: "スズメの群れのさえずり（フィンランドで録音）", who: "Yle Arkisto（フィンランド放送協会の音の書庫）", lic: "CC BY 4.0", licurl: "https://creativecommons.org/licenses/by/4.0/", page: "https://freesound.org/people/YleArkisto/sounds/339307/" },
};
CALLS.suzume2 = CALLS.suzume;   // いきもの百景の雀も同じ種（スズメ Passer montanus）
function playCall(id, pos) {
  const c = CALLS[id]; if (!c || !AUD.ctx || AUD.muted) return;
  AUD.buffer(c.f).then(b => { const s = AUD.ctx.createBufferSource(), g = AUD.ctx.createGain(), pn = AUD.ctx.createPanner(); pn.panningModel = "HRTF"; pn.distanceModel = "inverse"; pn.refDistance = 2;
    if (pos) { pn.positionX.value = pos.x; pn.positionY.value = pos.y; pn.positionZ.value = pos.z; } g.gain.value = .9; s.buffer = b; s.connect(g); g.connect(pn); pn.connect(AUD.master); s.start(); }).catch(() => {});
}
function syncListener() { const L = AUD.ctx?.listener; if (!L || !L.positionX) return; L.positionX.value = camera.position.x; L.positionY.value = camera.position.y; L.positionZ.value = camera.position.z;
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }

// 企画展「絵から出てくる生きもの」（2026-10-07 本人）：円堂の扉のわき（その部屋の生きもの）と、左右の壁。素材は data/anim.js（CC0／PD だけ）
const animWork = a => { const r = rooms.find(x => x.slug === a.room), k = r?.kei.find(x => x.id === a.kei); return { r, k, w: k?.works[a.wi] }; };
// 碧の場所（生きものが碧へ近づき、手にとまるため）。碧が見えていないときは null
const _hv = new THREE.Vector3(), _hd = new THREE.Vector3();
function getAoi() {
  if (!vrm || !aoi || !aoi.visible || mode !== "walk" || space !== "museum" || !A.pos) return null;
  const hb = vrm.humanoid?.getRawBoneNode?.("leftHand"), hd = vrm.humanoid?.getRawBoneNode?.("head");
  return { pos: new THREE.Vector3(A.pos.x, 0, A.pos.z), hand: hb ? hb.getWorldPosition(_hv).clone() : new THREE.Vector3(A.pos.x, 1.1, A.pos.z), head: hd ? hd.getWorldPosition(_hd).clone() : new THREE.Vector3(A.pos.x, 1.5, A.pos.z) };
}
const EX = createExhibit({ THREE, world, rooms, FACES, WF, R, OBST, darkWood, poolMat, clickables, giltMat, brassMat, camera, getRM: () => RM, getAoi,
  labelCard: (a, r, wm) => labelCard(animWork(a).w || { title: a.name }, wm), onLanded: it => { if (guideIt === it) guideIt = null; } });
// 部屋の中の絵からも生きものが抜け出る（2026-10-08 本人）：data/anim.js の切り抜きのうち、その絵が部屋の景に掛かっているもの（CC0／PD だけ）
for (const a of window.ANIM || []) {
  const r = rooms.find(x => x.slug === a.room), k = r?.kei.find(x => x.id === a.kei), bay = k?.bay; if (!bay) continue;
  const sl = bay.slots.find(s => !s.quote && s.w && fname(s.w.f) === fname(a.img || a.full)); if (!sl) continue;
  if (!/^(CC0|パブリックドメイン)/.test((sl.w.lic || "").trim())) continue;
  const ar = a.size[0] / a.size[1]; let ww = sl.mw, hh = ww / ar; if (hh > sl.mh) { hh = sl.mh; ww = hh * ar; }
  EX.attach(a, r, bay.g, sl.x, sl.y, .07 + .064, ww, hh, k.side, k.u);
}
CALLS.suzume3 = CALLS.suzume; CALLS.tsubame2 = CALLS.tsubame;
// 2026-10-09 本人「生き物は絵を見たときに出てきて、説明が終わるときには絵に帰る。それ以外の時は飛んでないで」
//   碧がその絵の説明を始めたら抜け出し（bound）、説明が終わる（とめた・離れたを含む）と絵へ帰る
function bindCreatures(list) {
  if (RM) return () => {};
  const its = list.filter(it => it && it.state === "rest");
  for (const it of its) { it.bound = true; EX.start(it, "show"); }
  return () => { for (const it of its) it.bound = false; };
}
const roomCreatures = (slug, kid, f) => EX.roomItems.filter(it => it.a.room === slug && it.a.kei === kid && (!f || fname(it.a.img || "") === fname(f)));
// 館の 3D 模型・3D 地図・部屋の立体の札（holo.js・2026-10-09 本人）
const HOLO = createHolo({ THREE, scene, camera, rooms, ENT, LIB_FACE, NF, faceTh, HA, R, HALF, DOOR, VEST, LIB, libWorld, NAMES, GOTH, MINCHO,
  onOpen: () => { $("holoBar").hidden = false; }, onClose: () => { $("holoBar").hidden = true; } });
OBST.push({ x: 0, z: -1.9, r: 1.2 });   // 広間のまん中の台
function holoAct(h) {
  if (h.t === "open") { HOLO.open(); if (T.idle?.map3d && !SP.resolve) freeTalk([T.idle.map3d]); return; }
  if (h.t === "room") { if (HOLO.open_ && HOLO.focus !== h.i) { HOLO.setFocus(h.i); return; } HOLO.close(); HOLO.hideRoom(); if (tour.on && !tour.susp) suspendTour(); intro.tok++; enterRoom(h.i, () => freeTalk([T.rooms[h.i].intro[0]])); return; }
  if (h.t === "zone") { const r = rooms[h.i], z = r.zones[h.zi]; HOLO.close(); HOLO.hideRoom(); hideZones(); if (tour.on && !tour.susp) suspendTour(); intro.tok++;
    const go = () => { walkTo(W(r.i, z.u0 + 1.0, 0)); me.faceTo = W(r.i, z.u1 + 4, 0); };
    const reg = region(me.pos.x, me.pos.z); if (reg.kind === "room" && reg.i === h.i) go(); else enterRoom(h.i, go); return; }
  if (h.t === "lib") { HOLO.close(); goWarp(); return; }
  if (h.t === "hub") { HOLO.close(); goHome(); return; }
}
$("holoClose").onclick = () => HOLO.close();
$("holo2d").onclick = () => { HOLO.close(); openMap(); };
let guideIt = null;
function animTapped(it) {
  if (tour.on && !tour.susp) suspendTour();
  intro.tok++; closeAll();
  const { k, w } = animWork(it.a), L = (T.anim || {})[it.a.id] || {};
  const n = new THREE.Vector3(0, 0, 1).applyQuaternion(it.g.quaternion), look = it.g.position.clone().setY(0), stand = look.clone().addScaledVector(n, 2.9);
  const acts = [["ついて行く", () => followAnim(it), true], ["札をひらく", () => k && openPanel(k, w)], ["自由に歩く", () => freeTalk(T.idle.free)]];
  goTo(stand, look, () => { const rel = bindCreatures([it]); talk([L.work, L.come].filter(Boolean), acts).then(rel); });
}
function followAnim(it) {   // 生きものが扉まで行き、見る人がついて行く。着いたら絵へもどる
  const L = (T.anim || {})[it.a.id] || {}, i = it.r.i;
  hush(); guideIt = it;
  const go = () => { EX.guide(it); talk([L.guide].filter(Boolean), []); setTimeout(() => goTo(W(i, 1.6, 0), W(i, 12, 0), () => { EX.release(it); freeTalk([L.arrive].filter(Boolean)); }), RM ? 0 : 1600); };
  if (it.state !== "rest") EX.abort(it);
  go();
}

// 図書館（書架の部屋）：円堂の扉の奥。部屋の中の座標で建てて、箱ごと置く
const libG = new THREE.Group(); libG.position.copy(LIBO.p); libG.rotation.y = LIBO.th; world.add(libG);
const LB = new Map();
function libPut(tag, mat, geo, pos, rotY = 0, rotX = 0) {
  _e.set(rotX, rotY, 0, "YXZ"); _q.setFromEuler(_e); _m.compose(pos, _q, _s);
  const g = (geo.index ? geo.toNonIndexed() : geo); g.applyMatrix4(_m);
  for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
  const kk = tag + "|" + mat.uuid; if (!LB.has(kk)) LB.set(kk, { mat, geos: [], tag }); LB.get(kk).geos.push(g);
}
function libFlush() {
  for (const { mat, geos, tag } of LB.values()) { const m = new THREE.Mesh(mergeGeometries(geos, false), mat); m.userData.tag = tag; libG.add(m); if (/wall|wood/.test(tag)) blockers.push(m); if (/ceil/.test(tag)) ceils.push(m); }
  LB.clear();
}
const LIBW = buildLibrary({ THREE, world: libG, put: libPut, flush: libFlush, mats: { parquet, carpetNor: C_NOR, darkWood, woodMat, brassMat, poolMat, paperEdge: new THREE.MeshStandardMaterial({ color: 0xd9b45e, roughness: .35, metalness: .6 }) },
  TX, textPlane, fit, rooms, NAMES, clickables, floors, isTouch, MINCHO, GOTH });

function makeBay(r, k) {
  const s = k.side, wv = s * (HALF - .02);
  const facing = s < 0 ? Math.atan2(r.p.x, r.p.y) : Math.atan2(-r.p.x, -r.p.y);
  const g = new THREE.Group(); world.add(g);
  const base = W(r.i, k.u, wv); g.position.copy(base); g.rotation.y = facing;
  const imgs = k.works.filter(w => w.f), rep = imgs.find(w => fname(w.f) === fname(k.rep)) || imgs[0];
  const others = imgs.filter(w => w !== rep), bun = k.works.find(w => !w.f);
  const slots = [];
  if (rep) slots.push({ w: rep, x: 0, y: 2.1, mw: 2.0, mh: 1.55, big: true });
  if (others[0]) slots.push({ w: others[0], x: -1.95, y: 2.0, mw: .92, mh: 1.15 });
  if (bun) slots.push({ w: bun, x: 1.95, y: 2.0, quote: true });
  else if (others[1]) slots.push({ w: others[1], x: 1.95, y: 2.0, mw: .92, mh: 1.15 });
  const bay = { k, r, g, slots, loaded: false, near: false, title: null, center: base.clone(), facing };
  for (const sl of slots) {
    const ph = new THREE.Mesh(new THREE.PlaneGeometry(sl.quote ? 1.1 : sl.mw * .8, sl.quote ? 1.25 : sl.mh * .8), new THREE.MeshBasicMaterial({ color: 0x2a2018, transparent: true, opacity: .55 }));
    ph.position.set(sl.x, sl.y, .012); g.add(ph); sl.ph = ph;
    ph.userData = { bay, slot: sl }; clickables.push(ph);
  }
  bays.push(bay); k.bay = bay;
}

// 題字と作品を近づいたときに作る（遠のいたら捨てる）
const loader = { q: [], busy: 0 };
function bayTitle(bay) {
  const { k, r } = bay;
  const t = textPlane(5.6, .8, (g, w, h) => {
    g.textBaseline = "alphabetic"; g.textAlign = "center";
    g.fillStyle = "#e7cf93"; g.font = `${Math.round(h * .15)}px ${GOTH}`; g.fillText(k.no || "", w / 2, h * .2);
    g.fillStyle = "#f6efdf"; fit(g, k.name, w * .6, `600 %px ${MINCHO}`, Math.round(h * .46)); g.fillText(k.name, w / 2, h * .64);
    const sub = (k.en || "").length > 34 ? k.yomi : `${k.yomi}　${k.en}`;
    g.fillStyle = "#d8c9a8"; fit(g, sub, w * .8, `%px ${GOTH}`, Math.round(h * .15)); g.fillText(sub, w / 2, h * .9);
    g.fillStyle = r.acc; g.fillRect(w / 2 - 30, h * .955, 60, h * .03);
  }, 1024);
  t.position.set(0, 3.6, .015); bay.g.add(t); bay.title = t;
}
function labelCard(w, wm = .62) {
  // 絵の下の小さな真鍮縁の札：題（1 行）と、作者・年（1 行）
  const who = [w.artist || w.author || "", w.date === "いま" ? "" : w.date].filter(Boolean).join("　");
  return textPlane(wm, .15, (g, W_, H) => {
    g.fillStyle = "#efe5cf"; g.fillRect(0, 0, W_, H); g.strokeStyle = "#a8864a"; g.lineWidth = 6; g.strokeRect(3, 3, W_ - 6, H - 6);
    g.fillStyle = "#2a2018"; g.textAlign = "center"; fit(g, w.title || "", W_ * .92, `600 %px ${MINCHO}`, Math.round(H * .36)); g.fillText(w.title || "", W_ / 2, H * .45);
    g.fillStyle = "#5a4a34"; fit(g, who, W_ * .92, `%px ${GOTH}`, Math.round(H * .25)); g.fillText(who, W_ / 2, H * .84);
  }, 768);
}
function quoteCard(w, acc) {
  return textPlane(1.1, 1.25, (g, W_, H) => {
    g.fillStyle = "#f4ead4"; g.fillRect(0, 0, W_, H); g.strokeStyle = "#a8864a"; g.lineWidth = 8; g.strokeRect(4, 4, W_ - 8, H - 8);
    g.fillStyle = acc; g.fillRect(W_ * .08, H * .07, 40, 5);
    g.fillStyle = "#2a2018"; g.font = `500 ${Math.round(W_ * .062)}px ${MINCHO}`; g.textBaseline = "top";
    const lines = wrapLines(g, "「" + (w.quote || "") + "」", W_ * .84).slice(0, 9);
    lines.forEach((ln, i) => g.fillText(ln, W_ * .08, H * .13 + i * W_ * .088));
    g.fillStyle = "#5a4a34"; g.font = `${Math.round(W_ * .042)}px ${GOTH}`;
    const a = wrapLines(g, `${w.author || ""}『${(w.title || "").replace(/^『|』.*$/g, "")}』`, W_ * .84).slice(0, 2);
    a.forEach((ln, i) => g.fillText(ln, W_ * .08, H * .8 + i * W_ * .058));
  }, 512);
}
function loadImg(url) { return new Promise((res, rej) => { const im = new Image(); im.decoding = "async"; im.onload = () => res(im); im.onerror = rej; im.src = url; }); }
async function hang(bay, sl) {
  const w = sl.w;
  if (sl.quote) {
    if (/[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7FF]/.test((w.quote || "") + (w.author || ""))) { await document.fonts.load('20px "KRsub"', w.quote || "").catch(() => {}); if (!bay.near || sl.mesh) return; }   // 韓国語の字の書体を読んでから描く
    const q = quoteCard(w, bay.r.acc); q.position.set(sl.x, sl.y, .02); bay.g.add(q); sl.mesh = q; sl.ph.visible = false;
    q.userData = { bay, slot: sl }; clickables.push(q); return;
  }
  const im = await loadImg(w.f);
  if (!bay.near || sl.mesh) return;
  const sc = Math.min(1, 512 / Math.max(im.naturalWidth, im.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(im.naturalWidth * sc)); c.height = Math.max(1, Math.round(im.naturalHeight * sc));
  c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAXANI;
  const ar = c.width / c.height; let ww = sl.mw, hh = ww / ar; if (hh > sl.mh) { hh = sl.mh; ww = hh * ar; }
  const grp = new THREE.Group(); grp.position.set(sl.x, sl.y, 0);
  const isArt = w.t !== "photo", fr = isArt ? .07 : .02;
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(ww + .5, hh + .5), shadowMat); sh.position.set(.04, -.06, .004); grp.add(sh);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(ww * 1.9 + .6, hh * 1.7 + .6), poolMat); pool.position.set(0, .2, .006); grp.add(pool);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(ww + 2 * fr, hh + 2 * fr, .06), isArt ? giltMat : frameMat); frame.position.z = .03; grp.add(frame);
  // 絵の額縁の内側の細い縁（額のまわりの影の段）
  if (isArt) { const lin = new THREE.Mesh(new THREE.PlaneGeometry(ww + .03, hh + .03), new THREE.MeshBasicMaterial({ color: 0x1a120a })); lin.position.z = .061; grp.add(lin); }
  const img = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .42, roughness: .8, metalness: 0, envMapIntensity: .2 })); img.position.z = .064; grp.add(img);
  // 絵の上の真鍮の灯り（ピクチャーライト）
  if (isArt && sl.big !== undefined || isArt) { const bar = new THREE.Mesh(new THREE.BoxGeometry(Math.min(.9, ww * .45), .05, .07), brassMat); bar.position.set(0, hh / 2 + fr + .16, .2); grp.add(bar);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.03, .03, .2), brassMat); arm.position.set(0, hh / 2 + fr + .16, .1); grp.add(arm);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(.86, ww * .43), .02), glowMat); gl.rotation.x = Math.PI / 2; gl.position.set(0, hh / 2 + fr + .134, .2); grp.add(gl); }
  const lab = labelCard(w, Math.max(.62, Math.min(1.3, ww))); lab.position.set(0, -hh / 2 - fr - .16, .15); grp.add(lab);
  img.userData = frame.userData = { bay, slot: sl }; clickables.push(img, frame);
  bay.g.add(grp); sl.mesh = grp; sl.tex = t; sl.ph.visible = false;
}
function unhang(bay) {
  for (const sl of bay.slots) if (sl.mesh) {
    sl.mesh.traverse(o => { if (o.isMesh) { const i = clickables.indexOf(o); if (i >= 0) clickables.splice(i, 1); o.geometry.dispose(); if (![shadowMat, poolMat, frameMat, giltMat, brassMat, glowMat].includes(o.material)) { o.material.map?.dispose?.(); o.material.dispose(); } } });
    bay.g.remove(sl.mesh); sl.mesh = null; sl.ph.visible = true;
  }
  if (bay.title) { bay.g.remove(bay.title); bay.title.material.map.dispose(); bay.title.geometry.dispose(); bay.title = null; }
  bay.loaded = false;
}
function pump() {
  while (loader.busy < 4 && loader.q.length) {
    const [bay, sl] = loader.q.shift(); if (!bay.near || sl.mesh || sl.loading) continue;
    loader.busy++; sl.loading = true; hang(bay, sl).catch(e => console.warn("図版を読めませんでした", sl.w.f, e?.type || e)).finally(() => { sl.loading = false; loader.busy--; pump(); });
  }
}
function streamBays() {
  const cp = camera.position, order = [];
  if (space === "library") return;
  for (const b of bays) {
    const d = Math.hypot(b.center.x - cp.x, b.center.z - cp.z);
    b.g.visible = d < 46;
    if (d < 24 && !b.loaded) { b.near = true; b.loaded = true; bayTitle(b); for (const sl of b.slots) order.push([d, b, sl]); }
    else if (d > 38 && b.loaded) { b.near = false; unhang(b); }
  }
  for (const [, b, s] of order) loader.q.push([b, s]);
  loader.q.sort((a, b) => Math.hypot(a[0].center.x - cp.x, a[0].center.z - cp.z) - Math.hypot(b[0].center.x - cp.x, b[0].center.z - cp.z));
  pump();
}

// ---------------------------------------------------------------- 粒（部屋ごと：ほこり・葉・雪・ほたる・花粉・星・金の塵）
const PN = isTouch ? 380 : 700;
const parts = (() => {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(PN * 3), rnd = new Float32Array(PN);
  for (let k = 0; k < PN; k++) { pos[k * 3] = (Math.random() - .5) * 16; pos[k * 3 + 1] = Math.random() * 5.8 + .1; pos[k * 3 + 2] = (Math.random() - .5) * 16; rnd[k] = Math.random(); }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aR", new THREE.BufferAttribute(rnd, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uSize: { value: 2 }, uSway: { value: 0 }, uVel: { value: new THREE.Vector3() }, uCam: { value: new THREE.Vector3() }, uTw: { value: 0 }, uMap: { value: TX.dot() }, uCol: { value: new THREE.Color(1, 1, 1) }, uOp: { value: 0 }, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute float aR; uniform float uT,uSize,uSway,uTw,uPx; uniform vec3 uVel,uCam; varying float vA;
      void main(){ vec3 box=vec3(16.,5.8,16.); float sp=.6+.8*aR; vec3 p=position+uVel*uT*sp;
        p.x+=sin(uT*.7+aR*20.)*uSway; p.z+=cos(uT*.6+aR*31.)*uSway; p.y+=sin(uT*.5+aR*13.)*uSway*.4;
        p.xz=mod(p.xz-uCam.xz+box.xz*.5,box.xz)-box.xz*.5+uCam.xz; p.y=mod(p.y,5.8)+.1;
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=min(uSize*uPx*(220./-mv.z)*(.6+.8*aR),uSize*uPx*4.); gl_Position=projectionMatrix*mv;
        vA=(uTw>.5 ? .25+.75*max(0.,sin(uT*(1.2+aR*2.)+aR*40.)) : 1.)*smoothstep(.8,3.,-mv.z); }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uCol; uniform float uOp; varying float vA; void main(){ float a=texture2D(uMap,gl_PointCoord).a*uOp*vA; if(a<.01) discard; gl_FragColor=vec4(uCol,a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
  return { pts, mat, cur: "none", want: "dust", op: 0 };
})();
function partTick(dt, t) {
  const U = parts.mat.uniforms; U.uT.value = t; U.uCam.value.copy(camera.position);
  const goal = RM ? 0 : PART[parts.want].op;
  if (parts.cur !== parts.want) { parts.op = Math.max(0, parts.op - dt * 1.5); if (parts.op <= 0) { parts.cur = parts.want; const P = PART[parts.cur]; U.uVel.value.set(...P.vel); U.uSway.value = P.sway; U.uSize.value = P.size; U.uCol.value.setRGB(...P.col); U.uTw.value = P.tw; if (parts.cur === "leaf" && zone.i != null) { const r = rooms[zone.i]; U.uVel.value.set(r.d.x * .9, -.06, r.d.y * .9); } } }
  else parts.op += (goal - parts.op) * ease(dt, 1.2);
  U.uOp.value = parts.op;
}

// ---------------------------------------------------------------- 部屋の空気のうつろい（敷居をまたぐと、光・霧・粒・音が変わる）
const zone = { key: null, i: null, t: 1 };
const AC = { hs: new THREE.Color(), hg: new THREE.Color(), kc: new THREE.Color(), fog: new THREE.Color(), hi: 1, ki: 1, exp: 1 };
{ const a = ATMO.lobby; AC.hs.set(a.hs); AC.hg.set(a.hg); AC.kc.set(a.kc); AC.fog.set(a.fog); AC.hi = a.hi; AC.ki = a.ki; AC.exp = a.exp; }
function zoneOf() {
  if (space === "library") return { key: "library", i: null };
  const e = entLocal(me.pos.x, me.pos.z); if (e.u > VEST) return { key: "outside", i: null };
  const l = local(me.pos.x, me.pos.z);
  if (l && l.u > .2) return { key: rooms[l.i].slug, i: l.i };
  return { key: "lobby", i: null };
}
const ambOf = key => key === "library" ? M.amb.library : key === "lobby" || key === "outside" ? M.amb.lobby : rooms.find(r => r.slug === key)?.amb;
function setZone(z, quiet) {
  if (zone.key === z.key) return;
  const first = zone.key == null; zone.key = z.key; zone.i = z.i;
  const A = ATMO[z.key] || ATMO.lobby; parts.want = "none";   // 2026-10-07 本人「空間に漂う光の粒は削除」
  if (mode === "walk") AUD.zone(ambOf(z.key));
  if (quiet || first) return;
  if (!RM) { const v = $("veil"); v.classList.remove("go"); void v.offsetWidth; v.style.background = "#" + new THREE.Color(A.fog).getHexString(); v.classList.add("go"); }
  const r = z.i != null ? rooms[z.i] : null;
  const lib_ = z.key === "library", out = z.key === "outside";
  $("rcK").textContent = r ? `第${"一二三四五六七八九十"[z.i] || z.i + 1}室` : lib_ ? NAMES.library_en : NAMES.museum_en;
  $("rcB").textContent = r ? r.name : lib_ ? NAMES.library : out ? NAMES.museum : NAMES.hub; $("rcS").textContent = r ? r.desc : lib_ ? `${NAMES.series}の${rooms.length}冊` : out ? "入口の前" : `${rooms.length}つの部屋と、${NAMES.library}`;
  const rc = $("roomCard"); clearTimeout(setZone.t);
  if (r && !OTO) { HOLO.showRoom(r.i, me.pos); rc.classList.remove("on"); }   // 部屋は空中に浮く立体の札（2026-10-09 本人）
  else { HOLO.hideRoom(); rc.classList.add("on"); setZone.t = setTimeout(() => rc.classList.remove("on"), 2600); }
  if (r && mode === "walk" && !(tour.on && !tour.susp) && !seen.rooms.has(r.i)) {
    seen.rooms.add(r.i); const I = T.rooms[r.i].intro;
    const amb = I.filter(x => /^(いま聞こえて|流れているのは)/.test(x));
    setTimeout(() => { if (zone.i === r.i && !SP.resolve) { freeTalk([I[0], T.rooms[r.i].zones, ...amb].filter(Boolean)); talkKind = "greet"; } }, 900);
  }
  if (r && mode === "walk") showZones(r);
  else hideZones();
}
// この部屋の一覧と地図（2026-10-07 本人「部屋に入ったら、AR のように空中に『この部屋の一覧と地図』が浮かび、気になるジャンルを押すとそこへ飛べる」）
function showZones(r) {
  const el = $("zones"); if (!r.zones?.length) { hideZones(); return; }
  const n = r.zones.length;
  el.innerHTML = `<div class="zh"><b>${esc(r.name)}</b><small>手前から奥へ　${n} の区画</small><button class="ico x" aria-label="区画の一覧を閉じる">✕</button></div>
    <div class="zplan" aria-hidden="true">${r.zones.map(z => `<i style="flex:${z.ids.length};background:${z.col || "#777"}"></i>`).join("")}</div>
    <div class="zl" role="list">${r.zones.map((z, zi) => `<button role="listitem" data-z="${zi}" style="--c:${z.col || "#777"}"><b>${esc(z.name)}</b><small>${esc(z.sub)}・${z.ids.length} 景</small></button>`).join("")}</div>`;
  el.classList.toggle("sr3d", !OTO); el.hidden = false; requestAnimationFrame(() => el.classList.add("on"));
  el.querySelector(".x").onclick = hideZones;
  el.querySelectorAll("[data-z]").forEach(b => b.onclick = () => { const z = r.zones[+b.dataset.z]; hideZones(); if (tour.on && !tour.susp) suspendTour(); intro.tok++; walkTo(W(r.i, z.u0 + 1.0, 0)); me.faceTo = W(r.i, z.u1 + 4, 0); });
  clearTimeout(showZones.t); showZones.t = setTimeout(hideZones, 14000);
}
function hideZones() { const el = $("zones"); el.classList.remove("on"); clearTimeout(showZones.t); setTimeout(() => { if (!el.classList.contains("on")) el.hidden = true; }, 400); }

// ---------------------------------------------------------------- 自由に歩いて、気になる作品の前で立ち止まると、碧がその景の話をする（2026-10-07 本人「自由に動いて、気になる作品を碧が解説という設計に」）
const seen = { rooms: new Set(), bays: new Set(), books: new Set() };
let talkKind = "";   // いま話していることの種類（"greet"＝部屋のあいさつ。作品の前で止まったら、あいさつは途中でやめて作品の話へ）
const explore = { still: 0, bay: null };
function exploreTick(dt) {
  if (OTO) return;   // 音で巡る館では、立ち止まって話すのは「次へ」のときだけ
  if (explore.bay && SP.resolve) {   // 話の途中で離れたら、話をやめる
    if (Math.hypot(me.pos.x - explore.bay.center.x, me.pos.z - explore.bay.center.z) > 8.5) { hush(); explore.bay = null; A.goal = null; A.look = null; }
  }
  if (mode !== "walk" || space !== "museum" || (tour.on && !tour.susp) || warping || !$("panel").hidden || !$("map").hidden) { explore.still = 0; return; }
  if (me.path.length || keys.size || joy.on || dragging || (SP.resolve && talkKind !== "greet")) { explore.still = 0; return; }
  explore.still += dt; if (explore.still < .8) return;
  const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw); let best = null, bd = 1e9;
  for (const b of bays) {
    if (seen.bays.has(b)) continue;
    const dx = b.center.x - me.pos.x, dz = b.center.z - me.pos.z, d = Math.hypot(dx, dz);
    if (d > 6.8 || d < .5) continue;
    const look = (dx * fx + dz * fz) / d; if (look < .72) continue;
    if (d < bd) { bd = d; best = b; }
  }
  if (best) { explore.still = 0; explainBay(best); }
}
function explainBay(b) {
  seen.bays.add(b); explore.bay = b; talkKind = "bay"; talkAt = { i: b.r.i, j: b.k.j };
  const K = T.rooms[b.r.i].kei[b.k.j], narrow = innerWidth / innerHeight < .8, inv = new THREE.Vector3(me.pos.x, 0, me.pos.z).sub(b.center).applyAxisAngle(new THREE.Vector3(0, 1, 0), -b.facing);
  A.goal = new THREE.Vector3(inv.x < -.8 ? (narrow ? .95 : 2.6) : (narrow ? -.95 : -2.6), 0, narrow ? 1.35 : 1.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), b.facing).add(b.center);
  A.look = b.center.clone();
  curActs = () => [["札をひらく", () => openPanel(b.k, b.slots[0]?.w), true], ["⏭", skipLine, false, "このことばをとばす"], ["部屋をえらぶ", openMap]];
  setActs(curActs()); $("guide").hidden = false; if ($("guide").classList.contains("folded")) fold(false);
  const rel = bindCreatures(roomCreatures(b.r.slug, b.k.id));
  sayQ([...K.lines, K.side], { before: (t, n) => { A.point = n === 1 ? 1 : 0; A.talkT = 0; } }).then(ok => { rel(); if (ok) { A.point = 0; curActs = freeActs; setActs(freeActs()); } });
}
// 円堂の光は、見ている人の時刻で変わる（朝は白く、昼は明るく、夕方は金色、夜は月の青）。2026-10-07「現実の美術館にない体験」の一つ
const HOUR_LIGHT = (() => {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  const P = [[5, 0xbfd0ff, .8, .88], [8, 0xfff4e0, 1.05, 1.0], [12, 0xfffaf0, 1.15, 1.04], [16, 0xffe2b0, 1.05, 1.0], [18.5, 0xffb070, .95, .97], [20, 0x8090c0, .75, .9], [29, 0xbfd0ff, .8, .88]];
  const hh = h < 5 ? h + 24 : h; let a = P[0], b = P[1]; for (let k = 0; k < P.length - 1; k++) if (hh >= P[k][0] && hh < P[k + 1][0]) { a = P[k]; b = P[k + 1]; }
  const t = (hh - a[0]) / (b[0] - a[0]); return { kc: new THREE.Color(a[1]).lerp(new THREE.Color(b[1]), t).getHex(), ki: a[2] + (b[2] - a[2]) * t, exp: a[3] + (b[3] - a[3]) * t, h };
})();
ATMO.lobby = { ...ATMO.lobby, kc: HOUR_LIGHT.kc, ki: ATMO.lobby.ki * HOUR_LIGHT.ki, exp: ATMO.lobby.exp * HOUR_LIGHT.exp };
function atmoTick(dt) {
  const A = ATMO[zone.key] || ATMO.lobby, k = ease(dt, 1.4);
  AC.hs.lerp(new THREE.Color(A.hs), k); AC.hg.lerp(new THREE.Color(A.hg), k); AC.kc.lerp(new THREE.Color(A.kc), k); AC.fog.lerp(new THREE.Color(A.fog), k);
  AC.hi += (A.hi - AC.hi) * k; AC.ki += (A.ki - AC.ki) * k; AC.exp += (A.exp - AC.exp) * k;
  hemi.color.copy(AC.hs); hemi.groundColor.copy(AC.hg); hemi.intensity = AC.hi; key.color.copy(AC.kc); key.intensity = AC.ki;
  AC.fn = (AC.fn ?? 22) + ((A.fn ?? 18) - (AC.fn ?? 22)) * k; AC.ff = (AC.ff ?? 95) + ((A.ff ?? 80) - (AC.ff ?? 95)) * k;
  renderer.toneMappingExposure = AC.exp; scene.fog.color.copy(AC.fog); scene.fog.near = AC.fn; scene.fog.far = AC.ff; scene.background.copy(AC.fog);
}

// ---------------------------------------------------------------- 音（はじめに押してから。部屋の空気の音・背景の音楽・碧の声）
//   本人「雨では雨音もつけるなど、音の体験も合わせてお願いします。音のテーマがない場所は、何かBGMをccで見つけて流しておいてください。」
//   押す前には何も鳴らさない。消音のボタンは上の帯（端末に覚える）。
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
const AUD = {
  ctx: null, master: null, amb: null, vbus: null, voice: null, an: null, cur: null, muted: store.get("smm-mute", false), bufs: new Map(), els: new Map(), duck: 1,
  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C(); this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 1; this.master.connect(ctx.destination);
    this.amb = ctx.createGain(); this.amb.connect(this.master); this.vbus = ctx.createGain(); this.vbus.gain.value = 1.15; this.vbus.connect(this.master);
    const v = this.voice = new Audio(); v.preload = "auto"; v.src = SILENT; v.play().catch(() => {});
    try { const s = ctx.createMediaElementSource(v); this.an = ctx.createAnalyser(); this.an.fftSize = 512; s.connect(this.an); this.an.connect(this.vbus); } catch {}
    this.td = new Uint8Array(512); ctx.resume?.();
  },
  setMute(m) { this.muted = m; store.set("smm-mute", m); if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, .08); AU.muted = m; $("muteBtn").textContent = m ? "🔇" : "🔊"; $("muteBtn").setAttribute("aria-pressed", String(m)); $("muteBtn").setAttribute("aria-label", m ? "音を出す" : "音を消す"); },
  async buffer(f) {
    if (!this.bufs.has(f)) this.bufs.set(f, fetch(f).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(b => new Promise((res, rej) => this.ctx.decodeAudioData(b, res, rej))));
    return this.bufs.get(f);
  },
  async zone(a) {
    if (!this.ctx) { this.pending = a; return; }
    const id = a ? a.f : null; if (this.cur && this.cur.id === id) return;
    const old = this.cur; this.cur = null;
    if (old) { old.g.gain.cancelScheduledValues(this.ctx.currentTime); old.g.gain.setTargetAtTime(0, this.ctx.currentTime, .6); setTimeout(() => { try { old.stop(); } catch {} }, 3200); }
    if (!a) return;
    const g = this.ctx.createGain(); g.gain.value = 0; g.connect(this.amb);
    const vol = a.kind === "bgm" ? .34 : a.f.includes("oto_yane") ? .7 : a.f.includes("fukurou") ? .5 : .55;
    const cur = { id, g, stop: () => {} }; this.cur = cur;
    try {
      if (a.kind === "bgm") {
        let el = this.els.get(a.f); if (!el) { el = new Audio(a.f); el.loop = true; el.preload = "auto"; this.els.set(a.f, el); const s = this.ctx.createMediaElementSource(el); el._g = this.ctx.createGain(); s.connect(el._g); }
        el._g.disconnect(); el._g.connect(g); el.currentTime = el.currentTime || 0; await el.play(); cur.stop = () => el.pause();
      } else {
        const b = await this.buffer(a.f); if (this.cur !== cur) return;
        const s = this.ctx.createBufferSource(); s.buffer = b; s.loop = true; if (a.le && b.duration > a.le) { s.loopStart = a.ls; s.loopEnd = a.le; } s.connect(g); s.start(0, a.ls || 0); cur.stop = () => s.stop();
      }
      g.gain.setTargetAtTime(vol, this.ctx.currentTime, .9);
    } catch (e) { console.warn("部屋の音を鳴らせませんでした", a.f, e?.message || e); }
  },
  setDuck(d) { if (!this.ctx || d === this.duck) return; this.duck = d; this.amb.gain.setTargetAtTime(d, this.ctx.currentTime, .25); },
  level() { if (!this.an || !SP.playing) return 0; this.an.getByteTimeDomainData(this.td); let s = 0; for (let k = 0; k < this.td.length; k += 4) { const x = (this.td[k] - 128) / 128; s += x * x; } return Math.sqrt(s / (this.td.length / 4)); },
};

// 壁にふれた小さな音（その場で作る短い低い音。録音は使わない）
function bump() {
  const c = AUD.ctx; if (!c || AUD.muted) return;
  const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 420;
  o.type = "triangle"; o.frequency.setValueAtTime(140, c.currentTime); o.frequency.exponentialRampToValueAtTime(70, c.currentTime + .12);
  g.gain.setValueAtTime(0, c.currentTime); g.gain.linearRampToValueAtTime(.22, c.currentTime + .008); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .18);
  o.connect(f); f.connect(g); g.connect(AUD.master); o.start(); o.stop(c.currentTime + .2);
}

// ---------------------------------------------------------------- 碧の声と字幕（字幕＝話すことばそのもの）
const SP = { tok: 0, playing: false, paused: false, cur: "", resolve: null, timer: null, t0: 0, rest: 0 };
const voiceOn = () => AUD.ctx && !AUD.muted && $("optVoice").checked;
const est = t => 900 + t.length * 135;
function setTalking(on) {
  $("guide").classList.toggle("talking", on);
  // 2026-10-07 本人「話し終わったら自動でたたむ（小さな印だけ残し、押すと開く）」。案内の途中（順に巡る）はたたまない
  clearTimeout(SP.foldT);
  if (on) { if (SP.autoFolded) { SP.autoFolded = false; fold(false); } }
  else SP.foldT = setTimeout(() => {
    if (OTO || $("guide").classList.contains("talking") || SP.paused || (tour.on && !tour.susp) || document.body.classList.contains("reading-aloud") || $("guide").classList.contains("folded")) return;
    fold(true); SP.autoFolded = true;
  }, 4200);
}
function speakLine(text) {
  return new Promise(res => {
    SP.cur = text; $("say").textContent = text; A.talkT = 0; setTalking(true); window.__said = (window.__said || []).concat([text]).slice(-30);
    const v = VOICE[text];
    const done = () => { clearTimeout(SP.timer); SP.timer = null; SP.resolve = null; SP.playing = false; setTalking(false); AUD.setDuck(1); res(); };
    SP.resolve = done;
    const timed = ms => { SP.rest = ms; SP.t0 = performance.now(); if (!SP.paused) SP.timer = setTimeout(done, ms); };
    if (v && voiceOn()) {
      const el = AUD.voice; el.onended = done; el.onerror = () => timed(est(text));
      el.src = v.f; el.currentTime = 0; SP.playing = true; AUD.setDuck(.38); window.__voiceSrc = v.f;
      if (!SP.paused) el.play().catch(() => { SP.playing = false; timed(est(text)); });
    } else timed(est(text));
  });
}
function pauseSpeech(on) {
  SP.paused = on; $("sayState").textContent = on ? "一時停止中" : "";
  if (SP.playing) { on ? AUD.voice.pause() : AUD.voice.play().catch(() => {}); }
  else if (SP.resolve) { if (on) { clearTimeout(SP.timer); SP.rest = Math.max(400, SP.rest - (performance.now() - SP.t0)); } else { SP.t0 = performance.now(); SP.timer = setTimeout(SP.resolve, SP.rest); } }
  setActs(curActs());
}
function skipLine() { if (SP.playing) AUD.voice.pause(); SP.resolve?.(); }
function hush() { SP.tok++; if (SP.playing) AUD.voice.pause(); SP.resolve?.(); }
async function waitRun(tok) { while (SP.paused && tok === SP.tok) await sleep(150); return tok === SP.tok; }
async function sayQ(lines, opts = {}) {
  const tok = ++SP.tok; if (SP.playing) AUD.voice.pause(); SP.resolve?.();
  lines = [].concat(lines).filter(Boolean);
  for (let n = 0; n < lines.length; n++) {
    if (!await waitRun(tok)) return false;
    opts.before?.(lines[n], n);
    await speakLine(lines[n]);
    if (tok !== SP.tok) return false;
    await sleep(320);
  }
  return tok === SP.tok;
}
// 吹き出しのボタン
let curActs = () => [];
function setActs(list) {
  const box = $("acts"); box.innerHTML = "";
  for (const a of list) { const b = document.createElement("button"); b.className = "btn" + (a[2] ? " pri" : "") + (a[3] ? " ib" : ""); b.textContent = a[0]; if (a[3]) b.setAttribute("aria-label", a[3]); b.onclick = a[1]; box.appendChild(b); }
}
function talk(lines, acts) { talkKind = ""; curActs = () => acts; setActs(acts); $("guide").hidden = false; if ($("guide").classList.contains("folded")) fold(false); return sayQ(lines); }

// ---------------------------------------------------------------- 見る人（カメラ）の動き
const me = { pos: new THREE.Vector3(0, EYE, 8.5), yaw: 0, pitch: -.02, path: [], speed: 0, faceTo: null, onArrive: null };
const keys = new Set();
function setFov() { const a = innerWidth / innerHeight; camera.fov = a < .8 ? 72 : a < 1.2 ? 66 : 58; camera.aspect = a; camera.updateProjectionMatrix(); }
function resize() { renderer.setSize(innerWidth, innerHeight); setFov(); drawMini(); }
addEventListener("resize", resize);
function route(to, toWarp, from = me.pos) {
  const a = region(from.x, from.z), b = region(to.x, to.z), pts = [];
  const libOut = WF(LIB_FACE, -1.8, 0), libIn = libWorld(new THREE.Vector3(0, 0, LIB.Z - 1.4));
  if (a.kind === "library" && b.kind !== "library") pts.push(libIn, libOut);
  {
    const door = (i, u) => W(i, u, 0);
    if (a.kind === "entrance" && b.kind !== "entrance") { if (a.u > VEST - .3) pts.push(E(Math.max(VEST + 1.8, Math.min(a.u, VEST + 1.8)), 0), E(VEST - 1)); pts.push(E(-1.8)); }
    if (a.kind === "room" && !(b.kind === "room" && b.i === a.i)) { pts.push(door(a.i, Math.max(1.2, Math.min(a.u, 1.2))), door(a.i, -1.8)); }
    if (b.kind === "room" && !(a.kind === "room" && a.i === b.i)) { pts.push(door(b.i, -1.8), door(b.i, 1.2)); }
    if (b.kind === "entrance" && a.kind !== "entrance") { pts.push(E(-1.8), E(VEST - 1)); if (b.u > VEST) pts.push(E(VEST + 1.8)); }
    if (b.kind === "room" && Math.abs(b.v) > HALF - FIN - .5) { pts.push(W(b.i, b.u, Math.sign(b.v) * (HALF - FIN - .6))); }
  }
  if (b.kind === "library" && a.kind !== "library") { if (a.kind === "room") pts.push(W(a.i, -1.8, 0)); pts.push(libOut, libIn); }
  pts.push(to.clone());
  const out = []; let prev = from;
  for (const q of pts) {
    const w = steleCut(prev, q) || obsCut(prev, q); if (w) { out.push(w); prev = w; }
    const k = toWarp && q === pts.at(-1) ? null : warpCut(prev, q); if (k) out.push(k);
    out.push(q); prev = q;
  }
  return out.map(p => new THREE.Vector3(p.x, EYE, p.z));
}
function obsCut(a, b) {   // 円堂の置きもの（企画展の台）をよける
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz; if (L2 < 1e-6) return null;
  for (const o of OBST) {
    const t = clamp(((o.x - a.x) * dx + (o.z - a.z) * dz) / L2, 0, 1), cx = a.x + dx * t, cz = a.z + dz * t, dd = Math.hypot(cx - o.x, cz - o.z);
    if (dd >= o.r + .35 || t <= 0 || t >= 1) continue;
    let nx = -dz, nz = dx; const nl = Math.hypot(nx, nz); nx /= nl; nz /= nl; const sg = (cx - o.x) * nx + (cz - o.z) * nz >= 0 ? 1 : -1;
    return new THREE.Vector3(o.x + sg * nx * (o.r + .8), 0, o.z + sg * nz * (o.r + .8));
  }
  return null;
}
function steleCut(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz; if (L2 < 1e-6) return null;
  const t = clamp(((STELE.x - a.x) * dx + (STELE.z - a.z) * dz) / L2, 0, 1), cx = a.x + dx * t, cz = a.z + dz * t;
  if (Math.hypot(cx - STELE.x, cz - STELE.z) >= STELE.r) return null;
  const side = Math.abs(cx - STELE.x) > .05 ? Math.sign(cx - STELE.x) : (a.x + b.x >= 0 ? 1 : -1);
  return new THREE.Vector3(STELE.x + side * (STELE.w / 2 + .9), 0, STELE.z);
}
// 道すじがワープ（光の輪）を横切るなら、わきへよける（踏むつもりのときだけ乗る）
function warpCut(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz; if (L2 < 1e-6) return null;
  const t = clamp(((WARP.x - a.x) * dx + (WARP.z - a.z) * dz) / L2, 0, 1), cx = a.x + dx * t, cz = a.z + dz * t, dd = Math.hypot(cx - WARP.x, cz - WARP.z);
  if (dd >= WARP.keep || t <= 0 || t >= 1) return null;
  let nx = -dz, nz = dx; const nl = Math.hypot(nx, nz); nx /= nl; nz /= nl;
  const sgn = (cx - WARP.x) * nx + (cz - WARP.z) * nz >= 0 ? 1 : -1;
  return new THREE.Vector3(WARP.x + sgn * nx * (WARP.keep + .4), 0, WARP.z + sgn * nz * (WARP.keep + .4));
}
function goTo(p, faceTo = null, onArrive = null, toWarp = false) {
  me.userLook = false; me.path = route(p, toWarp); me.faceTo = faceTo; me.onArrive = onArrive;
  if (RM) { teleport(me.path.at(-1), faceTo, onArrive); me.path = []; }
}
const goP = (p, faceTo) => new Promise(res => goTo(p, faceTo, res));
function teleport(p, faceTo, onArrive) {
  $("fade").classList.add("on");
  setTimeout(() => {
    me.pos.set(p.x, EYE + groundY(p.x, p.z), p.z); if (faceTo) { me.yaw = Math.atan2(-(faceTo.x - p.x), -(faceTo.z - p.z)); me.pitch = -.03; }
    me.path = []; aoiJump(); streamBays(); setZone(zoneOf()); $("fade").classList.remove("on"); onArrive?.();
  }, 320);
}
function moveTick(dt) {
  if (me.path.length) {
    const t = me.path[0], dx = t.x - me.pos.x, dz = t.z - me.pos.z, d = Math.hypot(dx, dz);
    const last = me.path.length === 1, vmax = 2.4;
    me.speed = Math.min(vmax, me.speed + 3 * dt, last ? Math.max(.35, d * 1.6) : vmax);
    const st = Math.min(d, me.speed * dt);
    if (d < .04) { me.path.shift(); if (!me.path.length) { me.speed = 0; arrive(); } }
    else {
      me.pos.x += dx / d * st; me.pos.z += dz / d * st;
      const want = me.faceTo && (last && d < 1.6) ? Math.atan2(-(me.faceTo.x - me.pos.x), -(me.faceTo.z - me.pos.z)) : Math.atan2(-dx, -dz);
      if (!dragging && !me.userLook) me.yaw += wrapA(want - me.yaw) * ease(dt, 3.2);
    }
  }
  let f = 0, s = 0, turn = 0;
  if (keys.has("w") || keys.has("arrowup")) f += 1; if (keys.has("s") || keys.has("arrowdown")) f -= 1;
  if (keys.has("a")) s -= 1; if (keys.has("d")) s += 1;
  if (keys.has("arrowleft") || keys.has("q")) turn += 1; if (keys.has("arrowright") || keys.has("e")) turn -= 1;
  if (joy.on) { f += -joy.y; turn += -joy.x * 1.1; }
  me.yaw += turn * 1.6 * dt;
  if (f || s) {
    if (tour.on && !tour.susp) suspendTour();
    me.path = []; const sp = 2.2 * dt, fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
    const nx = me.pos.x + (fx * f + -fz * s) * sp, nz = me.pos.z + (fz * f + fx * s) * sp;
    walkable.warpOK = true;
    // 2026-10-07 本人「壁に近づきすぎると後ろに戻れない」：キー・スティックは壁の手前 .7 m まで。いま線の外にいるなら、少しでも内へ戻る向きは通す
    const ok = (x, z) => walkable(x, z, .7), cur = ok(me.pos.x, me.pos.z);
    if (ok(nx, nz) || (!cur && (walkable(nx, nz, .3) || f < 0))) { me.pos.x = nx; me.pos.z = nz; } else if (ok(nx, me.pos.z)) me.pos.x = nx; else if (ok(me.pos.x, nz)) me.pos.z = nz;
    else if (!me.bumpT || performance.now() - me.bumpT > 700) { me.bumpT = performance.now(); bump(); }
    walkable.warpOK = false;
  }
  const gy = EYE + groundY(me.pos.x, me.pos.z); me.pos.y += (gy - me.pos.y) * Math.min(1, dt * 10);
  if (Math.abs(gy - me.pos.y) > 3) me.pos.y = gy;
  camera.position.copy(me.pos);
  camera.rotation.set(me.pitch, me.yaw, 0, "YXZ");
}
function arrive() {
  if (me.faceTo && !me.userLook) { me.yaw += wrapA(Math.atan2(-(me.faceTo.x - me.pos.x), -(me.faceTo.z - me.pos.z)) - me.yaw); }
  const f = me.onArrive; me.onArrive = null; f?.();
}

// ---------------------------------------------------------------- 押す・見回す
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let dragging = false, down = null;
const marker = new THREE.Mesh(new THREE.RingGeometry(.22, .3, 40), new THREE.MeshBasicMaterial({ color: 0xe7cf93, transparent: true, opacity: 0 }));
marker.rotation.x = -Math.PI / 2; scene.add(marker);
const TAP_PX = isTouch ? 10 : 6;   // これより動いたら「見回す」（タップにしない）
let touches = 0;
stage.addEventListener("pointerdown", e => {
  if (mode !== "walk" || e.target !== renderer.domElement) return;
  touches++; if (down) { down.multi = true; return; }
  down = { x: e.clientX, y: e.clientY, yaw: me.yaw, pitch: me.pitch, id: e.pointerId, t: performance.now(), multi: false, max: 0 }; dragging = false;
});
stage.addEventListener("pointermove", e => {
  if (mode !== "walk") return;
  if (!down || e.pointerId !== down.id) { hover(e); return; }
  const dx = e.clientX - down.x, dy = e.clientY - down.y; down.max = Math.max(down.max, Math.hypot(dx, dy));
  if (!dragging && down.max > TAP_PX && !down.multi) { dragging = true; me.userLook = true; stage.setPointerCapture?.(e.pointerId); }
  if (dragging) { const k = (isTouch ? 1.6 : 1.2) * camera.fov / 60 / innerHeight * 1.4; me.yaw = down.yaw + dx * k; me.pitch = clamp(down.pitch + dy * k, -.55, .5); }
});
addEventListener("pointerup", e => {
  touches = Math.max(0, touches - 1);
  if (mode !== "walk" || !down || e.pointerId !== down.id) return;
  const d = down, wasDrag = dragging || d.max > TAP_PX || d.multi; down = null; dragging = false;
  if (!wasDrag) pick(e.clientX, e.clientY);
});
addEventListener("pointercancel", () => { touches = 0; down = null; dragging = false; });
function rayAt(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); }
const hoverRing = new THREE.Mesh(new THREE.RingGeometry(.2, .26, 40), new THREE.MeshBasicMaterial({ color: 0xe7cf93, transparent: true, opacity: .4, depthWrite: false }));
hoverRing.rotation.x = -Math.PI / 2; hoverRing.visible = false; scene.add(hoverRing);
function hover(e) {
  if (isTouch) return; rayAt(e.clientX, e.clientY);
  hoverRing.visible = false;
  if (aoi?.visible && ray.intersectObject(aoi, true)[0]) { stage.style.cursor = "pointer"; return; }
  const h = ray.intersectObjects([...clickables, ...floors, ...blockers], false)[0];
  if (!h || h.distance > 40) { stage.style.cursor = ""; return; }
  if (h.object.userData?.bay || h.object.userData?.book != null || h.object.userData?.anim || h.object.userData?.animPart) { stage.style.cursor = "pointer"; return; }
  stage.style.cursor = "";
  if (floors.includes(h.object) && walkable(h.point.x, h.point.z) && Math.hypot(h.point.x - me.pos.x, h.point.z - me.pos.z) <= STEP_MAX) { hoverRing.position.set(h.point.x, h.point.y + .012, h.point.z); hoverRing.visible = true; }
}
function pick(x, y) {
  rayAt(x, y);
  { const hh = HOLO.hit(ray); const reg0 = region(me.pos.x, me.pos.z);
    if (hh && (hh.holo || (hh.dist < 14 && (reg0.kind === "lobby" || reg0.kind === "entrance")))) { holoAct(hh); return; }
    if (HOLO.open_) { HOLO.close(); return; } }
  if (aoi?.visible) { const h = ray.intersectObject(aoi, true)[0]; if (h && h.distance < 12) { aoiTapped(); return; } }
  const vis = clickables.filter(o => { let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; });
  const hits = ray.intersectObjects([...vis, ...floors, ...blockers, ...ceils], false);
  const h = hits[0]; if (!h) return;
  if (blockers.includes(h.object) || ceils.includes(h.object)) {
    const c = camera.position, dx = h.point.x - c.x, dz = h.point.z - c.z, d = Math.min(Math.hypot(dx, dz), 30);
    let q = null;
    for (let t = d - 1.2; t > 1; t -= .4) {
      let x = c.x + dx / Math.hypot(dx, dz) * t, z = c.z + dz / Math.hypot(dx, dz) * t;
      const l = space === "museum" ? local(x, z) : null; if (l && l.u > 0 && !walkable(x, z)) { const w = W(l.i, l.u, clamp(l.v, -(HALF - 1.65), HALF - 1.65)); x = w.x; z = w.z; }
      if (walkable(x, z)) { q = new THREE.Vector3(x, 0, z); break; }
    }
    if (!q || Math.hypot(q.x - c.x, q.z - c.z) < .5) { const bk = backStep(); if (bk) { walkTo(bk, true); return; } toast("そこへは行けません"); return; }
    walkTo(q); return;
  }
  if (h.object.userData?.bay) { approach(h.object.userData.bay, h.object.userData.slot); return; }
  if (h.object.userData?.book != null) { approachBook(h.object.userData.book); return; }
  if (h.object.userData?.warp) { goWarp(); return; }
  if (h.object.userData?.animPart) { const it = h.object.userData.animPart; if (EX.react(it)) { playCall(it.a.id, h.point); return; } }
  if (h.object.userData?.anim) { animTapped(h.object.userData.anim); playCall(h.object.userData.anim.a.id, h.point); return; }
  if (h.distance > 60) return;
  const p = h.point;
  if (!walkable(p.x, p.z)) { const l = local(p.x, p.z); if (l && l.u > 0 && Math.abs(l.v) > 2) { const q = W(l.i, l.u, Math.sign(l.v) * (HALF - 1.65)); if (walkable(q.x, q.z)) { p.x = q.x; p.z = q.z; } } }
  if (!walkable(p.x, p.z)) {   // 行けない床：カメラからその点までの線の上で、いちばん遠くの行ける点へ
    const c = camera.position, dx = p.x - c.x, dz = p.z - c.z, L = Math.hypot(dx, dz); let q = null;
    for (let t = L; t > .6; t -= .3) { const x = c.x + dx / L * t, z = c.z + dz / L * t; if (walkable(x, z)) { q = new THREE.Vector3(x, 0, z); break; } }
    if (!q) { const bk = backStep(); if (bk) { walkTo(bk, true); return; } toast("そこへは行けません"); return; }
    p.x = q.x; p.z = q.z;
  }
  walkTo(p);
}
// いまの向きのまま、うしろへ一歩（1〜2 m）。壁の前で行き場がないとき
function backStep() {
  const bx = Math.sin(me.yaw), bz = Math.cos(me.yaw);
  for (const t of [1.8, 1.4, 1.0, .7]) { const x = me.pos.x + bx * t, z = me.pos.z + bz * t; if (walkable(x, z, .7)) return new THREE.Vector3(x, 0, z); }
  return null;
}
// 一回の押しで歩くのは STEP_MAX m まで（2026-10-07 本人「遠くを押しすぎると遠くまで動き……一回の押しで動ける範囲を適度に制限」）。
//   それより遠い床を押したら、その向きへ STEP_MAX m だけ。歩いているあいだも、押せば止まって向きを変えられる
const STEP_MAX = 6;
function walkTo(p, keepLook) {
  const dx = p.x - me.pos.x, dz = p.z - me.pos.z, d = Math.hypot(dx, dz);
  if (d > STEP_MAX && !keepLook) { const k = STEP_MAX / d; let q = new THREE.Vector3(me.pos.x + dx * k, 0, me.pos.z + dz * k); for (let t = 0; t < 8 && !walkable(q.x, q.z); t++) q = new THREE.Vector3((q.x + me.pos.x) / 2, 0, (q.z + me.pos.z) / 2); if (walkable(q.x, q.z)) p = q; } if (tour.on && !tour.susp) suspendTour(); intro.tok++; marker.position.set(p.x, groundY(p.x, p.z) + .01, p.z); marker.material.opacity = .9; goTo(p); if (keepLook) me.userLook = true; }
// ---------------------------------------------------------------- ワープ（広間のまん中 ⇄ 図書館のまん中）
const intro = { tok: 0 };
let warping = false;
// 書架の部屋へ（円堂の扉から歩いて入る）／書架の部屋から円堂へ
const LIB_IN = () => libWorld(new THREE.Vector3(0, 0, LIB.Z - 2.2)), LIB_IN_LOOK = () => libWorld(new THREE.Vector3(0, 0, DISP_Z));
const DISP_Z = -5.0;
function goWarp() {
  if (tour.on && !tour.susp) suspendTour();
  if (region(me.pos.x, me.pos.z).kind === "library") { goTo(WF(LIB_FACE, -3.5, 0), new THREE.Vector3(0, 0, 0)); return; }
  goTo(LIB_IN(), LIB_IN_LOOK());
}
function doWarp(then) { then?.(); }
function libActs() { return [["本をえらぶ", () => { $("shelfBar").querySelector("button")?.focus(); toast("上の一覧か、棚の本を押してください"); }, true], [`${NAMES.museum}へもどる`, goWarp]]; }
// 図書館：本を押すと、読書の机へ行って、その場で本がひらく（2026-10-07 本人「書架から本を取って、その場で読む感じに（別の画面に飛ばない）」）
//   ひらいている見開きを、碧が読む（左の絵の説明 → 右の見出しと文）。めくると、その見開きを読む
function approachBook(i) {
  const f = LIBW.featured[i]; hush();
  const desk = LIBW.desk || null;
  goTo(libWorld(f.stand), libWorld(f.look), () => {
    const open = () => reader.open(i);
    if (desk) goTo(libWorld(desk.stand), libWorld(desk.look), open); else open();
  });
}
const reader = createReader({ rooms, T, NAMES, PAGES: M.pages || {}, openZoom: w => openZoom(w),
  onSpread: lines => { if (!lines) { hush(); document.body.classList.remove("reading-aloud"); return; } readLines(lines); },
  onClose: () => { document.body.classList.remove("reading-aloud"); hush(); } });
function readLines(lines) {
  document.body.classList.add("reading-aloud"); $("guide").hidden = false;
  talk(lines, [["とめる", () => { hush(); document.body.classList.remove("reading-aloud"); }]]).then(ok => { if (ok) setTimeout(() => document.body.classList.remove("reading-aloud"), 1200); });
}
function readAloud(i) { reader.open(i); }
function standFor(bay, sl) {
  const back = sl?.big ? 3.1 : 2.4, x = sl ? sl.x : 0;
  const v = new THREE.Vector3(x, 0, back).applyAxisAngle(new THREE.Vector3(0, 1, 0), bay.facing).add(bay.center);
  const look = new THREE.Vector3(x, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), bay.facing).add(bay.center);
  return { v, look };
}
const workKey = (bay, w) => `${bay.r.slug}/${bay.k.id}/${bay.k.works.indexOf(w)}`;
// 作品は二段で押す：一度目＝正面へ寄って、碧がその作品の話をする。二度目（近くにいるとき）＝札をひらく
function approach(bay, sl, then) {
  if (tour.on && !tour.susp) suspendTour();
  const { v, look } = standFor(bay, sl);
  if (Math.hypot(me.pos.x - v.x, me.pos.z - v.z) < 1.2) { me.yaw += wrapA(Math.atan2(-(look.x - me.pos.x), -(look.z - me.pos.z)) - me.yaw); openPanel(bay.k, sl?.w); then?.(); return; }
  A.goal = new THREE.Vector3((sl?.x || 0) < -1 ? 1.1 : -1.25, 0, 1.45).applyAxisAngle(new THREE.Vector3(0, 1, 0), bay.facing).add(bay.center);
  A.look = look.clone(); A.point = 1;
  goTo(v, look, () => {
    if (then) { openPanel(bay.k, sl?.w); then(); return; }
    const line = T.work[workKey(bay, sl.w)];
    const acts = [["札をひらく", () => openPanel(bay.k, sl.w), true], ...(tour.susp ? [["案内の続きへ", resumeTour]] : []), ["自由に歩く", () => { A.goal = null; A.look = null; A.point = 0; freeTalk(T.idle.free); }]];
    const rel = bindCreatures(roomCreatures(bay.r.slug, bay.k.id, sl.w.f));
    talk(line ? [line, T.idle.twice] : [T.idle.twice], acts).then(rel);
  });
}

// キーボード
addEventListener("keydown", e => {
  if (e.target.closest?.("input,textarea,select")) return;
  const k = e.key.toLowerCase();
  if (reader.isOpen) { reader.key(e); return; }
  if (mode !== "walk") return;
  if (k === "escape") { closeAll(); return; }
  if (k === "m") { HOLO.open_ ? HOLO.close() : HOLO.open(); return; }
  if (k === " " && !anySheet()) { e.preventDefault(); pauseSpeech(!SP.paused); return; }
  if (k === "n" && tour.on) { tourNextKei(); return; }
  if (["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k) && !anySheet()) { keys.add(k); if (k.startsWith("arrow")) e.preventDefault(); }
});
addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
addEventListener("blur", () => keys.clear());
const joy = { on: false, x: 0, y: 0, id: null };
{
  const el = $("joy"), knob = el.querySelector("i");
  el.addEventListener("pointerdown", e => { joy.id = e.pointerId; joy.on = true; el.setPointerCapture(e.pointerId); mv(e); });
  el.addEventListener("pointermove", e => { if (e.pointerId === joy.id) mv(e); });
  const up = () => { joy.on = false; joy.x = joy.y = 0; knob.style.transform = ""; };
  el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  function mv(e) { const r = el.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } joy.x = Math.abs(x) < .15 ? 0 : x; joy.y = Math.abs(y) < .15 ? 0 : y; knob.style.transform = `translate(${x * 34}px,${y * 34}px)`; }
}

// ---------------------------------------------------------------- 碧（依代）
const AOI_H = 1.62;
let aoi = null, vrm = null;
const A = { pos: null, vel: new THREE.Vector3(), yaw: 0, sp: 0, k: 0, ph: 0, tk: 0, ws: 3, wsTo: .5, wsv: 0, tl: 14, tlT: null, tlS: 1, blink: 2, bt: -1, hip0: null, goal: null, look: null, point: 0, talkT: 0, springs: null, mouth: 0 };
async function loadAoi() {
  try {
    const [{ GLTFLoader }, { MeshoptDecoder }, V] = await Promise.all([import("three/addons/loaders/GLTFLoader.js"), import("three/addons/libs/meshopt_decoder.module.js"), import("@pixiv/three-vrm")]);
    const ld = new GLTFLoader(); ld.setMeshoptDecoder(MeshoptDecoder); ld.register(p => new V.VRMLoaderPlugin(p));
    const g = await ld.loadAsync(M.aoi, e => { if (e.total) prog(60 + 35 * e.loaded / e.total); });
    const v = g.userData.vrm; if (!v) throw new Error("VRM ではない");
    V.VRMUtils.removeUnnecessaryVertices(g.scene); (V.VRMUtils.combineSkeletons ?? V.VRMUtils.removeUnnecessaryJoints)?.(g.scene); V.VRMUtils.rotateVRM0(v);
    v.scene.traverse(o => { o.frustumCulled = false; });
    aoi = new THREE.Group(); aoi.add(v.scene); scene.add(aoi); vrm = v;
    const hp = v.humanoid.getNormalizedBoneNode("hips"); if (hp) A.hip0 = hp.position.clone();
    aoiPose(0); v.update(0); v.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(v.scene), h = box.max.y - box.min.y, sc = h > .5 ? AOI_H / h : 1;
    v.scene.scale.setScalar(sc); v.scene.position.y = -box.min.y * sc;
    A.head = v.humanoid.getRawBoneNode("head");
    A.gaze = new THREE.Object3D(); scene.add(A.gaze); if (v.lookAt) v.lookAt.target = A.gaze;
    const blob = new THREE.Mesh(new THREE.CircleGeometry(.42, 32), blobMat); blob.rotation.x = -Math.PI / 2; blob.position.y = .006; aoi.add(blob);
    A.springs = (v.springBoneManager?.joints ? [...v.springBoneManager.joints] : []).map(j => ({ j, g: j.settings.gravityDir.clone(), p: j.settings.gravityPower }));
    aoiJump();
    window.__aoi = { vrm, aoi, A };
  } catch (e) { console.warn("碧の姿を読み込めませんでした（声と字幕で案内します）：", e?.message ?? e); }
}
function safeSpot(p) {   // 通れる所へ寄せる（壁の中・壁ぎわ・台の上の目的地を、いちばん近い通れる点に）
  if (walkable(p.x, p.z, 1.3)) return p;
  for (let r = .3; r <= 3.6; r += .3) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; if (walkable(x, z, 1.3)) return new THREE.Vector3(x, 0, z); }
  return new THREE.Vector3(me.pos.x, 0, me.pos.z);
}
function inView(p) { const v = new THREE.Vector3(p.x, 1.2, p.z).project(camera); return Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1; }
function aoiJump() {
  if (!aoi) return;
  const s = followSpot(); A.pos = s.clone(); A.vel.set(0, 0, 0); A.yaw = Math.atan2(me.pos.x - s.x, me.pos.z - s.z); A.calm = 1.2; A.fade = 0;
}
function followSpot() {
  const reg = region(me.pos.x, me.pos.z);
  if (reg.kind === "room" && reg.u > FOY - .5) {
    const r = rooms[reg.i], fx0 = -Math.sin(me.yaw), fz0 = -Math.cos(me.yaw), lat = fx0 * r.p.x + fz0 * r.p.y;
    if (Math.abs(lat) > .62) {
      const side = Math.sign(lat), row = clamp(Math.floor((reg.u - FOY) / BAY), 0, r.rows - 1), k = r.keiAt(row, side > 0 ? 1 : -1);
      if (k) {
        const narrow = innerWidth / innerHeight < .8, inv = new THREE.Vector3(me.pos.x, 0, me.pos.z).sub(k.bay.center).applyAxisAngle(new THREE.Vector3(0, 1, 0), -k.bay.facing);
        const sx = narrow ? (inv.x < -1 ? .95 : -.95) : (inv.x < -.8 ? 2.95 : -2.95), sz = narrow ? 1.35 : 1.4;
        const q = new THREE.Vector3(sx, 0, sz).applyAxisAngle(new THREE.Vector3(0, 1, 0), k.bay.facing).add(k.bay.center).setY(0);
        if (Math.hypot(q.x - me.pos.x, q.z - me.pos.z) > 1.6) return q;
      }
    }
  }
  // ふだんは見る人の右前（となりを歩く）。スマホの縦長では近め・まん中寄り
  const narrow = innerWidth / innerHeight < .8, lib_ = space === "library", F = lib_ ? (narrow ? 1.6 : 1.0) : narrow ? 2.9 : 2.5, X = lib_ ? (narrow ? 1.1 : 1.8) : narrow ? .55 : 1.1;
  const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw), rx = -fz, rz = fx;
  let x = me.pos.x + fx * F + rx * X, z = me.pos.z + fz * F + rz * X;
  for (let k = 0; k < 6 && !walkable(x, z, 1.3); k++) { x = (x + me.pos.x) / 2; z = (z + me.pos.z) / 2; }
  return new THREE.Vector3(x, 0, z);
}
function aoiTick(dt) {
  if (!vrm) return;
  if (mode !== "walk") { aoi.visible = false; return; }
  // 2026-10-09 本人「碧が壁に向かって歩き続け、こちらが動いてもついてこない」：
  //   原因＝目的地へまっすぐ引っぱるだけで、壁の向こう（となりの部屋・扉の外）や壁ぎわの通れない所が目的地になると、壁に押しつけられたまま止まっていた。
  //   直し＝①目的地を通れる所へ寄せる ②人と同じ道すじ（扉を通る）を、碧の位置から引いてたどる ③進めない時間が続いたら、案内の目的地を捨てて人のそばへもどる（見えていなければ近くに出なおす）
  // 人が離れていったら、案内の目的地を捨てて人について行く（案内中・話している途中はのぞく）
  if (A.goal && !(tour.on && !tour.susp) && !SP.resolve && Math.hypot(me.pos.x - A.pos.x, me.pos.z - A.pos.z) > 9) { A.goal = null; A.look = null; A.point = 0; }
  const goal = safeSpot(A.goal || followSpot());
  if (A.pos.distanceTo(goal) > 14) { A.pos.copy(goal); A.vel.set(0, 0, 0); A.calm = 1.2; A.wp = null; }
  A.repath = (A.repath || 0) - dt;
  if (!A.wp || A.repath <= 0 || !A.goalKey || A.goalKey.distanceTo(goal) > .8) { A.wp = route(goal, false, A.pos).map(p => p.setY(0)); A.goalKey = goal.clone(); A.repath = .7; }
  while (A.wp.length > 1 && Math.hypot(A.wp[0].x - A.pos.x, A.wp[0].z - A.pos.z) < .7) A.wp.shift();
  const tgt = A.wp[0] || goal;
  const w = A.goal ? 4.2 : 3.4, n = Math.max(1, Math.ceil(dt / .02)), h = dt / n, vmax = 2.6;
  // 進めないことの見張り
  const dGoal = Math.hypot(goal.x - A.pos.x, goal.z - A.pos.z);
  if (!A.lastP) A.lastP = A.pos.clone();
  A.stuckT = (A.stuckT || 0) + dt;
  if (A.stuckT > 1.5) {
    const moved = Math.hypot(A.pos.x - A.lastP.x, A.pos.z - A.lastP.z);
    if (dGoal > .9 && moved < .25) {
      A.stuck = (A.stuck || 0) + 1;
      if (A.goal && A.stuck >= 2) { A.goal = null; A.look = null; A.point = 0; }   // 案内の目的地に行けない → 人のそばへ
      else if (A.stuck >= 3) { const s = safeSpot(followSpot()); const seen = aoi.visible && inView(A.pos); if (!seen) { A.pos.copy(s); A.vel.set(0, 0, 0); } A.wp = null; A.stuck = 0; }
    } else A.stuck = 0;
    A.stuckT = 0; A.lastP.copy(A.pos);
  }
  for (let i = 0; i < n; i++) {
    A.vel.x += (w * w * (tgt.x - A.pos.x) - 2 * w * A.vel.x) * h; A.vel.z += (w * w * (tgt.z - A.pos.z) - 2 * w * A.vel.z) * h;
    const m = Math.hypot(A.vel.x, A.vel.z); if (m > vmax) { A.vel.x *= vmax / m; A.vel.z *= vmax / m; }
    const nx = A.pos.x + A.vel.x * h, nz = A.pos.z + A.vel.z * h;
    if (walkable(nx, nz, 1.3) || !walkable(A.pos.x, A.pos.z, 1.3)) { A.pos.x = nx; A.pos.z = nz; } else { A.vel.multiplyScalar(.5); }
  }
  A.sp += (Math.hypot(A.vel.x, A.vel.z) - A.sp) * ease(dt, 5);
  const toCam = Math.atan2(me.pos.x - A.pos.x, me.pos.z - A.pos.z);
  let fy = A.sp > .35 ? Math.atan2(A.vel.x, A.vel.z) : toCam;
  if (A.sp <= .35 && A.look) { const toW = Math.atan2(A.look.x - A.pos.x, A.look.z - A.pos.z); fy = toCam + wrapA(toW - toCam) * .5; }
  else if (A.sp <= .35) { const wt0 = EX.watch?.(); if (wt0) { const toW = Math.atan2(wt0.pos.x - A.pos.x, wt0.pos.z - A.pos.z); fy = toCam + wrapA(toW - toCam) * .45; } }
  A.yaw += clamp(wrapA(fy - A.yaw) * ease(dt, 4), -2.2 * dt, 2.2 * dt);
  aoi.position.set(A.pos.x, groundY(A.pos.x, A.pos.z), A.pos.z); aoi.rotation.y = A.yaw;
  aoi.visible = Math.hypot(A.pos.x - me.pos.x, A.pos.z - me.pos.z) > .9;
  const lookWork = A.look && A.talkT < 2.6;
  // 抜け出た生きものを目で追い、とまりそうなら左手を差し出す（2026-10-09 本人）
  const wt = EX?.watch?.(), watching = wt && !lookWork;
  A.offer = (A.offer || 0) + ((wt && wt.perch ? 1 : 0) - (A.offer || 0)) * ease(dt, 3);
  if (A.gaze) { if (lookWork) A.gaze.position.set(A.look.x, 1.9 + groundY(A.look.x, A.look.z), A.look.z); else if (watching) A.gaze.position.copy(wt.pos); else A.gaze.position.copy(camera.position); }
  A.talkT += dt;
  if (A.springs && !RM) { const t = performance.now() / 1000; for (const s of A.springs) { s.j.settings.gravityDir.set(s.g.x + .22 * Math.sin(t * .63 + s.g.y), s.g.y, s.g.z + .14 * Math.sin(t * .41)).normalize(); s.j.settings.gravityPower = Math.max(s.p, .05); } }
  aoiPose(dt, A.sp, wrapA(toCam - A.yaw), lookWork ? wrapA(Math.atan2(A.look.x - A.pos.x, A.look.z - A.pos.z) - A.yaw) : 0);
  // 口：声の大きさに合わせる（声を切っているときは、字幕のあいだ小さく）
  const lv = AUD.level(), talking = $("guide").classList.contains("talking");
  const want = SP.playing ? clamp(lv * 7, 0, 1) : talking && !SP.paused ? .18 + .18 * Math.abs(Math.sin(performance.now() / 90)) : 0;
  A.mouth += (want - A.mouth) * ease(dt, 18); vrm.expressionManager?.setValue("aa", A.mouth * .8);
  vrm.update(dt);
  // 2026-10-07 本人「碧が登場するときにワンピースが不自然に大きく揺れる」→ 現れてしばらくは、揺れものをいまの姿勢で止めておく（そのあいだに姿がゆっくり出る）
  if (A.calm > 0) { A.calm -= dt; const sbm = vrm.springBoneManager; sbm?.setInitState?.(); sbm?.reset?.(); }
  if (A.fade < 1) { A.fade = Math.min(1, (A.fade || 0) + dt / .9); aoiOpacity(A.fade); }
}
let aoiMats = null;
function aoiOpacity(o) {
  if (!aoiMats) { aoiMats = []; aoi.traverse(m => { if (m.isMesh) for (const mt of [].concat(m.material)) { aoiMats.push([mt, mt.transparent, mt.depthWrite]); } }); }
  for (const [mt, tr, dw] of aoiMats) { mt.transparent = o < 1 ? true : tr; mt.opacity = o; mt.depthWrite = o < 1 ? o > .6 : dw; mt.needsUpdate = true; }
}
// 体の動き：《Feel Hikawa》第2回の aoiPose を借り、ひじの向きだけ逆にした（_dev/check.mjs が毎回測る）
const CUR = {};
function aoiPose(dt, sp = 0, toCamLocal = 0, aim = 0) {
  const live = !RM, t = performance.now() / 1000, T_ = {};
  const S = (n, x = 0, y = 0, z = 0) => { T_[n] = [x, y, z]; };
  const kT = clamp((sp - .15) / .8, 0, 1); A.k += (kT - A.k) * ease(dt, 2.6); const k = A.k;
  A.ph += 2 * Math.PI * (.45 + .35 * Math.min(sp, 2)) * dt * Math.min(1, k * 1.5);
  const s1 = Math.sin(A.ph), c1 = Math.cos(A.ph), br = live ? Math.sin(t * 2 * Math.PI / 4.2) : 0;
  const talk = $("guide").classList.contains("talking");
  A.tk += ((talk ? 1 : 0) - A.tk) * ease(dt, 3); const tk = live ? A.tk : 0;
  const greet = live && talk && A.talkT < 1.6 ? Math.sin(Math.min(1, A.talkT / 1.6) * Math.PI) : 0;
  const pt = live && A.look && A.point ? clamp(Math.min((A.talkT - .5) / .6, (3.4 - A.talkT) / .6), 0, 1) : 0, ptE = pt * pt * (3 - 2 * pt);
  if (live) { A.ws -= dt; if (A.ws <= 0) { A.wsTo = -A.wsTo || .5; A.ws = 4 + Math.random() * 3; } A.wsv += (A.wsTo - A.wsv) * ease(dt, 1.5);
    A.tl -= dt; if (A.tl <= 0 && k < .4 && Math.random() < dt * .25) { A.tl = 20 + Math.random() * 10; A.tlT = 0; A.tlS = Math.random() < .5 ? 1 : -1; }
    if (A.tlT != null) { A.tlT += dt; if (A.tlT > 2.2) A.tlT = null; } }
  const ws = (1 - k) * A.wsv, tilt = A.tlT != null ? Math.sin(Math.min(1, A.tlT / 2.2) * Math.PI) * .14 * A.tlS : 0;
  const turn = clamp(toCamLocal, -.7, .7) * Math.max(greet, .45 * tk) * (1 - ptE);
  aim = clamp(aim, -.6, .6);
  const hips = vrm.humanoid.getNormalizedBoneNode("hips");
  if (hips && A.hip0) hips.position.set(A.hip0.x + (.012 * s1 * k + .018 * ws), A.hip0.y + .015 * Math.cos(2 * A.ph) * k - .004 * (1 - k) * br, A.hip0.z);
  S("hips", 0, .07 * s1 * k, (.035 * s1 * k + .04 * ws));
  S("spine", .04 * k - .006 * br, -.05 * s1 * k + turn * .15, -.02 * ws);
  S("chest", -.012 * br, -.04 * s1 * k + turn * .15 + aim * .25 * ptE, -.015 * ws);
  S("upperChest", -.01 * br, turn * .15 + aim * .2 * ptE, 0);
  const lt = -.36 * s1 * k, rt = .36 * s1 * k, lk = k * (.06 + .62 * Math.pow(Math.max(0, c1), 1.5)) + .05 * Math.max(0, ws), rk = k * (.06 + .62 * Math.pow(Math.max(0, -c1), 1.5)) + .05 * Math.max(0, -ws);
  S("leftUpperLeg", lt, 0, .015 + .03 * ws); S("rightUpperLeg", rt, 0, -.015 + .03 * ws);
  S("leftLowerLeg", lk); S("rightLowerLeg", rk);
  S("leftFoot", -(lt + lk) * .75); S("rightFoot", -(rt + rk) * .75);
  const gst = tk * (1 - ptE) * (1 - k * .6), gw = live ? Math.sin(t * 2 * Math.PI * .33) : 0;
  const of = live ? clamp(A.offer || 0, 0, 1) * (1 - k) : 0, ofE = of * of * (3 - 2 * of);   // 手を差し出す（右手の指さしの形を左に写し、ひじを少し曲げる）
  const lUA = [.26 * s1 * k - .05 * (1 - k), 0, -1.3 + .04 * br * (1 - k)], lLA = [0, -(.28 + .14 * k + .12 * Math.max(0, -s1) * k), 0], oUA = [-.2, -.95, -.6], oLA = [0, -.45, 0];
  S("leftUpperArm", ...lUA.map((v, i) => v + (oUA[i] - v) * ofE));
  S("leftLowerArm", ...lLA.map((v, i) => v + (oLA[i] - v) * ofE));
  S("leftHand", .05 - .25 * ofE, 0, .12 - .1 * ofE);
  const rUA = [-.26 * s1 * k - .05 * (1 - k) - .16 * gst, 0, 1.3 - .04 * br * (1 - k) - .08 * gst], rLA = [0, .28 + .14 * k + .12 * Math.max(0, s1) * k + (.38 + .1 * gw) * gst, 0];
  const pUA = [-.15, 1.15 + aim * .6, .55], pLA = [0, .12, 0];
  S("rightUpperArm", ...rUA.map((v, i) => v + (pUA[i] - v) * ptE)); S("rightLowerArm", ...rLA.map((v, i) => v + (pLA[i] - v) * ptE));
  S("rightHand", .05 + .1 * gst * gw, 0, -.12 + .12 * ptE);
  const cu = .34 + .06 * k + (live ? .04 * Math.sin(t * .4) : 0);
  for (const [f, m] of [["Index", .8], ["Middle", 1], ["Ring", 1.1], ["Little", 1.25]]) {
    const cl = cu * m, cr = f === "Index" ? cl * (1 - ptE) : cl + .35 * ptE;
    S(`left${f}Proximal`, 0, 0, -cl); S(`left${f}Intermediate`, 0, 0, -cl * 1.15); S(`left${f}Distal`, 0, 0, -cl * .8);
    S(`right${f}Proximal`, 0, 0, cr); S(`right${f}Intermediate`, 0, 0, cr * 1.15); S(`right${f}Distal`, 0, 0, cr * .8);
  }
  S("leftThumbProximal", 0, .3, -.08); S("leftThumbDistal", 0, .15, -.2); S("rightThumbProximal", 0, -.3, .08); S("rightThumbDistal", 0, -.15, .2);
  const nod = live ? .12 * greet : 0;
  S("neck", nod * .4 - .02 * br, turn * .2 + aim * .2 * ptE, tilt * .4);
  S("head", nod * .6, turn * .35 + aim * .3 * ptE, tilt * .6);
  const r = live ? 12 : 30;
  for (const [nme, tg] of Object.entries(T_)) {
    const b = vrm.humanoid.getNormalizedBoneNode(nme); if (!b) continue;
    const c = CUR[nme] ||= [...tg];
    for (let i = 0; i < 3; i++) c[i] += dt ? clamp((tg[i] - c[i]) * ease(dt, r), -.14, .14) : tg[i] - c[i];
    b.rotation.set(c[0], c[1], c[2]);
  }
  let bv = 0;
  if (live) { if (A.bt < 0) { A.blink -= dt; if (A.blink <= 0) A.bt = 0; } else { A.bt += dt; const u = A.bt; bv = u < .09 ? u / .09 : u < .12 ? 1 : u < .26 ? 1 - (u - .12) / .14 : 0; if (u >= .26) { A.bt = -1; A.blink = 3.5 + Math.random() * 4.5; } } }
  vrm.expressionManager?.setValue("blink", bv * bv * (3 - 2 * bv));
}

// ---------------------------------------------------------------- 碧と巡る（声で案内し、となりを歩く。景のあいだに雑談）
const tour = { on: false, room: 0, j: -1, susp: false, tok: 0 };
function freeActs() {
  const reg = region(me.pos.x, me.pos.z), a = [];
  if (tour.susp) a.push(["案内の続きへ", resumeTour, true]);
  if (space === "library") return libActs();
  a.push(["部屋をえらぶ", openMap, !tour.susp]);
  if (reg.kind !== "room") a.push([`${NAMES.library}へ`, goWarp]);
  a.push([reg.kind === "room" ? "この部屋を順に案内して" : "順に案内して", () => runTour(reg.kind === "room" ? reg.i : 0)]);
  return a;
}
function freeTalk(lines) { if (tour.on && !tour.susp) return Promise.resolve(false); return talk(lines, freeActs()); }
function tourActs() {
  const r = rooms[tour.room];
  return [[SP.paused ? "▶" : "⏸", () => pauseSpeech(!SP.paused), false, SP.paused ? "続ける" : "一時停止"],
    ["⏭", skipLine, false, "このことばをとばす"],
    [tour.j >= r.kei.length - 1 ? "おわりへ" : "次の景 ›", tourNextKei, true],
    ...(tour.j >= 0 ? [["札", () => { const k = r.kei[tour.j]; openPanel(k, k.bay.slots[0]?.w); }]] : []),
    ["✕", () => stopTour(true), false, "案内をやめる"]];
}
async function walkToKei(j, tk) {
  const r = rooms[tour.room], k = r.kei[j], bay = k.bay, rep = bay.slots[0];
  const narrow = innerWidth / innerHeight < .8;
  A.goal = new THREE.Vector3(narrow ? -.95 : -2.95, 0, narrow ? 1.35 : 1.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), bay.facing).add(bay.center);
  A.look = new THREE.Vector3(rep?.x || 0, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), bay.facing).add(bay.center); A.point = 0;
  const stand = new THREE.Vector3(narrow ? -.2 : -.8, 0, 4.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), bay.facing).add(bay.center);
  const lookAt = new THREE.Vector3(narrow ? -.2 : -.8, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), bay.facing).add(bay.center);
  const far = Math.hypot(me.pos.x - stand.x, me.pos.z - stand.z) > 2;
  const walking = goP(stand, lookAt);
  if (far && j > 0) { const ln = T.move[(j + tour.room) % T.move.length]; speakLine(ln); }
  await walking;
  if (tk !== tour.tok) return false;
  if (SP.resolve && T.move.includes(SP.cur)) await new Promise(res => { const t = setInterval(() => { if (!SP.resolve) { clearInterval(t); res(); } }, 80); });
  return tk === tour.tok;
}
async function runTour(i, j0 = -1) {
  hush(); closePanel();
  const tk = ++tour.tok; Object.assign(tour, { on: true, room: i, j: j0, susp: false });
  const r = rooms[i], TR = T.rooms[i];
  curActs = tourActs; setActs(tourActs()); $("guide").hidden = false; if ($("guide").classList.contains("folded")) fold(false);
  const reg = region(me.pos.x, me.pos.z);
  if (!(reg.kind === "room" && reg.i === i)) { A.goal = null; A.look = null; await new Promise(res => enterRoom(i, res, true)); if (tk !== tour.tok) return; }
  if (j0 < 0) { if (!await sayQ(TR.intro)) return; if (tk !== tour.tok) return; j0 = 0; }
  for (let j = j0; j < r.kei.length; j++) {
    tour.j = j; setActs(tourActs());
    if (!await walkToKei(j, tk)) return;
    const K = TR.kei[j]; talkAt = { i, j };
    const relC = bindCreatures(roomCreatures(r.slug, r.kei[j].id));
    const ok = await sayQ([...K.lines, K.side], { before: (t, n) => { A.point = n === 1 ? 1 : 0; A.talkT = 0; } }); relC();
    if (!ok || tk !== tour.tok) return;
    A.point = 0;
    const tok = SP.tok; await sleep(1500); if (!await waitRun(tok) || tk !== tour.tok) return;
  }
  // 部屋のおわり
  tour.on = false; A.goal = null; A.look = null; A.point = 0;
  const nx = (i + 1) % rooms.length;
  curActs = () => [[`次の部屋「${rooms[nx].name}」へ`, () => runTour(nx), true], ["部屋をえらぶ", openMap], ["自由に歩く", () => freeTalk(T.idle.free)]];
  setActs(curActs());
  await sayQ(TR.outro);
}
function tourNextKei() { if (!tour.on) return; const r = rooms[tour.room]; if (tour.j >= r.kei.length - 1) { tour.tok++; hush(); runTour(tour.room, r.kei.length); return; } runTour(tour.room, tour.j + 1); }
function suspendTour() { if (!tour.on) return; tour.susp = true; tour.tok++; hush(); A.goal = null; A.look = null; A.point = 0; curActs = freeActs; setActs(freeActs()); }
function resumeTour() { const j = Math.max(0, tour.j); tour.susp = false; talk([T.idle.resume], []).then(() => runTour(tour.room, j)); }
function stopTour(talkIt) {
  tour.on = false; tour.susp = false; tour.tok++; hush(); A.goal = null; A.look = null; A.point = 0;
  if (talkIt) freeTalk(T.idle.free);
}
function enterRoom(i, then, keepTour) {
  if (!keepTour) stopTour(false);
  closeAll(); A.goal = null; A.look = null; A.point = 0;
  const p = W(i, 1.6, 0), look = W(i, 12, 0);
  if (space === "library") { doWarp(() => teleport(p, look, then)); return; }
  if (region(me.pos.x, me.pos.z).kind === "room" && region(me.pos.x, me.pos.z).i === i) { goTo(p, look, then); return; }
  teleport(p, look, then);
}
function aoiTapped() {
  const reg = region(me.pos.x, me.pos.z);
  if (tour.on && !tour.susp) { pauseSpeech(!SP.paused); return; }
  if (space === "library") { talk([T.library[1]], libActs()); return; }
  freeTalk(reg.kind === "room" ? [T.rooms[reg.i].intro[0], T.idle.hello] : [T.idle.hello]);
}

// ---------------------------------------------------------------- 札（作品の説明）
let curPanel = null, panelPaused = false;
function workHTML(w) {
  if (!w) return "";
  const body = w.f ? `<img class="im" src="${esc(w.f)}" alt="${esc(w.title)}" data-zoom="1">` : `<div class="quote">「${esc(w.quote)}」</div>`;
  return `<div class="work">${body}${credit(w)}${w.note ? `<p>${esc(w.note)}</p>` : ""}${w.f ? `<div class="row"><button class="btn" data-zoom="1">拡大する</button></div>` : ""}</div>`;
}
function openPanel(k, w) {
  w = w || k.works.find(x => x.f) || k.works[0];
  const r = rooms[k.room]; curPanel = { k, w };
  if (tour.on && !tour.susp && !SP.paused) { pauseSpeech(true); panelPaused = true; }
  const thumbs = k.works.map((x, i) => x.f
    ? `<button data-w="${i}" aria-label="${esc(x.title)}" aria-current="${x === w}"><img loading="lazy" src="${esc(x.f)}" alt=""></button>`
    : `<button class="q" data-w="${i}" aria-label="文学：${esc(x.title)}" aria-current="${x === w}">「${esc((x.quote || "").slice(0, 26))}」</button>`).join("");
  const snd = k.snd ? `<div class="snd"><h3>音（借りた録音）</h3>${sndHTML(k.snd, 0)}</div>` : "";
  const layers = (k.layers || []).map(([a, b]) => `<details><summary>${esc(a)}</summary><p>${esc(b)}</p></details>`).join("");
  $("panel").innerHTML = `<div class="ph"><div class="no">${esc(r.name)}　${esc(k.no || "")}</div><h2>${esc(k.name)}</h2><div class="yomi">${esc(k.yomi)}　${esc(k.en)}</div>
    <button class="ico x" id="panelX" aria-label="札を閉じる">✕</button></div>
    <div class="pb">${workHTML(w)}
    <h3>この景の作品（${k.works.length}）</h3><div class="thumbs">${thumbs}</div>
    <h3>景のはなし</h3><p>${esc(k.lead)}</p>${layers}
    ${k.invite ? `<h3>やってみる</h3><p>${esc(k.invite)}</p>` : ""}${snd}
    <h3>森羅百景で読む</h3><p><a href="${esc(r.page)}#kei=${esc(k.id)}" target="_blank" rel="noopener">${esc(r.name)}の「${esc(k.name)}」をひらく</a></p></div>`;
  $("panel").hidden = false; $("panel").scrollTop = 0; document.body.classList.add("panel-open");
  $("panelX").onclick = closePanel;
  $("panel").querySelectorAll("[data-w]").forEach(b => b.onclick = () => { openPanel(k, k.works[+b.dataset.w]); });
  $("panel").querySelectorAll("[data-zoom]").forEach(b => b.onclick = () => openZoom(w));
  wireSnd(k.snd ? [k.snd] : []);
  if (isTouch) fold(true);
  $("panelX").focus({ preventScroll: true });
}
function closePanel() { if ($("panel").hidden) return; $("panel").hidden = true; document.body.classList.remove("panel-open"); curPanel = null; stopSound(); if (isTouch) fold(false); if (panelPaused) { panelPaused = false; pauseSpeech(false); } }
const Z = { s: 1, x: 0, y: 0, pts: new Map(), d0: 0, s0: 1 };
function openZoom(w) {
  const z = $("zoom"), im = z.querySelector("img"); im.src = w.f; im.alt = w.title;
  z.querySelector(".cap").textContent = `${w.title}　${w.artist || w.author || ""}　${w.date || ""}　${w.museum || ""}　${w.lic || ""}`;
  Z.s = 1; Z.x = Z.y = 0; zApply(); z.hidden = false; $("zoomX").focus();
}
function zApply() { $("zoom").querySelector("img").style.transform = `translate(calc(-50% + ${Z.x}px), calc(-50% + ${Z.y}px)) scale(${Z.s})`; }
{
  const z = $("zoom");
  z.addEventListener("wheel", e => { e.preventDefault(); Z.s = clamp(Z.s * Math.exp(-e.deltaY * .0015), 1, 6); if (Z.s === 1) Z.x = Z.y = 0; zApply(); }, { passive: false });
  z.addEventListener("pointerdown", e => { if (e.target.closest("button")) return; Z.pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); z.setPointerCapture(e.pointerId); if (Z.pts.size === 2) { const [a, b] = [...Z.pts.values()]; Z.d0 = Math.hypot(a.x - b.x, a.y - b.y); Z.s0 = Z.s; } Z.last = { x: e.clientX, y: e.clientY };
    const now = performance.now(); if (Z.tap && now - Z.tap < 300) { Z.s = Z.s > 1 ? 1 : 2.4; Z.x = Z.y = 0; zApply(); } Z.tap = now; });
  z.addEventListener("pointermove", e => { if (!Z.pts.has(e.pointerId)) return; Z.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Z.pts.size === 2) { const [a, b] = [...Z.pts.values()]; Z.s = clamp(Z.s0 * Math.hypot(a.x - b.x, a.y - b.y) / Z.d0, 1, 6); }
    else if (Z.s > 1) { Z.x += e.clientX - Z.last.x; Z.y += e.clientY - Z.last.y; }
    Z.last = { x: e.clientX, y: e.clientY }; zApply(); });
  const up = e => { Z.pts.delete(e.pointerId); };
  z.addEventListener("pointerup", up); z.addEventListener("pointercancel", up);
  $("zoomX").onclick = () => { z.hidden = true; };
}
// 景の借りた録音（押したときだけ）
const AU = new Audio(); AU.loop = true; AU.preload = "none"; let auSrc = null, auBtn = null;
function sndHTML(s, i) {
  return `<button class="btn" data-snd="${i}">♪ 聴く：${esc(s.label)}</button>
    <div class="cred">録音：${esc(s.who)}（${esc(s.date)}）・${esc(s.where)}・${licHTML(s.lic, s.licurl)}・<a href="${esc(s.page)}" target="_blank" rel="noopener">元のファイル</a>。mitsulab が録った音ではありません。</div>`;
}
function wireSnd(list) { $("panel").querySelectorAll("[data-snd]").forEach(b => { const s = list[+b.dataset.snd]; b.dataset.label = b.textContent; b.onclick = () => toggleSound(s, b); }); }
function toggleSound(s, b) {
  if (auSrc === s.f && !AU.paused) { stopSound(); return; }
  stopSound(); AUD.init(); AU.muted = AUD.muted;
  AU.src = s.f; auSrc = s.f; auBtn = b; AU.currentTime = 0; AUD.setDuck(.2);
  AU.play().then(() => { if (b) b.textContent = "■ とめる"; }).catch(() => toast("音を鳴らせませんでした"));
}
function stopSound() { if (!AU.paused) AU.pause(); if (auBtn) auBtn.textContent = auBtn.dataset.label || auBtn.textContent; auSrc = null; auBtn = null; if (!SP.playing) AUD.setDuck(1); }

// ---------------------------------------------------------------- 地図
// 2026-10-08 本人「館内の地図をもっと分かりやすく（字の大きさ・太さ・背景との差・重なり）。部屋の形・いまいる場所・向き・入口が一目で」
//   部屋はどれも同じ長さ（LM m）の帯に描く（略図）＝広間と入口が大きく、部屋の名が帯の中に収まる。部屋の名は帯に沿って、濃い札に白い太字。
const LM = 21, KUf = r => LM / r.L;
const MAPR = R + LM + 1.5;
const mapPt = (x, z) => { if (region(x, z).kind === "room") { const l = local(x, z); return WF(rooms[l.i], l.u * KUf(rooms[l.i]), l.v); } return new THREE.Vector3(x, 0, z); };
function drawPlan(cv, big) {
  const g = cv.getContext("2d"), S = cv.width, sc = S / 2 / MAPR, cx = S / 2, cy = S / 2;
  g.clearRect(0, 0, S, S);
  const P = (x, z) => [cx + x * sc, cy + z * sc];
  const arrow = (mx, my, rot, z) => {
    g.save(); g.translate(mx, my); g.rotate(rot);
    if (big) { g.fillStyle = "rgba(255,90,70,.22)"; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, z * 3.2, -Math.PI / 2 - .55, -Math.PI / 2 + .55); g.closePath(); g.fill(); }   // 見ている向き
    g.fillStyle = "#ff4d3a"; g.strokeStyle = "#fff"; g.lineWidth = big ? 4 : 2.5; g.beginPath(); g.moveTo(0, -z); g.lineTo(z * .75, z * .75); g.lineTo(0, z * .35); g.lineTo(-z * .75, z * .75); g.closePath(); g.stroke(); g.fill(); g.restore();
  };
  const pill = (txt, x, y, ang, px, bg, fg, bd, maxW) => {   // 帯に沿った札（逆さにならない向き）。maxW を越える長さなら字を小さく
    let a = ang; if (Math.cos(a) < 0) a += Math.PI;
    if (maxW) { g.font = `700 ${px}px ${GOTH}`; const need = g.measureText(txt).width + px * .9; if (need > maxW) px = Math.floor(px * maxW / need); }
    g.save(); g.translate(x, y); g.rotate(a); g.font = `700 ${px}px ${GOTH}`; g.textAlign = "center"; g.textBaseline = "middle";
    const w = g.measureText(txt).width + px * .9, h = px * 1.45;
    g.fillStyle = bg; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, h / 2); g.fill(); if (bd) { g.strokeStyle = bd; g.lineWidth = Math.max(2, px * .12); g.stroke(); }
    g.fillStyle = fg; g.fillText(txt, 0, px * .04); g.restore();
  };
  const poly = (cs, fill, stroke) => { g.beginPath(); cs.forEach((p, k) => { const [x, y] = P(p.x, p.z); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = big ? 3 : 1.5; g.stroke(); } };
  if (space === "library") {   // 書架の間の平面（書架・百景の棚・机）
    const s2 = S / 2 / (LIB.Z + 2), Q = (x, z) => [cx + x * s2, cy + z * s2];
    g.fillStyle = "#4a3622"; g.fillRect(...Q(-LIB.X, -LIB.Z), 2 * LIB.X * s2, 2 * LIB.Z * s2);
    g.strokeStyle = "#e8d3a8"; g.lineWidth = big ? 4 : 2; g.strokeRect(...Q(-LIB.X, -LIB.Z), 2 * LIB.X * s2, 2 * LIB.Z * s2);
    g.fillStyle = "#8a6638"; g.fillRect(...Q(-2.6, -5.35), 5.2 * s2, .7 * s2); g.fillRect(...Q(-4.2, -.4), 2 * s2, 3.6 * s2);
    g.fillStyle = "#f3c969"; g.fillRect(...Q(-LIB.DOOR, LIB.Z - .1), 2 * LIB.DOOR * s2, .5 * s2);   // 入口
    if (big) { const px = Math.round(S * .045); pill("百景の棚", ...Q(0, -4.1), 0, px * .8, "rgba(20,14,8,.85)", "#fff"); pill("読書の机", ...Q(-3.2, 3.9), 0, px * .8, "rgba(20,14,8,.85)", "#fff"); pill("入口（広間へ）", ...Q(0, LIB.Z - 1.3), 0, px * .8, "#f3c969", "#1b140c"); }
    const ml = libLocal(me.pos.x, me.pos.z), [mx, my] = Q(ml.x, ml.z); arrow(mx, my, -(me.yaw - LIBO.th), big ? 16 : 9);
    if (big) pill("いまここ", mx, my - S * .06, 0, Math.round(S * .036), "#ff4d3a", "#fff");
    return;
  }
  const reg = region(me.pos.x, me.pos.z);
  // 広間（十一角）・玄関・書架の間
  const lob = []; for (let k = 0; k < NF; k++) { const a = faceTh(k) + HA; lob.push(new THREE.Vector3(Math.sin(a) * RR, 0, -Math.cos(a) * RR)); }
  poly(lob, reg.kind === "lobby" ? "#9c8462" : "#7a684e", "#e8d3a8");
  poly([E(-.2, -DOOR - .4), E(VEST, -DOOR - .4), E(VEST, DOOR + .4), E(-.2, DOOR + .4)], "#7a684e", "#e8d3a8");
  poly([[-LIB.X, -LIB.Z], [LIB.X, -LIB.Z], [LIB.X, LIB.Z + .5], [-LIB.X, LIB.Z + .5]].map(([x, z]) => libWorld(new THREE.Vector3(x, 0, z))), "#5a4430", "#e8d3a8");
  for (const r of rooms) {
    const L = LM;
    poly([WF(r, -.2, -HALF), WF(r, L, -HALF), WF(r, L, HALF), WF(r, -.2, HALF)], r.acc, reg.kind === "room" && reg.i === r.i ? "#fff" : "rgba(0,0,0,.55)");
  }
  // 入口（扉）＝金の線
  g.strokeStyle = "#f3c969"; g.lineWidth = big ? 6 : 3; g.lineCap = "round";
  for (const F of [ENT, LIB_FACE, ...rooms]) { const a = WF(F, 0, -DOOR), b = WF(F, 0, DOOR), [x1, y1] = P(a.x, a.z), [x2, y2] = P(b.x, b.z); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  if (big) {
    const px = Math.round(S * .04);
    for (const r of rooms) { const c = WF(r, LM * .55, 0), [x, y] = P(c.x, c.z); pill(r.name, x, y, Math.atan2(r.d.y, r.d.x), px, "rgba(20,14,8,.88)", "#fff", r.acc, LM * sc * .92); }
    pill("広間", ...P(0, -7), 0, px, "rgba(20,14,8,.88)", "#fff");
    { const c = E(VEST * .5), [x, y] = P(c.x, c.z); pill("玄関", x, y, 0, px * .85, "rgba(20,14,8,.88)", "#fff"); }
    { const c = libWorld(new THREE.Vector3(0, 0, 0)), [x, y] = P(c.x, c.z); pill(NAMES.library, x, y, Math.atan2(LIB_FACE.d.y, LIB_FACE.d.x), px * .85, "rgba(20,14,8,.88)", "#fff", "#c9a45c", 2 * LIB.Z * sc * .9); }
  }
  if (aoi && A.pos) { const q = mapPt(A.pos.x, A.pos.z), [ax, ay] = P(q.x, q.z); g.fillStyle = "#4fd1c1"; g.strokeStyle = "#fff"; g.lineWidth = big ? 3 : 1.5; g.beginPath(); g.arc(ax, ay, big ? 9 : 5, 0, 7); g.fill(); g.stroke(); if (big) pill(NAMES.guide, ax + S * .045, ay, 0, Math.round(S * .03), "#4fd1c1", "#0d2a26"); }
  const q = mapPt(me.pos.x, me.pos.z), [mx, my] = P(q.x, q.z);
  arrow(mx, my, -me.yaw, big ? 16 : 9);   // 部屋は長さを縮めただけなので、向きはそのまま
  if (big) pill("いまここ", mx, my + S * .05, 0, Math.round(S * .034), "#ff4d3a", "#fff");
}
function drawMini() { drawPlan($("mini").querySelector("canvas"), false); }
function openMap() {
  closeAll(); $("map").hidden = false; drawPlan($("bigmap"), true);
  $("roomBtns").innerHTML = rooms.map(r => `<button data-r="${r.i}" style="--c:${r.acc}"><b>${esc(r.name)}</b><small>${r.kei.length} 景・${r.n} 点</small></button>`).join("");
  $("roomBtns").querySelectorAll("button").forEach(b => b.onclick = () => { const i = +b.dataset.r; $("map").hidden = true; enterRoom(i, () => freeTalk([T.rooms[i].intro[0]])); });
  $("roomBtns").querySelector("button")?.focus();
}
$("bigmap").addEventListener("click", e => {
  const cv = $("bigmap"), rc = cv.getBoundingClientRect(), S = cv.width, sc = S / 2 / MAPR;
  const x = ((e.clientX - rc.left) / rc.width * S - S / 2) / sc, z = ((e.clientY - rc.top) / rc.height * S - S / 2) / sc;
  const l0 = local(x, z), l = l0 && { ...l0, u: l0.u / KUf(rooms[l0.i]) };   // 部屋は長さを縮めて描いている
  if (space === "library") { $("map").hidden = true; return; }
  if (l && l.u > -.3 && l.u < rooms[l.i].L) { $("map").hidden = true; enterRoom(l.i, () => freeTalk([T.rooms[l.i].intro[0]])); }
  else if (!l || l.u <= -.3) { $("map").hidden = true; stopTour(false); teleport(START, new THREE.Vector3(0, 0, -10), () => freeTalk([T.lobby.at(-1)])); }
});
$("mini").onclick = () => HOLO.open_ ? HOLO.close() : HOLO.open();   // 3D 地図（2026-10-09 本人「どこからでも、ボタン一つで」）

// ---------------------------------------------------------------- 一覧（3D を使わない入口）
function openList() {
  closeAll();
  $("listBody").innerHTML = rooms.map(r => `<h3 style="--c:${r.acc}">${esc(r.name)} <small style="color:var(--dim);font-weight:400">${esc(r.desc)}</small></h3><ul>${r.kei.map((k, j) => `<li><button data-r="${r.i}" data-k="${j}">${esc(k.name)}<small>${k.works.length} 点</small></button></li>`).join("")}</ul>`).join("");
  $("listBody").querySelectorAll("button").forEach(b => b.onclick = () => { $("list").hidden = true; openPanel(rooms[+b.dataset.r].kei[+b.dataset.k]); });
  $("list").hidden = false;
}
$("listBtn").onclick = openList; $("menuList").onclick = openList;

// ---------------------------------------------------------------- 設定・出典
function credits() {
  const lic = {}; for (const r of rooms) for (const k of r.kei) for (const w of k.works) if (w.f) lic[w.lic] = (lic[w.lic] || 0) + 1;
  const snd = new Map(); for (const r of rooms) { for (const k of r.kei) if (k.snd) snd.set(k.snd.f, k.snd); for (const s of r.snd) snd.set(s.f, s); }
  const amb = [["入口の広間", M.amb.lobby], [NAMES.library, M.amb.library], ...rooms.map(r => [r.name, r.amb])].filter(x => x[1]);
  const ambHTML = amb.map(([where, a]) => a.kind === "bgm"
    ? (a.page ? `<li>${esc(where)}：音楽「${esc(a.title)}」${esc(a.who)}・${licHTML(a.lic, a.licurl)}・<a href="${esc(a.page)}" target="_blank" rel="noopener">元のファイル</a>（改変＝モノラル化・音量・ループ）</li>`
              : `<li>${esc(where)}：音楽「${esc(a.title)}」${esc(a.who)}・${esc(a.lic)}</li>`)
    : `<li>${esc(where)}：録音「${esc(a.label)}」${esc(a.who)}・${esc(a.where)}・${licHTML(a.lic, a.licurl)}・<a href="${esc(a.page)}" target="_blank" rel="noopener">元のファイル</a></li>`).join("");
  return `<p>つくり：<a href="https://mitsulab.jp" target="_blank" rel="noopener">mitsulab（mitsulab.jp）</a>。お問い合わせは official@mitsulab.jp へ。</p><p>学校の授業で、教室の画面に映して使ってかまいません（作品の権利の表示は、作品の札のとおり）。めやすは、広間だけなら 2 分、一部屋なら 10 分ほど。</p><p>展示の中身は、mitsulab の連作《森羅百景》のデータです（森羅百景の ${M.count.all_kei} 景のうち、絵と文学のある ${M.count.kei} 景・作品 ${M.count.works} 点〈図版と写真 ${M.count.img}・文学の引用 ${M.count.bun}〉）。
  図版は保護期間の満了した美術作品（各館のオープンアクセス・CC0／パブリックドメイン）と、Wikimedia Commons の CC の写真です。権利の内訳：${Object.entries(lic).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(k)} ${v}`).join("・")}。
  一点ごとの題・作者・所蔵・権利・元のページは、作品の札と、各作品の小さな札に出しています。<b>CC BY-SA の写真と録音は、この画面の中だけで使います。</b></p>
  <h3>企画展「絵から出てくる生きもの」</h3><p>円堂の ${EX.items.length} 点と、部屋の中の絵の ${EX.roomItems.length} 点（碧がその絵の話をしているあいだ、抜け出てきます）は、CC0／パブリックドメインの作品だけから選び、mitsulab が生きものを切り抜いて、元の絵からその部分を消し（まわりの色でふさぐ）、3D の中で動かしています（作り変え）。元の作品の題・作者・所蔵・権利は、絵の下の札と「札をひらく」で。</p>
  <h3>生きものの鳴き声（企画展・さわったとき）</h3><ul>${[...new Set(Object.values(CALLS))].map(c => `<li>${esc(c.label)}：${esc(c.who)}・${licHTML(c.lic, c.licurl)}・<a href="${esc(c.page)}" target="_blank" rel="noopener">元のファイル</a>（改変＝一部を切り出し・音量）</li>`).join("")}</ul>
  <h3>部屋の音と音楽</h3><ul>${ambHTML}</ul>
  <p>景の音（${snd.size} 本）は mitsulab が録ったものではなく、Wikimedia Commons で公開されている他の人の野外録音です。録音者・録音地・権利は景の札に出します。</p>
  <h3>碧の声</h3><p>VOICEVOX:冥鳴ひまり（前もって声にした一文ずつ。話したことばは字幕にそのまま出します）。碧の言葉は、森羅百景の解説・作品の表・録音の台帳からだけ組んだ事実と、新しい事実を入れない雑談でできています。話したことは保存しません（端末に覚えるのは、設定と、最後に立っていた場所だけ）。</p>
  <h3>館のつくり</h3><p>部屋の床：Poly Haven「<a href="https://polyhaven.com/a/herringbone_parquet" target="_blank" rel="noopener">Herringbone Parquet</a>」、玄関と円堂の大理石の磨きのむら：「<a href="https://polyhaven.com/a/marble_01" target="_blank" rel="noopener">Marble 01</a>」、石の壁の凹凸：「<a href="https://polyhaven.com/a/castle_brick_02_white" target="_blank" rel="noopener">Castle Brick 02 White</a>」、絨毯の毛足：「<a href="https://polyhaven.com/a/dirty_carpet" target="_blank" rel="noopener">Dirty Carpet</a>」（どれも CC0。凹凸と磨きだけを借りています）。大理石・石・漆喰・腰板・絨毯の色と文様・天窓・窓の外の景色は、この画面の中でその場で描いています。碧の 3D の姿は © mitsulab（この作品の中で表示するためだけに置いています。持ち出し・再配布はできません）。表示の道具は three.js と three-vrm（MIT）。韓国語の字は Noto Serif KR（SIL Open Font License 1.1）の、使う字だけの写しで出しています。</p>`;
}
$("credAll").innerHTML = credits();
$("menuBtn").onclick = () => { closeAll(); $("menu").hidden = false; };
$("optJoy").checked = store.get("smm-joy", false); $("optRM").checked = RM; $("optBig").checked = store.get("smm-big", false); $("optVoice").checked = store.get("smm-voice", true);
const applyOpts = () => { $("joy").hidden = !$("optJoy").checked || mode !== "walk"; document.body.classList.toggle("big", $("optBig").checked); document.body.classList.toggle("hi", $("optHi").checked); };
$("optJoy").onchange = () => { store.set("smm-joy", $("optJoy").checked); applyOpts(); };
try { new ResizeObserver(() => { $("joy").style.bottom = ($("guide").getBoundingClientRect().height + 24 + 12) + "px"; }).observe($("guide")); } catch {}
$("optRM").onchange = () => { RM = $("optRM").checked; store.set("smm-rm", RM); };
$("optBig").onchange = () => { store.set("smm-big", $("optBig").checked); applyOpts(); };
$("optHi").checked = store.get("smm-hi", false); $("optHi").onchange = () => { store.set("smm-hi", $("optHi").checked); applyOpts(); };
$("optVoice").onchange = () => { store.set("smm-voice", $("optVoice").checked); if (!$("optVoice").checked) skipLine(); };
$("muteBtn").onclick = () => { AUD.init(); AUD.setMute(!AUD.muted); if (AUD.muted && SP.playing) skipLine(); };
AUD.setMute(AUD.muted);
applyOpts();
document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => { $(b.dataset.close).hidden = true; });
document.querySelectorAll(".sheet").forEach(s => s.addEventListener("click", e => { if (e.target === s) s.hidden = true; }));
function anySheet() { return ["map", "list", "menu"].some(id => !$(id).hidden) || !$("zoom").hidden || mode !== "walk"; }
function closeAll() { for (const id of ["map", "list", "menu"]) $(id).hidden = true; $("zoom").hidden = true; closePanel(); }
function fold(on) { if (!on) SP.autoFolded = false; const g = $("guide"); g.classList.toggle("folded", on); on ? (g.setAttribute("role", "button"), g.setAttribute("tabindex", "0"), g.title = "碧のことばをひらく") : (g.removeAttribute("role"), g.removeAttribute("tabindex"), g.title = ""); $("guideFold").textContent = on ? "＋" : "－"; $("guideFold").setAttribute("aria-expanded", String(!on)); }
$("guideFold").onclick = e => { e.stopPropagation(); fold(!$("guide").classList.contains("folded")); };
$("guide").addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && $("guide").classList.contains("folded")) { e.preventDefault(); e.stopPropagation(); fold(false); setActs(curActs()); } });
$("guide").addEventListener("click", () => { if ($("guide").classList.contains("folded")) { fold(false); setActs(curActs()); } });
let toastT = 0; function toast(s) { const t = $("toast"); t.textContent = s; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 1800); }
let lastWhere = "", talkAt = null;   // talkAt＝碧がいま話している景（場所の札はこれを優先・2026-10-08 夜の検証）
function updWhere() {
  if (mode !== "walk") return;
  if (talkAt && !OTO && !$("guide").classList.contains("talking") && !(tour.on && !tour.susp)) talkAt = null;   // 話し終えたら、立つ位置で
  const reg = region(me.pos.x, me.pos.z); let a = NAMES.museum, b = NAMES.hub;
  if (reg.kind === "library") { a = NAMES.library; b = reader.isOpen ? "読んでいる本" : "書架から一冊をえらぶ"; }
  else if (reg.kind === "entrance") { b = reg.u > VEST ? "入口の前" : "玄関"; }
  else if (reg.kind === "room") { const r = rooms[reg.i]; a = r.name; const kk = talkAt && talkAt.i === reg.i ? r.kei[talkAt.j] : r.keiAt(clamp(Math.floor((reg.u - FOY) / BAY), 0, r.rows - 1), reg.v > 0 ? 1 : -1), j = kk ? kk.j : 0; const zn = kk && r.zones?.length > 1 ? r.zones[kk.genre]?.name + "　" : ""; b = reg.u < FOY ? r.desc : `${zn}${r.kei[j]?.no || ""}　${r.kei[j]?.name || ""}`; }
  const s = a + "|" + b; if (s !== lastWhere) { lastWhere = s; $("whereName").textContent = a; $("whereSub").textContent = b; }
}

// ---------------------------------------------------------------- はじめ：玄関の中に立っている（2026-10-07 本人「TOP の選択のページをやめる：開いたらはじめから博物館の中にいる（入口に立っている）形に」）
//   音は、はじめて押した（キーを押した）ときから。押すまで碧は話さない。説明は碧のひとことと、小さな手の絵だけ
// 2026-10-08 本人「始まりの視点も広間の中央に」「ホームボタンを押したら広間の中央に」：円堂のまん中（碧の 2.4 m 手前）に、奥の部屋のほうを向いて立つ
const START = new THREE.Vector3(0, 0, 3.6);
function placeStart() { space = "museum"; me.pos.set(START.x, EYE, START.z); me.yaw = 0; me.pitch = -.03; me.path = []; document.body.classList.remove("inlib"); }
function enterWalk() {
  mode = "walk"; $("boot").classList.add("gone"); setTimeout(() => { $("boot").hidden = true; }, 1000);
  $("top").hidden = false; $("shelfBar").hidden = space !== "library"; applyOpts();
  zone.key = null; setZone(zoneOf(), true); stage.focus({ preventScroll: true });
}
function showHint() {
  if (store.get("smm-hint", false)) return; store.set("smm-hint", true);
  const h = $("hint"); h.hidden = false; h.classList.add("on");
  const off = () => { h.classList.remove("on"); setTimeout(() => { h.hidden = true; }, 600); removeEventListener("pointerdown", off2); };
  const off2 = e => { if (e.target === renderer.domElement) setTimeout(off, 1200); };
  addEventListener("pointerdown", off2); setTimeout(off, 9000);
}
let woke = false;
const OTO_EARLY = new URLSearchParams(location.search).get("mode") === "oto";
function wake() {   // はじめて押したとき：音の仕組みを立て、碧がひとこと
  if (woke || mode !== "walk") return; woke = true;
  AUD.init(); AUD.zone(ambOf(zone.key)); $("guide").hidden = false; aoiJump();
  // 2026-10-07 本人「起動時に碧が登場するのは広間の中央に」：円堂のまん中に、見る人のほうを向いて現れる
  if (vrm) { A.pos.set(0, 0, 1.2); A.goal = new THREE.Vector3(0, 0, 1.2); A.look = null; A.yaw = Math.atan2(me.pos.x, me.pos.z - 1.2); A.calm = 1.6; A.fade = 0; setTimeout(() => { if (A.goal && A.goal.z === 1.2) A.goal = null; }, 9000); }
  if (OTO) { otoGo(0, true); return; }
  const acts = [["案内して", () => introWalk(), true], ["自分で歩く", () => { intro.tok++; freeTalk([T.idle.free]); }], ...(resumeAt && resumeOK ? [["続きから（" + rooms[region(resumeAt[0], resumeAt[1]).i].name + "）", resumeGo]] : [])];
  curActs = () => acts; talk(T.outside, acts);
}
addEventListener("pointerdown", e => { if (OTO_EARLY && e.target.closest?.("#otoBar,#otoRooms")) return; wake(); }, { capture: true });
addEventListener("keydown", e => { if (OTO_EARLY) return; if (!e.target.closest?.("input,textarea,select")) wake(); }, { capture: true });
async function introWalk(toLibrary) {
  const tk = ++intro.tok; if (!woke) wake();
  if (Math.hypot(me.pos.x - START.x, me.pos.z - START.z) > 1) { await goP(START.clone(), new THREE.Vector3(0, 0, -10)); if (tk !== intro.tok) return; }   // はじめから広間のまん中にいる（2026-10-08）
  if (toLibrary) { goWarp(); return; }
  const acts = [["部屋をえらぶ", openMap, true], [`${NAMES.library}へ`, goWarp], ["順に案内して", () => runTour(0)]];
  curActs = () => acts; talk(T.lobby, acts);
}
function goHome() {   // 広間のまん中へもどる（2026-10-08 本人）
  intro.tok++; hush(); stopTour(false); closeAll(); if (reader.isOpen) reader.close();
  if (space === "library") { doWarp(() => teleport(START, new THREE.Vector3(0, 0, -10))); return; }
  teleport(START, new THREE.Vector3(0, 0, -10));
}
$("homeBtn").onclick = goHome;
// 美術館 ⇄ 図書館を、どこからでも（光の輪までは歩かずに。光の輪はそのまま残す）
// 美術館と図書館の行き来のボタンは 2026-10-07 にやめた（図書館は円堂の扉の奥の一室）
const BOOKS_ALL = bookList(rooms);
$("shelfBar").innerHTML = BOOKS_ALL.map((b, i) => `<button data-b="${i}" style="--c:${b.acc}">${esc(b.name)}</button>`).join("");
$("shelfBar").querySelectorAll("button").forEach(b => b.onclick = () => approachBook(+b.dataset.b));
document.querySelectorAll("[data-n]").forEach(el => { const k = el.dataset.n; if (NAMES[k]) el.textContent = NAMES[k]; });
document.title = NAMES.museum;

// ---------------------------------------------------------------- まわす
const clock = new THREE.Clock(); let acc = 0, mapAcc = 0, frames = 0, tt = 0;
function tick() {
  const dt = Math.min(.05, clock.getDelta()); tt += dt;
  if (mode === "walk") { moveTick(dt); }
  else { me.yaw = Math.sin(tt * .12) * .12; camera.position.copy(me.pos); camera.rotation.set(me.pitch, me.yaw, 0, "YXZ"); }
  aoiTick(dt); atmoTick(dt); partTick(dt, tt);
  const T_ = RM ? 0 : tt; for (const m of winMats) m.uniforms.uT.value = T_; warpMat.uniforms.uT.value = T_;
  for (const w of warps) w.ring.rotation.z = T_ * .3;
  const open = false;   // 玄関の扉は閉じたまま（外へは出ない）
  for (const d of ctxDoors) { const want = -ENT.th + (open ? d.sgn * 1.35 : 0); d.pivot.rotation.y += (want - d.pivot.rotation.y) * Math.min(1, dt * 2.2); }
  LIBW.tick(dt, tt, -1);
  if (marker.material.opacity > 0) marker.material.opacity = Math.max(0, marker.material.opacity - dt * .9);
  exploreTick(dt); stepTick(dt); syncListener();
  EX.tick(dt, tt, mode === "walk" && space === "museum");
  HOLO.tick(dt, me.pos, me.yaw, region, local, aoi?.visible ? A.pos : null, tt);
  acc += dt; if (acc > .3) { acc = 0;
    const nsp = region(me.pos.x, me.pos.z).kind === "library" ? "library" : "museum";
    if (nsp !== space) { space = nsp; document.body.classList.toggle("inlib", space === "library"); $("shelfBar").hidden = space !== "library";
      if (space === "library" && mode === "walk" && woke && !reader.isOpen && !(tour.on && !tour.susp)) talk(T.library, libActs()); }
    streamBays(); updWhere(); setZone(zoneOf()); if (mode === "walk" && !me.path.length && space === "museum" && region(me.pos.x, me.pos.z).kind === "room") store.set("smm-at", [+me.pos.x.toFixed(2), +me.pos.z.toFixed(2), +me.yaw.toFixed(3)]); }
  if (mode === "walk") { mapAcc += dt; if (mapAcc > .2) { mapAcc = 0; drawMini(); } }
  if (!document.hidden && ($("reader").hidden || (frames++ % 4 === 0))) { renderer.render(scene, camera); frames++; }   // 本をひらいているあいだも、うしろの部屋は描く（間引いて）
  requestAnimationFrame(tick);
}
function prog(p) { $("prog").querySelector("i").style.width = Math.round(p) + "%"; }

placeStart(); resize(); camera.position.copy(me.pos); camera.rotation.set(me.pitch, me.yaw, 0, "YXZ"); setZone(zoneOf(), true); streamBays();

prog(20);
const warm = Promise.all([new Promise(r => setTimeout(r, 50)), loadAoi()]);
renderer.compileAsync?.(scene, camera).catch(() => {});
requestAnimationFrame(tick);
const resumeAt = store.get("smm-at", null);
const resumeOK = !!resumeAt && (() => { space = "museum"; return walkable(resumeAt[0], resumeAt[1]) && region(resumeAt[0], resumeAt[1]).kind === "room"; })();
function resumeGo() { intro.tok++; space = "museum"; teleport(new THREE.Vector3(resumeAt[0], 0, resumeAt[1]), null, () => { me.yaw = resumeAt[2]; freeTalk([T.idle.hello]); }); }
warm.then(() => { prog(100); enterWalk(); showHint(); });

// ---------------------------------------------------------------- 音で巡る館（?mode=oto）。2026-10-07 本人「目が見えない友人がいます。文字が見えにくいでなく、音で感じるという世界なので、
//   url を切り替えて、目の見えにくい方向けのリンクを作れば初期設定から設定できる」。画面を見なくても完結する：碧の声が主・空間の音・大きなボタン四つとキーボード
const OTO = new URLSearchParams(location.search).get("mode") === "oto";
const otoStops = (() => {
  const S = [{ t: "entry" }, { t: "lobby" }, { t: "exh0" }];
  for (const it of EX.items) S.push({ t: "exh", it });
  rooms.forEach((r, i) => { S.push({ t: "room", i }); r.kei.forEach((k, j) => S.push({ t: "kei", i, j })); });
  S.push({ t: "lib" }); bookList(rooms).forEach((b, bi) => S.push({ t: "book", bi })); S.push({ t: "end" });
  return S;
})();
const oto = { at: -1, tok: 0 };
function otoPlace(st) {   // その場所の立ち位置と、見る向き
  if (st.t === "entry") return [START, new THREE.Vector3(0, 0, 0)];
  if (st.t === "lobby" || st.t === "exh0") return [new THREE.Vector3(0, 0, R - 4.6), new THREE.Vector3(0, 0, 0)];
  if (st.t === "exh") { const n = new THREE.Vector3(0, 0, 1).applyQuaternion(st.it.g.quaternion), lk = st.it.g.position.clone().setY(0); return [lk.clone().addScaledVector(n, 2.9), lk]; }
  if (st.t === "room") return [W(st.i, 1.6, 0), W(st.i, 12, 0)];
  if (st.t === "kei") { const k = rooms[st.i].kei[st.j]; return [standFor(k.bay, k.bay.slots[0]).v, k.bay.center.clone()]; }
  if (st.t === "lib" || st.t === "book") return [LIB_IN(), LIB_IN_LOOK()];
  return [START, new THREE.Vector3(0, 0, 0)];
}
function otoLines(st) {
  const O = T.oto || {};
  if (st.t === "entry") return [O.hello, T.outside[0], O.keys];
  if (st.t === "lobby") return T.lobby;
  if (st.t === "exh0") return [O.exh];
  if (st.t === "exh") { const L = (T.anim || {})[st.it.a.id] || {}; return [L.work, L.come]; }
  if (st.t === "room") return T.rooms[st.i].intro;
  if (st.t === "kei") { const K = T.rooms[st.i].kei[st.j], k = rooms[st.i].kei[st.j], z = rooms[st.i].zones?.[k.genre], first = rooms[st.i].kei.find(x => x.genre === k.genre) === k;
    // 部屋の奥へ向いて、右の壁か左の壁か（2026-10-07 本人「館の構造を音と言葉で伝える」）。区画のはじめでは区画の名も
    const zsd = z && rooms[st.i].zones.length > 1 ? T.rooms[st.i].zone_side?.[z.name] : null, R_ = k.side > 0;
    // 区画の名と壁の向きを一文に（2026-10-08 検証）。区画のはじめ＝「田畑の区画、右の壁です。」、あとは「右の壁です。」
    const head = zsd && first ? (st.j === 0 ? (R_ ? zsd.r1 : zsd.l1) : (R_ ? zsd.r : zsd.l)) : (st.j === 0 ? (R_ ? O.right1 : O.left1) : (R_ ? O.right : O.left));
    return [head, ...K.lines, K.side].filter(Boolean); }
  if (st.t === "lib") return [O.lib, ...T.library.slice(0, 1)];
  if (st.t === "book") return [];
  return [O.end];
}
function otoGo(n, quick) {
  if (reader.isOpen && otoStops[oto.at]?.t !== "book") reader.close();
  oto.at = (n + otoStops.length) % otoStops.length; const st = otoStops[oto.at], tk = ++oto.tok; talkAt = st.t === "kei" ? { i: st.i, j: st.j } : null;
  hush(); closeAll(); if (tour.on) stopTour(false);
  const [p, look] = otoPlace(st);
  const arrive = () => {
    if (tk !== oto.tok) return;
    if (st.t === "book") { if (reader.isOpen) reader.close(); reader.open(st.bi); return; }   // 本は、ひらくと碧が見開きを読む
    const rel = st.t === "exh" ? bindCreatures([st.it]) : st.t === "kei" ? bindCreatures(roomCreatures(rooms[st.i].slug, rooms[st.i].kei[st.j].id)) : () => {};
    talk(otoLines(st).filter(Boolean), otoActs()).then(ok => { rel(); if (ok && tk === oto.tok && st.t === "kei") otoKeiSound(st); });
  };
  const far = Math.hypot(p.x - me.pos.x, p.z - me.pos.z) > 12;
  if (!quick && !far) talk([T.move[oto.at % T.move.length]], otoActs());   // 歩くあいだ（足音）は「こちらです」
  // 2026-10-08 11 人の検証：歩くあいだに次へを押すと、移動の一言だけが続いて作品の話にたどり着かなかった
  //   → 歩いている途中の「次へ」は、歩きを飛ばしてその景の話からはじめる（otoNext）
  const arr = () => { if (oto.pending?.tk === tk) oto.pending = null; arrive(); };
  oto.pending = quick || far ? null : { tk, p, look, arr };
  if (quick || far) teleport(p, look, arrive); else goTo(p, look, arr);
}
function otoKeiSound(st) {   // 景の音（借りた録音）を、その景の前で少しだけ（近づいた音として）
  const k = rooms[st.i].kei[st.j]; if (!k.snd?.f || !AUD.ctx) return;
  const a = new Audio(k.snd.f); a.volume = 0; a.play().catch(() => {}); let v = 0;
  const up = setInterval(() => { v = Math.min(.6, v + .05); a.volume = v; }, 120);
  setTimeout(() => { clearInterval(up); const dn = setInterval(() => { v = Math.max(0, v - .05); a.volume = v; if (v <= 0) { clearInterval(dn); a.pause(); } }, 120); }, 7000);
}
function otoMore() {   // くわしく：いまの所の、本の見開き（景のはなし・ほかの作品の解説）を読む
  const st = otoStops[oto.at]; if (!st) return;
  if (st.t === "kei") { const r = rooms[st.i], k = r.kei[st.j], sp = (M.pages[r.slug] || []).filter(x => x.R.k === k.id && x.R.t !== "kei"); talk(sp.flatMap(x => x.L.t === "type" ? x.say.slice(1) : x.say), otoActs()); return; }
  if (st.t === "room") { talk([T.rooms[st.i].zones || T.rooms[st.i].intro[0]], otoActs()); return; }
  if (st.t === "exh") { const { k, w } = animWork(st.it.a); if (w?.note) talk(SCsent(w.note), otoActs()); return; }
  talk(otoLines(st).filter(Boolean), otoActs());
}
const SCsent = t => (t.match(/[^。！？]+[。！？]?/g) || []).map(x => x.trim()).filter(Boolean);
function otoWhere() { const st = otoStops[oto.at]; if (!st) return; const w = st.t === "kei" ? T.rooms[st.i].kei[st.j].where : st.t === "exh" ? (T.anim || {})[st.it.a.id]?.where : null; talk([w || otoLines(st).filter(Boolean)[0]], otoActs()); }   // 部屋・区画・景の名まで（2026-10-08 検証）
function otoRooms() {
  const el = $("otoRooms"); el.innerHTML = `<h2>部屋をえらぶ</h2>` + rooms.map((r, i) => `<button data-r="${i}">${i + 1}　${esc(r.name)}<small>${esc(r.desc)}</small></button>`).join("") + `<button data-r="lib">${esc(NAMES.library)}<small>本を見開きで読む</small></button><button data-r="x">閉じる</button>`;
  el.hidden = false; el.querySelector("button").focus();
  el.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { el.hidden = true; const v = b.dataset.r; if (v === "x") return; otoGo(otoStops.findIndex(s => v === "lib" ? s.t === "lib" : s.t === "room" && s.i === +v), true); });
  talk([T.oto?.rooms].filter(Boolean), otoActs());
}
function otoActs() { return []; }
function otoNext() { const q = oto.pending; if (q && q.tk === oto.tok) { oto.pending = null; me.onArrive = null; me.path = []; hush(); teleport(q.p, q.look, q.arr); return; } const st = otoStops[oto.at]; if (st?.t === "book" && reader.isOpen && reader.state.s < reader.state.sp.length - 1) { reader.turn(1); return; } otoGo(oto.at + 1); }
function otoBack() { const st = otoStops[oto.at]; if (st?.t === "book" && reader.isOpen && reader.state.s > 0) { reader.turn(-1); return; } otoGo(oto.at - 1); }
// 足音（2026-10-07 本人「歩くときの足音がコツコツと響く（床の材質に合った靴音と、広間の残響）」）：その場で作る短い音。
//   円堂・玄関＝大理石と石（高めの硬い音・長い残響）、部屋＝寄木（低めの柔らかい音・短い残響）、書架の間＝絨毯と木（こもった音）
let stepT = 0, stepPh = 0;
const STEP = { rev: null, wet: null, irKey: "" };
function stepIR(sec, decay) {
  const c = AUD.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let k = 0; k < n; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / n, decay); }
  return b;
}
function stepTick(dt) {
  const moving = me.path.length || keys.size || joy.on;
  if (!AUD.ctx || AUD.muted || !moving || mode !== "walk") { stepT = Math.min(stepT, .12); return; }
  stepT -= dt; if (stepT > 0) return; stepT = .5;
  const c = AUD.ctx, reg = region(me.pos.x, me.pos.z), mat = reg.kind === "room" ? "wood" : reg.kind === "library" ? "rug" : "stone";
  const P = { stone: { f: 2600, q: 6, g: .2, lp: 6000, ir: [2.6, 3.2], wet: .32 }, wood: { f: 1100, q: 3, g: .22, lp: 2800, ir: [1.1, 4], wet: .16 }, rug: { f: 600, q: 1.5, g: .16, lp: 1400, ir: [.7, 5], wet: .08 } }[mat];
  if (!STEP.rev) { STEP.rev = c.createConvolver(); STEP.wet = c.createGain(); STEP.rev.connect(STEP.wet); STEP.wet.connect(AUD.master); }
  if (STEP.irKey !== mat) { STEP.irKey = mat; STEP.rev.buffer = stepIR(...P.ir); }
  STEP.wet.gain.value = P.wet;
  // かかと（硬い短い音）とつま先（少し弱い音）を少しずらして
  stepPh ^= 1;
  for (const [delay, amp] of [[0, 1], [.045, .45]]) {
    const len = .06, n = c.createBufferSource(), b = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate), d = b.getChannelData(0);
    for (let k = 0; k < d.length; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / d.length, 6);
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = P.f * (stepPh ? 1 : .92); bp.Q.value = P.q;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = P.lp;
    const g = c.createGain(); g.gain.value = P.g * amp * (OTO ? 1.2 : .8);
    n.buffer = b; n.connect(bp); bp.connect(lp); lp.connect(g); g.connect(AUD.master); g.connect(STEP.rev); n.start(c.currentTime + delay);
  }
}
if (OTO) {
  document.body.classList.add("oto"); document.title = `${NAMES.mode_oto || "音で巡る館"}　${NAMES.museum}`;
  const bar = $("otoBar"); bar.hidden = false;
  const first = () => { if (woke) return false; wake(); return true; };   // はじめの一押しは、入口の案内
  $("otoNext").onclick = () => first() || otoNext(); $("otoBack").onclick = () => first() || otoBack();
  $("otoRoomsBtn").onclick = () => first() || otoRooms(); $("otoMore").onclick = () => first() || otoMore(); $("otoWhereBtn").onclick = () => first() || otoWhere();
  addEventListener("keydown", e => {
    if (e.target.closest?.("input,textarea,select")) return;
    const k = e.key.toLowerCase(), map = { arrowright: otoNext, arrowleft: otoBack, r: otoRooms, d: otoMore, w: otoWhere };
    if (map[k]) { e.preventDefault(); e.stopImmediatePropagation(); if (!first()) map[k](); }
  }, { capture: true });
}

// 確かめ用（Playwright）
window.__mu = { featBay, rooms, bays, me, A, tour, SP, AUD, T, zone, NAMES, LIBW, reader, intro, get space() { return space; }, get vrm() { return vrm; }, get frames() { return frames; }, get mode() { return mode; }, renderer, camera, scene,
  HOLO, holoAct, showZones, runTour, tourNextKei, enterRoom, openPanel, openMap, openList, approach, approachBook, region, walkable, pick, goTo, streamBays, goWarp, doWarp, goHome, introWalk, wake, E, VEST, get EX() { return EX; },
  info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, tex: renderer.info.memory.textures, geo: renderer.info.memory.geometries }) };
