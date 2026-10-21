import type {Ticket} from './tickets';
export interface QuarterData {tickets:Ticket[];files:string[];updatedAt:string;}
function open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open('ad-quarter',1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function readQuarter():Promise<QuarterData|null>{const db=await open();try{return await new Promise((resolve,reject)=>{const r=db.transaction('data').objectStore('data').get('active');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}finally{db.close();}}
export async function saveQuarter(data:QuarterData){const db=await open();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(data,'active');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
