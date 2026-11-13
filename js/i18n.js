/* LINGUE: italiano (predefinita), tedesco, inglese.
   t("chiave", {parametri}) restituisce il testo nella lingua scelta; se manca, usa l'italiano.
   I testi stanno in js/testi.js (window.TESTI = { it:{}, de:{}, en:{} }). */
(function (root) {
  "use strict";

  var LINGUE = ["it", "de", "en"];
  var LOCALE = { it: "it-IT", de: "de-DE", en: "en-GB" };
  var lingua = "it";
  var cacheFormati = {};

  function testi() { return root.TESTI || { it: {}, de: {}, en: {} }; }

  function sostituisci(s, p) {
    if (!p) return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) { return p[k] !== undefined && p[k] !== null ? p[k] : m; });
  }
  // Testo nella lingua richiesta (o in quella corrente). Chiave mancante: italiano, poi la chiave stessa.
  function t(chiave, p, l) {
    var T = testi(), s = (T[l || lingua] || {})[chiave];
    if (s === undefined) s = (T.it || {})[chiave];
    if (s === undefined) return chiave;
    return sostituisci(s, p);
  }
  // Nome di un elemento dello schedario (materiale, macchina...): tradotto se c'e', altrimenti il nome italiano
  function nome(tipo, elemento, l) {
    if (!elemento) return "";
    var s = (testi()[l || lingua] || {})["n." + tipo + "." + elemento.id];
    return s !== undefined ? s : elemento.nome;
  }
  function locale(l) { return LOCALE[l || lingua]; }
  function formati(l) {
    var k = l || lingua;
    if (!cacheFormati[k]) {
      cacheFormati[k] = {
        eur: new Intl.NumberFormat(LOCALE[k], { style: "currency", currency: "EUR" }),
        num: new Intl.NumberFormat(LOCALE[k], { maximumFractionDigits: 2 })
      };
    }
    return cacheFormati[k];
  }

  function imposta(l) {
    if (LINGUE.indexOf(l) < 0) l = "it";
    lingua = l;
    document.documentElement.setAttribute("lang", l);
    try { localStorage.setItem("lingua", l); } catch (e) { /* ok */ }
    applicaStatici();
  }
  // Testi fissi della pagina: data-i18n="chiave" (testo) e data-i18n-attr="attributo:chiave;altro:chiave"
  function applicaStatici() {
    document.querySelectorAll("[data-i18n]").forEach(function (e) { e.textContent = t(e.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-attr]").forEach(function (e) {
      e.getAttribute("data-i18n-attr").split(";").forEach(function (coppia) {
        var i = coppia.indexOf(":");
        if (i > 0) e.setAttribute(coppia.slice(0, i).trim(), t(coppia.slice(i + 1).trim()));
      });
    });
    document.title = t("meta.titolo");
  }
  function iniziale() {
    var q = null, salvata = null;
    try { q = new URLSearchParams(location.search).get("lang"); } catch (e) { /* ok */ }
    try { salvata = localStorage.getItem("lingua"); } catch (e) { /* ok */ }
    var l = q || salvata || "it";
    imposta(LINGUE.indexOf(l) >= 0 ? l : "it");
  }

  root.I18N = {
    t: t, nome: nome, locale: locale, formati: formati, imposta: imposta, iniziale: iniziale,
    applicaStatici: applicaStatici, LINGUE: LINGUE, corrente: function () { return lingua; }
  };
})(window);
