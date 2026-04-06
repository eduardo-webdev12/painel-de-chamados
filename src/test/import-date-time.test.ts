import { describe, expect, it } from "vitest";
import { formatDateTimeBrazil, parseSpreadsheetDateTime } from "@/lib/dateTime";

describe("dateTime import helpers", () => {
  it("preserva horário brasileiro ao interpretar data manual DD/MM/AAAA", () => {
    expect(parseSpreadsheetDateTime("06/04/2026 19:51")).toEqual({
      display: "06/04/2026 19:51",
      iso: "2026-04-06T19:51:00-03:00",
      warning: "Data ambígua — interpretada como DD/MM/AAAA",
    });
  });

  it("converte serial do Excel sem deslocar o horário", () => {
    expect(parseSpreadsheetDateTime(46118.82708333333)).toEqual({
      display: "06/04/2026 19:51",
      iso: "2026-04-06T19:51:00-03:00",
      warning: undefined,
    });
  });

  it("padroniza datas iso-like com separador hífen", () => {
    expect(parseSpreadsheetDateTime("2026-04-06 19:51")).toEqual({
      display: "06/04/2026 19:51",
      iso: "2026-04-06T19:51:00-03:00",
      warning: undefined,
    });
  });

  it("formata timestamps sempre em BRT", () => {
    expect(formatDateTimeBrazil("2026-04-06T22:51:00.000Z")).toBe("06/04/2026 19:51");
  });

  it("não bloqueia datas inválidas", () => {
    expect(parseSpreadsheetDateTime("32/13/2026 19:51")).toEqual({
      display: "",
      iso: null,
      warning: "Data inválida — o chamado será importado sem horário da falha",
    });
  });
});