/* 図書館（library）：美術館と同じ 3D の世界の、地下（y＝LIB.Y）にある閲覧室と、本の読み手（見開き・頁めくり）。2026-10-07。
   本人（2026-10-07）：「森羅図書館も別で３dで本棚を作って、そこに、月百景、雨百景などの本があり、それを選ぶと、本の形式で読めるようにしてください。」
   同日：「同じ３dモデルで中央にワープするところがあって、はじめは博物館に入って、ワープすると図書館に移動するようにしてください。」
   表示する名前は names.json（M.names）だけから引く。コードの識別子は library／museum／hub。 */
import { esc, credit } from "./common.js";

export const LIB = { Y: -60, X: 7.6, Z: 9.6, H: 8 };
const DISP = { z: -4.6, w: 2.6, d: .7 };                 // まん中の「百景の棚」（表紙を見せて並べる）
const TABLES = [[-4.6, 4.2], [4.6, 4.2]];
const DISP2 = { z: 7.6, w: 2.0, d: .6 };                 // うしろの小さな棚（百景のほかの本）
// 本の一覧：百景の八冊（rooms）と、ほかの本（window.BOOKS＝_dev/build_books.py）
export function bookList(rooms) {
  return [...rooms.map(r => ({ id: r.slug, kind: "hyakkei", name: r.name, desc: r.desc, acc: r.acc, motif: r.slug, r })), ...(window.BOOKS || [])];
}

export function libWalkable(x, z) {
  if (Math.abs(x) > LIB.X - .8 || Math.abs(z) > LIB.Z - .8) return false;
  if (Math.abs(x) < DISP.w + .5 && Math.abs(z - DISP.z) < DISP.d + .5) return false;
  for (const [tx, tz] of TABLES) if (Math.abs(x - tx) < 1.5 && Math.abs(z - tz) < 2.3) return false;
  if (Math.abs(x) < DISP2.w + .4 && Math.abs(z - DISP2.z) < DISP2.d + .5) return false;
  return true;
}

