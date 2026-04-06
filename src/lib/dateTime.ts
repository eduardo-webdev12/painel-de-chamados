import * as XLSX from "xlsx";

const BRAZIL_TIME_ZONE = "America/Sao_Paulo";
const BRAZIL_OFFSET = "-03:00";

export interface ParsedSpreadsheetDateTime {
  display: string;
  iso: string | null;
  warning?: string;
}

const pad = (value: number) => String(value).padStart(2, "0");

const getBrazilParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));

  return {
    day: Number(map.day),
    month: Number(map.month),
    year: Number(map.year),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
};

const isValidDateParts = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const buildDisplay = (year: number, month: number, day: number, hour = 0, minute = 0) => (
  `${pad(day)}/${pad(month)}/${year} ${pad(hour)}:${pad(minute)}`
);

const buildBrazilIso = (year: number, month: number, day: number, hour = 0, minute = 0, second = 0) => (
  `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}${BRAZIL_OFFSET}`
);

const buildParsedResult = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  warning?: string,
): ParsedSpreadsheetDateTime => {
  if (!isValidDateParts(year, month, day) || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    return { display: "", iso: null, warning: "Data inválida — o chamado será importado sem horário da falha" };
  }

  return {
    display: buildDisplay(year, month, day, hour, minute),
    iso: buildBrazilIso(year, month, day, hour, minute, second),
    warning,
  };
};

export function parseSpreadsheetDateTime(rawInput: string | number | Date | null | undefined): ParsedSpreadsheetDateTime {
  if (rawInput === null || rawInput === undefined || rawInput === "") {
    return { display: "", iso: null };
  }

  if (rawInput instanceof Date && !Number.isNaN(rawInput.getTime())) {
    const parts = getBrazilParts(rawInput);
    return buildParsedResult(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second);
  }

  const raw = String(rawInput).trim();
  if (!raw || raw === "undefined" || raw === "null") {
    return { display: "", iso: null };
  }

  if (/^\d{5}(\.\d+)?$/.test(raw)) {
    const parsed = XLSX.SSF.parse_date_code(Number(raw));
    if (parsed) {
      return buildParsedResult(parsed.y, parsed.m, parsed.d, parsed.H, parsed.M, parsed.S);
    }
  }

  const normalized = raw.replace("T", " ").replace(/\./g, "/").replace(/-/g, "/").replace(/\s+/g, " ").trim();

  const isoLikeMatch = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/);
  if (isoLikeMatch) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = isoLikeMatch;
    return buildParsedResult(Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second));
  }

  const slashMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/);
  if (slashMatch) {
    const [, part1, part2, rawYear, hour = "0", minute = "0", second = "0"] = slashMatch;
    const first = Number(part1);
    const secondPart = Number(part2);
    const year = Number(rawYear.length === 2 ? `20${rawYear}` : rawYear);

    let day: number;
    let month: number;
    let warning: string | undefined;

    if (first > 12) {
      day = first;
      month = secondPart;
    } else if (secondPart > 12) {
      month = first;
      day = secondPart;
      warning = "Data em formato americano detectada e convertida automaticamente";
    } else {
      day = first;
      month = secondPart;
      warning = "Data ambígua — interpretada como DD/MM/AAAA";
    }

    return buildParsedResult(year, month, day, Number(hour), Number(minute), Number(second), warning);
  }

  return {
    display: raw,
    iso: null,
    warning: "Data não reconhecida — o chamado será importado sem horário da falha",
  };
}

export function formatDateTimeBrazil(value: string | Date | null | undefined, options?: { includeConnector?: boolean }) {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const parts = getBrazilParts(date);
  const separator = options?.includeConnector ? " às " : " ";

  return `${pad(parts.day)}/${pad(parts.month)}/${parts.year}${separator}${pad(parts.hour)}:${pad(parts.minute)}`;
}