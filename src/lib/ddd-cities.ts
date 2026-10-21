import cityData from '@/data/ddd-cities.json';
export interface DDDCity {name:string;uf:string;ibge:string;capital:boolean;}
const cities=cityData as Record<string,DDDCity[]>;
const MAIN:Record<string,string>={'12':'São José dos Campos','13':'Santos','61':'Brasília','63':'Palmas','67':'Campo Grande','68':'Rio Branco','69':'Porto Velho','79':'Aracaju','82':'Maceió','83':'João Pessoa','84':'Natal','95':'Boa Vista','96':'Macapá','97':'Tefé'};
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function citiesForDDD(ddd:string):DDDCity[]{return cities[ddd]||[];}
export function principalCity(ddd:string,reference:string){const list=citiesForDDD(ddd);const candidate=MAIN[ddd]||reference;return list.find(c=>normalize(c.name)===normalize(candidate))?.name||list.find(c=>c.capital)?.name||list[0]?.name||'Não identificada';}
export function fullCityList(ddd:string){return citiesForDDD(ddd).map(c=>`${c.name} (${c.uf})`).join('; ');}
