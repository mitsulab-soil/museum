/* 森羅美術館・森羅図書館の共通の小道具：文字の逃がし・ライセンスの本文へのリンク・作品の名札（題／作者／年・土地／所蔵／権利）。
   名札の書き方は森羅百景と同じ（写真は「撮影：」と Commons の元のファイル名、CC はライセンス本文へのリンク、パブリックドメインはリンクにしない）。 */
export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const fname = p => (p || "").split("/").pop();
export function licURL(l) {
  l = (l || "").trim(); if (l === "CC0") return "https://creativecommons.org/publicdomain/zero/1.0/";
  const m = l.match(/^CC (BY(?:-SA)?) (\d\.\d)(?: ([A-Za-z]{2}))?$/); if (!m) return "";
  return `https://creativecommons.org/licenses/${m[1].toLowerCase()}/${m[2]}/${m[3] ? m[3].toLowerCase() + "/" : ""}`;
}
export function licHTML(l, url) { url = url || licURL(l); return url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(l)}</a>` : esc(l || ""); }
export function credit(w) {
  const photo = w.t === "photo", who = w.artist || w.author || "";
  const where = w.museum || (/commons\.wikimedia\.org/.test(w.url || "") ? "Wikimedia Commons" : "元のページ");
  const src = w.url ? `<a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(where)}</a>` : esc(w.museum || "");
  const file = photo && /\/File:/.test(w.url || "") ? decodeURIComponent(w.url.split("/File:")[1]).replace(/_/g, " ") : "";
  const date = w.date === "いま" ? "" : w.date;
  return `<div class="tomb"><div class="tt">${esc(w.title)}</div><div>${photo ? "撮影：" : ""}${esc(who)}</div><div class="cr">${esc([date, w.place].filter(Boolean).join("　"))}</div><div class="cr">${src}${src && w.lic ? "　" : ""}${w.lic ? licHTML(w.lic) : ""}</div>${file ? `<div class="cr">元のファイル：${esc(file)}</div>` : ""}${w.src ? `<div class="cr">本文の照合：${esc(w.src)}</div>` : ""}</div>`;
}
export const first = s => { s = (s || "").trim(); const i = s.indexOf("。"); return i < 0 ? s : s.slice(0, i + 1); };
