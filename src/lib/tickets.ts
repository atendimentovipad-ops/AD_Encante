export interface Ticket {
  originator?: string;
  id: string;
  name: string;
  phone: string;
  agent: string;
  tags: string;
  department: string;
  channel: string;
  startedAt: string;
  endedAt: string;
  subject: string;
  summary: string;
  totalTime: string;
  firstWait: string;
  avgWait: string;
  type: string;
  transfers: string;
  longestWaitDepartment: string;
  longestWait: string;
  longestWaitStart: string;
  longestWaitEnd: string;
}

export function parseDuration(value: string) {
  const parts = value.split(":").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return 0;
  return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
}

export function parseDate(value: string) {
  if (!value) return null;
  const [date, time = "00:00:00"] = value.split(" ");
  const [day, month, year] = (date ?? "").split("/").map(Number);
  const [hour, minute, second] = time.split(":").map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day, hour ?? 0, minute ?? 0, second ?? 0);
}

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 min";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (!hours) return `${minutes} min`;
  return `${hours}h ${String(minutes).padStart(2, "0")}min`;
}

export const KNOWN_BANKS = [
  "DIGIO",
  "C6",
  "HAPPY",
  "FACTA",
  "DAYCOVAL",
  "BMG",
  "ACREDTO",
  "ICRED",
  "PAN",
  "SAFRA",
  "PRESENÇABANK",
  "MASTER",
] as const;

