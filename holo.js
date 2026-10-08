/* 館の 3D 模型と、空中に浮く 3D の表示（2026-10-09）。
   本人（2026-10-09）：「部屋に入ったときのグラフィックを、3D 空間に重なる 3D デザインに（平面の札ではなく、空中に浮く立体の表示）。
   広間の中央に博物館の 3D 模型を置き、触れると、館の 3D 模型と部屋の名前・ジャンルの名前が出て、それを押すと移動できる。
   広間だけでなく、どこからでも画面上で 3D 地図を開ける（ボタン一つ）。」
   - 模型は略図：部屋はどれも同じ長さ（LM m）の帯にし、区画（鳥・けもの…）を色の段で見せる（館内の地図と同じ考え方）。
   - 三つの使い方：①広間のまん中の台の上の模型（world）②どこからでも開く 3D 地図（カメラの前に浮かぶ）③部屋に入ったときの、その部屋の立体の札と区画の帯。
   - 押せるもの：部屋（一度目で区画の名が出る・二度目でその部屋へ）・区画（そこへ歩く）・書架の間・広間。 */

const LM = 21;   // 略図の部屋の長さ（m）

export function createHolo(o) {
  const { THREE, scene, camera, rooms, ENT, LIB_FACE, NF, faceTh, HA, R, HALF, DOOR, VEST, LIB, libWorld, NAMES, GOTH, MINCHO } = o;
  const RR = R / Math.cos(HA);
  const WF = (f, u, v) => new THREE.Vector3(f.d.x * (R + u) + f.p.x * v, 0, f.d.y * (R + u) + f.p.y * v);
  const pickables = [];

  // ---------------------------------------------------------------- 部品
  function prism(cs, h, col, op, y0 = 0) {   // 床の多角形（world の xz）を、高さ h の立体に
    const s = new THREE.Shape(); cs.forEach((p, k) => k ? s.lineTo(p.x, -p.z) : s.moveTo(p.x, -p.z)); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .55, roughness: .4, metalness: .1, transparent: true, opacity: op, depthWrite: op > .9 }));
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), new THREE.LineBasicMaterial({ color: 0xf3d99a, transparent: true, opacity: .85 }));
    m.add(e); return m;
  }
  function label(text, sub, wM, opt = {}) {   // いつも見る人を向く札（スプライト）
    const px = 512, c = document.createElement("canvas"), g = c.getContext("2d");
    const big = Math.round(px * (opt.size || .2)), small = Math.round(big * .55);
    g.font = `700 ${big}px ${opt.mincho ? MINCHO : GOTH}`; const tw = Math.max(g.measureText(text).width, sub ? (g.font = `${small}px ${GOTH}`, g.measureText(sub).width) : 0);
    c.width = Math.ceil(tw + big * 1.1); c.height = Math.ceil(big * (sub ? 2.15 : 1.5));
    const r = c.height / 2.6;
    g.fillStyle = opt.bg || "rgba(18,12,6,.86)"; g.beginPath(); g.roundRect(2, 2, c.width - 4, c.height - 4, r); g.fill();
    g.strokeStyle = opt.edge || "#d9b45e"; g.lineWidth = Math.max(3, big * .08); g.stroke();
    g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = opt.fg || "#fff8e6";
    g.font = `700 ${big}px ${opt.mincho ? MINCHO : GOTH}`; g.fillText(text, c.width / 2, sub ? c.height * .37 : c.height / 2);
    if (sub) { g.font = `${small}px ${GOTH}`; g.fillStyle = "#e7d6ad"; g.fillText(sub, c.width / 2, c.height * .74); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    sp.scale.set(wM, wM * c.height / c.width, 1); sp.renderOrder = 30; return sp;
  }

  // ---------------------------------------------------------------- 模型（world の寸法・略図）。opt.labels＝部屋の名、opt.zonesFor＝区画の名を出す部屋の番号
  function buildModel(opt = {}) {
    const g = new THREE.Group(), H = 2.4;
    const lob = []; for (let k = 0; k < NF; k++) { const a = faceTh(k) + HA; lob.push(new THREE.Vector3(Math.sin(a) * RR, 0, -Math.cos(a) * RR)); }
    const hub = prism(lob, H * 1.25, 0xd8c7a4, .9); hub.userData.holo = { t: "hub" }; g.add(hub); pickables.push(hub);
    // 丸屋根（小さな半球）
    const dome = new THREE.Mesh(new THREE.SphereGeometry(RR * .92, 22, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5f8a78, emissive: 0x2a4a3e, emissiveIntensity: .5, transparent: true, opacity: .55, depthWrite: false }));
    dome.scale.y = .35; dome.position.y = H * 1.25; g.add(dome);
    const ent = prism([WF(ENT, -.2, -DOOR - .4), WF(ENT, VEST, -DOOR - .4), WF(ENT, VEST, DOOR + .4), WF(ENT, -.2, DOOR + .4)], H, 0xb9a888, .85); ent.userData.holo = { t: "hub" }; g.add(ent); pickables.push(ent);
    const libc = [[-LIB.X, -LIB.Z], [LIB.X, -LIB.Z], [LIB.X, LIB.Z + .5], [-LIB.X, LIB.Z + .5]].map(([x, z]) => libWorld(new THREE.Vector3(x, 0, z)));
    const lib = prism(libc, H, 0x7a5532, .92); lib.userData.holo = { t: "lib" }; g.add(lib); pickables.push(lib);
    const parts = { g, rooms: [], lib, hub };
    for (const r of rooms) {
      const KU = LM / r.L, base = prism([WF(r, -.2, -HALF), WF(r, LM, -HALF), WF(r, LM, HALF), WF(r, -.2, HALF)], H * .25, new THREE.Color(r.acc).getHex(), .5);
      base.userData.holo = { t: "room", i: r.i }; g.add(base); pickables.push(base);
      const zs = r.zones?.length ? r.zones : [{ name: r.name, u0: 0, u1: r.L, col: r.acc }];
      const segs = zs.map((z, zi) => {
        const u0 = Math.max(0, (z.u0 ?? 0) * KU), u1 = Math.min(LM, (z.u1 ?? r.L) * KU);
        const m = prism([WF(r, u0 + .15, -HALF + .4), WF(r, u1 - .15, -HALF + .4), WF(r, u1 - .15, HALF - .4), WF(r, u0 + .15, HALF - .4)], H * (.55 + .25 * (zi % 2)), new THREE.Color(z.col || r.acc).getHex(), .82, H * .25);
        m.userData.holo = zs === r.zones ? { t: "zone", i: r.i, zi } : { t: "room", i: r.i }; g.add(m); pickables.push(m); return m;
      });
      let lab = null;
      if (opt.labels) { lab = label(r.name, null, opt.labelW || 9, { size: .2, edge: r.acc }); lab.position.copy(WF(r, LM + 1.5, 0)).setY(H * 2.2); lab.userData.holo = { t: "room", i: r.i }; g.add(lab); pickables.push(lab); }
      const zl = (r.zones || []).map((z, zi) => { const l = label(z.name, `${z.ids.length} 景`, opt.zoneW || 5.2, { size: .18, edge: z.col || r.acc }); const u = ((z.u0 + z.u1) / 2) * KU; l.position.copy(WF(r, u, 0)).setY(H * 1.9); l.visible = false; l.userData.holo = { t: "zone", i: r.i, zi }; g.add(l); pickables.push(l); return l; });
      parts.rooms.push({ base, segs, lab, zl });
    }
    if (opt.labels) {
      const lh = label(NAMES.hub, null, (opt.labelW || 9) * .8, { size: .2 }); lh.position.set(0, H * 3.2, -RR * .55); lh.userData.holo = { t: "hub" }; g.add(lh); pickables.push(lh);
      const ll = label(NAMES.library, null, (opt.labelW || 9) * .8, { size: .2, edge: "#c9a45c" }); ll.position.copy(libWorld(new THREE.Vector3(0, 0, 0))).setY(H * 2.2); ll.userData.holo = { t: "lib" }; g.add(ll); pickables.push(ll);
    }
    return parts;
  }
  const mapPt = (x, z, region, local) => { const reg = region(x, z); if (reg.kind === "room") { const l = local(x, z), r = rooms[l.i]; return WF(r, l.u * LM / r.L, l.v); } return new THREE.Vector3(x, 0, z); };

  // ---------------------------------------------------------------- ①広間のまん中の台と模型
  const SC_P = 1 / 50;
  const ped = new THREE.Group(); ped.position.set(0, 0, -1.9); scene.add(ped);
  { const stoneM = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: .45 });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(.62, .72, .86, 22), stoneM); col.position.y = .43; ped.add(col);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, .06, 28), new THREE.MeshStandardMaterial({ color: 0x3a2516, roughness: .5 })); top.position.y = .89; ped.add(top);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.8, .025, 6, 40), new THREE.MeshStandardMaterial({ color: 0xc9a45c, metalness: .8, roughness: .3 })); ring.rotation.x = Math.PI / 2; ring.position.y = .92; ped.add(ring);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1.25, 32), new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: .14, depthWrite: false, toneMapped: false })); glow.rotation.x = -Math.PI / 2; glow.position.y = .01; ped.add(glow);
    col.userData.holo = top.userData.holo = { t: "open" }; pickables.push(col, top); }
  const pm = buildModel({ labels: true, labelW: 11 }); pm.g.scale.setScalar(SC_P); pm.g.position.y = .95; ped.add(pm.g);
  pm.g.traverse(m => { if (m.userData.holo) m.userData.holo = { t: "open" }; });   // 台の模型は、押すと 3D 地図がひらく
  pm.g.traverse(m => { if (m.material) m.material.depthTest = true; });   // 台の模型の札は、壁の向こうから透けて見えないように
  const pedHint = label("押すと、3D の地図", null, 1.1, { size: .2, bg: "rgba(18,12,6,.7)" }); pedHint.material.depthTest = true; pedHint.position.set(0, 1.95, 0); pedHint.userData.holo = { t: "open" }; ped.add(pedHint); pickables.push(pedHint);

  // ---------------------------------------------------------------- ②どこからでも開く 3D 地図（カメラの前に浮かぶ）
  if (!camera.parent) scene.add(camera);
  const holo = new THREE.Group(); holo.visible = false; camera.add(holo);
  const hm = buildModel({ labels: true, labelW: 13, zoneW: 8.5 }); holo.add(hm.g);
  { const back = new THREE.Mesh(new THREE.CircleGeometry(R + LM + 6, 48), new THREE.MeshBasicMaterial({ color: 0x120c06, transparent: true, opacity: .72, depthTest: false, depthWrite: false, toneMapped: false }));
    back.rotation.x = -Math.PI / 2; back.position.y = -.3; back.renderOrder = 10; back.userData.bg = true; hm.g.add(back);
    const rim = new THREE.Mesh(new THREE.RingGeometry(R + LM + 5.4, R + LM + 6, 64), new THREE.MeshBasicMaterial({ color: 0xd9b45e, transparent: true, opacity: .9, depthTest: false, toneMapped: false, side: THREE.DoubleSide }));
    rim.rotation.x = -Math.PI / 2; rim.position.y = -.25; rim.renderOrder = 11; rim.userData.bg = true; hm.g.add(rim); }
  hm.g.rotation.x = .9;
  const meMk = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3, 10), new THREE.MeshBasicMaterial({ color: 0xff4d3a, depthTest: false, toneMapped: false })); meMk.renderOrder = 31;
  const meG = new THREE.Group(); meMk.rotation.x = -Math.PI / 2; meG.add(meMk); hm.g.add(meG);
  const meLab = label("いまここ", null, 6, { size: .2, bg: "#ff4d3a", edge: "#fff" }); hm.g.add(meLab);
  const aoiMk = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 8), new THREE.MeshBasicMaterial({ color: 0x4fd1c1, depthTest: false, toneMapped: false })); aoiMk.renderOrder = 31; hm.g.add(aoiMk);
  hm.g.traverse(m => { if (m.material) { m.material.depthTest = false; m.material.depthWrite = false; if (!m.userData.bg) m.renderOrder = Math.max(m.renderOrder || 0, 20); } });
  let focus = -1, openT = 0;
  function layoutHolo() {
    const asp = camera.aspect, d = 1.5, halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d * asp, rad = Math.min(.62, halfW * (asp < .8 ? .8 : .92));
    hm.g.scale.setScalar(rad / (R + LM + 6)); holo.position.set(0, asp < .8 ? -.05 : -.12, -d);
  }
  function setFocus(i) {
    focus = i;
    hm.rooms.forEach((R_, k) => { for (const l of R_.zl) l.visible = k === i; if (R_.lab) R_.lab.material.opacity = i < 0 || k === i ? 1 : .55; for (const s of R_.segs) s.material.opacity = i < 0 || k === i ? .82 : .35; });
  }
  function open() { layoutHolo(); setFocus(-1); holo.visible = true; pedHint.visible = false; pm.g.visible = false; openT = 0; holo.scale.setScalar(.6); o.onOpen?.(); }
  function close() { holo.visible = false; pedHint.visible = true; pm.g.visible = true; setFocus(-1); o.onClose?.(); }

  // ---------------------------------------------------------------- ③部屋に入ったときの立体の札と区画の帯
  const card = new THREE.Group(); card.visible = false; camera.add(card);
  let cardT = 0, cardPos = null, cardRoom = -1;
  function showRoom(i, me) {
    for (const c of [...card.children]) { card.remove(c); c.traverse(m => { m.geometry?.dispose(); m.material?.map?.dispose(); m.material?.dispose?.(); const k = pickables.indexOf(m); if (k >= 0) pickables.splice(k, 1); }); }
    const r = rooms[i]; cardRoom = i;
    const W_ = Math.min(.9, Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.7 * camera.aspect * 1.7);
    // 題：厚みのある額（金の縁の箱）に、部屋の名と説明
    const tc = document.createElement("canvas"); tc.width = 1024; tc.height = 300; const g = tc.getContext("2d");
    g.fillStyle = "rgba(20,14,8,.82)"; g.fillRect(0, 0, 1024, 300);
    g.textAlign = "center"; g.fillStyle = "#e7cf93"; g.font = `26px ${GOTH}`; g.fillText(`第${"一二三四五六七八九十"[i] || i + 1}室`, 512, 52);
    g.fillStyle = "#fff8e6"; g.font = `600 110px ${MINCHO}`; g.fillText(r.name, 512, 170);
    g.fillStyle = "#e7d6ad"; g.font = `34px ${GOTH}`; g.fillText(r.desc, 512, 238);
    g.fillStyle = r.acc; g.fillRect(452, 268, 120, 7);
    const tt = new THREE.CanvasTexture(tc); tt.colorSpace = THREE.SRGBColorSpace;
    const tw = W_, th = W_ * 300 / 1024;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(tw, th), new THREE.MeshBasicMaterial({ map: tt, transparent: true, depthTest: false, toneMapped: false })); face.position.z = .012; face.renderOrder = 40;
    const box = new THREE.Mesh(new THREE.BoxGeometry(tw + .03, th + .03, .02), new THREE.MeshStandardMaterial({ color: 0xc9a45c, metalness: .8, roughness: .3, emissive: 0x3a2a10, transparent: true, depthTest: false })); box.renderOrder = 39;
    const title = new THREE.Group(); title.add(box, face); title.position.y = th * .9; card.add(title);
    // 区画の帯：立体の段（色・景の数で長さ）と名札。押すとそこへ歩く
    const zs = r.zones?.length ? r.zones : null;
    if (zs) {
      const tot = zs.reduce((a, z) => a + z.ids.length, 0); let x = -tw / 2;
      zs.forEach((z, zi) => {
        const w = tw * z.ids.length / tot, hgt = .03 + .012 * (zi % 2);
        const seg = new THREE.Mesh(new THREE.BoxGeometry(w - .006, hgt, .05), new THREE.MeshStandardMaterial({ color: z.col || r.acc, emissive: z.col || r.acc, emissiveIntensity: .6, transparent: true, opacity: .92, depthTest: false }));
        seg.position.set(x + w / 2, -th * .05, 0); seg.renderOrder = 41; seg.userData.holo = { t: "zone", i, zi }; card.add(seg); pickables.push(seg);
        const l = label(z.name, `${z.ids.length} 景`, Math.min(.2, Math.max(.11, w * .95)), { size: .2, edge: z.col || r.acc }); l.position.set(x + w / 2, -th * .05 - .075 - (zi % 2) * .07, 0); l.renderOrder = 42; l.userData.holo = { t: "zone", i, zi }; card.add(l); pickables.push(l);
        x += w;
      });
      const hint = label("区画を押すと、そこへ歩きます", null, Math.min(.42, tw * .6), { size: .16, bg: "rgba(18,12,6,.6)" }); hint.position.set(0, -th * .05 - .24, 0); card.add(hint);
    }
    card.position.set(0, camera.aspect < .8 ? .12 : .05, -1.7); card.visible = true; cardT = 0; cardPos = me.clone();
  }
  function hideRoom() { card.visible = false; cardRoom = -1; }

  // ---------------------------------------------------------------- 毎こま
  function tick(dt, me, yaw, region, local, aoiPos, t) {
    pm.g.rotation.y = t * .08;   // 台の模型はゆっくり回る
    pedHint.position.y = 1.95 + Math.sin(t * 1.6) * .03;
    if (holo.visible) {
      openT += dt; const k = Math.min(1, openT / .35); holo.scale.setScalar(.6 + .4 * (1 - (1 - k) ** 3));
      const q = mapPt(me.x, me.z, region, local); meG.position.set(q.x, 4.2, q.z); meG.rotation.y = yaw + Math.PI; meLab.position.set(q.x, 9, q.z);
      if (aoiPos) { const a = mapPt(aoiPos.x, aoiPos.z, region, local); aoiMk.visible = true; aoiMk.position.set(a.x, 4, a.z); } else aoiMk.visible = false;
    }
    if (card.visible) {
      cardT += dt; const k = Math.min(1, cardT / .5), s = .7 + .3 * (1 - (1 - k) ** 3);
      card.scale.setScalar(s); card.position.y = (camera.aspect < .8 ? .12 : .05) + Math.sin(t * 1.3) * .006;
      const away = cardPos && Math.hypot(me.x - cardPos.x, me.z - cardPos.z) > 3.2;
      if (cardT > 11 || away) { const f = Math.max(0, 1 - (cardT > 11 ? (cardT - 11) / .6 : 1)); card.traverse(m => { if (m.material) m.material.opacity = Math.min(m.material.opacity, f); }); if (f <= 0 || away) hideRoom(); }
    }
  }
  // 押されたもの：{ t: "open" | "hub" | "lib" | "room" | "zone", i, zi }
  function hit(ray) {
    const vis = pickables.filter(m => { let p = m; while (p) { if (!p.visible) return false; p = p.parent; } return true; });
    const order = [...vis.filter(m => m.isSprite), ...vis.filter(m => !m.isSprite)];
    const hs = ray.intersectObjects(order, false); if (!hs.length) return null;
    const sp = hs.find(h => h.object.isSprite && (holo.visible || card.visible ? isHolo(h.object) : true));
    const h0 = sp || hs[0]; let m = h0.object; while (m && !m.userData.holo) m = m.parent;
    return m ? { ...m.userData.holo, dist: h0.distance, holo: isHolo(h0.object) } : null;
  }
  const isHolo = m => { while (m) { if (m === holo || m === card) return true; m = m.parent; } return false; };
  return { open, close, showRoom, hideRoom, tick, hit, setFocus, get open_() { return holo.visible; }, get focus() { return focus; }, get cardRoom() { return cardRoom; }, ped, layoutHolo };
}
