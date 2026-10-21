import * as XLSX from 'xlsx';
import {convertRows} from './blip';
self.onmessage=async(e:MessageEvent<File>)=>{try{
 const wb=XLSX.read(await e.data.arrayBuffer(),{type:'array',dense:true});
 const candidates=wb.SheetNames.map(n=>({name:n,rows:XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[n]!,{defval:'',blankrows:false})})).filter(s=>s.rows.some(r=>'SequentialId' in r&&'StorageDate' in r&&'Team' in r));
 if(candidates.length!==1)throw Error('O arquivo deve conter uma única aba com SequentialId, StorageDate e Team.');
 const result=convertRows(candidates[0]!.rows);if(!result.tickets.length)throw Error('Nenhum atendimento com ID e data válidos.');
 self.postMessage({ok:true,...result});
 }catch(err){self.postMessage({ok:false,error:err instanceof Error?err.message:'Falha na leitura do Excel.'});}};
