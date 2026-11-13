/* MOTORE DEI PREZZI (demo). Legge lo schedario e calcola un prezzo indicativo con il dettaglio.
   Funziona sia nel browser sia in Node (per i test). Nessun dato esce dal browser.
   Errori, avvisi e note sono CODICI { k: "chiave", p: {parametri} }: li traduce la pagina (js/testi.js). */
(function (root) {
  var S = (typeof module !== "undefined" && module.exports) ? require("./schedario.js") : root.SCHEDARIO;

  function trova(lista, id) {
    for (var i = 0; i < lista.length; i++) { if (lista[i].id === id) return lista[i]; }
    return null;
  }
  function arrotonda(n) { return Math.round(n * 100) / 100; }
  function uno(n) { return Math.round(n * 10) / 10; }  // un decimale
  function msg(k, p) { return { k: k, p: p || {} }; }

  // Calcola il prezzo. "r" e' la richiesta (vedi test/prova-prezzi.js per esempi).
  function calcola(r) {
    var avvisi = [];
    var q = Math.max(1, Math.floor(Number(r.quantita) || 1));
    var res;
    if (r.reparto === "tornitura" || r.reparto === "fresatura") res = meccanica(r, q, avvisi);
    else if (r.reparto === "cavi") res = cavi(r, q, avvisi);
    else if (r.reparto === "assemblaggi") res = assemblaggi(r, q, avvisi);
    else return { errore: msg("e.reparto") };
    if (res.errore) return res;

    var urg = trova(S.urgenze, r.urgenza || "standard") || S.urgenze[0];
    var costo = res.voci.materiale + res.voci.lavorazione + res.voci.attrezzaggio + res.voci.finitura + res.voci.collaudo;
    var vUrg = costo * urg.sovrapprezzo;
    var vMargine = (costo + vUrg) * S.margine;
    var totale = costo + vUrg + vMargine;

    var giorni = Math.max(2, Math.ceil((S.consegnaBaseGiorni[r.reparto] + res.ore / S.oreProduttiveGiorno) * urg.tempi));
    if (q > 2000) avvisi.push(msg("w.quantita_alta"));

    return {
      reparto: r.reparto,
      quantita: q,
      voci: {
        materiale: arrotonda(res.voci.materiale),
        lavorazione: arrotonda(res.voci.lavorazione),
        attrezzaggio: arrotonda(res.voci.attrezzaggio),
        finitura: arrotonda(res.voci.finitura),
        collaudo: arrotonda(res.voci.collaudo),
        urgenza: arrotonda(vUrg),
        margine: arrotonda(vMargine)
      },
      totale: arrotonda(totale),
      perPezzo: arrotonda(totale / q),
      da: arrotonda(totale * (1 - S.fasciaIndicativa)),
      a: arrotonda(totale * (1 + S.fasciaIndicativa)),
      pesoPezzoKg: res.pesoPezzoKg,
      ore: Math.round(res.ore * 10) / 10,
      giorni: giorni,
      macchina: res.macchina || null,
      note: res.note || [],
      avvisi: avvisi
    };
  }

  // ---------- Tornitura e fresatura ----------
  function meccanica(r, q, avvisi) {
    var rep = r.reparto;
    var mat = trova(S.materiali, r.materiale);
    if (!mat) return { errore: msg("e.materiale") };
    var macId = r.macchina || (rep === "tornitura" ? "tornio" : "fresa-3");
    var mac = S.macchine[macId];
    if (!mac) return { errore: msg("e.macchina") };
    var cpx = trova(S.complessita, r.complessita || "media") || S.complessita[1];
    var tol = trova(S.tolleranze, r.tolleranza || "standard") || S.tolleranze[0];
    var fin = trova(S.finiture, r.finitura || "nessuna") || S.finiture[0];
    var col = trova(S.collaudi, r.collaudo || "nessuno") || S.collaudi[0];
    var sov = S.sovrametallo[rep];
    var g = r.geometria || {};

    var nominale, grezzo; // cm3
    if (rep === "tornitura") {
      var d = Number(g.diametro), L = Number(g.lunghezza);
      if (!(d > 0) || !(L > 0)) return { errore: msg("e.servono_dl") };
      nominale = Math.PI / 4 * d * d * L / 1000;
      grezzo = Math.PI / 4 * Math.pow(d + 2 * sov, 2) * (L + 2 * sov) / 1000;
      if (L / d > 10) avvisi.push(msg("w.snello"));
      if (d > 300) avvisi.push(msg("w.diametro_grande"));
    } else {
      var x = Number(g.x), y = Number(g.y), z = Number(g.z);
      if (!(x > 0) || !(y > 0) || !(z > 0)) return { errore: msg("e.servono_xyz") };
      nominale = x * y * z / 1000;
      grezzo = (x + 2 * sov) * (y + 2 * sov) * (z + 2 * sov) / 1000;
      if (Math.max(x, y, z) > 800) avvisi.push(msg("w.pezzo_grande"));
    }

    var finito = Number(g.volumeFinito) > 0 ? Number(g.volumeFinito) : nominale * S.riempimentoStimato[rep];
    var stimato = !(Number(g.volumeFinito) > 0);
    if (finito > nominale) finito = nominale;
    var asportato = Math.max(0, grezzo - finito);

    var pesoPezzo = finito * mat.densita / 1000;
    var pesoGrezzo = grezzo * mat.densita / 1000;
    var materiale = (pesoGrezzo * mat.prezzoKg + 0.30) * q; // 0,30 EUR di taglio del grezzo

    var minPezzo = asportato * mat.lavorabilita / mac.asportazione * cpx.fattore * tol.fattore + S.minutiMovimentazione[rep];
    minPezzo = Math.max(1.5, minPezzo);
    var lavorazione = minPezzo / 60 * mac.tariffaOra * q;
    var attOre = mac.attrezzaggioOre * (1 + (cpx.fattore - 1) * 0.25);
    var attrezzaggio = attOre * mac.tariffaOra;

    var finitura = 0;
    if (fin.id !== "nessuna") {
      if (fin.gruppi && fin.gruppi.indexOf(mat.gruppo) < 0) {
        avvisi.push(msg("w.finitura_incompatibile", { finId: fin.id }));
      } else {
        finitura = Math.max(fin.minimoLotto, fin.perKg * pesoPezzo * q);
      }
    }
    var collaudo = col.id === "nessuno" ? 0 : col.lotto + col.perPezzo * q;

    var note = [];
    if (stimato) note.push(msg("n.volume_stimato"));
    else note.push(msg("n.volume_file", { v: uno(finito) }));
    note.push(msg("n.tempo", { min: uno(minPezzo), macId: macId }));

    return {
      voci: { materiale: materiale, lavorazione: lavorazione, attrezzaggio: attrezzaggio, finitura: finitura, collaudo: collaudo },
      pesoPezzoKg: Math.round(pesoPezzo * 1000) / 1000,
      ore: minPezzo * q / 60 + attOre,
      macchina: macId,
      note: note
    };
  }

  // ---------- Cavi e trasmissioni flessibili ----------
  function cavi(r, q, avvisi) {
    var C = S.cavi;
    var prod = trova(C.prodotti, r.prodotto);
    if (!prod) return { errore: msg("e.prodotto") };
    var d = Number(r.diametro), Lmm = Number(r.lunghezza);
    if (!(d > 0) || !(Lmm > 0)) return { errore: msg("e.servono_dl") };
    var guaina = trova(C.guaine, r.guaina || "nessuna") || C.guaine[0];
    var tA = trova(C.terminali, r.terminaleA || "nessuno") || C.terminali[0];
    var tB = trova(C.terminali, r.terminaleB || "nessuno") || C.terminali[0];
    var col = trova(S.collaudi, r.collaudo || "nessuno") || S.collaudi[0];
    if (prod.diametri.indexOf(d) < 0) avvisi.push(msg("w.diametro_catalogo"));
    if (Lmm > 20000) avvisi.push(msg("w.lunghezza_oltre"));

    var Lm = Lmm / 1000;
    var prezzoMetro = prod.coeffMetro * d * d + guaina.perMmMetro * d;
    var materiale = Lm * prezzoMetro * q + (tA.prezzo + tB.prezzo) * q;
    var nTerm = (tA.id !== "nessuno" ? 1 : 0) + (tB.id !== "nessuno" ? 1 : 0);
    var lavorazione = (C.taglioPerPezzo + C.pressaturaPerTerminale * nTerm) * q;
    var attrezzaggio = C.attrezzaggioLotto;
    var collaudo = col.id === "nessuno" ? 0 : col.lotto + col.perPezzo * q;
    var peso = 0.0045 * d * d * Lm;

    return {
      voci: { materiale: materiale, lavorazione: lavorazione, attrezzaggio: attrezzaggio, finitura: 0, collaudo: collaudo },
      pesoPezzoKg: Math.round(peso * 1000) / 1000,
      ore: q * (0.4 + 0.5 * nTerm) / 60 + 0.5,
      macchina: "banco",
      note: [msg("n.fune", { prezzo: arrotonda(prezzoMetro), d: d })]
    };
  }

  // ---------- Assemblaggi ----------
  function assemblaggi(r, q, avvisi) {
    var A = S.assemblaggi;
    var minPezzo = 0;
    var ops = r.operazioni || [];
    for (var i = 0; i < ops.length; i++) {
      var op = trova(A.operazioni, ops[i].id);
      if (op) minPezzo += op.minPerPezzo * (Number(ops[i].n) || 1);
    }
    var nComp = Math.max(0, Math.floor(Number(r.componenti) || 0));
    minPezzo += nComp * A.minPerComponente;
    if (minPezzo <= 0) return { errore: msg("e.assemblaggio_vuoto") };
    var col = trova(S.collaudi, r.collaudo || "nessuno") || S.collaudi[0];

    var costoComp = Math.max(0, Number(r.costoComponentiPezzo) || 0);
    var materiale = costoComp * q;
    var lavorazione = minPezzo / 60 * A.tariffaIsolaOra * q;
    var attrezzaggio = A.attrezzaggioOre * A.tariffaIsolaOra;
    var collaudo = col.id === "nessuno" ? 0 : col.lotto + col.perPezzo * q;
    var note = [msg("n.tempo_ass", { min: uno(minPezzo) })];
    if (costoComp === 0) note.push(msg("n.componenti_cliente"));

    return {
      voci: { materiale: materiale, lavorazione: lavorazione, attrezzaggio: attrezzaggio, finitura: 0, collaudo: collaudo },
      pesoPezzoKg: null,
      ore: minPezzo * q / 60 + A.attrezzaggioOre,
      macchina: "isola",
      note: note
    };
  }

  // Prezzo al pezzo per diverse quantita' (per la tabella di confronto)
  function tabellaQuantita(r, quantita) {
    return quantita.map(function (n) {
      var copia = JSON.parse(JSON.stringify(r)); copia.quantita = n;
      var c = calcola(copia);
      return c.errore ? { quantita: n, errore: c.errore } : { quantita: n, perPezzo: c.perPezzo, totale: c.totale, giorni: c.giorni };
    });
  }

  var PREZZI = { calcola: calcola, tabellaQuantita: tabellaQuantita };
  if (typeof module !== "undefined" && module.exports) { module.exports = PREZZI; }
  else { root.PREZZI = PREZZI; }
})(typeof window !== "undefined" ? window : globalThis);
