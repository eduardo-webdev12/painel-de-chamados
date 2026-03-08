/**
 * Professional PDF Theme — SAC VX Integrações
 * Shared styling and helpers for all PDF exports.
 */
import type jsPDF from "jspdf";
import type { UserOptions } from "jspdf-autotable";

// ─── Brand Colors ────────────────────────────────────────
export const BRAND = {
  primary:    [22, 101, 52] as [number, number, number],   // Green 800
  primaryLt:  [34, 139, 74] as [number, number, number],   // Green 600
  accent:     [20, 83, 45]  as [number, number, number],   // Green 900
  dark:       [30, 41, 59]  as [number, number, number],   // Slate 800
  muted:      [100, 116, 139] as [number, number, number], // Slate 500
  light:      [241, 245, 249] as [number, number, number], // Slate 100
  white:      [255, 255, 255] as [number, number, number],
  danger:     [185, 28, 28] as [number, number, number],
  warning:    [180, 83, 9]  as [number, number, number],
  stripeBg:   [248, 250, 252] as [number, number, number], // Slate 50
  headerBg:   [22, 101, 52] as [number, number, number],   // Green 800
  borderLine: [203, 213, 225] as [number, number, number], // Slate 300
  coverBg:    [15, 23, 42]  as [number, number, number],   // Slate 900
};

// ─── Cover Page ──────────────────────────────────────────
export interface CoverPageOptions {
  doc: jsPDF;
  logo: string | null;
  title: string;
  subtitle?: string;
  periodo?: string;
  geradoEm: string;
  operador?: string;
}

export function drawCoverPage({ doc, logo, title, subtitle, periodo, geradoEm, operador }: CoverPageOptions) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Full dark background
  doc.setFillColor(...BRAND.coverBg);
  doc.rect(0, 0, pageW, pageH, "F");

  // Green accent strip on left
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, 6, pageH, "F");

  // Green accent line at top
  doc.setFillColor(...BRAND.primaryLt);
  doc.rect(6, 0, pageW - 6, 3, "F");

  // Logo — centered, proportional
  if (logo) {
    try {
      const logoW = 36;
      const logoH = 36;
      const logoX = (pageW - logoW) / 2;
      doc.addImage(logo, "PNG", logoX, 35, logoW, logoH);
    } catch {}
  }

  // Company name
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.primaryLt);
  doc.text("VX INTEGRAÇÕES", pageW / 2, 82, { align: "center" });

  // Thin line separator
  doc.setDrawColor(...BRAND.primaryLt);
  doc.setLineWidth(0.5);
  doc.line(pageW * 0.3, 88, pageW * 0.7, 88);

  // Title
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.white);
  doc.text(title, pageW / 2, 102, { align: "center" });

  // Subtitle
  if (subtitle) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.muted);
    doc.text(subtitle, pageW / 2, 112, { align: "center" });
  }

  // Metadata box
  const boxW = 120;
  const boxX = (pageW - boxW) / 2;
  const boxY = 125;
  doc.setFillColor(30, 41, 59); // slightly lighter than cover bg
  doc.setDrawColor(...BRAND.primary);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, boxY, boxW, 38, 3, 3, "FD");

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND.muted);

  const metaLines: [string, string][] = [
    ["Data de Geração", geradoEm],
  ];
  if (periodo) metaLines.push(["Período Analisado", periodo]);
  if (operador) metaLines.push(["Gerado por", operador]);

  metaLines.forEach(([label, value], i) => {
    const ly = boxY + 9 + i * 10;
    doc.setTextColor(...BRAND.muted);
    doc.text(label, boxX + 8, ly);
    doc.setTextColor(...BRAND.white);
    doc.setFont("helvetica", "bold");
    doc.text(value, boxX + boxW - 8, ly, { align: "right" });
    doc.setFont("helvetica", "normal");
    if (i < metaLines.length - 1) {
      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(0.15);
      doc.line(boxX + 6, ly + 4, boxX + boxW - 6, ly + 4);
    }
  });

  // Bottom bar
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, pageH - 3, pageW, 3, "F");

  // Footer text
  doc.setFontSize(6);
  doc.setTextColor(71, 85, 105);
  doc.text("Plataforma SAC VX Integrações — Documento Confidencial", pageW / 2, pageH - 6, { align: "center" });

  // New page for content
  doc.addPage();
}

// ─── KPI Cards Row ───────────────────────────────────────
export interface KpiItem {
  label: string;
  value: string;
  highlight?: boolean;
}

