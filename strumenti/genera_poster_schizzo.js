// Genera le foto di partenza del pezzo a linee (img/hero-ruota.png: nero su carta bianca, il tema lo gestisce il CSS), scattandole dal pezzo 3D vero.
// Uso: avviare un server locale nella cartella del progetto (py -m http.server 8123), poi:
//   node strumenti/genera_poster_schizzo.js <cartella-profilo-temporanea> [cartella-uscita]
// Poi convertire in WebP 900x900 con Pillow e tenere solo i .webp.
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const CH = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const USCITA = process.argv[3] || path.join(__dirname, "..", "img");
const proc = spawn(CH, ["--headless=new", "--disable-gpu", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--remote-debugging-port=9347", "--user-data-dir=" + process.argv[2], "--window-size=1280,900", "about:blank"], { stdio: "ignore" });
const get = (u) => new Promise((r, j) => http.get(u, (res) => { let d = ""; res.on("data", (c) => d += c); res.on("end", () => r(JSON.parse(d))); }).on("error", j));
const dormi = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let tabs; for (let i = 0; i < 40; i++) { try { tabs = await get("http://127.0.0.1:9347/json"); if (tabs.find(t => t.type === "page")) break; } catch (e) {} await dormi(250); }
  const ws = new WebSocket(tabs.find(t => t.type === "page").webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const wait = {};
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait[d.id]) wait[d.id](d); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; wait[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const val = async (e) => (await cmd("Runtime.evaluate", { expression: e, returnByValue: true })).result.result.value;
  await cmd("Runtime.enable"); await cmd("Page.enable");
  await cmd("Page.navigate", { url: "http://127.0.0.1:8123/index.html" });
  let ok = false; for (let i = 0; i < 80; i++) { await dormi(400); if (await val("!!(window.HERO && window.HERO.pronto())")) { ok = true; break; } }
  if (!ok) throw new Error("il pezzo 3D non e' pronto");
  const url = await val("window.HERO.scatta(1200)");
  const fp = path.join(USCITA, "hero-ruota.png");
  fs.writeFileSync(fp, Buffer.from(url.split(",")[1], "base64"));
  console.log("scritta", fp, Math.round(fs.statSync(fp).size / 1024) + " KB");
  ws.close(); proc.kill(); process.exit(0);
})().catch(e => { console.error("ERRORE", e.message); proc.kill(); process.exit(1); });
