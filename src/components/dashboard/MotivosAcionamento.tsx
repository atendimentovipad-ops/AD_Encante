import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { analisarMotivos } from "@/lib/motivos";
import { formatDuration, type Ticket } from "@/lib/tickets";
import { Button } from "@/components/ui/button";
const cores = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#06b6d4", "#84cc16"];
export function MotivosAcionamento({
  tickets,
  onMotivo,
}: {
  tickets: Ticket[];
  onMotivo: (motivo: string) => void;
}) {
  const dados = useMemo(() => analisarMotivos(tickets), [tickets]);
  const top = dados.ranking.slice(0, 10);
  const outros = dados.ranking.slice(10).reduce((s, v) => s + v.count, 0);
  const distribuicao = [...top, ...(outros ? [{ name: "Demais motivos", count: outros }] : [])];
  function exportar() {
    const csv = [
      ["Motivo", "Acionamentos", "Participação %", "TMA segundos"],
      ...dados.ranking.map((r) => [
        r.name,
        r.count,
        r.pct.toFixed(2).replace(".", ","),
        Math.round(r.tma),
      ]),
    ]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "motivos-acionamento.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  const painel = "rounded-lg border bg-card p-4 shadow-sm";
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Motivos de acionamento</h2>
          <p className="text-xs text-muted-foreground">
            Assuntos agrupados sem as etiquetas de banco. Cada chamado é contado uma vez.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportar} disabled={!dados.total}>
          Exportar relatório
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Acionamentos", dados.total.toLocaleString("pt-BR")],
          ["Motivos distintos", dados.ranking.length],
          ["TMA", formatDuration(dados.tma)],
        ].map(([label, value]) => (
          <div className={painel} key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      {!dados.total ? (
        <div className={painel}>Nenhum atendimento elegível para os filtros selecionados.</div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className={painel}>
              <h3 className="mb-3 text-sm font-semibold">Principais motivos — até 10</h3>
              <div className="h-[380px]">
                <ResponsiveContainer>
                  <BarChart data={top} layout="vertical" margin={{ left: 5, right: 20 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      name="Acionamentos"
                      fill={cores[0]}
                      onClick={(v) => onMotivo(v.name)}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={painel}>
              <h3 className="mb-3 text-sm font-semibold">Participação dos motivos</h3>
              <div className="h-[380px]">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={distribuicao}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={70}
                      outerRadius={120}
                    >
                      {distribuicao.map((v, i) => (
                        <Cell key={v.name} fill={cores[i % cores.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={painel}>
              <h3 className="mb-3 text-sm font-semibold">
                Evolução diária dos motivos selecionados
              </h3>
              <div className="h-[260px]">
                <ResponsiveContainer>
                  <LineChart data={dados.dias}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line dataKey="count" name="Acionamentos" stroke={cores[0]} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className={painel}>
              <h3 className="mb-3 text-sm font-semibold">
                Bancos acionados nos motivos selecionados
              </h3>
              <div className="h-[260px]">
                <ResponsiveContainer>
                  <BarChart data={dados.bancos}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Acionamentos" fill={cores[1]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className={painel}>
            <h3 className="mb-3 text-sm font-semibold">Todos os motivos — clique para filtrar</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="p-2 text-left">Motivo</th>
                    <th>Acionamentos</th>
                    <th>Participação</th>
                    <th>TMA</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.ranking.map((r) => (
                    <tr key={r.name} className="border-t">
                      <td className="p-2">
                        <button
                          className="text-left text-primary hover:underline"
                          onClick={() => onMotivo(r.name)}
                        >
                          {r.name}
                        </button>
                      </td>
                      <td className="text-center">{r.count}</td>
                      <td className="text-center">{r.pct.toFixed(1).replace(".", ",")}%</td>
                      <td className="text-center">{formatDuration(r.tma)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