// 3D の閲覧室を建てる。put（まとめて描く）・textPlane などは museum.js から借りる
export function buildLibrary(ctx) {
  const { THREE, world, put, flush, mats, TX, textPlane, fit, rooms, NAMES, clickables, floors, isTouch, MINCHO, GOTH } = ctx;
  const Y = LIB.Y, V = (x, y, z) => new THREE.Vector3(x, Y + y, z);
  const shelfWall = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: .8 });
  // 床・絨毯・壁・天井
  const fm = new THREE.MeshStandardMaterial({ ...mats.parquet, color: 0x7a5a40, roughness: .55, envMapIntensity: .5 });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(2 * LIB.X, 2 * LIB.Z), fm);
  { const uv = fl.geometry.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 2 * LIB.X / 2.2, uv.getY(k) * 2 * LIB.Z / 2.2); }
  fl.rotation.x = -Math.PI / 2; fl.position.set(0, Y, 0); world.add(fl); floors.push(fl);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(6, 9), new THREE.MeshStandardMaterial({ map: TX.runner("#5a1c16", "#c9a45c"), roughness: .95 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, Y + .005, 1.2); world.add(rug);
  const wallM = new THREE.MeshStandardMaterial({ color: 0x2e3a2c, roughness: .9 });
  for (const s of [-1, 1]) {
    put("libwall", wallM, new THREE.BoxGeometry(.3, LIB.H, 2 * LIB.Z), V(s * (LIB.X + .15), LIB.H / 2, 0));
    put("libwall", wallM, new THREE.BoxGeometry(2 * LIB.X, LIB.H, .3), V(0, LIB.H / 2, s * (LIB.Z + .15)));
  }
  put("libceil", new THREE.MeshStandardMaterial({ color: 0x24170e, roughness: .9 }), new THREE.PlaneGeometry(2 * LIB.X, 2 * LIB.Z), V(0, LIB.H, 0), 0, Math.PI / 2);
  for (let z = -LIB.Z + 1; z < LIB.Z; z += 2) put("libwood", mats.darkWood, new THREE.BoxGeometry(2 * LIB.X, .3, .24), V(0, LIB.H - .15, z));
  for (const x of [-LIB.X + 2.5, 0, LIB.X - 2.5]) put("libwood", mats.darkWood, new THREE.BoxGeometry(.24, .32, 2 * LIB.Z), V(x, LIB.H - .16, 0));
  // 書架（四方の壁ぞい・天井まで）：棚板と縦の仕切りは木、本は一つの InstancedMesh（色ちがい）
  const SH = 8, RW = .78, CD = .42, H0 = .3;
  const runs = [];   // [x0,z0,x1,z1, 内向きの法線 nx,nz]
  runs.push([-LIB.X + CD / 2, -LIB.Z, -LIB.X + CD / 2, LIB.Z, 1, 0], [LIB.X - CD / 2, -LIB.Z, LIB.X - CD / 2, LIB.Z, -1, 0], [-LIB.X, -LIB.Z + CD / 2, LIB.X, -LIB.Z + CD / 2, 0, 1], [-LIB.X, LIB.Z - CD / 2, LIB.X, LIB.Z - CD / 2, 0, -1]);
  const pal = [0x5b1f1a, 0x2f4a3a, 0x3a2a1a, 0x24304a, 0x6b4a22, 0x4a1e2e, 0x2a3a3a, 0x7a5a30, 0x3d2c4a, 0x1e2a22, 0x8a6a3a, 0x5a4a32];
  const books = []; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const [x0, z0, x1, z1, nx, nz] of runs) {
    const len = Math.hypot(x1 - x0, z1 - z0), ax = (x1 - x0) / len, az = (z1 - z0) / len, rotY = Math.atan2(nx, nz);
    for (let r = 0; r <= SH; r++) put("libwood", mats.darkWood, new THREE.BoxGeometry(len, .05, CD), V((x0 + x1) / 2, H0 + r * RW - .03, (z0 + z1) / 2), Math.abs(nx) ? Math.PI / 2 : 0);
    for (let t = 0; t <= len; t += 1.6) put("libwood", mats.woodMat, new THREE.BoxGeometry(.08, SH * RW + .3, CD + .04), V(x0 + ax * t, (SH * RW + .3) / 2 + .05, z0 + az * t), rotY);
    for (let r = 0; r < SH; r++) {
      let t = .1;
      while (t < len - .1) {
        const w = .035 + rnd() * .055, h = .2 + rnd() * .3 * (RW - .1) / .5 * .55, gap = rnd() < .04 ? .25 : .004;
        if (rnd() < .025) { t += .3; continue; }
        books.push({ x: x0 + ax * (t + w / 2), z: z0 + az * (t + w / 2), y: H0 + r * RW + h / 2, w, h, d: .2 + rnd() * .12, rot: rotY, c: pal[Math.floor(rnd() * pal.length)], lean: rnd() < .03 ? (rnd() - .5) * .3 : 0, nx, nz });
        t += w + gap;
      }
    }
  }
  if (isTouch) for (let k = books.length - 1; k > 0; k -= 3) books.splice(k, 1);   // スマホは本の数を減らす（見た目はほぼ同じ）
  const bg = new THREE.BoxGeometry(1, 1, 1), bm = new THREE.MeshStandardMaterial({ roughness: .7, envMapIntensity: .3 });
  const inst = new THREE.InstancedMesh(bg, bm, books.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  books.forEach((b, k) => {
    e.set(0, b.rot, b.lean); q.setFromEuler(e);
    const off = CD / 2 - b.d / 2 - .02; m4.compose(new THREE.Vector3(b.x + b.nx * off, Y + b.y, b.z + b.nz * off), q, new THREE.Vector3(b.w, b.h, b.d));
    inst.setMatrixAt(k, m4); inst.setColorAt(k, col.setHex(b.c).multiplyScalar(.7 + rnd() * .5));
  });
  world.add(inst);
  // 梯子（左右の書架に立てかける）と真鍮の手すり
  for (const s of [-1, 1]) {
    const x = s * (LIB.X - .9), z = s * 3;
    put("libbrass", mats.brassMat, new THREE.BoxGeometry(.04, .04, 2 * LIB.Z - 1), V(s * (LIB.X - .5), 6.7, 0));
    for (const dz of [-.28, .28]) put("libwood", mats.woodMat, new THREE.BoxGeometry(.07, 7.0, .07), V(x + s * .05, 3.4, z + dz), 0, 0);
    for (let y = .4; y < 6.8; y += .4) put("libwood", mats.darkWood, new THREE.BoxGeometry(.05, .04, .56), V(x + s * .05, y, z));
  }
  // 読書の机と、緑の笠のランプ
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xfff0c8, toneMapped: false });
  const shade = new THREE.MeshStandardMaterial({ color: 0x1f5a3a, roughness: .35, metalness: .2, emissive: 0x0d3a22, emissiveIntensity: .6 });
  for (const [tx, tz] of TABLES) {
    put("libwood", mats.darkWood, new THREE.BoxGeometry(2.0, .08, 3.6), V(tx, .78, tz));
    for (const [lx, lz] of [[-.85, -1.6], [.85, -1.6], [-.85, 1.6], [.85, 1.6]]) put("libwood", mats.darkWood, new THREE.BoxGeometry(.08, .76, .08), V(tx + lx, .38, tz + lz));
    for (const dz of [-1, 1]) {
      put("libbrass", mats.brassMat, new THREE.CylinderGeometry(.02, .02, .4, 8), V(tx, 1.02, tz + dz));
      put("libshade", shade, new THREE.CylinderGeometry(.1, .2, .14, 16, 1, true), V(tx, 1.25, tz + dz));
      const g = new THREE.Mesh(new THREE.CircleGeometry(.18, 16), lampGlow); g.rotation.x = Math.PI / 2; g.position.copy(V(tx, 1.19, tz + dz)); world.add(g);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), mats.poolMat); pool.rotation.x = -Math.PI / 2; pool.position.copy(V(tx, .825, tz + dz)); world.add(pool);
      for (const sx of [-1, 1]) put("libwood", mats.woodMat, new THREE.BoxGeometry(.5, .5, .5), V(tx + sx * 1.35, .25, tz + dz));
    }
  }
  // 吊りランプ
  for (const [x, z] of [[-3, -6], [3, -6], [-3, 0], [3, 0], [-3, 6], [3, 6]]) {
    const g = new THREE.Mesh(new THREE.SphereGeometry(.22, 16, 10), lampGlow); g.position.copy(V(x, 5.6, z)); world.add(g);
    put("libbrass", mats.brassMat, new THREE.CylinderGeometry(.01, .01, LIB.H - 5.8, 4), V(x, 5.7 + (LIB.H - 5.8) / 2, z));
  }
  // まん中の「百景の棚」：表紙を見せて二段に四冊ずつ。押すと、前まで行って本がひらく
  put("libwood", mats.woodMat, new THREE.BoxGeometry(DISP.w * 2 + .3, 2.5, DISP.d), V(0, 1.25, DISP.z - .05));
  put("libwood", mats.darkWood, new THREE.BoxGeometry(DISP.w * 2 + .5, .12, DISP.d + .2), V(0, 2.56, DISP.z - .05));
  const title = textPlane(3.2, .42, (g, w, h) => { g.fillStyle = "#2a1c10"; g.fillRect(0, 0, w, h); g.strokeStyle = "#c9a45c"; g.lineWidth = 6; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = "#e7cf93"; g.textAlign = "center"; g.textBaseline = "middle"; fit(g, `${NAMES.series}　${rooms.length}冊`, w * .9, `600 %px ${MINCHO}`, Math.round(h * .55)); g.fillText(`${NAMES.series}　${rooms.length}冊`, w / 2, h / 2); }, 1024);
  title.position.copy(V(0, 2.35, DISP.z + DISP.d / 2 - .03)); world.add(title);
  const featured = [];
  rooms.forEach((r, i) => {
    const row = i < 4 ? 0 : 1, c = i % 4, x = (c - 1.5) * 1.18, y = row ? .78 : 1.62;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.1, .04, .3), mats.brassMat); shelf.position.copy(V(x, y - .33, DISP.z + DISP.d / 2 + .1)); world.add(shelf);
    const cover = new THREE.Mesh(new THREE.BoxGeometry(.5, .66, .06), [mats.paperEdge, mats.paperEdge, mats.paperEdge, mats.paperEdge, new THREE.MeshStandardMaterial({ map: coverTex(THREE, { name: r.name, desc: r.desc, acc: r.acc, motif: r.slug }, NAMES, MINCHO, GOTH), roughness: .6, envMapIntensity: .4, emissive: 0xffffff, emissiveIntensity: .12 }), mats.paperEdge]);
    cover.material[4].emissiveMap = cover.material[4].map;
    cover.position.copy(V(x, y, DISP.z + DISP.d / 2 + .1)); cover.rotation.x = -.12; world.add(cover);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), mats.poolMat); pool.position.copy(V(x, y + .1, DISP.z + DISP.d / 2 + .02)); world.add(pool);
    cover.userData = { book: i }; clickables.push(cover);
    featured.push({ i, mesh: cover, base: cover.position.clone(), stand: new THREE.Vector3(x * .7, 0, DISP.z + 2.3), look: new THREE.Vector3(x, 0, DISP.z) });
  });
  // うしろの小さな棚：百景のほかの本（観天望気・絵本・土落語）。表紙を広間のまん中（−z）へ向ける
  const extra = (window.BOOKS || []);
  if (extra.length) {
    put("libwood", mats.woodMat, new THREE.BoxGeometry(DISP2.w * 2 + .3, 2.2, DISP2.d), V(0, 1.1, DISP2.z + .05));
    put("libwood", mats.darkWood, new THREE.BoxGeometry(DISP2.w * 2 + .5, .12, DISP2.d + .2), V(0, 2.26, DISP2.z + .05));
    const t2 = textPlane(2.6, .36, (g, w, h) => { g.fillStyle = "#2a1c10"; g.fillRect(0, 0, w, h); g.strokeStyle = "#c9a45c"; g.lineWidth = 6; g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = "#e7cf93"; g.textAlign = "center"; g.textBaseline = "middle"; fit(g, "百景のほかの本", w * .9, `600 %px ${MINCHO}`, Math.round(h * .55)); g.fillText("百景のほかの本", w / 2, h / 2); }, 1024);
    t2.position.copy(V(0, 2.08, DISP2.z - DISP2.d / 2 - .03)); t2.rotation.y = Math.PI; world.add(t2);
    extra.forEach((b, k) => {
      const i = rooms.length + k, x = (k - (extra.length - 1) / 2) * 1.2, y = 1.3;
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.1, .04, .3), mats.brassMat); shelf.position.copy(V(x, y - .33, DISP2.z - DISP2.d / 2 - .1)); world.add(shelf);
      const mat = new THREE.MeshStandardMaterial({ map: coverTex(THREE, b, NAMES, MINCHO, GOTH), roughness: .6, envMapIntensity: .4, emissive: 0xffffff, emissiveIntensity: .12 }); mat.emissiveMap = mat.map;
      const cover = new THREE.Mesh(new THREE.BoxGeometry(.5, .66, .06), [mats.paperEdge, mats.paperEdge, mats.paperEdge, mats.paperEdge, mat, mats.paperEdge]);
      cover.position.copy(V(x, y, DISP2.z - DISP2.d / 2 - .1)); cover.rotation.set(.12, Math.PI, 0); world.add(cover);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), mats.poolMat); pool.rotation.y = Math.PI; pool.position.copy(V(x, y + .1, DISP2.z - DISP2.d / 2 - .02)); world.add(pool);
      cover.userData = { book: i }; clickables.push(cover);
      featured.push({ i, mesh: cover, base: cover.position.clone(), stand: new THREE.Vector3(x * .7, 0, DISP2.z - 2.3), look: new THREE.Vector3(x, 0, DISP2.z), back: true });
    });
  }
  flush();
  return { featured, tick(dt, t, hoverI) { for (const f of featured) { const want = f.i === hoverI ? (f.back ? -.12 : .12) : 0; f.mesh.position.z += (f.base.z + want - f.mesh.position.z) * Math.min(1, dt * 8); } } };
}

