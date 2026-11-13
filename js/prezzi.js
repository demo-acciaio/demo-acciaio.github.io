/* MOTORE DEI PREZZI (demo). Legge lo schedario e calcola un prezzo indicativo con il dettaglio.
   Funziona sia nel browser sia in Node (per i test). Nessun dato esce dal browser. */
(function (root) {
  var S = (typeof module !== "undefined" && module.exports) ? require("./schedario.js") : root.SCHEDARIO;

  function trova(lista, id) {
    for (var i = 0; i < lista.length; i++) { if (lista[i].id === id) return lista[i]; }
    return null;
  }
  function arrotonda(n) { return Math.round(n * 100) / 100; }

  // Calcola il prezzo. "r" e' la richiesta (vedi test/prova-prezzi.js per esempi).
  function calcola(r) {
    var avvisi = [];
    var q = Math.max(1, Math.floor(Number(r.quantita) || 1));
    var res;
    if (r.reparto === "tornitura" || r.reparto === "fresatura") res = meccanica(r, q, avvisi);
    else if (r.reparto === "cavi") res = cavi(r, q, avvisi);
    else if (r.reparto === "assemblaggi") res = assemblaggi(r, q, avvisi);
    else return { errore: "Reparto non valido" };
    if (res.errore) return res;

    var urg = trova(S.urgenze, r.urgenza || "standard") || S.urgenze[0];
    var costo = res.voci.materiale + res.voci.lavorazione + res.voci.attrezzaggio + res.voci.finitura + res.voci.collaudo;
    var vUrg = costo * urg.sovrapprezzo;
    var vMargine = (costo + vUrg) * S.margine;
    var totale = costo + vUrg + vMargine;

    var giorni = Math.max(2, Math.ceil((S.consegnaBaseGiorni[r.reparto] + res.ore / S.oreProduttiveGiorno) * urg.tempi));
    if (q > 2000) avvisi.push("Quantità elevata: per le grandi serie l'ufficio preparerà una tariffa dedicata.");

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
    if (!mat) return { errore: "Materiale non valido" };
    var mac = S.macchine[r.macchina || (rep === "tornitura" ? "tornio" : "fresa-3")];
    if (!mac) return { errore: "Macchina non valida" };
    var cpx = trova(S.complessita, r.complessita || "media") || S.complessita[1];
    var tol = trova(S.tolleranze, r.tolleranza || "standard") || S.tolleranze[0];
    var fin = trova(S.finiture, r.finitura || "nessuna") || S.finiture[0];
    var col = trova(S.collaudi, r.collaudo || "nessuno") || S.collaudi[0];
    var sov = S.sovrametallo[rep];
    var g = r.geometria || {};

    var nominale, grezzo; // cm3
    if (rep === "tornitura") {
      var d = Number(g.diametro), L = Number(g.lunghezza);
      if (!(d > 0) || !(L > 0)) return { errore: "Servono diametro e lunghezza" };
      nominale = Math.PI / 4 * d * d * L / 1000;
      grezzo = Math.PI / 4 * Math.pow(d + 2 * sov, 2) * (L + 2 * sov) / 1000;
      if (L / d > 10) avvisi.push("Pezzo molto snello: potrebbe servire una lunetta, l'ufficio verificherà.");
      if (d > 300) avvisi.push("Diametro grande: da verificare la disponibilità del tornio.");
    } else {
      var x = Number(g.x), y = Number(g.y), z = Number(g.z);
      if (!(x > 0) || !(y > 0) || !(z > 0)) return { errore: "Servono le tre misure del pezzo" };
      nominale = x * y * z / 1000;
      grezzo = (x + 2 * sov) * (y + 2 * sov) * (z + 2 * sov) / 1000;
      if (Math.max(x, y, z) > 800) avvisi.push("Pezzo grande: da verificare la corsa delle macchine.");
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
        avvisi.push("La finitura «" + fin.nome + "» non è adatta a questo materiale: non è stata conteggiata.");
      } else {
        finitura = Math.max(fin.minimoLotto, fin.perKg * pesoPezzo * q);
      }
    }
    var collaudo = col.id === "nessuno" ? 0 : col.lotto + col.perPezzo * q;

    var note = [];
    if (stimato) note.push("Volume del pezzo stimato dalle misure: caricando un file STEP il calcolo è più preciso.");
    note.push("Tempo di lavorazione stimato: " + (Math.round(minPezzo * 10) / 10) + " min/pezzo su " + mac.nome + ".");

    return {
      voci: { materiale: materiale, lavorazione: lavorazione, attrezzaggio: attrezzaggio, finitura: finitura, collaudo: collaudo },
      pesoPezzoKg: Math.round(pesoPezzo * 1000) / 1000,
      ore: minPezzo * q / 60 + attOre,
      macchina: mac.nome,
      note: note
    };
  }

  // ---------- Cavi e trasmissioni flessibili ----------
  function cavi(r, q, avvisi) {
    var C = S.cavi;
    var prod = trova(C.prodotti, r.prodotto);
    if (!prod) return { errore: "Prodotto non valido" };
    var d = Number(r.diametro), Lmm = Number(r.lunghezza);
    if (!(d > 0) || !(Lmm > 0)) return { errore: "Servono diametro e lunghezza" };
    var guaina = trova(C.guaine, r.guaina || "nessuna") || C.guaine[0];
    var tA = trova(C.terminali, r.terminaleA || "nessuno") || C.terminali[0];
    var tB = trova(C.terminali, r.terminaleB || "nessuno") || C.terminali[0];
    var col = trova(S.collaudi, r.collaudo || "nessuno") || S.collaudi[0];
    if (prod.diametri.indexOf(d) < 0) avvisi.push("Diametro non a catalogo per questo prodotto: l'ufficio verificherà la disponibilità.");
    if (Lmm > 20000) avvisi.push("Lunghezza oltre i 20 m: da verificare.");

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
      macchina: "Banco taglio e pressatura",
      note: ["Fune: " + arrotonda(prezzoMetro) + " €/m (diametro " + d + " mm)."]
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
    if (minPezzo <= 0) return { errore: "Seleziona almeno un'operazione o indica i componenti" };
    var col = trova(S.collaudi, r.collaudo || "nessuno") || S.collaudi[0];

    var costoComp = Math.max(0, Number(r.costoComponentiPezzo) || 0);
    var materiale = costoComp * q;
    var lavorazione = minPezzo / 60 * A.tariffaIsolaOra * q;
    var attrezzaggio = A.attrezzaggioOre * A.tariffaIsolaOra;
    var collaudo = col.id === "nessuno" ? 0 : col.lotto + col.perPezzo * q;
    var note = ["Tempo di assemblaggio stimato: " + (Math.round(minPezzo * 10) / 10) + " min/pezzo."];
    if (costoComp === 0) note.push("Componenti non conteggiati: si assume che li fornisca il cliente.");

    return {
      voci: { materiale: materiale, lavorazione: lavorazione, attrezzaggio: attrezzaggio, finitura: 0, collaudo: collaudo },
      pesoPezzoKg: null,
      ore: minPezzo * q / 60 + A.attrezzaggioOre,
      macchina: "Isola di assemblaggio con pressa",
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
