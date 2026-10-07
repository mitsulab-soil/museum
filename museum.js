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
let space = "museum";          // museum（美術館と入口の外）／library（地下の図書館）。同じ一つの 3D の世界

// ---------------------------------------------------------------- 館の寸法
//   2026-10-07 本人「入口から３dで制作してください。同じ３dモデルで中央にワープするところがあって、はじめは博物館に入って、ワープすると図書館に移動する」
//   広間（hub）は十一角の円堂。正面（+z）が玄関、その両わきは壁、残りの八面から八つの部屋がのびる。まん中にワープ（光の輪）。図書館はその真下（y＝LIB.Y）
const NF = 11, HA = Math.PI / NF;
const R = 19, WALL_H = 6.2, LOBBY_H = 9, HALF = 5, BAY = 6.6, FOY = 4, DOOR = 3.0, FIN = 1.0, EYE = 1.6;
const SPRING = 2.9;
const VEST = 7, PORT = VEST + 5.5, STEPS = PORT + 2.4, PLAZA = STEPS + 34, PLAZA_Y = -1.2;
const faceTh = k => Math.PI + k * 2 * HA;
const mkFace = th => { const d = new THREE.Vector2(Math.sin(th), -Math.cos(th)); return { th, d, p: new THREE.Vector2(-d.y, d.x) }; };
const ENT = mkFace(faceTh(0));
const rooms = M.rooms.map((r, i) => {
  const f = mkFace(faceTh(i + 2));
  const rows = Math.ceil(r.kei.length / 2), L = FOY + rows * BAY + 3;
  r.kei.forEach((k, j) => { k.room = i; k.j = j; k.side = j % 2 ? 1 : -1; k.u = FOY + Math.floor(j / 2) * BAY + BAY / 2; });
  const n = r.kei.reduce((a, k) => a + k.works.length, 0);
  return Object.assign(r, f, { i, rows, L, n });
});
const FACES = [ENT, mkFace(faceTh(1)), ...rooms, mkFace(faceTh(NF - 1))];
const STELE = { x: 0, z: 9.5, w: 2.9, d: .34, r: 1.9 };
const WARP = { x: 0, z: 0, r: .8, keep: 1.7 };
const inStele = (x, z, m = .4) => Math.abs(x - STELE.x) < STELE.w / 2 + m && Math.abs(z - STELE.z) < STELE.d / 2 + m;
const RR = R / Math.cos(HA);
const COLS = Array.from({ length: NF }, (_, k) => { const a = faceTh(k) + HA; return new THREE.Vector2(Math.sin(a) * (RR - 1.0), -Math.cos(a) * (RR - 1.0)); });
const WF = (f, u, v) => new THREE.Vector3(f.d.x * (R + u) + f.p.x * v, 0, f.d.y * (R + u) + f.p.y * v);
const W = (i, u, v) => WF(rooms[i], u, v);
const E = (u, v = 0) => WF(ENT, u, v);
const entLocal = (x, z) => ({ u: x * ENT.d.x + z * ENT.d.y - R, v: x * ENT.p.x + z * ENT.p.y });
const PCOLS = [2.8, 7.6, 12.4].flatMap(v => [v, -v]);
function local(x, z) {
  if (space === "library") return null;
  let best = null;
  for (const r of rooms) { const a = x * r.d.x + z * r.d.y - R, b = x * r.p.x + z * r.p.y; if (a > -2.5 && Math.abs(b) < HALF + .5 && (!best || a > best.u)) best = { i: r.i, u: a, v: b }; }
  return best;
}
function region(x, z) {
  if (space === "library") return { kind: "library" };
  const e = entLocal(x, z); if (e.u > -.35 && Math.abs(e.v) < 40) return { kind: "entrance", u: e.u, v: e.v };
  const l = local(x, z);
  if (l && l.u > -0.35) return { kind: "room", ...l };
  return { kind: "lobby", l };
}
function groundY(x, z) {
  if (space === "library") return LIB.Y;
  const e = entLocal(x, z);
  if (e.u <= PORT) return 0;
  return e.u >= STEPS ? PLAZA_Y : PLAZA_Y * (e.u - PORT) / (STEPS - PORT);
}
function walkable(x, z, wallGap = 1.6) {
  if (space === "library") return libWalkable(x, z) && Math.hypot(x - WARP.x, z - WARP.z) > (walkable.warpOK ? 0 : .5);
  const e = entLocal(x, z);
  if (e.u > -.6) {                                                       // 玄関の間・扉・柱廊・階段・前庭
    if (e.u < VEST - .3) return Math.abs(e.v) < DOOR - .55;
    if (e.u < VEST + 1.1) return Math.abs(e.v) < 1.5;
    if (e.u < PORT) return Math.abs(e.v) < 14.5 && PCOLS.every(v => Math.hypot(e.u - (VEST + 4.2), e.v - v) > 1.0);
    return e.u < PLAZA && Math.abs(e.v) < (e.u < STEPS ? 14.5 : 22);
  }
  let inLobby = true; for (const f of FACES) if (x * f.d.x + z * f.d.y > R - 1.0) inLobby = false;
  if (inLobby) return !inStele(x, z) && COLS.every(c => Math.hypot(x - c.x, z - c.y) > 1.05);
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
const stage = $("stage");
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
const stoneMat = new THREE.MeshStandardMaterial({ map: T_STONE, roughness: .85, envMapIntensity: .4 });
const marbleMat = new THREE.MeshStandardMaterial({ map: T_MARBLE, roughness: .28, metalness: 0, envMapIntensity: .9 });
const lobbyFloorMat = new THREE.MeshStandardMaterial({ map: TX.lobbyFloor(), roughness: .22, envMapIntensity: .9 });
const woodMat = new THREE.MeshStandardMaterial({ map: T_WOOD, color: 0xd8c0a8, roughness: .55, envMapIntensity: .55 });
const darkWood = new THREE.MeshStandardMaterial({ color: 0x3a2516, roughness: .5, envMapIntensity: .5 });
const brassMat = new THREE.MeshStandardMaterial({ color: 0xc19a4b, metalness: .9, roughness: .3, envMapIntensity: 1.2 });
const giltMat = new THREE.MeshStandardMaterial({ color: 0xb08a3e, metalness: .85, roughness: .32, envMapIntensity: 1.1 });
const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a1d12, roughness: .5, metalness: .1 });
const sootMat = new THREE.MeshBasicMaterial({ map: T_SOOT, transparent: true, depthWrite: false });
const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff1c8, toneMapped: false });
const domeMat = new THREE.MeshStandardMaterial({ map: TX.coffers(), side: THREE.BackSide, roughness: .9, envMapIntensity: .3 });
const oculusMat = new THREE.MeshBasicMaterial({ color: 0xfff6e2, toneMapped: false });
function runnerMat(cols) { const t = TX.runner(cols[0], cols[1]); return new THREE.MeshStandardMaterial({ map: t, roughness: .95, envMapIntensity: .2 }); }
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
const MINCHO = '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif', GOTH = '"Hiragino Sans","Yu Gothic","Noto Sans JP",sans-serif';
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
    const room = rooms.includes(F) ? F : null, open = room || F === ENT;
    const s = new THREE.Shape(); s.moveTo(-face / 2 - .3, 0); s.lineTo(face / 2 + .3, 0); s.lineTo(face / 2 + .3, LOBBY_H); s.lineTo(-face / 2 - .3, LOBBY_H); s.closePath();
    if (open) { const hole = new THREE.Path(); hole.moveTo(-DOOR, 0); hole.lineTo(DOOR, 0); hole.lineTo(DOOR, SPRING); hole.absarc(0, SPRING, DOOR, 0, Math.PI, false); hole.lineTo(-DOOR, 0); s.holes.push(hole); }
    const eg = new THREE.ExtrudeGeometry(s, { depth: .5, bevelEnabled: false, curveSegments: 20 });
    const ua = eg.attributes.uv; for (let q = 0; q < ua.count; q++) ua.setXY(q, ua.getX(q) / 2.2, ua.getY(q) / 2.2);
    putF("stone", stoneMat, eg, F, 0, 0, 0, -F.th);
    for (const sx of [-1, 1]) putF("stone2", marbleMat, new THREE.BoxGeometry((face - 2 * DOOR) / 2 - .3, .9, .1), F, -.53, sx * (DOOR + (face - 2 * DOOR) / 4 + .15), .45, -F.th);
    if (open) {
      putF("stone2", marbleMat, new THREE.TorusGeometry(DOOR + .08, .13, 8, 28, Math.PI), F, -.52, 0, SPRING, -F.th);
      for (const sx of [-1, 1]) putF("stone2", marbleMat, new THREE.BoxGeometry(.32, SPRING, .14), F, -.52, sx * (DOOR + .08), SPRING / 2, -F.th);
      putF("stone2", marbleMat, new THREE.BoxGeometry(.5, .7, .24), F, -.55, 0, SPRING + DOOR + .05, -F.th);
    }
    // 扉の上の題字（石に刻んだ）。部屋の名／玄関は館の名／壁の面は館の名と英語
    const title = room ? room.name : NAMES.museum, sub = room ? room.desc : F === ENT ? "出口 ・ 玄関へ" : NAMES.museum_en;
    const t = textPlane(4.8, .95, (c, w, h) => {
      c.fillStyle = "rgba(60,44,26,.12)"; c.fillRect(0, 0, w, h);
      c.strokeStyle = "rgba(120,92,52,.65)"; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
      c.fillStyle = "#3a2a18"; fit(c, title, w * .8, `600 %px ${MINCHO}`, 104); c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(title, w / 2, h * .44);
      c.fillStyle = "#6b5332"; fit(c, sub, w * .86, `%px ${GOTH}`, 32); c.fillText(sub, w / 2, h * .82);
      if (room) { c.fillStyle = room.acc; c.fillRect(w / 2 - 60, h - 20, 120, 6); }
    }, 1024);
    const p = WF(F, -.53, 0); t.position.set(p.x, open ? 6.7 : 4.2, p.z); t.rotation.y = -F.th; world.add(t);
    putF("brass", brassMat, new THREE.BoxGeometry(2.2, .06, .05), F, -.54, 0, open ? 7.25 : 4.8, -F.th);
    putF("wood", darkWood, new THREE.BoxGeometry(face + .8, .5, .7), F, -.7, 0, LOBBY_H - .25, -F.th);
  });
  for (const c of COLS) {
    put("marble", marbleMat, new THREE.CylinderGeometry(.48, .56, LOBBY_H - 1.3, 20), new THREE.Vector3(c.x, (LOBBY_H - 1.3) / 2 + .55, c.y));
    put("stone2", marbleMat, new THREE.BoxGeometry(1.35, .55, 1.35), new THREE.Vector3(c.x, .275, c.y));
    put("stone2", marbleMat, new THREE.BoxGeometry(1.25, .45, 1.25), new THREE.Vector3(c.x, LOBBY_H - .5, c.y));
  }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(RR, 44, 14, 0, Math.PI * 2, 0, Math.PI / 2 * .94), domeMat); dome.scale.y = .42; dome.position.y = LOBBY_H; world.add(dome); ceils.push(dome);
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
makeWarp(0, `${NAMES.library}へ ─ 光の輪をふむ`);
makeWarp(LIB.Y, `${NAMES.museum}へ ─ 光の輪をふむ`);

