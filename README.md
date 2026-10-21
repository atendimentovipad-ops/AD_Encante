# AD • Dashboard de Atendimento — exportação para Bolt

Versão de 21/10/2026. Projeto React + TypeScript + Vite, com todas as funcionalidades concluídas nesta conversa, incluindo cidades por DDD e exportação da lista completa.

## Importar no Bolt

O pacote ZIP é a cópia do código. Para importar o projeto completo, use a integração com GitHub documentada pelo Bolt:

1. Extraia este ZIP no computador.
2. Crie um repositório privado no GitHub e envie os arquivos extraídos. O arquivo package.json deve ficar diretamente na raiz do repositório, ao lado das pastas src e public.
3. Na página inicial do Bolt, escolha GitHub abaixo da caixa de conversa.
4. Conecte sua conta e selecione o repositório ou informe a URL dele em Import from URL.
5. Confirme em Choose this repository.
6. Envie ao Bolt o texto do arquivo PROMPT-BOLT.txt.

A documentação de anexos do Bolt não lista ZIP como formato de chat suportado. Portanto, não dependa de anexar o ZIP inteiro ao chat como método de importação.

Referências oficiais consultadas em 21/10/2026:
- https://support.bolt.new/integrations/git
- https://support.bolt.new/building/upload-files

## Instalação e comandos

Use Node.js 22.12 ou superior. No terminal, na pasta do package.json:

```sh
npm ci
npm run dev
```

Para verificar o projeto:

```sh
npx tsc --noEmit
npm run test
npm run build
```

Comando de desenvolvimento: npm run dev
Comando de compilação: npm run build
Pasta de saída: dist

Não exige backend, Supabase ou variáveis de ambiente para as funcionalidades atuais. As importações Excel e os cálculos são feitos no navegador. O pacote foi validado localmente; a execução dentro da conta Bolt ainda deve ser conferida após a importação.

## Conteúdo e dados

- src: código de todas as telas, componentes, cálculos e testes.
- public/data.json: base inicial de setembro/2026, com 17.694 atendimentos, incluindo nomes e telefones fornecidos no relatório. Preserve o acesso adequado aos dados ao compartilhar o repositório ou publicar a aplicação.
- src/data/ddd-cities.json: lista de municípios por DDD.
- public/ddd-cities-LICENSE.txt e ddd-cities-sources.json: licença e fontes da base geográfica.
- package-lock.json: versões instaláveis das dependências.
- scripts/build-ddd-cities.py: utilitário opcional para regenerar a referência geográfica; não é necessário executar no Bolt para usar o painel.

Importante: planilhas importadas no site anterior ficam no IndexedDB daquele navegador e daquele endereço. Elas não são transferidas com este ZIP. Depois da mudança de endereço, reimporte as planilhas no novo painel. A base inicial incluída no pacote continua disponível.

## Regras e funcionalidades preservadas

- Importação de Excel nas abas gerais e importação separada de múltiplas planilhas no Comparativo trimestral.
- Comparação dos três meses consecutivos até o mês mais recente da base.
- Comparativos mensais, diários, por dia da semana e por hora.
- Atendimentos por UF, Pico por horário e Atendimentos por DDD.
- Identificação de DDD por tunnel.originator, usando CustomerPhoneNumber quando necessário e rejeitando IDs de Telegram copiados como telefone.
- Cidades do DDD: cidade principal visível; lista completa ao passar o mouse, focar ou clicar; todas as cidades na exportação Exportar DDD.
- Exclusão de COMUNICADO RECEBIDO dos indicadores.
- Exclusão de Leonardo e Tawane apenas dos tempos de atendimento.
- Exportações em CSV compatível com Excel.

## Estrutura do pacote

Os arquivos ficam diretamente na raiz do ZIP. Não inclui node_modules, dist, histórico Git, configuração da conta de hospedagem, credenciais ou arquivos temporários. A configuração de desenvolvimento do ambiente anterior foi removida apenas desta cópia exportada. O site anterior permanece inalterado.
