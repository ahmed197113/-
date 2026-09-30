"""Convert the SeCTA EB723122 PDF (3 A4 pages) into a single AutoCAD DXF.

- Scale: 1:1 with the PDF page (drawing units = mm, A4 = 210 x 297).
- Model space: the 3 pages side by side; one paper-space layout per page.
- Vectors -> LWPOLYLINE / SPLINE / solid HATCH, true colours, original paint order.
- Text   -> editable TEXT (fit-aligned per line) with matching TrueType styles.
- Images -> IMAGE entities referencing the original extracted files in ./images.
- The faint "MADOLIGHT" watermark sits on its own layer (WATERMARK).
"""
import hashlib
import os
import sys

import ezdxf
import pymupdf
from ezdxf import colors
from ezdxf.enums import TextEntityAlignment

PT = 25.4 / 72.0          # PDF point -> mm
PAGE_GAP = 20.0           # mm between pages in model space
CAP = 0.72                # AutoCAD TTF text height ~ cap height of the em size

FONTS = {  # PDF font name -> (style name, ttf file)
    "ArialMT": ("ARIAL", "arial.ttf"),
    "Arial-BoldMT": ("ARIAL_BOLD", "arialbd.ttf"),
    "AgencyFB-Reg": ("AGENCY_FB", "AGENCYR.TTF"),
    "BankGothicBT-Medium": ("BANKGOTHIC", "bgothm.ttf"),
    "FootlightMTLight": ("FOOTLIGHT", "FTLTLT.TTF"),
    "LatinWide": ("LATINWIDE", "LATINWD.TTF"),
    "MicrosoftPhagsPa-Bold": ("PHAGSPA_BOLD", "phagspab.ttf"),
    "TechnicBold": ("TECHNIC_BOLD", "technb_.ttf"),
    "TechnicLite": ("TECHNIC_LITE", "techl___.ttf"),
    "Bahnschrift": ("BAHNSCHRIFT", "bahnschrift.ttf"),
    "Swiss721BT-Black": ("SWISS_BLACK", "swissk.ttf"),
    "Swiss721BT-BlackCondensed": ("SWISS_BLACK_COND", "swisskci.ttf"),
    "Tahoma-Bold": ("TAHOMA_BOLD", "tahomabd.ttf"),
}

LAYERS = {  # name: (ACI colour, description)
    "BACKGROUND": (254, "Page background colour"),
    "IMAGES": (7, "Photos, logos and raster artwork"),
    "LINES": (7, "Vector line work"),
    "FILLS": (8, "Solid filled areas"),
    "TEXT": (7, "Text"),
    "DIM-TEXT": (5, "Dimension values"),
    "SPEC-TEXT": (1, "Selected specification values"),
    "WATERMARK": (9, "MADOLIGHT watermark"),
}


def rgb(c):
    return tuple(max(0, min(255, round(v * 255))) for v in c[:3])