export function detectTicketBank(ticket: Ticket): string {
  if(ticket.department?.trim()) return ticket.department.replace(/^Fila\s+/i, "").trim().toUpperCase();
  const cleanSubject = ticket.subject || "";
  const cleanTags = ticket.tags || "";
  const cleanName = ticket.name || "";
  const combined = `${cleanSubject} ${cleanTags} ${cleanName}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  // Acredto / Acredito (suporta com ou sem a letra 'i')
  if (combined.includes("ACREDTO") || combined.includes("ACREDITO")) {
    return "ACREDTO";
  }

  // Presença Bank (suporta com ç ou c)
  if (combined.includes("PRESENCABANK") || combined.includes("PRESENCA BANK")) {
    return "PRESENÇABANK";
  }

  for (const bank of KNOWN_BANKS) {
    const normBank = bank
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
    if (combined.includes(normBank)) {
      return bank;
    }
  }
  return "OUTROS";
}

export function isGroupTicket(ticket: Ticket): boolean {
  if (ticket.phone && ticket.phone.startsWith("120363")) return true;
  if (ticket.tags && /GRUPO|GRUPOS/i.test(ticket.tags)) return true;
  if (/^GRUPO|\bGRUPO\b|PARCEIROS|INFORMATIVOS/i.test(ticket.name)) return true;
  return false;
}

/**
 * Identifica se o assunto do chamado contém a categoria "COMUNICADO - RECEBIDO".
 * Ignora maiúsculas/minúsculas, acentos, variações de espaçamento e separadores (-, –, —, :, /, etc.).
 * Se houver múltiplos assuntos, retorna true se qualquer um deles for essa categoria.
 * Não exclui outros tipos de comunicado (ex: "COMUNICADO ENVIADO", "COMUNICADO INTERNO").
 */
export function isComunicadoRecebido(subject?: string): boolean {
  if (!subject || typeof subject !== "string") return false;
  const clean = subject
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (!clean) return false;

  const pattern = /(?:^|[^\w])comunicados?[\s\-_–—/:]+recebidos?(?:[^\w]|$)/;
  const reversePattern = /(?:^|[^\w])recebidos?[\s\-_–—/:]+comunicados?(?:[^\w]|$)/;

  if (pattern.test(clean) || reversePattern.test(clean)) return true;

  // Se houver múltiplos assuntos separados por ponto-e-vírgula, vírgula, barra ou quebra de linha
  const parts = clean.split(/[;\n\r|,]+/);
  if (parts.length > 1) {
    return parts.some((p) => {
      const trimmed = p.trim();
      return pattern.test(trimmed) || reversePattern.test(trimmed);
    });
  }

  return false;
}

export function isExcludedTicket(ticket: Ticket): boolean {
  return isComunicadoRecebido(ticket.subject);
}

/**
 * Lê arquivo CSV de forma segura suportando UTF-8 e Windows-1252 (comum no Excel brasileiro).
 */
export async function readFileTextSafely(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (!utf8.includes("\uFFFD")) {
    return utf8;
  }
  try {
    const latin = new TextDecoder("windows-1252").decode(buffer);
    if (!latin.includes("\uFFFD")) {
      return latin;
    }
  } catch {
    // fallback utf8
  }
  return utf8;
}

/**
 * Detecta o delimitador do CSV (; , \t |) analisando as primeiras linhas não-vazias.
 */
export function detectCsvDelimiter(text: string): string {
  const cleanText = text.replace(/^\uFEFF/, "");
  const lines = cleanText
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .slice(0, 5);
  if (!lines.length) return ";";
  const counts: Record<string, number> = { ";": 0, ",": 0, "\t": 0, "|": 0 };
  for (const line of lines) {
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i]!;
      if (char === '"') {
        quoted = !quoted;
      } else if (!quoted && counts[char] !== undefined) {
        counts[char]++;
      }
    }
  }
  let maxDelim = ";";
  let maxCount = -1;
  for (const [delim, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      maxDelim = delim;
    }
  }
  return maxDelim;
}

function cleanHeaderStr(str: string): string {
  return str
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findHeaderIndex(headers: string[], aliases: string[]): number {
  const normHeaders = headers.map(cleanHeaderStr);

  // 1. Tenta correspondência exata
  for (const alias of aliases) {
    const normAlias = cleanHeaderStr(alias);
    const idx = normHeaders.indexOf(normAlias);
    if (idx !== -1) return idx;
  }

  // 2. Tenta correspondência por palavra ou substring
  for (const alias of aliases) {
    const normAlias = cleanHeaderStr(alias);
    if (normAlias.length < 3) continue;
    const idx = normHeaders.findIndex(
      (h) => h.includes(normAlias) || (h.length >= 3 && normAlias.includes(h)),
    );
    if (idx !== -1) return idx;
  }

  return -1;
}

export function parseTicketCsv(text: string): Ticket[] {
  if (!text || !text.trim()) return [];

  const delimiter = detectCsvDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim().length > 0)) {
      rows.push(row);
    }
  }

  if (!rows.length) return [];

  const headers = rows.shift()?.map((value) => value.replace(/^\uFEFF/, "").trim()) ?? [];

  const colId = findHeaderIndex(headers, [
    "protocolo",
    "protocol",
    "id",
    "ticket",
    "codigo",
    "chamado",
    "numero do chamado",
    "n chamado",
    "nº chamado",
    "atendimento",
    "sequencial",
  ]);
  const colName = findHeaderIndex(headers, [
    "nome",
    "contato",
    "cliente",
    "name",
    "solicitante",
    "usuario",
    "nome do contato",
    "interlocutor",
  ]);
  const colPhone = findHeaderIndex(headers, [
    "numero",
    "telefone",
    "phone",
    "celular",
    "whatsapp",
    "fone",
    "tel",
    "wa_id",
    "numero do telefone",
  ]);
  const colAgent = findHeaderIndex(headers, [
    "atendente",
    "operador",
    "agente",
    "responsavel",
    "agent",
    "analista",
    "usuario",
    "nome do atendente",
  ]);
  const colTags = findHeaderIndex(headers, [
    "tags",
    "tag",
    "etiquetas",
    "etiqueta",
    "marcadores",
    "rotulos",
  ]);
  const colDept = findHeaderIndex(headers, [
    "departamento",
    "dept",
    "setor",
    "fila",
    "department",
    "equipe",
  ]);
  const colChannel = findHeaderIndex(headers, [
    "conexao",
    "canal",
    "channel",
    "tipo conexao",
    "canal de atendimento",
    "origem",
  ]);
  const colStartedAt = findHeaderIndex(headers, [
    "data de inicio",
    "inicio",
    "data inicio",
    "abertura",
    "data de abertura",
    "startedat",
    "criado em",
    "data criacao",
    "data",
    "criacao",
    "hora inicio",
  ]);
  const colEndedAt = findHeaderIndex(headers, [
    "data de encerramento",
    "encerramento",
    "fim",
    "data fim",
    "conclusao",
    "endedat",
    "finalizado em",
    "data encerramento",
    "fechado em",
  ]);
  const colSubject = findHeaderIndex(headers, [
    "assunto(s)",
    "assunto",
    "assuntos",
    "motivo",
    "subject",
    "categoria",
    "tema",
    "classificacao",
    "assunto do chamado",
  ]);
  const colSummary = findHeaderIndex(headers, [
    "resumo do chamado",
    "resumo",
    "summary",
    "descricao",
    "historico",
  ]);
  const colTotalTime = findHeaderIndex(headers, [
    "tempo total de atendimento",
    "tempo total",
    "duracao",
    "totaltime",
    "tempo de atendimento",
    "tempo",
    "duracao total",
    "tma",
  ]);
  const colFirstWait = findHeaderIndex(headers, [
    "1o tempo de espera",
    "1º tempo de espera",
    "primeiro tempo de espera",
    "tempo de espera",
    "1o tempo espera",
    "1º tempo espera",
    "firstwait",
    "espera",
    "tme",
  ]);
  const colAvgWait = findHeaderIndex(headers, [
    "tempo medio de espera",
    "tempo medio espera",
    "avgwait",
    "espera media",
  ]);
  const colType = findHeaderIndex(headers, [
    "tipo (receptivo/ativo)",
    "tipo",
    "sentido",
    "type",
    "direcao",
  ]);
  const colTransfers = findHeaderIndex(headers, [
    "transferencias",
    "transferencia",
    "transfers",
    "qtd transferencias",
    "quantidade transferencias",
  ]);
  const colLongestWaitDept = findHeaderIndex(headers, [
    "departamento com maior tempo de espera",
    "maior espera departamento",
  ]);
  const colLongestWait = findHeaderIndex(headers, ["maior tempo de espera", "maior espera"]);
  const colLongestWaitStart = findHeaderIndex(headers, [
    "inicio do maior tempo de espera",
    "inicio maior espera",
  ]);
  const colLongestWaitEnd = findHeaderIndex(headers, [
    "fim do maior tempo de espera",
    "fim maior espera",
  ]);

  const getVal = (values: string[], colIndex: number) =>
    colIndex !== -1 && values[colIndex] ? values[colIndex]!.trim() : "";

  return rows
    .map((values, idx) => {
      const explicitId = getVal(values, colId);
      const fallbackId =
        explicitId || (values[0] && values[0].trim() ? values[0].trim() : `TICKET-${idx + 1}`);

      return {
        id: fallbackId,
        name: getVal(values, colName),
        phone: getVal(values, colPhone),
        agent: getVal(values, colAgent),
        tags: getVal(values, colTags),
        department: getVal(values, colDept),
        channel: getVal(values, colChannel),
        startedAt: getVal(values, colStartedAt),
        endedAt: getVal(values, colEndedAt),
        subject: getVal(values, colSubject),
        summary: getVal(values, colSummary),
        totalTime: getVal(values, colTotalTime),
        firstWait: getVal(values, colFirstWait),
        avgWait: getVal(values, colAvgWait),
        type: getVal(values, colType),
        transfers: getVal(values, colTransfers),
        longestWaitDepartment: getVal(values, colLongestWaitDept),
        longestWait: getVal(values, colLongestWait),
        longestWaitStart: getVal(values, colLongestWaitStart),
        longestWaitEnd: getVal(values, colLongestWaitEnd),
      };
    })
    .filter(
      (ticket) =>
        ticket.id &&
        (ticket.startedAt ||
          ticket.name ||
          ticket.subject ||
          ticket.phone ||
          ticket.agent ||
          ticket.totalTime ||
          ticket.department),
    );
}
