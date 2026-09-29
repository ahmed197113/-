# -*- coding: utf-8 -*-
"""
مولّد vbaProject.bin (مشروع ماكرو VBA) من ملفات نصية — بدون الحاجة إلى Excel.

يتبع المواصفات الرسمية:
  - [MS-OVBA] ضغط الكود + سجلات dir + تدفّق PROJECT + تشفير CMG/DPB/GC
  - [MS-CFB]  ملف الحاوية المركبة (Compound File v3, قطاعات 512 بايت)

المشروع يُكتب "مصدراً فقط" (_VBA_PROJECT Version = 0xFFFF كما تشترط المواصفة)،
فيقوم Excel بترجمة الكود تلقائياً عند أول فتح.
"""
import os
import struct
import uuid

# ============================================================ MS-OVBA 2.4.1 الضغط


def _copy_token_help(cur, start):
    diff = cur - start
    bit_count = max((diff - 1).bit_length(), 4)
    length_mask = 0xFFFF >> bit_count
    max_len = length_mask + 3
    return bit_count, max_len


def _compress_chunk(data):
    out = bytearray()
    pos, end = 0, len(data)
    index = {}  # بادئة 3 بايت → مواضعها السابقة (لتسريع البحث عن التطابق)

    def remember(p):
        if p + 3 <= end:
            index.setdefault(data[p:p + 3], []).append(p)

    while pos < end:
        flag_pos = len(out)
        out.append(0)
        flags = 0
        for bit in range(8):
            if pos >= end:
                break
            best_len, best_off = 0, 0
            if pos > 0 and pos + 3 <= end:
                _, max_len = _copy_token_help(pos, 0)
                limit = min(max_len, end - pos)
                for cand in reversed(index.get(data[pos:pos + 3], [])[-256:]):
                    ln = 0
                    while ln < limit and data[cand + ln] == data[pos + ln]:
                        ln += 1
                    if ln > best_len:
                        best_len, best_off = ln, pos - cand
                        if ln == limit:
                            break
            if best_len >= 3:
                bit_count, _ = _copy_token_help(pos, 0)
                token = ((best_off - 1) << (16 - bit_count)) | (best_len - 3)
                out += struct.pack("<H", token)
                flags |= 1 << bit
                for p in range(pos, pos + best_len):
                    remember(p)
                pos += best_len
            else:
                out.append(data[pos])
                remember(pos)
                pos += 1
        out[flag_pos] = flags
    return bytes(out)


def ovba_compress(data: bytes) -> bytes:
    out = bytearray(b"\x01")
    for i in range(0, len(data), 4096):
        chunk = data[i:i + 4096]
        comp = _compress_chunk(chunk)
        if len(comp) <= 4096:
            out += struct.pack("<H", (len(comp) + 2 - 3) | (0b011 << 12) | 0x8000) + comp
        else:
            assert len(chunk) == 4096, "uncompressible short chunk"
            out += struct.pack("<H", (4096 + 2 - 3) | (0b011 << 12)) + chunk
    return bytes(out)


def ovba_decompress(data: bytes) -> bytes:
    """للتحقق فقط (عكس ovba_compress)."""
    assert data[0] == 1
    out = bytearray()
    pos = 1
    while pos < len(data):
        hdr = struct.unpack_from("<H", data, pos)[0]
        size = (hdr & 0x0FFF) + 3
        flag = hdr >> 15
        chunk = data[pos + 2:pos + size]
        pos += size
        start = len(out)
        if not flag:
            out += chunk
            continue
        i = 0
        while i < len(chunk):
            flags = chunk[i]
            i += 1
            for bit in range(8):
                if i >= len(chunk):
                    break
                if flags & (1 << bit):
                    token = struct.unpack_from("<H", chunk, i)[0]
                    i += 2
                    bit_count, _ = _copy_token_help(len(out), start)
                    length = (token & (0xFFFF >> bit_count)) + 3
                    offset = (token >> (16 - bit_count)) + 1
                    for _ in range(length):
                        out.append(out[-offset])
                else:
                    out.append(chunk[i])
                    i += 1
    return bytes(out)


# ============================================================ MS-OVBA 2.4.3 تشفير CMG/DPB/GC


