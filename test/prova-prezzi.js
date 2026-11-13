// Prova a mano del motore dei prezzi: node test/prova-prezzi.js
const P = require("../js/prezzi.js");

const casi = {
  "Tornitura: perno inox 304, 20x100, 50 pz": {
    reparto: "tornitura", materiale: "inox-304", macchina: "tornio", quantita: 50,
    geometria: { diametro: 20, lunghezza: 100 }, complessita: "media", tolleranza: "precisa",
    finitura: "passivazione", collaudo: "dimensionale", urgenza: "standard"
  },
  "Tornitura: stesso perno, 1 pz": {
    reparto: "tornitura", materiale: "inox-304", macchina: "tornio", quantita: 1,
    geometria: { diametro: 20, lunghezza: 100 }, complessita: "media", tolleranza: "precisa"
  },
  "Fresatura: piastra alluminio 120x80x25 con volume STEP, 10 pz, 5 assi": {
    reparto: "fresatura", materiale: "alu-6082", macchina: "fresa-5", quantita: 10,
    geometria: { x: 120, y: 80, z: 25, volumeFinito: 120 }, complessita: "complessa", tolleranza: "alta",
    finitura: "anodizzazione", collaudo: "cmm", urgenza: "rapida"
  },
  "Fresatura: finitura sbagliata (zincatura su alluminio)": {
    reparto: "fresatura", materiale: "alu-6082", macchina: "fresa-3", quantita: 5,
    geometria: { x: 60, y: 60, z: 20 }, finitura: "zincatura"
  },
  "Cavi: fune inox 3 mm, 1500 mm, occhiello + forcella, 100 pz": {
    reparto: "cavi", prodotto: "fune-inox", diametro: 3, lunghezza: 1500, quantita: 100,
    guaina: "pvc", terminaleA: "occhiello", terminaleB: "forcella", collaudo: "nessuno"
  },
  "Assemblaggi: gruppo con 4 componenti, pressatura+codifica, 200 pz": {
    reparto: "assemblaggi", quantita: 200, componenti: 4, costoComponentiPezzo: 2.5,
    operazioni: [{ id: "pressatura", n: 2 }, { id: "codifica", n: 1 }, { id: "controllo", n: 1 }]
  },
  "Errore: tornitura senza misure": { reparto: "tornitura", materiale: "acciaio-c45", quantita: 5, geometria: {} }
};

for (const [nome, r] of Object.entries(casi)) {
  const c = P.calcola(r);
  console.log("\n== " + nome);
  if (c.errore) { console.log("   ERRORE:", JSON.stringify(c.errore)); continue; }
  console.log("   voci:", JSON.stringify(c.voci));
  console.log("   totale " + c.totale + " € (da " + c.da + " a " + c.a + ")  |  " + c.perPezzo + " €/pz  |  " + c.giorni + " gg  |  " + c.ore + " h  |  peso " + c.pesoPezzoKg + " kg");
  if (c.avvisi.length) console.log("   avvisi:", JSON.stringify(c.avvisi));
}

console.log("\n== Quantità (perno inox)");
console.log(P.tabellaQuantita(casi["Tornitura: perno inox 304, 20x100, 50 pz"], [1, 10, 50, 100, 500])
  .map(r => r.quantita + " pz → " + r.perPezzo + " €/pz").join("\n"));