// 入口の外：玄関の間・正面（柱廊・破風・扉）・階段・前庭・街灯・木・空
{
  const vf = new THREE.MeshStandardMaterial({ map: TX.lobbyFloor(), roughness: .25, envMapIntensity: .8 });
  const fl = new THREE.Mesh(planeUV(2 * DOOR + .6, VEST + .4, 2.4), vf); fl.rotation.x = -Math.PI / 2; const c = E(VEST / 2); fl.position.set(c.x, .002, c.z); fl.rotation.z = -ENT.th; world.add(fl); floors.push(fl);
  for (const s of [-1, 1]) putF("stone", stoneMat, boxUV(VEST, 6.6, .4, 2.2), ENT, VEST / 2, s * (DOOR + .4), 3.3, Math.PI / 2 - ENT.th);
  { const p = E(VEST / 2); p.y = 6.6; put("ceilv", darkWood, new THREE.PlaneGeometry(2 * DOOR + .8, VEST), p, -ENT.th, Math.PI / 2); }
  for (let u = .6; u < VEST; u += 1.4) putF("wood", darkWood, new THREE.BoxGeometry(2 * DOOR + .8, .3, .22), ENT, u, 0, 6.45, -ENT.th);
  // 正面の壁（扉の穴）
  const FW = 18, FH = 15;
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
  // 柱廊の床（基壇）・階段・前庭
  { const p = E((VEST + .8 + PORT) / 2); p.y = -.6; put("stone", stoneMat, boxUV(36, 1.2, PORT - VEST - .8, 2.2), p, -ENT.th); }
  for (let k = 0; k < 4; k++) { const u0 = PORT + k * .6, p = E(u0 + .3); p.y = -.3 * (k + 1) - .3; put("stone2", marbleMat, new THREE.BoxGeometry(31, .6, .6), p, -ENT.th); }
  for (const v of PCOLS) {
    const p = E(VEST + 4.2, v);
    put("marble", marbleMat, new THREE.CylinderGeometry(.55, .62, 10.4, 20), new THREE.Vector3(p.x, 5.2 + .3, p.z));
    put("stone2", marbleMat, new THREE.BoxGeometry(1.5, .4, 1.5), new THREE.Vector3(p.x, .2, p.z));
    put("stone2", marbleMat, new THREE.BoxGeometry(1.45, .5, 1.45), new THREE.Vector3(p.x, 10.7, p.z));
  }
  { const p = E((VEST + .8 + PORT) / 2 + .3); p.y = 11.6; put("stone", stoneMat, boxUV(31.5, 1.4, PORT - VEST + .2, 2.2), p, -ENT.th); }
  const tri = new THREE.Shape(); tri.moveTo(-16, 0); tri.lineTo(16, 0); tri.lineTo(0, 3.6); tri.closePath();
  const tg = new THREE.ExtrudeGeometry(tri, { depth: 1.2, bevelEnabled: false }); const tu = tg.attributes.uv; for (let q = 0; q < tu.count; q++) tu.setXY(q, tu.getX(q) / 2.2, tu.getY(q) / 2.2);
  { const p = E(PORT - .6); p.y = 12.3; put("stone", stoneMat, tg, p, Math.PI - ENT.th); }
  const ins = textPlane(16, 1.1, (c, w, h) => { c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#4a3820"; fit(c, NAMES.museum, w * .5, `600 %px ${MINCHO}`, Math.round(h * .62)); c.fillText(NAMES.museum, w * .5, h * .42); c.fillStyle = "#6b5332"; fit(c, `${NAMES.museum_en.toUpperCase()}　・　${NAMES.library}　${NAMES.library_en.toUpperCase()}`, w * .9, `%px ${GOTH}`, Math.round(h * .2)); c.fillText(`${NAMES.museum_en.toUpperCase()}　・　${NAMES.library}　${NAMES.library_en.toUpperCase()}`, w * .5, h * .86); }, 2048);
  { const p = E(PORT + .32); ins.position.set(p.x, 11.6, p.z); ins.rotation.y = Math.PI - ENT.th; world.add(ins); }
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
}
flush();

// 入口の一枚：木の衝立に、いきもの百景「蛙」のモチェの蛙の壺（シカゴ美術館・CC0）を掛ける
const FEAT = (() => {
  for (const r of rooms) for (const k of r.kei) if (k.id === "kaeru") { const w = k.works.find(x => fname(x.f) === "kaeru03.jpg"); if (w) return { r, k, w }; }
  const r = rooms[0], k = r.kei[0]; return { r, k, w: k.works.find(x => x.f) };
})();
const featBay = (() => {
  const { r, k, w } = FEAT;
  const wall = new THREE.Mesh(boxUV(STELE.w, 3.7, STELE.d, 2.4), woodMat); wall.position.set(STELE.x, 1.85, STELE.z); world.add(wall); blockers.push(wall);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(STELE.w + .2, .14, STELE.d + .1), darkWood); cap.position.set(STELE.x, 3.75, STELE.z); world.add(cap);
  const g = new THREE.Group(); g.position.set(STELE.x, 0, STELE.z + STELE.d / 2); world.add(g);
  const sl = { w, x: 0, y: 1.6, mw: 1.75, mh: 1.85, big: true };
  const bay = { k, r, g, slots: [sl], loaded: true, near: true, title: null, center: g.position.clone().setY(0), facing: 0, feat: true };
  const ph = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6), new THREE.MeshBasicMaterial({ color: 0x3a2a1a })); ph.position.set(0, sl.y, .012); g.add(ph); sl.ph = ph;
  ph.userData = { bay, slot: sl }; clickables.push(ph);
  const t = textPlane(2.7, .5, (c, W_, H) => {
    c.textAlign = "center"; c.textBaseline = "alphabetic";
    c.fillStyle = "#e7cf93"; c.font = `${Math.round(H * .24)}px ${GOTH}`; c.fillText("入口の一枚", W_ / 2, H * .3);
    c.fillStyle = "#f6efdf"; fit(c, `${r.name}　${k.no || ""}　${k.name}`, W_ * .94, `600 %px ${MINCHO}`, Math.round(H * .42)); c.fillText(`${r.name}　${k.no || ""}　${k.name}`, W_ / 2, H * .82);
  }, 1024);
  t.position.set(0, 3.2, .015); g.add(t);
  const back = textPlane(2.6, .9, (c, W_, H) => {
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillStyle = "#f6efdf"; c.font = `600 ${Math.round(H * .4)}px ${MINCHO}`; c.fillText("森羅美術館", W_ / 2, H * .38);
    c.fillStyle = "#d8c9a8"; c.font = `${Math.round(H * .15)}px ${GOTH}`; c.fillText("Shinra Museum　・　八つの連作・八つの部屋", W_ / 2, H * .8);
  }, 1024);
  back.rotation.y = Math.PI; back.position.set(STELE.x, 2.2, STELE.z - STELE.d / 2 - .015); world.add(back);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2), poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(STELE.x, .008, STELE.z + 1.2); world.add(pool);
  return bay;
})();

