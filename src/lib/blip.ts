import type {Ticket} from './tickets';
const clean=(v:unknown)=>v==null||String(v)==='null'?'':String(v).trim();
export function duration(v:unknown):number|null{
 const s=clean(v);if(!s)return null;
 const m=s.match(/^(?:(\d+)d\s+)?(\d+):(\d+):(\d+(?:\.\d+)?)$/);
 if(m)return Number(m[1]||0)*86400+Number(m[2])*3600+Number(m[3])*60+Number(m[4]);
 if(/^\d+(\.\d+)?\s*s$/.test(s))return parseFloat(s);return null;
}
function clock(n:number|null){if(n===null||n<0)return '';n=Math.round(n);return `${Math.floor(n/3600)}:${String(Math.floor(n%3600/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
function date(s:string){const m=s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2}:\d{2})/);return m?`${m[3]}/${m[2]}/${m[1]} ${m[4]}`:'';}
export function convertRows(rows:Record<string,unknown>[]){
 const seen=new Set<string>();let duplicates=0,invalid=0;
 const tickets:Ticket[]=[];
 for(const r of rows){const id=clean(r['SequentialId']);if(!id)continue;if(seen.has(id)){duplicates++;continue;}
 const start=clean(r['StorageDate']),end=clean(r['CloseDate']);if(!date(start)){invalid++;continue;}seen.add(id);
 let tags:string[]=[];try{const t=JSON.parse(clean(r['Tags'])||'[]');tags=Array.isArray(t)?t.map(String):[String(t)];}catch{tags=[clean(r['Tags'])];}
 const queue=duration(r['QueueTime']);const elapsed=(Date.parse(end)-Date.parse(start))/1000;
 tickets.push({id,originator:clean(r['tunnel.originator']),name:clean(r['CustomerName']),phone:clean(r['CustomerPhoneNumber']),agent:clean(r['AgentName'])||'Não informado',tags:tags.join(' | '),department:clean(r['Team']),channel:'Blip',startedAt:date(start),endedAt:date(end),subject:tags.join(' | '),summary:clean(r['Status']),totalTime:clock(Number.isFinite(elapsed)&&elapsed>=0?Math.max(0,elapsed-(queue||0)):null),firstWait:clock(queue),avgWait:clock(duration(r['FirstResponseTime'])),type:clean(r['Status']),transfers:'',longestWaitDepartment:'',longestWait:'',longestWaitStart:'',longestWaitEnd:''});
 }return {tickets,duplicates,invalid};
}
