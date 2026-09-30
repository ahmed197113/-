"""Build the Metal Lines Co. product document on the company letterhead.

Page order:
  1. Element Pole (3 pages, Canva) - supplier branding, contact details and
     company names are removed; every product text, image and drawing is kept.
  2. Pole elevation drawing with dimensions (1 page) - placed as is.
  3. UNILinear Flex BGC401 LED strip datasheet (2 pages) - typeset on the letterhead
     with its text unchanged apart from the manufacturer's name.
  4. SHS 200x200x3 data sheet (2 pages) - content from build_datasheet.py.

Every page carries the company stamp (assets/company_stamp.png) and is flattened at
300 DPI with the letterhead (its faint centre logo is the
watermark) and the PDF is AES-256 encrypted, print-only.

Usage: python3 build_catalog.py <letterhead.pdf> <file1.pdf> <file2.pdf> <file3.pdf>
                                <out.pdf> <owner_password>
"""
import io
import re
import sys

import numpy as np
import pymupdf
from PIL import Image, ImageChops
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (Image as RLImage, PageBreak, Paragraph,
                                SimpleDocTemplate, Spacer)

from build_datasheet import (DPI, MARGIN_X, PAGE_H, PAGE_W, datasheet_story,
                             composite_page, data_table, section_heading, styles)

MARGIN_TOP = 122
MARGIN_BOTTOM = 70
BODY_W = PAGE_W - 2 * MARGIN_X
BODY_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM

NOTE_COLOUR = b"1 .9882 .9412 rg"

# Per page of file 1: title re-set on the letterhead, crop box (PDF points) holding the
# product content, and an optional area to blank (the source title inside the crop).
FILE1_PAGES = [
    {"title": "ELEMENT POLE", "crop": (22, 138, 572, 817)},
    {"title": "Light Characteristics", "crop": (22, 80, 572, 805), "cover": (0, 0, 400, 118)},
    {"title": "Drawing", "crop": (18, 104, 592, 810), "cover": (0, 0, 300, 125.5)},
]


def span_iter(page):
    for b in page.get_text("dict")["blocks"]:
        for line in b.get("lines", []):
            for s in line["spans"]:
                if s["text"].strip():
                    yield s


def hide_watermark_text(page):
    """Make the supplier's light-grey "MADOLIGHT" text invisible (render mode 3).

    The watermark overlaps dimensions and option values, so redacting it would clip
    real data. Watermark runs are interleaved with data runs inside the same text objects,
    so it is switched to render mode 3 and every other fill colour resets mode 0
    (the source sets no render modes of its own).
    """
    doc = page.parent

    def mode(m):
        rm = b"3" if m.group(1) == b".9608 .9608 .9608" else b"0"
        return m.group(0) + b" " + rm + b" Tr"

    for xref in [x[0] for x in page.get_xobjects()] + page.get_contents():
        stream = doc.xref_stream(xref)
        if stream and b".9608 .9608 .9608 rg" in stream:
            doc.update_stream(xref, re.sub(rb"(-?[\d.]+ -?[\d.]+ -?[\d.]+) rg\b", mode, stream))


def clean_file1_page(page, cfg):
    """Remove supplier branding and the page background, keep all product data.

    Supplier header (logo, slogan, overlapping title) and footer (address, phone,
    e-mail, website, company name) fall outside the crop box; the title is re-set on
    the letterhead. Nothing is redacted, because redaction also clips overlapping data.
    """
    hide_watermark_text(page)
    doc = page.parent
    for xref in [x[0] for x in page.get_xobjects()] + page.get_contents():
        stream = doc.xref_stream(xref)
        if stream and NOTE_COLOUR in stream:
            # "*ALL DIMENSIONS ARE IN MILLIMETERS" is cream-on-cream in the source
            doc.update_stream(xref, stream.replace(NOTE_COLOUR, b".3294 .3294 .3294 rg"))
    for info in page.get_image_info(xrefs=True):
        x0, y0, x1, y1 = info["bbox"]
        if (x1 - x0 > 580 and y1 - y0 > 800) or y1 < 95 or y0 > 805:
            page.delete_image(info["xref"])      # background, logos, header rule, icons
    if "cover" in cfg:
        page.draw_rect(pymupdf.Rect(cfg["cover"]), color=None, fill=(1, 1, 1), overlay=True)


def render_crop(page, crop):
    pm = page.get_pixmap(dpi=DPI, clip=pymupdf.Rect(crop), alpha=False)
    buf = io.BytesIO(pm.tobytes("png"))
    return buf, pm.width, pm.height


def fit_image(buf, px_w, px_h, max_w, max_h):
    scale = min(max_w / px_w, max_h / px_h)
    img = RLImage(buf, width=px_w * scale, height=px_h * scale)
    img.hAlign = "CENTER"
    return img