// 図書館（地下・同じ世界）
const LIBW = buildLibrary({ THREE, world, put, flush, mats: { parquet, darkWood, woodMat, brassMat, poolMat, paperEdge: new THREE.MeshStandardMaterial({ color: 0xefe4c8, roughness: .8 }) },
  TX, textPlane, fit, rooms, NAMES, clickables, floors, isTouch, MINCHO, GOTH });

function makeBay(r, k) {
  const s = k.side, wv = s * (HALF - .02);
  const facing = s < 0 ? Math.atan2(r.p.x, r.p.y) : Math.atan2(-r.p.x, -r.p.y);
  const g = new THREE.Group(); world.add(g);
  const base = W(r.i, k.u, wv); g.position.copy(base); g.rotation.y = facing;
  const imgs = k.works.filter(w => w.f), rep = imgs.find(w => fname(w.f) === fname(k.rep)) || imgs[0];
  const others = imgs.filter(w => w !== rep), bun = k.works.find(w => !w.f);
  const slots = [];
  if (rep) slots.push({ w: rep, x: 0, y: 2.1, mw: 2.3, mh: 1.6, big: true });
  if (others[0]) slots.push({ w: others[0], x: -2.15, y: 2.0, mw: 1.05, mh: 1.2 });
  if (bun) slots.push({ w: bun, x: 2.15, y: 2.0, quote: true });
  else if (others[1]) slots.push({ w: others[1], x: 2.15, y: 2.0, mw: 1.05, mh: 1.2 });
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
  const A = ATMO[z.key] || ATMO.lobby; parts.want = A.part || "none";
  if (mode === "walk") AUD.zone(ambOf(z.key));
  if (quiet || first) return;
  if (!RM) { const v = $("veil"); v.classList.remove("go"); void v.offsetWidth; v.style.background = "#" + new THREE.Color(A.fog).getHexString(); v.classList.add("go"); }
  const r = z.i != null ? rooms[z.i] : null;
  const lib_ = z.key === "library", out = z.key === "outside";
  $("rcK").textContent = r ? `第${"一二三四五六七八九十"[z.i] || z.i + 1}室` : lib_ ? NAMES.library_en : NAMES.museum_en;
  $("rcB").textContent = r ? r.name : lib_ ? NAMES.library : out ? NAMES.museum : NAMES.hub; $("rcS").textContent = r ? r.desc : lib_ ? `${NAMES.series}の${rooms.length}冊` : out ? "入口の前" : `${rooms.length}つの部屋と、${NAMES.library}への光の輪`;
  const rc = $("roomCard"); rc.classList.add("on"); clearTimeout(setZone.t); setZone.t = setTimeout(() => rc.classList.remove("on"), 2600);
  if (r && mode === "walk" && !(tour.on && !tour.susp) && !seen.rooms.has(r.i)) {
    seen.rooms.add(r.i); const I = T.rooms[r.i].intro;
    setTimeout(() => { if (zone.i === r.i && !SP.resolve) { freeTalk([I[0], ...I.slice(3)]); talkKind = "greet"; } }, 900);
  }
}
// ---------------------------------------------------------------- 自由に歩いて、気になる作品の前で立ち止まると、碧がその景の話をする（2026-10-07 本人「自由に動いて、気になる作品を碧が解説という設計に」）
const seen = { rooms: new Set(), bays: new Set(), books: new Set() };
let talkKind = "";   // いま話していることの種類（"greet"＝部屋のあいさつ。作品の前で止まったら、あいさつは途中でやめて作品の話へ）
const explore = { still: 0, bay: null };
function exploreTick(dt) {
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
  seen.bays.add(b); explore.bay = b; talkKind = "bay";
  const K = T.rooms[b.r.i].kei[b.k.j], narrow = innerWidth / innerHeight < .8, inv = new THREE.Vector3(me.pos.x, 0, me.pos.z).sub(b.center).applyAxisAngle(new THREE.Vector3(0, 1, 0), -b.facing);
  A.goal = new THREE.Vector3(inv.x < -.8 ? (narrow ? .95 : 2.95) : (narrow ? -.95 : -2.95), 0, narrow ? 1.35 : 1.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), b.facing).add(b.center);
  A.look = b.center.clone();
  curActs = () => [["札をひらく", () => openPanel(b.k, b.slots[0]?.w), true], ["⏭", skipLine, false, "このことばをとばす"], ["部屋をえらぶ", openMap]];
  setActs(curActs()); $("guide").hidden = false; if ($("guide").classList.contains("folded")) fold(false);
  sayQ([...K.lines, K.side], { before: (t, n) => { A.point = n === 1 ? 1 : 0; A.talkT = 0; } }).then(ok => { if (ok) { A.point = 0; curActs = freeActs; setActs(freeActs()); } });
}
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

