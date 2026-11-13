/* LETTURA DEI FILE: STEP (misure, volume, anteprima 3D) e PDF (cartiglio + anteprima).
   Tutto avviene nel browser: i file non vengono inviati a nessun server.
   Le librerie pesanti si scaricano solo quando serve (al primo file caricato). */
(function (root) {
  "use strict";

  var CDN = {
    occtJs: "https://cdn.jsdelivr.net/npm/occt-import-js@0.0.23/dist/occt-import-js.js",
    occtBase: "https://cdn.jsdelivr.net/npm/occt-import-js@0.0.23/dist/",
    three: "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    orbit: "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js",
    pdf: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
    pdfWorker: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js"
  };

  var cacheScript = {};
  function caricaScript(src) {
    if (cacheScript[src]) return cacheScript[src];
    cacheScript[src] = new Promise(function (ok, ko) {
      var s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = function () { ok(); };
      s.onerror = function () { delete cacheScript[src]; ko(new Error("f.err.scarico")); };
      document.head.appendChild(s);
    });
    return cacheScript[src];
  }
  function arr(n) { return Math.round(n * 100) / 100; }

  /* ---------------- STEP ---------------- */
  var occtPromessa = null;
  function occt() {
    if (!occtPromessa) {
      occtPromessa = caricaScript(CDN.occtJs).then(function () {
        return root.occtimportjs({ locateFile: function (nome) { return CDN.occtBase + nome; } });
      }).catch(function (e) { occtPromessa = null; throw e; });
    }
    return occtPromessa;
  }

  // Legge un file STEP: misure d'ingombro (mm), volume (cm3) e la maglia 3D per l'anteprima
  function leggiStep(buffer) {
    return occt().then(function (o) {
      var res;
      try { res = o.ReadStepFile(new Uint8Array(buffer), null); } catch (e) { throw new Error("f.err.step_illeggibile"); }
      if (!res || !res.success || !res.meshes || !res.meshes.length) throw new Error("f.err.step_vuoto");
      var min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity], vol = 0;
      res.meshes.forEach(function (m) {
        var p = m.attributes.position.array, idx = m.index.array, i;
        for (i = 0; i < p.length; i += 3) {
          for (var k = 0; k < 3; k++) { if (p[i + k] < min[k]) min[k] = p[i + k]; if (p[i + k] > max[k]) max[k] = p[i + k]; }
        }
        for (i = 0; i < idx.length; i += 3) {
          var a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
          var ax = p[a], ay = p[a + 1], az = p[a + 2], bx = p[b], by = p[b + 1], bz = p[b + 2], cx = p[c], cy = p[c + 1], cz = p[c + 2];
          vol += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
        }
      });
      var ing = [arr(max[0] - min[0]), arr(max[1] - min[1]), arr(max[2] - min[2])];
      var volCm3 = Math.abs(vol) / 6 / 1000; // mm3 -> cm3
      if (!(volCm3 > 0) || !(ing[0] > 0) || !(ing[1] > 0) || !(ing[2] > 0)) throw new Error("f.err.step_volume");
      return { ingombro: ing, volumeCm3: Math.round(volCm3 * 1000) / 1000, corpi: res.meshes.length, meshes: res.meshes };
    });
  }

  // Propone le misure per il configuratore a partire dall'ingombro del file
  function proponiMisure(ing, reparto) {
    function r1(n) { return Math.round(n * 10) / 10; }
    if (reparto === "tornitura") {
      // Un pezzo tornito ha due misure quasi uguali (il diametro): la terza e' la lunghezza.
      var coppie = [[0, 1, 2], [0, 2, 1], [1, 2, 0]], scelta = null;
      coppie.forEach(function (c) {
        var a = ing[c[0]], b = ing[c[1]];
        if (Math.abs(a - b) / Math.max(a, b) < 0.03) {
          if (!scelta || Math.max(a, b) > scelta.d) scelta = { d: Math.max(a, b), l: ing[c[2]] };
        }
      });
      if (scelta) return { diametro: r1(scelta.d), lunghezza: r1(scelta.l), tondo: true };
      var o = ing.slice().sort(function (x, y) { return y - x; });
      return { diametro: r1(Math.max(o[1], o[2])), lunghezza: r1(o[0]), tondo: false };
    }
    var s = ing.slice().sort(function (x, y) { return y - x; });
    return { x: r1(s[0]), y: r1(s[1]), z: r1(s[2]) };
  }

  /* ---------------- Anteprima 3D ---------------- */
  function creaViewer(meshes) {
    return Promise.all([import(CDN.three), import(CDN.orbit)]).then(function (r) {
      var THREE = r[0], OC = r[1];
      var el = document.createElement("div");
      el.className = "viewer3d";
      var renderer;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
      catch (e) { throw new Error("f.err.webgl"); }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      el.appendChild(renderer.domElement);

      var scena = new THREE.Scene();
      var gruppo = new THREE.Group();
      var matCorpo = new THREE.MeshStandardMaterial({ color: 0x8fa6cf, metalness: 0.55, roughness: 0.42 });
      var matLinee = new THREE.LineBasicMaterial({ color: 0x1c2a66 });
      meshes.forEach(function (m) {
        var g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(m.attributes.position.array), 3));
        if (m.attributes.normal) g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(m.attributes.normal.array), 3));
        g.setIndex(new THREE.BufferAttribute(Uint32Array.from(m.index.array), 1));
        if (!m.attributes.normal) g.computeVertexNormals();
        gruppo.add(new THREE.Mesh(g, matCorpo));
        gruppo.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 28), matLinee));
      });
      scena.add(gruppo);
      scena.add(new THREE.HemisphereLight(0xffffff, 0x445577, 1.1));
      var l1 = new THREE.DirectionalLight(0xffffff, 1.6); l1.position.set(1, 1.5, 1); scena.add(l1);
      var l2 = new THREE.DirectionalLight(0xffffff, 0.7); l2.position.set(-1, -0.5, -1); scena.add(l2);

      var box = new THREE.Box3().setFromObject(gruppo);
      var centro = box.getCenter(new THREE.Vector3());
      var raggio = box.getSize(new THREE.Vector3()).length() / 2 || 1;
      gruppo.position.sub(centro);
      var camera = new THREE.PerspectiveCamera(35, 1, raggio / 50, raggio * 50);
      camera.position.set(raggio * 1.7, raggio * 1.2, raggio * 2.0);
      var controlli = new OC.OrbitControls(camera, renderer.domElement);
      controlli.enableDamping = true; controlli.autoRotate = true; controlli.autoRotateSpeed = 1.4;
      // Mentre l'utente muove o ingrandisce il pezzo la rotazione si ferma; 3 secondi dopo che smette riparte da sola.
      var ripartenza = null;
      controlli.addEventListener("start", function () { clearTimeout(ripartenza); controlli.autoRotate = false; });
      controlli.addEventListener("end", function () {
        clearTimeout(ripartenza);
        ripartenza = setTimeout(function () { if (!v.morto) controlli.autoRotate = true; }, 3000);
      });
      el.__controlli = controlli; // serve solo per le prove automatiche

      var v = { el: el, morto: false, dispose: function () { v.morto = true; clearTimeout(ripartenza); renderer.dispose(); } };
      var larg = 0, alt = 0;
      function adatta() {
        var w = el.clientWidth, h = el.clientHeight;
        if (!w || !h || (w === larg && h === alt)) return;
        larg = w; alt = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      }
      (function giro() {
        if (v.morto) return;
        requestAnimationFrame(giro);
        if (!el.isConnected) return;
        adatta(); controlli.update(); renderer.render(scena, camera);
      })();
      return v;
    });
  }

  /* ---------------- PDF ---------------- */
  var MATERIALI = [
    [/(316)/i, "inox-316l"], [/(304|x5\s*cr\s*ni\s*18|aisi)/i, "inox-304"], [/inox|stainless/i, "inox-304"],
    [/42\s*cr\s*mo\s*4/i, "acciaio-42crmo4"], [/\bc\s*45\b|c45/i, "acciaio-c45"], [/acciaio|steel/i, "acciaio-c45"],
    [/6082|allumin|aluminium|aluminum/i, "alu-6082"], [/cuzn39|ottone|brass/i, "ottone-cuzn39"],
    [/cusn12|bronzo|bronze/i, "bronzo-cusn12"], [/\bpom\b|delrin|acetal|plastica/i, "pom"]
  ];
  var FINITURE = [
    [/zincat|zinc/i, "zincatura"], [/brunit/i, "brunitura"], [/anodizz|anodis/i, "anodizzazione"],
    [/passiv/i, "passivazione"], [/rettific/i, "rettifica"]
  ];
  function primaCorrispondenza(lista, testo) {
    for (var i = 0; i < lista.length; i++) if (lista[i][0].test(testo)) return lista[i][1];
    return null;
  }
  // Cerca nel testo del disegno i dati del cartiglio.
  // "trovati" e' una lista di dati strutturati ({c: campo, ...}): la pagina li scrive nella lingua scelta.
  function leggiCartiglio(righe) {
    var tutto = righe.join("\n"), campi = {}, trovati = [];
    function valore(etichetta) {
      var re = new RegExp("^\\s*(?:" + etichetta + ")\\s*:?\\s*(.+)$", "im"), m = tutto.match(re);
      return m ? m[1].trim() : null;
    }
    var mat = valore("materiale|material|mat\\.");
    if (mat) { var idm = primaCorrispondenza(MATERIALI, mat); if (idm) { campi.materiale = idm; trovati.push({ c: "materiale", id: idm }); } }
    var q = valore("quantit[àa]|q\\.?t[àa]|qty|pezzi|n\\.? pezzi");
    if (q) { var n = parseInt((q.match(/\d+/) || [])[0], 10); if (n > 0) { campi.quantita = n; trovati.push({ c: "quantita", n: n }); } }
    var tol = valore("tolleranz[ae](?: general[ei])?|tolerance");
    if (tol) {
      var t = null;
      if (/0[,.]0?1\b/.test(tol) && /[±+-]/.test(tol)) t = "altissima";
      else if (/0[,.]0?2\b/.test(tol) && /[±+-]/.test(tol)) t = "alta";
      else if (/0[,.]0?5\b/.test(tol) && /[±+-]/.test(tol)) t = "precisa";
      else if (/2768/.test(tol)) t = "standard";
      if (t) { campi.tolleranza = t; trovati.push({ c: "tolleranza", raw: tol }); }
    }
    var tr = valore("trattamento|finitura|treatment|finish");
    if (tr) {
      var f = primaCorrispondenza(FINITURE, tr);
      if (f) { campi.finitura = f; trovati.push({ c: "trattamento", id: f }); }
      else if (/nessun|none|-/i.test(tr)) { campi.finitura = "nessuna"; trovati.push({ c: "trattamento", id: null }); }
    }
    // Se il cartiglio non ha l'etichetta, si cerca il materiale in tutto il testo
    if (!campi.materiale) { var idm2 = primaCorrispondenza(MATERIALI, tutto); if (idm2) { campi.materiale = idm2; trovati.push({ c: "materiale", id: idm2 }); } }
    var titolo = valore("titolo|title|descrizione|description");
    return { campi: campi, trovati: trovati, titolo: titolo };
  }

  function leggiPdf(buffer) {
    return caricaScript(CDN.pdf).then(function () {
      var pdfjs = root.pdfjsLib;
      pdfjs.GlobalWorkerOptions.workerSrc = CDN.pdfWorker;
      return pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    }).then(function (doc) {
      return doc.getPage(1).then(function (pagina) {
        return pagina.getTextContent().then(function (tc) {
          var gruppi = {};
          tc.items.forEach(function (it) {
            if (!it.str || !it.str.trim()) return;
            var y = Math.round(it.transform[5] / 3);
            (gruppi[y] = gruppi[y] || []).push({ x: it.transform[4], s: it.str });
          });
          var righe = Object.keys(gruppi).map(Number).sort(function (a, b) { return b - a; }).map(function (y) {
            return gruppi[y].sort(function (a, b) { return a.x - b.x; }).map(function (o) { return o.s.trim(); }).join(" ");
          });
          var base = pagina.getViewport({ scale: 1 });
          var scala = Math.min(2, 900 / base.width);
          var vp = pagina.getViewport({ scale: scala });
          var canvas = document.createElement("canvas");
          canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
          canvas.className = "anteprima-pdf";
          canvas.setAttribute("role", "img");
          return pagina.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise.then(function () {
            var cart = leggiCartiglio(righe);
            return { righe: righe, haTesto: righe.length > 0, campi: cart.campi, trovati: cart.trovati, titolo: cart.titolo, pagine: doc.numPages, canvas: canvas };
          });
        });
      });
    });
  }

  root.FILE = { leggiStep: leggiStep, leggiPdf: leggiPdf, proponiMisure: proponiMisure, creaViewer: creaViewer };
})(window);
