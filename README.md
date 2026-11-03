# Escala (local) — gestão de escalas para supermercados

> Versão **só com banco local (SQLite)**, para rodar num computador ou servidor da empresa, sem nuvem. Os dados ficam em um único arquivo e não saem da rede da empresa.

Sistema interno de escalas de trabalho para uma rede de supermercados com várias lojas. Ele gera escalas a partir da **demanda por hora** de cada setor e confere cada escala contra a **CLT** e a **EC 141/2026 (fim da escala 6x1)**.

## O que faz

| Módulo | Descrição |
| --- | --- |
| **Painel** | Linha do tempo da transição 44h → 42h → 40h, capacidade de horas da rede em cada regime e status da última escala de cada loja. |
| **Lojas e demanda** | Cadastro de lojas e setores (caixa, reposição, açougue, padaria, hortifrúti…), horários de entrada permitidos e curva de demanda (pessoas por hora × dia da semana), digitada ou calculada a partir das vendas do ERP. |
| **Colaboradores** | Importação por planilha (CSV do Excel), carga contratada, setor, menor de idade, revezamento quinzenal de domingo (art. 386), dias indisponíveis, janela de horário, férias e afastamentos, último domingo de folga. |
| **Escalas** | Geração automática (1 a 12 semanas), grade editável por setor, mapa de cobertura hora a hora, lista de violações e alertas, exportação para CSV (Excel) e impressão. |
| **Dimensionamento** | Mínimo teórico por setor e **simulação com o motor**: quantas pessoas cada setor precisa para manter a cobertura atual com 42h e com 40h. |
| **Configurações** | Nome da empresa, acordo de compensação, autorização de feriados em CCT, preferência por folgas seguidas, absenteísmo, calendário de feriados e remoção dos dados de demonstração. |

## Demanda a partir das vendas do ERP

Em **Lojas e demanda → Editar demanda → Importar vendas do ERP**, envie o relatório de cupons do ERP (.xlsx ou .csv) com a data, o horário e a quantidade vendida de cada cupom. Se a aba de cupons não tiver a data, inclua no mesmo arquivo a aba de notas (NFC-e): o sistema cruza o número do cupom, o número da nota e o valor, como o PROCV da planilha.

1. Soma os itens vendidos em cada hora de cada dia e tira a média por dia da semana. Ficam de fora os feriados nacionais (inclusive a Sexta-feira Santa), os feriados cadastrados para a loja e as datas atípicas que você informar.
2. Operadores necessários na hora = média de itens ÷ itens por operador por hora, arredondado para cima (com tolerância de 0,15), no máximo o número de caixas. Hora com movimento (média de 20 itens ou mais) tem pelo menos 1 operador.
3. A curva calculada aparece ao lado da atual, com o que mudou. **Usar esta demanda** preenche a grade; confira e clique em **Salvar**.

A planilha é lida no navegador (um arquivo de 150 mil cupons leva poucos segundos) e não é enviada ao servidor. Só a curva calculada é salva. Como referência para os itens por operador, a tela mostra quantos itens cada operador passou por hora nas horas de pico do período.

## Proteção de dados (LGPD)

- **Registro de acessos** (menu do administrador): logins e tentativas recusadas; quem abriu, imprimiu ou exportou escalas e a lista de colaboradores; e quem alterou cadastros, usuários e configurações. Cada entrada traz data, hora e IP, com filtros e exportação em CSV. Fica guardado por 12 meses; o Marco Civil da Internet exige no mínimo 6.
- **Página de privacidade** (`/privacidade`, pública): controlador e encarregado (o administrador informa em Configurações), dados tratados, finalidade, base legal, quem vê o quê, prazos, direitos e segurança. É um texto-base: revise com o jurídico.
- **Minimização:** afastamento e licença podem revelar dado de saúde. No mural, para o gerente e no CSV dele, aparecem só como "Ausente"; férias continuam visíveis.
- **Direitos do titular:** na ficha do colaborador, **Exportar dados (LGPD)** (RH/DP e administrador) gera o arquivo com tudo o que o sistema guarda sobre a pessoa (cadastro e escalas publicadas), para atender a um pedido dela.

