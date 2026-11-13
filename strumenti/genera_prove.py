"""Genera tre file "difficili" per provare il caricamento: esempi/prove/
 - pdf-scansione.pdf       disegno trasformato in immagine (nessun testo leggibile)
 - pdf-altro-formato.pdf   cartiglio con etichette diverse (Mat., Q.ta', Tolleranze, Finitura)
 - step-due-corpi.step     file con due pezzi separati (perno + boccola)
Uso: python strumenti/genera_prove.py   (servono cadquery, reportlab, pymupdf)"""
import os
import cadquery as cq
import pymupdf
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "esempi", "prove")
os.makedirs(OUT, exist_ok=True)

# 1) PDF scansionato: la pagina del disegno diventa una foto, senza testo
pagina = pymupdf.open(os.path.join(BASE, "esempi", "pdf", "perno-inox.pdf"))[0]
png = os.path.join(OUT, "_tmp.png")
pagina.get_pixmap(dpi=110, colorspace=pymupdf.csGRAY).save(png)
w, h = landscape(A4)
c = canvas.Canvas(os.path.join(OUT, "pdf-scansione.pdf"), pagesize=(w, h))
c.drawImage(png, 0, 0, width=w, height=h)
c.save()
os.remove(png)

# 2) PDF con etichette diverse dal solito
c = canvas.Canvas(os.path.join(OUT, "pdf-altro-formato.pdf"), pagesize=(w, h))
c.rect(10 * mm, 10 * mm, w - 20 * mm, h - 20 * mm)
c.setFont("Helvetica-Bold", 14)
c.drawString(20 * mm, h - 25 * mm, "Disegno 4471 - Perno di fissaggio")
c.setFont("Helvetica", 11)
righe = [
    ("Mat.:", "AISI 316L"),
    ("Q.tà:", "120"),
    ("Tolleranze:", "±0,02"),
    ("Finitura:", "Brunitura"),
]
y = h - 45 * mm
for k, v in righe:
    c.drawString(20 * mm, y, k)
    c.drawString(60 * mm, y, v)
    y -= 8 * mm
c.circle(w / 2, h / 2 - 10 * mm, 18 * mm)
c.drawString(w / 2 - 12 * mm, h / 2 - 40 * mm, "Ø 36 x 60")
c.save()

# 3) STEP con due corpi separati
perno = cq.Workplane("XY").circle(10).extrude(60)
boccola = cq.Workplane("XY").workplane(offset=0).center(50, 0).circle(15).circle(8).extrude(30)
composto = cq.Compound.makeCompound([perno.val(), boccola.val()])
cq.exporters.export(cq.Workplane("XY").newObject([composto]), os.path.join(OUT, "step-due-corpi.step"))
print("ok:", sorted(os.listdir(OUT)))
