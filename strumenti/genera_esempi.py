"""Genera i file di esempio della demo: pezzi STEP e disegni PDF con cartiglio.
Uso (da un ambiente con cadquery e reportlab):  python strumenti/genera_esempi.py
Scrive in esempi/step e esempi/pdf, e esempi/elenco.json (misure e volumi reali, per controllo)."""
import json
import os
import cadquery as cq
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STEP_DIR = os.path.join(BASE, "esempi", "step")
PDF_DIR = os.path.join(BASE, "esempi", "pdf")
os.makedirs(STEP_DIR, exist_ok=True)
os.makedirs(PDF_DIR, exist_ok=True)


# ---------------- Pezzi 3D ----------------
def perno():
    # albero a gradini, asse Z: d20 x 60, d14 x 25, d10 x 15, con gola e smusso
    p = (cq.Workplane("XY").circle(10).extrude(60)
         .faces(">Z").workplane().circle(7).extrude(25)
         .faces(">Z").workplane().circle(5).extrude(15))
    gola = (cq.Workplane("XY").workplane(offset=52).circle(10.5).circle(8.5).extrude(3))
    p = p.cut(gola)
    return p.faces("<Z").chamfer(1.0)


def boccola():
    return cq.Workplane("XY").circle(20).circle(12.5).extrude(35).faces(">Z").chamfer(1.0)


def flangia():
    f = cq.Workplane("XY").circle(60).extrude(15)
    f = f.faces(">Z").workplane().circle(30).extrude(10)
    f = f.faces(">Z").workplane().hole(40)
    f = (f.faces(">Z[-2]").workplane().polarArray(45, 0, 360, 6).hole(9)) if False else f
    fori = (cq.Workplane("XY").polarArray(45, 0, 360, 6).circle(4.5).extrude(15))
    return f.cut(fori)


def staffa():
    s = cq.Workplane("XY").box(100, 40, 8, centered=(False, False, False))
    s = s.union(cq.Workplane("XY").box(100, 8, 60, centered=(False, False, False)))
    s = s.faces(">Z").workplane(centerOption="CenterOfBoundBox").pushPoints([(-30, 0), (30, 0)]).hole(9)
    s = s.faces("<Y").workplane(centerOption="CenterOfBoundBox").pushPoints([(-25, 5), (25, 5)]).hole(6.5)
    return s.edges("|Z").edges(">X or <X").fillet(3)


def piastra():
    p = cq.Workplane("XY").box(150, 100, 20, centered=(False, False, False))
    p = p.faces(">Z").workplane(centerOption="CenterOfBoundBox").pushPoints([(-40, 0), (0, 0), (40, 0)]).rect(28, 60).cutBlind(-8)
    p = p.faces(">Z").workplane(centerOption="CenterOfBoundBox").rect(130, 80, forConstruction=True).vertices().hole(8)
    return p.edges("|Z").fillet(4)


PEZZI = [
    dict(id="perno-inox", nome="Perno a gradini", fn=perno, materiale="Inox AISI 304", qta=50,
         tol="±0,05", trat="Passivazione", reparto="Tornitura", scala="2:1"),
    dict(id="boccola-bronzo", nome="Boccola", fn=boccola, materiale="Bronzo CuSn12", qta=100,
         tol="±0,02", trat="Nessuno", reparto="Tornitura", scala="2:1"),
    dict(id="flangia-acciaio", nome="Flangia con mozzo", fn=flangia, materiale="Acciaio C45", qta=25,
         tol="ISO 2768-m", trat="Zincatura", reparto="Tornitura", scala="1:1"),
    dict(id="staffa-alluminio", nome="Staffa ad L", fn=staffa, materiale="Alluminio 6082", qta=40,
         tol="ISO 2768-m", trat="Anodizzazione", reparto="Fresatura", scala="1:1"),
    dict(id="piastra-tasche", nome="Piastra con tasche", fn=piastra, materiale="Alluminio 6082", qta=10,
         tol="±0,05", trat="Nessuno", reparto="Fresatura", scala="1:1"),
]


# ---------------- Disegni PDF ----------------
BLU = (0.0, 0.41, 0.71)