// ---------------------------------------------------------------- 碧の声と字幕（字幕＝話すことばそのもの）
const SP = { tok: 0, playing: false, paused: false, cur: "", resolve: null, timer: null, t0: 0, rest: 0 };
const voiceOn = () => AUD.ctx && !AUD.muted && $("optVoice").checked;
const est = t => 900 + t.length * 135;
function setTalking(on) { $("guide").classList.toggle("talking", on); }
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
function route(to, toWarp) {
  const a = region(me.pos.x, me.pos.z), b = region(to.x, to.z), pts = [];
  if (space === "museum") {
    const door = (i, u) => W(i, u, 0);
    if (a.kind === "entrance" && b.kind !== "entrance") { if (a.u > VEST - .3) pts.push(E(Math.max(VEST + 1.8, Math.min(a.u, VEST + 1.8)), 0), E(VEST - 1)); pts.push(E(-1.8)); }
    if (a.kind === "room" && !(b.kind === "room" && b.i === a.i)) { pts.push(door(a.i, Math.max(1.2, Math.min(a.u, 1.2))), door(a.i, -1.8)); }
    if (b.kind === "room" && !(a.kind === "room" && a.i === b.i)) { pts.push(door(b.i, -1.8), door(b.i, 1.2)); }
    if (b.kind === "entrance" && a.kind !== "entrance") { pts.push(E(-1.8), E(VEST - 1)); if (b.u > VEST) pts.push(E(VEST + 1.8)); }
    if (b.kind === "room" && Math.abs(b.v) > HALF - FIN - .5) { pts.push(W(b.i, b.u, Math.sign(b.v) * (HALF - FIN - .6))); }
  }
  pts.push(to.clone());
  const out = []; let prev = me.pos;
  for (const q of pts) {
    const w = space === "museum" ? steleCut(prev, q) : null; if (w) { out.push(w); prev = w; }
    const k = toWarp && q === pts.at(-1) ? null : warpCut(prev, q); if (k) out.push(k);
    out.push(q); prev = q;
  }
  return out.map(p => new THREE.Vector3(p.x, EYE, p.z));
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
  me.path = route(p, toWarp); me.faceTo = faceTo; me.onArrive = onArrive;
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
      if (!dragging) me.yaw += wrapA(want - me.yaw) * ease(dt, 3.2);
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
    if (walkable(nx, nz)) { me.pos.x = nx; me.pos.z = nz; } else if (walkable(nx, me.pos.z)) me.pos.x = nx; else if (walkable(me.pos.x, nz)) me.pos.z = nz;
    walkable.warpOK = false;
    if (Math.hypot(me.pos.x - WARP.x, me.pos.z - WARP.z) < WARP.r && !warping) doWarp();
  }
  const gy = EYE + groundY(me.pos.x, me.pos.z); me.pos.y += (gy - me.pos.y) * Math.min(1, dt * 10);
  if (Math.abs(gy - me.pos.y) > 3) me.pos.y = gy;
  camera.position.copy(me.pos);
  camera.rotation.set(me.pitch, me.yaw, 0, "YXZ");
}
function arrive() {
  if (me.faceTo) { me.yaw += wrapA(Math.atan2(-(me.faceTo.x - me.pos.x), -(me.faceTo.z - me.pos.z)) - me.yaw); }
  const f = me.onArrive; me.onArrive = null; f?.();
}