class Converter:
    def __init__(self, pdf_path, out_dir):
        self.pdf = pymupdf.open(pdf_path)
        self.out_dir = out_dir
        self.img_dir = os.path.join(out_dir, "images")
        os.makedirs(self.img_dir, exist_ok=True)
        self.doc = ezdxf.new("R2018", setup=True, units=ezdxf.units.MM)
        self.doc.header["$LWDISPLAY"] = 1
        self.doc.header["$MEASUREMENT"] = 1
        self.msp = self.doc.modelspace()
        for name, (aci, desc) in LAYERS.items():
            layer = self.doc.layers.add(name, color=aci)
            layer.description = desc
        for style, ttf in FONTS.values():
            self.doc.styles.add(style, font=ttf)
        self.image_defs = {}
        self.stats = {"lines": 0, "splines": 0, "hatches": 0, "texts": 0, "images": 0}

    # ---------- coordinates ----------
    def xy(self, x, y):
        return (self.ox + x * PT, (self.page_h - y) * PT)

    # ---------- images ----------
    def image_file(self, xref):
        pdf = self.pdf
        info = pdf.extract_image(xref)
        if info["smask"]:
            pix = pymupdf.Pixmap(pdf, xref)
            if pix.n - pix.alpha > 3:
                pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
            pix = pymupdf.Pixmap(pix, pymupdf.Pixmap(pdf, info["smask"]))
            data, ext = pix.tobytes("png"), "png"
        elif info["ext"] in ("jpeg", "jpg") and info["colorspace"] == 3:
            data, ext = info["image"], "jpg"      # original bytes, no re-encoding
        else:
            pix = pymupdf.Pixmap(pdf, xref)
            if pix.n - pix.alpha > 3:
                pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
            data, ext = pix.tobytes("jpg", jpg_quality=95), "jpg"
        digest = hashlib.sha1(data).hexdigest()[:10]
        if digest not in self.image_defs:
            name = f"img_{len(self.image_defs) + 1:02d}_{digest}.{ext}"
            with open(os.path.join(self.img_dir, name), "wb") as fh:
                fh.write(data)
            pix = pymupdf.Pixmap(data)
            self.image_defs[digest] = self.doc.add_image_def(
                filename=f"images/{name}", size_in_pixel=(pix.width, pix.height))
        return self.image_defs[digest]

    def add_image(self, info):
        x0, y0, x1, y1 = info["bbox"]
        image_def = self.image_file(info["xref"])
        img = self.msp.add_image(image_def, insert=self.xy(x0, y1),
                                 size_in_units=((x1 - x0) * PT, (y1 - y0) * PT),
                                 dxfattribs={"layer": "IMAGES"})
        img.dxf.flags = img.dxf.flags | ezdxf.entities.Image.USE_TRANSPARENCY
        self.stats["images"] += 1

    # ---------- vectors ----------
    def subpaths(self, path):
        """Split a PyMuPDF path into sub-paths: lists of ('l'|'c', points)."""
        subs, cur, last = [], [], None
        for it in path["items"]:
            kind = it[0]
            if kind == "re":
                r = it[1]
                pts = [r.tl, r.tr, r.br, r.bl, r.tl]
                subs.append([("l", [a, b]) for a, b in zip(pts, pts[1:])])
                cur, last = [], None
                continue
            if kind == "qu":
                q = it[1]
                pts = [q.ul, q.ur, q.lr, q.ll, q.ul]
                subs.append([("l", [a, b]) for a, b in zip(pts, pts[1:])])
                cur, last = [], None
                continue
            p0 = it[1]
            if last is None or abs(p0.x - last.x) > 1e-3 or abs(p0.y - last.y) > 1e-3:
                if cur:
                    subs.append(cur)
                cur = []
            if kind == "l":
                cur.append(("l", [it[1], it[2]]))
                last = it[2]
            elif kind == "c":
                cur.append(("c", [it[1], it[2], it[3], it[4]]))
                last = it[4]
        if cur:
            subs.append(cur)
        if path.get("closePath"):
            for sub in subs:
                first, end = sub[0][1][0], sub[-1][1][-1]
                if abs(first.x - end.x) > 1e-3 or abs(first.y - end.y) > 1e-3:
                    sub.append(("l", [end, first]))
        return subs

    def flatten(self, sub, steps=16):
        pts = [sub[0][1][0]]
        for kind, p in sub:
            if kind == "l":
                pts.append(p[1])
            else:
                a, b, c, d = p
                for i in range(1, steps + 1):
                    t = i / steps
                    mt = 1 - t
                    pts.append(pymupdf.Point(
                        mt**3 * a.x + 3 * mt * mt * t * b.x + 3 * mt * t * t * c.x + t**3 * d.x,
                        mt**3 * a.y + 3 * mt * mt * t * b.y + 3 * mt * t * t * c.y + t**3 * d.y))
        return [self.xy(p.x, p.y) for p in pts]

    def stroke(self, sub, attribs):
        run = []

        def flush():
            if len(run) >= 2:
                closed = len(run) > 3 and run[0] == run[-1]
                pts = run[:-1] if closed else run
                self.msp.add_lwpolyline(pts, close=closed, dxfattribs=attribs)
                self.stats["lines"] += 1

        for kind, p in sub:
            if kind == "l":
                a, b = self.xy(p[0].x, p[0].y), self.xy(p[1].x, p[1].y)
                if not run:
                    run.append(a)
                run.append(b)
            else:
                flush()
                run = []
                ctrl = [self.xy(q.x, q.y) for q in p]
                self.msp.add_open_spline(ctrl, degree=3, dxfattribs=attribs)
                self.stats["splines"] += 1
        flush()

    def add_path(self, path, layer):
        subs = self.subpaths(path)
        if not subs:
            return
        if path.get("fill") is not None:
            hatch = self.msp.add_hatch(dxfattribs={"layer": "FILLS" if layer == "LINES" else layer})
            hatch.rgb = rgb(path["fill"])
            op = path.get("fill_opacity")
            if op is not None and op < 1:
                hatch.transparency = 1 - op
            for sub in subs:
                pts = self.flatten(sub)
                if len(pts) >= 3:
                    hatch.paths.add_polyline_path(pts, is_closed=True)
            self.stats["hatches"] += 1
        if path.get("color") is not None and path["type"] in ("s", "fs"):
            attribs = {"layer": layer, "true_color": colors.rgb2int(rgb(path["color"]))}
            width = (path.get("width") or 0) * PT
            if width > 0.05:
                attribs["lineweight"] = self.lineweight(width)
            for sub in subs:
                self.stroke(sub, attribs)

    @staticmethod
    def lineweight(mm):
        valid = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90,
                 100, 106, 120, 140, 158, 200, 211]
        return min(valid, key=lambda v: abs(v - mm * 100))

    # ---------- text ----------
    def text_lines(self, span):
        """Split a text-trace span into visual runs (same baseline, no big gaps)."""
        size = span["size"]
        runs, cur = [], []
        for ch in span["chars"]:
            uni, _, origin, bbox = ch
            if cur:
                prev = cur[-1]
                gap = origin[0] - prev[3][2]
                if abs(origin[1] - prev[2][1]) > 0.3 or gap > 1.5 * size or gap < -0.5 * size:
                    runs.append(cur)
                    cur = []
            cur.append(ch)
        if cur:
            runs.append(cur)
        out = []
        for run in runs:
            while run and chr(run[0][0]) == " ":
                run = run[1:]
            while run and chr(run[-1][0]) == " ":
                run = run[:-1]
            if run:
                out.append(run)
        return out

    @staticmethod
    def run_string(run, size):
        """Characters of a run, restoring word gaps that the PDF made by positioning."""
        out = [chr(run[0][0])]
        for prev, ch in zip(run, run[1:]):
            gap = ch[2][0] - prev[3][2]
            if gap > 0.2 * size and chr(ch[0]) != " " and out[-1] != " ":
                out.append(" ")
            out.append(chr(ch[0]))
        return "".join(out).replace("%%", "%%%")

    def add_text(self, span):
        color = rgb(span["color"])
        font = span["font"]
        style = FONTS.get(font, ("ARIAL", None))[0]
        text_layer = "TEXT"
        if "MADOLIGHT" in "".join(chr(c[0]) for c in span["chars"]) and min(color) >= 235:
            text_layer = "WATERMARK"
        elif color == (0, 0, 255):
            text_layer = "DIM-TEXT"
        elif color == (255, 0, 0):
            text_layer = "SPEC-TEXT"
        height = span["size"] * CAP * PT
        for run in self.text_lines(span):
            s = self.run_string(run, span["size"])
            start = self.xy(*run[0][2])
            end = self.xy(run[-1][3][2], run[-1][2][1])
            attribs = {"layer": text_layer, "style": style, "height": height,
                       "true_color": colors.rgb2int(color)}
            txt = self.msp.add_text(s, dxfattribs=attribs)
            if len(run) > 1 and end[0] - start[0] > height * 0.2:
                txt.set_placement(start, end, align=TextEntityAlignment.FIT)
            else:
                txt.set_placement(start)
            self.stats["texts"] += 1

    # ---------- page ----------
    def convert_page(self, index):
        page = self.pdf[index]
        self.page_no = index + 1
        self.page_w, self.page_h = page.rect.width, page.rect.height
        self.ox = index * (self.page_w * PT + PAGE_GAP)
        items = []

        # images: seqno = position of the matching 'fill-image' entry in the bbox log
        log = page.get_bboxlog()
        img_seq = [i for i, (kind, _) in enumerate(log) if kind == "fill-image"]
        infos = page.get_image_info(xrefs=True)
        used = set()
        for info in infos:
            best = None
            for i in img_seq:
                if i in used:
                    continue
                r = log[i][1]
                if all(abs(a - b) < 1.0 for a, b in zip(r, info["bbox"])):
                    best = i
                    break
            if best is None:
                best = 0
            used.add(best)
            items.append((best, "img", info))

        for d in page.get_drawings():
            items.append((d["seqno"], "path", d))
        for t in page.get_texttrace():
            if t["type"] != 3 and t["opacity"] > 0:
                items.append((t["seqno"], "text", t))
        items.sort(key=lambda it: it[0])
        items = self.merge_text(items)

        for seq, kind, obj in items:
            if kind == "img":
                x0, y0, x1, y1 = obj["bbox"]
                full_page = (x1 - x0) > page.rect.width * 0.95 and (y1 - y0) > page.rect.height * 0.95
                if full_page:          # plain cream page background -> solid fill
                    self.add_background(obj)
                else:
                    self.add_image(obj)
            elif kind == "path":
                self.add_path(obj, "LINES")
            else:
                self.add_text(obj)

    @staticmethod
    def merge_text(items):
        """Join consecutive same-style text spans on one baseline (e.g. justified words)."""
        out = []
        for item in items:
            if item[1] == "text" and out and out[-1][1] == "text":
                prev, cur = out[-1][2], item[2]
                same = (prev["font"] == cur["font"] and abs(prev["size"] - cur["size"]) < 0.01
                        and prev["color"] == cur["color"] and prev["chars"] and cur["chars"])
                if same:
                    last, first = prev["chars"][-1], cur["chars"][0]
                    gap = first[2][0] - last[3][2]
                    if abs(first[2][1] - last[2][1]) < 0.3 and -0.5 * cur["size"] < gap < 1.5 * cur["size"]:
                        merged = dict(prev)
                        merged["chars"] = tuple(prev["chars"]) + tuple(cur["chars"])
                        out[-1] = (out[-1][0], "text", merged)
                        continue
            out.append(item)
        return out

    def add_background(self, info):
        pix = pymupdf.Pixmap(self.pdf, info["xref"])
        if pix.n - pix.alpha > 3:
            pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
        colour = pix.pixel(pix.width // 2, pix.height // 2)[:3]
        x0, y0, x1, y1 = info["bbox"]
        hatch = self.msp.add_hatch(dxfattribs={"layer": "BACKGROUND"})
        hatch.rgb = tuple(colour)
        hatch.paths.add_polyline_path(
            [self.xy(x0, y0), self.xy(x1, y0), self.xy(x1, y1), self.xy(x0, y1)], is_closed=True)

    def add_layout(self, index, title):
        w, h = self.page_w * PT, self.page_h * PT
        ox = index * (w + PAGE_GAP)
        name = f"{index + 1:02d} - {title}"
        layout = self.doc.layouts.new(name)
        layout.page_setup(size=(round(w, 3), round(h, 3)), margins=(0, 0, 0, 0), units="mm",
                          device="DWG To PDF.pc3", name="ISO_full_bleed_A4_(210.00_x_297.00_MM)")
        vp = layout.add_viewport(center=(w / 2, h / 2), size=(w, h),
                                 view_center_point=(ox + w / 2, h / 2), view_height=h)
        vp.dxf.layer = "Defpoints" if "Defpoints" in self.doc.layers else "0"

    def run(self, out_name):
        titles = ["Element Pole", "Light Characteristics", "Drawing"]
        for i in range(self.pdf.page_count):
            self.convert_page(i)
        for i in range(self.pdf.page_count):
            self.add_layout(i, titles[i] if i < len(titles) else f"Page {i + 1}")
        self.doc.layouts.delete("Layout1")
        self.doc.set_modelspace_vport(height=self.page_h * PT * 1.1,
                                      center=(1.5 * self.page_w * PT + PAGE_GAP, self.page_h * PT / 2))
        path = os.path.join(self.out_dir, out_name)
        self.doc.saveas(path)
        print(path, self.stats, "images:", len(self.image_defs))
        return path


if __name__ == "__main__":
    pdf_path, out_dir = sys.argv[1], sys.argv[2]
    Converter(pdf_path, out_dir).run("EB723122.dxf")
