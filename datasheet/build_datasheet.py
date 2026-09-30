"""Build the Metal Lines Co. SHS 200x200x3 data sheet on the company letterhead.

Pipeline:
  1. Typeset the data-sheet content on A4 inside the letterhead's safe area (reportlab).
  2. For every page, composite at 300 DPI: letterhead + content + diagonal
     company-name watermark (taken from the letterhead's own logotype).
  3. Write each composite as a single flattened image page and encrypt the PDF
     (AES-256, print-only) so the letterhead/watermark cannot be separated.

Usage: python3 build_datasheet.py <letterhead.pdf> <out.pdf> [owner_password]
"""
import io
import secrets
import sys

import pymupdf
from PIL import Image, ImageChops, ImageOps
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (KeepTogether, PageBreak, Paragraph,
                                SimpleDocTemplate, Spacer, Table, TableStyle)

DPI = 300
PAGE_W, PAGE_H = A4

# Brand colours sampled from the letterhead
NAVY = colors.HexColor("#1E1B4B")
COPPER = colors.HexColor("#B4683E")
SAND = colors.HexColor("#F6EEE8")
GRID = colors.HexColor("#D9C9BD")
TEXT = colors.HexColor("#222222")

# Safe area: letterhead header ends ~105pt from top, footer band starts ~790pt
MARGIN_X = 48
MARGIN_TOP = 128
MARGIN_BOTTOM = 84


def styles():
    base = dict(fontName="Helvetica", textColor=TEXT, leading=13, fontSize=9.5)
    return {
        "kicker": ParagraphStyle("kicker", **{**base, "fontName": "Helvetica-Bold",
                                              "textColor": COPPER, "fontSize": 9}),
        "title": ParagraphStyle("title", **{**base, "fontName": "Helvetica-Bold",
                                            "textColor": NAVY, "fontSize": 20, "leading": 24}),
        "body": ParagraphStyle("body", **{**base, "alignment": TA_LEFT}),
        "h2": ParagraphStyle("h2", **{**base, "fontName": "Helvetica-Bold",
                                      "textColor": NAVY, "fontSize": 12.5, "leading": 16,
                                      "spaceBefore": 12, "spaceAfter": 6}),
        "cell": ParagraphStyle("cell", **{**base, "fontSize": 8.8, "leading": 11}),
        "cellb": ParagraphStyle("cellb", **{**base, "fontName": "Helvetica-Bold",
                                            "fontSize": 8.8, "leading": 11}),
        "th": ParagraphStyle("th", **{**base, "fontName": "Helvetica-Bold",
                                      "textColor": colors.white, "fontSize": 8.8, "leading": 11}),
        "bullet": ParagraphStyle("bullet", **{**base, "leftIndent": 12, "bulletIndent": 2,
                                              "spaceAfter": 3}),
    }


def section_heading(text, s):
    """Heading with a copper rule underneath, matching the letterhead line."""
    t = Table([[Paragraph(text, s["h2"])]], colWidths=[PAGE_W - 2 * MARGIN_X])
    t.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 1.2, COPPER),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def data_table(header, rows, widths, s):
    body_w = PAGE_W - 2 * MARGIN_X
    col_w = [body_w * w for w in widths]
    data = [[Paragraph(h, s["th"]) for h in header]]
    for r in rows:
        data.append([Paragraph(r[0], s["cellb"])] + [Paragraph(c, s["cell"]) for c in r[1:]])
    t = Table(data, colWidths=col_w, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("LINEBELOW", (0, 0), (-1, 0), 2, COPPER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, GRID),
        ("BOX", (0, 0), (-1, -1), 0.6, GRID),
    ]
    for i in range(2, len(data), 2):
        style.append(("BACKGROUND", (0, i), (-1, i), SAND))
    t.setStyle(TableStyle(style))
    return t


