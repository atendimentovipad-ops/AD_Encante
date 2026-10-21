import {test,expect} from 'vitest';
import {originUF,summarizeUF,ticketUF} from '../lib/uf';
import {convertRows} from '../lib/blip';
import type {Ticket} from '../lib/tickets';
test('DDD vem de originator e aceita telefone nacional e internacional sem confundir DDD 55',()=>{
 expect(originUF('5585999999999@wa.gw.msging.net')).toEqual({uf:'CE',ddd:'85'});
 expect(originUF('+55 (11) 99999-9999').uf).toBe('SP');expect(originUF('55999999999').uf).toBe('RS');
 expect(originUF('5561999999999@wa.gw.msging.net').uf).toBe('DF/GO');
 for(const s of ['120363123456789@g.us','abc5585999999999','+12125551234','5585999999999@tunnel.msging.net','null','5510999999999','123',''])expect(originUF(s).uf).toBe('UF não identificada');
});
test('importação preserva origem sem substituir por CustomerPhoneNumber',()=>{const r=convertRows([{SequentialId:1,StorageDate:'2026-09-01 10:00:00 -03:00',Team:'Fila C6','tunnel.originator':'5585999999999@wa.gw.msging.net',CustomerPhoneNumber:'5511999999999'}]);expect(r.tickets[0]?.originator).toBe('5585999999999@wa.gw.msging.net');});
test('totais, pico agregado por hora e empates respeitam exclusões e origem',()=>{
 const t=(id:string,time:string,extra:Partial<Ticket>={})=>({id,originator:'5585999999999@wa.gw.msging.net',startedAt:time,subject:'DÚVIDA',...extra}) as Ticket;
 const r=summarizeUF([t('1','01/09/2026 10:00:00'),t('2','02/09/2026 10:59:59'),t('3','03/09/2026 11:00:00'),t('4','04/09/2026 11:30:00'),t('5','05/09/2026 10:30:00',{subject:'COMUNICADO RECEBIDO'}),t('6','01/09/2026 23:30:00',{originator:'',phone:'5511999999999'})]);
 expect(r[0]?.uf).toBe('CE');expect(r[0]?.count).toBe(4);expect(r[0]?.peakHours).toEqual([10,11]);expect(r[0]?.peak).toBe(2);expect(r.reduce((s,g)=>s+g.count,0)).toBe(5);expect(r[1]?.uf).toBe('SP');expect(r[1]?.peakHours).toEqual([23]);
});

test('telefone do cliente recupera UF quando origem está ausente, inválida ou não telefônica',()=>{
 for(const originator of [undefined,'','null','1234567890@telegram.gw.msging.net','120363123456789@g.us']){
 expect(ticketUF({...originator===undefined?{}:{originator},phone:'5585999999999'})).toEqual({uf:'CE',ddd:'85',source:'phone'});
 }
 expect(ticketUF({originator:'5511999999999@wa.gw.msging.net',phone:'5585999999999'})).toEqual({uf:'SP',ddd:'11',source:'originator'});
 expect(ticketUF({phone:'invalido'}).source).toBe('unknown');
});

test('não interpreta ID do Telegram copiado para telefone como DDD',()=>{expect(ticketUF({originator:'8591234567@telegram.gw.msging.net',phone:'8591234567'}).source).toBe('unknown');});

test('liderança por faixa horária respeita limites, empates e registros sem UF',async()=>{
 const {leadersByHour}=await import('../lib/uf');
 const t=(id:string,time:string,phone:string,subject='DÚVIDA')=>({id,startedAt:time,phone,subject}) as Ticket;
 const result=leadersByHour([
 t('1','01/09/2026 08:00:00','5571999999999'),t('2','02/09/2026 08:59:59','5571999999999'),
 t('3','01/09/2026 09:00:00','5531999999999'),t('4','02/09/2026 09:30:00','5511999999999'),
 t('5','01/09/2026 08:30:00',''),t('6','01/09/2026 08:30:00','5511999999999','COMUNICADO RECEBIDO'),
 t('7','01/09/2026 23:59:59','5571999999999')]);
 expect(result).toHaveLength(24);expect(result[8]?.leaders).toEqual(['BA']);expect(result[8]?.peak).toBe(2);expect(result[8]?.unknown).toBe(1);expect(result[8]?.share).toBe(100);expect(result[8]?.total).toBe(3);
 expect(result[9]?.leaders).toEqual(['MG','SP']);expect(result[9]?.share).toBe(50);expect(result[7]?.leaders).toEqual([]);expect(result[7]?.share).toBe(0);expect(result[23]?.label).toBe('23:00 às 00:00');
});
