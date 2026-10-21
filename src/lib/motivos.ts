import {
  isExcludedTicket,
  parseDate,
  parseDuration,
  detectTicketBank,
  type Ticket,
} from "./tickets";
import { isAttendanceTimeEligible, summarizeAttendanceTime } from "./attendance-time";
/** O assunto traz etiquetas de banco e motivo, em qualquer ordem. Cada chamado conta uma vez. */
export function motivoAcionamento(subject: string) {
  const motivos = [
    ...new Set(
      (subject || "")
        .split("|")
        .map((s) =>
          s
            .trim()
            .replace(/\s+/g, " ")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase(),
        )
        .filter((s) => s && !/^BANCO\s+/.test(s)),
    ),
  ].sort();
  return motivos.join(" | ") || "SEM MOTIVO INFORMADO";
}
export function analisarMotivos(tickets: Ticket[]) {
  const elegiveis = tickets.filter((t) => !isExcludedTicket(t));
  const grupos = new Map<string, { name: string; count: number; seconds: number; timeCount: number }>();
  const bancos = new Map<string, number>();
  const dias = new Map<string, number>();
  for (const t of elegiveis) {
    const name = motivoAcionamento(t.subject);
    const grupo = grupos.get(name) || { name, count: 0, seconds: 0, timeCount: 0 };
    grupo.count++;
    if (isAttendanceTimeEligible(t)) {
      grupo.seconds += parseDuration(t.totalTime);
      grupo.timeCount++;
    }
    grupos.set(name, grupo);
    const bank = detectTicketBank(t);
    bancos.set(bank, (bancos.get(bank) || 0) + 1);
    const d = parseDate(t.startedAt);
    if (d) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      dias.set(k, (dias.get(k) || 0) + 1);
    }
  }
  return {
    total: elegiveis.length,
    ranking: [...grupos.values()]
      .map((g) => ({
        ...g,
        pct: elegiveis.length ? (g.count / elegiveis.length) * 100 : 0,
        tma: g.timeCount ? g.seconds / g.timeCount : 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    bancos: [...bancos].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    dias: [...dias]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count })),
    tma: summarizeAttendanceTime(elegiveis).average,
  };
}