## Regras de folga e jornada

O regime é escolhido automaticamente pela data de cada semana; também é possível fixar um regime.

| Regime | Vigência | Horas/semana | Folgas/semana | Domingo |
| --- | --- | --- | --- | --- |
| CLT atual (6x1) | até 15/12/2026 | 44h | 1 | 1 domingo de folga a cada 3 semanas |
| EC 141/2026 — transição | 16/12/2026 a 15/12/2027 | 42h | 2 | uma das folgas **preferencialmente no domingo** + mínimo de 1 a cada 3 semanas |
| EC 141/2026 — definitivo | a partir de 16/12/2027 | 40h | 2 | idem |

Verificadas em toda escala (`src/lib/engine/validador.ts`):

- Limite semanal de horas do regime e carga contratada.
- Folgas semanais mínimas, proporcionais quando há férias ou afastamento.
- No máximo 6 dias seguidos de trabalho (OJ 410 SDI-1/TST).
- Domingo de folga ao menos 1x a cada 3 semanas no comércio (Lei 10.101/2000, art. 6º, p.u.) e a cada 2 semanas para quem tem o revezamento quinzenal do art. 386 da CLT.
- Interjornada mínima de 11h (CLT art. 66).
- Descanso semanal de 35h: 24h de DSR + 11h (CLT art. 67; Súmula 110/TST).
- Jornada diária de 8h, ou até 10h com acordo de compensação (CF art. 7º, XIII; CLT art. 59).
- Intervalo intrajornada de 1h acima de 6h e de 15 min entre 4h e 6h (CLT art. 71).
- Menores de 18 anos sem trabalho entre 22h e 5h (CLT art. 404).
- Trabalho em feriado somente com autorização em convenção coletiva (Lei 10.101/2000, art. 6º-A; Portaria MTE 3.665/2023).

> ⚠️ As datas da EC 141/2026 seguem o divulgado pelo Senado na promulgação (16/10/2026). O MTE ainda vai publicar um decreto com exceções e detalhes. Confirme o texto no DOU e ajuste `src/lib/engine/regimes.ts`, onde todas as datas e parâmetros estão concentrados. Valide as configurações com o jurídico/RH e com a convenção coletiva da categoria.
>
> Quando uma semana tem dias nos dois regimes (por exemplo, 14 a 20/12/2026), o motor aplica a regra nova à semana inteira. É a opção mais favorável ao empregado.

## Ciclo de vida da escala

Só o RH/DP (e o administrador) gera e altera escalas; o gerente da loja consulta.

- **Rascunho:** pode ser editada e excluída. Cada alteração é revalidada na hora.
- **Publicada:** fica travada. Só pode ser publicada sem violações legais. Para alterar, é preciso **reabrir informando o motivo**.
- **Histórico de alterações:** registra quem gerou, alterou (antes → depois), publicou e reabriu cada escala, com data e hora. O usuário vem da sessão de login.
- **Impressão:** "Imprimir para o mural" gera uma folha A4 deitada por setor e semana, ou uma folha por colaborador com campo de ciência. Rascunhos saem marcados como "não oficial".
- **Continuidade:** ao gerar uma escala, o sistema lê as 4 semanas anteriores da mesma loja (publicadas têm prioridade sobre rascunhos). Assim mantém o rodízio de domingos, a contagem de dias seguidos e as 11h/35h de descanso na virada do período. Sem isso, duas escalas seguidas podiam somar dezenas de violações na emenda.
- **Feriados:** cada feriado vale para todas as lojas (nacionais/estaduais) ou só para uma loja (municipais).

O banco é atualizado automaticamente ao iniciar uma versão nova (migrações em `src/lib/server/db.ts`). Os dados existentes são preservados.

## Como o motor funciona

`src/lib/engine/gerador.ts` trabalha em duas fases, de forma determinística (mesma entrada → mesma escala):

