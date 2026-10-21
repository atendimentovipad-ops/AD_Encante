import DDDAnalysis from '@/components/dashboard/DDDAnalysis';
import HourlyUFLeaders from '@/components/dashboard/HourlyUFLeaders';
import UFAnalysis from '@/components/dashboard/UFAnalysis';
import QuarterComparison from '@/components/dashboard/QuarterComparison';
import {saveImportedTickets,getSavedImportedTickets,clearImportedTickets} from '@/lib/ticket-storage';
import { motivoAcionamento } from "@/lib/motivos";
import { isAttendanceTimeEligible } from "@/lib/attendance-time";
import { MotivosAcionamento } from "@/components/dashboard/MotivosAcionamento";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileUp,
  Headphones,
  Inbox,
  Info,
  LayoutDashboard,
  Layers,
  Menu,
  MessageCircle,
  Phone,
  Search,
  SlidersHorizontal,
  TrendingUp,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";

import {
  detectTicketBank,
  formatDuration,
  isExcludedTicket,
  isGroupTicket,
  KNOWN_BANKS,
  parseDate,
  parseDuration,
  parseTicketCsv,
  readFileTextSafely,
  type Ticket,
} from "@/lib/tickets";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

let INITIAL_TICKETS: Ticket[] = [];
const PAGE_SIZE = 12;

const CHART_COLORS = [
  "oklch(0.56 0.16 252)", // Azul primário
  "oklch(0.62 0.15 170)", // Verde esmeralda
  "oklch(0.68 0.16 72)", // Âmbar / dourado
  "oklch(0.62 0.18 26)", // Coral / laranja
  "oklch(0.55 0.18 310)", // Púrpura / magenta
  "oklch(0.52 0.14 200)", // Turquesa
  "oklch(0.60 0.14 130)", // Lima
  "oklch(0.48 0.12 280)", // Violeta
  "oklch(0.65 0.12 40)", // Terra
  "oklch(0.58 0.10 240)", // Índigo suave
  "oklch(0.50 0.08 190)", // Azul ardósia
  "oklch(0.60 0.06 250)", // Cinza neutro
];

const WEEK_DAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

type SortKey = "startedAt" | "totalTime";
type ActiveTab = "ddd" | "horarios-uf" | "uf" | "trimestral" | "motivos" | "todos" | "bancos" | "origem" | "tempos" | "dias" | "chamados";

const normalize = (value: string) => value.trim() || "Não informado";

const dateKey = (value: string) => {
  const date = parseDate(value);
  return date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : "";
};

const compactDate = (key: string) => {
  const [, month, day] = key.split("-");
  return `${day}/${month}`;
};

