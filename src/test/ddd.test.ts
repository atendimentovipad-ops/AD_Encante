import {test,expect} from 'vitest';
import {summarizeDDD,filterDDD,DDD_REFERENCES} from '../lib/ddd';
import {summarizeUF,originUF} from '../lib/uf';
import type {Ticket} from '../lib/tickets';
const t=(id:string,phone:string,date:string,extra:Partial<Ticket>={})=>({id,phone,startedAt:date,subject:'DÚVIDA',...extra}) as Ticket;
test('separa DDDs da mesma UF e preserva totais, picos e empates',()=>{
 const tickets=[t('1','5585999999999','01/09/2026 08:00:00'),t('2','5585999999999','02/09/2026 08:59:59'),t('3','5588999999999','03/09/2026 09:00:00'),t('4','5588999999999','03/09/2026 10:00:00'),t('5','5585999999999','03/09/2026 08:00:00',{subject:'COMUNICADO RECEBIDO'}),t('6','8591234567','03/09/2026 11:00:00',{originator:'8591234567@telegram.gw.msging.net'})];
 const d=summarizeDDD(tickets);expect(d).toHaveLength(3);expect(d.find(r=>r.ddd==='85')).toMatchObject({uf:'CE',region:'Nordeste',reference:'Fortaleza',count:2,peak:2,peakHours:[8]});expect(d.find(r=>r.ddd==='88')?.peakHours).toEqual([9,10]);expect(d.find(r=>r.ddd==='unknown')?.count).toBe(1);
 expect(d.reduce((s,r)=>s+r.count,0)).toBe(summarizeUF(tickets).reduce((s,r)=>s+r.count,0));
 expect(filterDDD(d,'85','all','all','')).toHaveLength(1);expect(filterDDD(d,'all','CE','Nordeste','fortaleza')).toHaveLength(1);expect(filterDDD(d,'all','SP','all','')).toHaveLength(0);
});
test('cobre todos os DDDs válidos e distingue DDD 55 de DDI 55',()=>{
 expect(Object.keys(DDD_REFERENCES)).toHaveLength(67);for(const ddd of Object.keys(DDD_REFERENCES))expect(originUF(ddd+'999999999').ddd).toBe(ddd);
 const d=summarizeDDD([t('1','55999999999','01/09/2026 23:59:59'),t('2','5561999999999','01/09/2026 00:00:00')]);expect(d.find(r=>r.ddd==='55')?.uf).toBe('RS');expect(d.find(r=>r.ddd==='61')?.uf).toBe('DF/GO');expect(filterDDD(d,'all','GO','all','')).toHaveLength(1);
});
test('mantém volume sem data e não inventa horário de pico',()=>{const d=summarizeDDD([t('1','5511999999999','')]);expect(d[0]?.count).toBe(1);expect(d[0]?.missingTime).toBe(1);expect(d[0]?.peakHours).toEqual([]);expect(summarizeDDD([])).toEqual([]);});

test('lista de municípios cobre os 67 DDDs, não duplica códigos IBGE e inclui exemplos do DDD 19',async()=>{
 const {citiesForDDD,principalCity,fullCityList}=await import('../lib/ddd-cities');const all=Object.keys(DDD_REFERENCES).flatMap(citiesForDDD);
 expect(all).toHaveLength(5571);expect(new Set(all.map(c=>c.ibge)).size).toBe(5571);
 for(const ddd of Object.keys(DDD_REFERENCES)){expect(citiesForDDD(ddd).length).toBeGreaterThan(0);expect(citiesForDDD(ddd).some(c=>c.name===principalCity(ddd,DDD_REFERENCES[ddd]!))).toBe(true);expect(fullCityList(ddd).length).toBeLessThan(32767);}
 expect(citiesForDDD('19').map(c=>c.name)).toEqual(expect.arrayContaining(['Campinas','Hortolândia','Paulínia','Sumaré']));expect(principalCity('19','Campinas')).toBe('Campinas');expect(citiesForDDD('unknown')).toEqual([]);
});
test('exportação contém lista completa de cidades e busca encontra municípios além da principal',async()=>{
 const {dddExportRows}=await import('../lib/ddd');const {citiesForDDD}=await import('../lib/ddd-cities');
 const rows=summarizeDDD([t('1','5519999999999','01/09/2026 08:00:00')]);const exported=dddExportRows(rows);const column=exported[0]!.indexOf('Cidades do DDD (lista completa)');
 for(const city of citiesForDDD('19'))expect(String(exported[1]![column])).toContain(city.name+' ('+city.uf+')');
 expect(filterDDD(rows,'all','all','all','hortolandia')).toHaveLength(1);expect(exported[0]!.length).toBe(exported[1]!.length);
});