def build_content(buf):
    s = styles()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=MARGIN_X, rightMargin=MARGIN_X,
                            topMargin=MARGIN_TOP, bottomMargin=MARGIN_BOTTOM,
                            title="Technical Data Sheet - SHS 200x200x3",
                            author="Metal Lines Co.")
    st = []
    st.append(Paragraph("TECHNICAL DATA SHEET", s["kicker"]))
    st.append(Spacer(1, 3))
    st.append(Paragraph("Square Hollow Section (SHS) &mdash; 200 &times; 200 &times; 3 mm", s["title"]))
    st.append(Spacer(1, 8))
    st.append(Paragraph(
        "<b>Description:</b> Cold-formed or hot-finished structural steel square tube with a "
        "nominal profile of 200 mm by 200 mm and a uniform 3 mm wall thickness. Widely utilized "
        "in structural frameworks, machine construction, civil engineering, and general "
        "architecture due to its symmetrical strength distribution.", s["body"]))

    st.append(section_heading("1. Dimensional &amp; Geometric Properties", s))
    st.append(Spacer(1, 4))
    st.append(data_table(
        ["Property", "Metric Value", "Imperial Unit Equivalent"],
        [
            ["Outer Width &times; Height", "200 mm &times; 200 mm", "7.874 in &times; 7.874 in"],
            ["Wall Thickness (t)", "3.0 mm", "0.118 in (approx. 11 Gauge)"],
            ["Nominal Mass per Meter", "~18.3 kg/m", "~12.3 lbs/ft"],
            ["Cross-Sectional Area (A)", "23.3 cm<super>2</super>", "3.61 in<super>2</super>"],
            ["Moment of Inertia (I<sub>x</sub> / I<sub>y</sub>)", "1480 cm<super>4</super>",
             "35.56 in<super>4</super>"],
            ["Section Modulus (W<sub>el</sub>)", "148 cm<super>3</super>", "9.03 in<super>3</super>"],
            ["Radius of Gyration (i)", "7.96 cm", "3.13 in"],
        ], [0.40, 0.28, 0.32], s))

    st.append(section_heading("2. Manufacturing Standards &amp; Material Grades", s))
    st.append(Spacer(1, 2))
    st.append(Paragraph("This profile is generally manufactured in compliance with one or more of "
                        "the following international regulatory frameworks:", s["body"]))
    st.append(Spacer(1, 5))
    st.append(data_table(
        ["Standard", "Common Available Grades", "Application Environment"],
        [
            ["EN 10210 / EN 10219", "S235JRH, S275J0H, S355J2H",
             "European structural applications, high load profiles"],
            ["ASTM A500", "Grade A, Grade B, Grade C",
             "North American structural framing, welded, bolted frames"],
            ["AS/NZS 1163", "C250L0, C350L0", "Australian/Oceania structural/mechanical load tasks"],
            ["JIS G3466", "STKR400, STKR490", "Japanese engineering and civil structures"],
        ], [0.24, 0.30, 0.46], s))

    st.append(PageBreak())
    st.append(KeepTogether([
        section_heading("3. Mechanical &amp; Chemical Characteristics (Typical)", s),
        Spacer(1, 2),
        Paragraph("Values below reflect common high-strength variations "
                  "(e.g., S355J2H or ASTM A500 Grade C):", s["body"]),
        Spacer(1, 5),
        data_table(
            ["Property Description", "Typical Limit (Metric)", "Typical Limit (Imperial)"],
            [
                ["Minimum Yield Strength (R<sub>e</sub>)", "355 MPa", "51,500 psi"],
                ["Ultimate Tensile Strength (R<sub>m</sub>)", "470 &ndash; 630 MPa",
                 "68,000 &ndash; 91,300 psi"],
                ["Minimum Elongation (A<sub>5</sub>)", "20%", "20%"],
                ["Carbon Equivalent Value (CEV max)", "0.45%", "0.45%"],
            ], [0.44, 0.28, 0.28], s),
    ]))

    bullets = [
        ("Outside Dimensions:", "&plusmn;1% with a minimum deviation threshold of &plusmn;0.5 mm."),
        ("Wall Thickness (t):", "&plusmn;10% variation limit depending on cold-formed/hot-finished specifics."),
        ("Squareness of Side:", "90&deg; &plusmn; 1&deg; configuration limit."),
        ("Straightness Deviation:", "Max 0.15% of the total cumulative length of the profile."),
        ("Surface Supply Options:", "Black bare finish, light protective anti-rust oiling, "
                                    "Hot-Dip Galvanized (HDG), or mill varnished priming."),
    ]
    st.append(KeepTogether(
        [section_heading("4. Standard Tolerances &amp; Surface Options", s), Spacer(1, 4)]
        + [Paragraph(f"<b>{k}</b> {v}", s["bullet"], bulletText="•") for k, v in bullets]
    ))

    st.append(section_heading("5. Notes", s))
    st.append(Spacer(1, 4))
    for note in [
        "All values are nominal and given for guidance; actual properties depend on the "
        "applicable standard, grade and mill certificate supplied with each delivery.",
        "Specifications are subject to change without prior notice.",
    ]:
        st.append(Paragraph(note, s["bullet"], bulletText="•"))

    st.append(Spacer(1, 28))
    body_w = PAGE_W - 2 * MARGIN_X
    lbl = ParagraphStyle("lbl", parent=s["cellb"], textColor=NAVY)
    sign = Table(
        [[Paragraph("Prepared by", lbl), Paragraph("Approved by", lbl),
          Paragraph("Company Stamp", lbl)],
         ["", "", ""],
         [Paragraph("Name / Date", s["cell"]), Paragraph("Name / Date", s["cell"]), ""]],
        colWidths=[body_w / 3] * 3, rowHeights=[20, 62, 18])
    sign.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, GRID),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, GRID),
        ("BACKGROUND", (0, 0), (-1, 0), SAND),
        ("LINEBELOW", (0, 0), (-1, 0), 1.2, COPPER),
        ("SPAN", (2, 1), (2, 2)),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ]))
    st.append(sign)

    def footer(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(colors.HexColor("#6B6B6B"))
        y = MARGIN_BOTTOM - 22
        canvas.setStrokeColor(GRID)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN_X, y + 10, PAGE_W - MARGIN_X, y + 10)
        canvas.drawString(MARGIN_X, y, "TECHNICAL DATA SHEET — SHS 200 × 200 × 3 mm  |  "
                                       "CONFIDENTIAL & PROPRIETARY")
        canvas.drawRightString(PAGE_W - MARGIN_X, y, f"Page {doc_.page} of {{NP}}")
        canvas.restoreState()

    doc.build(st, onFirstPage=footer, onLaterPages=footer)