def cornice(c, p, w, h):
    c.setLineWidth(0.8)
    c.rect(10 * mm, 10 * mm, w - 20 * mm, h - 20 * mm)
    # cartiglio in basso a destra
    x0, y0, cw, ch = w - 10 * mm - 120 * mm, 10 * mm, 120 * mm, 40 * mm
    c.setLineWidth(0.6)
    c.rect(x0, y0, cw, ch)
    righe = [
        ("Titolo:", p["nome"]),
        ("Disegno n.:", "DEMO-" + p["id"].upper()),
        ("Materiale:", p["materiale"]),
        ("Quantità:", str(p["qta"]) + " pz"),
        ("Tolleranza generale:", p["tol"]),
        ("Trattamento:", p["trat"]),
        ("Scala:", p["scala"]),
    ]
    rh = ch / (len(righe) + 1)
    for i, (k, v) in enumerate(righe):
        y = y0 + ch - (i + 1) * rh
        c.line(x0, y, x0 + cw, y)
        c.setFont("Helvetica", 7.5)
        c.drawString(x0 + 2 * mm, y + 1.6 * mm, k)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x0 + 38 * mm, y + 1.6 * mm, v)
    c.setFillColorRGB(*BLU)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x0 + 2 * mm, y0 + 1.6 * mm, "DEMO - disegno di esempio, non per produzione")
    c.setFillColorRGB(0, 0, 0)


def quota_h(c, x1, x2, y, testo):
    c.setLineWidth(0.4)
    c.line(x1, y, x2, y)
    c.line(x1, y - 2 * mm, x1, y + 2 * mm)
    c.line(x2, y - 2 * mm, x2, y + 2 * mm)
    c.setFont("Helvetica", 8)
    c.drawCentredString((x1 + x2) / 2, y + 1.5 * mm, testo)


def quota_v(c, x, y1, y2, testo):
    c.setLineWidth(0.4)
    c.line(x, y1, x, y2)
    c.line(x - 2 * mm, y1, x + 2 * mm, y1)
    c.line(x - 2 * mm, y2, x + 2 * mm, y2)
    c.saveState()
    c.translate(x - 1.5 * mm, (y1 + y2) / 2)
    c.rotate(90)
    c.setFont("Helvetica", 8)
    c.drawCentredString(0, 0, testo)
    c.restoreState()


def vista_perno(c, ox, oy, k):
    # vista laterale: asse orizzontale, gradini d20 x60, d14 x25, d10 x15
    segs = [(60, 20), (25, 14), (15, 10)]
    x = ox
    c.setLineWidth(1)
    for l, d in segs:
        c.rect(x, oy - d / 2 * k, l * k, d * k)
        x += l * k
    c.setDash([6, 2, 1, 2], 0); c.line(ox - 8 * mm, oy, x + 8 * mm, oy); c.setDash()
    quota_h(c, ox, x, oy - 20 * k - 8 * mm, "100")
    quota_v(c, ox - 6 * mm, oy - 10 * k, oy + 10 * k, "Ø20")
    c.setFont("Helvetica", 8)
    c.drawString(ox + 60 * k, oy + 10 * k + 3 * mm, "Ø14 x 25")
    c.drawString(ox + 85 * k, oy + 10 * k + 3 * mm, "Ø10 x 15")
    c.drawString(ox, oy + 10 * k + 10 * mm, "Gola 3 mm a Ø17 vicino al gradino Ø14  -  smusso 1 x 45°")


def vista_boccola(c, ox, oy, k):
    c.setLineWidth(1)
    c.circle(ox, oy, 20 * k); c.circle(ox, oy, 12.5 * k)
    c.setDash([6, 2, 1, 2], 0); c.line(ox - 24 * k, oy, ox + 24 * k, oy); c.setDash()
    quota_h(c, ox - 20 * k, ox + 20 * k, oy - 20 * k - 8 * mm, "Ø40")
    c.setFont("Helvetica", 8); c.drawString(ox + 14 * k, oy + 2 * mm, "Ø25 H7")
    c.drawString(ox - 25 * mm, oy - 20 * k - 18 * mm, "Lunghezza 35")


