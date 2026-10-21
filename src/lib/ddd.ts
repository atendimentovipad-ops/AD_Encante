import {fullCityList} from './ddd-cities';
import {isExcludedTicket,parseDate,type Ticket} from './tickets';
import {ticketUF} from './uf';
// Localidades de referência: exemplos da área do DDD, não uma lista de cobertura nem localização do contato.
export const DDD_REFERENCES:Record<string,string>={
 '11':'São Paulo','12':'Vale do Paraíba','13':'Baixada Santista','14':'Bauru','15':'Sorocaba','16':'Ribeirão Preto','17':'São José do Rio Preto','18':'Presidente Prudente','19':'Campinas',
 '21':'Rio de Janeiro','22':'Campos dos Goytacazes','24':'Volta Redonda','27':'Vitória','28':'Cachoeiro de Itapemirim',
 '31':'Belo Horizonte','32':'Juiz de Fora','33':'Governador Valadares','34':'Uberlândia','35':'Varginha','37':'Divinópolis','38':'Montes Claros',
 '41':'Curitiba','42':'Ponta Grossa','43':'Londrina','44':'Maringá','45':'Cascavel','46':'Pato Branco','47':'Joinville','48':'Florianópolis','49':'Chapecó',
 '51':'Porto Alegre','53':'Pelotas','54':'Caxias do Sul','55':'Santa Maria',
 '61':'Brasília e entorno','62':'Goiânia','63':'Tocantins','64':'Rio Verde','65':'Cuiabá','66':'Sinop','67':'Mato Grosso do Sul','68':'Acre','69':'Rondônia',
 '71':'Salvador','73':'Ilhéus','74':'Juazeiro','75':'Feira de Santana','77':'Vitória da Conquista','79':'Sergipe','81':'Recife','82':'Alagoas','83':'Paraíba','84':'Rio Grande do Norte','85':'Fortaleza','86':'Teresina','87':'Petrolina','88':'Sobral','89':'Picos',
 '91':'Belém','92':'Manaus','93':'Santarém','94':'Marabá','95':'Roraima','96':'Amapá','97':'Interior do Amazonas','98':'São Luís','99':'Imperatriz'
};
const REGIONS:Record<string,string>={SP:'Sudeste',RJ:'Sudeste',ES:'Sudeste',MG:'Sudeste',PR:'Sul',SC:'Sul',RS:'Sul','DF/GO':'Centro-Oeste',GO:'Centro-Oeste',MT:'Centro-Oeste',MS:'Centro-Oeste',AC:'Norte',RO:'Norte',TO:'Norte',PA:'Norte',AM:'Norte',RR:'Norte',AP:'Norte',BA:'Nordeste',SE:'Nordeste',PE:'Nordeste',AL:'Nordeste',PB:'Nordeste',RN:'Nordeste',CE:'Nordeste',PI:'Nordeste',MA:'Nordeste'};
export function summarizeDDD(tickets:Ticket[]){
 const groups=new Map<string,{ddd:string;uf:string;region:string;reference:string;count:number;hours:number[];missingTime:number}>();
 for(const t of tickets){if(isExcludedTicket(t))continue;const location=ticketUF(t),key=location.ddd||'unknown';
 const g=groups.get(key)||{ddd:key,uf:location.ddd?location.uf:'Não identificada',region:REGIONS[location.uf]||'Não identificada',reference:location.ddd?DDD_REFERENCES[location.ddd]||'Área do DDD':'Sem DDD válido',count:0,hours:Array<number>(24).fill(0),missingTime:0};
 g.count++;const date=parseDate(t.startedAt);if(date&&Number.isFinite(+date))g.hours[date.getHours()]=(g.hours[date.getHours()]||0)+1;else g.missingTime++;
 groups.set(key,g);}
 return [...groups.values()].map(g=>{const peak=Math.max(...g.hours);return {...g,peak,peakHours:peak?g.hours.flatMap((n,h)=>n===peak?[h]:[]):[]};}).sort((a,b)=>a.ddd==='unknown'?1:b.ddd==='unknown'?-1:b.count-a.count||a.ddd.localeCompare(b.ddd));
}
export type DDDRow=ReturnType<typeof summarizeDDD>[number];
export function filterDDD(rows:DDDRow[],ddd:string,uf:string,region:string,search:string){
 const clean=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const term=clean(search.trim());
 return rows.filter(r=>(ddd==='all'||r.ddd===ddd)&&(uf==='all'||r.uf===uf||(r.uf==='DF/GO'&&['DF','GO'].includes(uf)))&&(region==='all'||r.region===region)&&(!term||clean(`${r.ddd} ${r.uf} ${r.region} ${r.reference} ${fullCityList(r.ddd)}`).includes(term)));
}

export function dddExportRows(rows:DDDRow[]){
 return [['DDD','UF','Região do país','Referência da área (não exaustiva)','Cidades do DDD (lista completa)','Atendimentos','Horário(s) de pico (abertura)','Atendimentos em cada pico','Sem data válida'],...rows.map(r=>[r.ddd==='unknown'?'Sem DDD':r.ddd,r.uf,r.region,r.reference,fullCityList(r.ddd)||'Não identificadas',r.count,r.peakHours.map(h=>`${String(h).padStart(2,'0')}:00 às ${String((h+1)%24).padStart(2,'0')}:00`).join(' / '),r.peak,r.missingTime])];
}
