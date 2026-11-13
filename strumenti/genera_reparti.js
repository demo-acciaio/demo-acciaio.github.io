// Scatta le immagini dei quattro reparti (img/reparto-*.png) dalle scene 3D di strumenti/render_reparti.html.
// Uso: avviare un server locale nella cartella del progetto (py -m http.server 8123), poi:
//   node strumenti/genera_reparti.js <cartella-profilo-temporanea> [uscita]
// Poi convertire in WebP (Pillow) e tenere solo i .webp.
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const CH = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const USCITA = process.argv[3] || path.join(__dirname, "..", "img");
const proc = spawn(CH, ["--headless=new", "--disable-gpu", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--remote-debugging-port=9346", "--user-data-dir=" + process.argv[2], "--window-size=1000,800", "about:blank"], { stdio: "ignore" });
const get = (u) => new Promise((r, j) => http.get(u, (res) => { let d = ""; res.on("data", (c) => d += c); res.on("end", () => r(JSON.parse(d))); }).on("error", j));
const dormi = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let tabs; for (let i = 0; i < 40; i++) { try { tabs = await get("http://127.0.0.1:9346/json"); if (tabs.find(t => t.type === "page")) break; } catch (e) {} await dormi(250); }
  const ws = new WebSocket(tabs.find(t => t.type === "page").webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const wait = {}; const errori = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait[d.id]) wait[d.id](d);
    if (d.method === "Runtime.exceptionThrown") errori.push((d.params.exceptionDetails.exception && d.params.exceptionDetails.exception.description) || d.params.exceptionDetails.text);
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errori.push("CONSOLE: " + d.params.args.map(a => a.value || a.description).join(" ")); };
  const cmd = (method, params) => new Promise(r => { const i = ++id; wait[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const val = async (e) => (await cmd("Runtime.evaluate", { expression: e, returnByValue: true })).result.result.value;
  await cmd("Runtime.enable"); await cmd("Page.enable");
  await cmd("Page.navigate", { url: "http://127.0.0.1:8123/strumenti/render_reparti.html" });
  let ok = false; for (let i = 0; i < 60; i++) { await dormi(400); if (await val("!!(window.RENDER && window.RENDER.pronto)")) { ok = true; break; } }
  if (!ok) throw new Error("la pagina di rendering non e' pronta. Errori: " + errori.join(" | "));
  const solo = process.argv[4];
  const nomi = await val("window.RENDER.nomi");
  for (const n of nomi) {
    if (solo && solo !== n) continue;
    const url = await val("window.RENDER.scatta(" + JSON.stringify(n) + ", 960, 720)");
    if (!url || url.length < 100) throw new Error("scena vuota: " + n + " | " + errori.join(" | "));
    const f = path.join(USCITA, "reparto-" + n + ".png");
    fs.writeFileSync(f, Buffer.from(url.split(",")[1], "base64"));
    console.log("scritta", f, Math.round(fs.statSync(f).size / 1024) + " KB");
  }
  if (errori.length) console.log("ERRORI:", errori.join(" | "));
  ws.close(); proc.kill(); process.exit(0);
})().catch(e => { console.error("ERRORE", e.message); proc.kill(); process.exit(1); });