1. **Folgas.** O rodízio de domingos prioriza quem está há mais domingos trabalhando. Na EC 141, dá a folga dominical a todos que a demanda de domingo permitir. As demais folgas vão para os dias com mais sobra de pessoal, preferindo dias seguidos e respeitando o limite de dias consecutivos.
2. **Turnos.** A jornada de cada dia cabe no horário com demanda do setor (com 30 min de tolerância para abertura e fechamento); em domingos e feriados em que a loja fecha cedo o turno é encurtado e a diferença é compensada nos outros dias da semana. Para cada dia, escolhe a entrada que mais cobre a demanda ainda descoberta, respeitando interjornada, 35h de descanso, disponibilidade e regras de menores. Em seguida uma busca local reotimiza pares de dias consecutivos e posiciona o intervalo de almoço fora dos picos.

**Intervalo de almoço flexível.** Cada turno de 8h24 + 1h de almoço ocupa 9h24 do dia. Quem cobre o pico do almoço ou o da noite passa também pelo vale da tarde, onde sobra gente. Em **Configurações** dá para permitir intervalo de 1h a 1h30 ou de 1h a 2h, que a CLT autoriza sem acordo (art. 71). O motor só alonga o intervalo quando isso cobre mais demanda: o almoço cai no vale e a mesma pessoa cobre os dois picos. Na Loja Modelo (dados fictícios, 16 operadores, 4 semanas a 42h):

| Intervalo | Cobertura | Falta de 18h às 20h (4 semanas) |
| --- | --- | --- |
| Sempre 1h (padrão) | 92,8% | 64 pessoa-hora |
| De 1h a 1h30 | 95,3% | 54 pessoa-hora |
| De 1h a 2h | 97,2% | 25 pessoa-hora |

Intervalo acima de 2h feito à mão na grade aparece como alerta, porque depende de acordo escrito ou convenção coletiva.

Em seguida o validador recalcula conformidade, cobertura e métricas. Toda edição manual na grade passa de novo pelo validador.

Resultado nas lojas de demonstração (35–64 colaboradores por loja, 4 semanas): **zero violações legais**, 90–93% da demanda coberta com intervalo de 1h (92–94% com até 2h), 0,1–0,5 s por loja.

## Instalação na empresa

Requer Node.js ≥ 22.13 (usa o SQLite embutido `node:sqlite`). Roda em qualquer computador ou servidor da empresa (Windows, Linux ou macOS). Os dados ficam em um único arquivo: `data/escala.db`.

```bash
npm install
```

```bash
npm run build
```

```bash
npm start
```

Antes do primeiro `npm start`, crie o arquivo `.env.local` na pasta do sistema:

```
ESCALA_SENHA=UmaSenhaForteAqui123
ESCALA_SEGREDO=uma-frase-longa-e-secreta
```

`ESCALA_SENHA` cria o usuário `admin` com essa senha na primeira vez; `ESCALA_SEGREDO` assina as sessões de login. Não envie esse arquivo para ninguém (o Git já o ignora).

O sistema fica em http://localhost:3000. Para outros computadores da rede acessarem, use o IP do servidor (ex.: http://192.168.0.10:3000) e libere a porta 3000 no firewall. O sistema só funciona enquanto o `npm start` estiver rodando: num servidor, configure-o para iniciar com o computador (serviço do Windows ou systemd no Linux).

Para atualizar: `git pull`, `npm install`, `npm run build` e `npm start` de novo. Os dados são preservados.

### Usuários e acesso

Até existir um usuário, o sistema fica aberto e mostra um aviso. Em **Usuários**, crie o primeiro administrador; a partir daí todos entram com usuário e senha. Há três perfis: **Administrador** (dono do sistema, altera tudo), **RH/DP** (organiza e valida as escalas de todas as lojas) e **Gerente de loja** (consulta a própria loja).

| O que | Administrador | RH/DP | Gerente de loja |
| --- | --- | --- | --- |
| Gerar, alterar, publicar, reabrir e excluir escalas | ✅ | ✅ | ❌ (só consulta, imprime e exporta) |
| Colaboradores e demanda | ✅ todas as lojas | ✅ todas as lojas | ✅ só a própria loja |
| Convenção coletiva, intervalo de almoço e feriados (Configurações) | ✅ | ✅ | ❌ |
| Usuários, criar lojas, nome da empresa, apagar dados | ✅ | ❌ | ❌ |

