# Como são feitos os cálculos da escala 5x2

Este documento explica, passo a passo, como o sistema monta uma escala 5x2: 5 dias de trabalho e 2 folgas por semana, conforme a EC 141/2026, que acaba com a escala 6x1. Cada regra traz um exemplo numérico.

> ⚠️ As datas e os limites da EC 141/2026 seguem o divulgado pelo Senado na promulgação (16/10/2026). O decreto regulamentador do Ministério do Trabalho ainda pode trazer exceções. Confirme no Diário Oficial e valide o acordo de compensação e a convenção coletiva (CCT) com o RH/jurídico.

## Regimes de jornada

| Regime | Vigência | Horas/semana | Folgas/semana |
|---|---|---|---|
| CLT atual (6x1) | até 15/12/2026 | 44h | 1 |
| EC 141/2026 — transição (5x2) | 16/12/2026 a 15/12/2027 | 42h | 2 (uma preferencialmente no domingo) |
| EC 141/2026 — definitivo (5x2) | a partir de 16/12/2027 | 40h | 2 (uma preferencialmente no domingo) |

O sistema escolhe o regime pela data de cada semana. Também é possível fixar um regime ao gerar a escala, por exemplo para antecipar a 5x2. Quando uma semana tem dias nos dois regimes, aplica-se a regra nova à semana inteira, a opção mais favorável ao empregado.

---

## 1. Jornada diária

**Fórmula:** jornada do dia = horas da semana ÷ 5 dias trabalhados

As horas da semana são as do contrato, limitadas ao máximo do regime.

| Situação | Conta | Jornada/dia |
|---|---|---|
| 5x2 com 42h | 42h ÷ 5 | **8h24** |
| 5x2 com 40h | 40h ÷ 5 | **8h00** |
| Contrato de 36h | 36h ÷ 5 | 7h12 |
| Contrato de 30h | 30h ÷ 5 | 6h00 |

- Um contrato de 44h fica limitado a 42h (ou 40h): ninguém passa do limite do regime.
- **Teto diário:** até 10h com acordo de compensação de jornada (CLT art. 59). Sem acordo, o teto é 8h (CF art. 7º, XIII). Sem acordo, a regra de 42h vira, na prática, 5 × 8h = 40h.
- O resultado é arredondado para baixo em múltiplos de 5 minutos.

## 2. Intervalo de refeição e horário de saída

| Jornada do dia | Intervalo mínimo (CLT art. 71) |
|---|---|
| Acima de 6h | 1 hora |
| Acima de 4h até 6h | 15 minutos |
| Até 4h | Sem intervalo |

**Fórmula:** saída = entrada + jornada + intervalo

**Exemplo:** 07:00 + 8h24 + 1h = **saída às 16:24**.

O sistema coloca o intervalo entre 2h depois da entrada e 2h antes da saída, no horário de menor movimento do setor.

## 3. As duas folgas da semana

### a) Primeiro, a folga de domingo (rodízio)

- No comércio, a folga deve cair no domingo **pelo menos 1 vez a cada 3 semanas** (Lei 10.101/2000, art. 6º, parágrafo único). Ou seja, no máximo 2 domingos seguidos trabalhados.
- Para quem está marcado com revezamento quinzenal (CLT art. 386), é 1 domingo de folga a cada 2 semanas.
- Na 5x2, uma das folgas deve cair **preferencialmente no domingo** (EC 141/2026). O sistema dá folga no domingo a todos que a demanda de domingo permitir, começando por quem está há mais domingos seguidos trabalhando.

### b) Depois, a segunda folga

Vai para o dia da semana com **mais sobra de pessoal**:

**Fórmula:** sobra do dia = pessoas disponíveis − pessoas necessárias

Pessoas necessárias no dia = o maior entre:
- o pico de pessoas numa mesma hora;
- arredondar para cima (pessoa-hora do dia ÷ jornada média).

**Exemplo:** o caixa precisa de 96 pessoa-hora no sábado e o pico é de 12 pessoas às 18h. Com jornada de 8h24: 96 ÷ 8,4 = 11,4 → 12. O pico também é 12, então são **12 pessoas** no sábado.

Quando possível, a segunda folga fica colada à primeira (ex.: domingo + segunda).

### c) Semana com férias ou afastamento

Folgas e horas ficam proporcionais aos dias presentes:

- **Folgas:** arredondar(2 × dias presentes ÷ 7).
  - Exemplo: 3 dias de férias → 4 dias presentes → 2 × 4 ÷ 7 = 1,14 → **1 folga**.
- **Horas:** carga × dias presentes ÷ 7.
  - Exemplo: 42h × 4 ÷ 7 = 24h. Com 3 dias trabalhados, são **8h por dia**.

## 4. Descansos verificados

