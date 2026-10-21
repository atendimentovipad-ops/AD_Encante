import {useEffect,useId,useRef,useState} from 'react';
import {Popover,PopoverAnchor,PopoverContent} from '../ui/popover';
import {citiesForDDD,principalCity} from '@/lib/ddd-cities';
export default function DDDCities({ddd,reference}:{ddd:string;reference:string}){
 const cities=citiesForDDD(ddd),principal=principalCity(ddd,reference);
 const [open,setOpen]=useState(false);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const id=useId();
 const cancel=()=>{if(timer.current){clearTimeout(timer.current);timer.current=null;}};
 const show=()=>{cancel();setOpen(true);};const leave=()=>{cancel();timer.current=setTimeout(()=>setOpen(false),250);};
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 if(!cities.length)return <span className="text-muted-foreground">Não identificadas</span>;
 return <Popover open={open} onOpenChange={setOpen}><PopoverAnchor asChild><button type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls={open?id:undefined} aria-label={`Cidades do DDD ${ddd}: ${principal}, ${cities.length} municípios`} onMouseEnter={show} onMouseLeave={leave} onFocus={show} onClick={show} className="text-left font-medium text-primary underline decoration-dotted underline-offset-4">{principal}<span className="ml-1 text-xs font-normal text-muted-foreground">({cities.length})</span></button></PopoverAnchor>
 <PopoverContent id={id} align="start" side="right" collisionPadding={12} className="w-[min(420px,calc(100vw-24px))] p-0" onMouseEnter={cancel} onMouseLeave={leave} onFocusCapture={cancel} onOpenAutoFocus={e=>e.preventDefault()} onCloseAutoFocus={e=>e.preventDefault()} aria-label={`Todos os municípios do DDD ${ddd}`}>
 <div className="flex items-start justify-between gap-3 border-b p-4"><div><h4 className="font-semibold">Cidades do DDD {ddd}</h4><p className="mt-1 text-xs text-muted-foreground">{cities.length} municípios • role para ver a lista completa</p></div><button type="button" aria-label="Fechar lista de cidades" className="rounded px-2 py-1 text-muted-foreground hover:bg-muted" onClick={()=>setOpen(false)}>×</button></div>
 <ul className="max-h-[min(360px,55vh)] overflow-y-auto px-4 py-2 text-sm" tabIndex={0} aria-label="Lista completa de municípios">{cities.map(c=><li key={c.ibge} className="border-b py-1.5 last:border-0">{c.name}<span className="ml-2 text-xs text-muted-foreground">{c.uf}</span></li>)}</ul>
 <p className="border-t p-3 text-xs text-muted-foreground">Cobertura de referência do DDD. Não indica a cidade do contato. Todos os municípios estão incluídos na exportação.</p>
 </PopoverContent></Popover>;
}
