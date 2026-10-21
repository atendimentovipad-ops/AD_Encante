import {isExcludedTicket,parseDate,type Ticket} from './tickets';
const GROUPS:Record<string,string>={SP:'11 12 13 14 15 16 17 18 19',RJ:'21 22 24',ES:'27 28',MG:'31 32 33 34 35 37 38',PR:'41 42 43 44 45 46',SC:'47 48 49',RS:'51 53 54 55','DF/GO':'61',GO:'62 64',TO:'63',MT:'65 66',MS:'67',AC:'68',RO:'69',BA:'71 73 74 75 77',SE:'79',PE:'81 87',AL:'82',PB:'83',RN:'84',CE:'85 88',PI:'86 89',PA:'91 93 94',AM:'92 97',RR:'95',AP:'96',MA:'98 99'};
const MAP=Object.fromEntries(Object.entries(GROUPS).flatMap(([uf,ddds])=>ddds.split(' ').map(ddd=>[ddd,uf])));
export function originUF(value?:string):{uf:string;ddd:string|null}{
 const unknown={uf:'UF não identificada',ddd:null};const s=(value||'').trim();if(!s||s==='null')return unknown;
 const parts=s.split('@');if(parts.length>2||(parts.length===2&&parts[1]?.toLowerCase()!=='wa.gw.msging.net'))return unknown;
 const local=parts[0]||'';if(!/^\+?[\d\s().-]+$/.test(local))return unknown;
 let digits=local.replace(/\D/g,'');if(local.startsWith('+')&&!digits.startsWith('55'))return unknown;
 if((digits.length===12||digits.length===13)&&digits.startsWith('55'))digits=digits.slice(2);
 else if(local.startsWith('+'))return unknown;
 if(![10,11].includes(digits.length))return unknown;
 const ddd=digits.slice(0,2);return MAP[ddd]?{uf:MAP[ddd]!,ddd}:unknown;
}
/** Prefere o remetente telefônico; usa o telefone explícito do cliente quando a origem não permite ler DDD. */
export function ticketUF(ticket:Pick<Ticket,'originator'|'phone'>){
 const origin=originUF(ticket.originator);
 if(origin.ddd)return {...origin,source:'originator' as const};
 const parts=(ticket.originator||'').trim().split('@');
 // Alguns relatórios copiam o ID de usuário do Telegram para CustomerPhoneNumber.
 // O ID não é um telefone, mesmo que comece com um DDD existente.
 if(parts.length===2&&parts[1]?.toLowerCase()!=='wa.gw.msging.net'&&parts[0]?.replace(/\D/g,'')===(ticket.phone||'').replace(/\D/g,''))return {uf:'UF não identificada',ddd:null,source:'unknown' as const};
 const phone=originUF(ticket.phone);
 return {...phone,source:phone.ddd?'phone' as const:'unknown' as const};
}
export function summarizeUF(tickets:Ticket[]){
 const groups=new Map<string,{uf:string;count:number;ddds:Set<string>;hours:number[];missingTime:number}>();
 for(const t of tickets){if(isExcludedTicket(t))continue;const {uf,ddd}=ticketUF(t);const g=groups.get(uf)||{uf,count:0,ddds:new Set<string>(),hours:Array<number>(24).fill(0),missingTime:0};g.count++;if(ddd)g.ddds.add(ddd);
 const date=parseDate(t.startedAt);if(date&&Number.isFinite(+date))g.hours[date.getHours()]=(g.hours[date.getHours()]||0)+1;else g.missingTime++;
 groups.set(uf,g);}
 return [...groups.values()].map(g=>{const peak=Math.max(...g.hours);return {...g,ddds:[...g.ddds].sort(),peak,peakHours:peak?g.hours.flatMap((n,h)=>n===peak?[h]:[]):[]};}).sort((a,b)=>b.count-a.count||a.uf.localeCompare(b.uf));
}
export const hourRange=(h:number)=>`${String(h).padStart(2,'0')}h–${String(h).padStart(2,'0')}h59`;

export const hourInterval=(hour:number)=>`${String(hour).padStart(2,'0')}:00 às ${String((hour+1)%24).padStart(2,'0')}:00`;
export function leadersByHour(tickets:Ticket[]){
 const groups=summarizeUF(tickets);
 return Array.from({length:24},(_,hour)=>{
  const ranking=groups.filter(g=>g.uf!=='UF não identificada'&&g.hours[hour]!>0).map(g=>({uf:g.uf,count:g.hours[hour]!})).sort((a,b)=>b.count-a.count||a.uf.localeCompare(b.uf));
  const identified=ranking.reduce((sum,g)=>sum+g.count,0),peak=ranking[0]?.count||0;
  const unknown=groups.find(g=>g.uf==='UF não identificada')?.hours[hour]||0;
  return {hour,label:hourInterval(hour),ranking,identified,unknown,total:identified+unknown,peak,leaders:ranking.filter(g=>g.count===peak).map(g=>g.uf),share:identified?peak/identified*100:0};
 });
}
