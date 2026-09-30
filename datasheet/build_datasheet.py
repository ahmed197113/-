"""Build the Metal Lines Co. SHS 200x200x3 data sheet on the company letterhead.

Pipeline:
  1. Typeset the data-sheet content on A4 inside the letterhead's safe area (reportlab).
  2. For every page, composite at 300 DPI: letterhead (with its faint centre
     logo acting as the watermark) multiplied over the content.
  3. Write each composite as a single flattened image page and encrypt the PDF
     (AES-256, print-only) so the letterhead/watermark cannot be separated.

Usage: python3 build_datasheet.py <letterhead.pdf> <out.pdf> [owner_password]
"""
import io
import secrets
import sys

import pymupdf
from PIL import Image, ImageChops
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
    st.append(Paragraph("Square Hollow Section (SHS) &mdash; 200 mm &times; 200 mm &times; 3 mm", s["title"]))
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
            ["Cross-Sectional Area (A)", "23.3 cm\u00b2", "3.61 in\u00b2"],
            ["Moment of Inertia (I_x / I_y)", "1480 cm<super rise='2.6' size='6.2'>4</super>",
             "35.56 in<super rise='2.6' size='6.2'>4</super>"],
            ["Section Modulus (W_el)", "148 cm\u00b3", "9.03 in\u00b3"],
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
        Paragraph("Values mapped below reflect common high-strength variations "
                  "(e.g., S355J2H or ASTM A500 Grade C):", s["body"]),
        Spacer(1, 5),
        data_table(
            ["Property Description", "Typical Limit (Metric)", "Typical Limit (Imperial)"],
            [
                ["Minimum Yield Strength (R_e)", "355 MPa", "51,500 psi"],
                ["Ultimate Tensile Strength (R_m)", "470 &ndash; 630 MPa",
                 "68,000 &ndash; 91,300 psi"],
                ["Minimum Elongation (A_5)", "20%", "20%"],
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
        [section_heading("4. Standard Tolerances &amp; Surface Customization Options", s), Spacer(1, 4)]
        + [Paragraph(f"<b>{k}</b> {v}", s["bullet"], bulletText="•") for k, v in bullets]
    ))


    def footer(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(colors.HexColor("#6B6B6B"))
        y = MARGIN_BOTTOM - 22
        canvas.setStrokeColor(GRID)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN_X, y + 10, PAGE_W - MARGIN_X, y + 10)
        canvas.drawString(MARGIN_X, y, "CONFIDENTIAL & PROPRIETARY | STANDARD SPECIFICATION DATA")
        canvas.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 114, "TECHNICAL DATA SHEET \u2014 SQUARE HOLLOW SECTION")
        canvas.drawRightString(PAGE_W - MARGIN_X, y, f"Page {doc_.page} of {{NP}}")
        canvas.restoreState()

    doc.build(st, onFirstPage=footer, onLaterPages=footer)


def composite_page(letterhead, content_png):
    """Multiply the letterhead over the content so its faint centre logo shows
    through table fills as a quiet watermark, and is baked into the page image."""
    content = Image.open(io.BytesIO(content_png)).convert("RGBA")
    sheet = Image.new("RGBA", content.size, "white")
    sheet.alpha_composite(content)
    return ImageChops.multiply(letterhead.convert("RGB"), sheet.convert("RGB"))


def main():
    lh_path, out_path = sys.argv[1], sys.argv[2]
    owner_pw = sys.argv[3] if len(sys.argv) > 3 else secrets.token_urlsafe(12)

    lh_doc = pymupdf.open(lh_path)
    lh_pm = lh_doc[0].get_pixmap(dpi=DPI)
    letterhead = Image.frombytes("RGB", (lh_pm.width, lh_pm.height), lh_pm.samples)

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
        img = composite_page(letterhead.resize((pm.width, pm.height)), pm.tobytes("png"))
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
