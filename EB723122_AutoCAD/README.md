# SeCTA EB723122 — AutoCAD

- `EB723122.dxf` — AutoCAD 2018 DXF, units = mm, 1:1 with the A4 PDF page.
- `images/` — photos and logos from the PDF (original quality). Keep this folder next to the DXF.
- `pdf_to_dxf.py` — the conversion script (`python3 pdf_to_dxf.py <pdf> <out_dir>`; needs `pymupdf ezdxf`).

## Save as DWG
Open `EB723122.dxf` in AutoCAD → `SAVEAS` → choose *AutoCAD 2018 Drawing (*.dwg)* in the same folder.

## Contents
- Model space: the 3 pages side by side. Layouts: `01 - Element Pole`, `02 - Light Characteristics`, `03 - Drawing` (A4 portrait, 1:1).
- Layers: BACKGROUND, IMAGES, LINES, FILLS, TEXT, DIM-TEXT, SPEC-TEXT, WATERMARK (turn off to hide "MADOLIGHT").
- Fonts: Arial, Agency FB, Bank Gothic, Footlight MT Light, Technic, Swiss 721, Tahoma, Bahnschrift, Latin Wide, Phags-pa. Install any that are missing for the text to match the PDF exactly.
