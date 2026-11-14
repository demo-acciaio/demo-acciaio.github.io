/* DISCO DELLA PRIMA SCHERMATA CHE RUOTA.
   Predefinito: disco a MATITA, ridisegnato in 3D uguale allo schizzo (flangia con 8 fori, anello, mozzo con sede della linguetta),
   con tratteggio a grafite e spigoli a mano. Nel frattempo si vede una foto identica (img/hero-ruota.webp): quando il 3D e' pronto
   prende il suo posto con una dissolvenza e il disco inizia a girare.
   ?disco=3d: pezzo in metallo (modello img/hero-pezzo.bin, foto img/hero-pezzo.webp).
   Il tema chiaro/scuro lo gestisce il CSS (stessa regola dell'immagine a matita): qui si disegna sempre nero su carta bianca. */
import * as THREE from "three";
import { RoomEnvironment } from "./vendor/RoomEnvironment.js";
import { LETTERE, LARGHEZZA, ALTEZZA } from "./logo-lettere.js";

(function () {
  "use strict";
  var box = document.querySelector(".hero-visual");
  if (!box) return;
  var canvas = box.querySelector(".hv-canvas");
  var ridotto = false; // rotazione lenta sempre attiva (anche con "riduci animazioni" di Windows): e' il cuore visivo della pagina

  var modo3d = document.documentElement.classList.contains("disco-3d");
  var ANGOLO_INIZIO = 0.6;    // stesso angolo della foto segnaposto
  var INCLINAZIONE = modo3d ? -1.0 : -0.95;   // quanto il pezzo e' inclinato verso chi guarda
  var VELOCITA = modo3d ? 0.22 : 0.5;   // giri (radianti al secondo)
  var MOUSE_X = 0.35, MOUSE_Y = 0.18;   // inclinazione del metallo col mouse

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) { return; } // senza 3D resta la foto: va bene lo stesso
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (modo3d) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(0x000000, 0);
  } else {
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0xffffff, 1);          // carta bianca: nel tema chiaro "multiply" la fa sparire, nello scuro l'inversione la rende trasparente
    canvas.classList.add("matita");
  }

  var scena = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, 1, 1, 2000);
  camera.position.set(0, -16, 290);

  var esterno = new THREE.Group();  // inclinazione e movimento del mouse
  var interno = new THREE.Group();  // rotazione attorno all'asse del pezzo (come un pezzo al tornio)
  esterno.add(interno); scena.add(esterno);
  esterno.rotation.x = INCLINAZIONE;
  interno.rotation.z = ANGOLO_INIZIO;

  if (modo3d) {
    var pmrem = new THREE.PMREMGenerator(renderer);
    scena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; // riflessi da officina
    scena.environmentIntensity = 1.1;
    var luceChiave = new THREE.DirectionalLight(0xffffff, 1.4); luceChiave.position.set(1.2, 1.4, 1.6); scena.add(luceChiave);
    var luceBordo = new THREE.DirectionalLight(0x22d3ee, 2.2); luceBordo.position.set(-1.6, 0.6, -1.2); scena.add(luceBordo);
    scena.add(new THREE.HemisphereLight(0xa9c2f0, 0x1b2745, 0.55));
  }

  var visibile = true, pronto = false, t0 = performance.now(), mouseX = 0, mouseY = 0;
  var matGrafite = null;

  /* ---------- Metallo (modo ?disco=3d) ---------- */
  function leggiModello(buf) {
    var dv = new DataView(buf);
    if (dv.getUint32(0, false) !== 0x48503031) throw new Error("formato non riconosciuto"); // 'HP01'
    var nv = dv.getUint32(4, true), nt = dv.getUint32(8, true);
    var pos = new Float32Array(buf, 12, nv * 3);
    var off = 12 + nv * 12;
    var idx = nv < 65536 ? new Uint16Array(buf, off, nt * 3) : new Uint32Array(buf, off, nt * 3);
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    g.computeBoundingBox();
    return g;
  }

  /* ---------- Disco a matita ---------- */
  // Irregolarita' "della mano": un'oscillazione lenta che dipende dalla POSIZIONE sul pezzo (quindi resta attaccata al pezzo quando ruota)
  function rumore3(x, y, z, seme) {
    return (Math.sin(x * 0.34 + seme) + Math.sin(y * 0.41 + seme * 1.7) + Math.sin(z * 0.29 + seme * 2.3) + 0.5 * Math.sin((x + y + z) * 0.95 + seme * 3.1)) / 3.5;
  }
  function trattoMano(a, b, seme, ampiezza, passo, fuori) {
    var n = Math.max(1, Math.ceil(a.distanceTo(b) / passo)), q = new THREE.Vector3(), prec = null;
    for (var k = 0; k <= n; k++) {
      q.lerpVectors(a, b, k / n);
      var pt = [q.x + ampiezza * rumore3(q.x, q.y, q.z, seme), q.y + ampiezza * rumore3(q.y, q.z, q.x, seme + 1.3), q.z + ampiezza * rumore3(q.z, q.x, q.y, seme + 2.1)];
      if (prec) fuori.push(prec[0], prec[1], prec[2], pt[0], pt[1], pt[2]);
      prec = pt;
    }
  }
  function lineeDaGeometria(geom, angolo, seme, ampiezza, mat) {
    var eg = new THREE.EdgesGeometry(geom, angolo), p = eg.attributes.position, fuori = [];
    var a = new THREE.Vector3(), b = new THREE.Vector3();
    for (var i = 0; i < p.count; i += 2) { a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); trattoMano(a, b, seme, ampiezza, 3, fuori); }
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(fuori, 3));
    return new THREE.LineSegments(g, mat);
  }
  function lineeCerchio(cx, cy, z, r, seme, ampiezza, mat) {
    var N = 96, fuori = [], a = new THREE.Vector3(), b = new THREE.Vector3();
    for (var i = 0; i < N; i++) {
      var t0c = i / N * Math.PI * 2, t1c = (i + 1) / N * Math.PI * 2;
      a.set(cx + r * Math.cos(t0c), cy + r * Math.sin(t0c), z); b.set(cx + r * Math.cos(t1c), cy + r * Math.sin(t1c), z);
      trattoMano(a, b, seme, ampiezza, 100, fuori);
    }
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(fuori, 3));
    return new THREE.LineSegments(g, mat);
  }
  // Cerchi come poligoni con punti tutti diversi: con l'arco intero il punto di partenza e quello di arrivo coincidono e
  // lasciavano una riga verticale dentro i fori.
  function puntiCerchio(x, y, r, n) { var p = []; for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; p.push(new THREE.Vector2(x + r * Math.cos(a), y + r * Math.sin(a))); } return p; }
  function foroTondo(x, y, r) { return new THREE.Path(puntiCerchio(x, y, r, 72).reverse()); }
  function cerchioPieno(r, n) { return new THREE.Shape(puntiCerchio(0, 0, r, n)); }
  // Foro centrale con la sede della linguetta (una tacca rettangolare sul lato destro)
  function foroConLinguetta(r, mezza, fondo) {
    var a0 = Math.asin(mezza / r), p = new THREE.Path();
    p.absarc(0, 0, r, a0, Math.PI * 2 - a0, false);
    p.lineTo(r + fondo, -mezza); p.lineTo(r + fondo, mezza); p.closePath();
    return p;
  }
  // Normali "morbide": su un cilindro ogni faccetta piatta avrebbe un'ombra diversa e comparirebbero strisce. Si media la normale
  // delle facce che si toccano in un punto, ma solo se l'angolo fra loro e' piccolo (gli spigoli veri restano netti).
  function normaliLisce(geom, gradi) {
    var pos = geom.attributes.position, n = pos.count, soglia = Math.cos(gradi * Math.PI / 180);
    var facce = [], mappa = {}, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nf = new THREE.Vector3();
    var chiave = function (i) { return Math.round(pos.getX(i) * 500) + "," + Math.round(pos.getY(i) * 500) + "," + Math.round(pos.getZ(i) * 500); };
    for (var i = 0; i < n; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      nf.subVectors(b, a).cross(c.clone().sub(a)).normalize();
      facce.push(nf.clone());
      for (var k = 0; k < 3; k++) { var ch = chiave(i + k); (mappa[ch] = mappa[ch] || []).push(i / 3); }
    }
    var out = new Float32Array(n * 3), m = new THREE.Vector3();
    for (var t = 0; t < n; t++) {
      var fi = Math.floor(t / 3), fn = facce[fi]; m.set(0, 0, 0);
      var vicine = mappa[chiave(t)];
      for (var q = 0; q < vicine.length; q++) { var g = facce[vicine[q]]; if (g.dot(fn) >= soglia) m.add(g); }
      m.normalize(); out[t * 3] = m.x; out[t * 3 + 1] = m.y; out[t * 3 + 2] = m.z;
    }
    geom.setAttribute("normal", new THREE.BufferAttribute(out, 3));
    return geom;
  }
  function estrusione(shape, altezza, smusso, z0) {
    var g = new THREE.ExtrudeGeometry(shape, { depth: altezza - 2 * smusso, bevelEnabled: true, bevelThickness: smusso, bevelSize: smusso, bevelSegments: 2, curveSegments: 96 });
    g.translate(0, 0, z0 + smusso);
    return normaliLisce(g, 38);
  }

  // Tutto e' calcolato nello spazio del PEZZO (normali, posizione, luce): quando il disco gira o oscilla, ombra e tratteggio restano
  // attaccati alla superficie come disegnati sopra, senza "righe che scorrono" e senza zone che appaiono o spariscono.
  var VERT_MATITA = "varying vec3 vNo; varying vec3 vPo; void main() { vNo = normal; vPo = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
  var FRAG_MATITA = [
    "uniform vec3 uCarta; uniform vec3 uInchiostro; uniform vec3 uLobj; uniform float uPasso; varying vec3 vNo; varying vec3 vPo;",
    "float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
    "float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }",
    // una riga di matita sul pezzo; si attenua da sola dove le righe diventerebbero troppo fitte sullo schermo (niente effetto moire')
    "float riga(float c, float w) {",
    "  float fw = fwidth(c); float s = abs(fract(c) - 0.5) * 2.0;",
    "  float r = smoothstep(1.0 - w - 2.0 * fw, 1.0 - w, s);",
    "  return step(0.02, w) * r * (1.0 - smoothstep(0.28, 0.55, fw)); }",
    "void main() {",
    "  vec3 n = normalize(vNo);",
    "  float luce = max(dot(n, normalize(uLobj)), 0.0);",
    "  float ombra = 1.0 - (0.34 + 0.66 * luce);",
    "  vec3 d1 = normalize(vec3(0.80, 0.60, 0.30)); vec3 d2 = normalize(vec3(-0.55, 0.75, 0.35));",
    "  float a = dot(vPo, d1); float b = dot(vPo, d2);",
    // sfumatura di grafite: tono morbido con striature sottili (la mano che passa la matita in una direzione)
    "  float striscia = noise(vec2(a * 0.08, b * 0.85)) * 0.70 + noise(vec2(a * 0.19 + 9.0, b * 1.9)) * 0.30;",
    "  float morbido = pow(ombra, 1.0) * 0.80 * (0.78 + 0.45 * striscia);",
    // poche righe di tratteggio, solo nelle zone piu' scure
    "  float w1 = smoothstep(0.42, 0.78, ombra) * 0.18; float w2 = smoothstep(0.68, 0.88, ombra) * 0.14;",
    "  float pr = 0.55 + 0.45 * noise(vec2(a * 0.2, b * 0.2));",
    "  float h = max(riga(b / uPasso, w1), riga(a / (uPasso * 1.25), w2)) * pr;",
    "  float grana = (hash(gl_FragCoord.xy * 0.7) - 0.5) * 0.05 * smoothstep(0.03, 0.2, ombra);",
    "  float t = clamp(morbido + h * 0.16 + grana, 0.0, 1.0);",
    "  gl_FragColor = vec4(mix(uCarta, uInchiostro, t * 0.9), 1.0);",
    "  #include <colorspace_fragment>",
    "}"].join("\n");

  // "ARTIGIANCAVI" con le lettere del logo, incisa su un arco della faccia superiore (la base delle lettere sta verso il bordo,
  // la cima verso il mozzo). Ogni punto della lettera e' portato sull'arco; i lati sono suddivisi cosi' restano curvi.
  function scrittaIncisa(gruppo, z, centroGradi, bordo, altezza, matRiempi, matL1, matL2) {
    var sc = altezza / ALTEZZA, rm = bordo - altezza / 2, uc = LARGHEZZA / 2, th0 = centroGradi * Math.PI / 180;
    var porta = function (pt) { var u = (pt[0] - uc) * sc, v = pt[1] * sc, th = th0 + u / rm, r = bordo - v; return new THREE.Vector2(r * Math.cos(th), r * Math.sin(th)); };
    var densa = function (poly) {
      var out = [];
      for (var i = 0; i < poly.length; i++) {
        var a = poly[i], b = poly[(i + 1) % poly.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.6));
        for (var k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
      }
      return out;
    };
    var linee = function (pts, seme, amp, mat) {
      var fuori = [], a = new THREE.Vector3(), b = new THREE.Vector3();
      for (var i = 0; i < pts.length; i++) { var p = pts[i], q = pts[(i + 1) % pts.length]; a.set(p.x, p.y, z + 0.05); b.set(q.x, q.y, z + 0.05); trattoMano(a, b, seme, amp, 2, fuori); }
      var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(fuori, 3));
      return new THREE.LineSegments(g, mat);
    };
    LETTERE.forEach(function (l, i) {
      var est = densa(l.e).map(porta), fori = l.f.map(function (h) { return densa(h).map(porta); });
      var forma = new THREE.Shape(est); fori.forEach(function (h) { forma.holes.push(new THREE.Path(h)); });
      var m = new THREE.Mesh(new THREE.ShapeGeometry(forma), matRiempi); m.position.z = z + 0.04; gruppo.add(m);
      gruppo.add(linee(est, 11 + i, 0.14, matL1), linee(est, 23 + i, 0.3, matL2));
      fori.forEach(function (h, k) { gruppo.add(linee(h, 41 + i + k, 0.14, matL1)); });
    });
  }

  function costruisciDiscoMatita() {
    // Misure ricavate dallo schizzo (raggio flangia = 100)
    var R = 100, SPESS = 26, R_MOZZO = 43, ALT_MOZZO = 36, R_FORO = 22.4, R_FORI = 74, r_foro = 8;
    var ANGOLI_FORI = [-56, -12, 124, 168].map(function (g) { return g * Math.PI / 180; });   // 4 fori, nei vuoti fra le due scritte
    var CENTRO_SCRITTA = -124;                                                                   // gradi: la prima scritta sta davanti nell'immagine di partenza
    // La luce e' scelta in modo che la prima immagine (foto di partenza) abbia l'ombra a destra, poi resta fissa SUL PEZZO
    var inizio = new THREE.Matrix4().makeRotationX(INCLINAZIONE).multiply(new THREE.Matrix4().makeRotationZ(ANGOLO_INIZIO));
    var lucePezzo = new THREE.Vector3(-0.70, 0.55, 0.50).normalize().transformDirection(inizio.clone().invert());
    matGrafite = new THREE.ShaderMaterial({
      uniforms: { uCarta: { value: new THREE.Color(0xffffff) }, uInchiostro: { value: new THREE.Color(0x2a2a2a) }, uLobj: { value: lucePezzo }, uPasso: { value: 3.4 } },
      vertexShader: VERT_MATITA, fragmentShader: FRAG_MATITA, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
    });
    var matContorno = new THREE.MeshBasicMaterial({ color: 0x2f2f2f, side: THREE.BackSide });
    var matLinea1 = new THREE.LineBasicMaterial({ color: 0x2a2a2a, transparent: true, opacity: 0.92 });
    var matLinea2 = new THREE.LineBasicMaterial({ color: 0x2a2a2a, transparent: true, opacity: 0.45 });
    var matLieve = new THREE.LineBasicMaterial({ color: 0x2a2a2a, transparent: true, opacity: 0.55 });

    var flangia = cerchioPieno(R, 160);
    ANGOLI_FORI.forEach(function (a) { flangia.holes.push(foroTondo(R_FORI * Math.cos(a), R_FORI * Math.sin(a), r_foro)); });
    flangia.holes.push(foroTondo(0, 0, R_FORO));
    var gFlangia = estrusione(flangia, SPESS, 1.6, 0);

    var mozzo = cerchioPieno(R_MOZZO, 120);
    mozzo.holes.push(foroConLinguetta(R_FORO, 3.4, 5.5));
    var gMozzo = estrusione(mozzo, ALT_MOZZO, 0.8, SPESS);

    var gruppo = new THREE.Group();
    [gFlangia, gMozzo].forEach(function (g) {
      var guscio = new THREE.Mesh(g, matContorno); guscio.scale.setScalar(1.007);
      gruppo.add(guscio, new THREE.Mesh(g, matGrafite));
    });
    // spigoli: ogni linea e' ridisegnata due volte, con una piccola irregolarita' diversa
    [gFlangia, gMozzo].forEach(function (g, i) {
      gruppo.add(lineeDaGeometria(g, 28, 1.0 + i, 0.30, matLinea1), lineeDaGeometria(g, 28, 7.3 + i, 0.62, matLinea2));
    });
    // segni sulla faccia superiore: anello, bordo con gradino, cerchio leggero, svasature dei fori
    var zf = SPESS + 0.06;
    gruppo.add(lineeCerchio(0, 0, zf, 83, 3.1, 0.30, matLinea1), lineeCerchio(0, 0, zf, 78, 4.4, 0.30, matLinea2), lineeCerchio(0, 0, zf, 94, 2.2, 0.3, matLinea2));
    ANGOLI_FORI.forEach(function (b, j) {
      gruppo.add(lineeCerchio(R_FORI * Math.cos(b), R_FORI * Math.sin(b), zf, r_foro + 2.4, 6.0 + j, 0.25, matLinea1));
    });
    var matIncisione = new THREE.MeshBasicMaterial({ color: 0x5a5a5a, transparent: true, opacity: 0.62, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    scrittaIncisa(gruppo, zf, CENTRO_SCRITTA, 64, 13.5, matIncisione, matLinea1, matLinea2);
    scrittaIncisa(gruppo, zf, CENTRO_SCRITTA + 180, 64, 13.5, matIncisione, matLinea1, matLinea2);
    gruppo.position.z = -(SPESS + ALT_MOZZO) / 2 + 6;   // il disco sull'asse di rotazione
    gruppo.scale.setScalar(0.64);
    return gruppo;
  }
  function aggiornaUniformi() { /* niente da aggiornare: il tratteggio e' nello spazio del pezzo */ }

  function adatta() {
    var w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function disegna(t) {
    interno.rotation.z = ANGOLO_INIZIO + (ridotto ? 0 : t * VELOCITA);
    if (modo3d) {
      esterno.rotation.y += (mouseX * MOUSE_X - esterno.rotation.y) * 0.05;
      esterno.rotation.x += (INCLINAZIONE + mouseY * MOUSE_Y - esterno.rotation.x) * 0.05;
    } else {
      // segue il mouse e in piu' oscilla appena (all'istante 0, con il mouse al centro, e' come la foto): si vedono le superfici girare
      esterno.rotation.y += (mouseX * 0.38 + 0.16 * Math.sin(t * 0.45) - esterno.rotation.y) * 0.06;
      esterno.rotation.x += (INCLINAZIONE + mouseY * 0.2 + 0.04 * Math.sin(t * 0.31) - esterno.rotation.x) * 0.06;
    }
    aggiornaUniformi();
    renderer.render(scena, camera);
  }

  function ciclo(ora) {
    requestAnimationFrame(ciclo);
    if (!visibile || document.hidden || ridotto) return;
    disegna((ora - t0) / 1000);
  }

  function pronti() {
    adatta();
    disegna(0);                                   // primo fotogramma: identico alla foto segnaposto
    requestAnimationFrame(function () {
      box.classList.add("pronto");                // dissolvenza foto -> 3D
      pronto = true;
      requestAnimationFrame(ciclo);
    });
  }

  if (modo3d) {
    fetch("img/hero-pezzo.bin").then(function (r) { if (!r.ok) throw new Error("modello non trovato"); return r.arrayBuffer(); }).then(function (buf) {
      var geom = leggiModello(buf);
      var c = new THREE.Vector3(); geom.boundingBox.getCenter(c);
      geom.translate(-c.x, -c.y, -c.z); // il centro del pezzo sull'asse di rotazione
      var materiale = new THREE.MeshStandardMaterial({ color: 0xcfd8e6, metalness: 0.96, roughness: 0.3, envMapIntensity: 1.25 });
      var spigoli = new THREE.LineSegments(new THREE.EdgesGeometry(geom, 38), new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.28 }));
      var gruppo = new THREE.Group(); gruppo.add(new THREE.Mesh(geom, materiale), spigoli);
      interno.add(gruppo);
      pronti();
    }).catch(function () { /* resta la foto */ });
  } else {
    try { interno.add(costruisciDiscoMatita()); pronti(); } catch (e) { /* resta la foto */ }
  }

  if (window.ResizeObserver) new ResizeObserver(function () { adatta(); if (pronto && (ridotto || !visibile)) disegna(0); }).observe(box);
  if (window.IntersectionObserver) new IntersectionObserver(function (v) { visibile = v[0].isIntersecting; }, { threshold: 0 }).observe(box);
  window.addEventListener("pointermove", function (ev) {
    mouseX = (ev.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (ev.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  // Solo per generare la foto segnaposto (strumenti/genera_poster_schizzo.js): disegna un fotogramma a una misura data
  window.HERO = {
    scatta: function (lato) {
      var w = box.clientWidth, h = box.clientHeight;
      renderer.setPixelRatio(1); renderer.setSize(lato, lato, false);
      camera.aspect = 1; camera.updateProjectionMatrix();
      esterno.rotation.set(INCLINAZIONE, 0, 0); interno.rotation.z = ANGOLO_INIZIO;
      aggiornaUniformi();
      renderer.render(scena, camera);
      var url = canvas.toDataURL("image/png");
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      return url;
    },
    pronto: function () { return pronto; }
  };
})();