def vista_flangia(c, ox, oy, k):
    c.setLineWidth(1)
    c.circle(ox, oy, 60 * k); c.circle(ox, oy, 30 * k); c.circle(ox, oy, 20 * k)
    import math
    for i in range(6):
        a = math.radians(i * 60)
        c.circle(ox + 45 * k * math.cos(a), oy + 45 * k * math.sin(a), 4.5 * k)
    quota_h(c, ox - 60 * k, ox + 60 * k, oy - 60 * k - 8 * mm, "Ø120")
    c.setFont("Helvetica", 8)
    c.drawString(ox + 62 * k, oy + 8 * mm, "6 fori Ø9 su Ø90")
    c.drawString(ox + 62 * k, oy, "Foro centrale Ø40")
    c.drawString(ox + 62 * k, oy - 8 * mm, "Spessore 15 + mozzo 10")


def vista_staffa(c, ox, oy, k):
    c.setLineWidth(1)
    # vista frontale della base 100 x 40
    c.rect(ox, oy, 100 * k, 40 * k)
    for dx in (20, 80):
        c.circle(ox + dx * k, oy + 20 * k, 4.5 * k)
    quota_h(c, ox, ox + 100 * k, oy - 8 * mm, "100")
    quota_v(c, ox + 100 * k + 8 * mm, oy, oy + 40 * k, "40")
    # vista laterale ad L
    sx = ox + 125 * k
    c.rect(sx, oy, 40 * k, 8 * k)
    c.rect(sx, oy, 8 * k, 60 * k)
    quota_v(c, sx - 8 * mm, oy, oy + 60 * k, "60")
    c.setFont("Helvetica", 8); c.drawString(ox, oy + 50 * k, "Spessore 8  -  fori Ø9 e Ø6,5")


def vista_piastra(c, ox, oy, k):
    c.setLineWidth(1)
    c.rect(ox, oy, 150 * k, 100 * k)
    for cx in (35, 75, 115):
        c.rect(ox + (cx - 14) * k, oy + 20 * k, 28 * k, 60 * k)
    for (px, py) in ((10, 10), (140, 10), (10, 90), (140, 90)):
        c.circle(ox + px * k, oy + py * k, 4 * k)
    quota_h(c, ox, ox + 150 * k, oy - 8 * mm, "150")
    quota_v(c, ox + 150 * k + 8 * mm, oy, oy + 100 * k, "100")
    c.setFont("Helvetica", 8)
    c.drawString(ox, oy + 100 * k + 4 * mm, "Spessore 20  -  3 tasche 28 x 60, prof. 8  -  4 fori Ø8")


# (funzione, scala, x di partenza in mm, y di partenza in mm): scelti perche' tutto resti dentro il foglio
VISTE = {
    "perno-inox": (vista_perno, 2.0, 40, 125), "boccola-bronzo": (vista_boccola, 2.0, 90, 125),
    "flangia-acciaio": (vista_flangia, 1.0, 80, 120), "staffa-alluminio": (vista_staffa, 1.0, 40, 100),
    "piastra-tasche": (vista_piastra, 1.0, 45, 90),
}


def disegno_pdf(p, percorso):
    w, h = landscape(A4)
    c = canvas.Canvas(percorso, pagesize=(w, h))
    c.setTitle("Disegno " + p["nome"])
    cornice(c, p, w, h)
    fn, k, ox, oy = VISTE[p["id"]]
    fn(c, ox * mm, oy * mm, k * mm)
    c.save()


def main():
    elenco = []
    for p in PEZZI:
        solido = p["fn"]()
        step_path = os.path.join(STEP_DIR, p["id"] + ".step")
        cq.exporters.export(solido, step_path)
        bb = solido.val().BoundingBox()
        vol = solido.val().Volume() / 1000.0  # cm3
        disegno_pdf(p, os.path.join(PDF_DIR, p["id"] + ".pdf"))
        elenco.append({
            "id": p["id"], "nome": p["nome"], "reparto": p["reparto"], "materiale": p["materiale"],
            "quantita": p["qta"], "tolleranza": p["tol"], "trattamento": p["trat"],
            "ingombro_mm": [round(bb.xlen, 2), round(bb.ylen, 2), round(bb.zlen, 2)],
            "volume_cm3": round(vol, 3),
        })
        print(p["id"], elenco[-1]["ingombro_mm"], elenco[-1]["volume_cm3"], "cm3")
    with open(os.path.join(BASE, "esempi", "elenco.json"), "w", encoding="utf-8") as f:
        json.dump(elenco, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
