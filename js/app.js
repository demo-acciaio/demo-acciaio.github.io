/* APP: pagina pubblica, configuratore a passi, vista azienda. Tutto nel browser, nessun server.
   Tutti i testi passano da t("chiave") (js/i18n.js + js/testi.js): italiano, tedesco, inglese. */
(function () {
  "use strict";

  var S = window.SCHEDARIO;
  var P = window.PREZZI;
  var L = window.I18N;
  var BASE = JSON.parse(JSON.stringify(S)); // copia dei valori originali, per "Ripristina"

  function t(k, p, l) { return L.t(k, p, l); }
  function eur(n, l) { return L.formati(l).eur.format(n); }
  function num(n, l) { return L.formati(l).num.format(n); }
  function nm(tipo, elemento, l) { return L.nome(tipo, elemento, l); }
  function macNome(id, l) { return S.macchine[id] ? nm("mac", { id: id, nome: S.macchine[id].nome }, l) : id; }

  // Traduce un messaggio del motore dei prezzi o della lettura file: { k: "chiave", p: {parametri} }
  function msg(x, l) {
    if (typeof x === "string") return x;
    var p = {}, src = x.p || {};
    Object.keys(src).forEach(function (k) { p[k] = typeof src[k] === "number" ? num(src[k], l) : src[k]; });
    if (src.finId) p.fin = nm("fin", trova(S.finiture, src.finId), l);
    if (src.macId) p.mac = macNome(src.macId, l);
    return t(x.k, p, l);
  }
  // Errore di lettura file: se il messaggio e' un codice (f.err.*) lo traduce, altrimenti testo generico
  function erroreFile(e) {
    var m = e && e.message ? e.message : "";
    return m.indexOf("f.err.") === 0 ? t(m) : t("f.err.generico");
  }

  /* ---------- Utilita' ---------- */
  var mqAffiancato = window.matchMedia("(min-width: 1050px), (min-width: 760px) and (max-width: 1049.98px) and (orientation: landscape)");
  function affiancato() { return mqAffiancato.matches; } // modulo e prezzo su due colonne?
  var seqPrezzo = 0;
  // Fa scorrere un numero da "da" ad "a" (con la funzione "fmt" per scriverlo)
  function animaValore(e, da, a, ms, fmt, soloUltima) {
    if (da === a || matchMedia("(prefers-reduced-motion: reduce)").matches) { e.textContent = fmt(a); return; }
    var mio = soloUltima ? ++seqPrezzo : 0, t0 = null;
    function passo(ora) {
      if (soloUltima && mio !== seqPrezzo) return; // e' partita un'animazione piu' recente
      if (t0 === null) t0 = ora;
      var p = Math.min(1, (ora - t0) / ms), k = 1 - Math.pow(1 - p, 3);
      e.textContent = fmt(da + (a - da) * k);
      if (p < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  }
  // Piccole icone fisse (disegni, nessun dato dell'utente)
  var ICO = {
    consegna: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6h11v9H2zM13 9h4l3 3v3h-7z"/><circle cx="6.5" cy="17" r="1.8"/><circle cx="16.5" cy="17" r="1.8"/></svg>',
    ore: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    peso: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M6 20h12M5 8h14M5 8l-3 7a3 3 0 0 0 6 0zM19 8l-3 7a3 3 0 0 0 6 0z"/></svg>'
  };
  function icona(nome) { var s = el("span", { class: "ico" }); s.innerHTML = ICO[nome]; return s; }
  function mostraToast(testo) {
    var area = document.getElementById("toast-area");
    if (!area) { area = el("div", { id: "toast-area", class: "toast-area", role: "status", "aria-live": "polite" }); document.body.appendChild(area); }
    var tt = el("div", { class: "toast" }, el("span", { class: "toast-icona", "aria-hidden": "true", text: "✓" }), el("span", { text: testo }));
    area.appendChild(tt);
    setTimeout(function () { tt.classList.add("esce"); setTimeout(function () { if (tt.parentNode) tt.parentNode.removeChild(tt); }, 450); }, 3400);
  }
  function el(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") e.className = v;
        else if (k === "text") e.textContent = v;
        else if (k.indexOf("on") === 0 && typeof v === "function") e.addEventListener(k.slice(2), v);
        else if (v === true) e.setAttribute(k, "");
        else e.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(e, arguments[i]);
    return e;
  }
  function append(parent, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(parent, x); }); return; }
    parent.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
  function svuota(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function trova(lista, id) { for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i]; return null; }
  // Voci per i gruppi di scelte, con il nome gia' tradotto
  function voci(tipo, lista) { return lista.map(function (x) { return { id: x.id, nome: nm(tipo, x) }; }); }

  var memoria = {}; // se il browser blocca localStorage, si lavora in memoria
  function leggi(chiave, def) {
    try {
      var v = localStorage.getItem(chiave);
      var p = v ? JSON.parse(v) : null;
      return p === null ? def : p;
    } catch (e) { return memoria[chiave] !== undefined && memoria[chiave] !== null ? memoria[chiave] : def; }
  }
  function scrivi(chiave, valore) {
    memoria[chiave] = valore;
    try { localStorage.setItem(chiave, JSON.stringify(valore)); } catch (e) { /* si resta in memoria */ }
  }

  /* ---------- Schedario modificabile (la vista azienda lo cambia, il prezzo si aggiorna) ---------- */
  function applicaOverride() {
    var o = leggi("schedarioOverride", null);
    if (!o) return;
    if (typeof o.margine === "number") S.margine = o.margine;
    if (typeof o.isola === "number") S.assemblaggi.tariffaIsolaOra = o.isola;
    Object.keys(o.macchine || {}).forEach(function (id) { if (S.macchine[id]) S.macchine[id].tariffaOra = o.macchine[id]; });
    Object.keys(o.materiali || {}).forEach(function (id) { var m = trova(S.materiali, id); if (m) m.prezzoKg = o.materiali[id]; });
  }
  function salvaOverride() {
    var o = { margine: S.margine, isola: S.assemblaggi.tariffaIsolaOra, macchine: {}, materiali: {} };
    Object.keys(S.macchine).forEach(function (id) { o.macchine[id] = S.macchine[id].tariffaOra; });
    S.materiali.forEach(function (m) { o.materiali[m.id] = m.prezzoKg; });
    scrivi("schedarioOverride", o);
  }
  function ripristinaSchedario() {
    S.margine = BASE.margine;
    S.assemblaggi.tariffaIsolaOra = BASE.assemblaggi.tariffaIsolaOra;
    Object.keys(BASE.macchine).forEach(function (id) { S.macchine[id].tariffaOra = BASE.macchine[id].tariffaOra; });
    BASE.materiali.forEach(function (b) { trova(S.materiali, b.id).prezzoKg = b.prezzoKg; });
    scrivi("schedarioOverride", null);
  }

  /* ---------- Dati di contesto ---------- */
  var REPARTI = ["tornitura", "fresatura", "cavi", "assemblaggi"];
  function repNome(id, l) { return t("rep." + id + ".nome", null, l); }
  var STATI = ["ricevuta", "in-valutazione", "offerta-inviata"];

  function nuoviDati(rep) {
    var comuni = { reparto: rep, collaudo: "nessuno", urgenza: "standard" };
    var d;
    if (rep === "tornitura") d = { materiale: "acciaio-c45", macchina: "tornio", geometria: { diametro: 30, lunghezza: 80 }, complessita: "media", tolleranza: "standard", finitura: "nessuna", quantita: 50 };
    else if (rep === "fresatura") d = { materiale: "alu-6082", macchina: "fresa-3", geometria: { x: 100, y: 60, z: 25 }, complessita: "media", tolleranza: "standard", finitura: "nessuna", quantita: 25 };
    else if (rep === "cavi") d = { prodotto: "fune-inox", diametro: 3, lunghezza: 1000, guaina: "nessuna", terminaleA: "occhiello", terminaleB: "occhiello", quantita: 100 };
    else d = { componenti: 3, costoComponentiPezzo: 0, opN: { pressatura: 1, avvitatura: 0, codifica: 1, montaggio: 0, controllo: 1 }, quantita: 200 };
    Object.keys(comuni).forEach(function (k) { d[k] = comuni[k]; });
    return d;
  }
  // Converte i dati del modulo nel formato che capisce il motore dei prezzi
  function perMotore(d) {
    var r = JSON.parse(JSON.stringify(d));
    if (d.reparto === "assemblaggi") {
      r.operazioni = Object.keys(d.opN).filter(function (k) { return d.opN[k] > 0; }).map(function (k) { return { id: k, n: d.opN[k] }; });
    }
    return r;
  }
  function calcola(d) { return P.calcola(perMotore(d)); }

  // Descrizione leggibile di una richiesta: elenco di coppie [etichetta, valore]
  function descrivi(d, l) {
    function T(k, p) { return t(k, p, l); }
    var righe = [[T("d.reparto"), repNome(d.reparto, l)]];
    var mat = d.materiale ? trova(S.materiali, d.materiale) : null;
    if (d.reparto === "tornitura" || d.reparto === "fresatura") {
      righe.push([T("d.macchina"), macNome(d.macchina, l)]);
      righe.push([T("d.materiale"), nm("mat", mat, l)]);
      var g = d.geometria;
      righe.push([T("d.misure"), d.reparto === "tornitura" ? "Ø " + g.diametro + " × " + g.lunghezza + " mm" : g.x + " × " + g.y + " × " + g.z + " mm"]);
      if (g.volumeFinito) righe.push([T("d.volume_file"), num(g.volumeFinito, l) + " cm³"]);
      righe.push([T("d.complessita"), nm("cpx", trova(S.complessita, d.complessita), l)]);
      righe.push([T("d.tolleranze"), nm("tol", trova(S.tolleranze, d.tolleranza), l)]);
      righe.push([T("d.finitura"), nm("fin", trova(S.finiture, d.finitura), l)]);
    } else if (d.reparto === "cavi") {
      righe.push([T("d.prodotto"), nm("prod", trova(S.cavi.prodotti, d.prodotto), l)]);
      righe.push([T("d.diam_lung"), "Ø " + d.diametro + " mm × " + d.lunghezza + " mm"]);
      righe.push([T("d.guaina"), nm("guaina", trova(S.cavi.guaine, d.guaina), l)]);
      righe.push([T("d.term_a"), nm("term", trova(S.cavi.terminali, d.terminaleA), l)]);
      righe.push([T("d.term_b"), nm("term", trova(S.cavi.terminali, d.terminaleB), l)]);
    } else {
      var ops = Object.keys(d.opN).filter(function (k) { return d.opN[k] > 0; }).map(function (k) { return nm("op", trova(S.assemblaggi.operazioni, k), l) + " ×" + d.opN[k]; });
      righe.push([T("d.operazioni"), ops.join(", ") || "—"]);
      righe.push([T("d.comp_pezzo"), String(d.componenti)]);
      righe.push([T("d.costo_comp"), d.costoComponentiPezzo > 0 ? eur(d.costoComponentiPezzo, l) + " / " + T("u.pz") : T("d.forniti")]);
    }
    righe.push([T("d.collaudo"), nm("col", trova(S.collaudi, d.collaudo), l)]);
    righe.push([T("d.urgenza"), nm("urg", trova(S.urgenze, d.urgenza), l)]);
    righe.push([T("d.quantita"), d.quantita + " " + T("u.pz")]);
    return righe;
  }
  function titoloPezzo(d, l) {
    if (d.reparto === "cavi") return nm("prod", trova(S.cavi.prodotti, d.prodotto), l) + " Ø" + d.diametro + " × " + d.lunghezza + " mm";
    if (d.reparto === "assemblaggi") return t("tp.ass", { n: d.componenti }, l);
    var g = d.geometria, mis = d.reparto === "tornitura" ? "Ø" + g.diametro + " × " + g.lunghezza : g.x + "×" + g.y + "×" + g.z;
    return t("tp.mecc", { rep: repNome(d.reparto, l), mat: nm("mat", trova(S.materiali, d.materiale), l), mis: mis }, l);
  }
  // Una voce letta dal cartiglio del PDF, scritta nella lingua scelta
  function trovatoTesto(tv, l) {
    if (typeof tv === "string") return tv; // vecchi dati salvati come testo
    if (tv.c === "materiale") return t("c.materiale", null, l) + ": " + nm("mat", trova(S.materiali, tv.id), l);
    if (tv.c === "quantita") return t("c.quantita", null, l) + ": " + tv.n + " " + t("u.pz", null, l);
    if (tv.c === "tolleranza") return t("c.tolleranza", null, l) + ": " + tv.raw;
    if (tv.c === "trattamento") return t("c.trattamento", null, l) + ": " + (tv.id ? nm("fin", trova(S.finiture, tv.id), l) : t("c.nessuno", null, l));
    return "";
  }

  /* ---------- Stato del configuratore ---------- */
  var cfg = { ultimoTotale: null, passo: 1, dati: null, contatti: { azienda: "", nome: "", email: "", telefono: "", note: "" }, accetta: false, errori: {}, inviata: null, file: null, tokenFile: 0 };
  var radice = null;      // contenitore #configuratore-app
  var pannelloPrezzo = null;

  /* ---------- Componenti del modulo ---------- */
  // Bollino "dal file" sui campi compilati dalla lettura di STEP/PDF; sparisce quando l'utente cambia il valore a mano
  function badgeFile(chiave) {
    return chiave && cfg.file && cfg.file.compilati && cfg.file.compilati[chiave] ? el("span", { class: "badge badge-blu dal-file", text: t("b.dal_file") }) : null;
  }
  function togliDalFile(chiave) { if (cfg.file && cfg.file.compilati) delete cfg.file.compilati[chiave]; }

  function gruppoScelte(etichetta, elenco, valore, alScelta, aiuto, chiave, forma) {
    var box = el("div", { class: "cfg-gruppo" + (forma === "meta" ? "" : " largo") }, el("span", { class: "etichetta" }, etichetta, badgeFile(chiave)));
    // nomi corti (es. Semplice / Media / Complessa): sul telefono si dividono in colonne uguali
    var compatte = elenco.every(function (v) { return String(v.nome).length <= 12; });
    // Colonne scelte in modo che le righe siano sempre piene (es. 8 materiali = 4 + 4, non 3 + 3 + 2)
    var maxLen = 0; elenco.forEach(function (v) { maxLen = Math.max(maxLen, String(v.nome).length); });
    var nOpz = elenco.length, tetto = maxLen <= 8 ? 7 : (maxLen <= 32 ? 4 : 2);
    if (forma === "meta") tetto = Math.min(tetto, 3);
    var col = 1; for (var cc = Math.min(tetto, nOpz); cc >= 1; cc--) { if (nOpz % cc === 0) { col = cc; break; } }
    if (col === 1 && nOpz > 1) col = Math.min(tetto, nOpz);
    var colM = nOpz % 2 === 0 ? 2 : (nOpz % 3 === 0 ? 3 : 2);                         // schermi medi (iPad verticale, telefono grande)
    var colC = nOpz % 3 === 0 ? 3 : (nOpz % 4 === 0 ? 4 : (nOpz % 2 === 0 ? 2 : Math.min(nOpz, 4))); // telefono, nomi corti
    var scelte = el("div", { class: "scelte" + (compatte ? " compatte" : ""), role: "group", "aria-label": etichetta, style: "--col:" + col + ";--colm:" + colM + ";--colc:" + colC });
    elenco.forEach(function (v) {
      scelte.appendChild(el("button", {
        type: "button", class: "scelta", "aria-pressed": String(v.id === valore), disabled: !!v.disabilitata,
        title: v.disabilitata ? v.disabilitata : null,
        onclick: function () { alScelta(v.id); }
      }, v.nome, v.sub ? el("small", { text: v.sub }) : null));
    });
    box.appendChild(scelte);
    if (aiuto) box.appendChild(el("p", { class: "aiuto", text: aiuto }));
    return box;
  }
  function campoNumero(etichetta, valore, unita, alCambio, opz) {
    opz = opz || {};
    var id = "f" + Math.random().toString(36).slice(2, 8);
    var input = el("input", { class: "input", id: id, type: "number", inputmode: "decimal", min: opz.min || 0, step: opz.step || "any", value: valore });
    input.addEventListener("input", function () { alCambio(parseFloat(input.value.replace(",", "."))); });
    return el("div", { class: "campo" }, el("label", { for: id }, etichetta, badgeFile(opz.chiave)),
      el("div", { class: "input-unita" }, input, unita ? el("span", { class: "unita", text: unita }) : null));
  }
  function contatore(valore, min, max, alCambio) {
    var span = el("span", { text: String(valore), "aria-live": "polite" });
    function vai(delta) { var n = Math.min(max, Math.max(min, valore + delta)); alCambio(n); }
    return el("div", { class: "contatore" },
      el("button", { type: "button", "aria-label": t("a.diminuisci"), onclick: function () { vai(-1); } }, "−"), span,
      el("button", { type: "button", "aria-label": t("a.aumenta"), onclick: function () { vai(1); } }, "+"));
  }
  // Cambia passo e lascia traccia nella cronologia: cosi' la freccia indietro del browser
  // e il tasto indietro del mouse tornano al passo precedente.
  function vaiPasso(n) {
    cfg.passo = n;
    try { history.pushState({ cfgPasso: n }, "", location.href); } catch (e) { /* senza cronologia si funziona lo stesso */ }
    disegna();
  }
  function aggiorna() { disegna(); }                 // ridisegna tutto (cambio di una scelta)
  function aggiornaPrezzo() { disegnaPrezzo(); }     // solo il prezzo (mentre si digita)

  /* ---------- Caricamento file (STEP e PDF) ed esempi ---------- */
  var ESEMPI = [
    { id: "perno-inox", rep: "tornitura", macchina: "tornio", complessita: "media" },
    { id: "boccola-bronzo", rep: "tornitura", macchina: "tornio", complessita: "semplice" },
    { id: "flangia-acciaio", rep: "tornitura", macchina: "tornio-y", complessita: "media" },
    { id: "staffa-alluminio", rep: "fresatura", macchina: "fresa-3", complessita: "media" },
    { id: "piastra-tasche", rep: "fresatura", macchina: "fresa-4", complessita: "complessa" }
  ];
  var PRESET = {
    cavi: [
      { dati: { prodotto: "fune-inox", diametro: 3, lunghezza: 1500, guaina: "pvc", terminaleA: "occhiello", terminaleB: "forcella", quantita: 100 } },
      { dati: { prodotto: "fune-inox-19", diametro: 4, lunghezza: 2500, guaina: "nessuna", terminaleA: "filettato", terminaleB: "filettato", quantita: 40 } },
      { dati: { prodotto: "trasmissione", diametro: 5, lunghezza: 800, guaina: "nylon", terminaleA: "sfera", terminaleB: "forcella", quantita: 250 } }
    ],
    assemblaggi: [
      { dati: { componenti: 4, costoComponentiPezzo: 2.5, opN: { pressatura: 2, avvitatura: 0, codifica: 1, montaggio: 0, controllo: 1 }, quantita: 200 } },
      { dati: { componenti: 6, costoComponentiPezzo: 4, opN: { pressatura: 0, avvitatura: 4, codifica: 1, montaggio: 2, controllo: 1 }, quantita: 120 } }
    ]
  };
  var MAX_FILE = 40 * 1024 * 1024;

  function scartaFile() {
    if (cfg.file && cfg.file.viewer) cfg.file.viewer.dispose();
    cfg.file = null; cfg.tokenFile++;
  }
  function leggiBuffer(file) {
    return new Promise(function (ok, ko) {
      var r = new FileReader();
      r.onload = function () { ok(r.result); };
      r.onerror = function () { ko(new Error("f.err.lettura")); };
      r.readAsArrayBuffer(file);
    });
  }
  function scaricaBuffer(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("f.err.esempio");
      return r.arrayBuffer();
    });
  }
  function modificaMisura(d, chiave, valore) {
    d.geometria[chiave] = valore; togliDalFile("misure");
    if (d.geometria.volumeFinito) { delete d.geometria.volumeFinito; if (cfg.file) cfg.file.volumeIgnorato = true; }
  }

  function caricaFileUtente(elenco) {
    var lista = Array.prototype.slice.call(elenco);
    var step = lista.filter(function (f) { return /\.(step|stp)$/i.test(f.name); })[0];
    var pdf = lista.filter(function (f) { return /\.pdf$/i.test(f.name); })[0];
    if (!step && !pdf) {
      var err = { k: "f.err.formato" };
      if (cfg.file && (cfg.file.step || cfg.file.pdf)) cfg.file.errori = [err];   // i file già caricati restano
      else { scartaFile(); cfg.file = { errori: [err], avvisi: [] }; }
      disegna(); return;
    }
    var elencoVoci = [];
    if (step) elencoVoci.push({ nome: step.name, tipo: "step", dimensione: step.size, leggi: function () { return leggiBuffer(step); } });
    if (pdf) elencoVoci.push({ nome: pdf.name, tipo: "pdf", dimensione: pdf.size, leggi: function () { return leggiBuffer(pdf); } });
    eseguiCaricamento(elencoVoci, null, true); // true = i file già caricati dell'altro tipo restano (STEP + PDF si sommano)
  }
  function caricaEsempio(id) {
    var e = trova(ESEMPI, id);
    if (cfg.dati.reparto !== e.rep) cfg.dati = nuoviDati(e.rep);
    cfg.dati.macchina = e.macchina; cfg.dati.complessita = e.complessita;
    eseguiCaricamento([
      { nome: id + ".step", tipo: "step", leggi: function () { return scaricaBuffer("esempi/pezzi/" + id + ".step"); } },
      { nome: id + ".pdf", tipo: "pdf", leggi: function () { return scaricaBuffer("esempi/pezzi/" + id + ".pdf"); } }
    ], id);
  }

  var CAMPI_STEP = ["misure"], CAMPI_PDF = ["materiale", "tolleranza", "quantita", "finitura"];
  function tuttiGliAvvisi(f) { return (f.avvisiStep || []).concat(f.avvisiPdf || [], f.avvisi || []); }

  function eseguiCaricamento(elencoVoci, esempioId, mantieni) {
    // Con "mantieni", lo STEP già letto resta se ora si aggiunge un PDF (e viceversa)
    var prec = mantieni && cfg.file && !cfg.file.caricamento ? cfg.file : null;
    var tieneStep = !!(prec && prec.step && !elencoVoci.some(function (v) { return v.tipo === "step"; }));
    var tienePdf = !!(prec && prec.pdf && !elencoVoci.some(function (v) { return v.tipo === "pdf"; }));
    var viewerTenuto = tieneStep ? prec.viewer : null;
    if (cfg.file && cfg.file.viewer && cfg.file.viewer !== viewerTenuto) cfg.file.viewer.dispose();
    var token = ++cfg.tokenFile;
    cfg.file = { caricamento: true, nomi: elencoVoci.map(function (v) { return v.nome; }), viewer: viewerTenuto };
    disegna();
    var d = cfg.dati;
    var compiti = elencoVoci.map(function (v) {
      if (v.dimensione && v.dimensione > MAX_FILE) return Promise.resolve({ tipo: v.tipo, nome: v.nome, errore: { nome: v.nome, k: "f.err.grande" } });
      return v.leggi().then(function (buf) {
        return (v.tipo === "step" ? window.FILE.leggiStep(buf) : window.FILE.leggiPdf(buf)).then(function (r) { return { tipo: v.tipo, nome: v.nome, r: r }; });
      }).catch(function (e) {
        var m = e && e.message && e.message.indexOf("f.err.") === 0 ? e.message : "f.err.generico";
        return { tipo: v.tipo, nome: v.nome, errore: { nome: v.nome, k: m } };
      });
    });
    Promise.all(compiti).then(function (ris) {
      if (token !== cfg.tokenFile) return; // nel frattempo e' stato scelto un altro file
      var f = { esempio: mantieni ? null : esempioId, errori: [], avvisi: [], avvisiStep: [], avvisiPdf: [], compilati: {} };
      if (tieneStep) {
        f.step = prec.step; f.viewer = viewerTenuto; f.viewerErrore = prec.viewerErrore; f.volumeIgnorato = prec.volumeIgnorato;
        f.avvisiStep = (prec.avvisiStep || []).slice();
        CAMPI_STEP.forEach(function (k) { if (prec.compilati && prec.compilati[k]) f.compilati[k] = true; });
      }
      if (tienePdf) {
        f.pdf = prec.pdf; f.avvisiPdf = (prec.avvisiPdf || []).slice();
        CAMPI_PDF.forEach(function (k) { if (prec.compilati && prec.compilati[k]) f.compilati[k] = true; });
      }
      ris.forEach(function (x) {
        if (x.errore) { f.errori.push(x.errore); return; }
        if (x.tipo === "step") applicaStep(f, x, d);
      });
      ris.forEach(function (x) { if (!x.errore && x.tipo === "pdf") applicaPdf(f, x, d); }); // il PDF dopo lo STEP: il materiale del disegno vince
      cfg.file = f;
      disegna();
      if (f.step && !f.viewer) {
        window.FILE.creaViewer(f.step.meshes).then(function (v) {
          if (token !== cfg.tokenFile) { v.dispose(); return; }
          f.viewer = v; disegna();
        }).catch(function (e) { f.viewerErrore = e && e.message ? e.message : "f.err.generico"; disegna(); });
      }
    });
  }
  function applicaStep(f, x, d) {
    var r = x.r, rep = d.reparto;
    var m = window.FILE.proponiMisure(r.ingombro, rep);
    if (rep === "tornitura") {
      d.geometria = { diametro: m.diametro, lunghezza: m.lunghezza, volumeFinito: r.volumeCm3 };
      if (!m.tondo) f.avvisiStep.push({ k: "f.avv.non_tondo" });
    } else {
      d.geometria = { x: m.x, y: m.y, z: m.z, volumeFinito: r.volumeCm3 };
    }
    f.compilati.misure = true;
    if (r.corpi > 1) f.avvisiStep.push({ k: "f.avv.corpi", p: { n: r.corpi } });
    f.step = { nome: x.nome, ingombro: r.ingombro, volume: r.volumeCm3, meshes: r.meshes };
  }
  function applicaPdf(f, x, d) {
    var r = x.r, c = r.campi;
    f.pdf = { nome: x.nome, trovati: r.trovati, canvas: r.canvas, haTesto: r.haTesto, titolo: r.titolo };
    if (!r.haTesto) { f.avvisiPdf.push({ k: "f.avv.pdf_scansione" }); return; }
    if (!r.trovati.length) { f.avvisiPdf.push({ k: "f.avv.pdf_no_cartiglio" }); return; }
    if (d.reparto !== "tornitura" && d.reparto !== "fresatura") return;
    if (c.materiale && trova(S.materiali, c.materiale)) { d.materiale = c.materiale; f.compilati.materiale = true; }
    if (c.tolleranza) { d.tolleranza = c.tolleranza; f.compilati.tolleranza = true; }
    if (c.quantita) { d.quantita = c.quantita; f.compilati.quantita = true; }
    if (c.finitura) {
      var fin = trova(S.finiture, c.finitura), mat = trova(S.materiali, d.materiale);
      if (fin.gruppi && fin.gruppi.indexOf(mat.gruppo) < 0) f.avvisiPdf.push({ k: "f.avv.finitura_pdf", p: { finId: fin.id } });
      else { d.finitura = c.finitura; f.compilati.finitura = true; }
    }
  }

  function cardFile(rep) {
    var f = cfg.file;
    var box = el("div", { class: "file-card cfg-gruppo" });
    if (rep === "tornitura" || rep === "fresatura") {
      box.appendChild(el("span", { class: "etichetta", text: t("f.titolo") }));
      box.appendChild(el("p", { class: "aiuto", text: t("f.aiuto") }));
      var input = el("input", { type: "file", id: "file-in", class: "file-input", accept: ".step,.stp,.pdf,application/pdf", multiple: true, "aria-label": t("f.scegli") });
      input.addEventListener("change", function () { if (input.files.length) caricaFileUtente(input.files); });
      // Il testo della zona guida il passo dopo: se c'è solo lo STEP chiede il PDF, e viceversa
      var haStep = !!(f && f.step), haPdf = !!(f && f.pdf), v = 0;
      if (haStep && !haPdf) v = 1; else if (haPdf && !haStep) v = 2; else if (haStep && haPdf) v = 3;
      var titoloZona = t("f.zona." + v + ".t"), testoZona = t("f.zona." + v + ".s");
      var zona = el("div", { class: "dropzone", tabindex: "0", role: "button", "aria-label": titoloZona },
        el("strong", { text: titoloZona }), el("span", { text: testoZona }));
      zona.addEventListener("click", function () { input.click(); });
      zona.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); input.click(); } });
      zona.addEventListener("dragover", function (ev) { ev.preventDefault(); zona.classList.add("sopra"); });
      zona.addEventListener("dragleave", function () { zona.classList.remove("sopra"); });
      zona.addEventListener("drop", function (ev) { ev.preventDefault(); zona.classList.remove("sopra"); if (ev.dataTransfer && ev.dataTransfer.files.length) caricaFileUtente(ev.dataTransfer.files); });
      box.appendChild(input); box.appendChild(zona);
      box.appendChild(el("span", { class: "etichetta", style: "margin-top:1rem;display:block", text: t("f.esempi") }));
      var chips = el("div", { class: "scelte" });
      ESEMPI.forEach(function (e) {
        chips.appendChild(el("button", { type: "button", class: "scelta", onclick: function () { caricaEsempio(e.id); } }, t("es." + e.id + ".n"), el("small", { text: t("es." + e.id + ".s") })));
      });
      box.appendChild(chips);
      if (f) box.appendChild(esitoFile(f));
    } else {
      box.appendChild(el("span", { class: "etichetta", text: t("f.conf_esempio") }));
      var ch2 = el("div", { class: "scelte" });
      PRESET[rep].forEach(function (p, i) {
        ch2.appendChild(el("button", { type: "button", class: "scelta", onclick: function () {
          var d = cfg.dati; Object.keys(p.dati).forEach(function (k) { d[k] = JSON.parse(JSON.stringify(p.dati[k])); }); aggiorna();
        } }, t("pre." + rep + "." + i + ".n"), el("small", { text: t("pre." + rep + "." + i + ".s") })));
      });
      box.appendChild(ch2);
    }
    return box;
  }
  function testoErrore(e) { return (e.nome ? "«" + e.nome + "»: " : "") + t(e.k); }

  function testoAttesa3d(f) {
    return f.viewerErrore ? (f.viewerErrore.indexOf("f.err.") === 0 ? t(f.viewerErrore) : t("f.err.generico")) : t("s.preparo3d");
  }
  function esitoFile(f) {
    var out = el("div", { class: "file-esito stack", "aria-live": "polite" });
    if (f.caricamento) { out.appendChild(el("p", { class: "aiuto", text: t("f.leggo", { nomi: f.nomi.join(" + ") }) })); return out; }
    (f.errori || []).forEach(function (e) { out.appendChild(el("div", { class: "avviso avviso-errore", role: "alert", text: testoErrore(e) })); });
    if ((f.errori || []).length && !f.step && !f.pdf) { out.appendChild(el("p", { class: "aiuto", text: t("f.a_mano") })); }
    if (f.step) {
      var mat = trova(S.materiali, cfg.dati.materiale);
      var peso = mat ? f.step.volume * mat.densita / 1000 : null;
      var dati = el("dl", { class: "riepilogo", style: "grid-template-columns:minmax(0,1fr)" },
        el("div", null, el("dt", { text: t("s.file") }), el("dd", { text: f.step.nome })),
        el("div", null, el("dt", { text: t("s.ingombro") }), el("dd", { text: f.step.ingombro.map(function (n) { return num(n); }).join(" × ") + " mm" })),
        el("div", null, el("dt", { text: t("s.volume") }), el("dd", { text: num(f.step.volume) + " cm³" })),
        peso ? el("div", null, el("dt", { text: t("s.peso_in", { mat: nm("mat", mat) }) }), el("dd", { text: num(Math.round(peso * 1000) / 1000) + " kg" })) : null);
      var nota = el("p", { class: "aiuto", text: f.volumeIgnorato ? t("s.misure_cambiate") : t("s.misure_inserite") });
      if (affiancato()) {
        // il pezzo 3D sta nella colonna del prezzo, sempre in vista mentre si sceglie: qui solo i dati
        out.appendChild(el("div", { class: "file-step solo-dati" }, el("div", null, dati, nota)));
      } else {
        var vis = f.viewer ? f.viewer.el : el("div", { class: "viewer3d viewer-attesa", text: testoAttesa3d(f) });
        out.appendChild(el("div", { class: "file-step" }, vis, el("div", null, dati, nota)));
      }
    }
    if (f.pdf) {
      var pdfBox = el("div", { class: "file-pdf" }, f.pdf.canvas);
      var lato = el("div", null, el("span", { class: "etichetta", text: "PDF: " + f.pdf.nome }));
      if (f.pdf.trovati.length) {
        lato.appendChild(el("p", { class: "aiuto", text: t("s.letto_cartiglio") }));
        lato.appendChild(el("ul", { class: "note-prezzo" }, f.pdf.trovati.map(function (tv) { return el("li", { text: trovatoTesto(tv) }); })));
      }
      pdfBox.appendChild(lato); out.appendChild(pdfBox);
    }
    tuttiGliAvvisi(f).forEach(function (a) { out.appendChild(el("div", { class: "avviso", role: "status", text: msg(a) })); });
    out.appendChild(el("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: function () { scartaFile(); disegna(); } }, t("f.rimuovi")));
    return out;
  }

  /* ---------- Passo 1: reparto ---------- */
  function passoReparto() {
    var box = el("div", { class: "card cfg-box" }, el("h3", { text: t("p1.titolo") }));
    var griglia = el("div", { class: "reparto-scelta" });
    REPARTI.forEach(function (r) {
      var ic = el("span", { class: "rc-foto-box" }, fotoReparto(r, "rc-foto", true)); // miniatura ritagliata sul solo pezzo, senza cornice
      griglia.appendChild(el("button", { type: "button", class: "reparto-card", onclick: function () { scegliReparto(r); } },
        ic, el("span", { class: "rc-testo" }, el("span", { class: "rc-nome", text: repNome(r) }), el("span", { class: "rc-desc", text: t("rep." + r + ".desc") })),
        el("span", { class: "rc-freccia", "aria-hidden": "true", text: "→" })));
    });
    box.appendChild(griglia);
    return box;
  }
  function scegliReparto(id, saltaScroll) {
    scartaFile();
    cfg.dati = nuoviDati(id); cfg.inviata = null; cfg.errori = {}; cfg.ultimoTotale = null;
    vaiPasso(2);
    if (!saltaScroll) vaiA("configuratore");
  }

  /* ---------- Passo 2: dettagli del pezzo ---------- */
  function materialiCompatibili() {
    return S.materiali.map(function (m) { return { id: m.id, nome: nm("mat", m), sub: num(m.prezzoKg) + " €/kg" }; });
  }
  function passoDettagli() {
    var d = cfg.dati, rep = d.reparto;
    var box = el("div", { class: "card cfg-box" }, el("h3", { text: t("p2.titolo", { rep: repNome(rep) }) }));
    box.appendChild(cardFile(rep));

    // Il modulo e' diviso in sezioni numerate; i gruppi a mezza larghezza vanno sempre in coppia (mai spazi vuoti)
    var nSez = 0;
    function sezione(chiaveTitolo, nodi) {
      nSez++;
      box.appendChild(el("section", { class: "cfg-sezione" },
        el("header", { class: "cfg-sez-testa" }, el("span", { class: "cfg-sez-num", "aria-hidden": "true", text: String(nSez) }), el("h4", { text: t(chiaveTitolo) })),
        el("div", { class: "cfg-sez-corpo" }, nodi)));
    }
    var gCollaudo = function () { return gruppoScelte(t("l.collaudo"), voci("col", S.collaudi), d.collaudo, function (v) { d.collaudo = v; aggiorna(); }); };

    if (rep === "tornitura" || rep === "fresatura") {
      var macchine = rep === "tornitura" ? ["tornio", "tornio-y"] : ["fresa-3", "fresa-4", "fresa-5"];
      var gMacchina = gruppoScelte(t("l.macchina"), macchine.map(function (id) { return { id: id, nome: macNome(id) }; }), d.macchina,
        function (v) { d.macchina = v; aggiorna(); },
        rep === "tornitura" ? t("h.tornio_y") : t("h.piu_assi"));
      var gMateriale = gruppoScelte(t("l.materiale"), materialiCompatibili(), d.materiale, function (v) {
        d.materiale = v; togliDalFile("materiale");
        var f = trova(S.finiture, d.finitura), m = trova(S.materiali, v);
        if (f.gruppi && f.gruppi.indexOf(m.gruppo) < 0) { d.finitura = "nessuna"; togliDalFile("finitura"); }
        aggiorna();
      }, null, "materiale");
      var misure = el("div", { class: "cfg-griglia" });
      if (rep === "tornitura") {
        misure.appendChild(campoNumero(t("l.diametro"), d.geometria.diametro, "mm", function (v) { modificaMisura(d, "diametro", v); aggiornaPrezzo(); }));
        misure.appendChild(campoNumero(t("l.lunghezza"), d.geometria.lunghezza, "mm", function (v) { modificaMisura(d, "lunghezza", v); aggiornaPrezzo(); }));
      } else {
        misure.appendChild(campoNumero(t("l.x"), d.geometria.x, "mm", function (v) { modificaMisura(d, "x", v); aggiornaPrezzo(); }));
        misure.appendChild(campoNumero(t("l.y"), d.geometria.y, "mm", function (v) { modificaMisura(d, "y", v); aggiornaPrezzo(); }));
        misure.appendChild(campoNumero(t("l.z"), d.geometria.z, "mm", function (v) { modificaMisura(d, "z", v); aggiornaPrezzo(); }));
      }
      var gMisure = el("div", { class: "cfg-gruppo largo" }, el("span", { class: "etichetta" }, t("l.misure"), badgeFile("misure")), misure);
      var gComplessita = gruppoScelte(t("l.complessita"), voci("cpx", S.complessita), d.complessita, function (v) { d.complessita = v; aggiorna(); });
      var gTolleranze = gruppoScelte(t("l.tolleranze"), voci("tol", S.tolleranze), d.tolleranza, function (v) { d.tolleranza = v; togliDalFile("tolleranza"); aggiorna(); }, null, "tolleranza");
      var mat = trova(S.materiali, d.materiale);
      var gFinitura = gruppoScelte(t("l.finitura"), S.finiture.map(function (f) {
        var no = f.gruppi && f.gruppi.indexOf(mat.gruppo) < 0;
        return { id: f.id, nome: nm("fin", f), disabilitata: no ? t("h.non_adatta") : null };
      }), d.finitura, function (v) { d.finitura = v; togliDalFile("finitura"); aggiorna(); }, null, "finitura");
      sezione("sz.macchina", [gMacchina, gMateriale]);
      sezione("sz.misure", [gMisure]);
      sezione("sz.precisione", [gComplessita, gTolleranze]);
      sezione("sz.finitura", [gFinitura, gCollaudo()]);
    }

    if (rep === "cavi") {
      var C = S.cavi, prod = trova(C.prodotti, d.prodotto);
      var gProdotto = gruppoScelte(t("l.prodotto"), voci("prod", C.prodotti), d.prodotto, function (v) {
        d.prodotto = v; var p = trova(C.prodotti, v);
        if (p.diametri.indexOf(d.diametro) < 0) d.diametro = p.diametri[Math.min(1, p.diametri.length - 1)];
        aggiorna();
      });
      var gDiametro = gruppoScelte(t("l.diametro"), prod.diametri.map(function (x) { return { id: x, nome: x + " mm" }; }), d.diametro, function (v) { d.diametro = v; aggiorna(); });
      var gLunghezza = el("div", { class: "cfg-gruppo" }, campoNumero(t("l.lunghezza"), d.lunghezza, "mm", function (v) { d.lunghezza = v; aggiornaPrezzo(); }));
      var gGuaina = gruppoScelte(t("l.guaina"), voci("guaina", C.guaine), d.guaina, function (v) { d.guaina = v; aggiorna(); }, null, null, "meta");
      var gTermA = gruppoScelte(t("l.term_a"), voci("term", C.terminali), d.terminaleA, function (v) { d.terminaleA = v; aggiorna(); });
      var gTermB = gruppoScelte(t("l.term_b"), voci("term", C.terminali), d.terminaleB, function (v) { d.terminaleB = v; aggiorna(); });
      sezione("sz.prodotto", [gProdotto, gDiametro, gLunghezza, gGuaina]);
      sezione("sz.terminali", [gTermA, gTermB]);
      sezione("sz.controlli", [gCollaudo()]);
    }

    if (rep === "assemblaggi") {
      var opBox = el("div", { class: "cfg-gruppo largo" }, el("span", { class: "etichetta", text: t("l.operazioni") }));
      S.assemblaggi.operazioni.forEach(function (op) {
        opBox.appendChild(el("div", { class: "riga-contatore" },
          el("span", { text: nm("op", op) }), contatore(d.opN[op.id], 0, 20, function (n) { d.opN[op.id] = n; aggiorna(); })));
      });
      var gComponenti = el("div", { class: "cfg-gruppo" }, el("span", { class: "etichetta", text: t("l.componenti") }), contatore(d.componenti, 0, 100, function (n) { d.componenti = n; aggiorna(); }));
      var gCostoComp = el("div", { class: "cfg-gruppo" }, campoNumero(t("l.costo_comp"), d.costoComponentiPezzo, "\u20ac", function (v) { d.costoComponentiPezzo = v; aggiornaPrezzo(); }));
      sezione("sz.operazioni", [opBox]);
      sezione("sz.componenti", [gComponenti, gCostoComp]);
      sezione("sz.controlli", [gCollaudo()]);
    }

    var gUrgenza = gruppoScelte(t("l.urgenza"), S.urgenze.map(function (u) { return { id: u.id, nome: nm("urg", u), sub: u.sovrapprezzo ? "+" + Math.round(u.sovrapprezzo * 100) + "%" : t("u.tempi_normali") }; }), d.urgenza, function (v) { d.urgenza = v; aggiorna(); }, null, null, "meta");
    var gQuantita = el("div", { class: "cfg-gruppo" }, campoNumero(t("l.quantita"), d.quantita, t("u.pz"), function (v) { d.quantita = Math.max(1, Math.floor(v) || 1); togliDalFile("quantita"); aggiornaPrezzo(); }, { min: 1, step: 1, chiave: "quantita" }));
    sezione("sz.quantita", [gQuantita, gUrgenza]);

    var avanti = el("button", { type: "button", class: "btn btn-primario", id: "btn-avanti", onclick: function () { vaiPasso(3); vaiA("configuratore"); } }, t("b.continua"), el("span", { "aria-hidden": "true", text: "→" }));
    box.appendChild(el("div", { class: "cfg-azioni" },
      el("button", { type: "button", class: "btn btn-ghost", onclick: function () { vaiPasso(1); vaiA("configuratore"); } }, t("b.cambia_reparto")), avanti));
    return box;
  }

  /* ---------- Pannello prezzo ---------- */
  var COLORI = { materiale: "#3b9bff", lavorazione: "#22d3ee", attrezzaggio: "#818cf8", finitura: "#c084fc", collaudo: "#34d399", urgenza: "#fbbf24", margine: "#94a3b8" };

  function pannelloPrezzoDOM(d, opz) {
    opz = opz || {};
    var c = calcola(d);
    var box = el("div", { class: "stack" });
    if (c.errore) {
      box.appendChild(el("p", { class: "prezzo-vuoto", text: t("pz.completa") }));
      box.appendChild(el("div", { class: "avviso avviso-errore", role: "status", text: msg(c.errore) }));
      return { dom: box, calc: c };
    }
    // Numero grande: il totale calcolato. Nel configuratore scorre dal valore precedente a quello nuovo.
    var parte = opz.anima && cfg.ultimoTotale !== null && cfg.ultimoTotale !== undefined ? cfg.ultimoTotale : c.totale;
    var grande = el("div", { class: "prezzo-grande", text: eur(parte) });
    box.appendChild(el("div", { class: "prezzo-hero" }, grande, el("p", { class: "prezzo-range", text: t("pz.range", { da: eur(c.da), a: eur(c.a) }) })));
    if (opz.anima) { animaValore(grande, parte, c.totale, 450, function (n) { return eur(n); }, true); cfg.ultimoTotale = c.totale; }
    else grande.textContent = eur(c.totale);
    box.appendChild(el("p", { class: "prezzo-sotto", text: t("pz.per", { q: c.quantita, pezzo: eur(c.perPezzo) }) }));

    var tot = 0; Object.keys(c.voci).forEach(function (k) { tot += c.voci[k]; });
    var barra = el("div", { class: "barra", "aria-hidden": "true" });
    Object.keys(c.voci).forEach(function (k) { if (c.voci[k] > 0) barra.appendChild(el("i", { style: "width:" + (c.voci[k] / tot * 100) + "%;background:" + COLORI[k] })); });
    box.appendChild(barra);
    var vociLista = el("ul", { class: "voci" });
    Object.keys(c.voci).forEach(function (k) {
      if (c.voci[k] > 0) vociLista.appendChild(el("li", { style: "--col:" + COLORI[k] }, el("span", { class: "voce-nome" }, el("i", { class: "punto" }), t("pz.v." + k)), el("span", { text: eur(c.voci[k]) })));
    });
    box.appendChild(vociLista);

    box.appendChild(el("div", { class: "dati-rapidi" },
      el("div", null, icona("consegna"), el("strong", { text: "~" + c.giorni + " " + t("u.gg") }), el("span", { text: t("pz.consegna") })),
      el("div", null, icona("ore"), el("strong", { text: num(c.ore) + " h" }), el("span", { text: t("pz.lavorazione") })),
      el("div", null, icona("peso"), el("strong", { text: c.pesoPezzoKg ? num(c.pesoPezzoKg) + " kg" : "—" }), el("span", { text: t("pz.peso") }))));

    if (!opz.senzaTabella) {
      var quantita = [1, 10, 25, 50, 100, 250, 500];
      if (quantita.indexOf(c.quantita) < 0) { quantita.push(c.quantita); quantita.sort(function (a, b) { return a - b; }); }
      var righe = P.tabellaQuantita(perMotore(d), quantita);
      var tab = el("table", { class: "tab-quantita" }, el("thead", null, el("tr", null, el("th", { text: t("pz.q") }), el("th", { text: t("pz.eur_pezzo") }), el("th", { text: t("pz.tot") }))));
      var tb = el("tbody");
      righe.forEach(function (r) {
        tb.appendChild(el("tr", { class: r.quantita === c.quantita ? "corrente" : null }, el("td", { text: r.quantita + " " + t("u.pz") }), el("td", { text: eur(r.perPezzo) }), el("td", { text: eur(r.totale) })));
      });
      tab.appendChild(tb);
      box.appendChild(el("span", { class: "etichetta", text: t("pz.conf") }));
      box.appendChild(tab);
    }
    c.avvisi.forEach(function (a) { box.appendChild(el("div", { class: "avviso", role: "status", text: msg(a) })); });
    if (c.note.length) box.appendChild(el("ul", { class: "note-prezzo" }, c.note.map(function (n) { return el("li", { text: msg(n) }); })));
    return { dom: box, calc: c };
  }
  function disegnaPrezzo() {
    if (!pannelloPrezzo) return;
    var r = pannelloPrezzoDOM(cfg.dati, { anima: true });
    svuota(pannelloPrezzo.corpo); pannelloPrezzo.corpo.appendChild(r.dom);
    var b = document.getElementById("btn-avanti"); if (b) b.disabled = !!r.calc.errore;
  }

  /* ---------- Passo 3: riepilogo e invio ---------- */
  function campoTesto(etichetta, chiave, opz) {
    opz = opz || {};
    var id = "c" + chiave;
    var input = opz.area ? el("textarea", { class: "input", id: id, rows: 3 }) : el("input", { class: "input", id: id, type: opz.tipo || "text", autocomplete: opz.auto || "off" });
    input.value = cfg.contatti[chiave];
    input.addEventListener("input", function () { cfg.contatti[chiave] = input.value; });
    return el("div", { class: "campo" }, el("label", { for: id, text: etichetta + (opz.obbl ? " *" : "") }), input,
      cfg.errori[chiave] ? el("span", { class: "errore-campo", role: "alert", text: t(cfg.errori[chiave]) }) : null);
  }
  function passoInvio() {
    var d = cfg.dati;
    var box = el("div", { class: "card cfg-box" }, el("h3", { text: t("i.titolo") }));
    var dl = el("dl", { class: "riepilogo" });
    descrivi(d).forEach(function (r) { dl.appendChild(el("div", null, el("dt", { text: r[0] }), el("dd", { text: r[1] }))); });
    box.appendChild(dl);
    box.appendChild(el("div", { class: "az-barra", style: "margin-bottom:.8rem" },
      el("h3", { text: t("i.dati"), style: "margin:0" }),
      el("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: function () {
        cfg.contatti = { azienda: t("i.prova_azienda"), nome: t("i.prova_nome"), email: t("i.prova_email"), telefono: "0461 000000", note: t("i.prova_note") };
        cfg.accetta = true; cfg.errori = {}; disegna();
      } }, t("i.prova"))));
    box.appendChild(el("div", { class: "cfg-griglia" }, campoTesto(t("i.nome"), "nome", { obbl: true, auto: "name" }), campoTesto(t("i.azienda"), "azienda", { auto: "organization" }), campoTesto(t("i.email"), "email", { obbl: true, tipo: "email", auto: "email" })));
    box.appendChild(campoTesto(t("i.tel"), "telefono", { tipo: "tel", auto: "tel" }));
    box.appendChild(campoTesto(t("i.note"), "note", { area: true }));
    var chk = el("input", { type: "checkbox", id: "chk-privacy" }); chk.checked = cfg.accetta;
    chk.addEventListener("change", function () { cfg.accetta = chk.checked; });
    box.appendChild(el("div", { class: "campo" }, el("label", { for: "chk-privacy", class: "etichetta-check" }, chk, t("i.privacy")),
      cfg.errori.privacy ? el("span", { class: "errore-campo", role: "alert", text: t(cfg.errori.privacy) }) : null));
    box.appendChild(el("div", { class: "cfg-azioni" },
      el("button", { type: "button", class: "btn btn-ghost", onclick: function () { vaiPasso(2); vaiA("configuratore"); } }, t("i.indietro")),
      el("button", { type: "button", class: "btn btn-primario", id: "btn-invia", onclick: invia }, t("i.invia"), el("span", { "aria-hidden": "true", text: "→" }))));
    return box;
  }
  function invia() {
    var c = cfg.contatti, err = {};
    if (!c.nome.trim()) err.nome = "i.err.nome";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email.trim())) err.email = "i.err.email";
    if (!cfg.accetta) err.privacy = "i.err.privacy";
    cfg.errori = err;
    if (Object.keys(err).length) { disegna(); var p = document.querySelector(".errore-campo"); if (p) p.scrollIntoView({ block: "center" }); return; }
    if (cfg.inviata) return; // evita un secondo invio dello stesso modulo
    var btn = document.getElementById("btn-invia"); if (btn) btn.disabled = true;
    var elenco = leggi("richieste", []);
    var n = elenco.reduce(function (m, r) { return Math.max(m, parseInt(r.id.slice(4), 10) || 0); }, 0) + 1;
    var rec = {
      id: "RIC-" + ("0000" + n).slice(-4), creata: new Date().toISOString(), stato: "ricevuta", demo: false, lingua: L.corrente(),
      cliente: { azienda: c.azienda.trim(), nome: c.nome.trim(), email: c.email.trim(), telefono: c.telefono.trim(), note: c.note.trim() },
      dati: JSON.parse(JSON.stringify(cfg.dati)), prezzo: calcola(cfg.dati), ritocco: 0, offerta: null,
      file: cfg.file && (cfg.file.step || cfg.file.pdf) ? {
        esempio: cfg.file.esempio || null,
        step: cfg.file.step ? { nome: cfg.file.step.nome, ingombro: cfg.file.step.ingombro, volume: cfg.file.step.volume } : null,
        pdf: cfg.file.pdf ? { nome: cfg.file.pdf.nome, trovati: cfg.file.pdf.trovati } : null
      } : null
    };
    elenco.push(rec);
    scrivi("richieste", elenco);
    cfg.inviata = rec.id;
    vaiPasso(4); vaiA("configuratore");
  }
  function passoFatto() {
    return el("div", { class: "card cfg-box successo" },
      el("span", { class: "badge badge-ok", text: t("ok.badge") }),
      el("h3", { text: t("ok.titolo", { id: cfg.inviata }) }),
      el("p", { text: t("ok.testo") }),
      el("div", { class: "hero-bottoni", style: "justify-content:center" },
        el("button", { type: "button", class: "btn btn-primario", onclick: function () { location.hash = "#/azienda/" + cfg.inviata; } }, t("ok.vai")),
        el("button", { type: "button", class: "btn btn-ghost", onclick: function () { scartaFile(); cfg.dati = null; cfg.inviata = null; cfg.accetta = false; cfg.contatti = { azienda: "", nome: "", email: "", telefono: "", note: "" }; vaiPasso(1); } }, t("ok.nuova"))));
  }

  /* ---------- Disegno del configuratore ---------- */
  function disegna() {
    if (!radice) return;
    var attivo = document.activeElement && document.activeElement.id;
    svuota(radice); pannelloPrezzo = null;
    var nomi = [t("passo.reparto"), t("passo.pezzo"), t("passo.invio")];
    var barra = el("ol", { class: "cfg-passi", style: "list-style:none;padding:0;margin:0 0 1.5rem" });
    nomi.forEach(function (n, i) {
      var numero = i + 1, stato = cfg.passo === numero ? "attivo" : (cfg.passo > numero ? "fatto" : "");
      barra.appendChild(el("li", { class: "cfg-passo " + stato, "aria-current": cfg.passo === numero ? "step" : null }, el("b", { text: cfg.passo > numero ? "✓" : String(numero) }), el("span", { text: n })));
    });
    radice.appendChild(barra);

    var griglia = el("div", { class: cfg.passo === 2 ? "cfg" : null });
    if (cfg.passo === 1) griglia.appendChild(passoReparto());
    else if (cfg.passo === 2) {
      griglia.appendChild(passoDettagli());
      var corpo = el("div");
      var testa = el("div", { class: "prezzo-testa" }, el("span", { class: "led", "aria-hidden": "true" }), el("h3", { text: t("pz.stima") }), el("span", { class: "live", "aria-hidden": "true", text: "LIVE" }));
      var side = el("aside", { class: "card prezzo cockpit", "aria-label": t("pz.stima") }, testa);
      if (affiancato() && cfg.file && cfg.file.step) {
        var vistaLato = el("div", { class: "viewer-lato" });
        if (cfg.file.viewer) vistaLato.appendChild(cfg.file.viewer.el);
        else vistaLato.appendChild(el("div", { class: "viewer3d viewer-attesa", text: testoAttesa3d(cfg.file) }));
        vistaLato.appendChild(el("p", { class: "viewer-didascalia", text: t("s.ruota") }));
        side.appendChild(vistaLato);
      }
      side.appendChild(corpo);
      pannelloPrezzo = { corpo: corpo };
      griglia.appendChild(side);
    } else if (cfg.passo === 3) griglia.appendChild(passoInvio());
    else griglia.appendChild(passoFatto());
    radice.appendChild(griglia);
    if (cfg.passo === 2) disegnaPrezzo();
    if (attivo) { var e = document.getElementById(attivo); if (e && e.focus) e.focus(); }
  }

  /* ==========================================================================
     VISTA AZIENDA
     ========================================================================== */
  var az = { tab: "richieste", sel: null, viewer: null, tokenViewer: 0, kpiAnimati: false, dentro: false };
  var VERSIONE_ESEMPI = 3; // aumentare quando cambiano le richieste di esempio in seedRichieste

  function seedRichieste() {
    var esistenti = leggi("richieste", null);
    if (esistenti !== null && leggi("richiesteVer", 0) === VERSIONE_ESEMPI) return;
    var dellUtente = (esistenti || []).filter(function (x) { return !x.demo; }); // le richieste inviate da chi prova restano
    function r(id, giorniFa, lingua, cliente, dati, stato, file) {
      var d = new Date(Date.now() - giorniFa * 86400000).toISOString();
      return { id: id, creata: d, stato: stato, demo: true, lingua: lingua, cliente: cliente, dati: dati, prezzo: calcola(dati), ritocco: 0, offerta: null, file: file || null };
    }
    var a = nuoviDati("tornitura"); a.materiale = "inox-304"; a.geometria = { diametro: 20, lunghezza: 100, volumeFinito: 23.584 }; a.tolleranza = "precisa"; a.finitura = "passivazione"; a.collaudo = "dimensionale"; a.quantita = 50;
    var b = nuoviDati("fresatura"); b.macchina = "fresa-5"; b.materiale = "alu-6082"; b.geometria = { x: 150, y: 100, z: 20, volumeFinito: 255.7 }; b.complessita = "complessa"; b.tolleranza = "precisa"; b.finitura = "anodizzazione"; b.collaudo = "cmm"; b.urgenza = "rapida"; b.quantita = 10;
    var c = nuoviDati("cavi"); c.prodotto = "fune-inox"; c.diametro = 4; c.lunghezza = 1500; c.guaina = "pvc"; c.terminaleA = "occhiello"; c.terminaleB = "forcella"; c.quantita = 300;
    scrivi("richieste", [
      r("RIC-0001", 3, "it", { azienda: "Meccanica Rossi (esempio)", nome: "Luca Rossi", email: "luca@esempio.it", telefono: "", note: "Serve certificato materiale." }, c, "ricevuta"),
      r("RIC-0002", 2, "de", { azienda: "Mayr Metallbau (Beispiel)", nome: "Hans Mayr", email: "hans@beispiel.de", telefono: "", note: "Bitte Werkstoffzeugnis 3.1 beilegen." }, a, "in-valutazione",
        { esempio: "perno-inox", step: { nome: "perno-inox.step", ingombro: [20, 20, 100], volume: 23.584 }, pdf: { nome: "perno-inox.pdf", trovati: [{ c: "materiale", id: "inox-304" }, { c: "quantita", n: 50 }, { c: "tolleranza", raw: "±0,05" }, { c: "trattamento", id: "passivazione" }] } }),
      r("RIC-0003", 1, "en", { azienda: "Alpine Parts Ltd (example)", nome: "Emma Clarke", email: "emma@example.com", telefono: "", note: "Drawing attached as STEP." }, b, "ricevuta",
        { esempio: "piastra-tasche", step: { nome: "piastra-tasche.step", ingombro: [150, 100, 20], volume: 255.714 }, pdf: { nome: "piastra-tasche.pdf", trovati: [{ c: "materiale", id: "alu-6082" }, { c: "quantita", n: 10 }, { c: "tolleranza", raw: "±0,05" }] } })
    ].concat(dellUtente));
    scrivi("richiesteVer", VERSIONE_ESEMPI);
  }
  function richieste() { return leggi("richieste", []); }
  function salvaRichiesta(rec) {
    var l = richieste(); for (var i = 0; i < l.length; i++) if (l[i].id === rec.id) l[i] = rec; scrivi("richieste", l);
  }
  function dataBreve(iso) { try { return new Date(iso).toLocaleDateString(L.locale(), { day: "2-digit", month: "short" }); } catch (e) { return ""; } }

  // La risposta al cliente e' scritta nella SUA lingua (quella usata quando ha inviato la richiesta)
  function rispostaAutomatica(rec, calc, offertaTot) {
    var l = rec.lingua || "it", q = rec.dati.quantita;
    return t("r.testo", { nome: rec.cliente.nome, id: rec.id, q: q, pezzo: titoloPezzo(rec.dati, l), tot: eur(offertaTot, l), per: eur(offertaTot / q, l), giorni: calc.giorni }, l);
  }

  // Indicatori in alto: richieste, da valutare, valore stimato, offerte inviate (si contano da soli alla prima apertura)
  function kpiAzienda(lista) {
    var valore = lista.reduce(function (s, r) { return s + (r.prezzo && r.prezzo.totale ? r.prezzo.totale : 0); }, 0);
    var voci = [
      { k: "totale", v: lista.length, fmt: function (n) { return String(Math.round(n)); } },
      { k: "attesa", v: lista.filter(function (r) { return r.stato === "ricevuta"; }).length, fmt: function (n) { return String(Math.round(n)); } },
      { k: "valore", v: valore, fmt: function (n) { return eur(n); } },
      { k: "inviate", v: lista.filter(function (r) { return r.stato === "offerta-inviata"; }).length, fmt: function (n) { return String(Math.round(n)); } }
    ];
    var box = el("div", { class: "kpi" });
    voci.forEach(function (x) {
      var numero = el("strong", { class: "kpi-valore", text: x.fmt(az.kpiAnimati ? x.v : 0) });
      box.appendChild(el("div", { class: "kpi-tessera" }, el("span", { class: "kpi-etichetta", text: t("az.kpi." + x.k) }), numero));
      if (!az.kpiAnimati) animaValore(numero, 0, x.v, 1100, x.fmt, false);
    });
    az.kpiAnimati = true;
    return box;
  }
  // Percorso della richiesta: Ricevuta -> In valutazione -> Offerta inviata
  function pipeline(stato) {
    var idx = STATI.indexOf(stato), ol = el("ol", { class: "pipeline" });
    STATI.forEach(function (s, i) {
      ol.appendChild(el("li", { class: i < idx ? "fatto" : (i === idx ? "attuale" : ""), "aria-current": i === idx ? "step" : null },
        el("span", { class: "pip-punto", text: i < idx ? "✓" : String(i + 1) }), el("span", { class: "pip-nome", text: t("stato." + s) })));
    });
    return ol;
  }
  // Anteprima della mail al cliente, scritta nella SUA lingua
  function mailAnteprima(rec, calc, tot) {
    var l = rec.lingua || "it";
    return el("div", { class: "mail" },
      el("div", { class: "mail-testa" },
        el("div", { class: "mail-riga" }, el("span", { text: t("az.mail.a", null, l) }), el("strong", { text: rec.cliente.nome + " <" + rec.cliente.email + ">" })),
        el("div", { class: "mail-riga" }, el("span", { text: t("az.mail.oggetto", null, l) }), el("strong", { text: t("r.oggetto", { id: rec.id, pezzo: titoloPezzo(rec.dati, l) }, l) }))),
      el("div", { class: "mail-corpo", text: rispostaAutomatica(rec, calc, tot) }));
  }

  function disegnaAzienda() {
    var cont = document.getElementById("vista-azienda"); svuota(cont);
    if (az.viewer) { az.viewer.dispose(); az.viewer = null; }
    az.tokenViewer++;
    seedRichieste();
    var lista = richieste();
    var wrap = el("div", { class: "contenitore az" });
    wrap.appendChild(el("div", { class: "az-barra" }, el("div", null, el("p", { class: "sopratitolo", text: t("az.sopra") }), el("h2", { text: t("az.titolo") })),
      el("div", { class: "az-azioni", style: "margin:0" },
        bottoneAzzera("btn btn-ghost btn-sm"),
        el("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: function () { location.hash = "#/"; } }, t("az.torna")))));
    wrap.appendChild(kpiAzienda(lista));
    wrap.appendChild(el("div", { class: "az-banner", text: t("az.banner") }));
    var tabs = el("div", { class: "az-tabs", role: "tablist" });
    [["richieste", t("az.tab.richieste", { n: lista.length })], ["schedario", t("az.tab.schedario")]].forEach(function (tb) {
      tabs.appendChild(el("button", { type: "button", role: "tab", class: "scelta", "aria-pressed": String(az.tab === tb[0]), "aria-selected": String(az.tab === tb[0]), onclick: function () { az.tab = tb[0]; disegnaAzienda(); } }, tb[1]));
    });
    wrap.appendChild(tabs);
    wrap.appendChild(az.tab === "richieste" ? tabRichieste(lista) : tabSchedario());
    cont.appendChild(wrap);
  }

  function tabRichieste(lista) {
    var ordinate = lista.slice().sort(function (a, b) { return b.creata < a.creata ? -1 : 1; });
    if (!ordinate.length) return el("div", { class: "card az-dettaglio" }, el("p", { text: t("az.nessuna") }));
    if (!az.sel || !trova(lista, az.sel)) az.sel = ordinate[0].id;
    var elenco = el("div", { class: "az-elenco" });
    ordinate.forEach(function (r) {
      elenco.appendChild(el("button", { type: "button", class: "az-voce", "aria-current": String(r.id === az.sel), onclick: function () { az.sel = r.id; history.replaceState(null, "", "#/azienda/" + r.id); disegnaAzienda(); } },
        el("span", { class: "riga" }, el("span", { class: "id-con-led" }, el("span", { class: "led led-" + r.stato, "aria-hidden": "true" }), el("span", { class: "id", text: r.id })), el("span", { text: dataBreve(r.creata) })),
        el("span", { class: "riga" }, el("span", { text: r.cliente.azienda || r.cliente.nome })),
        el("span", { class: "riga" }, el("span", { text: repNome(r.dati.reparto) + " · " + r.dati.quantita + " " + t("u.pz") }), el("strong", { text: eur(r.prezzo.totale) })),
        el("span", { class: "riga" }, el("span", { class: "badge " + (r.stato === "offerta-inviata" ? "badge-ok" : "badge-blu"), text: t("stato." + r.stato) }), el("span", { class: "lingua-cliente", text: (r.lingua || "it").toUpperCase(), title: t("az.lingua_cliente") }))));
    });
    return el("div", { class: "az-layout" }, elenco, dettaglioRichiesta(trova(lista, az.sel)));
  }

  function dettaglioRichiesta(rec) {
    var calc = calcola(rec.dati);
    var box = el("div", { class: "card az-dettaglio" });
    box.appendChild(el("h3", { text: rec.id + " · " + (rec.cliente.azienda || rec.cliente.nome) }));
    box.appendChild(el("p", { class: "aiuto", text: rec.cliente.nome + " · " + rec.cliente.email + (rec.cliente.telefono ? " · " + rec.cliente.telefono : "") }));
    box.appendChild(pipeline(rec.stato));
    if (rec.cliente.note) box.appendChild(el("p", { text: t("az.note_cliente") + ": " + rec.cliente.note }));

    var sez1 = el("div", { class: "az-sezione" }, el("h4", { text: t("az.chiesto") }));
    var dl = el("dl", { class: "riepilogo" });
    descrivi(rec.dati).forEach(function (r) { dl.appendChild(el("div", null, el("dt", { text: r[0] }), el("dd", { text: r[1] }))); });
    sez1.appendChild(dl); box.appendChild(sez1);

    if (rec.file) box.appendChild(sezioneAllegati(rec.file));

    var sez2 = el("div", { class: "az-sezione" }, el("h4", { text: t("az.calcolo") }));
    if (calc.errore) sez2.appendChild(el("div", { class: "avviso avviso-errore", text: msg(calc.errore) }));
    else {
      var r2 = pannelloPrezzoDOM(rec.dati, { senzaTabella: true });
      sez2.appendChild(r2.dom);
      if (Math.abs(calc.totale - rec.prezzo.totale) > 0.01) sez2.appendChild(el("div", { class: "avviso", text: t("az.cambiato", { prezzo: eur(rec.prezzo.totale) }) }));
    }
    box.appendChild(sez2);
    if (calc.errore) return box;

    var offertaTot = Math.round(calc.totale * (1 + rec.ritocco / 100) * 100) / 100;
    var sez3 = el("div", { class: "az-sezione" }, el("h4", { text: t("az.risposta", { lingua: t("lang." + (rec.lingua || "it")) }) }));
    sez3.appendChild(el("div", { class: "az-azioni", style: "margin:0 0 1rem" },
      el("span", { class: "etichetta", text: t("az.ritocco") }),
      el("div", { class: "contatore" },
        el("button", { type: "button", "aria-label": t("a.riduci"), onclick: function () { rec.ritocco = Math.max(-20, rec.ritocco - 1); salvaRichiesta(rec); disegnaAzienda(); } }, "−"),
        el("span", { style: "min-width:4rem", text: (rec.ritocco > 0 ? "+" : "") + rec.ritocco + "%" }),
        el("button", { type: "button", "aria-label": t("a.aumenta1"), onclick: function () { rec.ritocco = Math.min(30, rec.ritocco + 1); salvaRichiesta(rec); disegnaAzienda(); } }, "+")),
      el("strong", { text: t("az.offerta", { tot: eur(offertaTot) }) })));
    sez3.appendChild(mailAnteprima(rec, calc, offertaTot));
    sez3.appendChild(el("div", { class: "az-azioni" },
      rec.stato !== "in-valutazione" && rec.stato !== "offerta-inviata" ? el("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: function () { rec.stato = "in-valutazione"; salvaRichiesta(rec); disegnaAzienda(); mostraToast(t("az.toast.valutazione", { id: rec.id })); } }, t("az.segna")) : null,
      rec.stato === "offerta-inviata"
        ? el("span", { class: "badge badge-ok", text: t("az.inviata") + (rec.offerta ? " · " + eur(rec.offerta.totale) : "") })
        : el("button", { type: "button", class: "btn btn-primario btn-sm", onclick: function () {
            rec.stato = "offerta-inviata"; rec.offerta = { totale: offertaTot, giorni: calc.giorni, data: new Date().toISOString() };
            salvaRichiesta(rec); disegnaAzienda();
            mostraToast(t("az.toast.inviata", { id: rec.id, nome: rec.cliente.nome }));
          } }, t("az.invia"))));
    box.appendChild(sez3);
    return box;
  }

  function sezioneAllegati(file) {
    var sez = el("div", { class: "az-sezione" }, el("h4", { text: t("az.allegati") }));
    var lista = el("ul", { class: "note-prezzo", style: "margin:0 0 1rem" });
    if (file.step) lista.appendChild(el("li", { text: t("az.step_riga", { nome: file.step.nome, ing: file.step.ingombro.map(function (n) { return num(n); }).join(" × "), vol: num(file.step.volume) }) }));
    if (file.pdf) lista.appendChild(el("li", { text: file.pdf.nome + (file.pdf.trovati && file.pdf.trovati.length ? " · " + t("az.letto") + ": " + file.pdf.trovati.map(function (tv) { return trovatoTesto(tv); }).join("; ") : "") }));
    sez.appendChild(lista);
    if (file.esempio && file.step) {
      var slot = el("div", { class: "viewer-slot", text: t("s.preparo3d") });
      sez.appendChild(slot);
      var token = ++az.tokenViewer;
      scaricaBuffer("esempi/pezzi/" + file.esempio + ".step").then(window.FILE.leggiStep).then(function (r) { return window.FILE.creaViewer(r.meshes); }).then(function (v) {
        if (token !== az.tokenViewer) { v.dispose(); return; }
        az.viewer = v; svuota(slot); slot.classList.add("pronto"); slot.appendChild(v.el);
      }).catch(function (e) { slot.textContent = t("az.anteprima_no") + ": " + erroreFile(e); });
      sez.appendChild(el("p", null, el("a", { href: "esempi/pezzi/" + file.esempio + ".pdf", target: "_blank", rel: "noopener", text: t("az.apri_pdf") })));
    } else if (file.step || file.pdf) {
      sez.appendChild(el("p", { class: "aiuto", text: t("az.file_browser") }));
    }
    return sez;
  }

  function tabSchedario() {
    var cont = el("div");
    cont.appendChild(el("p", { class: "aiuto", text: t("sc.intro") }));
    // Ogni riga: nome a sinistra, valore con unita' a destra. Colonne fisse, cosi' tutte le righe sono allineate.
    function tabella(titolo, righe) {
      var lista = el("div", { class: "sched-righe" });
      righe.forEach(function (r) {
        var input = el("input", { class: "input", type: "number", min: 0, step: "any", value: r.valore, "aria-label": r.nome });
        input.addEventListener("change", function () { var v = parseFloat(input.value.replace(",", ".")); if (isFinite(v) && v >= 0) { r.salva(v); salvaOverride(); } disegnaAzienda(); });
        lista.appendChild(el("div", { class: "sched-riga" },
          el("span", { class: "sched-nome", text: r.nome }),
          el("div", { class: "input-unita sched-campo" }, input, el("span", { class: "unita", text: r.unita }))));
      });
      return el("div", { class: "card schedario-blocco" }, el("h3", { text: titolo }), lista);
    }
    var tariffe = Object.keys(S.macchine).map(function (id) {
      return { nome: macNome(id), valore: S.macchine[id].tariffaOra, unita: t("u.eur_h"), salva: function (v) { S.macchine[id].tariffaOra = v; } };
    }).concat([{ nome: t("sc.isola"), valore: S.assemblaggi.tariffaIsolaOra, unita: t("u.eur_h"), salva: function (v) { S.assemblaggi.tariffaIsolaOra = v; } }]);
    var materiali = S.materiali.map(function (m) {
      return { nome: nm("mat", m), valore: m.prezzoKg, unita: t("u.eur_kg"), salva: function (v) { m.prezzoKg = v; } };
    });
    var margine = [{ nome: t("sc.margine_costo"), valore: Math.round(S.margine * 100), unita: "%", salva: function (v) { S.margine = v / 100; } }];
    cont.appendChild(el("div", { class: "sched-griglia" },
      el("div", { class: "sched-colonna" }, tabella(t("sc.tariffe"), tariffe), tabella(t("sc.margine"), margine)),
      tabella(t("sc.materiali"), materiali)));
    cont.appendChild(el("div", { class: "az-azioni" },
      el("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: function () { ripristinaSchedario(); disegnaAzienda(); } }, t("sc.ripristina")),
      el("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: function () { scrivi("richieste", null); try { localStorage.removeItem("richieste"); } catch (e) { /* ok */ } az.sel = null; disegnaAzienda(); } }, t("sc.ripristina_rich"))));
    return cont;
  }

  /* ==========================================================================
     NAVIGAZIONE, TEMA, LINGUA, MENU
     ========================================================================== */
  // Riporta la demo come al primo accesso: richieste, schedario e configurazione in corso.
  // Il tema chiaro/scuro e la lingua scelti non vengono toccati.
  function azzeraDemo() {
    ["richieste", "richiesteVer", "schedarioOverride"].forEach(function (k) {
      delete memoria[k];
      try { localStorage.removeItem(k); } catch (e) { /* ok */ }
    });
    ripristinaSchedario();
    scartaFile();
    cfg.passo = 1; cfg.dati = null; cfg.inviata = null; cfg.accetta = false; cfg.errori = {}; cfg.ultimoTotale = null;
    cfg.contatti = { azienda: "", nome: "", email: "", telefono: "", note: "" };
    az.sel = null; az.tab = "richieste"; az.kpiAnimati = false;
    seedRichieste();
    try { history.replaceState({ cfgPasso: 1 }, "", location.pathname + location.search + "#/"); } catch (e) { /* ok */ }
    disegna(); route();
  }
  // Pulsante con doppio clic: il primo chiede conferma, il secondo azzera (niente finestre del browser)
  function bottoneAzzera(classe) {
    var b = el("button", { type: "button", class: classe }, t("z.btn"));
    var timer = null;
    b.addEventListener("click", function () {
      if (!b.dataset.conferma) {
        b.dataset.conferma = "1"; b.textContent = t("z.conferma");
        timer = setTimeout(function () { delete b.dataset.conferma; b.textContent = t("z.btn"); }, 5000);
      } else {
        clearTimeout(timer); azzeraDemo();
        delete b.dataset.conferma; b.textContent = t("z.fatto");
        setTimeout(function () { b.textContent = t("z.btn"); }, 2500);
      }
    });
    return b;
  }

  function vaiA(id) {
    var e = document.getElementById(id);
    if (e) e.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }
  // Etichette dei pulsanti "Vista azienda" / "Torna al sito" (intestazione e menu del telefono)
  function etichetteNav(inAzienda) {
    var testo = inAzienda ? t("nav.torna") : t("nav.azienda");
    document.getElementById("btn-vista-azienda").textContent = testo;
    var vm = document.getElementById("menu-azienda");
    vm.textContent = testo;
    vm.setAttribute("href", inAzienda ? "#/" : "#/azienda");
  }
  function route() {
    var h = location.hash || "#/";
    var inAzienda = h.indexOf("#/azienda") === 0;
    document.getElementById("vista-pubblica").hidden = inAzienda;
    document.getElementById("vista-azienda").hidden = !inAzienda;
    etichetteNav(inAzienda);
    if (inAzienda) {
      if (!az.dentro) az.kpiAnimati = false; // entrando nella vista azienda gli indicatori si contano da zero
      az.dentro = true;
      var m = h.match(/^#\/azienda\/(RIC-\d+)/); if (m) { az.sel = m[1]; az.tab = "richieste"; }
      disegnaAzienda(); window.scrollTo(0, 0);
    } else if (h.length > 2 && h.charAt(1) !== "/") {
      az.dentro = false;
      setTimeout(function () { vaiA(h.slice(1)); }, 0);
    } else { window.scrollTo(0, 0); }
    impostaMenu(false);
  }
  // Menu a tendina del telefono: apre/chiude e tiene allineati classe, icona (barrette/croce) ed etichetta
  function impostaMenu(aperto) {
    var m = document.getElementById("menu"), b = document.getElementById("btn-menu");
    if (!m || !b) return;
    m.classList.toggle("aperto", aperto);
    b.setAttribute("aria-expanded", String(aperto));
    b.setAttribute("aria-label", t(aperto ? "menu.chiudi" : "menu.apri"));
  }

  // Selettore di lingua: due copie (intestazione e menu del telefono), stessi pulsanti
  function creaLingue() {
    document.querySelectorAll("[data-lingue]").forEach(function (slot) {
      svuota(slot);
      L.LINGUE.forEach(function (l) {
        slot.appendChild(el("button", { type: "button", class: "lingua", "data-lingua": l, "aria-pressed": String(L.corrente() === l), "aria-label": t("lang." + l), onclick: function () { cambiaLingua(l); } }, l.toUpperCase()));
      });
    });
  }
  // Immagini 3D dei quattro reparti (img/reparto-*.webp, creati da Massimo con un generatore di immagini e normalizzati: stesso esagono, quadrati 640x640)
  function fotoReparto(r, classe, miniatura) {
    var lato = miniatura ? 320 : 640;
    return el("img", { class: classe, src: "img/" + (miniatura ? "mini-" : "reparto-") + r + ".webp", alt: "", width: lato, height: lato, loading: "lazy", decoding: "async" });
  }  var tilesViste = false;
  function costruisciTile() {
    var griglia = document.getElementById("griglia-reparti");
    svuota(griglia);
    REPARTI.forEach(function (r, i) {
      var tile = el("button", { type: "button", class: "reparto-tile rivela" + (tilesViste ? " visto subito" : ""), style: "--ritardo:" + (i * 0.09) + "s", onclick: function () { scegliReparto(r); } },
        el("div", { class: "rt-testa" }, fotoReparto(r, "rt-foto")),
        el("div", { class: "rt-testo" }, el("h3", { text: repNome(r) }), el("p", { text: t("rep." + r + ".desc") })),
        el("span", { class: "vai", text: t("vai.configura") }));
      griglia.appendChild(tile);
    });
  }

  // Comparsa allo scorrimento e numeri che si contano da soli
  var osservatore = null;
  function marcaRivela() {
    var gruppi = ["#reparti .contenitore > .sopratitolo", "#reparti .contenitore > h2", "#come .contenitore > .sopratitolo", "#come .contenitore > h2", ".passi li",
      "#numeri .numeri > div", "#configuratore .contenitore > .sopratitolo", "#configuratore .contenitore > h2", "#configuratore .contenitore > .intro"];
    gruppi.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (e, i) {
        if (!e.classList.contains("rivela")) { e.classList.add("rivela"); e.style.setProperty("--ritardo", (i * 0.1) + "s"); }
      });
    });
  }
  function contaNumero(e) {
    var fine = parseInt(e.getAttribute("data-conta"), 10), suff = e.getAttribute("data-suffisso") || "";
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !isFinite(fine)) { e.textContent = fine + suff; return; }
    var t0 = null, durata = 1300;
    e.textContent = "0" + suff;
    function passo(ora) {
      if (t0 === null) t0 = ora;
      var p = Math.min(1, (ora - t0) / durata), ease = 1 - Math.pow(1 - p, 3);
      e.textContent = Math.round(fine * ease) + suff;
      if (p < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  }
  function avviaRivela() {
    var daVedere = document.querySelectorAll(".rivela:not(.visto)");
    if (!("IntersectionObserver" in window)) { daVedere.forEach(function (e) { e.classList.add("visto"); }); return; }
    if (!osservatore) {
      osservatore = new IntersectionObserver(function (voci) {
        voci.forEach(function (v) {
          if (!v.isIntersecting) return;
          var e = v.target;
          e.classList.add("visto"); osservatore.unobserve(e);
          if (e.classList.contains("reparto-tile")) tilesViste = true;
          var n = e.querySelector && e.querySelector("[data-conta]");
          if (n) contaNumero(n);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    }
    daVedere.forEach(function (e) { osservatore.observe(e); });
  }
  // Barra dei materiali: ripete le parole quanto serve per coprire QUALSIASI larghezza (mai spazio vuoto) e tiene la stessa velocita'
  var marqueeTimer = 0;
  function riempiMarquee() {
    var pista = document.querySelector(".marquee-pista");
    if (!pista) return;
    var liste = pista.querySelectorAll(".marquee-lista");
    if (liste.length < 2) return;
    var serie = Array.prototype.slice.call(liste[0].querySelectorAll("span[data-i18n]")).slice(0, 6); // una sola serie, nella lingua corrente
    if (!serie.length) return;
    var riempi = function (lista, n) {
      svuota(lista);
      for (var i = 0; i < n; i++) serie.forEach(function (s) { lista.appendChild(s.cloneNode(true)); });
    };
    var copia = serie.map(function (s) { return s.cloneNode(true); });
    serie = copia;
    riempi(liste[0], 1); riempi(liste[1], 1);
    var w1 = liste[0].getBoundingClientRect().width;
    if (!w1) return;
    var n = Math.max(1, Math.ceil(window.innerWidth / w1)); // una serie deve coprire almeno tutto lo schermo
    riempi(liste[0], n); riempi(liste[1], n);
    pista.style.animationDuration = Math.max(12, Math.round((w1 * n) / 55)) + "s"; // circa 55 px al secondo su ogni schermo
  }
  function programmaMarquee() { clearTimeout(marqueeTimer); marqueeTimer = setTimeout(riempiMarquee, 120); }

  // Aggiorna tutto cio' che dipende dalla lingua, senza perdere cio' che l'utente ha inserito
  function aggiornaLingua() {
    riempiMarquee();
    creaLingue();
    costruisciTile();
    var slot = document.getElementById("azzera-slot"); svuota(slot); slot.appendChild(bottoneAzzera("link-piede"));
    avviaRivela();
    disegna();
    var inAzienda = (location.hash || "").indexOf("#/azienda") === 0;
    etichetteNav(inAzienda);
    if (inAzienda) disegnaAzienda();
  }
  function cambiaLingua(l) { L.imposta(l); aggiornaLingua(); }

  function avvio() {
    L.iniziale();
    applicaOverride();
    seedRichieste(); // le richieste di esempio esistono subito, cosi' la numerazione parte da RIC-0004
    radice = document.getElementById("configuratore-app");
    aggiornaLinguaIniziale();

    document.getElementById("btn-vista-azienda").addEventListener("click", function () {
      location.hash = (location.hash.indexOf("#/azienda") === 0) ? "#/" : "#/azienda";
    });
    document.getElementById("btn-tema").addEventListener("click", function () {
      var nuovo = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", nuovo);
      this.setAttribute("aria-pressed", String(nuovo === "dark"));
      try { localStorage.setItem("tema", nuovo); } catch (e) { /* ok */ }
    });
    document.getElementById("btn-tema").setAttribute("aria-pressed", String(document.documentElement.getAttribute("data-theme") === "dark"));
    // Menu a tendina del telefono: si chiude col tondino, toccando fuori dalla tendina, con Esc, scegliendo una voce o ruotando/ingrandendo lo schermo
    var menuEl = document.getElementById("menu"), btnMenu = document.getElementById("btn-menu");
    btnMenu.addEventListener("click", function () { impostaMenu(!menuEl.classList.contains("aperto")); });
    // tocco fuori: chiude e (se non e' sulla barra in alto) non fa altro, cosi' non si preme per sbaglio un pulsante sotto
    document.addEventListener("click", function (ev) {
      if (!menuEl.classList.contains("aperto")) return;
      if (menuEl.contains(ev.target) || btnMenu.contains(ev.target)) return;
      impostaMenu(false);
      if (!ev.target.closest || !ev.target.closest(".top")) { ev.preventDefault(); ev.stopPropagation(); }
    }, true);
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && menuEl.classList.contains("aperto")) { impostaMenu(false); btnMenu.focus(); }
    });
    window.addEventListener("resize", function () { if (window.innerWidth >= 1050 && menuEl.classList.contains("aperto")) impostaMenu(false); });
    document.querySelectorAll("[data-vai]").forEach(function (a) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        if (location.hash.indexOf("#/azienda") === 0) { location.hash = "#" + a.getAttribute("data-vai"); }
        else { vaiA(a.getAttribute("data-vai")); impostaMenu(false); }
      });
    });
    window.addEventListener("hashchange", route);
    // Se cambia la disposizione (es. iPad che ruota) il pezzo 3D cambia posto: ridisegna il passo 2
    var cambioDisposizione = function () { if (cfg.passo === 2 && radice) disegna(); };
    if (mqAffiancato.addEventListener) mqAffiancato.addEventListener("change", cambioDisposizione); else mqAffiancato.addListener(cambioDisposizione);
    // Freccia indietro / tasto indietro del mouse: si torna al passo precedente del configuratore
    window.addEventListener("popstate", function (ev) {
      var s = ev.state;
      if (!s || typeof s.cfgPasso !== "number") return;
      var n = s.cfgPasso;
      if (n > 1 && !cfg.dati) n = 1;               // pagina ricaricata: i dati del pezzo non ci sono piu'
      if (n === 4 && !cfg.inviata) n = 1;
      if (n < 4) cfg.inviata = null;               // tornando indietro dopo l'invio si puo' compilare una nuova richiesta
      cfg.passo = n;
      disegna();
      if (!document.getElementById("vista-pubblica").hidden) vaiA("configuratore");
    });

    // Collegamento diretto per prove: ?reparto=tornitura  (apre il passo 2)
    var q = new URLSearchParams(location.search), rp = q.get("reparto");
    if (rp && REPARTI.indexOf(rp) >= 0) { cfg.dati = nuoviDati(rp); cfg.passo = 2; }
    try { history.replaceState({ cfgPasso: cfg.passo }, "", location.href); } catch (e) { /* ok */ }
    disegna();
    route();
    riempiMarquee();
    window.addEventListener("resize", programmaMarquee);
    window.addEventListener("load", riempiMarquee);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(riempiMarquee);
  }
  // Prima disegnata: stesso lavoro di aggiornaLingua ma senza toccare cio' che non esiste ancora
  function aggiornaLinguaIniziale() {
    creaLingue();
    costruisciTile();
    document.getElementById("azzera-slot").appendChild(bottoneAzzera("link-piede"));
    marcaRivela();
    avviaRivela();
  }

  document.addEventListener("DOMContentLoaded", avvio);
})();
