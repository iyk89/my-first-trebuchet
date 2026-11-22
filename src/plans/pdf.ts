/**
 * Writes plan sheets to a PDF file: real vector lines and text, at true scale (millimeters),
 * using the two fonts every PDF reader has built in (Helvetica and Helvetica-Bold).
 */
import { textWidth, type Prim, type Sheet } from './drawing';

const K = 72 / 25.4; // points per millimeter

// The few characters outside Latin-1 that we use, mapped to the PDF's built-in Windows encoding.
const WIN: Record<string, number> = { '–': 0x96, '—': 0x97, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '…': 0x85 };

function pdfText(s: string) {
  let out = '';
  for (const ch of s) {
    let code = ch.codePointAt(0)!;
    if (WIN[ch]) code = WIN[ch];
    else if (code > 255) code = 63; // '?'
    const c = String.fromCharCode(code);
    out += c === '(' || c === ')' || c === '\\' ? '\\' + c : c;
  }
  return out;
}

function rgb(hex = '#000000') {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(' ');
}

const f = (v: number) => (Math.round(v * 100) / 100).toString();

function draw(p: Prim, H: number): string {
  const X = (x: number) => f(x * K);
  const Y = (y: number) => f((H - y) * K);
  const dash = 'dash' in p && p.dash ? `[${p.dash.map((d) => f(d * K)).join(' ')}] 0 d\n` : '[] 0 d\n';
  if (p.t === 'line') {
    return `${dash}${f((p.w ?? 0.25) * K)} w ${rgb(p.c)} RG ${X(p.a[0])} ${Y(p.a[1])} m ${X(p.b[0])} ${Y(p.b[1])} l S\n`;
  }
  if (p.t === 'poly') {
    let s = `${dash}${f((p.w ?? 0.3) * K)} w ${rgb(p.c)} RG ${p.fill ? rgb(p.fill) + ' rg ' : ''}`;
    s += p.pts.map((q, i) => `${X(q[0])} ${Y(q[1])} ${i === 0 ? 'm' : 'l'}`).join(' ');
    const close = p.close !== false;
    s += close ? ' h' : '';
    s += p.fill ? (p.w === 0 ? ' f\n' : ' B\n') : ' S\n';
    return s;
  }
  if (p.t === 'circle') {
    const [cx, cy] = p.at;
    const r = p.r;
    const k = 0.5523 * r;
    const pts = [
      [cx + r, cy],
      [cx + r, cy - k, cx + k, cy - r, cx, cy - r],
      [cx - k, cy - r, cx - r, cy - k, cx - r, cy],
      [cx - r, cy + k, cx - k, cy + r, cx, cy + r],
      [cx + k, cy + r, cx + r, cy + k, cx + r, cy],
    ];
    let s = `${dash}${f((p.w ?? 0.3) * K)} w ${rgb(p.c)} RG ${p.fill ? rgb(p.fill) + ' rg ' : ''}`;
    s += `${X(pts[0][0])} ${Y(pts[0][1])} m `;
    for (let i = 1; i < 5; i++) {
      const q = pts[i];
      s += `${X(q[0])} ${Y(q[1])} ${X(q[2])} ${Y(q[3])} ${X(q[4])} ${Y(q[5])} c `;
    }
    s += p.fill ? 'B\n' : 'S\n';
    return s;
  }
  // text
  const size = p.size ?? 3;
  const w = textWidth(p.s, size, p.bold);
  const rot = ((p.rot ?? 0) * Math.PI) / 180;
  const shift = p.anchor === 'middle' ? w / 2 : p.anchor === 'end' ? w : 0;
  const x = p.at[0] - Math.cos(rot) * shift;
  const y = p.at[1] + Math.sin(rot) * shift; // paper y points down
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  return `BT /${p.bold ? 'F2' : 'F1'} ${f(size * K)} Tf ${rgb(p.c)} rg ${f(c)} ${f(sn)} ${f(-sn)} ${f(c)} ${X(x)} ${Y(y)} Tm (${pdfText(p.s)}) Tj ET\n`;
}

/** Build a PDF (as bytes) from plan sheets. */
export function sheetsToPdf(sheets: Sheet[], title: string): Uint8Array {
  const objs: string[] = [];
  const add = (s: string) => {
    objs.push(s);
    return objs.length; // object number
  };
  const catalog = add(''); // filled in below
  const pages = add('');
  const font1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const font2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const kids: number[] = [];
  for (const sh of sheets) {
    const content = '1 J 1 j\n' + sh.prims.map((p) => draw(p, sh.h)).join('');
    const stream = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const page = add(
      `<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${f(sh.w * K)} ${f(sh.h * K)}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${stream} 0 R >>`,
    );
    kids.push(page);
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pages} 0 R >>`;
  objs[pages - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const info = add(`<< /Title (${pdfText(title)}) /Creator (Trebuchet Lab) >>`);

  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return bytes;
}