const percentage = (value: number) =>
  `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export default function Dashboard() {
  const [tickets, setTickets] = useState(INITIAL_TICKETS);
  const [importing,setImporting]=useState(false);
  useEffect(()=>{Promise.all([fetch('/data.json').then(r=>{if(!r.ok)throw Error('Falha ao carregar base inicial');return r.json();}),getSavedImportedTickets()]).then(([seed,saved])=>{INITIAL_TICKETS=seed;setTickets(saved?.tickets||seed);if(saved)setImportedFileName(saved.metadata.filename);}).catch(()=>toast.error('Falha ao carregar a base. Importe a planilha novamente.'));},[]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("todos");
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [importedAt, setImportedAt] = useState<Date | null>(null);

  // Filtros
  const [motivoFilter, setMotivoFilter] = useState("__todos_motivos__");
  const motivosDisponiveis = useMemo(
    () =>
      [
        ...new Set(
          tickets.filter((t) => !isExcludedTicket(t)).map((t) => motivoAcionamento(t.subject)),
        ),
      ].sort(),
    [tickets],
  );
  const [search, setSearch] = useState("");
  const [agent, setAgent] = useState("todos");
  const [department, setDepartment] = useState("todos");
  const [type, setType] = useState("todos");
  const [period, setPeriod] = useState("todos");
  const [bankFilter, setBankFilter] = useState("todos");
  const [originFilter, setOriginFilter] = useState<"todos" | "grupo" | "pessoa">("todos");

  // Paginação e ordenação da tabela
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("startedAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Lista de bancos disponíveis a partir dos dados
  const availableBanks = useMemo(() => {
    const banks = new Set<string>();
    tickets.forEach((t) => banks.add(detectTicketBank(t)));
    return [...banks].sort((a,b)=>a.localeCompare(b));
  }, [tickets]);

  // Lista de atendentes e departamentos
  const options = useMemo(
    () => ({
      agents: [...new Set(tickets.map((t) => normalize(t.agent)))].filter((a) => a !== "").sort(),
      departments: [...new Set(tickets.map((t) => normalize(t.department)))].sort(),
      types: [...new Set(tickets.map((t) => normalize(t.type)))].filter((tp) => tp !== "").sort(),
    }),
    [tickets],
  );

  // Intervalo de datas da base
  const range = useMemo(() => {
    const values = tickets
      .map((t) => parseDate(t.startedAt))
      .filter((date): date is Date => Boolean(date));
    if (!values.length) return "Base sem período";
    const min = new Date(values.reduce((min,d)=>Math.min(min,+d),Infinity));
    const max = new Date(values.reduce((max,d)=>Math.max(max,+d),0));
    const format = (date: Date) =>
      date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    return `${format(min)} — ${format(max)} ${max.getFullYear()}`;
  }, [tickets]);

  // Filtro de auditoria na tabela de registros
  const [tableAuditView, setTableAuditView] = useState<"elegiveis" | "todos" | "excluidos">(
    "elegiveis",
  );

  // Todos os chamados que atendem aos filtros ativos
  const filteredAll = useMemo(() => {
    const latest = tickets.reduce((max,t)=>Math.max(max,parseDate(t.startedAt)?.getTime() ?? 0),0);
    const cutoff =
      period === "7" ? latest - 7 * 86400000 : period === "30" ? latest - 30 * 86400000 : 0;
    const term = search.trim().toLocaleLowerCase("pt-BR");

    return tickets.filter((t) => {
      const ticketBank = detectTicketBank(t);
      const isGroup = isGroupTicket(t);
      const bankAliases =
        ticketBank === "ACREDTO" ? "acredto acredito banco acredito" : ticketBank.toLowerCase();
      const haystack =
        `${t.id} ${t.name} ${t.phone} ${t.subject} ${t.tags} ${ticketBank} ${bankAliases}`.toLocaleLowerCase(
          "pt-BR",
        );

      return (
        (!term || haystack.includes(term)) &&
        (motivoFilter === "__todos_motivos__" || motivoAcionamento(t.subject) === motivoFilter) &&
        (agent === "todos" || normalize(t.agent) === agent) &&
        (department === "todos" || normalize(t.department) === department) &&
        (type === "todos" || normalize(t.type) === type) &&
        (bankFilter === "todos" || ticketBank === bankFilter) &&
        (originFilter === "todos" || (originFilter === "grupo" ? isGroup : !isGroup)) &&
        (!cutoff || (parseDate(t.startedAt)?.getTime() ?? 0) >= cutoff)
      );
    });
  }, [tickets, search, agent, department, type, period, bankFilter, originFilter, motivoFilter]);

  // Chamados desconsiderados da análise (categoria COMUNICADO - RECEBIDO)
  const excludedFiltered = useMemo(
    () => filteredAll.filter((t) => isExcludedTicket(t)),
    [filteredAll],
  );

  // Chamados elegíveis para análises, indicadores, gráficos e rankings
  const eligible = useMemo(() => filteredAll.filter((t) => !isExcludedTicket(t)), [filteredAll]);

  // ==========================================
  // COMPARATIVO 1: QUANTOS ATENDIMENTOS
  // ==========================================
  const metricsVolume = useMemo(() => {
    const total = eligible.length;
    const closed = eligible.filter((t) => t.endedAt).length;
    const open = total - closed;
    const receptive = eligible.filter((t) => t.type?.toLowerCase().includes("receptivo")).length;
    const active = eligible.filter((t) => t.type?.toLowerCase().includes("ativo")).length;
    const otherType = total - receptive - active;
    const transferred = eligible.filter((t) => t.transfers && t.transfers.trim() !== "0").length;

    const channelsMap = new Map<string, number>();
    eligible.forEach((t) => {
      const ch = normalize(t.channel);
      channelsMap.set(ch, (channelsMap.get(ch) ?? 0) + 1);
    });
    const channels = [...channelsMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      closed,
      closedPct: total ? (closed / total) * 100 : 0,
      open,
      openPct: total ? (open / total) * 100 : 0,
      receptive,
      receptivePct: total ? (receptive / total) * 100 : 0,
      active,
      activePct: total ? (active / total) * 100 : 0,
      otherType,
      transferred,
      transferRate: total ? (transferred / total) * 100 : 0,
      channels,
    };
  }, [eligible]);

  // ==========================================
  // COMPARATIVO 2: QUAIS BANCOS MAIS TEVE ACIONAMENTO
  // ==========================================
  const bankComparisons = useMemo(() => {
    const map = new Map<
      string,
      { count: number; timeCount: number; totalSeconds: number; closed: number; waitSeconds: number; groups: number; persons: number }
    >();

    eligible.forEach((t) => {
      const bank = detectTicketBank(t);
      const current = map.get(bank) ?? {
        count: 0,
        timeCount: 0,
        totalSeconds: 0,
        closed: 0,
        waitSeconds: 0,
        groups: 0,
        persons: 0,
      };
      current.count += 1;
      if (isAttendanceTimeEligible(t)) {
        current.totalSeconds += parseDuration(t.totalTime);
        current.timeCount += 1;
      }
      current.waitSeconds += parseDuration(t.firstWait);
      if (t.endedAt) current.closed += 1;
      if (isGroupTicket(t)) current.groups += 1;
      else current.persons += 1;
      map.set(bank, current);
    });

    const total = eligible.length || 1;
    const list = [...map.entries()]
      .map(([name, data]) => ({
        name,
        count: data.count,
        pct: (data.count / total) * 100,
        avgMinutes: Math.round(data.timeCount ? data.totalSeconds / data.timeCount / 60 : 0),
        avgDurationSec: data.timeCount ? data.totalSeconds / data.timeCount : 0,
        avgDurationFormatted: formatDuration(data.timeCount ? data.totalSeconds / data.timeCount : 0),
        avgWaitFormatted: formatDuration(data.count ? data.waitSeconds / data.count : 0),
        closedRate: data.count ? (data.closed / data.count) * 100 : 0,
        groups: data.groups,
        persons: data.persons,
      }))
      .sort((a, b) => b.count - a.count);

    const topBank = list[0];

    return {
      list,
      topBank,
      totalCount: total,
    };
  }, [eligible]);

  // ==========================================
  // COMPARATIVO 3: QUEM MAIS ACIONOU (GRUPO / PESSOA)
  // ==========================================
  const originComparisons = useMemo(() => {
    let groupCount = 0;
    let personCount = 0;
    let groupTotalSec = 0;
    let personTotalSec = 0;
    let groupTimeCount = 0;
    let personTimeCount = 0;

    const groupMap = new Map<
      string,
      { count: number; timeCount: number; totalSec: number; bank: string; phone: string }
    >();
    const personMap = new Map<
      string,
      { count: number; timeCount: number; totalSec: number; bank: string; phone: string }
    >();

    eligible.forEach((t) => {
      const isGroup = isGroupTicket(t);
      const name = t.name.trim() || (isGroup ? "Grupo sem nome" : "Contato sem nome");
      const timeEligible = isAttendanceTimeEligible(t);
      const duration = timeEligible ? parseDuration(t.totalTime) : 0;
      const bank = detectTicketBank(t);

      if (isGroup) {
        groupCount += 1;
        groupTotalSec += duration;
        if (timeEligible) groupTimeCount += 1;
        const cur = groupMap.get(name) ?? { count: 0, timeCount: 0, totalSec: 0, bank, phone: t.phone };
        cur.count += 1;
        if (timeEligible) cur.timeCount += 1;
        cur.totalSec += duration;
        groupMap.set(name, cur);
      } else {
        personCount += 1;
        personTotalSec += duration;
        if (timeEligible) personTimeCount += 1;
        const cur = personMap.get(name) ?? { count: 0, timeCount: 0, totalSec: 0, bank, phone: t.phone };
        cur.count += 1;
        if (timeEligible) cur.timeCount += 1;
        cur.totalSec += duration;
        personMap.set(name, cur);
      }
    });

    const total = eligible.length || 1;
    const groupPct = (groupCount / total) * 100;
    const personPct = (personCount / total) * 100;

    const topGroups = [...groupMap.entries()]
      .map(([name, data]) => ({
        name,
        count: data.count,
        pct: (data.count / total) * 100,
        avgDuration: formatDuration(data.timeCount ? data.totalSec / data.timeCount : 0),
        bank: data.bank,
        phone: data.phone,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topPersons = [...personMap.entries()]
      .map(([name, data]) => ({
        name,
        count: data.count,
        pct: (data.count / total) * 100,
        avgDuration: formatDuration(data.timeCount ? data.totalSec / data.timeCount : 0),
        bank: data.bank,
        phone: data.phone,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const pieData = [
      { name: "Grupos de WhatsApp", value: groupCount, color: "oklch(0.56 0.16 252)" },
      { name: "Contatos / Pessoas", value: personCount, color: "oklch(0.62 0.15 170)" },
    ];

    return {
      groupCount,
      groupPct,
      groupAvgDuration: formatDuration(groupTimeCount ? groupTotalSec / groupTimeCount : 0),
      uniqueGroups: groupMap.size,
      personCount,
      personPct,
      personAvgDuration: formatDuration(personTimeCount ? personTotalSec / personTimeCount : 0),
      uniquePersons: personMap.size,
      topGroups,
      topPersons,
      pieData,
    };
  }, [eligible]);

  // ==========================================
  // COMPARATIVO 4: TEMPO DE ATENDIMENTO
  // ==========================================
  const timeComparisons = useMemo(() => {
    let totalSeconds = 0;
    let waitSeconds = 0;
    let maxSeconds = 0;
    let maxTicket: Ticket | null = null;
    const timeEligible = eligible.filter(isAttendanceTimeEligible);

    // Faixas de tempo de atendimento
    const buckets = {
      under5m: 0,
      m5to15: 0,
      m15to30: 0,
      m30to60: 0,
      over60m: 0,
    };

    timeEligible.forEach((t) => {
      const dur = parseDuration(t.totalTime);
      totalSeconds += dur;
      if (dur > maxSeconds) {
        maxSeconds = dur;
        maxTicket = t;
      }

      if (dur < 300) buckets.under5m += 1;
      else if (dur < 900) buckets.m5to15 += 1;
      else if (dur < 1800) buckets.m15to30 += 1;
      else if (dur < 3600) buckets.m30to60 += 1;
      else buckets.over60m += 1;
    });

    waitSeconds = eligible.reduce((sum, t) => sum + parseDuration(t.firstWait), 0);
    const count = timeEligible.length || 1;
    const avgTotal = totalSeconds / count;
    const avgWait = waitSeconds / (eligible.length || 1);
    const fastResolutionPct = ((buckets.under5m + buckets.m5to15) / count) * 100;
    const totalHours = Math.round(totalSeconds / 3600);

    const bucketList = [
      {
        faixa: "Até 5 min",
        label: "Resolutivos rápidos",
        count: buckets.under5m,
        pct: (buckets.under5m / count) * 100,
        fill: "oklch(0.62 0.15 170)",
      },
      {
        faixa: "5 a 15 min",
        label: "Atendimento ágil",
        count: buckets.m5to15,
        pct: (buckets.m5to15 / count) * 100,
        fill: "oklch(0.56 0.16 252)",
      },
      {
        faixa: "15 a 30 min",
        label: "Intermediário",
        count: buckets.m15to30,
        pct: (buckets.m15to30 / count) * 100,
        fill: "oklch(0.68 0.16 72)",
      },
      {
        faixa: "30 a 60 min",
        label: "Extenso",
        count: buckets.m30to60,
        pct: (buckets.m30to60 / count) * 100,
        fill: "oklch(0.62 0.18 26)",
      },
      {
        faixa: "Mais de 1h",
        label: "Complexo / Longo",
        count: buckets.over60m,
        pct: (buckets.over60m / count) * 100,
        fill: "oklch(0.55 0.18 310)",
      },
    ];

    // Tempo por Atendente (Top atendentes)
    const agentTimes = new Map<string, { count: number; totalSec: number }>();
    timeEligible.forEach((t) => {
      const ag = normalize(t.agent);
      if (ag && ag !== "Não informado") {
        const cur = agentTimes.get(ag) ?? { count: 0, totalSec: 0 };
        cur.count += 1;
        cur.totalSec += parseDuration(t.totalTime);
        agentTimes.set(ag, cur);
      }
    });

    const agentRank = [...agentTimes.entries()]
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgMinutes: Math.round(data.totalSec / data.count / 60),
        avgDurationFormatted: formatDuration(data.totalSec / data.count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      avgTotal,
      avgTotalFormatted: formatDuration(avgTotal),
      avgWaitFormatted: formatDuration(avgWait),
      totalHours,
      fastResolutionPct,
      maxFormatted: formatDuration(maxSeconds),
      maxTicket,
      bucketList,
      agentRank,
    };
  }, [eligible]);

  // ==========================================
  // COMPARATIVO 5: QUANTOS DE ATENDIMENTO POR DIA
  // ==========================================
  const dailyComparisons = useMemo(() => {
    const dayMap = new Map<string, { count: number; timeCount: number; totalSec: number }>();
    const weekdayMap = [0, 0, 0, 0, 0, 0, 0];
    const hourMap = new Map<string, number>();

    eligible.forEach((t) => {
      const key = dateKey(t.startedAt);
      if (key) {
        const cur = dayMap.get(key) ?? { count: 0, timeCount: 0, totalSec: 0 };
        cur.count += 1;
        if (isAttendanceTimeEligible(t)) {
          cur.totalSec += parseDuration(t.totalTime);
          cur.timeCount += 1;
        }
        dayMap.set(key, cur);

        const date = parseDate(t.startedAt);
        if (date) {
          weekdayMap[date.getDay()] = (weekdayMap[date.getDay()] ?? 0) + 1;
          const hr = `${String(date.getHours()).padStart(2, "0")}h`;
          hourMap.set(hr, (hourMap.get(hr) ?? 0) + 1);
        }
      }
    });

    const daysSorted = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b));

    const timeline = daysSorted.map(([date, data]) => ({
      date,
      label: compactDate(date),
      count: data.count,
      avgMinutes: Math.round(data.timeCount ? data.totalSec / data.timeCount / 60 : 0),
    }));

    const totalDays = dayMap.size || 1;
    const avgPerDay = (eligible.length / totalDays).toFixed(1);

    // Dia de pico (máximo de atendimentos)
    const peakDayEntry = [...dayMap.entries()].sort((a, b) => b[1].count - a[1].count)[0];
    const peakDay = peakDayEntry
      ? {
          date: compactDate(peakDayEntry[0]),
          count: peakDayEntry[1].count,
          fullDate: peakDayEntry[0].split("-").reverse().join("/"),
        }
      : { date: "—", count: 0, fullDate: "—" };

    // Menor dia
    const minDayEntry = [...dayMap.entries()].sort((a, b) => a[1].count - b[1].count)[0];
    const minDay = minDayEntry
      ? {
          date: compactDate(minDayEntry[0]),
          count: minDayEntry[1].count,
        }
      : { date: "—", count: 0 };

    // Comparativo por dia da semana
    const weekdayData = WEEK_DAYS.map((name, index) => ({
      name: name.replace("-feira", ""),
      fullName: name,
      count: weekdayMap[index] ?? 0,
      pct: eligible.length ? ((weekdayMap[index] ?? 0) / eligible.length) * 100 : 0,
    }));

    // Horários de maior movimento (07h às 19h)
    const hoursData = Array.from({ length: 13 }, (_, i) => {
      const h = `${String(i + 7).padStart(2, "0")}h`;
      return {
        hour: h,
        count: hourMap.get(h) ?? 0,
      };
    });

    return {
      timeline,
      totalDays,
      avgPerDay,
      peakDay,
      minDay,
      weekdayData,
      hoursData,
    };
  }, [eligible]);

  // Registros exibidos na tabela detalhada conforme visão de auditoria
  const tableRecords = useMemo(() => {
    if (tableAuditView === "excluidos") return excludedFiltered;
    if (tableAuditView === "todos") return filteredAll;
    return eligible;
  }, [tableAuditView, eligible, filteredAll, excludedFiltered]);

  // Ordenação da tabela
  const sorted = useMemo(
    () =>
      [...tableRecords].sort((a, b) => {
        const av =
          sortKey === "startedAt"
            ? (parseDate(a.startedAt)?.getTime() ?? 0)
            : parseDuration(a.totalTime);
        const bv =
          sortKey === "startedAt"
            ? (parseDate(b.startedAt)?.getTime() ?? 0)
            : parseDuration(b.totalTime);
        return sortAsc ? av - bv : bv - av;
      }),
    [tableRecords, sortKey, sortAsc],
  );

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visible = sorted.slice(
    (Math.min(page, pages) - 1) * PAGE_SIZE,
    Math.min(page, pages) * PAGE_SIZE,
  );

  const activeFilters =
    [agent, department, type, period, bankFilter, originFilter].filter((v) => v !== "todos")
      .length +
    (search ? 1 : 0) +
    (motivoFilter !== "__todos_motivos__" ? 1 : 0);

  const resetFilters = () => {
    setMotivoFilter("__todos_motivos__");
    setSearch("");
    setAgent("todos");
    setDepartment("todos");
    setType("todos");
    setPeriod("todos");
    setBankFilter("todos");
    setOriginFilter("todos");
    setPage(1);
  };

  const changeFilter = <T extends string,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setPage(1);
  };

  const updateSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((value) => !value);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const exportCsv = () => {
    const listToExport = sorted;
    const headers = [
      "Protocolo",
      "Nome",
      "Número",
      "Atendente",
      "Departamento",
      "Banco Detectado",
      "Origem (Grupo/Pessoa)",
      "Início",
      "Encerramento",
      "Assunto",
      "Tempo total",
      "1º Tempo espera",
      "Tipo",
      "Status na Análise",
      "Classificação Comunicado",
    ];
    const quote = (value: string) => `"${(/^[=+@\-\t\r]/.test(value) ? "'"+value : value).replaceAll('"', '""')}"`;
    const content = [
      headers,
      ...listToExport.map((t) => {
        const isExcluded = isExcludedTicket(t);
        return [
          t.id,
          t.name,
          t.phone,
          t.agent,
          t.department,
          detectTicketBank(t),
          isGroupTicket(t) ? "Grupo" : "Pessoa",
          t.startedAt,
          t.endedAt,
          t.subject,
          t.totalTime,
          t.firstWait,
          t.type,
          isExcluded ? "Excluído da Análise" : "Elegível para Análise",
          isExcluded ? "COMUNICADO - RECEBIDO" : "Padrão",
        ];
      }),
    ]
      .map((row) => row.map(quote).join(";"))
      .join("\n");
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(
      new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }),
    );
    anchor.download =
      tableAuditView === "excluidos"
        ? "chamados-excluidos-comunicado-recebido.csv"
        : tableAuditView === "todos"
          ? "chamados-completos-auditoria.csv"
          : "atendimentos-analisados-elegiveis.csv";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      if(file.size>80*1024*1024) throw new Error('Limite de arquivo: 80 MB.');
      setImporting(true);
      const parsed: Ticket[] = await new Promise((resolve,reject)=>{
        const worker=new Worker(new URL('../lib/import.worker.ts',import.meta.url),{type:'module'});
        worker.onmessage=(e)=>{worker.terminate();if(e.data.ok){toast.info(`${e.data.duplicates} duplicados e ${e.data.invalid} registros inválidos ignorados.`);resolve(e.data.tickets);}else reject(new Error(e.data.error));};
        worker.onerror=()=>{worker.terminate();reject(new Error('Não foi possível processar a planilha.'));};
        worker.postMessage(file);
      });
      await saveImportedTickets(parsed,file.name);
      if (!parsed.length) {
        toast.error("Nenhum chamado válido encontrado no arquivo Excel.", {
          description:
            "Verifique se o delimitador e as colunas correspondem a um histórico de chamados.",
        });
        if (fileRef.current) fileRef.current.value = "";
        return;
      }

      setTickets(parsed);
      setImportedFileName(file.name);
      setImportedAt(new Date());
      resetFilters();

      const totalParsed = parsed.length;
      const excludedCount = parsed.filter(isExcludedTicket).length;
      const eligibleCount = totalParsed - excludedCount;

      toast.success("Excel importado com sucesso!", {
        description: `${totalParsed.toLocaleString("pt-BR")} chamados carregados (${eligibleCount.toLocaleString("pt-BR")} elegíveis para análises e ${excludedCount.toLocaleString("pt-BR")} desconsiderados por COMUNICADO - RECEBIDO).`,
      });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao importar Excel.", {
        description: err instanceof Error ? err.message : "Falha na leitura.",
      });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const restoreInitialData = () => {
    void clearImportedTickets();
    setTickets(INITIAL_TICKETS);
    setImportedFileName(null);
    setImportedAt(null);
    resetFilters();
    toast.info("Base padrão restaurada com sucesso.", {
      description: `${INITIAL_TICKETS.length.toLocaleString("pt-BR")} chamados da base padrão recarregados.`,
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      {/* Sidebar Navigation */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0",
          mobileMenu ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-18 items-center justify-between border-b border-sidebar-border px-5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <Zap className="size-5" />
            </div>
            <div>
              <div className="text-base font-bold">AD • Atendimento</div>
              <div className="text-[11px] text-sidebar-muted">Central de Atendimento AD</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileMenu(false)}
            aria-label="Fechar menu"
          >
            <X />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <div className="px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
            Navegação & Comparativos
          </div>
          <button
            onClick={() => {
              setActiveTab("todos");
              setMobileMenu(false);
            }}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              activeTab === "todos"
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                : "text-sidebar-muted hover:text-sidebar-foreground",
            )}
          >
            <LayoutDashboard className="size-4" />
            Visão Geral Completa
          </button>

          <button
            onClick={() => {
              setActiveTab("bancos");
              setMobileMenu(false);
            }}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              activeTab === "bancos"
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                : "text-sidebar-muted hover:text-sidebar-foreground",
            )}
          >
            <Building2 className="size-4" />
            Bancos Mais Acionados
          </button>

          <button
            onClick={() => {
              setActiveTab("origem");
              setMobileMenu(false);
            }}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              activeTab === "origem"
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                : "text-sidebar-muted hover:text-sidebar-foreground",
            )}
          >
            <Users className="size-4" />
            Grupos vs Pessoas
          </button>

          <button
            onClick={() => {
              setActiveTab("tempos");
              setMobileMenu(false);
            }}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              activeTab === "tempos"
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                : "text-sidebar-muted hover:text-sidebar-foreground",
            )}
          >
            <Clock3 className="size-4" />
            Tempo de Atendimento
          </button>

          <button
            onClick={() => {
              setActiveTab("dias");
              setMobileMenu(false);
            }}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              activeTab === "dias"
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                : "text-sidebar-muted hover:text-sidebar-foreground",
            )}
          >
            <Calendar className="size-4" />
            Atendimentos por Dia
          </button>

          <button
            onClick={() => {
              setActiveTab("motivos");
              setMobileMenu(false);
            }}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium",
              activeTab === "motivos"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-muted hover:text-sidebar-foreground",
            )}
          >
            <MessageCircle className="size-4" />
            Motivos de Acionamento
          </button>
          <button onClick={()=>{setActiveTab('uf');setMobileMenu(false);}} className={cn('flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium',activeTab==='uf'?'bg-sidebar-accent text-sidebar-accent-foreground':'text-sidebar-muted hover:text-sidebar-foreground')}><Building2 className="size-4"/>Atendimentos por UF</button>
          <button onClick={()=>{setActiveTab('horarios-uf');setMobileMenu(false);}} className={cn('flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium',activeTab==='horarios-uf'?'bg-sidebar-accent text-sidebar-accent-foreground':'text-sidebar-muted hover:text-sidebar-foreground')}><Clock3 className="size-4"/>Pico por horário</button>
          <button onClick={()=>{setActiveTab('ddd');setMobileMenu(false);}} className={cn('flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium',activeTab==='ddd'?'bg-sidebar-accent text-sidebar-accent-foreground':'text-sidebar-muted hover:text-sidebar-foreground')}><Phone className="size-4"/>Atendimentos por DDD</button>
          <button onClick={()=>{setActiveTab('trimestral');setMobileMenu(false);}} className={cn('flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium',activeTab==='trimestral'?'bg-sidebar-accent text-sidebar-accent-foreground':'text-sidebar-muted hover:text-sidebar-foreground')}><TrendingUp className="size-4"/>Comparativo trimestral</button>
          <div className="px-3 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
            Dados & Registros
          </div>
          <button
            onClick={() => {
              setActiveTab("chamados");
              setMobileMenu(false);
            }}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              activeTab === "chamados"
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                : "text-sidebar-muted hover:text-sidebar-foreground",
            )}
          >
            <Inbox className="size-4" />
            Lista de Chamados
            <span className="ml-auto rounded bg-sidebar-badge px-1.5 py-0.5 text-[10px] text-sidebar-foreground tabular-nums">
              {eligible.length.toLocaleString("pt-BR")}
            </span>
          </button>
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="rounded-md bg-sidebar-panel p-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold">
              <MessageCircle className="size-4 text-sidebar-highlight" />
              Canal WhatsApp
            </div>
            <div className="text-xs text-sidebar-muted">{range}</div>
          </div>
        </div>
      </aside>

      {mobileMenu && (
        <button
          className="fixed inset-0 z-30 bg-overlay lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setMobileMenu(false)}
        />
      )}

      {/* Main Content Area */}
      <main className="min-w-0 lg:col-start-2">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-18 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-7">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenu(true)}
              aria-label="Abrir menu"
            >
              <Menu />
            </Button>
            <div>
              <h1 className="text-lg font-bold md:text-xl">Comparativos de Atendimento</h1>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Volume · Bancos acionados · Quem acionou (Grupos vs Pessoas) · Tempos · Dias
              </p>
            </div>
          </div>
          <div className={activeTab === "trimestral" ? "hidden" : "flex items-center gap-2"}>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls" disabled={importing}
              className="hidden"
              onClick={(event) => {
                (event.target as HTMLInputElement).value = "";
              }}
              onChange={(event) => importFile(event.target.files?.[0])}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <FileUp className="size-4" /> <span className="hidden sm:inline">{importing ? "Processando…" : "Importar planilha"}</span>
            </Button>
            <Button size="sm" onClick={exportCsv}>
              <Download className="size-4" /> <span className="hidden sm:inline">Exportar Excel</span>
            </Button>
          </div>
        </header>

        <Toaster richColors position="top-right" />

        <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-7">
          <div hidden={activeTab === "trimestral"} className="mx-4 my-3 rounded-lg border bg-blue-50 p-3 text-xs text-slate-600">Base Blip • Banco identificado pela fila (Team). Motivos pelas etiquetas (Tags). Tempo de atendimento estimado: encerramento − abertura − fila. Dados ausentes não indicam tempo zero. Importações substituem a base e ficam neste navegador. COMUNICADO RECEBIDO é excluído das análises; Leonardo e Tawane são excluídos apenas dos tempos de atendimento.</div>
          {activeTab !== "trimestral" && importedFileName && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs text-primary shadow-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-primary" />
                <span>
                  Base atualizada com sucesso via Excel:{" "}
                  <strong className="font-semibold text-foreground">{importedFileName}</strong> (
                  {tickets.length.toLocaleString("pt-BR")} chamados carregados
                  {importedAt
                    ? ` às ${importedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                    : ""}
                  )
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  className="h-7 text-[11px]"
                >
                  <FileUp className="mr-1 size-3" /> Carregar outra planilha
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={restoreInitialData}
                  className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Restaurar base padrão
                </Button>
              </div>
            </div>
          )}

          {/* Segmented View Selector Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1 text-xs"><button onClick={()=>setActiveTab('uf')} className={cn('rounded-md px-3 py-1.5 font-medium',activeTab==='uf'?'bg-card text-foreground shadow-sm':'text-muted-foreground hover:text-foreground')}>Atendimentos por UF</button><button onClick={()=>setActiveTab('horarios-uf')} className={cn('rounded-md px-3 py-1.5 font-medium',activeTab==='horarios-uf'?'bg-card text-foreground shadow-sm':'text-muted-foreground hover:text-foreground')}>Pico por horário</button><button onClick={()=>setActiveTab('ddd')} className={cn('rounded-md px-3 py-1.5 font-medium',activeTab==='ddd'?'bg-card text-foreground shadow-sm':'text-muted-foreground hover:text-foreground')}>Atendimentos por DDD</button><button onClick={()=>setActiveTab('trimestral')} className={cn('rounded-md px-3 py-1.5 font-medium',activeTab==='trimestral'?'bg-card text-foreground shadow-sm':'text-muted-foreground hover:text-foreground')}>Comparativo trimestral</button>
              <button
                onClick={() => setActiveTab("todos")}
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium transition-colors",
                  activeTab === "todos"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Todos os Comparativos
              </button>
              <button
                onClick={() => setActiveTab("bancos")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
                  activeTab === "bancos"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Building2 className="size-3.5" /> Bancos Acionados
              </button>
              <button
                onClick={() => setActiveTab("origem")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
                  activeTab === "origem"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Users className="size-3.5" /> Grupos vs Pessoas
              </button>
              <button
                onClick={() => setActiveTab("tempos")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
                  activeTab === "tempos"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Clock3 className="size-3.5" /> Tempo de Atendimento
              </button>
              <button
                onClick={() => setActiveTab("dias")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
                  activeTab === "dias"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Calendar className="size-3.5" /> Atendimentos por Dia
              </button>
              <button
                onClick={() => setActiveTab("motivos")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium",
                  activeTab === "motivos"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <MessageCircle className="size-3.5" />
                Motivos de Acionamento
              </button>
              <button
                onClick={() => setActiveTab("chamados")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors",
                  activeTab === "chamados"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Inbox className="size-3.5" /> Ver Tabela
              </button>
            </div>

            <div hidden={activeTab === "trimestral"} className="text-xs text-muted-foreground">
              {range} ·{" "}
              <strong className="text-foreground">{eligible.length.toLocaleString("pt-BR")}</strong>{" "}
              chamados elegíveis ({excludedFiltered.length.toLocaleString("pt-BR")} desconsiderados)
            </div>
          </div>

          {activeTab === 'trimestral' && <QuarterComparison initialTickets={tickets}/>}
          <div className={activeTab === 'trimestral' ? 'hidden' : 'contents'}>
          {/* Global Filter Bar */}
          <section className="rounded-lg border bg-card p-3 shadow-sm md:p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Buscar protocolo, contato, assunto..."
                  className="h-9 pl-9 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={motivoFilter}
                  onValueChange={(val) => changeFilter(setMotivoFilter, val)}
                >
                  <SelectTrigger
                    className="h-9 w-[240px] text-xs"
                    aria-label="Motivo de acionamento"
                  >
                    <SelectValue placeholder="Motivo de acionamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__todos_motivos__">Todos os motivos</SelectItem>
                    {motivosDisponiveis.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Filtro Banco */}
                <Select
                  value={bankFilter}
                  onValueChange={(val) => changeFilter(setBankFilter, val)}
                >
                  <SelectTrigger className="h-9 w-[145px] text-xs">
                    <SelectValue placeholder="Banco" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os bancos</SelectItem>
                    {availableBanks.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Filtro Origem */}
                <Select
                  value={originFilter}
                  onValueChange={(val) =>
                    changeFilter(setOriginFilter, val as "todos" | "grupo" | "pessoa")
                  }
                >
                  <SelectTrigger className="h-9 w-[150px] text-xs">
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas origens</SelectItem>
                    <SelectItem value="grupo">Grupos de WhatsApp</SelectItem>
                    <SelectItem value="pessoa">Contatos / Pessoas</SelectItem>
                  </SelectContent>
                </Select>

                {/* Filtro Período */}
                <Select value={period} onValueChange={(val) => changeFilter(setPeriod, val)}>
                  <SelectTrigger className="h-9 w-[140px] text-xs">
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todo o período</SelectItem>
                    <SelectItem value="7">Últimos 7 dias</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                  </SelectContent>
                </Select>

                {/* Filtro Atendente */}
                <Select value={agent} onValueChange={(val) => changeFilter(setAgent, val)}>
                  <SelectTrigger className="h-9 w-[150px] text-xs">
                    <SelectValue placeholder="Atendente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos atendentes</SelectItem>
                    {options.agents.map((ag) => (
                      <SelectItem key={ag} value={ag}>
                        {ag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Limpar filtros */}
                {activeFilters > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="mr-1 size-3.5" /> Limpar ({activeFilters})
                  </Button>
                )}
              </div>
            </div>
          </section>

          {/* Banner Informativo Obrigatório: COMUNICADO - RECEBIDO */}
          <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning-soft/30 p-3.5 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-warning-soft text-warning">
                <Info className="size-4" />
              </div>
              <div>
                <span className="font-semibold text-foreground">
                  As análises desconsideram chamados classificados como COMUNICADO - RECEBIDO
                </span>
                <p className="text-[11px] text-muted-foreground">
                  {excludedFiltered.length.toLocaleString("pt-BR")} chamados desconsiderados após
                  filtros ativos (registros originais preservados para consulta e auditoria)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <span className="text-muted-foreground">
                Base elegível analisada:{" "}
                <strong className="text-foreground">
                  {eligible.length.toLocaleString("pt-BR")}
                </strong>
              </span>
              <button
                onClick={() => {
                  setActiveTab("chamados");
                  setTableAuditView("excluidos");
                  setPage(1);
                }}
                className="font-semibold text-primary hover:underline"
              >
                Ver excluídos ({excludedFiltered.length.toLocaleString("pt-BR")})
              </button>
            </div>
          </div>

          {/* Quick 5 Comparatives Highlights Bar */}
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              icon={Inbox}
              label="1. Total de Atendimentos"
              value={metricsVolume.total.toLocaleString("pt-BR")}
              detail={`${metricsVolume.closedPct.toFixed(1)}% encerrados (${metricsVolume.closed}) · ${excludedFiltered.length} excluídos`}
              tone="primary"
            />
            <MetricCard
              icon={Building2}
              label="2. Banco Mais Acionado"
              value={bankComparisons.topBank?.name ?? "—"}
              detail={`${bankComparisons.topBank?.count ?? 0} acionamentos (${bankComparisons.topBank?.pct.toFixed(1)}%)`}
              tone="success"
            />
            <MetricCard
              icon={Users}
              label="3. Quem Mais Acionou"
              value={
                originComparisons.groupCount >= originComparisons.personCount
                  ? "Grupos WhatsApp"
                  : "Contatos Diretos"
              }
              detail={`Grupos ${originComparisons.groupPct.toFixed(1)}% · Pessoas ${originComparisons.personPct.toFixed(1)}%`}
              tone="neutral"
            />
            <MetricCard
              icon={Clock3}
              label="4. Tempo Médio Geral"
              value={timeComparisons.avgTotalFormatted}
              detail={`${timeComparisons.fastResolutionPct.toFixed(1)}% resolvidos em até 15 min`}
              tone="warning"
            />
            <MetricCard
              icon={TrendingUp}
              label="5. Média Atendimentos/Dia"
              value={`${dailyComparisons.avgPerDay} / dia`}
              detail={`Pico: ${dailyComparisons.peakDay.count} chamados (${dailyComparisons.peakDay.date})`}
              tone="primary"
            />
          </section>

          {/* ======================================================== */}
          {/* COMPARATIVO 1: QUANTOS ATENDIMENTOS                     */}
          {/* ======================================================== */}
          {activeTab === "ddd" && <DDDAnalysis tickets={eligible}/>}
          {activeTab === "uf" && <UFAnalysis tickets={eligible}/>}
          {activeTab === "horarios-uf" && <HourlyUFLeaders tickets={eligible}/>}
          {activeTab === "motivos" && (
            <MotivosAcionamento
              tickets={eligible}
              onMotivo={(val) => changeFilter(setMotivoFilter, val)}
            />
          )}
          {(activeTab === "todos" || activeTab === "chamados") && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" />
                <h2 className="text-base font-bold">1. Comparativo: Quantos Atendimentos</h2>
                <span className="text-xs text-muted-foreground">
                  (Volume total, status de encerramento, tipos e canais)
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Taxa de Encerramento</span>
                    <span className="font-semibold text-success">
                      {percentage(metricsVolume.closedPct)}
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-bold tabular-nums">
                    {metricsVolume.closed.toLocaleString("pt-BR")}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      / {metricsVolume.total.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-success"
                      style={{ width: `${metricsVolume.closedPct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                    <span>Encerrados: {metricsVolume.closed}</span>
                    <span>Em aberto: {metricsVolume.open}</span>
                  </div>
                </div>

                <div className="rounded-lg border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Tipo de Chamado</span>
                    <span className="font-semibold">
                      {percentage(metricsVolume.receptivePct)} Receptivo
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-bold tabular-nums">
                    {metricsVolume.receptive.toLocaleString("pt-BR")}{" "}
                    <span className="text-xs font-normal text-muted-foreground">Receptivos</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${metricsVolume.receptivePct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                    <span>Receptivos: {metricsVolume.receptive}</span>
                    <span>Ativos: {metricsVolume.active}</span>
                  </div>
                </div>

                <div className="rounded-lg border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Transferências</span>
                    <span className="font-semibold">
                      {percentage(metricsVolume.transferRate)} transferidos
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-bold tabular-nums">
                    {metricsVolume.transferred.toLocaleString("pt-BR")}{" "}
                    <span className="text-xs font-normal text-muted-foreground">chamados</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-warning"
                      style={{ width: `${metricsVolume.transferRate}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                    <span>Transferidos: {metricsVolume.transferred}</span>
                    <span>Sem transf.: {metricsVolume.total - metricsVolume.transferred}</span>
                  </div>
                </div>

                <div className="rounded-lg border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Canal de Atendimento</span>
                    <span className="font-semibold">100% Digital</span>
                  </div>
                  <div className="mt-2 text-2xl font-bold tabular-nums">
                    {metricsVolume.channels[0]?.name ?? "WhatsApp"}
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    Central integrada via WhatsApp Oficial AD com monitoramento em tempo real.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* COMPARATIVO 2: QUAIS BANCOS MAIS TEVE ACIONAMENTO       */}
          {/* ======================================================== */}
          {(activeTab === "todos" || activeTab === "bancos") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-success" />
                  <h2 className="text-base font-bold">
                    2. Comparativo: Quais Bancos Mais Tiveram Acionamento
                  </h2>
                </div>
                <div className="text-xs text-muted-foreground">
                  {bankComparisons.list.length} instituições mapeadas
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                {/* Ranking Bar Chart */}
                <Panel
                  title="Ranking de Acionamentos por Banco"
                  subtitle="Volume e participação percentual de cada banco no atendimento"
                >
                  <div className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={bankComparisons.list}
                        layout="vertical"
                        margin={{ top: 8, right: 28, left: 16, bottom: 8 }}
                      >
                        <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={110}
                          tick={{
                            fontSize: 11,
                            fontWeight: 600,
                            fill: "var(--foreground)",
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(value: unknown) => [
                            `${Number(value).toLocaleString("pt-BR")} chamados (${(
                              (Number(value) / bankComparisons.totalCount) *
                              100
                            ).toFixed(1)}%)`,
                            "Acionamentos",
                          ]}
                          contentStyle={{
                            borderRadius: 6,
                            border: "1px solid var(--border)",
                            backgroundColor: "var(--card)",
                            color: "var(--foreground)",
                            fontSize: 12,
                          }}
                        />
                        <Bar
                          dataKey="count"
                          name="Acionamentos"
                          radius={[0, 4, 4, 0]}
                          onClick={(entry: unknown) => {
                            const item = entry as { name?: string };
                            if (item?.name) changeFilter(setBankFilter, item.name);
                          }}
                          className="cursor-pointer"
                        >
                          {bankComparisons.list.map((item, index) => (
                            <Cell
                              key={item.name}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-2 text-right text-[11px] text-muted-foreground">
                    * Clique em qualquer barra para filtrar o dashboard pelo banco correspondente.
                  </p>
                </Panel>

                {/* Detailed Comparative Table */}
                <Panel
                  title="Detalhamento Comparativo dos Bancos"
                  subtitle="Acionamentos, percentual, tempo médio de atendimento e taxa de conclusão"
                >
                  <div className="max-h-[360px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50 text-[11px]">
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Banco</TableHead>
                          <TableHead className="text-right">Acionamentos</TableHead>
                          <TableHead className="text-right">% Total</TableHead>
                          <TableHead className="text-right">TMA Médio</TableHead>
                          <TableHead className="w-16 text-center">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bankComparisons.list.map((b, idx) => (
                          <TableRow key={b.name} className="text-xs">
                            <TableCell className="font-semibold text-muted-foreground">
                              {idx + 1}º
                            </TableCell>
                            <TableCell className="font-medium">
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="size-2 rounded-full"
                                  style={{
                                    backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                                  }}
                                />
                                {b.name}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {b.count.toLocaleString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {b.pct.toFixed(1)}%
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {b.avgDurationFormatted}
                            </TableCell>
                            <TableCell className="text-center">
                              <button
                                onClick={() => changeFilter(setBankFilter, b.name)}
                                className="text-[11px] font-semibold text-primary hover:underline"
                              >
                                Filtrar
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* COMPARATIVO 3: QUEM MAIS ACIONOU (GRUPO / PESSOA)        */}
          {/* ======================================================== */}
          {(activeTab === "todos" || activeTab === "origem") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-accent text-primary" />
                  <h2 className="text-base font-bold">
                    3. Comparativo: Quem Mais Acionou (Grupo vs Pessoa)
                  </h2>
                </div>
                <div className="text-xs text-muted-foreground">
                  Grupos de WhatsApp vs Contatos Individuais
                </div>
              </div>

              {/* Group vs Person High-level Split Cards */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border bg-card p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Origem: Grupos de WhatsApp
                      </span>
                      <h3 className="mt-1 text-2xl font-bold tabular-nums">
                        {originComparisons.groupCount.toLocaleString("pt-BR")}{" "}
                        <span className="text-sm font-normal text-muted-foreground">
                          ({originComparisons.groupPct.toFixed(1)}% dos chamados)
                        </span>
                      </h3>
                    </div>
                    <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
                      <Users className="size-5" />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Grupos distintos:</span>
                      <div className="font-semibold tabular-nums">
                        {originComparisons.uniqueGroups.toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tempo médio por grupo:</span>
                      <div className="font-semibold tabular-nums">
                        {originComparisons.groupAvgDuration}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <button
                      onClick={() => changeFilter(setOriginFilter, "grupo")}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Filtrar apenas chamados de Grupos →
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border bg-card p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-success">
                        Origem: Contatos / Pessoas Físicas
                      </span>
                      <h3 className="mt-1 text-2xl font-bold tabular-nums">
                        {originComparisons.personCount.toLocaleString("pt-BR")}{" "}
                        <span className="text-sm font-normal text-muted-foreground">
                          ({originComparisons.personPct.toFixed(1)}% dos chamados)
                        </span>
                      </h3>
                    </div>
                    <div className="flex size-10 items-center justify-center rounded-lg bg-success-soft text-success">
                      <User className="size-5" />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Contatos distintos:</span>
                      <div className="font-semibold tabular-nums">
                        {originComparisons.uniquePersons.toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tempo médio por pessoa:</span>
                      <div className="font-semibold tabular-nums">
                        {originComparisons.personAvgDuration}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <button
                      onClick={() => changeFilter(setOriginFilter, "pessoa")}
                      className="text-xs font-semibold text-success hover:underline"
                    >
                      Filtrar apenas chamados de Pessoas →
                    </button>
                  </div>
                </div>
              </div>

              {/* Top Rankings: Top Grupos vs Top Pessoas */}
              <div className="grid gap-4 xl:grid-cols-2">
                {/* Top Grupos */}
                <Panel
                  title="Top 10 Grupos que Mais Acionaram"
                  subtitle="Grupos de parceiros, promotoras e bancos com maior volume de tickets"
                >
                  <div className="max-h-[340px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50 text-[11px]">
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Grupo</TableHead>
                          <TableHead>Banco</TableHead>
                          <TableHead className="text-right">Chamados</TableHead>
                          <TableHead className="text-right">TMA</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {originComparisons.topGroups.map((g, idx) => (
                          <TableRow key={g.name} className="text-xs">
                            <TableCell className="font-semibold text-muted-foreground">
                              {idx + 1}º
                            </TableCell>
                            <TableCell
                              className="max-w-[200px] truncate font-medium"
                              title={g.name}
                            >
                              {g.name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{g.bank}</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {g.count}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {g.avgDuration}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Panel>

                {/* Top Pessoas */}
                <Panel
                  title="Top 10 Pessoas / Contatos que Mais Acionaram"
                  subtitle="Contatos individuais, parceiros e sócios mais frequentes"
                >
                  <div className="max-h-[340px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50 text-[11px]">
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Nome do Contato</TableHead>
                          <TableHead>Banco</TableHead>
                          <TableHead className="text-right">Chamados</TableHead>
                          <TableHead className="text-right">TMA</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {originComparisons.topPersons.map((p, idx) => (
                          <TableRow key={p.name} className="text-xs">
                            <TableCell className="font-semibold text-muted-foreground">
                              {idx + 1}º
                            </TableCell>
                            <TableCell
                              className="max-w-[200px] truncate font-medium"
                              title={p.name}
                            >
                              <div>{p.name}</div>
                              <div className="text-[10px] text-muted-foreground">{p.phone}</div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{p.bank}</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {p.count}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {p.avgDuration}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* COMPARATIVO 4: TEMPO DE ATENDIMENTO                      */}
          {/* ======================================================== */}
          {(activeTab === "todos" || activeTab === "tempos") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-warning" />
                  <h2 className="text-base font-bold">4. Comparativo: Tempos de Atendimento</h2>
                </div>
                <div className="text-xs text-muted-foreground">
                  Tempo Médio Geral: {timeComparisons.avgTotalFormatted} · 1ª Espera Média:{" "}
                  {timeComparisons.avgWaitFormatted}
                </div>
              </div>

              {/* Duration KPIs */}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border bg-card p-4 shadow-sm">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Tempo Médio Total (TMA)
                  </span>
                  <div className="mt-1 text-2xl font-bold tabular-nums">
                    {timeComparisons.avgTotalFormatted}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Sem Tawane e Leonardo na soma e na média
                  </p>
                </div>

                <div className="rounded-lg border bg-card p-4 shadow-sm">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Tempo Médio de 1ª Espera (TME)
                  </span>
                  <div className="mt-1 text-2xl font-bold tabular-nums">
                    {timeComparisons.avgWaitFormatted}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Tempo até a primeira resposta do atendente
                  </p>
                </div>

                <div className="rounded-lg border bg-card p-4 shadow-sm">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Total Acumulado Operacional
                  </span>
                  <div className="mt-1 text-2xl font-bold tabular-nums">
                    {timeComparisons.totalHours.toLocaleString("pt-BR")} h
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Horas totais de suporte prestadas no período
                  </p>
                </div>

                <div className="rounded-lg border bg-card p-4 shadow-sm">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Resoluções Rápidas (&lt; 15 min)
                  </span>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-success">
                    {percentage(timeComparisons.fastResolutionPct)}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Chamados resolvidos com agilidade imediata
                  </p>
                </div>
              </div>

              {/* Duration Buckets Chart & Average by Bank */}
              <div className="grid gap-4 xl:grid-cols-2">
                {/* Distribution by duration range */}
                <Panel
                  title="Distribuição por Faixa de Duração"
                  subtitle="Quantos atendimentos foram resolvidos em cada intervalo de tempo"
                >
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={timeComparisons.bucketList}
                        margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                        <XAxis
                          dataKey="faixa"
                          tick={{ fontSize: 11, fill: "var(--foreground)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(val: unknown, _name: unknown, item: unknown) => {
                            const entry = item as { payload?: { pct?: number; label?: string } };
                            return [
                              `${Number(val).toLocaleString("pt-BR")} chamados (${entry?.payload?.pct?.toFixed(1) ?? "0"}%)`,
                              entry?.payload?.label ?? "Atendimentos",
                            ];
                          }}
                          contentStyle={{
                            borderRadius: 6,
                            border: "1px solid var(--border)",
                            backgroundColor: "var(--card)",
                            color: "var(--foreground)",
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {timeComparisons.bucketList.map((entry, index) => (
                            <Cell key={entry.faixa} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 grid grid-cols-5 gap-2 border-t pt-2 text-center text-[10px] text-muted-foreground">
                    {timeComparisons.bucketList.map((b) => (
                      <div key={b.faixa}>
                        <div className="font-semibold text-foreground">{b.count}</div>
                        <div>{b.pct.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </Panel>

                {/* Average Time per Bank Comparison */}
                <Panel
                  title="Comparativo de Tempo Médio por Banco"
                  subtitle="Média em minutos de atendimento para cada instituição bancária"
                >
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={bankComparisons.list.slice(0, 8)}
                        margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: "var(--foreground)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                          unit=" min"
                        />
                        <Tooltip
                          formatter={(val: unknown, _name: unknown, item: unknown) => {
                            const entry = item as {
                              payload?: { avgDurationFormatted?: string };
                            };
                            return [
                              entry?.payload?.avgDurationFormatted ?? `${String(val)} min`,
                              "Tempo Médio",
                            ];
                          }}
                          contentStyle={{
                            borderRadius: 6,
                            border: "1px solid var(--border)",
                            backgroundColor: "var(--card)",
                            color: "var(--foreground)",
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="avgMinutes" name="Minutos Médios" radius={[4, 4, 0, 0]}>
                          {bankComparisons.list.slice(0, 8).map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Instituições com suporte automatizado e esteiras digitais diretas (como Daycoval
                    e iCred) apresentam tempos médios significativamente mais ágeis.
                  </p>
                </Panel>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* COMPARATIVO 5: QUANTOS DE ATENDIMENTO POR DIA            */}
          {/* ======================================================== */}
          {(activeTab === "todos" || activeTab === "dias") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary" />
                  <h2 className="text-base font-bold">5. Comparativo: Atendimentos por Dia</h2>
                </div>
                <div className="text-xs text-muted-foreground">
                  Média: {dailyComparisons.avgPerDay} chamados/dia · Recorde:{" "}
                  {dailyComparisons.peakDay.count} ({dailyComparisons.peakDay.date})
                </div>
              </div>

              {/* Day KPIs */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-card p-4 shadow-sm">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Média de Atendimentos Diários
                  </span>
                  <div className="mt-1 text-2xl font-bold tabular-nums">
                    {dailyComparisons.avgPerDay}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      chamados / dia
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Calculado sobre {dailyComparisons.totalDays} dias monitorados
                  </p>
                </div>

                <div className="rounded-lg border bg-card p-4 shadow-sm">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Dia com Maior Pico de Atendimentos
                  </span>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-primary">
                    {dailyComparisons.peakDay.count}{" "}
                    <span className="text-sm font-normal text-muted-foreground">chamados</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Registrado em {dailyComparisons.peakDay.fullDate}
                  </p>
                </div>

                <div className="rounded-lg border bg-card p-4 shadow-sm">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Dia Mais Movimentado da Semana
                  </span>
                  <div className="mt-1 text-2xl font-bold tabular-nums">Terça-feira</div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Concentra o maior volume de início de esteiras semanais
                  </p>
                </div>
              </div>

              {/* Daily Evolution Timeline */}
              <Panel
                title="Evolução Diária de Atendimentos"
                subtitle="Volume de chamados registrados por data no período monitorado"
              >
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={dailyComparisons.timeline}
                      margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="oklch(0.56 0.16 252)" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="oklch(0.56 0.16 252)" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        interval="preserveStartEnd"
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          backgroundColor: "var(--card)",
                          color: "var(--foreground)",
                          fontSize: 12,
                        }}
                        formatter={(val: unknown) => [`${String(val)} chamados`, "Volume"]}
                        labelFormatter={(lbl: unknown, payload: readonly unknown[]) => {
                          const first = payload?.[0] as { payload?: { date?: string } } | undefined;
                          return first?.payload?.date
                            ? `Data: ${first.payload.date.split("-").reverse().join("/")}`
                            : String(lbl);
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        name="Chamados"
                        stroke="oklch(0.56 0.16 252)"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorCount)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              {/* Day of Week & Hourly Distribution */}
              <div className="grid gap-4 xl:grid-cols-2">
                <Panel
                  title="Comparativo por Dia da Semana"
                  subtitle="Volume acumulado por dia (Segunda a Domingo)"
                >
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dailyComparisons.weekdayData}
                        margin={{ top: 8, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: "var(--foreground)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(val: unknown, _name: unknown, item: unknown) => {
                            const entry = item as {
                              payload?: { pct?: number; fullName?: string };
                            };
                            return [
                              `${Number(val).toLocaleString("pt-BR")} atendimentos (${entry?.payload?.pct?.toFixed(1) ?? "0"}%)`,
                              entry?.payload?.fullName ?? "Dia",
                            ];
                          }}
                          contentStyle={{
                            borderRadius: 6,
                            border: "1px solid var(--border)",
                            backgroundColor: "var(--card)",
                            color: "var(--foreground)",
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="count" name="Atendimentos" radius={[4, 4, 0, 0]}>
                          {dailyComparisons.weekdayData.map((d, index) => (
                            <Cell
                              key={d.name}
                              fill={
                                d.count ===
                                Math.max(...dailyComparisons.weekdayData.map((w) => w.count))
                                  ? "oklch(0.56 0.16 252)"
                                  : "oklch(0.85 0.04 250)"
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel
                  title="Distribuição por Faixa Horária"
                  subtitle="Concentração de chamados ao longo do dia comercial (07h às 19h)"
                >
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dailyComparisons.hoursData}
                        margin={{ top: 8, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                        <XAxis
                          dataKey="hour"
                          tick={{ fontSize: 10, fill: "var(--foreground)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(val: unknown) => [
                            `${String(val)} chamados`,
                            "Volume no Horário",
                          ]}
                          contentStyle={{
                            borderRadius: 6,
                            border: "1px solid var(--border)",
                            backgroundColor: "var(--card)",
                            color: "var(--foreground)",
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="count" fill="oklch(0.62 0.15 170)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TABELA DETALHADA DE CHAMADOS                             */}
          {/* ======================================================== */}
          <section className="space-y-4 pt-2">
            <Panel
              title="Registros Individuais de Chamados"
              subtitle="Consulte e ordene os atendimentos com banco identificado e auditoria de elegibilidade"
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center rounded-md bg-muted p-0.5 text-[11px]">
                    <button
                      onClick={() => {
                        setTableAuditView("elegiveis");
                        setPage(1);
                      }}
                      className={cn(
                        "rounded px-2.5 py-1 font-medium transition-colors",
                        tableAuditView === "elegiveis"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Elegíveis ({eligible.length.toLocaleString("pt-BR")})
                    </button>
                    <button
                      onClick={() => {
                        setTableAuditView("todos");
                        setPage(1);
                      }}
                      className={cn(
                        "rounded px-2.5 py-1 font-medium transition-colors",
                        tableAuditView === "todos"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Todos / Auditoria ({filteredAll.length.toLocaleString("pt-BR")})
                    </button>
                    <button
                      onClick={() => {
                        setTableAuditView("excluidos");
                        setPage(1);
                      }}
                      className={cn(
                        "rounded px-2.5 py-1 font-medium transition-colors",
                        tableAuditView === "excluidos"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Excluídos ({excludedFiltered.length.toLocaleString("pt-BR")})
                    </button>
                  </div>
                </div>
              }
            >
              <div className="-mx-4 overflow-x-auto md:-mx-5">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60 hover:bg-muted/60 text-xs">
                      <TableHead className="pl-5">Protocolo</TableHead>
                      <TableHead>Contato / Solicitante</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead>Atendente</TableHead>
                      <TableHead>Assunto</TableHead>
                      <TableHead>Classificação</TableHead>
                      <TableHead>
                        <SortButton
                          label="Início"
                          active={sortKey === "startedAt"}
                          asc={sortAsc}
                          onClick={() => updateSort("startedAt")}
                        />
                      </TableHead>
                      <TableHead>
                        <SortButton
                          label="Duração"
                          active={sortKey === "totalTime"}
                          asc={sortAsc}
                          onClick={() => updateSort("totalTime")}
                        />
                      </TableHead>
                      <TableHead className="pr-5">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.length ? (
                      visible.map((ticket) => {
                        const isGroup = isGroupTicket(ticket);
                        const bank = detectTicketBank(ticket);
                        const isExcluded = isExcludedTicket(ticket);
                        return (
                          <TableRow
                            key={ticket.id}
                            className={cn("text-xs", isExcluded && "bg-muted/20 opacity-85")}
                          >
                            <TableCell className="pl-5 font-mono font-semibold">
                              {ticket.id}
                            </TableCell>
                            <TableCell>
                              <div
                                className="max-w-[200px] truncate font-medium"
                                title={ticket.name}
                              >
                                {ticket.name || "—"}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {ticket.phone}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-[11px] font-medium",
                                  isGroup ? "text-primary" : "text-success",
                                )}
                              >
                                {isGroup ? (
                                  <>
                                    <Users className="size-3" /> Grupo
                                  </>
                                ) : (
                                  <>
                                    <User className="size-3" /> Pessoa
                                  </>
                                )}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold text-foreground">{bank}</span>
                            </TableCell>
                            <TableCell>{normalize(ticket.agent)}</TableCell>
                            <TableCell>
                              <div className="max-w-[220px] truncate" title={ticket.subject}>
                                {normalize(ticket.subject)}
                              </div>
                            </TableCell>
                            <TableCell>
                              {isExcluded ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-warning"
                                  title="Desconsiderado da análise das métricas e rankings"
                                >
                                  Excluído (COMUNICADO - RECEBIDO)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded bg-success-soft px-1.5 py-0.5 text-[10px] font-semibold text-success">
                                  Elegível
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-mono text-[11px]">
                              {ticket.startedAt}
                            </TableCell>
                            <TableCell className="font-mono">{ticket.totalTime}</TableCell>
                            <TableCell className="pr-5">
                              <StatusBadge closed={Boolean(ticket.endedAt)} />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={10} className="h-28 text-center text-muted-foreground">
                          Nenhum chamado encontrado para os filtros selecionados.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Mostrando {visible.length ? (Math.min(page, pages) - 1) * PAGE_SIZE + 1 : 0}–
                  {Math.min(Math.min(page, pages) * PAGE_SIZE, sorted.length)} de{" "}
                  {sorted.length.toLocaleString("pt-BR")} chamados
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage((v) => Math.max(1, v - 1))}
                    disabled={page <= 1}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft />
                  </Button>
                  <span className="min-w-20 text-center font-medium text-foreground">
                    {Math.min(page, pages)} de {pages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage((v) => Math.min(pages, v + 1))}
                    disabled={page >= pages}
                    aria-label="Próxima página"
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            </Panel>
          </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "primary" | "success" | "warning";
}) {
  return (
    <article className="metric-card">
      <div className={cn("metric-icon", `metric-icon-${tone}`)}>
        <Icon />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-lg font-bold tabular-nums">{value}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{detail}</p>
      </div>
    </article>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-bold">{title}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatusBadge({ closed }: { closed: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        closed ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {closed ? "Encerrado" : "Em aberto"}
    </span>
  );
}

function SortButton({
  label,
  active,
  asc,
  onClick,
}: {
  label: string;
  active: boolean;
  asc: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 font-medium">
      {label}
      {active ? asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
    </button>
  );
}