def watermark_tile(letterhead_img):
    """Company logotype cut from the letterhead, recoloured as a faint stamp."""
    s = DPI / 110
    crop = letterhead_img.crop((int(530 * s), int(28 * s), int(868 * s), int(118 * s)))
    gray = ImageOps.grayscale(crop)
    # Ink mask: dark pixels -> opaque
    mask = ImageOps.invert(gray).point(lambda v: 0 if v < 40 else min(255, int(v * 1.2)))
    return mask


def composite_page(letterhead, content_png, mask):
    page = letterhead.copy().convert("RGBA")
    content = Image.open(io.BytesIO(content_png)).convert("RGBA")
    page.alpha_composite(content)

    # Diagonal tiled watermark on top of everything
    W, H = page.size
    layer = Image.new("L", (W * 2, H * 2), 0)
    tw, th = mask.size
    scale = 0.62
    m = mask.resize((int(tw * scale), int(th * scale)), Image.LANCZOS)
    tw, th = m.size
    gap_x, gap_y = int(tw * 0.35), int(th * 1.9)
    for row, y in enumerate(range(0, H * 2, th + gap_y)):
        off = (row % 2) * (tw + gap_x) // 2
        for x in range(-tw + off, W * 2, tw + gap_x):
            layer.paste(m, (x, y), m)
    layer = layer.rotate(35, resample=Image.BICUBIC)
    layer = layer.crop((W // 2, H // 2, W // 2 + W, H // 2 + H))
    alpha = layer.point(lambda v: int(v * 0.12))
    # Keep the watermark within the body so the letterhead header/footer stay crisp
    body = Image.new("L", (W, H), 0)
    body.paste(255, (0, int(H * 0.132), W, int(H * 0.935)))
    alpha = ImageChops.multiply(alpha, body)
    tint = Image.new("RGBA", (W, H), (30, 27, 75, 0))
    tint.putalpha(alpha)
    page.alpha_composite(tint)
    return page.convert("RGB")


def main():
    lh_path, out_path = sys.argv[1], sys.argv[2]
    owner_pw = sys.argv[3] if len(sys.argv) > 3 else secrets.token_urlsafe(12)

    lh_doc = pymupdf.open(lh_path)
    lh_pm = lh_doc[0].get_pixmap(dpi=DPI)
    letterhead = Image.frombytes("RGB", (lh_pm.width, lh_pm.height), lh_pm.samples)
    mask = watermark_tile(letterhead)

    buf = io.BytesIO()
    build_content(buf)
    content_doc = pymupdf.open("pdf", buf.getvalue())
    n = content_doc.page_count

    out = pymupdf.open()
    for page in content_doc:
        # Replace the page-count placeholder
        for r in page.search_for("{NP}"):
            page.add_redact_annot(r)
            page.apply_redactions()
            page.insert_text((r.x0, r.y1 - 1.6), str(n), fontname="helv", fontsize=7.5,
                             color=(0.42, 0.42, 0.42))
        pm = page.get_pixmap(dpi=DPI, alpha=True)
        img = composite_page(letterhead.resize((pm.width, pm.height)), pm.tobytes("png"), mask)
        jpg = io.BytesIO()
        img.save(jpg, "JPEG", quality=93, subsampling=0, dpi=(DPI, DPI))
        p = out.new_page(width=PAGE_W, height=PAGE_H)
        p.insert_image(p.rect, stream=jpg.getvalue())

    out.set_metadata({"title": "Technical Data Sheet - SHS 200x200x3 mm",
                      "author": "Metal Lines Co. - شركة الخطوط المعدنية",
                      "subject": "Square Hollow Section 200x200x3", "creator": "Metal Lines Co.",
                      "producer": "Metal Lines Co."})
    perm = pymupdf.PDF_PERM_PRINT | pymupdf.PDF_PERM_PRINT_HQ
    out.save(out_path, garbage=4, deflate=True, encryption=pymupdf.PDF_ENCRYPT_AES_256,
             owner_pw=owner_pw, user_pw="", permissions=perm)
    print(f"pages={n} owner_password={owner_pw}")


if __name__ == "__main__":
    main()