export function drawKpiCards(doc: jsPDF, kpis: KpiItem[], y: number): number {
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const usableW = pageW - margin * 2;
  const cols = Math.min(kpis.length, 4);
  const cardW = (usableW - (cols - 1) * 4) / cols;
  const cardH = 18;

  for (let row = 0; row < Math.ceil(kpis.length / 4); row++) {
    const rowKpis = kpis.slice(row * 4, row * 4 + 4);
    const rowCols = rowKpis.length;
    const rowCardW = (usableW - (rowCols - 1) * 4) / rowCols;

    rowKpis.forEach((kpi, i) => {
      const x = margin + i * (rowCardW + 4);
      const ry = y + row * (cardH + 4);

      // Card background
      doc.setFillColor(...(kpi.highlight ? [254, 242, 242] as [number, number, number] : BRAND.light));
      doc.setDrawColor(...(kpi.highlight ? BRAND.danger : BRAND.borderLine));
      doc.setLineWidth(0.3);
      doc.roundedRect(x, ry, rowCardW, cardH, 2, 2, "FD");

      // Green top accent
      doc.setFillColor(...(kpi.highlight ? BRAND.danger : BRAND.primary));
      doc.rect(x, ry, rowCardW, 1.5, "F");

      // Label
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BRAND.muted);
      doc.text(kpi.label, x + rowCardW / 2, ry + 7, { align: "center" });

      // Value
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...(kpi.highlight ? BRAND.danger : BRAND.dark));
      doc.text(kpi.value, x + rowCardW / 2, ry + 14, { align: "center" });
    });
  }

  const totalRows = Math.ceil(kpis.length / 4);
  doc.setTextColor(0, 0, 0);
  return y + totalRows * (cardH + 4) + 4;
}

// ─── Header (for content pages) ─────────────────────────
export interface PdfHeaderOptions {
  doc: jsPDF;
  logo: string | null;
  title: string;
  subtitle?: string;
  meta?: string[];
}

export function drawHeader({ doc, logo, title, subtitle, meta = [] }: PdfHeaderOptions): number {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 10;

  // Top accent bar
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, pageW, 3, "F");

  // Logo
  const logoX = margin;
  const logoSize = 16;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", logoX, y, logoSize, logoSize);
    } catch {}
  }

  const textX = logo ? logoX + logoSize + 6 : margin;

  // Company name
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND.muted);
  doc.text("VX INTEGRAÇÕES", textX, y + 4);

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.dark);
  doc.text(title, textX, y + 11);

  // Subtitle
  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.muted);
    doc.text(subtitle, textX, y + 16);
  }

  // Meta info (right-aligned)
  if (meta.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.muted);
    meta.forEach((line, i) => {
      doc.text(line, pageW - margin, y + 5 + i * 4, { align: "right" });
    });
  }

  // Divider line
  y = y + logoSize + 6;
  doc.setDrawColor(...BRAND.primary);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);

  // Thin secondary line
  doc.setDrawColor(...BRAND.borderLine);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 1.5, pageW - margin, y + 1.5);

  doc.setTextColor(0, 0, 0);
  return y + 6;
}

// ─── Section Title ───────────────────────────────────────
export function drawSectionTitle(doc: jsPDF, title: string, y: number, options?: { color?: [number, number, number] }): number {
  const color = options?.color || BRAND.primary;
  const margin = 14;

  // Green accent dot
  doc.setFillColor(...color);
  doc.circle(margin + 1.5, y - 1, 1.5, "F");

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.dark);
  doc.text(title, margin + 6, y);

  // Subtle underline
  doc.setDrawColor(...BRAND.borderLine);
  doc.setLineWidth(0.2);
  doc.line(margin, y + 2, doc.internal.pageSize.getWidth() - margin, y + 2);

  doc.setTextColor(0, 0, 0);
  return y + 6;
}

// ─── Table Styles ────────────────────────────────────────
export function getTableStyles(variant: "default" | "kpi" | "danger" = "default"): Partial<UserOptions> {
  const headFill = variant === "danger" ? BRAND.danger : variant === "kpi" ? BRAND.accent : BRAND.headerBg;

  return {
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
      lineColor: BRAND.borderLine,
      lineWidth: 0.15,
      textColor: BRAND.dark,
      font: "helvetica",
    },
    headStyles: {
      fillColor: headFill,
      textColor: BRAND.white,
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
    },
    alternateRowStyles: {
      fillColor: BRAND.stripeBg,
    },
    margin: { left: 14, right: 14 },
    tableLineColor: BRAND.borderLine,
    tableLineWidth: 0.15,
  };
}

export function getKpiTableStyles(): Partial<UserOptions> {
  return {
    ...getTableStyles("kpi"),
    styles: {
      ...getTableStyles("kpi").styles,
      fontSize: 9,
      cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
      halign: "center",
      fontStyle: "bold",
    },
  };
}

// ─── Footer ──────────────────────────────────────────────
export function drawFooter(doc: jsPDF, skipPage1 = false) {
  const pages = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentPages = skipPage1 ? pages - 1 : pages;

  for (let i = 1; i <= pages; i++) {
    if (skipPage1 && i === 1) continue; // cover page already has its own footer
    doc.setPage(i);

    // Bottom accent bar
    doc.setFillColor(...BRAND.primary);
    doc.rect(0, pageH - 3, pageW, 3, "F");

    const pageNum = skipPage1 ? i - 1 : i;

    // Footer text
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.muted);
    doc.text(
      `Plataforma SAC VX Integrações — Documento gerado automaticamente — Página ${pageNum} de ${contentPages}`,
      pageW / 2,
      pageH - 6,
      { align: "center" }
    );

    // Confidential mark
    doc.setFontSize(5.5);
    doc.text("CONFIDENCIAL — USO INTERNO", pageW - 14, pageH - 6, { align: "right" });
  }
}

// ─── Page Break Helper ───────────────────────────────────
export function checkPageBreak(doc: jsPDF, y: number, needed = 40): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage();
    return 15;
  }
  return y;
}