// ---------------------------------------------------------------- 押す・見回す
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let dragging = false, down = null;
const marker = new THREE.Mesh(new THREE.RingGeometry(.22, .3, 40), new THREE.MeshBasicMaterial({ color: 0xe7cf93, transparent: true, opacity: 0 }));
marker.rotation.x = -Math.PI / 2; scene.add(marker);
stage.addEventListener("pointerdown", e => { if (mode !== "walk" || e.target !== renderer.domElement) return; down = { x: e.clientX, y: e.clientY, yaw: me.yaw, pitch: me.pitch, id: e.pointerId }; dragging = false; });
stage.addEventListener("pointermove", e => {
  if (mode !== "walk") return;
  if (!down || e.pointerId !== down.id) { hover(e); return; }
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (!dragging && Math.hypot(dx, dy) > 7) { dragging = true; stage.setPointerCapture?.(e.pointerId); }
  if (dragging) { const k = (isTouch ? 1.6 : 1.2) * camera.fov / 60 / innerHeight * 1.4; me.yaw = down.yaw + dx * k; me.pitch = clamp(down.pitch + dy * k, -.55, .5); }
});
addEventListener("pointerup", e => {
  if (mode !== "walk" || !down || e.pointerId !== down.id) return;
  const wasDrag = dragging; down = null; dragging = false;
  if (!wasDrag) pick(e.clientX, e.clientY);
});
addEventListener("pointercancel", () => { down = null; dragging = false; });
function rayAt(x, y) { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); }
const hoverRing = new THREE.Mesh(new THREE.RingGeometry(.2, .26, 40), new THREE.MeshBasicMaterial({ color: 0xe7cf93, transparent: true, opacity: .4, depthWrite: false }));
hoverRing.rotation.x = -Math.PI / 2; hoverRing.visible = false; scene.add(hoverRing);
function hover(e) {
  if (isTouch) return; rayAt(e.clientX, e.clientY);
  hoverRing.visible = false;
  if (aoi?.visible && ray.intersectObject(aoi, true)[0]) { stage.style.cursor = "pointer"; return; }
  const h = ray.intersectObjects([...clickables, ...floors, ...blockers], false)[0];
  if (!h || h.distance > 40) { stage.style.cursor = ""; return; }
  if (h.object.userData?.bay || h.object.userData?.book != null || h.object.userData?.warp) { stage.style.cursor = "pointer"; return; }
  stage.style.cursor = "";
  if (floors.includes(h.object) && walkable(h.point.x, h.point.z)) { hoverRing.position.set(h.point.x, h.point.y + .012, h.point.z); hoverRing.visible = true; }
}
function pick(x, y) {
  rayAt(x, y);
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
    if (!q || Math.hypot(q.x - c.x, q.z - c.z) < .5) { toast("そこへは行けません"); return; }
    walkTo(q); return;
  }
  if (h.object.userData?.bay) { approach(h.object.userData.bay, h.object.userData.slot); return; }
  if (h.object.userData?.book != null) { approachBook(h.object.userData.book); return; }
  if (h.object.userData?.warp) { goWarp(); return; }
  if (h.distance > 60) return;
  const p = h.point;
  if (!walkable(p.x, p.z)) { const l = local(p.x, p.z); if (l && l.u > 0 && Math.abs(l.v) > 2) { const q = W(l.i, l.u, Math.sign(l.v) * (HALF - 1.65)); if (walkable(q.x, q.z)) { p.x = q.x; p.z = q.z; } } }
  if (!walkable(p.x, p.z)) { toast("そこへは行けません"); return; }
  walkTo(p);
}
function walkTo(p) { if (tour.on && !tour.susp) suspendTour(); intro.tok++; marker.position.set(p.x, groundY(p.x, p.z) + .01, p.z); marker.material.opacity = .9; goTo(p); }
// ---------------------------------------------------------------- ワープ（広間のまん中 ⇄ 図書館のまん中）
const intro = { tok: 0 };
let warping = false;
function goWarp() {
  if (tour.on && !tour.susp) suspendTour();
  goTo(new THREE.Vector3(WARP.x, 0, WARP.z), null, () => { if (!warping) doWarp(); }, true);
}
const LIB_ARRIVE = new THREE.Vector3(0, 0, -1.3), HUB_ARRIVE = new THREE.Vector3(0, 0, -2.4);
function doWarp(then) {
  if (warping) return; warping = true; hush(); closeAll();
  const toLib = space === "museum";
  talk([toLib ? T.warp.to_lib : T.warp.to_mus], []);
  const f = $("fade"); f.style.background = "radial-gradient(circle at 50% 60%, #fff3d0, #c9a45c 40%, #120d08 80%)"; f.classList.add("on");
  setTimeout(() => {
    space = toLib ? "library" : "museum";
    const p = toLib ? LIB_ARRIVE : HUB_ARRIVE;
    me.pos.set(p.x, EYE + groundY(p.x, p.z), p.z); me.yaw = 0; me.pitch = toLib ? -.05 : -.02; me.path = [];
    A.goal = null; A.look = null; A.point = 0; aoiJump(); streamBays(); setZone(zoneOf());
    document.body.classList.toggle("inlib", space === "library"); $("shelfBar").hidden = space !== "library"; spaceBtnUpd();
    setTimeout(() => { f.classList.remove("on"); setTimeout(() => { f.style.background = ""; }, 400); warping = false;
      if (then) then(); else if (space === "library") talk(T.library, libActs()); else freeTalk([T.lobby.at(-1)]); }, 450);
  }, 650);
}
function libActs() { return [["本をえらぶ", () => { $("shelfBar").querySelector("button")?.focus(); toast("下の一覧か、棚の本を押してください"); }, true], [`${NAMES.museum}へもどる`, goWarp]]; }
// 図書館：本を押すと、棚の前まで行って、本がひらく
function approachBook(i) {
  if (space !== "library") return;
  const f = LIBW.featured[i]; hush();
  goTo(f.stand.clone(), f.look.clone(), () => { reader.open(i); if (!seen.books.has(i)) { seen.books.add(i); readAloud(i); } });
}
const reader = createReader({ rooms, T, NAMES, openZoom: w => openZoom(w), readAloud: i => readAloud(i), onClose: () => { document.body.classList.remove("reading-aloud"); hush(); } });
function readAloud(i) {
  document.body.classList.add("reading-aloud"); $("guide").hidden = false;
  const bk = bookList(rooms)[i], line = i < rooms.length ? T.books[i] : (T.books_x || {})[bk.id] || bk.desc;
  talk([line], [["とめる", () => { hush(); document.body.classList.remove("reading-aloud"); }]]).then(ok => { if (ok) setTimeout(() => document.body.classList.remove("reading-aloud"), 1200); });
}
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
    talk(line ? [line, T.idle.twice] : [T.idle.twice], acts);
  });
}

