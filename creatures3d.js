/* 絵から抜け出た生きものの立体（2026-10-09）。
   本人（2026-10-09）：「鯉など、3D をしっかり作り込んでください。他も同様。」
   切り抜き（平らな写し）は絵から出る一瞬と、絵へもどる一瞬だけ。外にいるあいだは、この立体の生きものになる。
   色は、その絵の切り抜きから取った色（暗・中・明・差し色）で塗り、筆の跡（短いストロークの重なり）を質感にする。

   形の数と比率（一般的な図鑑・教科書の範囲。種ごとの細かい計測値は使わない）：
   - 鯉（コイ）：体は紡錘形で左右に平たい。鱗は大きな円鱗で、側線に沿っておよそ 35 枚前後。ひれは 背びれ 1（長い。前に硬い棘）・胸びれ 2・腹びれ 2・しりびれ 1・尾びれ 1（二叉）。
                ひげは 2 対（上あごの短い 1 対と、口角の長い 1 対）。泳ぎは体の後ろ半分と尾びれのうねり。
   - スズメ・ツバメ・ウグイス（スズメ目）：初列風切は 10 枚（いちばん外の 1 枚は小さい）、次列風切は 9 枚前後、尾羽は 12 枚。足指は前 3・後 1。
       スズメ＝頭は栗色、頬に黒い斑、のどが黒い／ツバメ＝背は青黒、額とのどが赤茶、尾は深い燕尾（外側の尾羽が長い）／ウグイス＝背は褐色がかった緑、白っぽい眉。
   - ガン（マガン）：初列風切 10 枚、尾羽 16 枚前後、くちばしは平たい。足は水かき。額が白い（マガン）。
   - サギ（ダイサギ）：首は長く S 字に曲がる、脚は長い、くちばしは長くまっすぐ（ダイサギの非繁殖期は黄色）。尾羽 12 枚。
   - 蝶：翅は 4 枚（前翅 2・後翅 2）、脚 6 本、触角 2 本（先がふくらむ）。
   - 蜻蛉（トンボ）：翅は 4 枚（翅脈が網目、前縁に縁紋）、腹は 10 節、大きな複眼、脚 6 本。
   - 野うさぎ：耳が長く先が黒い、後脚が長い、尾は短い。
*/

const TAU = Math.PI * 2;

