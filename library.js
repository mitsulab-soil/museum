/* 図書館（library）：美術館と同じ 3D の世界の、地下（y＝LIB.Y）にある閲覧室と、本の読み手（見開き・頁めくり）。2026-10-07。
   本人（2026-10-07）：「森羅図書館も別で３dで本棚を作って、そこに、月百景、雨百景などの本があり、それを選ぶと、本の形式で読めるようにしてください。」
   同日：「同じ３dモデルで中央にワープするところがあって、はじめは博物館に入って、ワープすると図書館に移動するようにしてください。」
   表示する名前は names.json（M.names）だけから引く。コードの識別子は library／museum／hub。 */
import { esc, credit } from "./common.js";

// 2026-10-07 本人「図書館を別の場所として作らず、美術館の中に書架の部屋を一室設け」→ 円堂の玄関わきの扉から入る、地上の一室（座標はこの部屋の中のもの。+z が円堂の側＝入口）
// 2026-10-08 本人「書架の間の入口だけ小さい」→ ほかの部屋の入口（半幅 2.5 m・アーチの頂 5.2 m）とそろえた
export const LIB = { Y: 0, X: 4.4, Z: 7.2, H: 6.2, DOOR: 2.5, DOORH: 5.2 };
const DISP = { z: -5.0, w: 2.4, d: .7 };                 // 奥の「百景の棚」（表紙を見せて並べる）
const TABLES = [[-2.5, 1.4]];                            // 読書の机（一台）
const DISP2 = { x: 3.2, z: 1.4, w: .7, d: .6 };          // 右の小さな台（百景のほかの本）。表紙を部屋のまん中（−x）へ
// 本の一覧：百景の八冊（rooms）と、ほかの本（window.BOOKS＝_dev/build_books.py）
export function bookList(rooms) {
  return [...rooms.map(r => ({ id: r.slug, kind: "hyakkei", name: r.name, desc: r.desc, acc: r.acc, motif: r.slug, r })), ...(window.BOOKS || [])];
}

