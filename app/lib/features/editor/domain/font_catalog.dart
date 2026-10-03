/// Bundled OFL Arabic fonts (see assets/fonts/OFL.txt and docs/FONTS.md).
class ArabicFont {
  const ArabicFont(this.family, this.nameAr, this.nameEn, {this.calligraphic = false});
  final String family;
  final String nameAr;
  final String nameEn;
  final bool calligraphic;
}

const kArabicFonts = [
  ArabicFont('ArefRuqaa', 'رقعة عارف', 'Aref Ruqaa', calligraphic: true),
  ArabicFont('Amiri', 'أميري', 'Amiri', calligraphic: true),
  ArabicFont('ReemKufi', 'ريم كوفي', 'Reem Kufi', calligraphic: true),
  ArabicFont('ElMessiri', 'المسيري', 'El Messiri', calligraphic: true),
  ArabicFont('Lalezar', 'لاله‌زار', 'Lalezar', calligraphic: true),
  ArabicFont('Marhey', 'مرحي', 'Marhey', calligraphic: true),
  ArabicFont('NotoKufiArabic', 'نوتو كوفي', 'Noto Kufi Arabic'),
  ArabicFont('NotoNaskhArabic', 'نوتو نسخ', 'Noto Naskh Arabic'),
  ArabicFont('Cairo', 'القاهرة', 'Cairo'),
  ArabicFont('Tajawal', 'تجوال', 'Tajawal'),
];

ArabicFont fontByFamily(String family) =>
    kArabicFonts.firstWhere((f) => f.family == family, orElse: () => kArabicFonts.first);