export function createCreatures(THREE) {
  // ---------------------------------------------------------------- 色（切り抜きから）
  function palette(img) {
    const def = { dark: new THREE.Color(0x2b2420), mid: new THREE.Color(0x7a6a58), light: new THREE.Color(0xe8dfcc), accent: new THREE.Color(0x9a5a3a) };
    try {
      const c = document.createElement("canvas"), N = 48; c.width = c.height = N; const g = c.getContext("2d"); g.drawImage(img, 0, 0, N, N);
      const d = g.getImageData(0, 0, N, N).data, px = [];
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 150) { const col = new THREE.Color(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255); const hsl = {}; col.getHSL(hsl); px.push({ col, l: hsl.l, s: hsl.s }); }
      if (px.length < 20) return def;
      px.sort((a, b) => a.l - b.l); const q = f => px[Math.min(px.length - 1, Math.floor(px.length * f))].col.clone();
      const sat = [...px].sort((a, b) => b.s - a.s)[Math.floor(px.length * .05)];
      const pal = { dark: q(.06), mid: q(.35), light: q(.7), accent: sat && sat.s > .25 ? sat.col.clone() : q(.5), img };
      for (const k of ["dark", "mid", "light", "accent"]) { const h = {}; pal[k].getHSL(h); pal[k].setHSL(h.h, Math.min(1, h.s * 1.15), h.l * (k === "light" ? .92 : .85)); }
      return pal;
    } catch { return def; }
  }
  const css = c => "#" + c.getHexString();
  // 筆の跡の質感：地の色に、短いストロークを重ねる
  function brushTex(base, cols, opt = {}) {
    const S = opt.size || 256, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d");
    g.fillStyle = css(base); g.fillRect(0, 0, S, S);
    if (opt.img) { try { g.globalAlpha = opt.imgA ?? .8; g.drawImage(opt.img, 0, 0, S, S); g.drawImage(opt.img, S, 0, -S, S); g.globalAlpha = 1; } catch {} }   // 絵の切り抜きそのものの色と筆の跡
    let seed = opt.seed || 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < (opt.n || 260); i++) {
      const col = cols[Math.floor(rnd() * cols.length)]; g.strokeStyle = css(col); g.globalAlpha = .08 + rnd() * .16; g.lineWidth = 1 + rnd() * (opt.w || 4); g.lineCap = "round";
      const x = rnd() * S, y = rnd() * S, a = (opt.dir ?? rnd() * TAU) + (rnd() - .5) * .6, L = 6 + rnd() * (opt.len || 22);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
    }
    g.globalAlpha = 1; opt.draw?.(g, S, rnd);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  const mat = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: o.r ?? .8, metalness: 0, envMapIntensity: .3, transparent: true, opacity: 1, side: o.side ?? THREE.FrontSide, color: o.color ?? 0x8c8c8c, alphaTest: o.alphaTest ?? 0 });   // 館の光は明るいので、絵の色が白く飛ばないよう少し沈める
  const plain = (col, o = {}) => new THREE.MeshStandardMaterial({ color: col, roughness: o.r ?? .6, metalness: o.m ?? 0, envMapIntensity: .3, transparent: true, opacity: 1, side: o.side ?? THREE.FrontSide });

  // ---------------------------------------------------------------- 体（前＝+z）：断面の楕円を前後に並べる。w(t)・h(t)・y(t) は t＝0（尾）〜1（頭）
  function body(n, m, w, h, yOff = () => 0, L = 1) {
    const pos = [], uv = [], tA = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, z = (t - .5) * L, rx = w(t), ry = h(t), y0 = yOff(t);
      for (let j = 0; j <= m; j++) { const a = j / m * TAU; pos.push(Math.sin(a) * rx, y0 + Math.cos(a) * ry, z); uv.push(j / m, t); tA.push(t); }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = i * (m + 1) + j, b = a + m + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute("aT", new THREE.Float32BufferAttribute(tA, 1));
    g.setIndex(idx); g.computeVertexNormals(); g.userData.base = Float32Array.from(pos); return g;
  }
  // 羽一枚（羽軸と羽弁）の絵
  function featherTex(pal, opt = {}) {
    const c = document.createElement("canvas"); c.width = 64; c.height = 256; const g = c.getContext("2d");
    const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, css(opt.tip || pal.dark)); grd.addColorStop(.55, css(opt.base || pal.mid)); grd.addColorStop(1, css(opt.root || pal.mid));
    g.fillStyle = grd; g.beginPath(); g.moveTo(32, 2); g.quadraticCurveTo(62, 40, 56, 250); g.lineTo(8, 250); g.quadraticCurveTo(2, 40, 32, 2); g.fill();
    g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 2; g.beginPath(); g.moveTo(32, 4); g.lineTo(31, 252); g.stroke();   // 羽軸
    g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = 1; for (let y = 14; y < 250; y += 7) { g.beginPath(); g.moveTo(31, y); g.lineTo(6, y + 14); g.moveTo(33, y); g.lineTo(58, y + 14); g.stroke(); }   // 羽枝
    if (opt.edge) { g.strokeStyle = css(opt.edge); g.globalAlpha = .55; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 3); g.quadraticCurveTo(61, 40, 55, 250); g.stroke(); g.globalAlpha = 1; }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function feather(tex, len, wid) {
    const g = new THREE.PlaneGeometry(wid, len); g.translate(0, len / 2, 0); g.rotateX(-Math.PI / 2);   // 根もと＝原点、先＝-z（後ろ）方向に寝かせる
    return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, color: 0x8c8c8c, transparent: true, alphaTest: .3, side: THREE.DoubleSide, roughness: .85, envMapIntensity: .3 }));
  }

  // ---------------------------------------------------------------- 鳥（スズメ目・ガン・サギ）
  function bird(pal, sp) {
    const G = new THREE.Group(), parts = { wings: [], tail: null, G };
    const P = {   // 体の比率（体長＝1）
      sparrow: { bw: .15, bh: .15, head: .13, beak: .055, beakW: .028, neck: 0, leg: .12, tail: .34, tailFork: 0, wing: .55, nT: 12, color: pal },
      swallow: { bw: .12, bh: .11, head: .1, beak: .03, beakW: .03, neck: 0, leg: .06, tail: .5, tailFork: .55, wing: .78, nT: 12 },
      warbler: { bw: .13, bh: .13, head: .11, beak: .05, beakW: .018, neck: 0, leg: .14, tail: .38, tailFork: 0, wing: .5, nT: 12 },
      goose:   { bw: .16, bh: .15, head: .07, beak: .1, beakW: .035, neck: .3, leg: .14, tail: .14, tailFork: 0, wing: .85, nT: 16 },
      heron:   { bw: .09, bh: .1, head: .045, beak: .2, beakW: .018, neck: .55, leg: .55, tail: .12, tailFork: 0, wing: .8, nT: 12 },
    }[sp] || {};
    const isEgret = sp === "heron";
    const base = isEgret ? new THREE.Color(0xf4f1e8).lerp(pal.light, .25) : pal.mid, back = isEgret ? base : pal.dark.clone().lerp(pal.mid, .45), belly = isEgret ? base : pal.light;
    // 胴：背は濃く、腹は明るく（テクスチャの上下で塗り分け）
    const bodyTex = brushTex(back, [pal.dark, pal.mid, pal.light], { img: isEgret ? null : pal.img, imgA: .7, n: 300, w: 3, len: 18, dir: Math.PI / 2, seed: 11, draw: (g, S) => {
      const grd = g.createLinearGradient(0, 0, S, 0); grd.addColorStop(.0, "rgba(0,0,0,0)"); grd.addColorStop(.35, "rgba(0,0,0,0)"); grd.addColorStop(.5, css(belly)); grd.addColorStop(.65, "rgba(0,0,0,0)");
      g.globalAlpha = .55; g.fillStyle = grd; g.fillRect(0, 0, S, S); g.globalAlpha = 1; } });
    const bL = 1 - P.tail * .55 - P.neck * .5;
    // 胴：胸がふくらみ、尾の付け根へ細くなる（前後で同じ形にしない）
    const tb = body(16, 14, t => P.bw * Math.pow(Math.sin(Math.PI * Math.min(1, t * .95 + .03)), .7) * (.5 + .5 * t), t => P.bh * Math.pow(Math.sin(Math.PI * Math.min(1, t * .95 + .03)), .75) * (.55 + .45 * t), t => -.02 * Math.cos(t * Math.PI), bL);
    const torso = new THREE.Mesh(tb, mat(bodyTex)); torso.position.z = -P.neck * .2; G.add(torso);
    // 首と頭
    const headG = new THREE.Group(); G.add(headG);
    let hz = bL / 2 - P.neck * .2, hy = P.bh * .5;
    if (P.neck > 0) {   // サギ・ガン：首（S 字の曲線に沿った管）
      const pts = isEgret ? [[0, 0, 0], [0, P.neck * .35, P.neck * .05], [0, P.neck * .55, -P.neck * .1], [0, P.neck * .85, P.neck * .12]] : [[0, 0, 0], [0, P.neck * .45, P.neck * .25], [0, P.neck * .75, P.neck * .45]];
      const cv = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y + P.bh * .3, z + hz - .02)));
      const neck = new THREE.Mesh(new THREE.TubeGeometry(cv, 16, P.bw * (isEgret ? .28 : .45), 10), mat(brushTex(isEgret ? base : pal.mid, [pal.mid, pal.dark], { n: 120, seed: 5 }))); G.add(neck);
      const e = cv.getPoint(1); hz = e.z; hy = e.y;
    }
    headG.position.set(0, hy + (P.neck > 0 ? 0 : P.head * .35), hz + (P.neck > 0 ? 0 : P.head * .55));
    const head = new THREE.Mesh(new THREE.SphereGeometry(P.head, 16, 12), mat(brushTex(sp === "sparrow" ? pal.accent.clone().lerp(new THREE.Color(0x7a3c22), .5) : sp === "swallow" ? new THREE.Color(0x1d2840).lerp(pal.dark, .3) : base, [pal.dark, pal.mid], { n: 120, seed: 3, draw: (g, S) => {
      if (sp === "sparrow") { g.fillStyle = css(pal.light.clone().lerp(new THREE.Color(1, 1, 1), .4)); g.fillRect(0, S * .5, S, S * .5); g.fillStyle = "#1a1612"; g.beginPath(); g.ellipse(S * .25, S * .62, S * .06, S * .05, 0, 0, TAU); g.ellipse(S * .75, S * .62, S * .06, S * .05, 0, 0, TAU); g.fill(); g.fillRect(S * .42, S * .8, S * .16, S * .2); }   // 頬の黒い斑・のどの黒
      if (sp === "swallow") { g.fillStyle = "#9b3a24"; g.fillRect(S * .38, S * .7, S * .24, S * .3); }   // のどの赤茶
      if (sp === "warbler") { g.strokeStyle = "rgba(240,235,210,.8)"; g.lineWidth = S * .03; g.beginPath(); g.moveTo(S * .1, S * .42); g.lineTo(S * .36, S * .4); g.moveTo(S * .64, S * .4); g.lineTo(S * .9, S * .42); g.stroke(); }   // 白っぽい眉
      if (sp === "goose") { g.fillStyle = "#f2efe6"; g.fillRect(S * .42, S * .55, S * .16, S * .12); }   // マガンの白い額
    } })));
    head.scale.set(.9, .95, 1.05); headG.add(head);
    // 目
    for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(P.head * .17, 10, 8), plain(0x0d0b09, { r: .2 })); eye.position.set(s * P.head * .72, P.head * .2, P.head * .35); headG.add(eye);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(P.head * .05, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })); hl.position.set(s * P.head * .8, P.head * .26, P.head * .42); headG.add(hl); }
    // くちばし
    const beakCol = sp === "heron" ? 0xd8b23a : sp === "goose" ? 0xd99a8a : sp === "warbler" ? 0x5a5040 : 0x2a2420;
    const beak = new THREE.Mesh(new THREE.ConeGeometry(P.beakW, P.beak, 8), plain(beakCol, { r: .4 })); beak.rotation.x = Math.PI / 2; beak.position.set(0, -P.head * .1, P.head * .85 + P.beak / 2); if (sp === "goose") beak.scale.set(1.2, .6, 1); headG.add(beak);
    // 翼：肩・手首の二つの関節。次列風切 9・初列風切 10（いちばん外は短い）・その上に雨覆
    const fT = featherTex(pal, { tip: sp === "swallow" ? new THREE.Color(0x141c2e) : isEgret ? base : pal.dark, base: isEgret ? base : pal.mid, edge: isEgret ? null : pal.light });
    const cvT = featherTex(pal, { tip: isEgret ? base : pal.mid, base: isEgret ? base : pal.mid.clone().lerp(pal.light, .3) });
    for (const s of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(s * P.bw * .7, P.bh * .45, bL * .12); G.add(sh);
      const span = P.wing, inner = new THREE.Group(), outer = new THREE.Group(); sh.add(inner); outer.position.set(s * span * .45, 0, 0); inner.add(outer);
      for (let i = 0; i < 9; i++) { const f = feather(fT, span * (.42 + .02 * i), span * .11); f.position.set(s * span * (.04 + i * .045), 0, 0); f.rotation.y = s * (.08 - i * .01); inner.add(f); }   // 次列風切 9
      for (let i = 0; i < 10; i++) { const L_ = span * (i === 9 ? .3 : .5 + .03 * i - .002 * i * i); const f = feather(fT, L_, span * .1); f.position.set(s * span * (.0 + i * .045), .002 * i, 0); f.rotation.y = s * (-.05 - i * .1); outer.add(f); }   // 初列風切 10
      for (let i = 0; i < 8; i++) { const f = feather(cvT, span * .24, span * .12); f.position.set(s * span * (.05 + i * .085), .012, .01); f.rotation.y = s * (.1 - i * .05); (i < 5 ? inner : outer).add(f); }   // 雨覆
      parts.wings.push({ sh, outer, s, span });
    }
    // 尾羽（12・ガンは 16）。ツバメは外側ほど長い燕尾
    const tail = new THREE.Group(); tail.position.set(0, P.bh * .25, -bL / 2 + .02); G.add(tail);
    for (let i = 0; i < P.nT; i++) { const x = (i / (P.nT - 1) - .5); const L_ = P.tail * (1 + P.tailFork * Math.pow(Math.abs(x) * 2, 3)); const f = feather(fT, L_, P.tail * .2); f.rotation.y = x * .5; f.position.x = x * P.bw * .5; f.rotation.x = -.05; tail.add(f); }
    parts.tail = tail;
    // 脚と足指（前 3・後 1。ガンは水かき）
    const legCol = sp === "heron" ? 0x1c1a18 : sp === "goose" ? 0xe08a3a : 0x8a6a50;
    parts.legs = [];
    for (const s of [-1, 1]) {
      const lg = new THREE.Group(); lg.position.set(s * P.bw * .35, -P.bh * .6, bL * .05); G.add(lg);
      const shank = new THREE.Mesh(new THREE.CylinderGeometry(.008 + P.leg * .02, .008 + P.leg * .02, P.leg, 6), plain(legCol)); shank.position.y = -P.leg / 2; lg.add(shank);
      const ft = new THREE.Group(); ft.position.y = -P.leg; lg.add(ft);
      for (const a of [-.45, 0, .45, Math.PI]) { const toe = new THREE.Mesh(new THREE.CylinderGeometry(.006, .004, P.leg * .5 + .03, 5), plain(legCol)); toe.rotation.x = Math.PI / 2; toe.position.set(Math.sin(a) * (P.leg * .25 + .015), 0, Math.cos(a) * (P.leg * .25 + .015)); toe.rotation.y = a; ft.add(toe); }
      if (sp === "goose") { const web = new THREE.Mesh(new THREE.CircleGeometry(P.leg * .35, 3, -Math.PI * .75, Math.PI * .5), plain(legCol, { side: THREE.DoubleSide })); web.rotation.x = -Math.PI / 2; ft.add(web); }
      parts.legs.push(lg);
    }
    parts.update = (st) => {   // st：{ flap（翼の角度・はばたき）, fold（0 ひらく〜1 たたむ）, t }
      const f = st.fold ?? 0, a = st.flap ?? 0;
      for (const w of parts.wings) {
        w.sh.rotation.z = w.s * (a * (1 - f));                       // はばたき（肩）
        w.sh.rotation.y = w.s * (-1.25 * f);                         // たたむ：翼を後ろへ
        w.outer.rotation.z = w.s * (-a * .45 * (1 - f));             // 手首
        w.outer.rotation.y = w.s * (-1.6 * f);                       // 初列風切を背の上へ重ねる
      }
      parts.tail.rotation.x = -.05 + Math.sin((st.t || 0) * 3) * .04 * f;
      for (const l of parts.legs) l.rotation.x = f > .5 ? 0 : 1.1 * (1 - f);   // 飛ぶあいだは脚を後ろへ
      headG.rotation.y = Math.sin((st.t || 0) * 1.7) * .25 * f;     // とまっているときは首をかしげる
    };
    return parts;
  }

  // ---------------------------------------------------------------- 鯉
  function carp(pal) {
    const G = new THREE.Group(), parts = { G };
    const scaleTex = brushTex(pal.mid, [pal.dark, pal.mid, pal.light], { img: pal.img, imgA: .75, n: 140, seed: 21, draw: (g, S) => {
      // 円鱗：側線に沿ってほぼ 35 列。外側の縁を濃く
      const cols = 35, rows = 14, w = S / cols, h = S / rows;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const x = c * w + (r % 2) * w / 2, y = r * h; g.strokeStyle = css(pal.dark); g.globalAlpha = .6; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y + h * .2, w * .62, .2 * Math.PI, .8 * Math.PI); g.stroke(); }
      g.globalAlpha = 1;
      // 背は濃く・腹は明るく
      const grd = g.createLinearGradient(0, 0, S, 0); grd.addColorStop(0, "rgba(0,0,0,.35)"); grd.addColorStop(.3, "rgba(0,0,0,0)"); grd.addColorStop(.5, css(pal.light)); grd.addColorStop(.7, "rgba(0,0,0,0)"); grd.addColorStop(1, "rgba(0,0,0,.35)");
      g.globalAlpha = .55; g.fillStyle = grd; g.fillRect(0, 0, S, S); g.globalAlpha = 1;
      // 側線
      g.strokeStyle = css(pal.dark); g.globalAlpha = .5; g.lineWidth = 2; g.beginPath(); g.moveTo(S * .25, 0); g.lineTo(S * .25, S); g.moveTo(S * .75, 0); g.lineTo(S * .75, S); g.stroke(); g.globalAlpha = 1;
    } });
    scaleTex.repeat.set(1, 1);
    const prof = t => Math.pow(Math.sin(Math.PI * Math.min(1, .06 + t * .92)), .8);
    const bg = body(28, 18, t => .085 * prof(t) * (t < .15 ? .55 + t * 3 : 1), t => .14 * prof(t) * (t < .15 ? .5 + t * 3.3 : 1), t => .01 * Math.sin(t * Math.PI), 1);
    const torso = new THREE.Mesh(bg, mat(scaleTex, { r: .45 })); G.add(torso); parts.body = torso;
    // ひれ（鰭条のすじを描いた、半透明の膜）
    const finTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"); const grd = g.createLinearGradient(0, 0, 0, 128); grd.addColorStop(0, css(pal.mid)); grd.addColorStop(1, css(pal.dark)); g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = css(pal.dark); g.globalAlpha = .7; for (let i = 0; i < 18; i++) { g.lineWidth = 1.4; g.beginPath(); g.moveTo(64, 128); g.lineTo(i * 128 / 17, 0); g.stroke(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const finM = new THREE.MeshStandardMaterial({ map: finTex, transparent: true, opacity: .88, side: THREE.DoubleSide, roughness: .6, envMapIntensity: .3, color: 0x9a9088 });
    const fin = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], k) => k ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); const g = new THREE.ShapeGeometry(s); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + .3) / .6, (p.getY(i) + .1) / .3); return new THREE.Mesh(g, finM); };
    // 背びれ 1（長い・前に棘）：体の中ほどから後ろへ
    const dorsal = fin([[0, 0], [.04, .14], [-.02, .12], [-.22, .07], [-.28, 0]]); dorsal.rotation.y = -Math.PI / 2; dorsal.position.set(0, .125, .1); G.add(dorsal);
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(.003, .005, .1, 4), plain(pal.dark)); spine.position.set(0, .175, .1); spine.rotation.x = .25; G.add(spine);
    // 胸びれ 2・腹びれ 2
    parts.pect = []; parts.pelv = [];
    for (const s of [-1, 1]) {
      const pc = fin([[0, 0], [-.03, -.13], [-.11, -.11], [-.08, 0]]); pc.position.set(s * .07, -.06, .28); pc.rotation.set(0, s > 0 ? .5 : Math.PI - .5, s * .6); G.add(pc); parts.pect.push({ m: pc, s });
      const pv = fin([[0, 0], [-.03, -.1], [-.09, -.08], [-.06, 0]]); pv.position.set(s * .05, -.11, .02); pv.rotation.set(0, s > 0 ? .4 : Math.PI - .4, s * .4); G.add(pv); parts.pelv.push({ m: pv, s });
    }
    // しりびれ 1
    const anal = fin([[0, 0], [-.02, -.1], [-.08, -.09], [-.1, 0]]); anal.rotation.y = -Math.PI / 2; anal.position.set(0, -.085, -.2); G.add(anal);
    // 尾びれ 1（二叉）
    const tailG = new THREE.Group(); tailG.position.set(0, .0, -.5); G.add(tailG);
    const caudal = fin([[0, .03], [-.2, .2], [-.15, .04], [-.1, 0], [-.15, -.04], [-.2, -.2], [0, -.03]]); caudal.rotation.y = -Math.PI / 2; tailG.add(caudal); parts.tail = tailG;
    // 頭：口とひげ 2 対（上あごの短いもの・口角の長いもの）・目
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(.018, .006, 6, 12), plain(pal.dark)); mouth.position.set(0, -.03, .5); G.add(mouth);
    for (const s of [-1, 1]) {
      for (const [L_, y, z] of [[.03, -.012, .49], [.055, -.035, .48]]) { const cv = new THREE.CatmullRomCurve3([new THREE.Vector3(s * .02, y, z), new THREE.Vector3(s * .03, y - L_ * .5, z - L_ * .2), new THREE.Vector3(s * .035, y - L_, z - L_ * .5)]);
        G.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 6, .0025, 4), plain(pal.dark))); }
      const eye = new THREE.Mesh(new THREE.SphereGeometry(.016, 10, 8), plain(0xcaa24a, { r: .25 })); eye.position.set(s * .052, .03, .41); G.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(.009, 8, 6), plain(0x0a0806, { r: .2 })); pupil.position.set(s * .062, .03, .415); G.add(pupil);
      const gill = new THREE.Mesh(new THREE.TorusGeometry(.085, .003, 4, 16, Math.PI * .8), plain(pal.dark)); gill.rotation.set(0, s * Math.PI / 2, Math.PI * .6); gill.position.set(s * .07, 0, .34); G.add(gill);
    }
    parts.update = (st) => {   // 体の後ろ半分と尾びれのうねり（頭はほとんど動かない）
      const ph = st.swim ?? 0, amp = st.amp ?? .06, p = bg.attributes.position, b = bg.userData.base, tA = bg.attributes.aT;
      for (let i = 0; i < p.count; i++) { const t = tA.getX(i), k = Math.pow(1 - t, 2); p.setX(i, b[i * 3] + Math.sin(ph - t * 4.5) * amp * k); }
      p.needsUpdate = true; bg.computeVertexNormals();
      tailG.rotation.y = Math.sin(ph - 4.5 * 0) * amp * 4; tailG.position.x = Math.sin(ph) * amp;
      for (const f of parts.pect) f.m.rotation.z = f.s * (.6 + Math.sin(ph * .5) * .25);
    };
    return parts;
  }

  // ---------------------------------------------------------------- 蝶・蜻蛉
  function wingTex(pal, kind) {
    const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
    if (kind === "dragonfly") {   // 透けた翅：細かい網目の翅脈と、前縁の縁紋
      g.fillStyle = "rgba(220,230,235,.28)"; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = "rgba(40,40,40,.55)"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 6); g.lineTo(256, 6); g.moveTo(0, 30); g.lineTo(256, 40); g.stroke();
      g.lineWidth = .8; for (let x = 0; x < 256; x += 9) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x + 4, 250); g.stroke(); } for (let y = 30; y < 256; y += 11) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y + 8); g.stroke(); }
      g.fillStyle = css(pal.dark); g.fillRect(210, 4, 26, 12);   // 縁紋
    } else if (pal.img) {   // 蝶：絵の切り抜きそのもの（翅の色と筆の跡）に、翅脈を重ねる
      const grd0 = g.createRadialGradient(20, 128, 10, 20, 128, 260); grd0.addColorStop(0, css(pal.dark)); grd0.addColorStop(.45, css(pal.accent)); grd0.addColorStop(1, css(pal.light)); g.fillStyle = grd0; g.fillRect(0, 0, 256, 256);
      g.drawImage(pal.img, 0, 0, 256, 256);
      g.strokeStyle = css(pal.dark); g.globalAlpha = .45; g.lineWidth = 1.5; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(10, 128); g.quadraticCurveTo(120, 128 + (i - 3.5) * 20, 256, (i + .5) * 32); g.stroke(); } g.globalAlpha = 1;
    } else {   // 蝶：絵の色の翅、翅脈と縁
      const grd = g.createRadialGradient(20, 128, 10, 20, 128, 260); grd.addColorStop(0, css(pal.dark)); grd.addColorStop(.4, css(pal.accent)); grd.addColorStop(1, css(pal.light));
      g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = css(pal.dark); g.globalAlpha = .7; g.lineWidth = 2; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(10, 128); g.quadraticCurveTo(120, 128 + (i - 3.5) * 20, 256, (i + .5) * 32); g.stroke(); }
      g.lineWidth = 10; g.globalAlpha = .8; g.strokeRect(0, 0, 256, 256); g.globalAlpha = 1;
      g.fillStyle = css(pal.light); for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(240, 20 + i * 36, 6, 0, TAU); g.fill(); }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function insect(pal, kind) {
    const G = new THREE.Group(), parts = { G, wings: [] }, dfly = kind === "dragonfly";
    const bodyM = mat(brushTex(dfly ? pal.accent.clone().lerp(pal.mid, .3) : pal.dark, [pal.dark, pal.mid], { img: pal.img, imgA: .5, n: 80, seed: 9 }), { r: .5 });
    // 頭・胸・腹（蜻蛉は 10 節の長い腹）
    const head = new THREE.Mesh(new THREE.SphereGeometry(dfly ? .07 : .05, 12, 10), bodyM); head.position.z = dfly ? .42 : .3; G.add(head);
    if (dfly) for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(.055, 12, 10), plain(pal.accent.clone().lerp(new THREE.Color(0x3a6a5a), .4), { r: .2, m: .2 })); eye.position.set(s * .045, .02, .44); G.add(eye); }
    const thorax = new THREE.Mesh(new THREE.SphereGeometry(dfly ? .08 : .07, 12, 10), bodyM); thorax.scale.z = 1.4; thorax.position.z = dfly ? .3 : .18; G.add(thorax);
    if (dfly) { for (let i = 0; i < 10; i++) { const r = .035 - i * .0018, seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r * .92, .068, 10), bodyM); seg.rotation.x = Math.PI / 2; seg.position.z = .2 - i * .066; G.add(seg); } }
    else { const ab = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 10), bodyM); ab.scale.z = 3.2; ab.position.z = -.05; G.add(ab); }
    // 触角 2（蝶は先がふくらむ）
    if (!dfly) for (const s of [-1, 1]) { const cv = new THREE.CatmullRomCurve3([new THREE.Vector3(s * .02, .03, .34), new THREE.Vector3(s * .06, .12, .45), new THREE.Vector3(s * .1, .18, .55)]); G.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 8, .004, 4), plain(pal.dark))); const club = new THREE.Mesh(new THREE.SphereGeometry(.014, 6, 5), plain(pal.dark)); club.position.set(s * .1, .18, .55); G.add(club); }
    // 脚 6
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(.004, .003, .14, 4), plain(pal.dark)); lg.position.set(s * .06, -.06, (dfly ? .32 : .2) - i * .05); lg.rotation.z = s * .9; lg.rotation.x = (i - 1) * .4; G.add(lg); }
    // 翅 4（前翅 2・後翅 2）
    const wt = wingTex(pal, kind);
    const wingShape = (fore) => { const s = new THREE.Shape(); if (dfly) { s.moveTo(0, .02); s.bezierCurveTo(.3, .05, .6, .04, .66, 0); s.bezierCurveTo(.6, -.07, .3, -.08, 0, -.03); }
      else if (fore) { s.moveTo(0, .02); s.lineTo(.1, .38); s.quadraticCurveTo(.3, .44, .44, .3); s.quadraticCurveTo(.3, .1, 0, -.02); } else { s.moveTo(0, -.02); s.quadraticCurveTo(.1, -.3, .3, -.32); s.quadraticCurveTo(.36, -.12, 0, .01); }
      const g = new THREE.ShapeGeometry(s, 10); const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / .66, (p.getY(i) + .45) / .9); return g; };
    for (const fore of [true, false]) for (const s of [-1, 1]) {
      const hinge = new THREE.Group(); hinge.position.set(s * .04, .04, (dfly ? (fore ? .33 : .26) : .2)); G.add(hinge);
      const w = new THREE.Mesh(wingShape(fore), new THREE.MeshStandardMaterial({ map: wt, transparent: true, opacity: dfly ? .7 : .97, side: THREE.DoubleSide, roughness: .6, envMapIntensity: .3, depthWrite: !dfly, alphaTest: dfly ? 0 : .2 }));
      w.rotation.x = -Math.PI / 2; if (s < 0) w.scale.x = -1; if (dfly) w.rotation.z = fore ? .12 * s : -.12 * s; hinge.add(w); parts.wings.push({ hinge, s, fore });
    }
    parts.update = (st) => {
      const a = st.flap ?? 0, f = st.fold ?? 0;
      for (const w of parts.wings) {
        if (dfly) { w.hinge.rotation.z = w.s * (Math.sin((st.t || 0) * 90 + (w.fore ? 0 : 1.6)) * .35 * (1 - f) + .05); }   // 蜻蛉：前後の翅が少しずれて速く
        else { const up = (1 - f) * a + f * 1.45; w.hinge.rotation.z = w.s * up; }                                         // 蝶：とまると翅を背の上で閉じる
      }
    };
    return parts;
  }

  // ---------------------------------------------------------------- 野うさぎ
  function hare(pal) {
    const G = new THREE.Group(), parts = { G };
    const furTex = brushTex(pal.mid, [pal.dark, pal.mid, pal.light], { img: pal.img, imgA: .7, n: 500, w: 1.6, len: 10, dir: Math.PI / 2 + .3, seed: 31 });
    const M = mat(furTex, { r: .9 });
    const torso = new THREE.Mesh(body(16, 14, t => .14 * Math.pow(Math.sin(Math.PI * (.08 + t * .86)), .7), t => .16 * Math.pow(Math.sin(Math.PI * (.08 + t * .86)), .7), t => .03 * Math.sin(t * Math.PI), .62), M); torso.position.y = .25; G.add(torso);
    const headG = new THREE.Group(); headG.position.set(0, .38, .34); G.add(headG);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.085, 14, 12), M); head.scale.set(.85, .9, 1.25); headG.add(head);
    for (const s of [-1, 1]) {   // 長い耳（先が黒い）
      const ear = new THREE.Mesh(new THREE.SphereGeometry(.035, 10, 8), mat(brushTex(pal.mid, [pal.dark, pal.light], { n: 60, seed: 41, draw: (g, S) => { g.fillStyle = "#1a1612"; g.fillRect(0, 0, S, S * .15); } }), { r: .9 }));
      ear.scale.set(.7, 4.2, 1); ear.position.set(s * .035, .17, -.04); ear.rotation.set(-.5, 0, s * .12); headG.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(.016, 8, 6), plain(0x1a120a, { r: .2 })); eye.position.set(s * .062, .02, .05); headG.add(eye);
    }
    const legs = [];
    for (const s of [-1, 1]) {   // 後脚（長い）・前脚
      const hind = new THREE.Group(); hind.position.set(s * .1, .22, -.18); G.add(hind);
      const thigh = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), M); thigh.scale.set(.7, 1.3, 1.1); hind.add(thigh);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(.05, .03, .2), M); foot.position.set(0, -.2, .05); hind.add(foot);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(.02, .018, .2, 6), M); fore.position.set(s * .07, .1, .22); G.add(fore);
      legs.push({ hind, fore });
    }
    const tail = new THREE.Mesh(new THREE.SphereGeometry(.04, 8, 6), plain(pal.light.clone().lerp(new THREE.Color(1, 1, 1), .5))); tail.position.set(0, .33, -.32); G.add(tail);
    G.scale.setScalar(1 / .75);
    parts.update = (st) => { const h = st.hop ?? 0; for (const l of legs) { l.hind.rotation.x = -h * .8; l.fore.rotation.x = h * .6; } headG.rotation.x = -.15 + Math.sin((st.t || 0) * 2) * .05 * (1 - h); };
    return parts;
  }

  // ---------------------------------------------------------------- 作る
  function make(style, img) {
    const pal = palette(img);
    const kind = { sparrow: "sparrow", smallbird: "sparrow", swallow: "swallow", warbler: "warbler", goose: "goose", heron: "heron", carp: "carp", butterfly: "butterfly", dragonfly: "dragonfly", hare: "hare" }[style] || "sparrow";
    const p = kind === "carp" ? carp(pal) : kind === "butterfly" || kind === "dragonfly" ? insect(pal, kind) : kind === "hare" ? hare(pal) : bird(pal, kind);
    const mats = []; p.G.traverse(m => { if (m.isMesh) for (const x of [].concat(m.material)) { mats.push(x); } });
    p.kind = kind;
    p.setOpacity = o => { for (const x of mats) { x.opacity = o * (x.userData.op0 ?? (x.userData.op0 = x.opacity)); x.depthWrite = o > .95 && x.userData.dw0 !== false; } p.G.visible = o > .01; };
    return p;
  }
  return { make };
}