As regras valem no servidor: mesmo chamando a API direto, quem não tem o perfil recebe 403. O sistema sempre mantém pelo menos um administrador ativo.

Senhas são guardadas com hash (scrypt) e a sessão expira em 7 dias. Depois de 5 senhas erradas, o login fica bloqueado por 5 minutos. Desativar um usuário ou trocar a senha encerra as sessões abertas. Cada um troca a própria senha em **Minha senha**.

Também é possível criar o primeiro administrador pelo ambiente: com `ESCALA_SENHA` (e opcionalmente `ESCALA_USUARIO`, padrão `admin`) definidos, ele é criado ao iniciar, se ainda não houver usuários.

### Tema claro e escuro

No menu lateral, abaixo do nome do usuário (e no canto da tela de login), escolha **Claro**, **Escuro** ou **Auto**. O modo Auto segue o tema do sistema operacional. A escolha fica salva no navegador de cada pessoa. A impressão sai sempre no tema claro.

### Primeiros passos

1. **Usuários:** crie o administrador, os usuários do RH/DP e um gerente para cada loja.
2. **Configurações:** coloque o nome da empresa e clique em **Apagar lojas e colaboradores** para remover a rede de demonstração.
3. **Lojas e demanda:** cadastre cada loja, revise os setores e preencha a curva de demanda (pessoas necessárias por hora).
4. **Colaboradores:** use **Importar planilha** (há um modelo para baixar) e depois ajuste férias, menores e casos especiais. Preencha o "último domingo de folga" para o rodízio continuar de onde parou.
5. **Configurações:** revise acordo de compensação, feriados autorizados na CCT e o calendário de feriados estaduais e municipais.
6. **Escalas:** gere a escala do mês, ajuste o que precisar na grade, **publique** e exporte para o Excel. A escala seguinte já vem sugerida para começar no dia seguinte e continua o rodízio da anterior.

### Banco de dados

**SQLite** em arquivo, embutido no Node.js: não há servidor de banco para instalar. O arquivo é `data/escala.db`; para guardá-lo em outro lugar, defina `ESCALA_DB=/caminho/escala.db` no `.env.local`. As tabelas (prefixo `escala_`) são criadas sozinhas ao iniciar e atualizadas a cada versão nova, sem perder dados.

`ESCALA_SEED` define os dados iniciais de um banco vazio: `demo` (padrão, 4 lojas fictícias) ou `exemplo` (Loja Modelo, uma frente de caixa fictícia com 16 operadores e escala 5x2 pronta). `ESCALA_SEM_DEMO=1` começa vazio.

### Backup

Copie a pasta `data/` (com o sistema parado, ou os três arquivos `escala.db`, `escala.db-wal` e `escala.db-shm` juntos) para outro disco ou para a nuvem da empresa, de preferência todo dia. Para restaurar, pare o sistema e coloque os arquivos de volta em `data/`.

## Desenvolvimento

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run typecheck
```

Na primeira execução o banco é criado com uma rede de demonstração (4 lojas, 5 setores, ~190 colaboradores). Para começar vazio, defina `ESCALA_SEM_DEMO=1`.

## Estrutura

```
src/lib/engine/      motor (TypeScript puro, sem dependências): tipos, regimes, gerador, validador, cobertura, dimensionamento
src/lib/seed/        dados de demonstração
src/lib/importacao.ts  leitura da planilha de colaboradores
src/lib/erp.ts        importação das vendas do ERP (src/lib/xlsx.ts lê o .xlsx no navegador)
src/lib/server/auth.ts  usuários, senhas, sessões e permissões por loja
src/lib/server/      banco SQLite e repositório
src/app/api/         API REST (lojas, setores, colaboradores, feriados, regras, escalas, dimensionamento)
src/app/             páginas (Next.js App Router)
src/components/      componentes de interface
```

## Próximos passos sugeridos

- **Perfil de líder de setor**: acesso restrito a um setor da loja.
- **Avisos ao colaborador** (WhatsApp ou e-mail) quando a escala é publicada ou um pedido é respondido.
- **Integração** com ponto eletrônico e folha (realizado × planejado, banco de horas, adicional de domingos e feriados).
