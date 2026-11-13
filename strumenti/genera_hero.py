"""Genera il pezzo della prima schermata, gia' "convertito" in un file leggero: img/hero-pezzo.bin
(niente lettura STEP in pagina: il file si legge in un attimo).
Formato: 4 byte 'HP01' | uint32 numero vertici | uint32 numero triangoli | float32 posizioni (x,y,z) | uint16 o uint32 indici
Uso (ambiente con cadquery):  python strumenti/genera_hero.py"""
import os
import struct
import cadquery as cq

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
USCITA = os.path.join(BASE, "img", "hero-pezzo.bin")

R, H = 60, 14          # flangia: raggio e spessore
RH, HH = 33, 24        # mozzo: raggio e altezza

base = cq.Workplane("XY").circle(R).extrude(H)
mozzo = cq.Workplane("XY").workplane(offset=H).circle(RH).extrude(HH)
p = base.union(mozzo)

# smussi sui bordi esterni
for sel in (">Z", "<Z"):
    try:
        p = p.faces(sel).edges().chamfer(1.4)
    except Exception as e:  # se uno smusso non riesce il pezzo resta valido
        print("smusso saltato", sel, e)

# raccordo tra mozzo e flangia
try:
    p = p.edges(cq.selectors.NearestToPointSelector((RH, 0, H))).fillet(3)
except Exception as e:
    print("raccordo saltato", e)

# foro centrale con cava per la linguetta
p = p.faces(">Z").workplane().hole(34)
cava = cq.Workplane("XY").box(10, 5, H + HH + 2, centered=(True, False, False)).translate((0, 16.5, -1))
p = p.cut(cava)

# 6 fori sulla flangia
fori = cq.Workplane("XY").polarArray(45, 0, 360, 6).circle(4.5).extrude(H + 2).translate((0, 0, -1))
p = p.cut(fori)

# anello inciso sulla faccia della flangia
anello = cq.Workplane("XY").workplane(offset=H - 1.2).circle(53).circle(51).extrude(2)
p = p.cut(anello)

verts, tris = p.val().tessellate(0.06, 0.12)
nv, nt = len(verts), len(tris)
usa16 = nv < 65536
with open(USCITA, "wb") as f:
    f.write(b"HP01")
    f.write(struct.pack("<II", nv, nt))
    for v in verts:
        f.write(struct.pack("<fff", v.x, v.y, v.z))
    for t in tris:
        f.write(struct.pack("<HHH" if usa16 else "<III", *t))
print("vertici", nv, "triangoli", nt, "dimensione", os.path.getsize(USCITA) // 1024, "KB")
