import { describe, expect, it } from "vitest";
import {
  detectCsvDelimiter,
  detectTicketBank,
  isComunicadoRecebido,
  isExcludedTicket,
  isGroupTicket,
  parseTicketCsv,
  type Ticket,
} from "@/lib/tickets";

describe("Regra de Exclusão: COMUNICADO - RECEBIDO", () => {
  it("deve identificar a categoria exata e com variações de maiúsculas/minúsculas", () => {
    expect(isComunicadoRecebido("COMUNICADO - RECEBIDO")).toBe(true);
    expect(isComunicadoRecebido("comunicado - recebido")).toBe(true);
    expect(isComunicadoRecebido("Comunicado - Recebido")).toBe(true);
    expect(isComunicadoRecebido("COMUNICADO - recebido")).toBe(true);
  });

  it("deve identificar com variações de espaçamento e separadores", () => {
    expect(isComunicadoRecebido("COMUNICADO-RECEBIDO")).toBe(true);
    expect(isComunicadoRecebido("COMUNICADO  -  RECEBIDO")).toBe(true);
    expect(isComunicadoRecebido("COMUNICADO   RECEBIDO")).toBe(true);
    expect(isComunicadoRecebido("COMUNICADO – RECEBIDO")).toBe(true); // en-dash
    expect(isComunicadoRecebido("COMUNICADO — RECEBIDO")).toBe(true); // em-dash
    expect(isComunicadoRecebido("COMUNICADO: RECEBIDO")).toBe(true);
    expect(isComunicadoRecebido("COMUNICADO / RECEBIDO")).toBe(true);
    expect(isComunicadoRecebido("COMUNICADO/RECEBIDO")).toBe(true);
    expect(isComunicadoRecebido("COMUNICADOS - RECEBIDOS")).toBe(true);
  });

  it("deve identificar quando houver múltiplos assuntos no mesmo chamado", () => {
    expect(isComunicadoRecebido("BOLETO; COMUNICADO - RECEBIDO; BANCO DIGIO")).toBe(true);
    expect(isComunicadoRecebido("COMUNICADO - RECEBIDO, CARTAO")).toBe(true);
    expect(isComunicadoRecebido("DUVIDA / COMUNICADO - RECEBIDO / OUTROS")).toBe(true);
    expect(isComunicadoRecebido("TRANSFERENCIA | COMUNICADO - RECEBIDO")).toBe(true);
    expect(isComunicadoRecebido("CONTA CORRENTE\nCOMUNICADO - RECEBIDO")).toBe(true);
  });

  it("NÃO deve excluir outros tipos de comunicado ou termos diferentes", () => {
    expect(isComunicadoRecebido("COMUNICADO ENVIADO")).toBe(false);
    expect(isComunicadoRecebido("COMUNICADO - ENVIADO")).toBe(false);
    expect(isComunicadoRecebido("COMUNICADO INTERNO")).toBe(false);
    expect(isComunicadoRecebido("ACAO - COMUNICADO ENVIADO")).toBe(false);
    expect(isComunicadoRecebido("AVISO RECEBIDO")).toBe(false);
    expect(isComunicadoRecebido("RECEBIDO OUTROS")).toBe(false);
    expect(isComunicadoRecebido("BANCO DIGIO - CARTAO")).toBe(false);
    expect(isComunicadoRecebido("")).toBe(false);
    expect(isComunicadoRecebido(undefined)).toBe(false);
  });
});

describe("Importação e Atualização Dinâmica de CSV", () => {
  it("deve detectar delimitadores de CSV com precisão", () => {
    expect(detectCsvDelimiter("Protocolo;Nome;Assunto\n1;João;Dúvida")).toBe(";");
    expect(detectCsvDelimiter("Protocolo,Nome,Assunto\n1,João,Dúvida")).toBe(",");
    expect(detectCsvDelimiter("Protocolo\tNome\tAssunto\n1\tJoão\tDúvida")).toBe("\t");
  });

  it("deve carregar novo CSV e classificar elegíveis e excluídos dinamicamente", () => {
    const csvContent = [
      "Protocolo;Nome;Telefone;Atendente;Departamento;Assunto(s);Tempo total;Tipo",
      "1001;Carlos Silva;551199999999;Ana;Atendimento;COMUNICADO - RECEBIDO;00:10:00;Receptivo",
      "1002;Mariana Dias;551188888888;Bruno;Comercial;BANCO DIGIO - CARTAO;00:05:00;Receptivo",
      '1003;Grupo Parceiros;120363143151283695;Ana;Atendimento;"BOLETO; COMUNICADO - RECEBIDO";00:15:00;Receptivo',
      "1004;Fernando Costa;551177777777;Carla;Suporte;COMUNICADO - ENVIADO;00:08:00;Ativo",
    ].join("\n");

    const parsed = parseTicketCsv(csvContent);
    expect(parsed).toHaveLength(4);

    const excluded = parsed.filter(isExcludedTicket);
    const eligible = parsed.filter((t) => !isExcludedTicket(t));

    // Tickets 1001 e 1003 possuem "COMUNICADO - RECEBIDO"
    expect(excluded).toHaveLength(2);
    expect(excluded.map((t) => t.id)).toEqual(["1001", "1003"]);

    // Tickets 1002 e 1004 são elegíveis (1004 é COMUNICADO - ENVIADO, não deve ser excluído)
    expect(eligible).toHaveLength(2);
    expect(eligible.map((t) => t.id)).toEqual(["1002", "1004"]);

    // Validação de detecção de banco e grupo nos elegíveis
    expect(detectTicketBank(eligible[0]!)).toBe("DIGIO");
    expect(isGroupTicket(eligible[0]!)).toBe(false);
  });

  it("deve detectar Banco Acredto tanto como ACREDTO quanto como ACREDITO", () => {
    const baseTicket: Ticket = {
      id: "1",
      name: "",
      phone: "",
      agent: "",
      tags: "",
      department: "",
      channel: "",
      startedAt: "",
      endedAt: "",
      subject: "",
      summary: "",
      totalTime: "",
      firstWait: "",
      avgWait: "",
      type: "",
      transfers: "",
      longestWaitDepartment: "",
      longestWait: "",
      longestWaitStart: "",
      longestWaitEnd: "",
    };

    expect(
      detectTicketBank({
        ...baseTicket,
        subject: "OPERACIONAL - PRIORIDADE | BANCO ACREDTO",
      }),
    ).toBe("ACREDTO");

    expect(
      detectTicketBank({
        ...baseTicket,
        subject: "OPERACIONAL - PRIORIDADE | BANCO ACREDITO",
      }),
    ).toBe("ACREDTO");

    expect(
      detectTicketBank({
        ...baseTicket,
        name: "ACREDTO & Cred Capital",
        subject: "SUPORTE",
      }),
    ).toBe("ACREDTO");
  });
});
