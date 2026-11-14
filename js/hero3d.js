/* PEZZO 3D DELLA PRIMA SCHERMATA.
   Si carica subito, in parallelo alla pagina (preload nell'HTML). Nel frattempo si vede una foto identica del pezzo
   (img/hero-pezzo.webp); quando il 3D e' pronto prende il suo posto con una dissolvenza e il pezzo inizia a girare.
   Il pezzo e' un file leggero gia' convertito (img/hero-pezzo.bin), non serve leggere uno STEP. */
import * as THREE from "three";
import { RoomEnvironment } from "./vendor/RoomEnvironment.js";

(function () {
  "use strict";
  var box = document.querySelector(".hero-visual");
  if (!box) return;
  var canvas = box.querySelector(".hv-canvas");
  var ridotto = false; // rotazione lenta sempre attiva (anche con "riduci animazioni" di Windows): è il cuore visivo della pagina

  // Stile del pezzo: "schizzo" (disegno a linee che ruota, predefinito) oppure metallo 3D (?disco=3d)
  var modo3d = document.documentElement.classList.contains("disco-3d");
  var ANGOLO_INIZIO = 0.6;   // stesso angolo della foto segnaposto
  var INCLINAZIONE = -1.0;   // quanto il pezzo e' inclinato verso chi guarda
  var VELOCITA = 0.22;       // giri (radianti al secondo)

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) { return; } // senza 3D resta la foto: va bene lo stesso
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  if (!modo3d) renderer.toneMapping = THREE.NoToneMapping; // disegno: bianchi veri, niente effetto fotografico
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  var scena = new THREE.Scene();
  if (modo3d) {
    var pmrem = new THREE.PMREMGenerator(renderer);
    scena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; // riflessi da officina
    scena.environmentIntensity = 1.1;
  }

  var camera = new THREE.PerspectiveCamera(30, 1, 1, 2000);
  camera.position.set(0, -16, 290);

  var esterno = new THREE.Group();  // inclinazione e movimento del mouse
  var interno = new THREE.Group();  // rotazione attorno all'asse del pezzo (come un pezzo al tornio)
  esterno.add(interno); scena.add(esterno);
  esterno.rotation.x = INCLINAZIONE;
  interno.rotation.z = ANGOLO_INIZIO;

  var luceChiave = new THREE.DirectionalLight(0xffffff, 1.4); luceChiave.position.set(1.2, 1.4, 1.6); scena.add(luceChiave);
  var luceBordo = new THREE.DirectionalLight(0x22d3ee, modo3d ? 2.2 : 0.2); luceBordo.position.set(-1.6, 0.6, -1.2); scena.add(luceBordo);
  var luceEmi = new THREE.HemisphereLight(0xa9c2f0, 0x1b2745, 0.55); scena.add(luceEmi);

  var visibile = true, pronto = false, t0 = performance.now(), mouseX = 0, mouseY = 0;

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

  // ---------- Disegno a matita ----------
  // Riempimento: carta con tratteggio (le ombre sono righe oblique, piu' fitte dove e' piu' scuro).
  // Spigoli: ridisegnati due volte con una piccola irregolarita' fissa sul pezzo (la mano non e' una riga).
  var matRiempi = null, matContorno = null, matSpigoli = [];
  function temaChiaro() { return document.documentElement.getAttribute("data-theme") === "light"; }
  function applicaTema(chiaro) {
    if (!matRiempi) return;
    var inchiostro = chiaro ? 0x2b3448 : 0xbfe6ff;
    matRiempi.uniforms.uCarta.value.setHex(chiaro ? 0xfdfdfb : 0x14264f);
    matRiempi.uniforms.uInchiostro.value.setHex(inchiostro);
    matRiempi.uniforms.uForza.value = chiaro ? 0.72 : 0.5;
    matContorno.color.setHex(chiaro ? 0x232b3d : 0xbfe6ff);
    matSpigoli.forEach(function (m, k) { m.color.setHex(inchiostro); m.opacity = (k === 0 ? 0.92 : 0.5) * (chiaro ? 1 : 0.9); });
  }
  function aggiornaUniformi() { if (matRiempi) matRiempi.uniforms.uAltezza.value = canvas.height; }
  function rumore(x, y, z, seme) {
    return (Math.sin(x * 0.34 + seme) + Math.sin(y * 0.41 + seme * 1.7) + Math.sin(z * 0.29 + seme * 2.3) + 0.5 * Math.sin((x + y + z) * 0.95 + seme * 3.1)) / 3.5;
  }
  function spigoliSchizzo(geom, seme, ampiezza, mat) {
    var eg = new THREE.EdgesGeometry(geom, 28), p = eg.attributes.position, out = [];
    var a = new THREE.Vector3(), b = new THREE.Vector3(), q = new THREE.Vector3();
    for (var i = 0; i < p.count; i += 2) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1);
      var n = Math.max(1, Math.ceil(a.distanceTo(b) / 3)), prec = null;
      for (var k = 0; k <= n; k++) {
        q.lerpVectors(a, b, k / n);
        var pt = [q.x + ampiezza * rumore(q.x, q.y, q.z, seme), q.y + ampiezza * rumore(q.y, q.z, q.x, seme + 1.3), q.z + ampiezza * rumore(q.z, q.x, q.y, seme + 2.1)];
        if (prec) out.push(prec[0], prec[1], prec[2], pt[0], pt[1], pt[2]);
        prec = pt;
      }
    }
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
    return new THREE.LineSegments(g, mat);
  }
  var VERT_MATITA = "varying vec3 vN; void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
  var FRAG_MATITA = [
    "uniform vec3 uCarta; uniform vec3 uInchiostro; uniform float uAltezza; uniform float uForza; varying vec3 vN;",
    "float tratto(float coord, float sp, float w) { float s = abs(fract(coord / sp) - 0.5) * 2.0; return step(0.02, w) * smoothstep(1.0 - w - 0.10, 1.0 - w, s); }",
    "void main() {",
    "  vec3 n = normalize(vN); vec3 L = normalize(vec3(-0.45, 0.75, 0.55));",
    "  float luce = max(dot(n, L), 0.0);",
    "  float ombra = 1.0 - (0.30 + 0.70 * luce);",
    "  float sp = uAltezza / 72.0;",
    "  float w1 = smoothstep(0.14, 0.65, ombra) * 0.42;",
    "  float w2 = smoothstep(0.50, 0.75, ombra) * 0.34;",
    "  float t = max(tratto(gl_FragCoord.x + gl_FragCoord.y, sp, w1), tratto(gl_FragCoord.x - gl_FragCoord.y, sp * 1.18, w2));",
    "  gl_FragColor = vec4(mix(uCarta, uInchiostro, t * uForza), 1.0);",
    "  #include <colorspace_fragment>",
    "}"].join("\n");
  if (!modo3d && window.MutationObserver) {
    new MutationObserver(function () { applicaTema(temaChiaro()); if (pronto && !visibile) disegna(0); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  fetch("img/hero-pezzo.bin").then(function (r) { if (!r.ok) throw new Error("modello non trovato"); return r.arrayBuffer(); }).then(function (buf) {
    var geom = leggiModello(buf);
    var c = new THREE.Vector3(); geom.boundingBox.getCenter(c);
    geom.translate(-c.x, -c.y, -c.z); // il centro del pezzo sull'asse di rotazione
    var gruppo = new THREE.Group();
    if (modo3d) {
      var materiale = new THREE.MeshStandardMaterial({ color: 0xcfd8e6, metalness: 0.96, roughness: 0.3, envMapIntensity: 1.25 });
      var spigoli3d = new THREE.LineSegments(new THREE.EdgesGeometry(geom, 38), new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.28 }));
      gruppo.add(new THREE.Mesh(geom, materiale), spigoli3d);
    } else {
      matRiempi = new THREE.ShaderMaterial({
        uniforms: { uCarta: { value: new THREE.Color(0xfdfdfb) }, uInchiostro: { value: new THREE.Color(0x2b3448) }, uAltezza: { value: 1200 }, uForza: { value: 0.72 } },
        vertexShader: VERT_MATITA, fragmentShader: FRAG_MATITA, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
      });
      matContorno = new THREE.MeshBasicMaterial({ color: 0x232b3d, side: THREE.BackSide });
      matSpigoli = [new THREE.LineBasicMaterial({ color: 0x2b3448, transparent: true, opacity: 0.92 }), new THREE.LineBasicMaterial({ color: 0x2b3448, transparent: true, opacity: 0.5 })];
      var guscio = new THREE.Mesh(geom, matContorno); guscio.scale.setScalar(1.011);
      gruppo.add(guscio, new THREE.Mesh(geom, matRiempi), spigoliSchizzo(geom, 1.0, 0.32, matSpigoli[0]), spigoliSchizzo(geom, 7.3, 0.6, matSpigoli[1]));
      applicaTema(temaChiaro());
    }
    interno.add(gruppo);
    adatta();
    disegna(0);                                   // primo fotogramma: identico alla foto segnaposto
    requestAnimationFrame(function () {
      box.classList.add("pronto");                // dissolvenza foto -> 3D
      pronto = true;
      requestAnimationFrame(ciclo);
    });
  }).catch(function () { /* resta la foto */ });

  if (window.ResizeObserver) new ResizeObserver(function () { adatta(); if (pronto && (ridotto || !visibile)) disegna(0); }).observe(box);
  if (window.IntersectionObserver) new IntersectionObserver(function (v) { visibile = v[0].isIntersecting; }, { threshold: 0 }).observe(box);
  window.addEventListener("pointermove", function (ev) {
    mouseX = (ev.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (ev.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  // Solo per generare la foto segnaposto (strumenti/genera_poster.js): disegna un fotogramma a una misura data
  window.HERO = {
    scatta: function (lato, tema) {
      var w = box.clientWidth, h = box.clientHeight;
      if (tema) applicaTema(tema === "chiaro");
      renderer.setPixelRatio(1); renderer.setSize(lato, lato, false);
      camera.aspect = 1; camera.updateProjectionMatrix();
      esterno.rotation.set(INCLINAZIONE, 0, 0); interno.rotation.z = ANGOLO_INIZIO;
      aggiornaUniformi();
      renderer.render(scena, camera);
      var url = canvas.toDataURL("image/png");
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      if (tema) applicaTema(temaChiaro());
      return url;
    },
    pronto: function () { return pronto; }
  };
})();