| Regra | Cálculo | Exemplo |
|---|---|---|
| **Interjornada: 11h** (CLT art. 66) | Entrada do dia seguinte − saída do dia anterior ≥ 11h | Saiu 22:00 → entra no mínimo às 09:00 |
| **Descanso semanal: 35h** (24h de DSR + 11h; CLT art. 67 e Súmula 110/TST) | Ao redor de uma folga isolada | Saiu sábado 22:00, folga no domingo → segunda entra no mínimo às 09:00 |
| **Dias seguidos** (OJ 410 SDI-1/TST) | No máximo 6 dias de trabalho seguidos | Na 5x2 isso raramente é um problema |
| **Menor de 18 anos** (CLT art. 404) | Nenhum turno entre 22h e 5h | — |
| **Feriado** (Lei 10.101/2000, art. 6º-A; Portaria MTE 3.665/2023) | Trabalho em feriado só com autorização em CCT | — |

A **virada entre uma escala e a próxima** também é conferida. O sistema lê as 4 semanas anteriores da loja para continuar o rodízio de domingos, a contagem de dias seguidos e os descansos.

## 5. Domingo ou feriado em que a loja fecha cedo

Quando o horário de movimento do dia é menor que o turno normal, o turno é encurtado para caber nele e a diferença é compensada nos outros dias da semana, sem passar do teto diário.

**Exemplo:** domingo das 08h às 14h (6h). A pessoa tem 42h na semana, em 5 dias.

1. **Domingo:** o maior turno que cabe em 6h é **5h45 + 15 min de intervalo**, das 08:00 às 14:00.
2. **Falta compensar:** 8h24 − 5h45 = **2h39**.
3. **Outros 4 dias:** cerca de 40 min a mais em cada um, de 8h24 para cerca de **9h04**, abaixo do teto de 10h.
4. **Total da semana:** continua **42h**.

Ninguém é escalado fora do horário de movimento do setor, com tolerância de 30 minutos para abertura e fechamento.

## 6. Escolha do horário de entrada

1. Para cada pessoa e cada dia, o sistema testa os horários de entrada permitidos do setor (ex.: 07:00, 08:00, 09:00…).
2. Escolhe o horário que **mais cobre as horas em que falta gente** e **menos coloca gente onde já sobra**, respeitando as regras da seção 4.
3. Depois, uma revisão automática ajusta pares de dias seguidos ao mesmo tempo para melhorar a cobertura sem quebrar os descansos.

**Cobertura (%)** = pessoa-hora atendida ÷ pessoa-hora necessária. O mapa da escala mostra a cobertura hora a hora.

## 7. Quantas pessoas a loja precisa (dimensionamento)

**Quadro mínimo** = o maior entre:

- **(A)** pessoa-hora da semana ÷ (horas por pessoa × (1 − absenteísmo));
- **(B)** pessoas necessárias no dia mais movimentado;
- **(C)** pessoas necessárias no domingo ÷ (1 − 1/3).

O termo (C) existe porque, pelo rodízio, até 1/3 do quadro folga em cada domingo.

**Exemplo — Frente de Caixa:** 500 pessoa-hora/semana, absenteísmo de 5%, pico de 12 pessoas no sábado e 8 no domingo.

| Termo | 42h | 40h |
|---|---|---|
| (A) | 500 ÷ (42 × 0,95) = 12,5 | 500 ÷ (40 × 0,95) = 13,2 |
| (B) | 12 | 12 |
| (C) | 8 ÷ 0,667 = 12 | 12 |
| **Quadro mínimo** | **13 pessoas** | **14 pessoas** |

Esse é um **piso teórico**. Para decidir contratações, use a **simulação** da tela de Dimensionamento: ela gera escalas reais em cada regime e acrescenta pessoas até a cobertura voltar ao nível atual.

**Impacto nas horas com o mesmo quadro:**
- de 44h para 42h: **−4,5%** das horas de trabalho;
- de 44h para 40h: **−9,1%**.

## Exemplo completo — uma semana 5x2 (42h)

| Seg | Ter | Qua | Qui | Sex | Sáb | Dom |
|---|---|---|---|---|---|---|
| FOLGA | 07:00–16:24 | 07:00–16:24 | 10:00–19:24 | 10:00–19:24 | 13:00–22:24 | FOLGA |

Conferência:

- **Horas:** 5 × 8h24 = **42h** ✔
- **Folgas:** 2, uma no domingo, coladas (domingo + segunda) ✔
- **Interjornada:** quarta 16:24 → quinta 10:00 = 17h36 ✔ (mínimo de 11h)
- **Descanso semanal:** sábado 22:24 → terça 07:00 = 56h36 ✔ (mínimo de 35h)

---

## Onde está no código

| Assunto | Arquivo |
|---|---|
| Regimes, datas, teto diário e intervalo | `src/lib/engine/regimes.ts` |
| Folgas, rodízio, jornada por dia e horários | `src/lib/engine/gerador.ts` |
| Conferência das regras legais | `src/lib/engine/validador.ts` |
| Continuidade entre escalas | `src/lib/engine/historico.ts` |
| Dimensionamento e simulação | `src/lib/engine/dimensionamento.ts` |
