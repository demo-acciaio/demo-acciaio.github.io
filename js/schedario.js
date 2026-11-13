/* SCHEDARIO FINTO (dati di esempio, NON sono prezzi reali di Artigiancavi).
   In una versione vera questo file viene sostituito dall'importazione dello schedario aziendale. */
(function (root) {
  var SCHEDARIO = {
    versione: "demo-1",
    margine: 0.25,            // margine aziendale sul costo
    fasciaIndicativa: 0.12,   // il prezzo e' mostrato come "da - a" (+/- 12%)

    // --- Materiali: densita' g/cm3, prezzo grezzo EUR/kg, lavorabilita' (1 = acciaio da costruzione)
    materiali: [
      { id: "acciaio-c45",   gruppo: "acciaio", nome: "Acciaio C45",            densita: 7.85, prezzoKg: 1.60,  lavorabilita: 1.00 },
      { id: "acciaio-42crmo4", gruppo: "acciaio", nome: "Acciaio 42CrMo4 (bonificato)", densita: 7.85, prezzoKg: 2.10, lavorabilita: 1.35 },
      { id: "inox-304",      gruppo: "inox",    nome: "Inox AISI 304",          densita: 7.90, prezzoKg: 4.80,  lavorabilita: 1.60 },
      { id: "inox-316l",     gruppo: "inox",    nome: "Inox AISI 316L",         densita: 8.00, prezzoKg: 6.20,  lavorabilita: 1.80 },
      { id: "alu-6082",      gruppo: "alluminio", nome: "Alluminio 6082",       densita: 2.70, prezzoKg: 5.20,  lavorabilita: 0.50 },
      { id: "ottone-cuzn39", gruppo: "ottone",  nome: "Ottone CuZn39Pb3",       densita: 8.50, prezzoKg: 8.50,  lavorabilita: 0.40 },
      { id: "bronzo-cusn12", gruppo: "bronzo",  nome: "Bronzo CuSn12",          densita: 8.80, prezzoKg: 13.00, lavorabilita: 0.80 },
      { id: "pom",           gruppo: "plastica", nome: "Plastica POM-C",        densita: 1.41, prezzoKg: 9.00,  lavorabilita: 0.45 }
    ],

    // --- Macchine: tariffa EUR/h, velocita' di asportazione cm3/min (su acciaio), ore di attrezzaggio per lotto
    macchine: {
      "tornio":      { nome: "Tornio CNC",                 tariffaOra: 48, asportazione: 18, attrezzaggioOre: 1.0 },
      "tornio-y":    { nome: "Tornio CNC asse Y",          tariffaOra: 62, asportazione: 15, attrezzaggioOre: 1.5 },
      "fresa-3":     { nome: "Centro di fresatura 3 assi", tariffaOra: 58, asportazione: 14, attrezzaggioOre: 1.5 },
      "fresa-4":     { nome: "Centro di fresatura 4 assi", tariffaOra: 70, asportazione: 12, attrezzaggioOre: 2.0 },
      "fresa-5":     { nome: "Centro di fresatura 5 assi", tariffaOra: 92, asportazione: 10, attrezzaggioOre: 2.5 }
    },

    // --- Complessita' e tolleranze: moltiplicatori sul tempo
    complessita: [
      { id: "semplice", nome: "Semplice",  fattore: 1.0 },
      { id: "media",    nome: "Media",     fattore: 1.6 },
      { id: "complessa", nome: "Complessa", fattore: 2.4 }
    ],
    tolleranze: [
      { id: "standard", nome: "Standard (ISO 2768-m)", fattore: 1.00 },
      { id: "precisa",  nome: "Precisa (±0,05 mm)",    fattore: 1.15 },
      { id: "alta",     nome: "Alta (±0,02 mm)",       fattore: 1.35 },
      { id: "altissima", nome: "Altissima (±0,01 mm)", fattore: 1.70 }
    ],
    // coefficiente di riempimento quando manca il volume del pezzo finito (volume finito / volume grezzo)
    riempimentoStimato: { tornitura: 0.45, fresatura: 0.35 },
    // sovrametallo del grezzo (mm per lato) e tempo di carico/scarico per pezzo (minuti)
    sovrametallo: { tornitura: 1.5, fresatura: 2.0 },
    minutiMovimentazione: { tornitura: 1.0, fresatura: 1.5 },

    // --- Finiture e trattamenti: costo per kg di pezzo, minimo per lotto, materiali ammessi (gruppi)
    finiture: [
      { id: "nessuna",       nome: "Nessuna",                 perKg: 0,    minimoLotto: 0,  gruppi: null },
      { id: "zincatura",     nome: "Zincatura bianca",        perKg: 1.80, minimoLotto: 35, gruppi: ["acciaio"] },
      { id: "brunitura",     nome: "Brunitura",               perKg: 2.20, minimoLotto: 40, gruppi: ["acciaio"] },
      { id: "anodizzazione", nome: "Anodizzazione",           perKg: 6.00, minimoLotto: 60, gruppi: ["alluminio"] },
      { id: "passivazione",  nome: "Passivazione",            perKg: 1.50, minimoLotto: 30, gruppi: ["inox"] },
      { id: "rettifica",     nome: "Rettifica superfici",     perKg: 4.50, minimoLotto: 50, gruppi: ["acciaio", "inox"] }
    ],

    // --- Collaudo: costo fisso per lotto + costo per pezzo
    collaudi: [
      { id: "nessuno",      nome: "Controllo standard di reparto", lotto: 0,  perPezzo: 0 },
      { id: "dimensionale", nome: "Rapporto dimensionale",          lotto: 25, perPezzo: 0.40 },
      { id: "certificato",  nome: "Certificato materiale 3.1",      lotto: 30, perPezzo: 0 },
      { id: "cmm",          nome: "Rapporto su macchina di misura 3D", lotto: 60, perPezzo: 1.20 }
    ],

    // --- Urgenza: sovrapprezzo sul costo e riduzione dei tempi di consegna
    urgenze: [
      { id: "standard", nome: "Standard", sovrapprezzo: 0,    tempi: 1.00 },
      { id: "rapida",   nome: "Rapida",   sovrapprezzo: 0.25, tempi: 0.60 },
      { id: "express",  nome: "Express",  sovrapprezzo: 0.50, tempi: 0.35 }
    ],
    consegnaBaseGiorni: { tornitura: 10, fresatura: 12, cavi: 5, assemblaggi: 7 },
    oreProduttiveGiorno: 16,   // due turni

    // --- Cavi e trasmissioni flessibili
    cavi: {
      prodotti: [
        { id: "fune-zincata", nome: "Fune in acciaio zincato 7x7",  coeffMetro: 0.12, diametri: [1.5, 2, 3, 4, 5, 6, 8] },
        { id: "fune-inox",    nome: "Fune in acciaio inox 7x7",     coeffMetro: 0.30, diametri: [1.5, 2, 3, 4, 5, 6, 8] },
        { id: "fune-inox-19", nome: "Fune inox 1x19 (tiranti per arredo)", coeffMetro: 0.38, diametri: [2, 3, 4, 5, 6] },
        { id: "trasmissione", nome: "Trasmissione flessibile (guaina + anima)", coeffMetro: 0.55, diametri: [3, 4, 5, 6, 8] }
      ],
      guaine: [
        { id: "nessuna", nome: "Nessuna",       perMmMetro: 0 },
        { id: "pvc",     nome: "Guaina PVC",    perMmMetro: 0.06 },
        { id: "nylon",   nome: "Guaina nylon",  perMmMetro: 0.09 }
      ],
      terminali: [
        { id: "nessuno",    nome: "Nessuno (solo taglio)",  prezzo: 0 },
        { id: "occhiello",  nome: "Occhiello pressato",     prezzo: 1.20 },
        { id: "forcella",   nome: "Forcella",               prezzo: 2.80 },
        { id: "filettato",  nome: "Terminale filettato",    prezzo: 4.20 },
        { id: "sfera",      nome: "Terminale a sfera",      prezzo: 1.90 },
        { id: "moschettone", nome: "Moschettone",           prezzo: 3.50 }
      ],
      taglioPerPezzo: 0.15,
      pressaturaPerTerminale: 0.60,
      attrezzaggioLotto: 25
    },

    // --- Assemblaggi (isole con pressa e codificatori)
    assemblaggi: {
      tariffaIsolaOra: 38,
      attrezzaggioOre: 1.0,
      operazioni: [
        { id: "pressatura",  nome: "Pressatura",            minPerPezzo: 0.20 },
        { id: "avvitatura",  nome: "Avvitatura",            minPerPezzo: 0.35 },
        { id: "codifica",    nome: "Codifica / marcatura",  minPerPezzo: 0.15 },
        { id: "montaggio",   nome: "Montaggio manuale",     minPerPezzo: 0.60 },
        { id: "controllo",   nome: "Controllo finale",      minPerPezzo: 0.25 }
      ],
      minPerComponente: 0.10    // gestione di ogni componente aggiuntivo
    }
  };

  if (typeof module !== "undefined" && module.exports) { module.exports = SCHEDARIO; }
  else { root.SCHEDARIO = SCHEDARIO; }
})(typeof window !== "undefined" ? window : globalThis);
