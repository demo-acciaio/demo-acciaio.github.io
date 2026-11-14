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
    renderer.render(scena, camera);
  }

  function ciclo(ora) {
    requestAnimationFrame(ciclo);
    if (!visibile || document.hidden || ridotto) return;
    disegna((ora - t0) / 1000);
  }

  // Colori del disegno: linee scure su carta nel tema chiaro, linee chiare su blu notte nel tema scuro
  var matRiempi = null, matContorno = null, matSpigoli = null;
  function temaChiaro() { return document.documentElement.getAttribute("data-theme") === "light"; }
  function applicaTema(chiaro) {
    if (!matRiempi) return;
    matRiempi.color.setHex(chiaro ? 0xffffff : 0x2a4a8c);
    matContorno.color.setHex(chiaro ? 0x1c2540 : 0xbfe6ff);
    matSpigoli.color.setHex(chiaro ? 0x1c2540 : 0xbfe6ff);
    matSpigoli.opacity = chiaro ? 0.9 : 0.85;
    luceChiave.intensity = chiaro ? 2.8 : 1.4;   // su carta il disegno e' quasi bianco
    luceEmi.intensity = chiaro ? 1.6 : 0.55;
  }
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
      // Disegno tecnico: contorno spesso (guscio rovesciato), riempimento a 3 toni, spigoli sottili
      var tre = new THREE.DataTexture(new Uint8Array([200, 230, 255]), 3, 1, THREE.RedFormat);
      tre.minFilter = tre.magFilter = THREE.NearestFilter; tre.needsUpdate = true;
      matRiempi = new THREE.MeshToonMaterial({ color: 0xf3f6fb, gradientMap: tre, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      matContorno = new THREE.MeshBasicMaterial({ color: 0x1c2540, side: THREE.BackSide });
      matSpigoli = new THREE.LineBasicMaterial({ color: 0x1c2540, transparent: true, opacity: 0.9 });
      var guscio = new THREE.Mesh(geom, matContorno); guscio.scale.setScalar(1.02);
      gruppo.add(guscio, new THREE.Mesh(geom, matRiempi), new THREE.LineSegments(new THREE.EdgesGeometry(geom, 28), matSpigoli));
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
