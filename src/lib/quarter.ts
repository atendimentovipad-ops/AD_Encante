import {parseDate,parseDuration,isExcludedTicket,detectTicketBank,type Ticket} from './tickets';
import {isAttendanceTimeEligible} from './attendance-time';
export const monthKey=(t:Ticket)=>{const d=parseDate(t.startedAt);return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`:'';};
export function mergeMonths(previous:Ticket[], incoming:Ticket[]){
 const months=new Set(incoming.map(monthKey).filter(Boolean));
 const records=new Map<string,Ticket>();
 for(const t of [...previous.filter(t=>!months.has(monthKey(t))),...incoming])records.set(t.id,t);
 return [...records.values()];
}
export function lastThreeMonths(tickets:Ticket[]){
 const latest=tickets.reduce((max,t)=>monthKey(t)>max?monthKey(t):max,'');if(!latest)return [];
 const [y,m]=latest.split('-').map(Number);
 return [-2,-1,0].map(offset=>{const d=new Date(y!,m!-1+offset,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;});
}
export function summarizeMonth(tickets:Ticket[]){
 const eligible=tickets.filter(t=>!isExcludedTicket(t));
 const timed=eligible.filter(isAttendanceTimeEligible), waited=eligible.filter(t=>t.firstWait!=='');
 return {total:eligible.length,excluded:tickets.length-eligible.length,agents:new Set(eligible.map(t=>t.agent).filter(a=>a&&a!=='Não informado')).size,
 tma:timed.length?timed.reduce((s,t)=>s+parseDuration(t.totalTime),0)/timed.length:null,
 tme:waited.length?waited.reduce((s,t)=>s+parseDuration(t.firstWait),0)/waited.length:null};
}
export function variation(current:number|undefined,previous:number|undefined){return previous===undefined||current===undefined||previous===0?null:(current-previous)/previous*100;}
export function bankName(t:Ticket){return detectTicketBank(t);}

/** Mesma elegibilidade de volume de Atendimentos por Dia. Ausência de base não é zero. */
export function dailyQuarter(tickets:Ticket[], months:string[]){
 const available=months.map(m=>tickets.some(t=>monthKey(t)===m));
 const lengths=months.map(m=>new Date(Number(m.slice(0,4)),Number(m.slice(5)),0).getDate());
 const counts=months.map(()=>Array<number>(31).fill(0));
 const weekdays=months.map(()=>Array<number>(7).fill(0));
 const hourCounts=months.map(()=>Array<number>(24).fill(0));
 for(const t of tickets){if(isExcludedTicket(t))continue;const i=months.indexOf(monthKey(t));const date=parseDate(t.startedAt);if(i<0||!date)continue;
 counts[i]![date.getDate()-1]=(counts[i]![date.getDate()-1]||0)+1;
 weekdays[i]![date.getDay()]=(weekdays[i]![date.getDay()]||0)+1;
 hourCounts[i]![date.getHours()]=(hourCounts[i]![date.getHours()]||0)+1;}
 const days=Array.from({length:31},(_,d)=>({day:d+1,values:months.map((_,i)=>available[i]&&d<lengths[i]!?counts[i]![d]!:null)}));
 const week=Array.from({length:7},(_,d)=>({day:d,values:months.map((_,i)=>available[i]?weekdays[i]![d]!:null)}));
 const summary=months.map((month,i)=>{const c=counts[i]!;const activeDays=c.filter(n=>n>0).length;const total=c.reduce((s,n)=>s+n,0);const peak=Math.max(...c);const topWeek=Math.max(...weekdays[i]!);
 return {month,available:available[i]!,activeDays,average:activeDays?total/activeDays:0,peak,peakDays:peak?c.flatMap((v,d)=>v===peak?[d+1]:[]):[],peakWeekdays:topWeek?weekdays[i]!.flatMap((v,d)=>v===topWeek?[d]:[]):[]};});
 const hours=Array.from({length:13},(_,i)=>({hour:`${String(i+7).padStart(2,'0')}h`,values:months.map((_,m)=>available[m]?hourCounts[m]![i+7]!:null)}));
 return {days,week,hours,summary};
}
