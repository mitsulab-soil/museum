/* 森羅美術館：手で描く材質（canvas）。大理石・石灰岩・漆喰・腰板（木）・絨毯・天窓のガラス・格天井・粒・光の筋。
   2026-10-07 本人「ホワイトキューブより、重厚で歴史が積み重なった博物館のようなデザインの方がいい」。
   写真の材質を取り寄せずに、その場で描く（読み込みを軽く・権利の心配なし）。長辺 512 px まで。 */
import * as THREE from "three";

// 値のノイズ（なめらか）と、重ねたノイズ
function makeNoise(seed = 1) {
  const P = new Uint8Array(512); let s = seed * 9301 + 49297;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const v = new Float32Array(256); for (let i = 0; i < 256; i++) { P[i] = i; v[i] = rnd(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [P[i], P[j]] = [P[j], P[i]]; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const sm = t => t * t * (3 - 2 * t);
  const n2 = (x, y, per = 256) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const h = (a, b) => v[P[(P[((a % per) + per) % per & 255] + (((b % per) + per) % per & 255)) & 511]];
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1), u = sm(xf), w = sm(yf);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
  return (x, y, oct = 4, per = 8) => { let f = 0, amp = .5, fr = 1; for (let o = 0; o < oct; o++) { f += amp * n2(x * fr, y * fr, per * fr); amp *= .5; fr *= 2; } return f; };
}
const N1 = makeNoise(3), N2 = makeNoise(11);

function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
function toTex(c, srgb = true, rep = true) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
const hex = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

// 大理石（白地に灰の筋・黒地に白の筋）。タイルになるよう、ノイズは周期で回す
function marblePix(size, base, vein, seed) {
  const c = canvas(size, size), g = c.getContext("2d"), im = g.createImageData(size, size), d = im.data;
  const B = hex(base), V = hex(vein), N = seed ? N2 : N1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * 8, v = y / size * 8;
    const n = N(u, v, 5, 8), m = N(u * 2 + 3, v * 2 + 7, 3, 16);
    const s = Math.abs(Math.sin((u + v * .6) * Math.PI / 4 * 2 + n * 9));
    const vein1 = Math.pow(1 - s, 10) * .9, k = Math.min(1, vein1 + (m - .5) * .18);
    const i = (y * size + x) * 4, sh = .94 + n * .1;
    for (let ch = 0; ch < 3; ch++) d[i + ch] = Math.max(0, Math.min(255, (B[ch] * (1 - k) + V[ch] * k) * sh));
    d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); return c;
}
// 広間の床：白と深緑の大理石の市松（目地つき）
export function lobbyFloor() {
  const a = marblePix(256, 0xe9e3d6, 0x8f8a80, 0), b = marblePix(256, 0x2c3a33, 0xc9c2b0, 1);
  const c = canvas(512, 512), g = c.getContext("2d");
  g.drawImage(a, 0, 0); g.drawImage(b, 256, 0); g.drawImage(b, 0, 256); g.drawImage(a, 256, 256);
  g.strokeStyle = "rgba(60,48,32,.55)"; g.lineWidth = 3; for (const p of [1.5, 256, 510.5]) { g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 512); g.stroke(); g.beginPath(); g.moveTo(0, p); g.lineTo(512, p); g.stroke(); }
  // すり減り（中ほどが少し明るく、ふちに汚れ）
  g.globalCompositeOperation = "multiply"; const gr = g.createRadialGradient(256, 256, 60, 256, 256, 380); gr.addColorStop(0, "#fff"); gr.addColorStop(1, "#d9d0c0"); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  return toTex(c);
}
export function marble(base = 0xe6dfd0, vein = 0x9a9284) { return toTex(marblePix(256, base, vein, 0)); }
// 石灰岩（広間の壁・アーチ）：あたたかい灰白の、細かなまだらと、目地の段
export function limestone() {
  const S = 256, c = canvas(S, S), g = c.getContext("2d"), im = g.createImageData(S, S), d = im.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = N1(x / S * 8, y / S * 8, 5, 8), f = N2(x / S * 32, y / S * 32, 2, 32);
    const k = .82 + n * .2 + f * .06, i = (y * S + x) * 4;
    d[i] = 214 * k; d[i + 1] = 202 * k; d[i + 2] = 180 * k; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  g.strokeStyle = "rgba(90,74,50,.35)"; g.lineWidth = 2;
  for (let r = 0; r < 4; r++) { const y = r * 64 + 1; g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); const o = r % 2 ? 64 : 0; for (let x = o; x < S; x += 128) { g.beginPath(); g.moveTo(x + 1, y); g.lineTo(x + 1, y + 64); g.stroke(); } }
  return toTex(c);
}
// 漆喰（部屋の壁）：灰の濃淡だけ。色は材質の color で部屋ごとに掛ける
export function plaster() {
  const S = 256, c = canvas(S, S), g = c.getContext("2d"), im = g.createImageData(S, S), d = im.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = N2(x / S * 6, y / S * 6, 5, 6), f = N1(x / S * 40, y / S * 40, 2, 40);
    const k = 200 + (n - .5) * 70 + (f - .5) * 18, i = (y * S + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, k)); d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); return toTex(c);
}
// 腰板（濃い色の木の羽目板）：2.4 m で二枚。縦の木目・框（かまち）の面取り
export function woodPanel() {
  const W = 512, H = 224, c = canvas(W, H), g = c.getContext("2d"), im = g.createImageData(W, H), d = im.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = N1(x / W * 3, y / H * 40, 4, 3), k = .55 + n * .5 + .08 * Math.sin(x * .9 + n * 30), i = (y * W + x) * 4;
    d[i] = 92 * k; d[i + 1] = 58 * k; d[i + 2] = 34 * k; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  for (const x0 of [0, 256]) {
    const x = x0 + 26, y = 30, w = 204, h = 150;
    g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(x, y, w, h);
    g.strokeStyle = "rgba(255,220,170,.18)"; g.lineWidth = 4; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y); g.lineTo(x + w, y); g.stroke();
    g.strokeStyle = "rgba(0,0,0,.45)"; g.beginPath(); g.moveTo(x + w, y); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.stroke();
    g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 2; g.strokeRect(x0 + 2, 6, 252, H - 12);
  }
  g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, 0, W, 6); g.fillRect(0, H - 8, W, 8);
  return toTex(c);
}
// 絨毯（通路の敷物）：縁どりの帯と、小さな菱の文様。地の色は部屋ごと
export function runner(col, edge) {
  const W = 256, H = 256, c = canvas(W, H), g = c.getContext("2d");
  g.fillStyle = col; g.fillRect(0, 0, W, H);
  const im = g.getImageData(0, 0, W, H), d = im.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const n = N2(x / W * 16, y / H * 16, 2, 16), i = (y * W + x) * 4, k = .86 + n * .22; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; }
  g.putImageData(im, 0, 0);
  g.fillStyle = edge; g.fillRect(10, 0, 14, H); g.fillRect(W - 24, 0, 14, H);
  g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(0, 0, 8, H); g.fillRect(W - 8, 0, 8, H);
  g.strokeStyle = edge; g.globalAlpha = .55; g.lineWidth = 3;
  for (let y = 32; y < H; y += 64) { g.beginPath(); g.moveTo(W / 2, y - 20); g.lineTo(W / 2 + 22, y); g.lineTo(W / 2, y + 20); g.lineTo(W / 2 - 22, y); g.closePath(); g.stroke(); }
  g.globalAlpha = 1;
  // すり減り：中ほどが少し白ちゃける
  g.fillStyle = "rgba(255,240,220,.06)"; g.fillRect(70, 0, 116, H);
  return toTex(c);
}
// 天窓のガラス（格子）
export function laylight() {
  const S = 128, c = canvas(S, S), g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, "#fffaf0"); gr.addColorStop(1, "#efe6d4"); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  g.strokeStyle = "rgba(70,55,35,.55)"; g.lineWidth = 3; for (let k = 0; k <= S; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, S); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(S, k); g.stroke(); }
  return toTex(c);
}
// 丸天井の格天井（経度・緯度の格子に、くぼみの陰）
export function coffers() {
  const W = 512, H = 256, c = canvas(W, H), g = c.getContext("2d");
  g.fillStyle = "#cdbf9f"; g.fillRect(0, 0, W, H);
  const nx = 16, ny = 6;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = i * W / nx, y = j * H / ny, w = W / nx, h = H / ny, m = Math.max(3, w * .16);
    g.fillStyle = "#8f7c5c"; g.fillRect(x + m, y + m, w - 2 * m, h - 2 * m);
    g.fillStyle = "#6f5e42"; g.fillRect(x + m * 1.6, y + m * 1.6, w - 3.2 * m, h - 3.2 * m);
    g.fillStyle = "rgba(201,164,92,.85)"; g.beginPath(); g.arc(x + w / 2, y + h / 2, Math.min(w, h) * .09, 0, 7); g.fill();
  }
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(30,20,10,.35)"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const t = toTex(c); t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
// やわらかい粒（粒子の絵）
export function dot() {
  const S = 64, c = canvas(S, S), g = c.getContext("2d"), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.35, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, S, S); return toTex(c, false, false);
}
// 光の筋（窓から斜めに落ちる光）：縦のグラデーション
export function shaft() {
  const c = canvas(64, 256), g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(.6, "rgba(255,255,255,.25)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, "rgba(0,0,0,1)"); h.addColorStop(.25, "rgba(0,0,0,0)"); h.addColorStop(.75, "rgba(0,0,0,0)"); h.addColorStop(1, "rgba(0,0,0,1)");
  g.globalCompositeOperation = "destination-out"; g.fillStyle = h; g.fillRect(0, 0, 64, 256);
  return toTex(c, false, false);
}
// 壁の上の煤（年月の跡）：上が濃く、下へ消える
export function soot() {
  const c = canvas(8, 128), g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, "rgba(20,14,8,.55)"); gr.addColorStop(1, "rgba(20,14,8,0)"); g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
  return toTex(c, false, false);
}