def file3_story(s):
    body = ParagraphStyle("b3", parent=s["body"])
    title = ParagraphStyle("t3", parent=s["title"], fontSize=18, leading=22)
    st = [
        Paragraph("UNILinear Flex LED Strip Light", title),
        Spacer(1, 6),
        Paragraph("<b>Model:</b> BGC401 400LM 10W 3000K L5 0612 S G", body),
        Spacer(1, 6),
        Paragraph(
            "The UNILinear Flex BGC401 is a professional-grade, highly durable "
            "waterproof and dustproof LED strip light. Designed specifically for outdoor "
            "architectural decoration, cove lighting, and path guidance, it utilizes advanced "
            "anti-UV polyurethane irrigation sealing glue technology to preserve pristine color "
            "consistency and safeguard components in heavy weather environments.", body),
        section_heading("Technical &amp; Performance Specifications", s),
        Spacer(1, 4),
        data_table(["Parameter", "Specification Value"], [
            ["Color Temperature (CCT)", "3000 K (Warm White, 930)"],
            ["Luminous Flux", "2,000 lm per 5-Meter Reel"],
            ["Power Consumption", "43 W total (approx. 10W/m matrix)"],
            ["Input Voltage", "24 V DC (Constant Voltage)"],
            ["Color Rendering Index (CRI)", "≥80 (High fidelity color rendering)"],
            ["Ingress Protection (IP Code)", "IP66 (Dust-tight, protected against powerful water jets)"],
            ["Mechanical Impact Protection", "IK04 (0.5 J standard protection)"],
            ["Dimensions", "6 mm Height × 12 mm Width × 5000 mm Length"],
            ["Housing &amp; Cover Material", "UV-resistant Silicon Rubber &amp; Stainless Steel fixations"],
            ["Operating Temperature Range", "-40 °C to +45 °C"],
            ["Dimmability", "Non-Dimmable (Constant Light Output configuration)"],
            ["Cut Ability", "Not cuttable (to preserve strict IP waterproofing integrity)"],
            ["Lifespan", "30,000 Hours (L70B50 @ 35 °C)"],
            ["Connection Mode", "Flying leads connection with 0.6 meter integrated cable"],
        ], [0.40, 0.60], s),
        section_heading("Key Benefits &amp; Application Guidelines", s),
        Spacer(1, 4),
    ]
    for k, v in [
        ("Advanced Weather Shielding:", "Sealed with anti-UV polyurethane without color-shifting "
                                        "or premature aging under heavy solar exposure."),
        ("Color Uniformity:", "Tight binning checks (SDCM ≤5) ensure seamless light "
                              "distribution along continuous lines without visible dark spots."),
        ("Safe Installation:", "Class III IEC safety class rating utilizes 24V low voltage loops. "
                               "<i>Warning: Do not cut this product; altering length breaches "
                               "irrigation seals and forfeits warranty coverage.</i>"),
    ]:
        st.append(Paragraph(f"<b>{k}</b> {v}", s["bullet"], bulletText="•"))
    return st


