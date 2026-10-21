"""Regera a referência local de cidades sem ler dados de atendimento.
Uso: python scripts/build-ddd-cities.py PGCN.csv municipios.json
Fonte principal DDD: Anatel; nomes e seis complementos: municípios-brasileiros (MIT).
"""
import csv,json,sys,unicodedata
from pathlib import Path
base=list(csv.DictReader(open(sys.argv[1],encoding='cp1252'),delimiter=';'))
municipios=json.load(open(sys.argv[2],encoding='utf-8-sig'))
by_code={int(r['Código IBGE']):r for r in base}
ufs={11:'RO',12:'AC',13:'AM',14:'RR',15:'PA',16:'AP',17:'TO',21:'MA',22:'PI',23:'CE',24:'RN',25:'PB',26:'PE',27:'AL',28:'SE',29:'BA',31:'MG',32:'ES',33:'RJ',35:'SP',41:'PR',42:'SC',43:'RS',50:'MS',51:'MT',52:'GO',53:'DF'}
# DDD 66 confirmado no telefone institucional de Ipiranga do Norte (fonte no JSON de metadados).
overrides={5104526:66}
groups={}
for m in municipios:
 ibge=int(m['codigo_ibge']);old=by_code.get(ibge)
 ddd=str(overrides.get(ibge,int(old['CoDIGO_NACIONAL']) if old else int(m['ddd'])))
 groups.setdefault(ddd,[]).append({'name':m['nome'],'uf':ufs[int(m['codigo_uf'])],'ibge':str(ibge),'capital':bool(m['capital'])})
assert len(groups)==67
assert sum(map(len,groups.values()))==5571
for ddd,rows in groups.items():
 rows.sort(key=lambda m:unicodedata.normalize('NFKD',m['name']).encode('ascii','ignore').decode().lower())
 assert len({r['ibge'] for r in rows})==len(rows)
out=Path('src/data/ddd-cities.json');out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(dict(sorted(groups.items())),ensure_ascii=False,separators=(',',':')))
print({'ddds':len(groups),'municipios':sum(map(len,groups.values())),'DDD19':len(groups['19'])})
