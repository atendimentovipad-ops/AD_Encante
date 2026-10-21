import { describe, it, expect } from "vitest";
import { analisarMotivos, motivoAcionamento } from "../lib/motivos";
import type { Ticket } from "../lib/tickets";
const ticket = (subject: string, totalTime = "00:10:00") =>
  ({
    subject,
    totalTime,
    startedAt: "07/10/2026 10:00:00",
    tags: "",
    name: "",
    phone: "",
  }) as Ticket;
describe("Análise por motivo", () => {
  it("agrupa assuntos equivalentes sem confundir banco e motivo", () => {
    expect(motivoAcionamento("BANCO C6 | OPERACIONAL - DÚVIDAS")).toBe(
      motivoAcionamento("operacional - duvidas | BANCO DIGIO"),
    );
  });
  it("preserva múltiplos motivos sem contar o chamado duas vezes", () => {
    const a = analisarMotivos([ticket("PRIORIDADE | DUVIDAS | BANCO C6")]);
    expect(a.total).toBe(1);
    expect(a.ranking[0]?.count).toBe(1);
  });
  it("exclui comunicados recebidos e calcula contagem, percentual e TMA reais", () => {
    const a = analisarMotivos([
      ticket("DUVIDAS | BANCO C6"),
      ticket("BANCO DIGIO | DUVIDAS", "00:20:00"),
      ticket("COMUNICADO - RECEBIDO"),
    ]);
    expect(a.total).toBe(2);
    expect(a.ranking).toHaveLength(1);
    expect(a.ranking[0]?.pct).toBe(100);
    expect(a.tma).toBe(900);
    expect(a.dias[0]?.count).toBe(2);
    expect(a.bancos).toHaveLength(2);
  });
  it("trata base vazia e motivo ausente", () => {
    expect(analisarMotivos([]).total).toBe(0);
    expect(motivoAcionamento("")).toBe("SEM MOTIVO INFORMADO");
  });
  it("mantém Tawane e Leonardo nas contagens mas não no TMA por motivo", () => {
    const a = analisarMotivos([
      { ...ticket("DUVIDAS | BANCO C6", "01:00:00"), agent: "Tawane Michelle" },
      { ...ticket("DUVIDAS | BANCO C6", "02:00:00"), agent: "Leonardo Santos" },
      { ...ticket("DUVIDAS | BANCO C6", "00:10:00"), agent: "Karine Almeida" },
    ]);
    expect(a.total).toBe(3);
    expect(a.ranking[0]?.count).toBe(3);
    expect(a.ranking[0]?.pct).toBe(100);
    expect(a.ranking[0]?.tma).toBe(600);
    expect(a.tma).toBe(600);
    expect(a.bancos[0]?.count).toBe(3);
    expect(a.dias[0]?.count).toBe(3);
  });
});
