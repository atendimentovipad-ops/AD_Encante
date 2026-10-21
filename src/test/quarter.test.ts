import {test,expect} from 'vitest';
import {lastThreeMonths,mergeMonths,summarizeMonth,variation} from '../lib/quarter';
import type {Ticket} from '../lib/tickets';
const t=(id:string,date:string,extra:Partial<Ticket>={})=>({id,startedAt:date,subject:'DÚVIDA',agent:'Ana',firstWait:'00:01:00',totalTime:'00:02:00',...extra}) as Ticket;
test('três meses consecutivos relativos à base, inclusive virada do ano',()=>{expect(lastThreeMonths([t('1','05/01/2026 10:00:00')])).toEqual(['2025-11','2025-12','2026-01']);expect(lastThreeMonths([])).toEqual([]);});
test('reimportação substitui mês, preserva histórico e remove IDs repetidos',()=>{
 const old=[t('jul','01/07/2026 00:00:00'),t('ago-antigo','01/08/2026 00:00:00')];
 const incoming=[t('ago','02/08/2026 00:00:00'),t('ago','02/08/2026 00:00:00'),t('set','01/09/2026 00:00:00')];
 expect(mergeMonths(old,incoming).map(t=>t.id)).toEqual(['jul','ago','set']);expect(mergeMonths(mergeMonths(old,incoming),incoming)).toHaveLength(3);
});
test('indicadores mantêm volume, exclusões e denominadores válidos de tempo',()=>{
 const result=summarizeMonth([t('1','01/09/2026 00:00:00'),t('2','01/09/2026 00:00:00',{agent:'Leonardo',totalTime:'10:00:00'}),t('3','01/09/2026 00:00:00',{subject:'COMUNICADO RECEBIDO'}),t('4','01/09/2026 00:00:00',{totalTime:'',firstWait:''})]);
 expect(result.total).toBe(3);expect(result.excluded).toBe(1);expect(result.tma).toBe(120);expect(result.tme).toBe(60);
});
test('variações não transformam falta de base ou zero inicial em percentuais',()=>{expect(variation(120,100)).toBe(20);expect(variation(0,100)).toBe(-100);expect(variation(20,0)).toBeNull();expect(variation(undefined,100)).toBeNull();});

test('comparativo diário alinha mês a mês, exclui comunicados e distingue dia inexistente e base ausente',async()=>{
 const {dailyQuarter}=await import('../lib/quarter');
 const rows=[t('1','01/01/2026 10:00:00'),t('2','01/01/2026 11:00:00'),t('3','31/01/2026 11:00:00'),t('4','01/02/2026 11:00:00'),t('5','01/02/2026 12:00:00',{subject:'COMUNICADO RECEBIDO'})];
 const d=dailyQuarter(rows,['2026-01','2026-02','2026-03']);
 expect(d.days[0]?.values).toEqual([2,1,null]);expect(d.days[1]?.values).toEqual([0,0,null]);expect(d.days[30]?.values).toEqual([1,null,null]);
 expect(d.summary[0]?.average).toBe(1.5);expect(d.summary[0]?.peakDays).toEqual([1]);expect(d.summary[1]?.average).toBe(1);
 expect(d.week.reduce((s,r)=>s+(r.values[0]||0),0)).toBe(3);
 expect(d.days.reduce((s,r)=>s+(r.values[1]||0),0)).toBe(summarizeMonth(rows.filter(t=>t.startedAt.includes('/02/'))).total);
});
test('comparativo diário reconhece fevereiro bissexto e preserva empates de pico',async()=>{
 const {dailyQuarter}=await import('../lib/quarter');const d=dailyQuarter([t('1','01/02/2024 10:00:00'),t('2','29/02/2024 11:00:00')],['2024-02']);
 expect(d.days[28]?.values).toEqual([1]);expect(d.days[29]?.values).toEqual([null]);expect(d.summary[0]?.peakDays).toEqual([1,29]);
});

test('comparativo horário agrupa por abertura e mês e mantém faixa de 07h a 19h',async()=>{
 const {dailyQuarter}=await import('../lib/quarter');
 const d=dailyQuarter([
 t('1','01/07/2026 07:00:00'),t('2','02/07/2026 07:59:59'),
 t('3','03/07/2026 19:59:59'),t('4','01/08/2026 07:30:00'),
 t('5','01/08/2026 07:45:00',{subject:'COMUNICADO RECEBIDO'}),
 t('6','01/07/2026 06:59:59'),t('7','01/07/2026 20:00:00'),
 ],['2026-07','2026-08','2026-09']);
 expect(d.hours).toHaveLength(13);expect(d.hours[0]).toEqual({hour:'07h',values:[2,1,null]});
 expect(d.hours[1]).toEqual({hour:'08h',values:[0,0,null]});
 expect(d.hours[12]).toEqual({hour:'19h',values:[1,0,null]});
 expect(d.hours.reduce((sum,h)=>sum+(h.values[0]||0),0)).toBe(3);
});