def _encrypt(data: bytes, project_id: str, seed: int) -> str:
    proj_key = sum(project_id.encode("ascii")) & 0xFF
    version = 2
    out = bytearray()
    out.append(seed)
    ver_enc = seed ^ version
    out.append(ver_enc)
    key_enc = seed ^ proj_key
    out.append(key_enc)
    unenc1, enc1, enc2 = proj_key, key_enc, ver_enc
    ignored_len = (seed & 6) // 2
    for k in range(ignored_len):
        temp = (seed * 7 + k * 13) & 0xFF
        b = temp ^ ((enc2 + unenc1) & 0xFF)
        out.append(b)
        enc2, enc1, unenc1 = enc1, b, temp
    for byte in struct.pack("<I", len(data)) + data:
        b = byte ^ ((enc2 + unenc1) & 0xFF)
        out.append(b)
        enc2, enc1, unenc1 = enc1, b, byte
    return out.hex().upper()


# ============================================================ MS-OVBA 2.3.4.2 تدفّق dir


def _rec(rid, payload=b""):
    return struct.pack("<HI", rid, len(payload)) + payload


def _build_dir(modules, codepage=1252):
    enc = lambda s: s.encode("cp1252")
    u16 = lambda s: s.encode("utf-16-le")
    d = bytearray()
    # PROJECTINFORMATION
    d += _rec(0x0001, struct.pack("<I", 1))                 # SYSKIND = Win32
    d += _rec(0x0002, struct.pack("<I", 0x0409))            # LCID
    d += _rec(0x0014, struct.pack("<I", 0x0409))            # LCIDINVOKE
    d += _rec(0x0003, struct.pack("<H", codepage))          # CODEPAGE
    d += _rec(0x0004, enc("VBAProject"))                    # NAME
    d += _rec(0x0005, b"") + _rec(0x0040, b"")              # DOCSTRING (+unicode)
    d += _rec(0x0006, b"") + _rec(0x003D, b"")              # HELPFILEPATH 1/2
    d += _rec(0x0007, struct.pack("<I", 0))                 # HELPCONTEXT
    d += _rec(0x0008, struct.pack("<I", 0))                 # LIBFLAGS
    d += struct.pack("<HIIH", 0x0009, 4, 1, 0)              # VERSION (major 1, minor 0)
    d += _rec(0x000C, b"") + _rec(0x003C, b"")              # CONSTANTS (+unicode)
    # PROJECTREFERENCES — stdole (OLE Automation)
    name = "stdole"
    d += _rec(0x0016, enc(name)) + _rec(0x003E, u16(name))
    libid = enc("*\\G{00020430-0000-0000-C000-000000000046}#2.0#0#C:\\Windows\\System32\\stdole2.tlb#OLE Automation")
    d += struct.pack("<HI", 0x000D, 4 + len(libid) + 6) + struct.pack("<I", len(libid)) + libid + struct.pack("<IH", 0, 0)
    # PROJECTMODULES
    d += _rec(0x000F, struct.pack("<H", len(modules)))
    d += _rec(0x0013, struct.pack("<H", 0xFFFF))            # PROJECTCOOKIE
    for m in modules:
        n = m["name"]
        d += _rec(0x0019, enc(n))                           # MODULENAME
        d += _rec(0x0047, u16(n))                           # MODULENAMEUNICODE
        d += _rec(0x001A, enc(n)) + _rec(0x0032, u16(n))    # MODULESTREAMNAME
        d += _rec(0x001C, b"") + _rec(0x0048, b"")          # MODULEDOCSTRING
        d += _rec(0x0031, struct.pack("<I", 0))             # MODULEOFFSET (لا يوجد p-code)
        d += _rec(0x001E, struct.pack("<I", 0))             # MODULEHELPCONTEXT
        d += _rec(0x002C, struct.pack("<H", 0xFFFF))        # MODULECOOKIE
        d += struct.pack("<HI", 0x0022 if m["document"] else 0x0021, 0)  # MODULETYPE
        d += struct.pack("<HI", 0x002B, 0)                  # Terminator
    d += struct.pack("<HI", 0x0010, 0)                      # dir Terminator
    return bytes(d)


