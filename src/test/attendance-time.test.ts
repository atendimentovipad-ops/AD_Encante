import { describe, expect, it } from "vitest";
import { isAttendanceTimeEligible, summarizeAttendanceTime } from "../lib/attendance-time";
import type { Ticket } from "../lib/tickets";

const ticket = (agent: string, totalTime: string) => ({ agent, totalTime }) as Ticket;

describe("Exclusões do tempo de atendimento", () => {
  it.each(["Tawane", "Tawane Michelle", " TAWANE MICHELLE ", "Leonardo", "Leonardo Santos"])(
    "exclui %s da soma e do denominador",
    (agent) => {
      const rows = [ticket(agent, "02:00:00"), ticket("Karine Almeida", "00:10:00")];
      expect(isAttendanceTimeEligible(rows[0] ?? { agent: "" })).toBe(false);
      expect(summarizeAttendanceTime(rows)).toEqual({ count: 1, seconds: 600, average: 600 });
      expect(rows).toHaveLength(2);
    },
  );
  it("mantém os demais atendentes e registros sem atendente", () => {
    expect(summarizeAttendanceTime([ticket("André Lima", "00:10:00"), ticket("", "00:20:00")]))
      .toEqual({ count: 2, seconds: 1800, average: 900 });
  });
  it("retorna zero quando só há atendentes excluídos", () => {
    expect(summarizeAttendanceTime([ticket("Tawane Michelle", "01:00:00"), ticket("Leonardo Santos", "02:00:00")]))
      .toEqual({ count: 0, seconds: 0, average: 0 });
  });
});