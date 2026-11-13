/* APP: pagina pubblica, configuratore a passi, vista azienda. Tutto nel browser, nessun server. */
(function () {
  "use strict";

  var S = window.SCHEDARIO;
  var P = window.PREZZI;
  var BASE = JSON.parse(JSON.stringify(S)); // copia dei valori originali, per "Ripristina"

  var EUR = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
  var NUM = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });
  function eur(n) { return EUR.format(n); }

  /* ---------- Utilita' ---------- */
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
  var REPARTI = [
    { id: "tornitura", nome: "Tornitura", desc: "Più di 14 centri di tornitura per pezzi tornati, anche con asse Y e utensili motorizzati." },
    { id: "fresatura", nome: "Fresatura", desc: "11 centri di fresatura a 3, 4 e 5 assi per componenti prismatici e complessi." },
    { id: "cavi", nome: "Cavi e Trasmissioni Flessibili", desc: "Funi, terminali, chiusure personalizzate, tiranti per arredo e trasmissioni flessibili." },
    { id: "assemblaggi", nome: "Assemblaggi", desc: "Sette isole di assemblaggio con pressa e codificatori, per serie piccole e medie." }
  ];
  function reparto(id) { return trova(REPARTI, id); }

  var STATI = [
    { id: "ricevuta", nome: "Ricevuta" },
    { id: "in-valutazione", nome: "In valutazione" },
    { id: "offerta-inviata", nome: "Offerta inviata" }
  ];

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
  function descrivi(d) {
    var righe = [["Reparto", reparto(d.reparto).nome]];
    var mat = d.materiale ? trova(S.materiali, d.materiale) : null;
    if (d.reparto === "tornitura" || d.reparto === "fresatura") {
      righe.push(["Macchina", S.macchine[d.macchina].nome]);
      righe.push(["Materiale", mat.nome]);
      var g = d.geometria;
      righe.push(["Misure", d.reparto === "tornitura" ? "Ø " + g.diametro + " × " + g.lunghezza + " mm" : g.x + " × " + g.y + " × " + g.z + " mm"]);
      if (g.volumeFinito) righe.push(["Volume del pezzo (file)", NUM.format(g.volumeFinito) + " cm³"]);
      righe.push(["Complessità", trova(S.complessita, d.complessita).nome]);
      righe.push(["Tolleranze", trova(S.tolleranze, d.tolleranza).nome]);
      righe.push(["Finitura", trova(S.finiture, d.finitura).nome]);
    } else if (d.reparto === "cavi") {
      righe.push(["Prodotto", trova(S.cavi.prodotti, d.prodotto).nome]);
      righe.push(["Diametro e lunghezza", "Ø " + d.diametro + " mm × " + d.lunghezza + " mm"]);
      righe.push(["Guaina", trova(S.cavi.guaine, d.guaina).nome]);
      righe.push(["Terminale A", trova(S.cavi.terminali, d.terminaleA).nome]);
      righe.push(["Terminale B", trova(S.cavi.terminali, d.terminaleB).nome]);
    } else {
      var ops = Object.keys(d.opN).filter(function (k) { return d.opN[k] > 0; }).map(function (k) { return trova(S.assemblaggi.operazioni, k).nome + " ×" + d.opN[k]; });
      righe.push(["Operazioni", ops.join(", ") || "—"]);
      righe.push(["Componenti per pezzo", String(d.componenti)]);
      righe.push(["Costo componenti", d.costoComponentiPezzo > 0 ? eur(d.costoComponentiPezzo) + " / pz" : "Forniti dal cliente"]);
    }
    righe.push(["Collaudo", trova(S.collaudi, d.collaudo).nome]);
    righe.push(["Urgenza", trova(S.urgenze, d.urgenza).nome]);
    righe.push(["Quantità", d.quantita + " pz"]);
    return righe;
  }
  function titoloPezzo(d) {
    if (d.reparto === "cavi") return trova(S.cavi.prodotti, d.prodotto).nome + " Ø" + d.diametro + " × " + d.lunghezza + " mm";
    if (d.reparto === "assemblaggi") return "Assemblaggio (" + d.componenti + " componenti)";
    var g = d.geometria;
    return reparto(d.reparto).nome + " in " + trova(S.materiali, d.materiale).nome + (d.reparto === "tornitura" ? " Ø" + g.diametro + " × " + g.lunghezza : " " + g.x + "×" + g.y + "×" + g.z) + " mm";
  }

  /* ---------- Stato del configuratore ---------- */
  var cfg = { passo: 1, dati: null, contatti: { azienda: "", nome: "", email: "", telefono: "", note: "" }, accetta: false, errori: {}, inviata: null, file: null, tokenFile: 0 };
  var radice = null;      // contenitore #configuratore-app
  var pannelloPrezzo = null;

  /* ---------- Componenti del modulo ---------- */
  // Bollino "dal file" sui campi compilati dalla lettura di STEP/PDF; sparisce quando l'utente cambia il valore a mano
  function badgeFile(chiave) {
    return chiave && cfg.file && cfg.file.compilati && cfg.file.compilati[chiave] ? el("span", { class: "badge badge-blu dal-file", text: "dal file" }) : null;
  }
  function togliDalFile(chiave) { if (cfg.file && cfg.file.compilati) delete cfg.file.compilati[chiave]; }

  function gruppoScelte(etichetta, voci, valore, alScelta, aiuto, chiave) {
    var box = el("div", { class: "cfg-gruppo" }, el("span", { class: "etichetta" }, etichetta, badgeFile(chiave)));
    var scelte = el("div", { class: "scelte", role: "group", "aria-label": etichetta });
    voci.forEach(function (v) {
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
      el("button", { type: "button", "aria-label": "Diminuisci", onclick: function () { vai(-1); } }, "−"), span,
      el("button", { type: "button", "aria-label": "Aumenta", onclick: function () { vai(1); } }, "+"));
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
    { id: "perno-inox", nome: "Perno a gradini", sub: "Tornitura · inox 304", rep: "tornitura", macchina: "tornio", complessita: "media" },
    { id: "boccola-bronzo", nome: "Boccola", sub: "Tornitura · bronzo", rep: "tornitura", macchina: "tornio", complessita: "semplice" },
    { id: "flangia-acciaio", nome: "Flangia con mozzo", sub: "Tornitura · acciaio C45", rep: "tornitura", macchina: "tornio-y", complessita: "media" },
    { id: "staffa-alluminio", nome: "Staffa ad L", sub: "Fresatura · alluminio", rep: "fresatura", macchina: "fresa-3", complessita: "media" },
    { id: "piastra-tasche", nome: "Piastra con tasche", sub: "Fresatura · alluminio", rep: "fresatura", macchina: "fresa-4", complessita: "complessa" }
  ];
  var PRESET = {
    cavi: [
      { nome: "Fune inox con occhiello e forcella", sub: "Ø3 · 1,5 m · 100 pz", dati: { prodotto: "fune-inox", diametro: 3, lunghezza: 1500, guaina: "pvc", terminaleA: "occhiello", terminaleB: "forcella", quantita: 100 } },
      { nome: "Tirante per arredo", sub: "Ø4 · 2,5 m · 40 pz", dati: { prodotto: "fune-inox-19", diametro: 4, lunghezza: 2500, guaina: "nessuna", terminaleA: "filettato", terminaleB: "filettato", quantita: 40 } },
      { nome: "Trasmissione flessibile", sub: "Ø5 · 0,8 m · 250 pz", dati: { prodotto: "trasmissione", diametro: 5, lunghezza: 800, guaina: "nylon", terminaleA: "sfera", terminaleB: "forcella", quantita: 250 } }
    ],
    assemblaggi: [
      { nome: "Gruppo pressato con codifica", sub: "4 componenti · 200 pz", dati: { componenti: 4, costoComponentiPezzo: 2.5, opN: { pressatura: 2, avvitatura: 0, codifica: 1, montaggio: 0, controllo: 1 }, quantita: 200 } },
      { nome: "Assemblaggio con avvitatura", sub: "6 componenti · 120 pz", dati: { componenti: 6, costoComponentiPezzo: 4, opN: { pressatura: 0, avvitatura: 4, codifica: 1, montaggio: 2, controllo: 1 }, quantita: 120 } }
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
      r.onerror = function () { ko(new Error("Non riesco a leggere il file.")); };
      r.readAsArrayBuffer(file);
    });
  }
  function scaricaBuffer(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("Esempio non trovato (" + r.status + ").");
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
      var msg = "Formato non supportato: carica un file STEP (.step, .stp) o un PDF.";
      if (cfg.file && (cfg.file.step || cfg.file.pdf)) cfg.file.errori = [msg];   // i file già caricati restano
      else { scartaFile(); cfg.file = { errori: [msg], avvisi: [] }; }
      disegna(); return;
    }
    var voci = [];
    if (step) voci.push({ nome: step.name, tipo: "step", dimensione: step.size, leggi: function () { return leggiBuffer(step); } });
    if (pdf) voci.push({ nome: pdf.name, tipo: "pdf", dimensione: pdf.size, leggi: function () { return leggiBuffer(pdf); } });
    eseguiCaricamento(voci, null, true); // true = i file già caricati dell'altro tipo restano (STEP + PDF si sommano)
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

  function eseguiCaricamento(voci, esempioId, mantieni) {
    // Con "mantieni", lo STEP già letto resta se ora si aggiunge un PDF (e viceversa)
    var prec = mantieni && cfg.file && !cfg.file.caricamento ? cfg.file : null;
    var tieneStep = !!(prec && prec.step && !voci.some(function (v) { return v.tipo === "step"; }));
    var tienePdf = !!(prec && prec.pdf && !voci.some(function (v) { return v.tipo === "pdf"; }));
    var viewerTenuto = tieneStep ? prec.viewer : null;
    if (cfg.file && cfg.file.viewer && cfg.file.viewer !== viewerTenuto) cfg.file.viewer.dispose();
    var token = ++cfg.tokenFile;
    cfg.file = { caricamento: true, nomi: voci.map(function (v) { return v.nome; }), viewer: viewerTenuto };
    disegna();
    var d = cfg.dati;
    var compiti = voci.map(function (v) {
      if (v.dimensione && v.dimensione > MAX_FILE) return Promise.resolve({ tipo: v.tipo, nome: v.nome, errore: "«" + v.nome + "» è troppo grande (massimo 40 MB)." });
      return v.leggi().then(function (buf) {
        return (v.tipo === "step" ? window.FILE.leggiStep(buf) : window.FILE.leggiPdf(buf)).then(function (r) { return { tipo: v.tipo, nome: v.nome, r: r }; });
      }).catch(function (e) { return { tipo: v.tipo, nome: v.nome, errore: "«" + v.nome + "»: " + (e && e.message ? e.message : "lettura non riuscita.") }; });
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
        }).catch(function (e) { f.viewerErrore = e.message; disegna(); });
      }
    });
  }
  function applicaStep(f, x, d) {
    var r = x.r, rep = d.reparto;
    var m = window.FILE.proponiMisure(r.ingombro, rep);
    if (rep === "tornitura") {
      d.geometria = { diametro: m.diametro, lunghezza: m.lunghezza, volumeFinito: r.volumeCm3 };
      if (!m.tondo) f.avvisiStep.push("Il pezzo non sembra rotondo: se è prismatico conviene la fresatura. Controlla le misure.");
    } else {
      d.geometria = { x: m.x, y: m.y, z: m.z, volumeFinito: r.volumeCm3 };
    }
    f.compilati.misure = true;
    if (r.corpi > 1) f.avvisiStep.push("Il file contiene " + r.corpi + " corpi: il volume è la somma di tutti.");
    f.step = { nome: x.nome, ingombro: r.ingombro, volume: r.volumeCm3, meshes: r.meshes };
  }
  function applicaPdf(f, x, d) {
    var r = x.r, c = r.campi;
    f.pdf = { nome: x.nome, trovati: r.trovati, canvas: r.canvas, haTesto: r.haTesto, titolo: r.titolo };
    if (!r.haTesto) { f.avvisiPdf.push("Il PDF non contiene testo leggibile (forse è una scansione): mostro solo l'anteprima, compila i dati a mano."); return; }
    if (!r.trovati.length) { f.avvisiPdf.push("Nel PDF non ho trovato un cartiglio riconoscibile (materiale, quantità, tolleranze): compila i dati a mano."); return; }
    if (d.reparto !== "tornitura" && d.reparto !== "fresatura") return;
    if (c.materiale && trova(S.materiali, c.materiale)) { d.materiale = c.materiale; f.compilati.materiale = true; }
    if (c.tolleranza) { d.tolleranza = c.tolleranza; f.compilati.tolleranza = true; }
    if (c.quantita) { d.quantita = c.quantita; f.compilati.quantita = true; }
    if (c.finitura) {
      var fin = trova(S.finiture, c.finitura), mat = trova(S.materiali, d.materiale);
      if (fin.gruppi && fin.gruppi.indexOf(mat.gruppo) < 0) f.avvisiPdf.push("Il disegno indica «" + fin.nome + "», che non è adatta a questo materiale: non è stata applicata.");
      else { d.finitura = c.finitura; f.compilati.finitura = true; }
    }
  }

  function cardFile(rep) {
    var f = cfg.file;
    var box = el("div", { class: "file-card cfg-gruppo" });
    if (rep === "tornitura" || rep === "fresatura") {
      box.appendChild(el("span", { class: "etichetta", text: "Carica il disegno (facoltativo)" }));
      box.appendChild(el("p", { class: "aiuto", text: "Con un file STEP leggo le misure e il volume del pezzo e il prezzo diventa più preciso. Con un PDF leggo il cartiglio (materiale, quantità, tolleranze). I file restano nel tuo browser." }));
      var input = el("input", { type: "file", id: "file-in", class: "file-input", accept: ".step,.stp,.pdf,application/pdf", multiple: true, "aria-label": "Scegli un file STEP o PDF" });
      input.addEventListener("change", function () { if (input.files.length) caricaFileUtente(input.files); });
      // Il testo della zona guida il passo dopo: se c'è solo lo STEP chiede il PDF, e viceversa
      var haStep = !!(f && f.step), haPdf = !!(f && f.pdf), titoloZona, testoZona;
      if (haStep && !haPdf) { titoloZona = "Aggiungi anche il PDF del disegno"; testoZona = "Trascinalo qui o clicca: leggo materiale, quantità e tolleranze dal cartiglio"; }
      else if (haPdf && !haStep) { titoloZona = "Aggiungi anche il file STEP"; testoZona = "Trascinalo qui o clicca: leggo misure e volume e ti mostro il pezzo in 3D"; }
      else if (haStep && haPdf) { titoloZona = "Vuoi cambiare un file?"; testoZona = "Trascina qui un nuovo STEP o PDF: sostituisce quello dello stesso tipo"; }
      else { titoloZona = "Trascina qui il disegno"; testoZona = "oppure clicca per scegliere un file · STEP, STP o PDF (anche tutti e due insieme)"; }
      var zona = el("div", { class: "dropzone", tabindex: "0", role: "button", "aria-label": titoloZona },
        el("strong", { text: titoloZona }), el("span", { text: testoZona }));
      zona.addEventListener("click", function () { input.click(); });
      zona.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); input.click(); } });
      zona.addEventListener("dragover", function (ev) { ev.preventDefault(); zona.classList.add("sopra"); });
      zona.addEventListener("dragleave", function () { zona.classList.remove("sopra"); });
      zona.addEventListener("drop", function (ev) { ev.preventDefault(); zona.classList.remove("sopra"); if (ev.dataTransfer && ev.dataTransfer.files.length) caricaFileUtente(ev.dataTransfer.files); });
      box.appendChild(input); box.appendChild(zona);
      box.appendChild(el("span", { class: "etichetta", style: "margin-top:1rem;display:block", text: "Oppure prova con un pezzo di esempio" }));
      var chips = el("div", { class: "scelte" });
      ESEMPI.forEach(function (e) {
        chips.appendChild(el("button", { type: "button", class: "scelta", onclick: function () { caricaEsempio(e.id); } }, e.nome, el("small", { text: e.sub })));
      });
      box.appendChild(chips);
      if (f) box.appendChild(esitoFile(f));
    } else {
      box.appendChild(el("span", { class: "etichetta", text: "Configurazioni di esempio" }));
      var ch2 = el("div", { class: "scelte" });
      PRESET[rep].forEach(function (p) {
        ch2.appendChild(el("button", { type: "button", class: "scelta", onclick: function () {
          var d = cfg.dati; Object.keys(p.dati).forEach(function (k) { d[k] = JSON.parse(JSON.stringify(p.dati[k])); }); aggiorna();
        } }, p.nome, el("small", { text: p.sub })));
      });
      box.appendChild(ch2);
    }
    return box;
  }
  function esitoFile(f) {
    var out = el("div", { class: "file-esito stack", "aria-live": "polite" });
    if (f.caricamento) { out.appendChild(el("p", { class: "aiuto", text: "Leggo " + f.nomi.join(" e ") + "… la prima volta può servire qualche secondo." })); return out; }
    (f.errori || []).forEach(function (e) { out.appendChild(el("div", { class: "avviso avviso-errore", role: "alert", text: e })); });
    if ((f.errori || []).length && !f.step && !f.pdf) { out.appendChild(el("p", { class: "aiuto", text: "Puoi comunque inserire le misure a mano, qui sotto." })); }
    if (f.step) {
      var mat = trova(S.materiali, cfg.dati.materiale);
      var peso = mat ? f.step.volume * mat.densita / 1000 : null;
      var dati = el("dl", { class: "riepilogo", style: "grid-template-columns:1fr" },
        el("div", null, el("dt", { text: "File STEP" }), el("dd", { text: f.step.nome })),
        el("div", null, el("dt", { text: "Ingombro" }), el("dd", { text: f.step.ingombro.map(function (n) { return NUM.format(n); }).join(" × ") + " mm" })),
        el("div", null, el("dt", { text: "Volume" }), el("dd", { text: NUM.format(f.step.volume) + " cm³" })),
        peso ? el("div", null, el("dt", { text: "Peso in " + mat.nome }), el("dd", { text: NUM.format(Math.round(peso * 1000) / 1000) + " kg" })) : null);
      var vis = f.viewer ? f.viewer.el : el("div", { class: "viewer3d viewer-attesa", text: f.viewerErrore || "Preparo l'anteprima 3D…" });
      out.appendChild(el("div", { class: "file-step" }, vis, el("div", null, dati,
        el("p", { class: "aiuto", text: f.volumeIgnorato ? "Hai cambiato le misure: il volume del file non viene più usato." : "Misure e volume sono già inseriti qui sotto: puoi correggerli. Trascina l'anteprima per ruotare il pezzo." }))));
    }
    if (f.pdf) {
      var pdfBox = el("div", { class: "file-pdf" }, f.pdf.canvas);
      var lato = el("div", null, el("span", { class: "etichetta", text: "PDF: " + f.pdf.nome }));
      if (f.pdf.trovati.length) {
        lato.appendChild(el("p", { class: "aiuto", text: "Letto dal cartiglio e inserito nei campi:" }));
        lato.appendChild(el("ul", { class: "note-prezzo" }, f.pdf.trovati.map(function (t) { return el("li", { text: t }); })));
      }
      pdfBox.appendChild(lato); out.appendChild(pdfBox);
    }
    tuttiGliAvvisi(f).forEach(function (a) { out.appendChild(el("div", { class: "avviso", role: "status", text: a })); });
    out.appendChild(el("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: function () { scartaFile(); disegna(); } }, "Rimuovi i file"));
    return out;
  }

  /* ---------- Passo 1: reparto ---------- */
  function passoReparto() {
    var box = el("div", { class: "card cfg-box" }, el("h3", { text: "Che lavorazione ti serve?" }));
    var griglia = el("div", { class: "reparto-scelta" });
    REPARTI.forEach(function (r) {
      griglia.appendChild(el("button", { type: "button", class: "scelta", "aria-pressed": "false", onclick: function () { scegliReparto(r.id); } },
        r.nome, el("small", { text: r.desc })));
    });
    box.appendChild(griglia);
    return box;
  }
  function scegliReparto(id, saltaScroll) {
    scartaFile();
    cfg.dati = nuoviDati(id); cfg.inviata = null; cfg.errori = {};
    vaiPasso(2);
    if (!saltaScroll) vaiA("configuratore");
  }

  /* ---------- Passo 2: dettagli del pezzo ---------- */
  function materialiCompatibili() {
    return S.materiali.map(function (m) { return { id: m.id, nome: m.nome, sub: NUM.format(m.prezzoKg) + " €/kg" }; });
  }
  function passoDettagli() {
    var d = cfg.dati, rep = d.reparto;
    var box = el("div", { class: "card cfg-box" }, el("h3", { text: reparto(rep).nome + ": descrivi il pezzo" }));
    box.appendChild(cardFile(rep));

    if (rep === "tornitura" || rep === "fresatura") {
      var macchine = rep === "tornitura" ? ["tornio", "tornio-y"] : ["fresa-3", "fresa-4", "fresa-5"];
      box.appendChild(gruppoScelte("Macchina", macchine.map(function (id) { return { id: id, nome: S.macchine[id].nome }; }), d.macchina,
        function (v) { d.macchina = v; aggiorna(); },
        rep === "tornitura" ? "Il tornio con asse Y serve se ci sono fresature o fori fuori asse." : "Più assi significa meno riprese, ma una tariffa oraria più alta."));
      box.appendChild(gruppoScelte("Materiale", materialiCompatibili(), d.materiale, function (v) {
        d.materiale = v; togliDalFile("materiale");
        var f = trova(S.finiture, d.finitura), m = trova(S.materiali, v);
        if (f.gruppi && f.gruppi.indexOf(m.gruppo) < 0) { d.finitura = "nessuna"; togliDalFile("finitura"); }
        aggiorna();
      }, null, "materiale"));
      var misure = el("div", { class: "cfg-griglia" });
      if (rep === "tornitura") {
        misure.appendChild(campoNumero("Diametro", d.geometria.diametro, "mm", function (v) { modificaMisura(d, "diametro", v); aggiornaPrezzo(); }));
        misure.appendChild(campoNumero("Lunghezza", d.geometria.lunghezza, "mm", function (v) { modificaMisura(d, "lunghezza", v); aggiornaPrezzo(); }));
      } else {
        misure.appendChild(campoNumero("Lunghezza X", d.geometria.x, "mm", function (v) { modificaMisura(d, "x", v); aggiornaPrezzo(); }));
        misure.appendChild(campoNumero("Larghezza Y", d.geometria.y, "mm", function (v) { modificaMisura(d, "y", v); aggiornaPrezzo(); }));
        misure.appendChild(campoNumero("Altezza Z", d.geometria.z, "mm", function (v) { modificaMisura(d, "z", v); aggiornaPrezzo(); }));
      }
      box.appendChild(el("div", { class: "cfg-gruppo" }, el("span", { class: "etichetta" }, "Misure del pezzo finito (ingombro)", badgeFile("misure")), misure));
      box.appendChild(gruppoScelte("Complessità", S.complessita, d.complessita, function (v) { d.complessita = v; aggiorna(); }));
      box.appendChild(gruppoScelte("Tolleranze", S.tolleranze, d.tolleranza, function (v) { d.tolleranza = v; togliDalFile("tolleranza"); aggiorna(); }, null, "tolleranza"));
      var mat = trova(S.materiali, d.materiale);
      box.appendChild(gruppoScelte("Finitura o trattamento", S.finiture.map(function (f) {
        var no = f.gruppi && f.gruppi.indexOf(mat.gruppo) < 0;
        return { id: f.id, nome: f.nome, disabilitata: no ? "Non adatta a questo materiale" : null };
      }), d.finitura, function (v) { d.finitura = v; togliDalFile("finitura"); aggiorna(); }, null, "finitura"));
    }

    if (rep === "cavi") {
      var C = S.cavi, prod = trova(C.prodotti, d.prodotto);
      box.appendChild(gruppoScelte("Prodotto", C.prodotti, d.prodotto, function (v) {
        d.prodotto = v; var p = trova(C.prodotti, v);
        if (p.diametri.indexOf(d.diametro) < 0) d.diametro = p.diametri[Math.min(1, p.diametri.length - 1)];
        aggiorna();
      }));
      box.appendChild(gruppoScelte("Diametro", prod.diametri.map(function (x) { return { id: x, nome: x + " mm" }; }), d.diametro, function (v) { d.diametro = v; aggiorna(); }));
      box.appendChild(el("div", { class: "cfg-gruppo" }, campoNumero("Lunghezza", d.lunghezza, "mm", function (v) { d.lunghezza = v; aggiornaPrezzo(); })));
      box.appendChild(gruppoScelte("Guaina", C.guaine, d.guaina, function (v) { d.guaina = v; aggiorna(); }));
      box.appendChild(gruppoScelte("Terminale lato A", C.terminali.map(function (t) { return { id: t.id, nome: t.nome }; }), d.terminaleA, function (v) { d.terminaleA = v; aggiorna(); }));
      box.appendChild(gruppoScelte("Terminale lato B", C.terminali.map(function (t) { return { id: t.id, nome: t.nome }; }), d.terminaleB, function (v) { d.terminaleB = v; aggiorna(); }));
    }

    if (rep === "assemblaggi") {
      var opBox = el("div", { class: "cfg-gruppo" }, el("span", { class: "etichetta", text: "Operazioni sull'isola di assemblaggio (per pezzo)" }));
      S.assemblaggi.operazioni.forEach(function (op) {
        opBox.appendChild(el("div", { class: "campo", style: "grid-template-columns:1fr auto;align-items:center" },
          el("span", { text: op.nome }), contatore(d.opN[op.id], 0, 20, function (n) { d.opN[op.id] = n; aggiorna(); })));
      });
      box.appendChild(opBox);
      box.appendChild(el("div", { class: "cfg-gruppo" }, el("span", { class: "etichetta", text: "Componenti per pezzo" }), contatore(d.componenti, 0, 100, function (n) { d.componenti = n; aggiorna(); })));
      box.appendChild(el("div", { class: "cfg-gruppo" }, campoNumero("Costo dei componenti, per pezzo (0 se li fornisce il cliente)", d.costoComponentiPezzo, "€", function (v) { d.costoComponentiPezzo = v; aggiornaPrezzo(); })));
    }

    box.appendChild(gruppoScelte("Collaudo", S.collaudi, d.collaudo, function (v) { d.collaudo = v; aggiorna(); }));
    box.appendChild(gruppoScelte("Urgenza", S.urgenze.map(function (u) { return { id: u.id, nome: u.nome, sub: u.sovrapprezzo ? "+" + Math.round(u.sovrapprezzo * 100) + "%" : "tempi normali" }; }), d.urgenza, function (v) { d.urgenza = v; aggiorna(); }));
    box.appendChild(el("div", { class: "cfg-gruppo" }, campoNumero("Quantità", d.quantita, "pz", function (v) { d.quantita = Math.max(1, Math.floor(v) || 1); togliDalFile("quantita"); aggiornaPrezzo(); }, { min: 1, step: 1, chiave: "quantita" })));

    var avanti = el("button", { type: "button", class: "btn btn-primario", id: "btn-avanti", onclick: function () { vaiPasso(3); vaiA("configuratore"); } }, "Continua", el("span", { "aria-hidden": "true", text: "→" }));
    box.appendChild(el("div", { class: "cfg-azioni" },
      el("button", { type: "button", class: "btn btn-ghost", onclick: function () { vaiPasso(1); vaiA("configuratore"); } }, "← Cambia reparto"), avanti));
    return box;
  }

  /* ---------- Pannello prezzo ---------- */
  var COLORI = { materiale: "#0069b4", lavorazione: "#263272", attrezzaggio: "#5b8fd6", finitura: "#7a8bb5", collaudo: "#9bb7e0", urgenza: "#d98b1f", margine: "#8f9ab5" };
  var NOMI_VOCI = { materiale: "Materiale", lavorazione: "Lavorazione", attrezzaggio: "Attrezzaggio macchina", finitura: "Finitura", collaudo: "Collaudo", urgenza: "Urgenza", margine: "Margine" };

  function pannelloPrezzoDOM(d, opz) {
    opz = opz || {};
    var c = calcola(d);
    var box = el("div", { class: "stack" });
    if (c.errore) {
      box.appendChild(el("p", { class: "prezzo-vuoto", text: "Completa i dati per vedere il prezzo." }));
      box.appendChild(el("div", { class: "avviso avviso-errore", role: "status", text: c.errore }));
      return { dom: box, calc: c };
    }
    box.appendChild(el("div", { class: "prezzo-grande", text: eur(c.da) + " – " + eur(c.a) }));
    box.appendChild(el("p", { class: "prezzo-sotto", text: "per " + c.quantita + " pz · circa " + eur(c.perPezzo) + " al pezzo" }));

    var tot = 0; Object.keys(c.voci).forEach(function (k) { tot += c.voci[k]; });
    var barra = el("div", { class: "barra", "aria-hidden": "true" });
    Object.keys(c.voci).forEach(function (k) { if (c.voci[k] > 0) barra.appendChild(el("i", { style: "width:" + (c.voci[k] / tot * 100) + "%;background:" + COLORI[k] })); });
    box.appendChild(barra);
    var voci = el("ul", { class: "voci" });
    Object.keys(c.voci).forEach(function (k) { if (c.voci[k] > 0) voci.appendChild(el("li", null, el("span", { text: NOMI_VOCI[k] }), el("span", { text: eur(c.voci[k]) }))); });
    voci.appendChild(el("li", null, el("strong", { text: "Totale calcolato" }), el("strong", { text: eur(c.totale) })));
    box.appendChild(voci);

    box.appendChild(el("div", { class: "dati-rapidi" },
      el("div", null, el("strong", { text: "~" + c.giorni + " gg" }), el("span", { text: "consegna" })),
      el("div", null, el("strong", { text: NUM.format(c.ore) + " h" }), el("span", { text: "lavorazione" })),
      el("div", null, el("strong", { text: c.pesoPezzoKg ? NUM.format(c.pesoPezzoKg) + " kg" : "—" }), el("span", { text: "peso pezzo" }))));

    if (!opz.senzaTabella) {
      var quantita = [1, 10, 25, 50, 100, 250, 500];
      if (quantita.indexOf(c.quantita) < 0) { quantita.push(c.quantita); quantita.sort(function (a, b) { return a - b; }); }
      var righe = P.tabellaQuantita(perMotore(d), quantita);
      var tab = el("table", { class: "tab-quantita" }, el("thead", null, el("tr", null, el("th", { text: "Quantità" }), el("th", { text: "€ / pezzo" }), el("th", { text: "Totale" }))));
      var tb = el("tbody");
      righe.forEach(function (r) {
        tb.appendChild(el("tr", { class: r.quantita === c.quantita ? "corrente" : null }, el("td", { text: r.quantita + " pz" }), el("td", { text: eur(r.perPezzo) }), el("td", { text: eur(r.totale) })));
      });
      tab.appendChild(tb);
      box.appendChild(el("span", { class: "etichetta", text: "Confronto quantità" }));
      box.appendChild(tab);
    }
    c.avvisi.forEach(function (a) { box.appendChild(el("div", { class: "avviso", role: "status", text: a })); });
    if (c.note.length) box.appendChild(el("ul", { class: "note-prezzo" }, c.note.map(function (n) { return el("li", { text: n }); })));
    return { dom: box, calc: c };
  }
  function disegnaPrezzo() {
    if (!pannelloPrezzo) return;
    var r = pannelloPrezzoDOM(cfg.dati);
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
      cfg.errori[chiave] ? el("span", { class: "errore-campo", role: "alert", text: cfg.errori[chiave] }) : null);
  }
  function passoInvio() {
    var d = cfg.dati;
    var box = el("div", { class: "card cfg-box" }, el("h3", { text: "Riepilogo e invio" }));
    var dl = el("dl", { class: "riepilogo" });
    descrivi(d).forEach(function (r) { dl.appendChild(el("div", null, el("dt", { text: r[0] }), el("dd", { text: r[1] }))); });
    box.appendChild(dl);
    box.appendChild(el("div", { class: "az-barra", style: "margin-bottom:.8rem" },
      el("h3", { text: "I tuoi dati", style: "margin:0" }),
      el("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: function () {
        cfg.contatti = { azienda: "Azienda di prova", nome: "Mario Rossi", email: "mario.rossi@esempio.it", telefono: "0461 000000", note: "Richiesta di prova per la demo." };
        cfg.accetta = true; cfg.errori = {}; disegna();
      } }, "Compila con dati di prova")));
    box.appendChild(el("div", { class: "cfg-griglia" }, campoTesto("Nome e cognome", "nome", { obbl: true, auto: "name" }), campoTesto("Azienda", "azienda", { auto: "organization" }), campoTesto("Email", "email", { obbl: true, tipo: "email", auto: "email" })));
    box.appendChild(campoTesto("Telefono", "telefono", { tipo: "tel", auto: "tel" }));
    box.appendChild(campoTesto("Note per l'ufficio tecnico", "note", { area: true }));
    var chk = el("input", { type: "checkbox", id: "chk-privacy" }); chk.checked = cfg.accetta;
    chk.addEventListener("change", function () { cfg.accetta = chk.checked; });
    box.appendChild(el("div", { class: "campo" }, el("label", { for: "chk-privacy", style: "display:flex;gap:.6rem;align-items:flex-start;text-transform:none;letter-spacing:0;font-weight:500;font-size:.9rem" }, chk,
      "Acconsento al trattamento dei dati per la richiesta di offerta (demo: i dati restano nel tuo browser). *"),
      cfg.errori.privacy ? el("span", { class: "errore-campo", role: "alert", text: cfg.errori.privacy }) : null));
    box.appendChild(el("div", { class: "cfg-azioni" },
      el("button", { type: "button", class: "btn btn-ghost", onclick: function () { vaiPasso(2); vaiA("configuratore"); } }, "← Modifica il pezzo"),
      el("button", { type: "button", class: "btn btn-primario", id: "btn-invia", onclick: invia }, "Invia la richiesta", el("span", { "aria-hidden": "true", text: "→" }))));
    return box;
  }
  function invia() {
    var c = cfg.contatti, err = {};
    if (!c.nome.trim()) err.nome = "Scrivi il tuo nome.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email.trim())) err.email = "Scrivi un'email valida.";
    if (!cfg.accetta) err.privacy = "Serve il consenso per inviare la richiesta.";
    cfg.errori = err;
    if (Object.keys(err).length) { disegna(); var p = document.querySelector(".errore-campo"); if (p) p.scrollIntoView({ block: "center" }); return; }
    if (cfg.inviata) return; // evita un secondo invio dello stesso modulo
    var btn = document.getElementById("btn-invia"); if (btn) btn.disabled = true;
    var richieste = leggi("richieste", []);
    var n = richieste.reduce(function (m, r) { return Math.max(m, parseInt(r.id.slice(4), 10) || 0); }, 0) + 1;
    var rec = {
      id: "RIC-" + ("0000" + n).slice(-4), creata: new Date().toISOString(), stato: "ricevuta", demo: false,
      cliente: { azienda: c.azienda.trim(), nome: c.nome.trim(), email: c.email.trim(), telefono: c.telefono.trim(), note: c.note.trim() },
      dati: JSON.parse(JSON.stringify(cfg.dati)), prezzo: calcola(cfg.dati), ritocco: 0, offerta: null,
      file: cfg.file && (cfg.file.step || cfg.file.pdf) ? {
        esempio: cfg.file.esempio || null,
        step: cfg.file.step ? { nome: cfg.file.step.nome, ingombro: cfg.file.step.ingombro, volume: cfg.file.step.volume } : null,
        pdf: cfg.file.pdf ? { nome: cfg.file.pdf.nome, trovati: cfg.file.pdf.trovati } : null
      } : null
    };
    richieste.push(rec);
    scrivi("richieste", richieste);
    cfg.inviata = rec.id;
    vaiPasso(4); vaiA("configuratore");
  }
  function passoFatto() {
    return el("div", { class: "card cfg-box successo" },
      el("span", { class: "badge badge-ok", text: "Richiesta inviata" }),
      el("h3", { text: "Grazie, abbiamo ricevuto la richiesta " + cfg.inviata }),
      el("p", { text: "L'ufficio tecnico verifica il disegno e ti risponde con l'offerta ufficiale. Per vedere come la riceve e la elabora l'azienda, apri la vista Artigiancavi." }),
      el("div", { class: "hero-bottoni", style: "justify-content:center" },
        el("button", { type: "button", class: "btn btn-primario", onclick: function () { location.hash = "#/azienda/" + cfg.inviata; } }, "Vai alla vista azienda →"),
        el("button", { type: "button", class: "btn btn-ghost", onclick: function () { scartaFile(); cfg.dati = null; cfg.inviata = null; cfg.accetta = false; cfg.contatti = { azienda: "", nome: "", email: "", telefono: "", note: "" }; vaiPasso(1); } }, "Nuova richiesta")));
  }

  /* ---------- Disegno del configuratore ---------- */
  function disegna() {
    if (!radice) return;
    var attivo = document.activeElement && document.activeElement.id;
    svuota(radice); pannelloPrezzo = null;
    var nomi = ["Reparto", "Il pezzo", "Invio"];
    var barra = el("ol", { class: "cfg-passi", style: "list-style:none;padding:0;margin:0 0 1.5rem" });
    nomi.forEach(function (n, i) {
      var num = i + 1, stato = cfg.passo === num ? "attivo" : (cfg.passo > num ? "fatto" : "");
      barra.appendChild(el("li", { class: "cfg-passo " + stato, "aria-current": cfg.passo === num ? "step" : null }, el("b", { text: cfg.passo > num ? "✓" : String(num) }), el("span", { text: n })));
    });
    radice.appendChild(barra);

    var griglia = el("div", { class: cfg.passo === 2 ? "cfg" : null });
    if (cfg.passo === 1) griglia.appendChild(passoReparto());
    else if (cfg.passo === 2) {
      griglia.appendChild(passoDettagli());
      var corpo = el("div");
      var side = el("aside", { class: "card prezzo", "aria-label": "Stima del prezzo" }, el("h3", { text: "Stima indicativa" }), corpo);
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
  var az = { tab: "richieste", sel: null, viewer: null, tokenViewer: 0 };

  function seedRichieste() {
    var esistenti = leggi("richieste", null);
    if (esistenti !== null && leggi("richiesteVer", 0) === 2) return;
    var dellUtente = (esistenti || []).filter(function (x) { return !x.demo; }); // le richieste inviate da chi prova restano
    function r(id, giorniFa, cliente, dati, stato, file) {
      var d = new Date(Date.now() - giorniFa * 86400000).toISOString();
      return { id: id, creata: d, stato: stato, demo: true, cliente: cliente, dati: dati, prezzo: calcola(dati), ritocco: 0, offerta: null, file: file || null };
    }
    var a = nuoviDati("tornitura"); a.materiale = "inox-304"; a.geometria = { diametro: 20, lunghezza: 100, volumeFinito: 23.584 }; a.tolleranza = "precisa"; a.finitura = "passivazione"; a.collaudo = "dimensionale"; a.quantita = 50;
    var b = nuoviDati("fresatura"); b.macchina = "fresa-5"; b.materiale = "alu-6082"; b.geometria = { x: 150, y: 100, z: 20, volumeFinito: 255.7 }; b.complessita = "complessa"; b.tolleranza = "precisa"; b.finitura = "anodizzazione"; b.collaudo = "cmm"; b.urgenza = "rapida"; b.quantita = 10;
    var c = nuoviDati("cavi"); c.prodotto = "fune-inox"; c.diametro = 4; c.lunghezza = 1500; c.guaina = "pvc"; c.terminaleA = "occhiello"; c.terminaleB = "forcella"; c.quantita = 300;
    scrivi("richieste", [
      r("RIC-0001", 3, { azienda: "Meccanica Rossi (esempio)", nome: "Luca Rossi", email: "luca@esempio.it", telefono: "", note: "Serve certificato materiale." }, c, "ricevuta"),
      r("RIC-0002", 2, { azienda: "Officine Bianchi (esempio)", nome: "Anna Bianchi", email: "anna@esempio.it", telefono: "", note: "" }, a, "in-valutazione",
        { esempio: "perno-inox", step: { nome: "perno-inox.step", ingombro: [20, 20, 100], volume: 23.584 }, pdf: { nome: "perno-inox.pdf", trovati: ["Materiale: Inox AISI 304", "Quantità: 50 pz", "Tolleranza: ±0,05", "Trattamento: Passivazione"] } }),
      r("RIC-0003", 1, { azienda: "Tecno Verdi (esempio)", nome: "Marco Verdi", email: "marco@esempio.it", telefono: "", note: "Disegno allegato in STEP." }, b, "ricevuta",
        { esempio: "piastra-tasche", step: { nome: "piastra-tasche.step", ingombro: [150, 100, 20], volume: 255.714 }, pdf: { nome: "piastra-tasche.pdf", trovati: ["Materiale: Alluminio 6082", "Quantità: 10 pz", "Tolleranza: ±0,05"] } })
    ].concat(dellUtente));
    scrivi("richiesteVer", 2);
  }
  function richieste() { return leggi("richieste", []); }
  function salvaRichiesta(rec) {
    var l = richieste(); for (var i = 0; i < l.length; i++) if (l[i].id === rec.id) l[i] = rec; scrivi("richieste", l);
  }
  function dataBreve(iso) { try { return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }); } catch (e) { return ""; } }

  function rispostaAutomatica(rec, calc, offertaTot) {
    var q = rec.dati.quantita, per = offertaTot / q;
    return "Gentile " + rec.cliente.nome + ",\n" +
      "abbiamo ricevuto la sua richiesta " + rec.id + " per " + q + " pz: " + titoloPezzo(rec.dati) + ".\n" +
      "In base ai nostri costi e tempi di lavorazione, la nostra offerta è di " + eur(offertaTot) + " (" + eur(per) + " al pezzo, IVA esclusa).\n" +
      "Consegna prevista in circa " + calc.giorni + " giorni lavorativi dalla conferma d'ordine.\n" +
      "L'offerta è valida 30 giorni e resta soggetta alla verifica finale del disegno.\n" +
      "Cordiali saluti,\nUfficio commerciale";
  }

  function disegnaAzienda() {
    var cont = document.getElementById("vista-azienda"); svuota(cont);
    if (az.viewer) { az.viewer.dispose(); az.viewer = null; }
    az.tokenViewer++;
    seedRichieste();
    var lista = richieste();
    var wrap = el("div", { class: "contenitore az" });
    wrap.appendChild(el("div", { class: "az-barra" }, el("div", null, el("p", { class: "sopratitolo", text: "Vista azienda" }), el("h2", { text: "Richieste ricevute" })),
      el("div", { class: "az-azioni", style: "margin:0" },
        bottoneAzzera("btn btn-ghost btn-sm"),
        el("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: function () { location.hash = "#/"; } }, "← Torna al sito"))));
    wrap.appendChild(el("div", { class: "az-banner", text: "È quello che vede l'ufficio di Artigiancavi: ogni richiesta arriva già con il prezzo calcolato dallo schedario dei costi. L'ufficio controlla, ritocca se vuole e invia l'offerta." }));
    var tabs = el("div", { class: "az-tabs", role: "tablist" });
    [["richieste", "Richieste (" + lista.length + ")"], ["schedario", "Schedario dei costi"]].forEach(function (t) {
      tabs.appendChild(el("button", { type: "button", role: "tab", class: "scelta", "aria-pressed": String(az.tab === t[0]), "aria-selected": String(az.tab === t[0]), onclick: function () { az.tab = t[0]; disegnaAzienda(); } }, t[1]));
    });
    wrap.appendChild(tabs);
    wrap.appendChild(az.tab === "richieste" ? tabRichieste(lista) : tabSchedario());
    cont.appendChild(wrap);
  }

  function tabRichieste(lista) {
    var ordinate = lista.slice().sort(function (a, b) { return b.creata < a.creata ? -1 : 1; });
    if (!ordinate.length) return el("div", { class: "card az-dettaglio" }, el("p", { text: "Nessuna richiesta." }));
    if (!az.sel || !trova(lista, az.sel)) az.sel = ordinate[0].id;
    var elenco = el("div", { class: "az-elenco" });
    ordinate.forEach(function (r) {
      var stato = trova(STATI, r.stato);
      elenco.appendChild(el("button", { type: "button", class: "az-voce", "aria-current": String(r.id === az.sel), onclick: function () { az.sel = r.id; history.replaceState(null, "", "#/azienda/" + r.id); disegnaAzienda(); } },
        el("span", { class: "riga" }, el("span", { class: "id", text: r.id }), el("span", { text: dataBreve(r.creata) })),
        el("span", { class: "riga" }, el("span", { text: r.cliente.azienda || r.cliente.nome })),
        el("span", { class: "riga" }, el("span", { text: reparto(r.dati.reparto).nome + " · " + r.dati.quantita + " pz" }), el("strong", { text: eur(r.prezzo.totale) })),
        el("span", null, el("span", { class: "badge " + (r.stato === "offerta-inviata" ? "badge-ok" : "badge-blu"), text: stato.nome }))));
    });
    return el("div", { class: "az-layout" }, elenco, dettaglioRichiesta(trova(lista, az.sel)));
  }

  function dettaglioRichiesta(rec) {
    var calc = calcola(rec.dati);
    var box = el("div", { class: "card az-dettaglio" });
    box.appendChild(el("h3", { text: rec.id + " · " + (rec.cliente.azienda || rec.cliente.nome) }));
    box.appendChild(el("p", { class: "aiuto", text: rec.cliente.nome + " · " + rec.cliente.email + (rec.cliente.telefono ? " · " + rec.cliente.telefono : "") }));
    if (rec.cliente.note) box.appendChild(el("p", { text: "Note del cliente: " + rec.cliente.note }));

    var sez1 = el("div", { class: "az-sezione" }, el("h4", { text: "Cosa ha chiesto" }));
    var dl = el("dl", { class: "riepilogo" });
    descrivi(rec.dati).forEach(function (r) { dl.appendChild(el("div", null, el("dt", { text: r[0] }), el("dd", { text: r[1] }))); });
    sez1.appendChild(dl); box.appendChild(sez1);

    if (rec.file) box.appendChild(sezioneAllegati(rec.file));

    var sez2 = el("div", { class: "az-sezione" }, el("h4", { text: "Calcolo automatico dallo schedario" }));
    if (calc.errore) sez2.appendChild(el("div", { class: "avviso avviso-errore", text: calc.errore }));
    else {
      var r2 = pannelloPrezzoDOM(rec.dati, { senzaTabella: true });
      sez2.appendChild(r2.dom);
      if (Math.abs(calc.totale - rec.prezzo.totale) > 0.01) sez2.appendChild(el("div", { class: "avviso", text: "Lo schedario è cambiato dopo l'invio: al cliente era stata mostrata una stima di " + eur(rec.prezzo.totale) + ". Qui vale il calcolo aggiornato." }));
    }
    box.appendChild(sez2);
    if (calc.errore) return box;

    var offertaTot = Math.round(calc.totale * (1 + rec.ritocco / 100) * 100) / 100;
    var sez3 = el("div", { class: "az-sezione" }, el("h4", { text: "Risposta al cliente" }));
    sez3.appendChild(el("div", { class: "az-azioni", style: "margin:0 0 1rem" },
      el("span", { class: "etichetta", text: "Ritocco sul prezzo" }),
      el("div", { class: "contatore" },
        el("button", { type: "button", "aria-label": "Riduci del 1%", onclick: function () { rec.ritocco = Math.max(-20, rec.ritocco - 1); salvaRichiesta(rec); disegnaAzienda(); } }, "−"),
        el("span", { style: "min-width:4rem", text: (rec.ritocco > 0 ? "+" : "") + rec.ritocco + "%" }),
        el("button", { type: "button", "aria-label": "Aumenta dell'1%", onclick: function () { rec.ritocco = Math.min(30, rec.ritocco + 1); salvaRichiesta(rec); disegnaAzienda(); } }, "+")),
      el("strong", { text: "Offerta: " + eur(offertaTot) })));
    sez3.appendChild(el("div", { class: "risposta", text: rispostaAutomatica(rec, calc, offertaTot) }));
    sez3.appendChild(el("div", { class: "az-azioni" },
      rec.stato !== "in-valutazione" && rec.stato !== "offerta-inviata" ? el("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: function () { rec.stato = "in-valutazione"; salvaRichiesta(rec); disegnaAzienda(); } }, "Segna in valutazione") : null,
      rec.stato === "offerta-inviata"
        ? el("span", { class: "badge badge-ok", text: "Offerta inviata" + (rec.offerta ? " · " + eur(rec.offerta.totale) : "") })
        : el("button", { type: "button", class: "btn btn-primario btn-sm", onclick: function () {
            rec.stato = "offerta-inviata"; rec.offerta = { totale: offertaTot, giorni: calc.giorni, data: new Date().toISOString() };
            salvaRichiesta(rec); disegnaAzienda();
          } }, "Invia offerta al cliente")));
    box.appendChild(sez3);
    return box;
  }

  function sezioneAllegati(file) {
    var sez = el("div", { class: "az-sezione" }, el("h4", { text: "File allegati" }));
    var lista = el("ul", { class: "note-prezzo", style: "margin:0 0 1rem" });
    if (file.step) lista.appendChild(el("li", { text: file.step.nome + " · ingombro " + file.step.ingombro.map(function (n) { return NUM.format(n); }).join(" × ") + " mm · volume " + NUM.format(file.step.volume) + " cm³" }));
    if (file.pdf) lista.appendChild(el("li", { text: file.pdf.nome + (file.pdf.trovati && file.pdf.trovati.length ? " · letto: " + file.pdf.trovati.join("; ") : "") }));
    sez.appendChild(lista);
    if (file.esempio && file.step) {
      var slot = el("div", { class: "viewer-slot", text: "Preparo l'anteprima 3D…" });
      sez.appendChild(slot);
      var token = ++az.tokenViewer;
      scaricaBuffer("esempi/pezzi/" + file.esempio + ".step").then(window.FILE.leggiStep).then(function (r) { return window.FILE.creaViewer(r.meshes); }).then(function (v) {
        if (token !== az.tokenViewer) { v.dispose(); return; }
        az.viewer = v; svuota(slot); slot.classList.add("pronto"); slot.appendChild(v.el);
      }).catch(function (e) { slot.textContent = "Anteprima non disponibile: " + (e && e.message ? e.message : "errore"); });
      sez.appendChild(el("p", null, el("a", { href: "esempi/pezzi/" + file.esempio + ".pdf", target: "_blank", rel: "noopener", text: "Apri il disegno PDF" })));
    } else if (file.step || file.pdf) {
      sez.appendChild(el("p", { class: "aiuto", text: "In questa demo il file resta nel browser di chi l'ha caricato. In una versione reale arriverebbe all'ufficio insieme alla richiesta." }));
    }
    return sez;
  }

  function tabSchedario() {
    var cont = el("div");
    cont.appendChild(el("p", { class: "aiuto", text: "Qui l'azienda modifica i costi di base. Ogni modifica cambia subito i prezzi calcolati, sia nel configuratore sia nelle richieste. In una versione reale questo schedario viene importato dai dati aziendali." }));
    function tabella(titolo, righe, nota) {
      var t = el("table", { class: "schedario-tab" });
      righe.forEach(function (r) {
        var input = el("input", { class: "input", type: "number", min: 0, step: "any", value: r.valore, "aria-label": r.nome });
        input.addEventListener("change", function () { var v = parseFloat(input.value.replace(",", ".")); if (isFinite(v) && v >= 0) { r.salva(v); salvaOverride(); } disegnaAzienda(); });
        t.appendChild(el("tr", null, el("td", { text: r.nome }), el("td", null, input), el("td", { class: "aiuto", text: r.unita })));
      });
      return el("div", { class: "card schedario-blocco" }, el("h3", { text: titolo }), nota ? el("p", { class: "aiuto", text: nota }) : null, t);
    }
    cont.appendChild(tabella("Tariffe orarie macchine", Object.keys(S.macchine).map(function (id) {
      return { nome: S.macchine[id].nome, valore: S.macchine[id].tariffaOra, unita: "€ / ora", salva: function (v) { S.macchine[id].tariffaOra = v; } };
    }).concat([{ nome: "Isola di assemblaggio", valore: S.assemblaggi.tariffaIsolaOra, unita: "€ / ora", salva: function (v) { S.assemblaggi.tariffaIsolaOra = v; } }])));
    cont.appendChild(tabella("Materiali (prezzo del grezzo)", S.materiali.map(function (m) {
      return { nome: m.nome, valore: m.prezzoKg, unita: "€ / kg", salva: function (v) { m.prezzoKg = v; } };
    })));
    cont.appendChild(tabella("Margine aziendale", [{ nome: "Margine sul costo", valore: Math.round(S.margine * 100), unita: "%", salva: function (v) { S.margine = v / 100; } }]));
    cont.appendChild(el("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: function () { ripristinaSchedario(); disegnaAzienda(); } }, "Ripristina i valori demo"));
    cont.appendChild(el("button", { type: "button", class: "btn btn-ghost btn-sm", style: "margin-left:.6rem", onclick: function () { scrivi("richieste", null); try { localStorage.removeItem("richieste"); } catch (e) { /* ok */ } az.sel = null; disegnaAzienda(); } }, "Ripristina le richieste di esempio"));
    return cont;
  }

  /* ==========================================================================
     NAVIGAZIONE, TEMA, MENU
     ========================================================================== */
  // Riporta la demo come al primo accesso: richieste, schedario e configurazione in corso.
  // Il tema chiaro/scuro scelto non viene toccato.
  function azzeraDemo() {
    ["richieste", "richiesteVer", "schedarioOverride"].forEach(function (k) {
      delete memoria[k];
      try { localStorage.removeItem(k); } catch (e) { /* ok */ }
    });
    ripristinaSchedario();
    scartaFile();
    cfg.passo = 1; cfg.dati = null; cfg.inviata = null; cfg.accetta = false; cfg.errori = {};
    cfg.contatti = { azienda: "", nome: "", email: "", telefono: "", note: "" };
    az.sel = null; az.tab = "richieste";
    seedRichieste();
    try { history.replaceState({ cfgPasso: 1 }, "", location.pathname + location.search + "#/"); } catch (e) { /* ok */ }
    disegna(); route();
  }
  // Pulsante con doppio clic: il primo chiede conferma, il secondo azzera (niente finestre del browser)
  function bottoneAzzera(classe) {
    var b = el("button", { type: "button", class: classe }, "Azzera la demo");
    var timer = null;
    b.addEventListener("click", function () {
      if (!b.dataset.conferma) {
        b.dataset.conferma = "1"; b.textContent = "Conferma: cancella tutte le prove";
        timer = setTimeout(function () { delete b.dataset.conferma; b.textContent = "Azzera la demo"; }, 5000);
      } else {
        clearTimeout(timer); azzeraDemo();
        delete b.dataset.conferma; b.textContent = "Fatto: demo azzerata";
        setTimeout(function () { b.textContent = "Azzera la demo"; }, 2500);
      }
    });
    return b;
  }

  function vaiA(id) {
    var e = document.getElementById(id);
    if (e) e.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }
  function route() {
    var h = location.hash || "#/";
    var inAzienda = h.indexOf("#/azienda") === 0;
    document.getElementById("vista-pubblica").hidden = inAzienda;
    document.getElementById("vista-azienda").hidden = !inAzienda;
    document.getElementById("btn-vista-azienda").textContent = inAzienda ? "Torna al sito" : "Vista azienda";
    var vm = document.getElementById("menu-azienda");   // la stessa voce dentro il menu del telefono
    vm.textContent = inAzienda ? "Torna al sito" : "Vista azienda";
    vm.setAttribute("href", inAzienda ? "#/" : "#/azienda");
    if (inAzienda) {
      var m = h.match(/^#\/azienda\/(RIC-\d+)/); if (m) { az.sel = m[1]; az.tab = "richieste"; }
      disegnaAzienda(); window.scrollTo(0, 0);
    } else if (h.length > 2 && h.charAt(1) !== "/") {
      setTimeout(function () { vaiA(h.slice(1)); }, 0);
    } else { window.scrollTo(0, 0); }
    document.getElementById("menu").classList.remove("aperto");
    document.getElementById("btn-menu").setAttribute("aria-expanded", "false");
  }

  function avvio() {
    applicaOverride();
    seedRichieste(); // le richieste di esempio esistono subito, cosi' la numerazione parte da RIC-0004
    radice = document.getElementById("configuratore-app");
    document.getElementById("azzera-slot").appendChild(bottoneAzzera("link-piede"));

    var griglia = document.getElementById("griglia-reparti");
    REPARTI.forEach(function (r) {
      griglia.appendChild(el("button", { type: "button", class: "reparto-tile", onclick: function () { scegliReparto(r.id); } },
        el("div", null, el("h3", { text: r.nome }), el("p", { text: r.desc })), el("span", { class: "vai", text: "Configura →" })));
    });

    document.getElementById("btn-vista-azienda").addEventListener("click", function () {
      location.hash = (location.hash.indexOf("#/azienda") === 0) ? "#/" : "#/azienda";
    });
    document.getElementById("btn-tema").addEventListener("click", function () {
      var nuovo = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", nuovo);
      try { localStorage.setItem("tema", nuovo); } catch (e) { /* ok */ }
    });
    document.getElementById("btn-menu").addEventListener("click", function () {
      var m = document.getElementById("menu"), aperto = m.classList.toggle("aperto");
      this.setAttribute("aria-expanded", String(aperto));
    });
    document.querySelectorAll("[data-vai]").forEach(function (a) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        if (location.hash.indexOf("#/azienda") === 0) { location.hash = "#" + a.getAttribute("data-vai"); }
        else { vaiA(a.getAttribute("data-vai")); document.getElementById("menu").classList.remove("aperto"); }
      });
    });
    window.addEventListener("hashchange", route);
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
    if (rp && reparto(rp)) { cfg.dati = nuoviDati(rp); cfg.passo = 2; }
    try { history.replaceState({ cfgPasso: cfg.passo }, "", location.href); } catch (e) { /* ok */ }
    disegna();
    route();
  }

  document.addEventListener("DOMContentLoaded", avvio);
})();