// キーボード
addEventListener("keydown", e => {
  if (e.target.closest?.("input,textarea,select")) return;
  const k = e.key.toLowerCase();
  if (reader.isOpen) { reader.key(e); return; }
  if (mode !== "walk") return;
  if (k === "escape") { closeAll(); return; }
  if (k === "m") { openMap(); return; }
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
function aoiJump() {
  if (!aoi) return;
  const s = followSpot(); A.pos = s.clone(); A.vel.set(0, 0, 0); A.yaw = Math.atan2(me.pos.x - s.x, me.pos.z - s.z); vrm.springBoneManager?.reset?.();
}
function followSpot() {
  const reg = region(me.pos.x, me.pos.z);
  if (reg.kind === "room" && reg.u > FOY - .5) {
    const r = rooms[reg.i], fx0 = -Math.sin(me.yaw), fz0 = -Math.cos(me.yaw), lat = fx0 * r.p.x + fz0 * r.p.y;
    if (Math.abs(lat) > .62) {
      const side = Math.sign(lat), row = clamp(Math.floor((reg.u - FOY) / BAY), 0, r.rows - 1), k = r.kei[row * 2 + (side > 0 ? 1 : 0)];
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
  const goal = A.goal || followSpot();
  if (A.pos.distanceTo(goal) > 14) { A.pos.copy(goal); A.vel.set(0, 0, 0); vrm.springBoneManager?.reset?.(); }
  const w = A.goal ? 4.2 : 3.4, n = Math.max(1, Math.ceil(dt / .02)), h = dt / n, vmax = 2.6;
  for (let i = 0; i < n; i++) {
    A.vel.x += (w * w * (goal.x - A.pos.x) - 2 * w * A.vel.x) * h; A.vel.z += (w * w * (goal.z - A.pos.z) - 2 * w * A.vel.z) * h;
    const m = Math.hypot(A.vel.x, A.vel.z); if (m > vmax) { A.vel.x *= vmax / m; A.vel.z *= vmax / m; }
    const nx = A.pos.x + A.vel.x * h, nz = A.pos.z + A.vel.z * h;
    if (walkable(nx, nz, 1.3) || !walkable(A.pos.x, A.pos.z, 1.3)) { A.pos.x = nx; A.pos.z = nz; } else { A.vel.multiplyScalar(.5); }
  }
  A.sp += (Math.hypot(A.vel.x, A.vel.z) - A.sp) * ease(dt, 5);
  const toCam = Math.atan2(me.pos.x - A.pos.x, me.pos.z - A.pos.z);
  let fy = A.sp > .35 ? Math.atan2(A.vel.x, A.vel.z) : toCam;
  if (A.sp <= .35 && A.look) { const toW = Math.atan2(A.look.x - A.pos.x, A.look.z - A.pos.z); fy = toCam + wrapA(toW - toCam) * .5; }
  A.yaw += clamp(wrapA(fy - A.yaw) * ease(dt, 4), -2.2 * dt, 2.2 * dt);
  aoi.position.set(A.pos.x, groundY(A.pos.x, A.pos.z), A.pos.z); aoi.rotation.y = A.yaw;
  aoi.visible = Math.hypot(A.pos.x - me.pos.x, A.pos.z - me.pos.z) > .9;
  const lookWork = A.look && A.talkT < 2.6;
  if (A.gaze) { if (lookWork) A.gaze.position.set(A.look.x, 1.9 + groundY(A.look.x, A.look.z), A.look.z); else A.gaze.position.copy(camera.position); }
  A.talkT += dt;
  if (A.springs && !RM) { const t = performance.now() / 1000; for (const s of A.springs) { s.j.settings.gravityDir.set(s.g.x + .22 * Math.sin(t * .63 + s.g.y), s.g.y, s.g.z + .14 * Math.sin(t * .41)).normalize(); s.j.settings.gravityPower = Math.max(s.p, .05); } }
  aoiPose(dt, A.sp, wrapA(toCam - A.yaw), lookWork ? wrapA(Math.atan2(A.look.x - A.pos.x, A.look.z - A.pos.z) - A.yaw) : 0);
  // 口：声の大きさに合わせる（声を切っているときは、字幕のあいだ小さく）
  const lv = AUD.level(), talking = $("guide").classList.contains("talking");
  const want = SP.playing ? clamp(lv * 7, 0, 1) : talking && !SP.paused ? .18 + .18 * Math.abs(Math.sin(performance.now() / 90)) : 0;
  A.mouth += (want - A.mouth) * ease(dt, 18); vrm.expressionManager?.setValue("aa", A.mouth * .8);
  vrm.update(dt);
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
  S("leftUpperArm", .26 * s1 * k - .05 * (1 - k), 0, -1.3 + .04 * br * (1 - k));
  S("leftLowerArm", 0, -(.28 + .14 * k + .12 * Math.max(0, -s1) * k), 0);
  S("leftHand", .05, 0, .12);
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
    const K = TR.kei[j];
    const ok = await sayQ([...K.lines, K.side], { before: (t, n) => { A.point = n === 1 ? 1 : 0; A.talkT = 0; } });
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
const MAPR = (() => { let m = R + STEPS; for (const r of rooms) m = Math.max(m, R + r.L); return m + 2; })();
function drawPlan(cv, big) {
  const g = cv.getContext("2d"), S = cv.width, sc = S / 2 / MAPR, cx = S / 2, cy = S / 2;
  g.clearRect(0, 0, S, S);
  const P = (x, z) => [cx + x * sc, cy + z * sc];
  g.fillStyle = "#6b5a44";
  if (space === "library") {   // 図書館の平面（書架・百景の棚・机・光の輪）
    const s2 = S / 2 / (LIB.Z + 2), Q = (x, z) => [cx + x * s2, cy + z * s2];
    g.fillStyle = "#3a2a1a"; g.fillRect(...Q(-LIB.X, -LIB.Z), 2 * LIB.X * s2, 2 * LIB.Z * s2);
    g.fillStyle = "#6b4c2a"; g.fillRect(...Q(-2.6, -5), 5.2 * s2, .9 * s2);
    g.fillStyle = "#c9a45c"; g.beginPath(); g.arc(...Q(WARP.x, WARP.z), 1.3 * s2, 0, 7); g.fill();
    const [mx, my] = Q(me.pos.x, me.pos.z); g.save(); g.translate(mx, my); g.rotate(-me.yaw); g.fillStyle = "#e74c3c"; g.beginPath(); const z = big ? 13 : 9; g.moveTo(0, -z); g.lineTo(z * .7, z * .7); g.lineTo(0, z * .35); g.lineTo(-z * .7, z * .7); g.closePath(); g.fill(); g.restore();
    return;
  }
  g.beginPath(); for (let k = 0; k < NF; k++) { const a = faceTh(k) + HA; const [x, y] = P(Math.sin(a) * RR, -Math.cos(a) * RR); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.fill();
  { const cs = [E(-.2, -DOOR - .4), E(PORT, -DOOR - .4), E(PORT, DOOR + .4), E(-.2, DOOR + .4)]; g.beginPath(); cs.forEach((p, k) => { const [x, y] = P(p.x, p.z); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); }
  g.fillStyle = "#c9a45c"; g.beginPath(); g.arc(...P(WARP.x, WARP.z), Math.max(3, 1.3 * sc), 0, 7); g.fill(); g.fillStyle = "#6b5a44";
  const reg = region(me.pos.x, me.pos.z);
  for (const r of rooms) {
    const cs = [W(r.i, -.2, -HALF), W(r.i, r.L, -HALF), W(r.i, r.L, HALF), W(r.i, -.2, HALF)];
    g.beginPath(); cs.forEach((p, k) => { const [x, y] = P(p.x, p.z); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
    g.fillStyle = r.acc; g.globalAlpha = reg.kind === "room" && reg.i === r.i ? 1 : .6; g.fill(); g.globalAlpha = 1;
    if (big) { const c = W(r.i, r.L * .55, 0), [x, y] = P(c.x, c.z); g.fillStyle = "#1b140c"; g.font = `600 ${Math.round(S * .03)}px ${GOTH}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(r.name, x, y); }
  }
  const [mx, my] = P(me.pos.x, me.pos.z);
  g.save(); g.translate(mx, my); g.rotate(-me.yaw); g.fillStyle = "#e74c3c"; g.beginPath(); const z = big ? 13 : 9; g.moveTo(0, -z); g.lineTo(z * .7, z * .7); g.lineTo(0, z * .35); g.lineTo(-z * .7, z * .7); g.closePath(); g.fill(); g.restore();
  if (aoi && A.pos) { const [ax, ay] = P(A.pos.x, A.pos.z); g.fillStyle = "#4fb3a8"; g.beginPath(); g.arc(ax, ay, big ? 7 : 5, 0, 7); g.fill(); }
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
  const l = local(x, z);
  if (space === "library") { $("map").hidden = true; return; }
  if (l && l.u > -.3 && l.u < rooms[l.i].L) { $("map").hidden = true; enterRoom(l.i, () => freeTalk([T.rooms[l.i].intro[0]])); }
  else if (!l || l.u <= -.3) { $("map").hidden = true; stopTour(false); teleport(new THREE.Vector3(0, 0, 13), new THREE.Vector3(0, 0, -10), () => freeTalk([T.lobby.at(-1)])); }
});
$("mini").onclick = openMap;

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
  const amb = [["入口の広間", M.amb.lobby], ["森羅図書館", M.amb.library], ...rooms.map(r => [r.name, r.amb])].filter(x => x[1]);
  const ambHTML = amb.map(([where, a]) => a.kind === "bgm"
    ? `<li>${esc(where)}：音楽「${esc(a.title)}」${esc(a.who)}・${licHTML(a.lic, a.licurl)}・<a href="${esc(a.page)}" target="_blank" rel="noopener">元のファイル</a>（改変＝モノラル化・音量・ループ）</li>`
    : `<li>${esc(where)}：録音「${esc(a.label)}」${esc(a.who)}・${esc(a.where)}・${licHTML(a.lic, a.licurl)}・<a href="${esc(a.page)}" target="_blank" rel="noopener">元のファイル</a></li>`).join("");
  return `<p>展示の中身は、mitsulab の連作《森羅百景》のデータです（森羅百景の ${M.count.all_kei} 景のうち、絵と文学のある ${M.count.kei} 景・作品 ${M.count.works} 点〈図版と写真 ${M.count.img}・文学の引用 ${M.count.bun}〉）。
  図版は保護期間の満了した美術作品（各館のオープンアクセス・CC0／パブリックドメイン）と、Wikimedia Commons の CC の写真です。権利の内訳：${Object.entries(lic).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(k)} ${v}`).join("・")}。
  一点ごとの題・作者・所蔵・権利・元のページは、作品の札と、各作品の小さな札に出しています。<b>CC BY-SA の写真と録音は、この画面の中だけで使います。</b></p>
  <h3>部屋の音と音楽</h3><ul>${ambHTML}</ul>
  <p>景の音（${snd.size} 本）は mitsulab が録ったものではなく、Wikimedia Commons で公開されている他の人の野外録音です。録音者・録音地・権利は景の札に出します。</p>
  <h3>碧の声</h3><p>VOICEVOX:冥鳴ひまり（前もって声にした一文ずつ。話したことばは字幕にそのまま出します）。碧の言葉は、森羅百景の解説・作品の表・録音の台帳からだけ組んだ事実と、新しい事実を入れない雑談でできています。話したことは保存しません（端末に覚えるのは、設定と、最後に立っていた場所だけ）。</p>
  <h3>館のつくり</h3><p>部屋の床：Poly Haven「<a href="https://polyhaven.com/a/herringbone_parquet" target="_blank" rel="noopener">Herringbone Parquet</a>」（CC0）。大理石・石・漆喰・腰板・絨毯・天窓・窓の外の景色は、この画面の中でその場で描いています。碧の 3D の姿は © mitsulab（この作品の中で表示するためだけに置いています。持ち出し・再配布はできません）。表示の道具は three.js と three-vrm（MIT）。</p>`;
}
$("credAll").innerHTML = credits();
$("menuBtn").onclick = () => { closeAll(); $("menu").hidden = false; };
$("optJoy").checked = store.get("smm-joy", false); $("optRM").checked = RM; $("optBig").checked = store.get("smm-big", false); $("optVoice").checked = store.get("smm-voice", true);
const applyOpts = () => { $("joy").hidden = !$("optJoy").checked || mode !== "walk"; document.body.classList.toggle("big", $("optBig").checked); };
$("optJoy").onchange = () => { store.set("smm-joy", $("optJoy").checked); applyOpts(); };
try { new ResizeObserver(() => { $("joy").style.bottom = ($("guide").getBoundingClientRect().height + 24 + 12) + "px"; }).observe($("guide")); } catch {}
$("optRM").onchange = () => { RM = $("optRM").checked; store.set("smm-rm", RM); };
$("optBig").onchange = () => { store.set("smm-big", $("optBig").checked); applyOpts(); };
$("optVoice").onchange = () => { store.set("smm-voice", $("optVoice").checked); if (!$("optVoice").checked) skipLine(); };
$("muteBtn").onclick = () => { AUD.init(); AUD.setMute(!AUD.muted); if (AUD.muted && SP.playing) skipLine(); };
AUD.setMute(AUD.muted);
applyOpts();
document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => { $(b.dataset.close).hidden = true; });
document.querySelectorAll(".sheet").forEach(s => s.addEventListener("click", e => { if (e.target === s) s.hidden = true; }));
function anySheet() { return ["map", "list", "menu"].some(id => !$(id).hidden) || !$("zoom").hidden || !$("start").hidden; }
function closeAll() { for (const id of ["map", "list", "menu"]) $(id).hidden = true; $("zoom").hidden = true; closePanel(); }
function fold(on) { $("guide").classList.toggle("folded", on); $("guideFold").textContent = on ? "＋" : "－"; $("guideFold").setAttribute("aria-expanded", String(!on)); }
$("guideFold").onclick = () => fold(!$("guide").classList.contains("folded"));
let toastT = 0; function toast(s) { const t = $("toast"); t.textContent = s; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 1800); }
let lastWhere = "";
function updWhere() {
  if (mode !== "walk") return;
  const reg = region(me.pos.x, me.pos.z); let a = NAMES.museum, b = NAMES.hub;
  if (reg.kind === "library") { a = NAMES.library; b = reader.isOpen ? "読んでいる本" : "書架から一冊をえらぶ"; }
  else if (reg.kind === "entrance") { b = reg.u > VEST ? "入口の前" : "玄関"; }
  else if (reg.kind === "room") { const r = rooms[reg.i]; a = r.name; const j = clamp(Math.floor((reg.u - FOY) / BAY) * 2 + (reg.v > 0 ? 1 : 0), 0, r.kei.length - 1); b = reg.u < FOY ? r.desc : `${r.kei[j]?.no || ""}　${r.kei[j]?.name || ""}`; }
  const s = a + "|" + b; if (s !== lastWhere) { lastWhere = s; $("whereName").textContent = a; $("whereSub").textContent = b; }
}

// ---------------------------------------------------------------- はじめ（入口の前の 3D に、題と二つの入り方）・入口から歩いて入る
const START = E(STEPS + 18);
function placeStart() { space = "museum"; me.pos.set(START.x, EYE + PLAZA_Y, START.z); me.yaw = 0; me.pitch = .1; me.path = []; document.body.classList.remove("inlib"); }
function enterWalk() {
  AUD.init(); mode = "walk"; $("start").hidden = true; $("top").hidden = false; $("guide").hidden = false; $("shelfBar").hidden = space !== "library"; applyOpts();
  zone.key = null; setZone(zoneOf(), true); AUD.zone(ambOf(zone.key)); stage.focus({ preventScroll: true });
}
function showHint() {
  if (store.get("smm-hint", false)) return; store.set("smm-hint", true);
  const h = $("hint"); h.hidden = false; h.classList.add("on");
  const off = () => { h.classList.remove("on"); setTimeout(() => { h.hidden = true; }, 600); removeEventListener("pointerdown", off2); };
  const off2 = e => { if (e.target === renderer.domElement) setTimeout(off, 1200); };
  addEventListener("pointerdown", off2); setTimeout(off, 9000);
}
async function introWalk(toLibrary) {
  const tk = ++intro.tok; placeStart(); enterWalk(); aoiJump();
  const pT = talk(toLibrary ? [T.outside[0], T.warp.guide_lib] : T.outside, [["自分で歩く", () => { intro.tok++; me.path = []; showHint(); freeTalk([T.idle.free]); }]]);
  await goP(E(VEST + 2.2), E(0)); if (tk !== intro.tok) return;
  await goP(new THREE.Vector3(0, 0, 14.2), new THREE.Vector3(STELE.x, 0, STELE.z)); if (tk !== intro.tok) return;
  if (!await pT || tk !== intro.tok) return;
  showHint();
  if (toLibrary) { goWarp(); return; }
  const acts = [["部屋をえらぶ", openMap, true], [FEAT.k.id === "kaeru" ? "蛙の壺を見る" : "正面の一枚を見る", () => approach(featBay, featBay.slots[0])], [`${NAMES.library}へ`, goWarp], ["順に案内して", () => runTour(0)]];
  curActs = () => acts; talk(T.lobby, acts);
}
function goHome() {
  intro.tok++; hush(); stopTour(false); closeAll(); if (reader.isOpen) reader.close();
  mode = "start"; placeStart(); $("top").hidden = true; $("guide").hidden = true; $("joy").hidden = true; $("shelfBar").hidden = true;
  $("start").hidden = false; AUD.zone(null); zone.key = null; setZone(zoneOf(), true);
}
$("homeBtn").onclick = goHome;
// 美術館 ⇄ 図書館を、どこからでも（光の輪までは歩かずに。光の輪はそのまま残す）
function spaceBtnUpd() { const b = $("spaceBtn"); const lib_ = space === "library"; b.textContent = lib_ ? "🏛" : "📚"; b.setAttribute("aria-label", lib_ ? `${NAMES.museum}へ移る` : `${NAMES.library}へ移る`); b.title = b.getAttribute("aria-label"); }
$("spaceBtn").onclick = () => { if (mode !== "walk" || warping) return; if (reader.isOpen) reader.close(); doWarp(); };
const BOOKS_ALL = bookList(rooms);
$("shelfBar").innerHTML = BOOKS_ALL.map((b, i) => `<button data-b="${i}" style="--c:${b.acc}">${esc(b.name)}</button>`).join("");
$("shelfBar").querySelectorAll("button").forEach(b => b.onclick = () => approachBook(+b.dataset.b));
document.querySelectorAll("[data-n]").forEach(el => { const k = el.dataset.n; if (NAMES[k]) el.textContent = NAMES[k]; });
document.title = `${NAMES.museum}・${NAMES.library}`;

// ---------------------------------------------------------------- まわす
const clock = new THREE.Clock(); let acc = 0, mapAcc = 0, frames = 0, tt = 0;
function tick() {
  const dt = Math.min(.05, clock.getDelta()); tt += dt;
  if (mode === "walk") { moveTick(dt); }
  else { me.yaw = Math.sin(tt * .12) * .12; camera.position.copy(me.pos); camera.rotation.set(me.pitch, me.yaw, 0, "YXZ"); }
  aoiTick(dt); atmoTick(dt); partTick(dt, tt);
  const T_ = RM ? 0 : tt; for (const m of winMats) m.uniforms.uT.value = T_; warpMat.uniforms.uT.value = T_;
  for (const w of warps) w.ring.rotation.z = T_ * .3;
  const dd = Math.hypot(me.pos.x - E(VEST).x, me.pos.z - E(VEST).z), open = space === "museum" && dd < 10;
  for (const d of ctxDoors) { const want = -ENT.th + (open ? d.sgn * 1.35 : 0); d.pivot.rotation.y += (want - d.pivot.rotation.y) * Math.min(1, dt * 2.2); }
  LIBW.tick(dt, tt, -1);
  if (marker.material.opacity > 0) marker.material.opacity = Math.max(0, marker.material.opacity - dt * .9);
  exploreTick(dt);
  acc += dt; if (acc > .3) { acc = 0; streamBays(); updWhere(); setZone(zoneOf()); if (mode === "walk" && !me.path.length && space === "museum" && region(me.pos.x, me.pos.z).kind === "room") store.set("smm-at", [+me.pos.x.toFixed(2), +me.pos.z.toFixed(2), +me.yaw.toFixed(3)]); }
  if (mode === "walk") { mapAcc += dt; if (mapAcc > .2) { mapAcc = 0; drawMini(); } }
  if (!document.hidden && $("reader").hidden) { renderer.render(scene, camera); frames++; }
  requestAnimationFrame(tick);
}
function prog(p) { $("prog").querySelector("i").style.width = Math.round(p) + "%"; }

placeStart(); resize(); camera.position.copy(me.pos); camera.rotation.set(me.pitch, me.yaw, 0, "YXZ"); setZone(zoneOf(), true); streamBays();
hang(featBay, featBay.slots[0]).catch(e => console.warn("入口の一枚を読めませんでした", e?.type || e));
prog(20);
const warm = Promise.all([new Promise(r => setTimeout(r, 50)), loadAoi()]);
renderer.compileAsync?.(scene, camera).catch(() => {});
requestAnimationFrame(tick);
warm.then(() => { prog(100); for (const id of ["enter", "enterLib"]) $(id).disabled = false; $("enter").textContent = `${NAMES.guide}と巡る`; $("enterLib").textContent = "書架へ"; });
const resumeAt = store.get("smm-at", null);
if (resumeAt && (() => { space = "museum"; return walkable(resumeAt[0], resumeAt[1]) && region(resumeAt[0], resumeAt[1]).kind === "room"; })()) {
  const b = document.createElement("button"); b.className = "btn"; b.id = "resume"; b.textContent = "続きから（" + rooms[region(resumeAt[0], resumeAt[1]).i].name + "）";
  b.onclick = () => { if ($("enter").disabled) return; intro.tok++; space = "museum"; me.pos.set(resumeAt[0], EYE, resumeAt[1]); me.yaw = resumeAt[2]; me.pitch = -.02; enterWalk(); aoiJump(); streamBays(); freeTalk([T.idle.hello]); };
  $("resumeWrap").appendChild(b);
}
$("enter").onclick = () => introWalk(false);
$("enterLib").onclick = () => introWalk(true);
$("enterList").onclick = () => { intro.tok++; space = "museum"; me.pos.set(0, EYE, 14.2); me.yaw = 0; enterWalk(); aoiJump(); openList(); freeTalk([T.idle.hello]); };

// 確かめ用（Playwright）
window.__mu = { featBay, rooms, bays, me, A, tour, SP, AUD, T, zone, NAMES, LIBW, reader, intro, get space() { return space; }, get vrm() { return vrm; }, get frames() { return frames; }, get mode() { return mode; }, renderer, camera, scene,
  runTour, tourNextKei, enterRoom, openPanel, openMap, openList, approach, approachBook, region, walkable, pick, goTo, streamBays, goWarp, doWarp, goHome, introWalk, E, VEST,
  info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, tex: renderer.info.memory.textures, geo: renderer.info.memory.geometries }) };