def build_content(buf, f1, f2):
    s = styles()
    title = ParagraphStyle("t", parent=s["title"], fontSize=19, leading=22)
    title_block_h = 44
    # Client files in order, then the SHS 200x200x3 data sheet at the end
    st = []

    # File 1: cleaned supplier pages
    for i, cfg in enumerate(FILE1_PAGES):
        page = f1[i]
        clean_file1_page(page, cfg)
        st.append(Paragraph(cfg['title'], title))
        st.append(Spacer(1, 8))
        buf_img, w, h = render_crop(page, cfg["crop"])
        st.append(fit_image(buf_img, w, h, BODY_W, BODY_H - title_block_h - 14))
        st.append(PageBreak())

    # File 2: elevation drawing, as is
    p2 = f2[0]
    buf_img, w, h = render_crop(p2, p2.rect)
    st.append(fit_image(buf_img, w, h, BODY_W, BODY_H - 30))
    st.append(PageBreak())

    # File 3: LED strip datasheet
    st.extend(file3_story(s))
    st.append(PageBreak())

    # Old file: SHS 200x200x3 data sheet
    st.extend(datasheet_story(s))

    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=MARGIN_X, rightMargin=MARGIN_X,
                            topMargin=MARGIN_TOP, bottomMargin=MARGIN_BOTTOM)

    def footer(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(colors.HexColor("#6B6B6B"))
        canvas.drawRightString(PAGE_W - MARGIN_X, MARGIN_BOTTOM - 16,
                               f"Page {doc_.page} of {{NP}}")
        canvas.restoreState()

    doc.build(st, onFirstPage=footer, onLaterPages=footer)


STAMP_PATH = "assets/company_stamp.png"     # 300 DPI scan, real size (~37 mm)
STAMP_ANGLES = [-7, 5, -3, 8, -5, 4, -9, 6]


FOOTER_BAND_TOP = 786                         # pt from top, where the letterhead footer starts


def place_stamp(page_img, ink_map, stamp, angle):
    """Multiply the company stamp onto the page, like ink, on empty space in the body
    area (nearest the bottom-right corner). Only the stamp's round ink area is tested,
    so it can sit close to text, images, drawings and the page number without covering
    them; if a page has no such space, the least covered spot is used."""
    st = stamp.rotate(angle, resample=Image.BICUBIC, expand=True, fillcolor="white")
    sw, sh = st.size
    W, H = page_img.size
    px = DPI / 72
    edge = int(16 * px)
    x_min, x_max = edge, W - edge - sw
    y_min, y_max = int(MARGIN_TOP * px), int(FOOTER_BAND_TOP * px) - sh

    step = 4                                   # test on a 1/4 grid for speed
    ink = np.asarray(ink_map.reduce(step)) > 12
    stamp_ink = np.asarray(st.convert("L").reduce(step)) < 235
    yy, xx = np.ogrid[:stamp_ink.shape[0], :stamp_ink.shape[1]]
    cy, cx = stamp_ink.shape[0] / 2, stamp_ink.shape[1] / 2
    r = min(cy, cx) - 1
    disc = (yy - cy) ** 2 + (xx - cx) ** 2 <= (r + 3) ** 2   # stamp circle + small gap
    h4, w4 = disc.shape

    best_empty, best_any = None, None
    for y in range(y_max, y_min, -20):
        for x in range(x_max, x_min, -20):
            win = ink[y // step:y // step + h4, x // step:x // step + w4]
            cov = int(np.count_nonzero(win & disc[:win.shape[0], :win.shape[1]]))
            dist = (x_max - x) + 1.4 * (y_max - y)
            if cov == 0 and (best_empty is None or dist < best_empty[0]):
                best_empty = (dist, x, y)
            if best_any is None or (cov, dist) < best_any[:2]:
                best_any = (cov, dist, x, y)
    x, y = (best_empty[1:] if best_empty else best_any[2:])
    region = page_img.crop((x, y, x + sw, y + sh))
    page_img.paste(ImageChops.multiply(region, st.convert("RGB")), (x, y))
    return page_img


def main():
    lh_path, f1_path, f2_path, f3_path, out_path, owner_pw = sys.argv[1:7]
    _ = f3_path  # file 3 is plain text/table content, typeset in file3_story()

    lh_pm = pymupdf.open(lh_path)[0].get_pixmap(dpi=DPI)
    letterhead = Image.frombytes("RGB", (lh_pm.width, lh_pm.height), lh_pm.samples)

    buf = io.BytesIO()
    build_content(buf, pymupdf.open(f1_path), pymupdf.open(f2_path))
    content = pymupdf.open("pdf", buf.getvalue())
    n = content.page_count

    stamp = Image.open(STAMP_PATH).convert("RGB")
    out = pymupdf.open()
    for page in content:
        for r in page.search_for("{NP}"):
            page.add_redact_annot(r)
            page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE)
            page.insert_text((r.x0, r.y1 - 1.6), str(n), fontname="helv", fontsize=7.5,
                             color=(0.42, 0.42, 0.42))
        pm = page.get_pixmap(dpi=DPI, alpha=True)
        img = composite_page(letterhead.resize((pm.width, pm.height)), pm.tobytes("png"))
        rgba = Image.open(io.BytesIO(pm.tobytes("png")))
        on_white = Image.new("RGBA", rgba.size, "white")
        on_white.alpha_composite(rgba)
        # anything visibly darker than paper counts as content (text, lines, photos)
        ink_map = on_white.convert("L").point(lambda v: 255 if v < 238 else 0)
        img = place_stamp(img, ink_map, stamp, STAMP_ANGLES[page.number % len(STAMP_ANGLES)])
        jpg = io.BytesIO()
        img.save(jpg, "JPEG", quality=93, subsampling=0, dpi=(DPI, DPI))
        p = out.new_page(width=PAGE_W, height=PAGE_H)
        p.insert_image(p.rect, stream=jpg.getvalue())

    out.set_metadata({"title": "Metal Lines Co. - Product Technical Documents",
                      "author": "Metal Lines Co. - شركة الخطوط المعدنية",
                      "creator": "Metal Lines Co.", "producer": "Metal Lines Co."})
    out.save(out_path, garbage=4, deflate=True, encryption=pymupdf.PDF_ENCRYPT_AES_256,
             owner_pw=owner_pw, user_pw="",
             permissions=pymupdf.PDF_PERM_PRINT | pymupdf.PDF_PERM_PRINT_HQ)
    print(f"pages={n}")


if __name__ == "__main__":
    main()