def _build_project_stream(modules, project_id):
    lines = [f'ID="{project_id}"']
    for m in modules:
        if m["document"]:
            lines.append(f"Document={m['name']}/&H00000000")
        else:
            lines.append(f"Module={m['name']}")
    lines += ['Name="VBAProject"', 'HelpContextID="0"', 'VersionCompatible32="393222000"',
              'CMG="' + _encrypt(struct.pack("<I", 0), project_id, 0x35) + '"',
              'DPB="' + _encrypt(bytes([0]), project_id, 0x49) + '"',
              'GC="' + _encrypt(bytes([255]), project_id, 0x62) + '"',
              "", "[Host Extender Info]",
              "&H00000001={3832D640-CF90-11CF-8E43-00A0C911005A};VBE;&H00000000",
              "", "[Workspace]"]
    lines += [f"{m['name']}=0, 0, 0, 0, C" for m in modules]
    return ("\r\n".join(lines) + "\r\n").encode("cp1252")


def _build_projectwm(modules):
    out = bytearray()
    for m in modules:
        out += m["name"].encode("cp1252") + b"\x00" + m["name"].encode("utf-16-le") + b"\x00\x00"
    return bytes(out + b"\x00\x00")


# ============================================================ MS-CFB كاتب الحاوية المركبة

SECT = 512
MINI = 64
CUTOFF = 4096
FREESECT, ENDOFCHAIN, FATSECT, NOSTREAM = 0xFFFFFFFF, 0xFFFFFFFE, 0xFFFFFFFD, 0xFFFFFFFF


class _Node:
    def __init__(self, name, data=None):
        self.name, self.data = name, data
        self.children = []
        self.sid = None
        self.left = self.right = self.child = NOSTREAM
        self.start, self.size = ENDOFCHAIN, 0

    @property
    def is_storage(self):
        return self.data is None


def _cfb_key(n):
    return (len(n.name), n.name.upper())


