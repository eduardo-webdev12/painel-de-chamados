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
};

// ─── Header ──────────────────────────────────────────────
export interface PdfHeaderOptions {
  doc: jsPDF;
  logo: string | null;
  title: string;
  subtitle?: string;
  meta?: string[];  // lines under subtitle
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
export function drawFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);

    // Bottom accent bar
    doc.setFillColor(...BRAND.primary);
    doc.rect(0, pageH - 3, pageW, 3, "F");

    // Footer text
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.muted);
    doc.text(
      `Plataforma SAC VX Integrações — Documento gerado automaticamente — Página ${i} de ${pages}`,
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
