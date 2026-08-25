type PdfRow = { label: string; detail?: string; amount?: string; strong?: boolean };
export type PdfSection = { title: string; rows: PdfRow[] };
export type ReportPdfInput = { company: string; title: string; subtitle: string; sections: PdfSection[] };

const ascii = (value: string) => value.normalize("NFKD").replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E]/g, "");
const escapePdf = (value: string) => ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const text = (value: string, x: number, y: number, size = 10, bold = false) => `BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdf(value)}) Tj ET`;
const right = (value: string, y: number, bold = false) => text(value, Math.max(360, 545 - ascii(value).length * (bold ? 5.7 : 5.2)), y, 10, bold);

export function generateReportPdf(input: ReportPdfInput) {
  const pages: string[][] = [[]];
  let page = pages[0], y = 790;
  const header = () => {
    page.push(text(input.company, 45, y, 12, true)); y -= 24;
    page.push(text(input.title, 45, y, 20, true)); y -= 18;
    page.push(text(input.subtitle, 45, y, 9)); y -= 18;
    page.push(`0.5 w 45 ${y} m 550 ${y} l S`); y -= 24;
  };
  const newPage = () => { page = []; pages.push(page); y = 790; header(); };
  header();
  for (const section of input.sections) {
    if (y < 105) newPage();
    page.push(text(section.title, 45, y, 12, true)); y -= 18;
    for (const row of section.rows) {
      if (y < 65) newPage();
      page.push(text(row.label, 58, y, 10, row.strong));
      if (row.detail) page.push(text(row.detail, 300, y, 9));
      if (row.amount) page.push(right(row.amount, y, row.strong));
      y -= row.strong ? 20 : 17;
      if (row.strong) page.push(`0.35 w 55 ${y + 8} m 550 ${y + 8} l S`);
    }
    y -= 9;
  }
  pages.forEach((commands, index) => commands.push(text(`Page ${index + 1} of ${pages.length}`, 480, 28, 8)));

  const objects: string[] = [""];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  const kids: string[] = [];
  pages.forEach((commands, index) => {
    const contentId = 5 + index * 2, pageId = contentId + 1, stream = commands.join("\n");
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    kids.push(`${pageId} 0 R`);
  });
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(" ")}] >>`;
  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) { offsets[id] = Buffer.byteLength(output, "ascii"); output += `${id} 0 obj\n${objects[id]}\nendobj\n`; }
  const xref = Buffer.byteLength(output, "ascii");
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(output, "ascii"));
}