def write_cfb(tree):
    """tree: dict {name: bytes | dict} → bytes (ملف CFB)."""
    root = _Node("Root Entry")

    def build(node, d):
        for k, v in d.items():
            ch = _Node(k, None if isinstance(v, dict) else v)
            node.children.append(ch)
            if isinstance(v, dict):
                build(ch, v)
    build(root, tree)

    order = []

    def number(node):
        node.sid = len(order)
        order.append(node)
        kids = sorted(node.children, key=_cfb_key)
        for k in kids:
            number(k)
        # سلسلة يمينية مرتبة (كل العقد سوداء — نفس أسلوب Apache POI)
        if kids:
            node.child = kids[0].sid
            for a, b in zip(kids, kids[1:]):
                a.right = b.sid
    number(root)

    streams = [n for n in order if not n.is_storage]
    small = [n for n in streams if len(n.data) < CUTOFF]
    big = [n for n in streams if len(n.data) >= CUTOFF]

    # --- المِني ستريم
    mini_fat, mini_data = [], bytearray()
    for n in small:
        n.size = len(n.data)
        if n.size == 0:
            n.start = ENDOFCHAIN
            continue
        cnt = -(-n.size // MINI)
        n.start = len(mini_fat)
        for i in range(cnt):
            mini_fat.append(n.start + i + 1 if i < cnt - 1 else ENDOFCHAIN)
        mini_data += n.data + b"\x00" * (cnt * MINI - n.size)

    ndir = -(-len(order) // 4)
    nminifat = -(-len(mini_fat) * 4 // SECT) if mini_fat else 0
    nministream = -(-len(mini_data) // SECT)
    nbig = [(-(-len(n.data) // SECT)) for n in big]
    payload = ndir + nminifat + nministream + sum(nbig)
    nfat = 1
    while nfat * (SECT // 4) < payload + nfat:
        nfat += 1
    assert nfat <= 109

    fat = [FATSECT] * nfat
    def chain(count):
        s = len(fat)
        for i in range(count):
            fat.append(s + i + 1 if i < count - 1 else ENDOFCHAIN)
        return s if count else ENDOFCHAIN
    dir_start = chain(ndir)
    minifat_start = chain(nminifat)
    root.start = chain(nministream)
    root.size = len(mini_data)
    for n, c in zip(big, nbig):
        n.size = len(n.data)
        n.start = chain(c)
    fat += [FREESECT] * (nfat * (SECT // 4) - len(fat))

    # --- الترويسة
    hdr = bytearray(b"\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1") + bytes(16)
    hdr += struct.pack("<HHHHH", 0x003E, 0x0003, 0xFFFE, 9, 6) + bytes(6)
    hdr += struct.pack("<IIIIIIIII", 0, nfat, dir_start, 0, CUTOFF,
                       minifat_start if nminifat else ENDOFCHAIN, nminifat, ENDOFCHAIN, 0)
    difat = list(range(nfat)) + [FREESECT] * (109 - nfat)
    hdr += struct.pack("<109I", *difat)
    assert len(hdr) == SECT

    # --- الدليل
    dirb = bytearray()
    for n in order:
        nm = n.name.encode("utf-16-le") + b"\x00\x00"
        assert len(nm) <= 64
        typ = 5 if n is root else (1 if n.is_storage else 2)
        dirb += nm + bytes(64 - len(nm))
        dirb += struct.pack("<HBB", len(nm), typ, 1)
        dirb += struct.pack("<III", n.left, n.right, n.child)
        dirb += bytes(16) + struct.pack("<I", 0) + bytes(16)
        start = n.start if (n is root or not n.is_storage) else 0
        size = n.size if (n is root or not n.is_storage) else 0
        dirb += struct.pack("<IQ", start, size)
    empty = bytes(64) + struct.pack("<HBB", 0, 0, 0) + struct.pack("<III", NOSTREAM, NOSTREAM, NOSTREAM) + bytes(16 + 4 + 16) + struct.pack("<IQ", 0, 0)
    while len(dirb) < ndir * SECT:
        dirb += empty

    pad = lambda b: bytes(b) + b"\x00" * ((-len(b)) % SECT)
    body = bytearray()
    body += struct.pack(f"<{len(fat)}I", *fat)
    body += dirb
    if nminifat:
        mf = mini_fat + [FREESECT] * (nminifat * SECT // 4 - len(mini_fat))
        body += struct.pack(f"<{len(mf)}I", *mf)
    body += pad(mini_data)
    for n in big:
        body += pad(n.data)
    return bytes(hdr + body)


# ============================================================ الواجهة


def build_vba_project(modules, project_id=None):
    """modules: قائمة dict(name, code, document: bool). يُعيد bytes لملف vbaProject.bin"""
    project_id = project_id or "{" + str(uuid.UUID(int=0x5A11E7C0DE)).upper() + "}"
    for m in modules:
        m["code"].encode("ascii")  # الكود يجب أن يكون ASCII فقط (النصوص العربية تُقرأ من الخلايا)
    vba = {
        "_VBA_PROJECT": b"\xCC\x61\xFF\xFF\x00\x00\x00",
        "dir": ovba_compress(_build_dir(modules)),
    }
    for m in modules:
        src = m["code"].replace("\r\n", "\n").replace("\n", "\r\n")
        if not src.endswith("\r\n"):
            src += "\r\n"
        vba[m["name"]] = ovba_compress(src.encode("cp1252"))
    tree = {"VBA": vba,
            "PROJECT": _build_project_stream(modules, project_id),
            "PROJECTwm": _build_projectwm(modules)}
    return write_cfb(tree)


DOC_HEADER = {
    "workbook": "0{00020819-0000-0000-C000-000000000046}",
    "sheet": "0{00020820-0000-0000-C000-000000000046}",
}


def document_module(name, kind, body=""):
    return (f'Attribute VB_Name = "{name}"\n'
            f'Attribute VB_Base = "{DOC_HEADER[kind]}"\n'
            "Attribute VB_GlobalNameSpace = False\n"
            "Attribute VB_Creatable = False\n"
            "Attribute VB_PredeclaredId = True\n"
            "Attribute VB_Exposed = True\n"
            "Attribute VB_TemplateDerived = False\n"
            "Attribute VB_Customizable = True\n" + body)


def standard_module(name, body):
    return f'Attribute VB_Name = "{name}"\n' + body


if __name__ == "__main__":
    # اختبار ذاتي للضغط
    import random
    random.seed(1)
    for n in (0, 1, 7, 100, 4095, 4096, 4097, 10000):
        s = bytes(random.choice(b"abc de\r\nfgh") for _ in range(n))
        assert ovba_decompress(ovba_compress(s)) == s, n
    print("compression round-trip OK")
