// ZATCA Phase 1 (Generation) QR: TLV fields encoded as Base64.
// Tags: 1 seller name, 2 VAT number, 3 timestamp, 4 invoice total (with VAT), 5 VAT total.
function zatcaTlvBase64(sellerName, vatNumber, timestamp, total, vat) {
  var enc = new TextEncoder();
  var fields = [sellerName, vatNumber, timestamp, total, vat];
  var bytes = [];
  fields.forEach(function (value, i) {
    var v = enc.encode(String(value));
    if (v.length > 255) throw new Error('TLV value too long');
    bytes.push(i + 1, v.length);
    for (var j = 0; j < v.length; j++) bytes.push(v[j]);
  });
  var bin = '';
  bytes.forEach(function (b) { bin += String.fromCharCode(b); });
  return btoa(bin);
}

// Decodes a Phase 1 QR payload back to its fields (used to self-check every invoice).
function zatcaTlvDecode(b64) {
  var bin = atob(b64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  var dec = new TextDecoder();
  var out = {};
  var p = 0;
  while (p < bytes.length) {
    var tag = bytes[p], len = bytes[p + 1];
    out[tag] = dec.decode(bytes.slice(p + 2, p + 2 + len));
    p += 2 + len;
  }
  return out;
}

// Saudi VAT number: 15 digits, starts and ends with 3.
function isValidVatNumber(v) {
  return /^3\d{13}3$/.test(v);
}

function qrSvg(text, cellSize) {
  var qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: cellSize || 3, margin: 2, scalable: true });
}
