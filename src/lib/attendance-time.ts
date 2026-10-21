import { parseDuration, type Ticket } from "./tickets";

/** Only service-time metrics exclude these agents; volume and wait metrics retain them. */
export function isAttendanceTimeEligible(ticket: Pick<Ticket, "agent"> & Partial<Pick<Ticket, "totalTime">>): boolean {
  const name = (ticket.agent || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  return Boolean(ticket.totalTime) && !/^(tawane|leonardo)(?:\s|$)/.test(name);
}

export function summarizeAttendanceTime(tickets: Ticket[]) {
  const eligible = tickets.filter(isAttendanceTimeEligible);
  const seconds = eligible.reduce((sum, ticket) => sum + parseDuration(ticket.totalTime), 0);
  return { count: eligible.length, seconds, average: eligible.length ? seconds / eligible.length : 0 };
}