import { describe, expect, it } from "vitest";
import rawTickets from "../../public/data.json";
import { isComunicadoRecebido, isExcludedTicket, type Ticket } from "@/lib/tickets";

describe("Exclusão centralizada de COMUNICADO - RECEBIDO", () => {
  describe("1. Registros com apenas essa categoria", () => {
    it("identifica 'COMUNICADO - RECEBIDO' em maiúsculas", () => {
      expect(isComunicadoRecebido("COMUNICADO - RECEBIDO")).toBe(true);
    });

    it("identifica variações em minúsculas e capitalização mista", () => {
      expect(isComunicadoRecebido("comunicado - recebido")).toBe(true);
      expect(isComunicadoRecebido("Comunicado - Recebido")).toBe(true);
      expect(isComunicadoRecebido("cOmUnIcAdO - rEcEbIdO")).toBe(true);
    });

    it("identifica sem espaços ou com hífens colados", () => {
      expect(isComunicadoRecebido("COMUNICADO-RECEBIDO")).toBe(true);
      expect(isComunicadoRecebido("comunicado-recebido")).toBe(true);
    });
  });

  describe("2. Variações de escrita, espaços extras e separadores", () => {
    it("identifica com múltiplos espaços", () => {
      expect(isComunicadoRecebido("COMUNICADO    -    RECEBIDO")).toBe(true);
      expect(isComunicadoRecebido("  COMUNICADO - RECEBIDO  ")).toBe(true);
    });

    it("identifica diferentes tipos de traços (en-dash, em-dash)", () => {
      expect(isComunicadoRecebido("COMUNICADO – RECEBIDO")).toBe(true); // en-dash
      expect(isComunicadoRecebido("COMUNICADO — RECEBIDO")).toBe(true); // em-dash
    });

    it("identifica com outros separadores (barra, dois pontos, apenas espaço)", () => {
      expect(isComunicadoRecebido("COMUNICADO / RECEBIDO")).toBe(true);
      expect(isComunicadoRecebido("COMUNICADO: RECEBIDO")).toBe(true);
      expect(isComunicadoRecebido("COMUNICADO RECEBIDO")).toBe(true);
      expect(isComunicadoRecebido("comunicado  recebido")).toBe(true);
    });

    it("identifica com acentuação se houver", () => {
      expect(isComunicadoRecebido("COMUNICADO - RECEBÍDO")).toBe(true);
    });
  });

  describe("3. Múltiplos assuntos no mesmo chamado", () => {
    it("exclui o chamado se 'COMUNICADO - RECEBIDO' for um dos assuntos com pipe |", () => {
      expect(isComunicadoRecebido("COMUNICADO - RECEBIDO | BANCO FACTA")).toBe(true);
      expect(isComunicadoRecebido("BANCO HAPPY | COMUNICADO - RECEBIDO")).toBe(true);
      expect(isComunicadoRecebido("BANCO DAYCOVAL | COMUNICADO - RECEBIDO | SUPORTE")).toBe(true);
    });

    it("exclui com outros separadores de múltiplos assuntos (ponto e vírgula, barra)", () => {
      expect(isComunicadoRecebido("OPERACIONAL - DUVIDAS; COMUNICADO - RECEBIDO")).toBe(true);
      expect(isComunicadoRecebido("COMUNICADO - RECEBIDO / BANCO C6")).toBe(true);
    });
  });

  describe("4. Preservação de outros tipos de comunicados e assuntos diferentes", () => {
    it("NÃO exclui 'ACAO - COMUNICADO ENVIADO'", () => {
      expect(isComunicadoRecebido("ACAO - COMUNICADO ENVIADO")).toBe(false);
      expect(isComunicadoRecebido("BANCO HAPPY | ACAO - COMUNICADO ENVIADO")).toBe(false);
      expect(isComunicadoRecebido("ACAO - COMUNICADO ENVIADO | BANCO DIGIO")).toBe(false);
      expect(isComunicadoRecebido("ACAO - COMUNICADO ENVIADO | BANCO C6")).toBe(false);
      expect(isComunicadoRecebido("ACAO - COMUNICADO ENVIADO | BANCO FACTA")).toBe(false);
    });

    it("NÃO exclui comunicados gerais ou internos", () => {
      expect(isComunicadoRecebido("COMUNICADO ENVIADO")).toBe(false);
      expect(isComunicadoRecebido("COMUNICADO INTERNO")).toBe(false);
      expect(isComunicadoRecebido("COMUNICADO GERAL")).toBe(false);
      expect(isComunicadoRecebido("COMUNICADO URGENTE")).toBe(false);
    });

    it("NÃO exclui outros assuntos operacionais", () => {
      expect(isComunicadoRecebido("OPERACIONAL - DUVIDAS DE DIGITACAO | BANCO DIGIO")).toBe(false);
      expect(isComunicadoRecebido("AGRADECIMENTO")).toBe(false);
      expect(isComunicadoRecebido("INATIVIDADE")).toBe(false);
      expect(isComunicadoRecebido("SUPORTE SOLICITADO - BANCO")).toBe(false);
    });
  });

  describe("5. Consistência e integridade sobre a base de dados real", () => {
    const allTickets = rawTickets as Ticket[];

    it("divide perfeitamente a base em elegíveis e excluídos", () => {
      const eligible = allTickets.filter((t) => !isExcludedTicket(t));
      const excluded = allTickets.filter((t) => isExcludedTicket(t));

      expect(eligible.length + excluded.length).toBe(allTickets.length);
      expect(excluded.length).toBeGreaterThan(0);
      expect(eligible.length).toBeGreaterThan(0);

      // Todos os excluídos devem possuir o assunto correspondente
      for (const t of excluded) {
        expect(isComunicadoRecebido(t.subject)).toBe(true);
      }

      // Nenhum elegível pode ter o assunto comunicado recebido
      for (const t of eligible) {
        expect(isComunicadoRecebido(t.subject)).toBe(false);
      }
    });

    it("mantém todos os registros originais acessíveis para consulta e auditoria", () => {
      expect(allTickets.length).toBe(3944);
    });
  });
});
