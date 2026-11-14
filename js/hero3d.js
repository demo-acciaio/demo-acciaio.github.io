/* DISCO DELLA PRIMA SCHERMATA CHE RUOTA.
   Predefinito: disco a MATITA, ridisegnato in 3D uguale allo schizzo (flangia con 8 fori, anello, mozzo con sede della linguetta),
   con tratteggio a grafite e spigoli a mano. Nel frattempo si vede una foto identica (img/hero-ruota.webp): quando il 3D e' pronto
   prende il suo posto con una dissolvenza e il disco inizia a girare.
   ?disco=3d: pezzo in metallo (modello img/hero-pezzo.bin, foto img/hero-pezzo.webp).
   Il tema chiaro/scuro lo gestisce il CSS (stessa regola dell'immagine a matita): qui si disegna sempre nero su carta bianca. */
import * as THREE from "three";
import { RoomEnvironment } from "./vendor/RoomEnvironment.js";

(function () {
  "use strict";
  var box = document.querySelector(".hero-visual");
  if (!box) return;
  var canvas = box.querySelector(".hv-canvas");
  var ridotto = false; // rotazione lenta sempre attiva (anche con "riduci animazioni" di Windows): e' il cuore visivo della pagina

  var modo3d = document.documentElement.classList.contains("disco-3d");
  var ANGOLO_INIZIO = 0.6;    // stesso angolo della foto segnaposto
  var INCLINAZIONE = modo3d ? -1.0 : -0.95;   // quanto il pezzo e' inclinato verso chi guarda
  var VELOCITA = 0.22;        // giri (radianti al secondo)

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
  function foroTondo(x, y, r) { var p = new THREE.Path(); p.absarc(x, y, r, 0, Math.PI * 2, true); return p; }
  // Foro centrale con la sede della linguetta (una tacca rettangolare sul lato destro)
  function foroConLinguetta(r, mezza, fondo) {
    var a0 = Math.asin(mezza / r), p = new THREE.Path();
    p.absarc(0, 0, r, a0, Math.PI * 2 - a0, false);
    p.lineTo(r + fondo, -mezza); p.lineTo(r + fondo, mezza); p.closePath();
    return p;
  }
  function estrusione(shape, altezza, smusso, z0) {
    var g = new THREE.ExtrudeGeometry(shape, { depth: altezza - 2 * smusso, bevelEnabled: true, bevelThickness: smusso, bevelSize: smusso, bevelSegments: 2, curveSegments: 96 });
    g.translate(0, 0, z0 + smusso);
    return g;
  }

  var VERT_MATITA = "varying vec3 vN; void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
  var FRAG_MATITA = [
    "uniform vec3 uCarta; uniform vec3 uInchiostro; uniform float uAltezza; varying vec3 vN;",
    "float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
    "float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }",
    // una riga di matita: spessore w, la pressione varia lungo il foglio
    "float tratto(float coord, float sp, float w, vec2 q) {",
    "  float s = abs(fract(coord / sp) - 0.5) * 2.0;",
    "  float pressione = 0.50 + 0.50 * noise(q * 0.07);",
    "  return step(0.02, w) * smoothstep(1.0 - w - 0.14, 1.0 - w, s) * pressione; }",
    "void main() {",
    "  vec3 n = normalize(vN); vec3 L = normalize(vec3(-0.70, 0.55, 0.50));",
    "  float luce = max(dot(n, L), 0.0);",
    "  float ombra = 1.0 - (0.34 + 0.66 * luce);",
    "  vec2 q = gl_FragCoord.xy;",
    "  vec2 o = q + 2.4 * vec2(noise(q * 0.03), noise(q * 0.03 + 17.0));",            // righe leggermente ondulate
    "  float sp = uAltezza / 95.0;",
    "  float w1 = smoothstep(0.22, 0.66, ombra) * 0.27;",
    "  float w2 = smoothstep(0.56, 0.82, ombra) * 0.22;",
    "  float t1 = tratto(o.x * 0.80 + o.y * 0.60, sp, w1, q);",
    "  float t2 = tratto(o.x * 0.62 - o.y * 0.78, sp * 1.25, w2, q + 40.0);",
    "  float morbido = pow(ombra, 1.3) * 0.24;",                                                   // sfumatura di grafite sotto le righe
    "  float grana = (hash(q * 0.7) - 0.5) * 0.06;",                                     // grana della carta
    "  float t = clamp(max(t1, t2) * 0.85 + morbido + grana, 0.0, 1.0);",
    "  gl_FragColor = vec4(mix(uCarta, uInchiostro, t * 0.9), 1.0);",
    "  #include <colorspace_fragment>",
    "}"].join("\n");

  function costruisciDiscoMatita() {
    // Misure ricavate dallo schizzo (raggio flangia = 100)
    var R = 100, SPESS = 26, R_MOZZO = 43, ALT_MOZZO = 36, R_FORO = 22.4, R_FORI = 70, r_foro = 8;
    matGrafite = new THREE.ShaderMaterial({
      uniforms: { uCarta: { value: new THREE.Color(0xffffff) }, uInchiostro: { value: new THREE.Color(0x2a2a2a) }, uAltezza: { value: 1200 } },
      vertexShader: VERT_MATITA, fragmentShader: FRAG_MATITA, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
    });
    var matContorno = new THREE.MeshBasicMaterial({ color: 0x2f2f2f, side: THREE.BackSide });
    var matLinea1 = new THREE.LineBasicMaterial({ color: 0x2a2a2a, transparent: true, opacity: 0.92 });
    var matLinea2 = new THREE.LineBasicMaterial({ color: 0x2a2a2a, transparent: true, opacity: 0.45 });
    var matLieve = new THREE.LineBasicMaterial({ color: 0x2a2a2a, transparent: true, opacity: 0.55 });

    var flangia = new THREE.Shape(); flangia.absarc(0, 0, R, 0, Math.PI * 2, false);
    for (var k = 0; k < 8; k++) { var a = k * Math.PI / 4; flangia.holes.push(foroTondo(R_FORI * Math.cos(a), R_FORI * Math.sin(a), r_foro)); }
    flangia.holes.push(foroTondo(0, 0, R_FORO));
    var gFlangia = estrusione(flangia, SPESS, 1.6, 0);

    var mozzo = new THREE.Shape(); mozzo.absarc(0, 0, R_MOZZO, 0, Math.PI * 2, false);
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
    gruppo.add(lineeCerchio(0, 0, zf, 62, 5.7, 0.35, matLieve));
    for (var j = 0; j < 8; j++) {
      var b = j * Math.PI / 4;
      gruppo.add(lineeCerchio(R_FORI * Math.cos(b), R_FORI * Math.sin(b), zf, r_foro + 2.4, 6.0 + j, 0.25, matLinea1));
    }
    gruppo.position.z = -(SPESS + ALT_MOZZO) / 2 + 6;   // il disco sull'asse di rotazione
    gruppo.scale.setScalar(0.64);
    return gruppo;
  }
  function aggiornaUniformi() { if (matGrafite) matGrafite.uniforms.uAltezza.value = canvas.height; }

  function adatta() {
    var w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function disegna(t) {
    interno.rotation.z = ANGOLO_INIZIO + (ridotto ? 0 : t * VELOCITA);
    esterno.rotation.y += (mouseX * 0.35 - esterno.rotation.y) * 0.05;
    esterno.rotation.x += (INCLINAZIONE + mouseY * 0.18 - esterno.rotation.x) * 0.05;
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