// 表紙（布の地・金の縁・題・連作の一行・主題のしるし）
const MOTIF = {
  tsuchi: g => { for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(-90, -40 + k * 22); for (let x = -90; x <= 90; x += 10) g.lineTo(x, -40 + k * 22 + Math.sin(x * .05 + k) * 5); g.stroke(); } },
  ame: g => { for (let k = 0; k < 14; k++) { const x = -80 + k * 12, y = -50 + (k * 37) % 60; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 8, y + 34); g.stroke(); } },
  kaze: g => { for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-90, -30 + k * 30); g.bezierCurveTo(-30, -60 + k * 30, 30, 0 + k * 30, 70, -30 + k * 30); g.arc(60, -20 + k * 30, 10, -Math.PI / 2, Math.PI, false); g.stroke(); } },
  yuki: g => { for (let a = 0; a < 6; a++) { g.save(); g.rotate(a * Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -60); g.moveTo(0, -35); g.lineTo(-14, -48); g.moveTo(0, -35); g.lineTo(14, -48); g.stroke(); g.restore(); } },
  hyakkei: g => { g.beginPath(); g.ellipse(0, 0, 70, 34, -.5, 0, 7); g.stroke(); g.beginPath(); g.moveTo(-55, 30); g.lineTo(55, -30); g.stroke(); },
  yasai: g => { g.beginPath(); g.arc(0, 12, 40, 0, 7); g.stroke(); g.beginPath(); g.moveTo(0, -28); g.quadraticCurveTo(-30, -70, -50, -50); g.moveTo(0, -28); g.quadraticCurveTo(30, -70, 50, -54); g.stroke(); },
  tsuki: g => { g.beginPath(); g.arc(0, 0, 50, 0, 7); g.stroke(); g.beginPath(); g.arc(20, -8, 44, 0, 7); g.stroke(); },
  kanten: g => { g.beginPath(); g.arc(-26, -18, 22, 0, 7); g.stroke(); g.beginPath(); g.moveTo(-70, 30); g.bezierCurveTo(-60, 0, -20, 4, -10, 18); g.bezierCurveTo(10, -6, 50, -2, 52, 22); g.bezierCurveTo(80, 22, 80, 46, 56, 48); g.lineTo(-62, 48); g.bezierCurveTo(-86, 46, -84, 30, -70, 30); g.stroke(); g.font = "28px serif"; g.fillStyle = "#e7cf93"; g.textAlign = "center"; g.fillText("● ◐ ○", 0, -64); },
  ehon: g => { g.beginPath(); g.ellipse(0, 10, 56, 34, 0, Math.PI, 0); g.stroke(); for (let k = -40; k <= 40; k += 16) { g.beginPath(); g.moveTo(k, 10); g.lineTo(k * 1.05, -18 - (40 - Math.abs(k)) * .3); g.stroke(); } g.beginPath(); g.moveTo(-66, 10); g.lineTo(66, 10); g.stroke(); g.beginPath(); g.arc(-62, -4, 6, 0, 7); g.stroke(); },
  rakugo: g => { g.beginPath(); g.moveTo(0, 50); g.lineTo(-62, -30); g.arc(0, 50, 100, Math.PI * 1.29, Math.PI * 1.71); g.lineTo(0, 50); g.stroke(); for (let a = -.34; a <= .35; a += .17) { g.beginPath(); g.moveTo(0, 50); g.lineTo(Math.sin(a) * 98, 50 - Math.cos(a) * 98); g.stroke(); } },
  taiyo: g => { g.beginPath(); g.arc(0, 0, 32, 0, 7); g.stroke(); for (let a = 0; a < 12; a++) { g.save(); g.rotate(a * Math.PI / 6); g.beginPath(); g.moveTo(0, -44); g.lineTo(0, -68); g.stroke(); g.restore(); } },
};
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const r = (n >> 16) * k, g = ((n >> 8) & 255) * k, b = (n & 255) * k; return `rgb(${r | 0},${g | 0},${b | 0})`; }
function coverTex(THREE, r, N, MINCHO, GOTH) {
  const c = document.createElement("canvas"); c.width = 384; c.height = 512; const g = c.getContext("2d");
  g.fillStyle = shade(r.acc, .42); g.fillRect(0, 0, 384, 512);
  for (let y = 0; y < 512; y += 3) { g.fillStyle = `rgba(255,255,255,${.015 + (y % 9 ? 0 : .02)})`; g.fillRect(0, y, 384, 1); }
  g.strokeStyle = "#d9bd7a"; g.lineWidth = 4; g.strokeRect(18, 18, 348, 476); g.lineWidth = 1.5; g.strokeRect(28, 28, 328, 456);
  g.fillStyle = "#f0dca6"; g.textAlign = "center"; g.textBaseline = "middle";
  { let z = 52; g.font = `600 ${z}px ${MINCHO}`; while (g.measureText(r.name).width > 320 && z > 24) { z -= 2; g.font = `600 ${z}px ${MINCHO}`; } } g.fillText(r.name, 192, 108);
  g.font = `20px ${GOTH}`; g.fillStyle = "#e8d6a8"; { let z = 20; while (g.measureText(r.desc).width > 320 && z > 12) { z--; g.font = `${z}px ${GOTH}`; } } g.fillText(r.desc, 192, 160);
  g.save(); g.translate(192, 290); g.strokeStyle = "#e7cf93"; g.lineWidth = 4; g.lineCap = "round"; (MOTIF[r.motif] || MOTIF.tsuchi)(g); g.restore();
  g.font = `18px ${GOTH}`; g.fillStyle = "#d9bd7a"; g.fillText(["kanten", "ehon", "rakugo"].includes(r.motif) ? N.library : `${N.series}　${N.library}`, 192, 452);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------------------------------------------------------------- 本の読み手（見開き・頁めくり。狭い画面は一頁ずつ）
export function createReader({ rooms, T, NAMES, openZoom, readAloud, onClose }) {
  const $ = id => document.getElementById(id);
  const st = { i: -1, pages: [], s: 0, busy: false, b: null };
  const BOOKS_ = bookList(rooms);
  const mdLine = t => esc(t.replace(/\*\*/g, "").replace(/`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"));
  // 長い文を頁に分ける（行をまとめて、だいたい max 字まで）
  function chunk(lines, max) { const out = []; let cur = [], n = 0; for (const l of lines) { if (n + l.length > max && cur.length) { out.push(cur); cur = []; n = 0; } cur.push(l); n += l.length; } if (cur.length) out.push(cur); return out; }
  const single = () => innerWidth < 760;
  function pagesOf(b) {
    const P = [{ kind: "cover" }, { kind: "intro" }];
    if (b.kind === "hyakkei") {
      const r = b.r; P.push({ kind: "toc" });
      r.kei.forEach(k => {
        const imgs = k.works.filter(w => w.f), rep = imgs.find(w => w.f === k.rep) || imgs[0];
        k._pg = P.length;
        P.push({ kind: "kei", k });
        if (rep) P.push({ kind: "work", k, w: rep, rep: true });
        if ((k.layers || []).length) P.push({ kind: "layers", k });
        for (const w of k.works) if (w !== rep) P.push({ kind: "work", k, w });
      });
    } else if (b.kind === "kanten") {
      P.push({ kind: "toc" });
      b.groups.forEach(g => { g._pg = P.length; P.push({ kind: "kgroup", g }); g.items.forEach(it => { P.push({ kind: "kitem", g, it }); P.push({ kind: "klayers", g, it }); }); });
    } else if (b.kind === "html") {
      b.pages.forEach((h, k) => P.push({ kind: "html", h, k }));
    } else if (b.kind === "rakugo") {
      P.push({ kind: "toc" });
      b.seki.forEach(sk => { sk._pg = P.length; P.push({ kind: "seki", sk });
        for (const sec of sk.secs) { const lines = sec.body.split("\n").map(x => x.trim()).filter(x => x && !x.startsWith(">")); chunk(lines, 620).forEach((ls, m) => P.push({ kind: "rtext", sk, sec, ls, m })); } });
    }
    P.push({ kind: "colophon" });
    return P;
  }
  function pageHTML(p, n) {
    const b = st.b, r = b.r || b;
    if (!p) return `<div class="blank">${n < 0 ? "" : "　"}</div>`;
    const folio = n > 0 ? `<div class="folio">${n}</div>` : "";
    if (p.kind === "cover") return `<div class="cover" style="background:linear-gradient(160deg,${b.acc}cc,#2a1c10 70%)"><div class="kick" style="color:#f3e2b3">${esc(b.kind === "hyakkei" ? NAMES.series : NAMES.library)}</div><h1>${esc(b.name)}</h1><div class="orn"></div><p>${esc(b.desc)}</p><p style="font-size:15px;opacity:.8">${esc(NAMES.library)} 蔵</p></div>`;
    const aloud = `<p><button class="btn" data-aloud="1" style="background:#365a43;color:#f8f1e1;border-color:#365a43">${esc(NAMES.guide)}に、この本の紹介を読んでもらう</button></p>`;
    if (b.kind === "kanten") {
      if (p.kind === "intro") return `<div class="pin"><div class="kick">はじめに</div><h2>${esc(b.name)}</h2><p>${esc(b.desc)}。いま目の前にある徴から、数時間から数日先の天気を読むことば。</p><p>${esc(b.note)}</p><h3>しるし</h3>${b.verdicts.map(v => `<p><b style="font-size:22px">${v.mark}</b>　${esc(v.v)}（${v.n} 景）── ${esc(v.def_)}</p>`).join("")}${aloud}</div>${folio}`;
      if (p.kind === "toc") return `<div class="pin"><div class="kick">目次 ── 見るところ</div><ul class="toc">${b.groups.map(g => `<li><button data-go="${g._pg}"><span>${g.no}</span><span>${esc(g.name)}</span><small>${g.items.length} 景</small></button></li>`).join("")}</ul></div>${folio}`;
      if (p.kind === "kgroup") return `<div class="pin"><div class="kick">見るところ　${p.g.no}</div><h2>${esc(p.g.name)}</h2><p>${esc(p.g.lede)}</p><ul class="toc">${p.g.items.map(it => `<li><button data-go="${st.pages.findIndex(q => q.it === it)}"><span>${it.mark}</span><span>${esc(it.name)}</span><small>${esc(it.region)}</small></button></li>`).join("")}</ul></div>${folio}`;
      if (p.kind === "kitem") { const it = p.it; return `<div class="pin"><div class="kick">${esc(p.g.name)}　・　${esc(it.region)}・${esc(it.lang)}</div><p style="font-size:30px;margin:.2em 0">${it.mark} <span style="font-size:17px">${esc(it.verdict)}</span></p><blockquote style="--c:${b.acc}">${esc(it.text)}</blockquote><div class="yomi">${esc(it.yomi)}</div><h3>意味</h3><p>${esc(it.meaning)}</p><h3>どこで確かめたか（典拠）</h3><p style="font-size:15px">${esc(it.src)}</p></div>${folio}`; }
      if (p.kind === "klayers") return `<div class="pin"><div class="kick">${p.it.mark}　${esc(p.it.name)}</div>${p.it.layers.map(([a, t]) => `<h3>${esc(a)}</h3><p>${esc(t)}</p>`).join("")}</div>${folio}`;
    }
    if (b.kind === "html") {
      if (p.kind === "intro") return `<div class="pin"><div class="kick">はじめに</div><h2>${esc(b.name)}</h2><p>${esc(b.desc)}。絵も文も mitsulab。</p>${aloud}</div>${folio}`;
      if (p.kind === "html") return `<div class="ehon" data-ehon="${p.k}"></div>`;
    }
    if (b.kind === "rakugo") {
      if (p.kind === "intro") return `<div class="pin"><div class="kick">はじめに</div><h2>${esc(b.name)}</h2><p>${esc(b.desc)}。</p><p>${esc(b.note)}</p><p>どの席も、まくら・本題・サゲ・きょうのさそい。そのあとに、口演では読まない「科学の線」と「典拠」を添えています。</p>${aloud}</div>${folio}`;
      if (p.kind === "toc") return `<div class="pin"><div class="kick">目次</div><ul class="toc">${b.seki.map(sk => `<li><button data-go="${sk._pg}"><span>${esc(sk.title.split(" ── ")[1] || "")}</span><span>${esc(sk.title.split("（")[0])}</span></button></li>`).join("")}</ul></div>${folio}`;
      if (p.kind === "seki") return `<div class="pin" style="display:flex;flex-direction:column;justify-content:center;text-align:center"><div class="kick">${esc(p.sk.title.split(" ── ")[1] || "")}</div><h1>${esc(p.sk.title.split(" ── ")[0])}</h1></div>${folio}`;
      if (p.kind === "rtext") return `<div class="pin"><div class="kick">${esc(p.sk.title.split("（")[0])}</div>${p.m === 0 ? `<h3>${esc(p.sec.h)}${p.sec.note ? `<small style="font-weight:400">（${esc(p.sec.note)}）</small>` : ""}</h3>` : ""}${p.ls.map(l => l.startsWith("- ") ? `<p style="font-size:15px;padding-left:1em;text-indent:-1em">・${mdLine(l.slice(2))}</p>` : `<p>${mdLine(l)}</p>`).join("")}</div>${folio}`;
    }
    if (p.kind === "colophon" && b.kind !== "hyakkei") return `<div class="pin"><div class="kick">奥付</div><h2>${esc(b.name)}</h2><p>${esc(NAMES.library)} 蔵。中身は mitsulab の作品のデータから、そのまま組みました。典拠は各頁に。</p></div>${folio}`;
    if (p.kind === "intro") return `<div class="pin"><div class="kick">はじめに</div><h2>${esc(r.name)}</h2><p>${esc(r.desc)}。</p><p>この本には、${r.kei.length} の景と、${r.n} 点の絵・写真・ことばが収めてあります。景ごとに、はじめの頁に景のはなし、つづいて古今の作品を一点ずつ。</p><p>どの頁からでも読めます。目次から、気になる景へ。</p>${aloud}</div>${folio}`;
    if (p.kind === "toc") return `<div class="pin"><div class="kick">目次</div><ul class="toc">${r.kei.map((k, j) => `<li><button data-go="${k._pg}"><span>${esc(k.no || "")}</span><span>${esc(k.name)}</span><small>${k._pg + 1}</small></button></li>`).join("")}</ul></div>${folio}`;
    if (p.kind === "kei") { const k = p.k; return `<div class="pin" style="--c:${r.acc}"><div class="kick">${esc(k.no || "")}</div><h2>${esc(k.name)}</h2><div class="yomi">${esc(k.yomi)}　${esc(k.en || "")}</div><p>${esc(k.lead)}</p>${k.invite ? `<h3>やってみる</h3><p>${esc(k.invite)}</p>` : ""}${k.snd ? `<h3>借りた録音</h3><p style="font-size:15px">${esc(k.snd.label)}（${esc(k.snd.where)}）。録音者・権利は${esc(NAMES.museum)}の札に。</p>` : ""}</div>${folio}`; }
    if (p.kind === "layers") return `<div class="pin"><div class="kick">${esc(p.k.no || "")}　${esc(p.k.name)}　景のはなし</div>${p.k.layers.map(([a, b]) => `<h3>${esc(a)}</h3><p>${esc(b)}</p>`).join("")}</div>${folio}`;
    if (p.kind === "work") {
      const w = p.w;
      const body = w.f ? `<figure><img src="${esc(w.f)}" alt="${esc(w.title)}" loading="lazy" data-zoom="1"></figure>` : `<blockquote style="--c:${r.acc}">${esc(w.quote)}</blockquote>`;
      return `<div class="pin"><div class="kick">${esc(p.k.no || "")}　${esc(p.k.name)}${p.rep ? "　まん中の一枚" : ""}</div>${body}<div class="cap">${credit(w)}</div>${w.note ? `<p style="font-size:16px">${esc(w.note)}</p>` : ""}</div>${folio}`;
    }
    if (p.kind === "colophon") return `<div class="pin"><div class="kick">奥付</div><h2>${esc(r.name)}</h2><p>${esc(NAMES.library)} 蔵。中身は mitsulab の連作《${esc(NAMES.series)}》のデータから組みました。図版は保護期間の満了した美術作品（各館のオープンアクセス・CC0／パブリックドメイン）と、Wikimedia Commons の CC の写真です。一点ごとの権利と元のページは、各頁の札にあります。CC BY-SA の写真は、この画面の中だけで使います。</p><p><a href="${esc(r.page)}" target="_blank" rel="noopener">${esc(NAMES.series)}で「${esc(r.name)}」をひらく</a></p></div>${folio}`;
    return "";
  }
  const nSp = () => single() ? st.pages.length : Math.ceil((st.pages.length + 1) / 2);
  const idx = s => single() ? [null, s] : [2 * s - 1, 2 * s];
  function fill(el, n) {
    el.innerHTML = n == null ? "" : n < 0 ? `<div class="endp"></div>` : pageHTML(st.pages[n], n); wire(el);
    // 絵本の頁：元の HTML の一頁を、元の見た目のまま（影の DOM に閉じこめて）頁いっぱいに縮めて置く
    const eh = el.querySelector("[data-ehon]");
    if (eh) {
      const host = document.createElement("div"); host.style.cssText = "position:absolute;left:50%;top:50%;width:560px;height:560px;transform-origin:center"; eh.appendChild(host);
      const sr = host.attachShadow({ mode: "open" }); sr.innerHTML = `<style>${st.b.style}\n.pg{width:560px!important;height:560px!important;margin:0!important}</style>` + st.b.pages[+eh.dataset.ehon];
      const fit = () => { const w = el.clientWidth || 300, h = el.clientHeight || 300, k = Math.min(w / 560, h / 560) * .96; host.style.transform = `translate(-50%,-50%) scale(${k})`; };
      requestAnimationFrame(fit);
    }
  }
  function wire(el) {
    el.querySelectorAll("[data-go]").forEach(b => b.onclick = () => jumpTo(+b.dataset.go));
    el.querySelectorAll("[data-zoom]").forEach(b => b.onclick = () => { const src = b.getAttribute("src"); const w = st.pages.find(p => p.w && p.w.f === src)?.w; if (w) openZoom(w); });
    el.querySelectorAll("[data-aloud]").forEach(b => b.onclick = () => readAloud(st.i));
  }
  function render() {
    $("spread").classList.toggle("single", single());
    const [l, r] = idx(st.s); fill($("pgL"), l); fill($("pgR"), r);
    const tot = st.pages.length;
    $("rdPos").textContent = single() ? `${st.s + 1} / ${tot}` : `${Math.max(1, 2 * st.s)}–${Math.min(tot, 2 * st.s + 1)} / ${tot}`;
    $("rdPrev").disabled = st.s <= 0; $("rdNext").disabled = st.s >= nSp() - 1;
    // 次の見開きの図版を先に読む
    for (const n of idx(st.s + 1)) { const p = st.pages[n]; if (p?.w?.f) { const im = new Image(); im.src = p.w.f; } }
  }
  function turn(dir) {
    const ns = st.s + dir; if (ns < 0 || ns >= nSp() || st.busy) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || document.body.dataset.rm === "1";
    if (reduce) { st.s = ns; render(); return; }
    st.busy = true;
    const sp = $("spread"), leaf = document.createElement("div"); leaf.className = "leaf";
    const one = single(), [cl, cr] = idx(st.s), [nl, nr] = idx(ns);
    const front = document.createElement("div"), back = document.createElement("div");
    front.className = "pg " + (dir > 0 ? "r" : "l"); back.className = "pg bk " + (dir > 0 ? "l" : "r");
    if (one) { front.className = "pg r"; back.className = "pg bk r"; }
    fill(front, one ? (dir > 0 ? cr : nr) : (dir > 0 ? cr : cl)); fill(back, one ? null : (dir > 0 ? nl : nr));
    leaf.append(front, back);
    if (one) { leaf.style.left = "0"; leaf.style.transformOrigin = "left center"; }
    else if (dir > 0) { leaf.style.left = "50%"; leaf.style.transformOrigin = "left center"; }
    else { leaf.style.left = "0"; leaf.style.transformOrigin = "right center"; }
    // 下の頁を先に次のものへ
    if (one) { if (dir > 0) fill($("pgR"), nr); else { fill($("pgR"), cr); leaf.style.transform = "rotateY(-180deg)"; } }
    else if (dir > 0) fill($("pgR"), nr); else fill($("pgL"), nl);
    sp.appendChild(leaf);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      leaf.style.transform = one ? (dir > 0 ? "rotateY(-180deg)" : "rotateY(0deg)") : (dir > 0 ? "rotateY(-180deg)" : "rotateY(180deg)");
    }));
    const end = () => { leaf.remove(); st.s = ns; render(); st.busy = false; };
    leaf.addEventListener("transitionend", end, { once: true }); setTimeout(() => { if (st.busy) end(); }, 1100);
  }
  function jumpTo(pageN) { st.s = single() ? pageN : Math.ceil(pageN / 2); render(); }
  function open(i) {
    st.i = i; st.b = BOOKS_[i]; st.pages = pagesOf(st.b); st.s = 0;
    $("rdTitle").textContent = `${st.b.name}　─　${NAMES.library}`;
    $("reader").hidden = false; render(); $("rdNext").focus({ preventScroll: true });
  }
  function close() { $("reader").hidden = true; st.i = -1; onClose?.(); }
  $("rdPrev").onclick = () => turn(-1); $("rdNext").onclick = () => turn(1); $("rdClose").onclick = close;
  $("rdToc").onclick = () => { const n = st.pages.findIndex(p => p.kind === "toc"); jumpTo(n < 0 ? 1 : n); }; $("rdAoi").onclick = () => readAloud(st.i);
  // 指でめくる
  let sx = null;
  $("book").addEventListener("pointerdown", e => { if (e.target.closest("button,a,img")) return; sx = e.clientX; });
  $("book").addEventListener("pointerup", e => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) turn(dx < 0 ? 1 : -1); else if (!e.target.closest(".pin")) turn(e.clientX > innerWidth / 2 ? 1 : -1); });
  addEventListener("resize", () => { if (st.i >= 0) { const p = single() ? Math.max(0, 2 * st.s - 1) : st.s; st.s = single() ? p : Math.ceil(p / 2); render(); } });
  return { open, close, goto: jumpTo, get isOpen() { return st.i >= 0; }, key(e) { if (st.i < 0) return false; if (e.key === "ArrowRight") turn(1); else if (e.key === "ArrowLeft") turn(-1); else if (e.key === "Escape") close(); else return false; e.preventDefault(); return true; }, state: st, turn };
}
