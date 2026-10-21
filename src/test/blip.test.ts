import {test,expect} from 'vitest';
import {convertRows,duration} from '../lib/blip';
test('Blip: datas, tempos, etiquetas, duplicados e linhas vazias',()=>{
 const r={SequentialId:123,StorageDate:'2026-09-30 17:00:00 -03:00',CloseDate:'2026-09-30 17:02:00 -03:00',Team:'Fila C6',Tags:'["ORIENTAÇÕES"]',QueueTime:'0d 00:00:20',AgentName:'Ana'};
 const v=convertRows([r,r,{}, {...r,SequentialId:456,StorageDate:'inválida'}]);
 expect(v.tickets).toHaveLength(1);expect(v.duplicates).toBe(1);expect(v.invalid).toBe(1);expect(v.tickets[0]?.totalTime).toBe('0:01:40');expect(v.tickets[0]?.startedAt).toBe('30/09/2026 17:00:00');expect(v.tickets[0]?.subject).toBe('ORIENTAÇÕES');
});
test('duração distingue ausência de zero',()=>{expect(duration('null')).toBeNull();expect(duration('0d 00:00:00')).toBe(0);expect(duration('1d 02:03:04')).toBe(93784);expect(duration('27.77 s')).toBe(27.77);});
