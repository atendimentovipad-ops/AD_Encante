import DailyQuarter from './DailyQuarter';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Upload,Download,Calendar,TrendingUp} from 'lucide-react';
import {BarChart,Bar,CartesianGrid,XAxis,YAxis,Tooltip,ResponsiveContainer} from 'recharts';
import {Button} from '../ui/button';
import {type Ticket,formatDuration,isExcludedTicket} from '@/lib/tickets';
import {lastThreeMonths,mergeMonths,monthKey,summarizeMonth,variation,bankName} from '@/lib/quarter';
import {readQuarter,saveQuarter,type QuarterData} from '@/lib/quarter-storage';
import {motivoAcionamento} from '@/lib/motivos';
const label=(key:string)=>new Date(Number(key.slice(0,4)),Number(key.slice(5))-1,1).toLocaleDateString('pt-BR',{month:'short',year:'numeric'});
const count=(n:number)=>n.toLocaleString('pt-BR');
const pct=(a:number|undefined,b:number|undefined)=>{const v=variation(a,b);return v===null?'—':`${v>0?'+':''}${v.toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;};
function parse(file:File):Promise<Ticket[]>{return new Promise((resolve,reject)=>{
 const w=new Worker(new URL('../../lib/import.worker.ts',import.meta.url),{type:'module'});
 const timer=setTimeout(()=>{w.terminate();reject(Error('A leitura excedeu 2 minutos. Tente um arquivo menor.'));},120000);
 w.onmessage=e=>{clearTimeout(timer);w.terminate();e.data.ok?resolve(e.data.tickets):reject(Error(e.data.error));};
 w.onerror=()=>{clearTimeout(timer);w.terminate();reject(Error('Falha ao processar '+file.name));};w.postMessage(file);
});}
export default function QuarterComparison({initialTickets}:{initialTickets:Ticket[]}){
 const [data,setData]=useState<QuarterData|null>(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[dimension,setDimension]=useState<'bank'|'agent'|'reason'>('bank');
 const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{readQuarter().then(setData).catch(()=>setError('Não foi possível recuperar o comparativo salvo.')).finally(()=>setReady(true));},[]);
 const tickets=data?.tickets??initialTickets;
 const months=useMemo(()=>lastThreeMonths(tickets),[tickets]);
 const monthRows=useMemo(()=>months.map(month=>{const rows=tickets.filter(t=>monthKey(t)===month);return {month,available:rows.length>0,...summarizeMonth(rows)};}),[tickets,months]);
 const breakdown=useMemo(()=>{
 const groups=new Map<string,number[]>();
 for(const t of tickets){if(isExcludedTicket(t))continue;const index=months.indexOf(monthKey(t));if(index<0)continue;
 const name=dimension==='bank'?bankName(t):dimension==='agent'?t.agent:motivoAcionamento(t.subject);
 const values=groups.get(name)||[0,0,0];values[index]=(values[index]||0)+1;groups.set(name,values);}
 return [...groups].map(([name,values])=>({name,values})).sort((a,b)=>b.values.reduce((s,n)=>s+n,0)-a.values.reduce((s,n)=>s+n,0));
 },[tickets,months,dimension]);
 async function upload(files:File[]){if(!files.length)return;setBusy(true);setError('');setMessage('Lendo planilhas…');
 try{if(files.length>12)throw Error('Selecione até 12 planilhas por vez.');let incoming:Ticket[]=[];
 for(const [i,file] of files.entries()){if(file.size>80*1024*1024)throw Error('Limite de 80 MB por planilha.');setMessage(`Lendo ${i+1}/${files.length}: ${file.name}`);incoming=incoming.concat(await parse(file));}
 const next={tickets:mergeMonths(tickets,incoming),files:files.map(f=>f.name),updatedAt:new Date().toISOString()};
 await saveQuarter(next);setData(next);setMessage(`${files.length} planilha(s) importada(s). Comparativo atualizado e salvo neste navegador.`);
 }catch(e){setError(e instanceof Error?e.message:'Erro na importação.');setMessage('');}finally{setBusy(false);if(input.current)input.current.value='';}}
 function exportComparison(){
 const header=['Indicador',...months.map(label),'Variação M2/M1','Variação M3/M2'];
 const rows=[header,...metrics.map(m=>[m.name,...monthRows.map(r=>r.available?m.value(r):'Sem base'),pct(monthRows[1]?.available?m.raw(monthRows[1]):undefined,monthRows[0]?.available?m.raw(monthRows[0]):undefined),pct(monthRows[2]?.available?m.raw(monthRows[2]):undefined,monthRows[1]?.available?m.raw(monthRows[1]):undefined)]),[],[dimension==='bank'?'Banco':dimension==='agent'?'Atendente':'Motivo',...months.map(label),'Variação M2/M1','Variação M3/M2'],...breakdown.map(r=>[r.name,...r.values.map((v,i)=>monthRows[i]?.available?v:'Sem base'),pct(monthRows[1]?.available?r.values[1]:undefined,monthRows[0]?.available?r.values[0]:undefined),pct(monthRows[2]?.available?r.values[2]:undefined,monthRows[1]?.available?r.values[1]:undefined)])];
 const quote=(v:unknown)=>{const s=String(v??'');return '"'+(/^[=+@\-\t\r]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';};
 const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(quote).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='comparativo-trimestral.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 type Summary=ReturnType<typeof summarizeMonth>;
 const metrics:{name:string;raw:(r:Summary)=>number|undefined;value:(r:Summary)=>string}[]=[
 {name:'Atendimentos elegíveis',raw:r=>r.total,value:r=>count(r.total)},
 {name:'Atendentes ativos',raw:r=>r.agents,value:r=>count(r.agents)},
 {name:'Tempo médio de atendimento',raw:r=>r.tma??undefined,value:r=>r.tma===null?'Sem tempo válido':formatDuration(r.tma)},
 {name:'Tempo médio de fila',raw:r=>r.tme??undefined,value:r=>r.tme===null?'Sem tempo válido':formatDuration(r.tme)},
 {name:'Comunicados recebidos excluídos',raw:r=>r.excluded,value:r=>count(r.excluded)}];
 return <section className="space-y-5" aria-label="Comparativo trimestral">
 <div className="rounded-lg border bg-card p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Calendar className="size-5 text-primary"/><h2 className="text-xl font-bold">Comparativo trimestral</h2></div><p className="mt-2 text-sm text-muted-foreground">Anexe as planilhas para comparar os três meses até o mês mais recente da base.</p></div><Button onClick={()=>input.current?.click()} disabled={busy||!ready}><Upload className="mr-2 size-4"/>{busy?'Processando…':'Anexar planilhas'}</Button></div>
 <input className="hidden" ref={input} type="file" multiple accept=".xlsx,.xls" disabled={busy||!ready} onChange={e=>void upload(Array.from(e.target.files||[]))}/>
 <p className="mt-4 text-xs text-muted-foreground">Selecione uma ou várias planilhas. Os meses enviados substituem os mesmos meses do comparativo; os demais são preservados. IDs repetidos contam uma vez. Esta aba possui base própria e não altera as demais abas.</p>
 {data&&<p className="mt-2 text-xs text-muted-foreground">Última importação: {new Date(data.updatedAt).toLocaleString('pt-BR')} • {data.files.join(', ')}</p>}
 {message&&<p role="status" className="mt-3 text-sm text-primary">{message}</p>}{error&&<p role="alert" className="mt-3 text-sm text-destructive">{error} A base anterior foi mantida.</p>}
 </div>
 {monthRows.some(r=>!r.available)&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Falta anexar a base de: {monthRows.filter(r=>!r.available).map(r=>label(r.month)).join(', ')}. Ausência de base aparece como “Sem base”, sem calcular variação.</p>}
 <div className="grid gap-4 md:grid-cols-3">{monthRows.map(r=><div key={r.month} className="rounded-lg border bg-card p-5"><p className="text-sm font-medium text-muted-foreground">{label(r.month)}</p><p className="mt-2 text-3xl font-bold">{r.available?count(r.total):'Sem base'}</p><p className="mt-1 text-xs text-muted-foreground">atendimentos elegíveis</p></div>)}</div>
 <div className="rounded-lg border bg-card p-5"><h3 className="mb-4 font-semibold">Evolução dos atendimentos</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthRows.map(r=>({name:label(r.month),Atendimentos:r.available?r.total:null}))}><CartesianGrid vertical={false} strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="Atendimentos" fill="#2563eb" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div></div>
 <DailyQuarter tickets={tickets} months={months}/>
 <div className="overflow-x-auto rounded-lg border bg-card p-5"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-semibold">Indicadores por mês</h3><Button variant="outline" onClick={exportComparison} disabled={!months.length}><Download className="mr-2 size-4"/>Exportar comparativo</Button></div><table className="w-full text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-3">Indicador</th>{months.map(m=><th className="p-3" key={m}>{label(m)}</th>)}<th className="p-3">M2 / M1</th><th className="p-3">M3 / M2</th></tr></thead><tbody>{metrics.map(m=><tr className="border-b last:border-0" key={m.name}><td className="p-3 font-medium">{m.name}</td>{monthRows.map(r=><td className="p-3" key={r.month}>{r.available?m.value(r):'Sem base'}</td>)}<td className="p-3">{pct(monthRows[1]?.available?m.raw(monthRows[1]):undefined,monthRows[0]?.available?m.raw(monthRows[0]):undefined)}</td><td className="p-3">{pct(monthRows[2]?.available?m.raw(monthRows[2]):undefined,monthRows[1]?.available?m.raw(monthRows[1]):undefined)}</td></tr>)}</tbody></table></div>
 <div className="rounded-lg border bg-card p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold"><TrendingUp className="size-4"/>Comparativo detalhado</h3><select aria-label="Agrupar comparativo por" className="rounded-md border bg-background p-2 text-sm" value={dimension} onChange={e=>setDimension(e.target.value as typeof dimension)}><option value="bank">Bancos</option><option value="agent">Atendentes</option><option value="reason">Motivos de acionamento</option></select></div><div className="max-h-[480px] overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-card"><tr className="border-b"><th className="p-3">{dimension==='bank'?'Banco':dimension==='agent'?'Atendente':'Motivo'}</th>{months.map(m=><th key={m} className="p-3">{label(m)}</th>)}<th className="p-3">M2 / M1</th><th className="p-3">M3 / M2</th></tr></thead><tbody>{breakdown.map(r=><tr className="border-b last:border-0" key={r.name}><td className="p-3 font-medium">{r.name}</td>{r.values.map((v,i)=><td key={i} className="p-3">{monthRows[i]?.available?count(v):'Sem base'}</td>)}<td className="p-3">{pct(monthRows[1]?.available?r.values[1]:undefined,monthRows[0]?.available?r.values[0]:undefined)}</td><td className="p-3">{pct(monthRows[2]?.available?r.values[2]:undefined,monthRows[1]?.available?r.values[1]:undefined)}</td></tr>)}</tbody></table></div></div>
 <p className="text-xs text-muted-foreground">M1 é o mês mais antigo; M3, o mais recente. Comparação mês a mês, sem acumular. Base anterior igual a zero não gera percentual. Meses parciais refletem os registros anexados. Mantidas as regras de exclusão e cálculo dos tempos do painel.</p>
 </section>;
}