export function libWalkable(x, z) {
  if (Math.abs(x) < LIB.DOOR - .4 && z > LIB.Z - 1.2 && z < LIB.Z + 1.2) return true;   // 入口（円堂からの扉）
  if (Math.abs(x) > LIB.X - .8 || Math.abs(z) > LIB.Z - .8) return false;
  if (Math.abs(x) < DISP.w + .5 && Math.abs(z - DISP.z) < DISP.d + .5) return false;
  for (const [tx, tz] of TABLES) if (Math.abs(x - tx) < 1.5 && Math.abs(z - tz) < 2.3) return false;
  if (Math.abs(x - DISP2.x) < DISP2.d + .5 && Math.abs(z - DISP2.z) < DISP2.w + .5) return false;
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
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(6, 9), new THREE.MeshStandardMaterial({ map: TX.runner("#5a1c16", "#c9a45c"), roughness: .95, ...(mats.carpetNor ? { normalMap: (n => (n.repeat.set(10, 15), n))(mats.carpetNor.clone()), normalScale: new THREE.Vector2(.6, .6) } : {}) }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, Y + .005, 1.2); world.add(rug);
  const wallM = new THREE.MeshStandardMaterial({ color: 0x2e3a2c, roughness: .9 });
  for (const s of [-1, 1]) {
    put("libwall", wallM, new THREE.BoxGeometry(.3, LIB.H, 2 * LIB.Z), V(s * (LIB.X + .15), LIB.H / 2, 0));
    put("libwall", wallM, new THREE.BoxGeometry(LIB.X - LIB.DOOR, LIB.H, .3), V(s * (LIB.X + LIB.DOOR) / 2, LIB.H / 2, LIB.Z + .15));
  }
  put("libwall", wallM, new THREE.BoxGeometry(2 * LIB.X, LIB.H, .3), V(0, LIB.H / 2, -LIB.Z - .15));
  put("libwall", wallM, new THREE.BoxGeometry(2 * LIB.DOOR, LIB.H - LIB.DOORH, .3), V(0, LIB.DOORH + (LIB.H - LIB.DOORH) / 2, LIB.Z + .15));
  put("libceil", new THREE.MeshStandardMaterial({ color: 0x24170e, roughness: .9 }), new THREE.PlaneGeometry(2 * LIB.X, 2 * LIB.Z), V(0, LIB.H, 0), 0, Math.PI / 2);
  for (let z = -LIB.Z + 1; z < LIB.Z; z += 2) put("libwood", mats.darkWood, new THREE.BoxGeometry(2 * LIB.X, .3, .24), V(0, LIB.H - .15, z));
  for (const x of [-LIB.X + 2.5, 0, LIB.X - 2.5]) put("libwood", mats.darkWood, new THREE.BoxGeometry(.24, .32, 2 * LIB.Z), V(x, LIB.H - .16, 0));
  // 書架（四方の壁ぞい・天井まで）：棚板と縦の仕切りは木、本は一つの InstancedMesh（色ちがい）
  const SH = 7, RW = .78, CD = .42, H0 = .3;
  const runs = [];   // [x0,z0,x1,z1, 内向きの法線 nx,nz]
  runs.push([-LIB.X + CD / 2, -LIB.Z, -LIB.X + CD / 2, LIB.Z, 1, 0], [LIB.X - CD / 2, -LIB.Z, LIB.X - CD / 2, LIB.Z, -1, 0], [-LIB.X, -LIB.Z + CD / 2, LIB.X, -LIB.Z + CD / 2, 0, 1], [-LIB.X, LIB.Z - CD / 2, LIB.X, LIB.Z - CD / 2, 0, -1]);
  const pal = [0x5b1f1a, 0x2f4a3a, 0x3a2a1a, 0x24304a, 0x6b4a22, 0x4a1e2e, 0x2a3a3a, 0x7a5a30, 0x3d2c4a, 0x1e2a22, 0x8a6a3a, 0x5a4a32];
  const books = []; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const [x0, z0, x1, z1, nx, nz] of runs) {
    const len = Math.hypot(x1 - x0, z1 - z0), ax = (x1 - x0) / len, az = (z1 - z0) / len, rotY = Math.atan2(nx, nz);
    const door = nz < 0;   // +z の壁（入口）：入口の上だけに棚
    const isGap = t => door && Math.abs(x0 + ax * t) < LIB.DOOR + .1;
    for (let r = 0; r <= SH; r++) {
      if (door) { for (const s of [-1, 1]) put("libwood", mats.darkWood, new THREE.BoxGeometry(LIB.X - LIB.DOOR, .05, CD), V(s * (LIB.X + LIB.DOOR) / 2, H0 + r * RW - .03, z0)); if (H0 + r * RW > LIB.DOORH + .1) put("libwood", mats.darkWood, new THREE.BoxGeometry(2 * LIB.DOOR, .05, CD), V(0, H0 + r * RW - .03, z0)); }
      else put("libwood", mats.darkWood, new THREE.BoxGeometry(len, .05, CD), V((x0 + x1) / 2, H0 + r * RW - .03, (z0 + z1) / 2), Math.abs(nx) ? Math.PI / 2 : 0);
    }
    for (let t = 0; t <= len; t += 1.6) if (!isGap(t)) put("libwood", mats.woodMat, new THREE.BoxGeometry(.08, SH * RW + .3, CD + .04), V(x0 + ax * t, (SH * RW + .3) / 2 + .05, z0 + az * t), rotY);
    for (let r = 0; r < SH; r++) {
      let t = .1;
      while (t < len - .1) {
        const w = .035 + rnd() * .055, h = .2 + rnd() * .3 * (RW - .1) / .5 * .55, gap = rnd() < .04 ? .25 : .004;
        if (rnd() < .025 || (isGap(t) && H0 + r * RW < LIB.DOORH + .1)) { t += .3; continue; }
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
    const x = s * (LIB.X - .9), z = -s * 2.6;
    put("libbrass", mats.brassMat, new THREE.BoxGeometry(.04, .04, 2 * LIB.Z - 1), V(s * (LIB.X - .5), 5.4, 0));
    for (const dz of [-.28, .28]) put("libwood", mats.woodMat, new THREE.BoxGeometry(.07, 5.6, .07), V(x + s * .05, 2.8, z + dz), 0, 0);
    for (let y = .4; y < 5.5; y += .4) put("libwood", mats.darkWood, new THREE.BoxGeometry(.05, .04, .56), V(x + s * .05, y, z));
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
  for (const [x, z] of [[-2, -4], [2, -4], [-2, 1.4], [2, 1.4], [0, 5]]) {
    const g = new THREE.Mesh(new THREE.SphereGeometry(.22, 16, 10), lampGlow); g.position.copy(V(x, 4.4, z)); world.add(g);
    put("libbrass", mats.brassMat, new THREE.CylinderGeometry(.01, .01, LIB.H - 4.6, 4), V(x, 4.5 + (LIB.H - 4.6) / 2, z));
  }
  // まん中の「百景の棚」：表紙を見せて二段に四冊ずつ。押すと、前まで行って本がひらく
  put("libwood", mats.woodMat, new THREE.BoxGeometry(DISP.w * 2 + .3, 2.5, DISP.d), V(0, 1.25, DISP.z - .05));
  put("libwood", mats.darkWood, new THREE.BoxGeometry(DISP.w * 2 + .5, .12, DISP.d + .2), V(0, 2.56, DISP.z - .05));
  const title = textPlane(3.2, .42, (g, w, h) => { g.fillStyle = "#2a1c10"; g.fillRect(0, 0, w, h); g.strokeStyle = "#c9a45c"; g.lineWidth = 6; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = "#e7cf93"; g.textAlign = "center"; g.textBaseline = "middle"; fit(g, `${NAMES.series}　${rooms.length}冊`, w * .9, `600 %px ${MINCHO}`, Math.round(h * .55)); g.fillText(`${NAMES.series}　${rooms.length}冊`, w / 2, h / 2); }, 1024);
  title.position.copy(V(0, 2.35, DISP.z + DISP.d / 2 - .03)); world.add(title);
  const featured = [];
  rooms.forEach((r, i) => {
    const row = i < 4 ? 0 : 1, c = i % 4, x = (c - 1.5) * 1.1, y = row ? .78 : 1.62;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.1, .04, .3), mats.brassMat); shelf.position.copy(V(x, y - .33, DISP.z + DISP.d / 2 + .1)); world.add(shelf);
    const cover = new THREE.Mesh(new THREE.BoxGeometry(.5, .66, .085), [mats.paperEdge, mats.paperEdge, mats.paperEdge, mats.paperEdge, new THREE.MeshStandardMaterial({ map: coverTex(THREE, { name: r.name, desc: r.desc, acc: r.acc, motif: r.slug }, NAMES, MINCHO, GOTH), roughness: .6, envMapIntensity: .4, emissive: 0xffffff, emissiveIntensity: .12 }), mats.paperEdge]);
    cover.material[4].emissiveMap = cover.material[4].map;
    cover.position.copy(V(x, y, DISP.z + DISP.d / 2 + .1)); cover.rotation.x = -.12; world.add(cover);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), mats.poolMat); pool.position.copy(V(x, y + .1, DISP.z + DISP.d / 2 + .02)); world.add(pool);
    cover.userData = { book: i }; clickables.push(cover);
    featured.push({ i, mesh: cover, base: cover.position.clone(), stand: new THREE.Vector3(x * .7, 0, DISP.z + 2.3), look: new THREE.Vector3(x, 0, DISP.z) });
  });
  // 右の小さな台：百景のほかの本（観天望気ほか）。表紙を部屋のまん中（−x）へ向ける
  const extra = (window.BOOKS || []);
  if (extra.length) {
    put("libwood", mats.woodMat, new THREE.BoxGeometry(DISP2.d, 1.0, DISP2.w * 2 + .3), V(DISP2.x, .5, DISP2.z));
    put("libwood", mats.darkWood, new THREE.BoxGeometry(DISP2.d + .2, .1, DISP2.w * 2 + .5), V(DISP2.x, 1.05, DISP2.z));
    const t2 = textPlane(1.4, .3, (g, w, h) => { g.fillStyle = "#2a1c10"; g.fillRect(0, 0, w, h); g.strokeStyle = "#c9a45c"; g.lineWidth = 6; g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = "#e7cf93"; g.textAlign = "center"; g.textBaseline = "middle"; fit(g, "百景のほかの本", w * .9, `600 %px ${MINCHO}`, Math.round(h * .55)); g.fillText("百景のほかの本", w / 2, h / 2); }, 1024);
    t2.position.copy(V(DISP2.x - DISP2.d / 2 - .02, .78, DISP2.z)); t2.rotation.y = -Math.PI / 2; world.add(t2);
    extra.forEach((b, k) => {
      const i = rooms.length + k, z = DISP2.z + (k - (extra.length - 1) / 2) * .62, y = 1.42;
      const mat = new THREE.MeshStandardMaterial({ map: coverTex(THREE, b, NAMES, MINCHO, GOTH), roughness: .6, envMapIntensity: .4, emissive: 0xffffff, emissiveIntensity: .12 }); mat.emissiveMap = mat.map;
      const cover = new THREE.Mesh(new THREE.BoxGeometry(.5, .66, .085), [mats.paperEdge, mats.paperEdge, mats.paperEdge, mats.paperEdge, mat, mats.paperEdge]);
      cover.position.copy(V(DISP2.x, y, z)); cover.rotation.set(0, -Math.PI / 2, 0); cover.rotateX(-.35); world.add(cover);
      cover.userData = { book: i }; clickables.push(cover);
      featured.push({ i, mesh: cover, base: cover.position.clone(), stand: new THREE.Vector3(DISP2.x - 2.0, 0, z), look: new THREE.Vector3(DISP2.x, 0, z), side: true });
    });
  }
  flush();
  // 読書の机（左の机）：ひらいた本を置いておく。本を手にとると、ここへ来て読む
  { const tx = TABLES[0][0], tz = TABLES[0][1], pm = new THREE.MeshStandardMaterial({ color: 0xf3ead6, roughness: .85 });
    for (const sx of [-1, 1]) { const pg = new THREE.Mesh(new THREE.PlaneGeometry(.42, .58), pm); pg.rotation.set(-Math.PI / 2, 0, 0); pg.rotation.y = sx * .06; pg.position.copy(V(tx + sx * .22, .83, tz)); world.add(pg); }
    put("libwood", mats.darkWood, new THREE.BoxGeometry(.9, .03, .62), V(tx, .81, tz)); }
  flush();
  const desk = { stand: new THREE.Vector3(TABLES[0][0] + 2.0, 0, TABLES[0][1]), look: new THREE.Vector3(TABLES[0][0], 0, TABLES[0][1]) };
  return { featured, desk, tick(dt, t, hoverI) { for (const f of featured) { if (f.side) continue; const want = f.i === hoverI ? .12 : 0; f.mesh.position.z += (f.base.z + want - f.mesh.position.z) * Math.min(1, dt * 8); } } };
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
// 表紙：布張り（織り目）・箔押しの二重枠と題・四隅の金具・帯（2026-10-07 本人「本の表紙・外装をより高級感のあるデザインに」）
function coverTex(THREE, r, N, MINCHO, GOTH) {
  const W = 512, H = 683, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  const base = shade(r.acc, .38);
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  // 布の織り目（縦糸と横糸）と、わずかな斑
  for (let y = 0; y < H; y += 2) { g.fillStyle = `rgba(255,255,255,${y % 4 ? .025 : .05})`; g.fillRect(0, y, W, 1); }
  for (let x = 0; x < W; x += 2) { g.fillStyle = `rgba(0,0,0,${x % 4 ? .03 : .06})`; g.fillRect(x, 0, 1, H); }
  const gr = g.createRadialGradient(W * .4, H * .35, 40, W / 2, H / 2, W * .9); gr.addColorStop(0, "rgba(255,255,255,.08)"); gr.addColorStop(1, "rgba(0,0,0,.35)"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // 背の溝（左）
  g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(30, 0, 6, H); g.fillStyle = "rgba(255,255,255,.06)"; g.fillRect(36, 0, 3, H);
  // 箔押し（金の二重枠と、角の唐草）
  const gold = g.createLinearGradient(0, 0, W, H); gold.addColorStop(0, "#f6e3a8"); gold.addColorStop(.45, "#c99a42"); gold.addColorStop(.55, "#f1d68f"); gold.addColorStop(1, "#a97a2c");
  g.strokeStyle = gold; g.lineWidth = 5; g.strokeRect(62, 30, W - 92, H - 60); g.lineWidth = 1.6; g.strokeRect(74, 42, W - 116, H - 84);
  for (const [x, y, sx, sy] of [[74, 42, 1, 1], [W - 42, 42, -1, 1], [74, H - 42, 1, -1], [W - 42, H - 42, -1, -1]]) {
    g.save(); g.translate(x, y); g.scale(sx, sy); g.lineWidth = 2; g.beginPath(); g.moveTo(0, 36); g.quadraticCurveTo(4, 4, 36, 0); g.moveTo(10, 30); g.quadraticCurveTo(14, 14, 30, 10); g.stroke(); g.restore();
  }
  // 題（箔押しの金・明朝）
  g.textAlign = "center"; g.textBaseline = "middle"; const cx = (W + 32) / 2;
  g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = 3; g.shadowOffsetY = 2;
  g.fillStyle = gold; { let z = 70; g.font = `600 ${z}px ${MINCHO}`; while (g.measureText(r.name).width > W - 150 && z > 28) { z -= 2; g.font = `600 ${z}px ${MINCHO}`; } } g.fillText(r.name, cx, 150);
  g.shadowBlur = 0; g.shadowOffsetY = 0;
  g.fillStyle = "#e8d6a8"; { let z = 22; g.font = `${z}px ${MINCHO}`; while (g.measureText(r.desc).width > W - 160 && z > 13) { z--; g.font = `${z}px ${MINCHO}`; } } g.fillText(r.desc, cx, 214);
  g.save(); g.translate(cx, 360); g.scale(1.25, 1.25); g.strokeStyle = gold; g.lineWidth = 3.2; g.lineCap = "round"; (MOTIF[r.motif] || MOTIF.tsuchi)(g); g.restore();
  // 帯（下）：生成り地に連作の名
  g.fillStyle = "#efe4c8"; g.fillRect(36, H - 170, W - 36, 96); g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(36, H - 170, W - 36, 3);
  g.fillStyle = shade(r.acc, .55); g.font = `600 26px ${MINCHO}`; g.fillText(["kanten", "ehon", "rakugo"].includes(r.motif) ? N.library : N.series, cx, H - 134);
  g.fillStyle = "#5a4a34"; g.font = `16px ${GOTH}`; g.fillText(`${N.museum}　${N.library} 蔵`, cx, H - 100);
  // 角の金具（四隅の三角）
  for (const [x, y, sx, sy] of [[W, 0, -1, 1], [W, H, -1, -1], [36, 0, 1, 1], [36, H, 1, -1]]) {
    g.save(); g.translate(x, y); g.scale(sx, sy); const m = g.createLinearGradient(0, 0, 40, 40); m.addColorStop(0, "#f2d892"); m.addColorStop(1, "#8a6424");
    g.fillStyle = m; g.beginPath(); g.moveTo(0, 0); g.lineTo(44, 0); g.lineTo(0, 44); g.closePath(); g.fill(); g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.arc(12, 12, 3, 0, 7); g.fill(); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------------------------------------------------------------- 本の読み手：見開き（左＝絵・図、右＝見出しと文）。2026-10-07 作り直し
//   本人（2026-10-07）：「本のレイアウトを見開きに：左ページに絵・図・グラフなど、右ページに文章。右ページは、見出し＝気の利いた一言、その下に説明。」
//   「碧が『いま開いているページ』を読むようにする（ページをめくると、そのページを読む）。」
//   見開きの中身と碧の読む文は data/museum.js の pages（_dev/pages.py）。狭い画面は、絵の下に文を重ねて一見開き＝一画面。
export function createReader({ rooms, T, NAMES, PAGES, openZoom, onSpread, onClose }) {
  const $ = id => document.getElementById(id);
  const st = { i: -1, sp: [], s: 0, busy: false, b: null, aloud: true };
  const BOOKS_ = bookList(rooms);
  const single = () => innerWidth < 760;
  const keiOf = (r, id) => r.kei.find(k => k.id === id);
  function leftHTML(S) {
    const b = st.b, r = b.r, L = S.L;
    if (L.t === "cover") return `<div class="cover lux" style="--acc:${b.acc}"><div class="kick" style="color:#f3e2b3">${esc(b.kind === "hyakkei" ? NAMES.series : NAMES.library)}</div><h1>${esc(b.name)}</h1><div class="orn"></div><p>${esc(b.desc)}</p><p style="font-size:15px;opacity:.8">${esc(NAMES.library)} 蔵</p></div>`;
    if (L.t === "blank") return `<div class="endp" aria-hidden="true"></div>`;
    if (L.t === "type") return `<div class="pin fig typo"><div class="big" style="--c:${b.acc}">${esc(L.text)}</div><div class="yomi">${esc(L.sub || "")}</div></div>`;
    if (L.t === "mark") { const it = b.groups[L.g].items[L.i]; return `<div class="pin fig typo"><div class="mk">${it.mark}</div><div class="big sm" style="--c:${b.acc}">${esc(it.text)}</div><div class="yomi">${esc(it.yomi)}</div><div class="yomi">${esc(it.region)}・${esc(it.lang)}　／　しるし：${esc(it.verdict)}</div></div>`; }
    const k = keiOf(r, L.k), w = k.works[L.wi];
    if (L.t === "quote") return `<div class="pin fig"><blockquote style="--c:${r.acc}">${esc(w.quote)}</blockquote><div class="cap">${credit(w)}</div></div>`;
    return `<div class="pin fig"><figure><img src="${esc(w.f)}" alt="${esc(w.title || "")}" data-zoom="${L.k}/${L.wi}"></figure><div class="cap">${credit(w)}</div></div>`;
  }
  function rightHTML(S, n) {
    const b = st.b, r = b.r, R = S.R, folio = `<div class="folio">${n + 1}</div>`;
    if (b.kind === "kanten") {
      if (R.t === "intro") return `<div class="pin"><div class="kick">はじめに</div><h2>${esc(b.name)}</h2><p>${esc(b.desc)}。いま目の前にある徴から、数時間から数日先の天気を読むことば。</p><p>${esc(b.note)}</p><h3>しるし</h3>${b.verdicts.map(v => `<p><b style="font-size:22px">${v.mark}</b>　${esc(v.v)}（${v.n} 景）── ${esc(v.def_)}</p>`).join("")}</div>${folio}`;
      if (R.t === "toc") return `<div class="pin"><div class="kick">目次 ── 見るところ</div><h2>見るところ</h2><ul class="toc">${b.groups.map((g, gi) => `<li><button data-go="${st.sp.findIndex(x => x.R.g === gi)}"><span>${g.no}</span><span>${esc(g.name)}</span><small>${g.items.length} 景</small></button></li>`).join("")}</ul></div>${folio}`;
      if (R.t === "kitem") { const g = b.groups[R.g], it = g.items[R.i]; return `<div class="pin"><div class="kick">${esc(g.name)}</div><h2>${esc(S.h)}</h2><p>${esc(it.meaning)}</p>${it.layers.map(([a, t]) => `<h3>${esc(a)}</h3><p>${esc(t)}</p>`).join("")}<h3>どこで確かめたか（典拠）</h3><p style="font-size:15px">${esc(it.src)}</p></div>${folio}`; }
      if (R.t === "colophon") return `<div class="pin"><div class="kick">奥付</div><h2>${esc(b.name)}</h2><p>${esc(NAMES.library)} 蔵。中身は mitsulab の作品のデータから、そのまま組みました。典拠は各頁に。</p></div>${folio}`;
    }
    if (R.t === "intro") return `<div class="pin"><div class="kick">はじめに</div><h2>${esc(r.name)}</h2><p>${esc(r.desc)}。</p><p>この本には、${r.kei.length} の景と、${r.n} 点の絵・写真・ことばが収めてあります。左の頁に絵、右の頁に文。めくると、${esc(NAMES.guide)}が読みます。</p></div>${folio}`;
    if (R.t === "toc") return `<div class="pin"><div class="kick">目次</div><h2>目次</h2><ul class="toc">${r.kei.map(k => { const j = st.sp.findIndex(x => x.R.t === "kei" && x.R.k === k.id); return `<li><button data-go="${j}"><span>${esc(k.no || "")}</span><span>${esc(k.name)}</span><small>${j + 1}</small></button></li>`; }).join("")}</ul></div>${folio}`;
    if (R.t === "colophon") return `<div class="pin"><div class="kick">奥付</div><h2>${esc(r.name)}</h2><p>${esc(NAMES.library)} 蔵。中身は mitsulab の連作《${esc(NAMES.series)}》のデータから組みました。図版は保護期間の満了した美術作品（各館のオープンアクセス・CC0／パブリックドメイン）と、Wikimedia Commons の CC の写真です。一点ごとの権利と元のページは、各頁の札にあります。CC BY-SA の写真は、この画面の中だけで使います。</p><p><a href="${esc(r.page)}" target="_blank" rel="noopener">${esc(NAMES.series)}で「${esc(r.name)}」をひらく</a></p></div>${folio}`;
    const k = keiOf(r, R.k);
    if (R.t === "kei") { const sub = S.h !== k.name ? `<p class="sub">${esc(k.no || "")}　${esc(k.name)}　<span class="yomi">${esc(k.yomi)}</span></p>` : `<div class="yomi">${esc(k.yomi)}　${esc(k.en || "")}</div>`;
      return `<div class="pin" style="--c:${r.acc}"><div class="kick">${esc(k.no || "")}</div><h2>${esc(S.h)}</h2>${sub}<p>${esc(k.lead)}</p>${k.invite ? `<h3>やってみる</h3><p>${esc(k.invite)}</p>` : ""}${k.snd ? `<h3>借りた録音</h3><p style="font-size:15px">${esc(k.snd.label)}（${esc(k.snd.where)}）。録音者・権利は${esc(NAMES.museum)}の札に。</p>` : ""}</div>${folio}`; }
    if (R.t === "layers") return `<div class="pin"><div class="kick">${esc(k.no || "")}　${esc(k.name)}　景のはなし</div><h2>${esc(S.h)}</h2>${k.layers.map(([a, t]) => `<h3>${esc(a)}</h3><p>${esc(t)}</p>`).join("")}</div>${folio}`;
    const w = k.works[R.wi];
    return `<div class="pin"><div class="kick">${esc(k.no || "")}　${esc(k.name)}</div><h2>${esc(S.h)}</h2>${w.note ? `<p>${esc(w.note)}</p>` : `<p>${esc(w.title || "")}</p>`}</div>${folio}`;
  }
  function wire(el) {
    el.querySelectorAll("[data-go]").forEach(x => x.onclick = () => jumpTo(+x.dataset.go));
    el.querySelectorAll("[data-zoom]").forEach(x => x.onclick = () => { const [kid, wi] = x.dataset.zoom.split("/"); const w = keiOf(st.b.r, kid)?.works[+wi]; if (w) openZoom(w); });
  }
  function fillL(el, s) { el.innerHTML = s == null ? "" : leftHTML(st.sp[s]); wire(el); }
  function fillR(el, s) { el.innerHTML = s == null ? "" : (single() ? `<div class="stack">${leftHTML(st.sp[s])}${rightHTML(st.sp[s], s)}</div>` : rightHTML(st.sp[s], s)); wire(el); }
  function render(speak = true) {
    $("spread").classList.toggle("single", single());
    fillL($("pgL"), st.s); fillR($("pgR"), st.s);
    const tot = st.sp.length;
    $("rdPos").textContent = `${st.s + 1} / ${tot}`;
    $("rdPrev").disabled = st.s <= 0; $("rdNext").disabled = st.s >= tot - 1;
    $("curlPrev").hidden = st.s <= 0; $("curlNext").hidden = st.s >= tot - 1;
    $("rdAoi").textContent = st.aloud ? `${NAMES.guide}が読む：オン` : `${NAMES.guide}が読む：オフ`; $("rdAoi").setAttribute("aria-pressed", String(st.aloud));
    const nx = st.sp[st.s + 1]; if (nx?.L.wi != null && st.b.r) { const w = keiOf(st.b.r, nx.L.k)?.works[nx.L.wi]; if (w?.f) { const im = new Image(); im.src = w.f; } }
    if (speak && st.aloud) onSpread?.(st.sp[st.s].say, st.sp[st.s]);
  }
  function turn(dir) {
    const ns = st.s + dir; if (ns < 0 || ns >= st.sp.length || st.busy) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || document.body.dataset.rm === "1";
    if (reduce || single()) { st.s = ns; render(); $("pgR").querySelector(".pin")?.scrollTo?.(0, 0); return; }
    st.busy = true;
    const sp = $("spread"), leaf = document.createElement("div"); leaf.className = "leaf";
    const front = document.createElement("div"), back = document.createElement("div");
    front.className = "pg " + (dir > 0 ? "r" : "l"); back.className = "pg bk " + (dir > 0 ? "l" : "r");
    if (dir > 0) { front.innerHTML = rightHTML(st.sp[st.s], st.s); back.innerHTML = leftHTML(st.sp[ns]); leaf.style.left = "50%"; leaf.style.transformOrigin = "left center"; fillR($("pgR"), ns); }
    else { front.innerHTML = leftHTML(st.sp[st.s]); back.innerHTML = rightHTML(st.sp[ns], ns); leaf.style.left = "0"; leaf.style.transformOrigin = "right center"; fillL($("pgL"), ns); }
    leaf.append(front, back); sp.appendChild(leaf);
    requestAnimationFrame(() => requestAnimationFrame(() => { leaf.style.transform = dir > 0 ? "rotateY(-180deg)" : "rotateY(180deg)"; }));
    const end = () => { leaf.remove(); st.s = ns; render(); st.busy = false; };
    leaf.addEventListener("transitionend", end, { once: true }); setTimeout(() => { if (st.busy) end(); }, 1100);
  }
  function jumpTo(s) { if (s < 0) return; st.s = s; render(); }
  function open(i) {
    st.i = i; st.b = BOOKS_[i]; st.sp = PAGES[st.b.id] || []; st.s = 0;
    $("rdTitle").textContent = `${st.b.name}　─　${NAMES.library}`;
    $("reader").hidden = false; document.body.classList.add("reading"); render(); $("rdNext").focus({ preventScroll: true });
  }
  function close() { $("reader").hidden = true; document.body.classList.remove("reading"); st.i = -1; onClose?.(); }
  $("rdPrev").onclick = () => turn(-1); $("rdNext").onclick = () => turn(1); $("rdClose").onclick = close;
  $("rdToc").onclick = () => { const n = st.sp.findIndex(p => p.R.t === "toc"); jumpTo(n < 0 ? 0 : n); };
  $("rdAoi").onclick = () => { st.aloud = !st.aloud; render(st.aloud); if (!st.aloud) onSpread?.(null); };
  // 頁の角：押すとめくる。つまんで引くと、引いたぶんだけめくれて、離すと最後までめくる
  for (const [id, dir] of [["curlNext", 1], ["curlPrev", -1]]) {
    const el = $(id); let x0 = null;
    el.addEventListener("pointerdown", e => { e.stopPropagation(); x0 = e.clientX; el.classList.add("drag"); el.setPointerCapture(e.pointerId); });
    el.addEventListener("pointermove", e => { if (x0 == null) return; const k = Math.min(1.8, 1 + Math.abs(e.clientX - x0) / 120); el.querySelector("i").style.transform = `scale(${k})`; });
    el.addEventListener("pointerup", e => { e.stopPropagation(); x0 = null; el.classList.remove("drag"); el.querySelector("i").style.transform = ""; turn(dir); });
  }
  // 指でめくる
  let sx = null;
  $("book").addEventListener("pointerdown", e => { if (e.target.closest("button,a,img")) return; sx = e.clientX; });
  $("book").addEventListener("pointerup", e => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 50) turn(dx < 0 ? 1 : -1); });
  addEventListener("resize", () => { if (st.i >= 0) render(false); });
  return { open, close, goto: jumpTo, get isOpen() { return st.i >= 0; }, key(e) { if (st.i < 0) return false; if (e.key === "ArrowRight" || e.key === "PageDown") turn(1); else if (e.key === "ArrowLeft" || e.key === "PageUp") turn(-1); else if (e.key === "Escape") close(); else return false; e.preventDefault(); return true; }, state: st, turn };
}
