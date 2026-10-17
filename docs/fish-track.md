# Fish Track — Documentação do Projeto

> **Registrar os dados do cultivo de forma simples e transformar esses dados em informações claras sobre a produção.**

| | |
|---|---|
| **Versão do documento** | 1.1 |
| **Fase** | MVP (implementado, em validação) |
| **Stack** | HTML, CSS e JavaScript puros, sem frameworks e sem backend |
| **Atualizado em** | 17/10/2026 |

## Sumário

1. [Objetivo](#1-objetivo)
2. [Problema e mercado](#2-problema-e-mercado)
3. [Público-alvo](#3-público-alvo)
4. [Diferenciais](#4-diferenciais)
5. [Escopo do MVP](#5-escopo-do-mvp)
6. [Conceitos e fluxo](#6-conceitos-e-fluxo)
7. [Páginas](#7-páginas)
8. [Modelo de dados](#8-modelo-de-dados)
9. [Regras de negócio](#9-regras-de-negócio)
10. [Estrutura de arquivos](#10-estrutura-de-arquivos)
11. [Padrões de código](#11-padrões-de-código)
12. [Próximos passos](#12-próximos-passos)
13. [Pontos em aberto](#13-pontos-em-aberto)

---

## 1. Objetivo

O **Fish Track** é um sistema web para **gerenciamento de cultivos de peixes**. Ele ajuda o produtor a acompanhar seus tanques, substituindo o controle feito em **cadernos, fichas ou planilhas** por uma plataforma única, que transforma os registros em indicadores e gráficos fáceis de entender.

O foco é permitir que o produtor saiba, rapidamente, **como está cada tanque e como está a produção como um todo**.

O sistema deve ser **simples, intuitivo e visual**.

---

## 2. Problema e mercado

### 2.1 Problema

Durante o cultivo, o produtor precisa acompanhar periodicamente quantidade de peixes, peso médio, consumo de ração e mortalidade. Quando isso é feito à mão, fica difícil:

- acompanhar a evolução do cultivo;
- comparar períodos e ciclos;
- identificar alterações importantes a tempo;
- consultar o histórico de um tanque;
- controlar vários tanques ao mesmo tempo;
- ter uma visão geral da produção.

### 2.2 Validação da dor

A pesquisa de mercado (out/2026) confirmou que o problema é real:

- Estudos e projetos de extensão (UFFS, IEA-SP, UNEMAT, UFPE, IFRS, Sudoeste Paraense) relatam produção **sem controle sistematizado** e falta de rigor zootécnico entre parte dos produtores.
- A resposta mais comum desses projetos ainda é **entregar planilhas de Excel** e minicursos, o que mostra que o produtor depende de controles manuais.
- No Oeste do Paraná, maior polo de tilápia, a produção se apoia em **pequenas propriedades** que carecem de soluções tecnológicas acessíveis.
- O setor cresce: o Brasil passou de **1 milhão de toneladas** de peixes cultivados em 2025 (Anuário Peixe BR 2026), e a tilapicultura está presente em mais de **110 mil propriedades**.

### 2.3 Concorrentes

| Solução | Perfil | Observação |
|---|---|---|
| **Aquicultura Certa** (Embrapa) | App Android gratuito | Concorrente mais próximo. Tanques, biometria, curva de crescimento, alimentação e relatórios. Começou só com tilápia e tambaqui. |
| **Meu Pescado** | Startup (SC) | App offline e acompanhamento técnico. Também atua na comercialização. |
| **AgroInova** (QFish / InovaPeixe) | Startup / ERP | Foco em ração e qualidade da água. ERP para grandes operações. |
| **Aquabit, Aquaweb, Aquímetro, Blue Aqua** | Softwares nacionais | Mais voltados à carcinicultura. |
| **Fishtalk** (AKVA), **Aquanetix** | Internacionais | Voltados a grandes empresas. |
| **Fish Farm Monitor, Aqua Siri, Fidelaqua** | Apps de loja | Registro por viveiro, alguns com financeiro e funcionários. |

**Conclusão:** a dor está validada, mas o espaço não está vazio. O Fish Track não vai se destacar por ter mais funcionalidades, e sim por ser **o mais simples e o mais flexível** para quem hoje usa caderno.

---

## 3. Público-alvo

Pequeno e médio produtor que:

- controla o cultivo em caderno, fichas ou planilhas;
- tem um ou vários tanques, de uma ou mais espécies;
- nem sempre tem internet estável na propriedade;
- não precisa de um ERP, e sim de uma forma simples de registrar e entender seus dados.

---

## 4. Diferenciais

1. **Qualquer espécie.** A espécie é só uma identificação, e todos os tanques usam a mesma estrutura de registros e indicadores.
2. **Simples de verdade.** Não é um ERP. Um registro deve levar **menos de um minuto**, e a situação do tanque deve ser entendida **olhando a tela**.
3. **Sem internet e em qualquer aparelho.** É web, roda no celular, tablet ou computador, sem instalação, e funciona offline.
4. **Visão de toda a produção.** Um painel único compara todos os tanques.
5. **Os dados são do produtor.** Não é preciso criar conta, e os dados podem ser exportados em CSV a qualquer momento.

---

## 5. Escopo do MVP

### 5.1 Dentro do escopo

- Cadastro, edição e arquivamento de tanques.
- Ciclos de cultivo (povoamento e despesca).
- Registros periódicos com campos opcionais.
- Cálculo de indicadores e gráficos simples.
- Dashboard geral, alertas e calendário.
- Persistência local no navegador (`localStorage`).
- Funcionamento offline (PWA com service worker).
- Exportação CSV e backup/restauração em JSON.
- Layout mobile-first.

### 5.2 Fora do escopo

- Inteligência artificial e previsões.
- Sensores e IoT.
- Gestão financeira e de custos.
- Contas de usuário, login e sincronização em nuvem.
- Integrações externas.
- Campos específicos por espécie.

---

## 6. Conceitos e fluxo

**Produtor → Tanques → Ciclos → Registros → Indicadores → Visualização**

| Conceito | Descrição |
|---|---|
| **Tanque** | Estrutura física de cultivo (tanque, viveiro, tanque-rede). Existe independentemente de estar povoado. |
| **Ciclo** | Período entre o povoamento e a despesca de um tanque. Um tanque pode ter vários ciclos ao longo do tempo. |
| **Registro** | Anotação feita em uma data, dentro de um ciclo, com o que o produtor mediu ou observou naquele dia. |
| **Indicador** | Valor calculado a partir do ciclo e dos registros. Nunca é digitado. |
| **Alerta** | Situação calculada que pede atenção, com base em limites configuráveis. |

**Padronização:** todos os tanques usam a mesma estrutura de dados, indicadores e alertas. Não há campos ou regras específicas por espécie.

---

## 7. Páginas

### 7.1 Dashboard (`index.html`)

Visão geral de toda a produção. A versão principal é a de computador; no celular os blocos se empilham.

- **Cabeçalho:** data por extenso, título, resumo ("3 tanques em cultivo, de 6 cadastrados · 4 alertas pedem atenção") e seletor de período (7 dias, 30 dias, ciclo inteiro; padrão 30 dias) e botão **"Exportar relatório"**, que abre o relatório da produção (seção 7.12) já com a janela de impressão. A escolha do período é lembrada no aparelho, fora dos dados do produtor.
- **Cinco indicadores clicáveis**, cada um com contexto:

| Indicador | Valor | Apoio | Visual |
|---|---|---|---|
| Biomassa total | soma das biomassas | variação em kg e em % no período | minigráfico |
| Peixes no estoque | soma das quantidades | perdas no período | minigráfico |
| Conversão alimentar | FCA geral dos ciclos | FCA do período e selo "Na meta" ou "Acima da meta" | régua de 1,00 a 2,20 com a faixa da meta |
| Mortalidade acumulada | taxa geral | variação em pontos percentuais e selo do limite | barra até o limite |
| Ração fornecida | total no período | média por dia | minigráfico da ração diária |

- **Gráfico principal:** mostra o indicador selecionado, com uma linha por tanque na cor fixa do tanque, eixo com 4 marcas e 5 datas, tooltip com o valor de cada tanque e o total (ou "Geral", para FCA e mortalidade) e, na FCA, a linha da meta. Pode ser filtrado por tanque. Também responde ao teclado: com o gráfico em foco, as setas percorrem os dias. O botão "Baixar imagem" salva o gráfico em PNG (seção 9.9).
- **Alertas:** filtráveis por gravidade, cada um com ícone, gravidade escrita, tanque e link de ação ("Ver registro", "Planejar despesca", "Registrar agora"...).
- **Tanques em cultivo:** um cartão por tanque, com faixa na cor do tanque, anel do peso médio até o peso alvo, peixes, biomassa, FCA, dias até a despesca, barra de capacidade compacta, último registro e ações ("+ Registro", "Ver no gráfico", "Abrir"). Um cartão tracejado resume os tanques sem ciclo.
- O botão de novo registro fica só no menu lateral.

### 7.11 Menu lateral

Em telas largas, coluna escura com a marca, o botão "Novo registro", a navegação com ícones (Visão geral, Tanques e Alertas com contadores, Agenda, Relatórios, Configurações), os **Lembretes de hoje** (seção 7.8: checkbox para concluir, contador "1 de 3", atrasados com o selo "Atrasado", até cinco itens e o link "Adicionar lembrete") e um rodapé com o estado do uso offline e o tempo desde o último backup (em âmbar depois de 7 dias, com o link "Fazer backup agora"). No celular, vira a barra inferior com "Mais".

### 7.2 Tanques (`tanques.html`)

- Lista de todos os tanques com resumo (status, espécie, peixes, biomassa, último registro).
- Filtro por status (ativo, vazio, manutenção, arquivado). Sem filtro, a lista mostra todos menos os arquivados.
- Botão **Novo tanque**.

### 7.3 Detalhes do tanque (`tanque.html?id=...`)

Página própria de cada tanque, organizada em abas:

- **Resumo:** carga do tanque (barra de capacidade da seção 9.8 e densidade de povoamento), indicadores do ciclo atual, gráficos (peso médio, biomassa e mortalidade ao longo do tempo), registros recentes e alertas do tanque.
- **Histórico:** todos os registros do ciclo atual, com edição e exclusão. Permite consultar ciclos anteriores, que ficam só para leitura (RN10).
- **Calendário:** a mesma agenda da seção 7.8, filtrada pelo tanque (sem os chips de tanque e sem a abreviação do tanque nas etiquetas), com o quadro do dia. Lembretes gerais também aparecem.

Cada gráfico da aba Resumo tem o botão "Baixar imagem" (seção 9.9).

Ações: editar tanque, iniciar ciclo, registrar despesca, novo registro, exportar relatório (seção 7.12, já com a janela de impressão), ajustar limites de alerta (num diálogo; campo vazio usa o limite padrão), arquivar e desarquivar (ou excluir, se o tanque nunca teve ciclo). Cada ação aparece só quando o status do tanque permite.

### 7.4 Formulário de tanque (`tanque-form.html`)

Cria ou edita um tanque (nome, espécie, volume, capacidade máxima, status, observações). A capacidade é opcional e pode ser informada em **kg por m³** ou como **carga máxima total (kg)**; o formulário mostra a equivalência na outra unidade, e o sistema guarda sempre kg/m³.

### 7.5 Formulário de ciclo (`ciclo-form.html`)

- **Iniciar ciclo:** data de povoamento, quantidade inicial, peso médio inicial, peso alvo (opcional) e data prevista de despesca (opcional).
- **Registrar despesca:** data, quantidade despescada e peso médio final. Encerra o ciclo.

### 7.6 Novo registro (`registro.html`)

Formulário rápido, com poucos campos e otimizado para o celular:

- Tanque (pré-selecionado quando vier da página do tanque);
- Data (padrão: hoje; vindo da agenda, `registro.html?data=AAAA-MM-DD` preenche o dia escolhido, e uma data futura é ignorada);
- Peso médio, consumo de ração, mortalidade, natalidade, quantidade contada (todos opcionais);
- Observações.

A edição usa o endereço `registro.html?id=...`, e o registro continua no mesmo tanque.

### 7.7 Alertas (`alertas.html`)

Lista de todos os alertas ativos, agrupados por tanque e ordenados por gravidade.

### 7.8 Agenda (`calendario.html`)

Visão mensal com os eventos de todos os tanques e os lembretes. O mesmo componente (`ui/calendario.js`, ligado ao domínio por `pages/agenda.js`) é usado na aba Calendário do tanque.

**Grade do mês**

- Semana começando no domingo, 6 linhas fixas; dias de outros meses esmaecidos. Navegação: mês anterior, próximo e "Hoje".
- Resumo abaixo do título do mês: "39 registros · 11 lembretes" (contagens do mês, respeitando os filtros).
- Cada dia mostra até **3 etiquetas** e "+N mais". Ordem: alertas, ciclo, lembretes, registros. Etiqueta é texto curto + cor, nunca só cor:

| Tipo | Estilo | Exemplo |
|---|---|---|
| Alerta | fundo vermelho suave | "Mortalidade alta · T02" |
| Povoamento | verde-petróleo | "Povoamento · T02" |
| Despesca prevista | contorno verde | "Despesca prevista · T01" |
| Despesca realizada | verde preenchido | "Despesca · T01" |
| Lembrete | fundo branco, borda e sino; riscado se concluído | "Biometria · T05" |
| Registro | fundo neutro com a bolinha da cor do tanque | "Registro · T01" |
| Vários registros no dia | uma etiqueta só, com as bolinhas dos tanques | "3 registros" |

- Abreviação do tanque: "T" + número quando o nome termina em número ("Tanque 01" → "T01"); senão, os 3 primeiros caracteres significativos ("Viveiro Norte" → "Viv"). Texto que não cabe é cortado com reticências, com o nome completo no `title`.
- No celular a célula é estreita demais para texto: as etiquetas viram faixas coloridas, e o texto completo fica no quadro do dia e no nome acessível do botão do dia.
- Hoje com o número em círculo; dia selecionado com borda verde-petróleo. Setas do teclado percorrem os dias.
- **Filtros** em chips liga/desliga: por tanque (Todos / cada tanque não arquivado) e por tipo (Registros, Lembretes, Ciclo, Alertas; pelo menos um fica ligado). Lembretes gerais aparecem com qualquer filtro de tanque.
- Os alertas da agenda são os gerados pelos registros daquele dia: mortalidade no registro e ração acima do limite (seção 9.6).

**Quadro do dia**

- Abre ao clicar num dia, ao lado da grade, que encolhe para caber. No computador, a página já abre com o quadro em **hoje**. No celular, o quadro é uma folha em tela cheia que sobe por baixo, e só abre ao tocar num dia (abrir sozinho esconderia a grade). Fecha pelo "×" ou com Esc, e o foco volta ao dia.
- Cabeçalho: data por extenso, selo "Hoje" quando for o caso e contagem de itens.
- Seções, só as que tiverem conteúdo: **Atrasados** (só no quadro de hoje: ocorrências dos últimos 30 dias não concluídas), **Lembretes** (checkbox para concluir, tanque, "repete a cada 15 dias", editar e remover; remover um lembrete repetido pergunta "Só esta vez" ou "Todas as repetições"), **Registros** (tanque com a cor, resumo e link para editar, quando o ciclo está ativo), **Ciclo** e **Alertas**.
- Dia vazio: "Nada marcado para este dia."
- Rodapé: **"+ Adicionar lembrete"** e **"+ Registro neste dia"** (só para hoje ou datas passadas, RN12; leva a `registro.html?data=...`).

**Formulário de lembrete** (dentro do quadro): título (obrigatório, até 80 caracteres), data (padrão: dia selecionado; qualquer data, passada ou futura), tanque ("Geral" ou um tanque não arquivado), repetir (não repete, a cada 7, 15 ou 30 dias) e observação (opcional, até 300). Erros por campo com `ErroValidacao`. Ao salvar, o lembrete aparece na hora na grade, com uma pequena animação de entrada. O texto de ajuda avisa que, sem servidor, o celular não notifica com o app fechado: o lembrete aparece só dentro do app.

O link "Adicionar lembrete" do menu lateral abre `calendario.html?lembrete=novo`, que já mostra o formulário em hoje.

### 7.9 Configurações (`configuracoes.html`)

- Limites padrão dos alertas e meta de conversão alimentar.
- Exportar CSV de registros ou de lembretes (por tanque ou geral).
- Fazer backup e restaurar dados (JSON).
- Carregar dados de exemplo e apagar todos os dados.

### 7.10 Navegação

Barra inferior fixa no celular (Dashboard, Tanques, **+ Registro**, Alertas, Mais) e menu lateral em telas largas. O item **Mais** abre Agenda, Relatórios e Configurações.

### 7.12 Relatórios (`relatorio.html`)

Relatório pronto para imprimir ou salvar em PDF, sem bibliotecas: o PDF sai da impressão do navegador ("Salvar como PDF"). `relatorio.html?tanqueId=...` mostra o relatório de um tanque; sem parâmetro, o da produção toda. Com `&imprimir=1` (usado pelos botões "Exportar relatório"), a janela de impressão abre sozinha depois de carregar as fontes.

- Na tela: uma folha branca, com a escolha do relatório ("Toda a produção" ou um tanque) e o botão "Imprimir ou salvar PDF" acima dela.
- Na impressão: só a folha, em A4 com margens, sem menu nem botões; cores e fundos mantidos; cartões, gráficos e linhas da tabela não se dividem entre páginas. O título da página ("Fish Track - Relatório Tanque 01 - 2026-10-17") vira o nome sugerido do PDF.
- Cabeçalho: logo, título e data de emissão.
- **Relatório do tanque:** dados do tanque e do ciclo; indicadores com contexto (peixes e perdas, peso médio e alvo, biomassa e densidade, FCA e meta, mortalidade e limite, capacidade, crescimento, dias de cultivo); gráficos de peso, biomassa e mortalidade; alertas ativos; tabela com todos os registros do ciclo. Sem ciclo em andamento, mostra os dados do tanque e o resumo do último ciclo.
- **Relatório da produção:** resumo (tanques em cultivo, peixes, biomassa, ração, mortalidade média, alertas), os tanques sem ciclo, um bloco por tanque em cultivo (indicadores, gráfico de biomassa e último registro) e todos os alertas.

O conteúdo exato ainda será refinado depois dos primeiros testes com produtores (seção 13).

---

## 8. Modelo de dados

### 8.1 Unidades padrão

Os valores são sempre armazenados nestas unidades e convertidos apenas na exibição.

| Grandeza | Unidade |
|---|---|
| Peso médio | gramas (g) |
| Ração | quilogramas (kg) |
| Biomassa | quilogramas (kg) |
| Volume | metros cúbicos (m³) |
| Datas | texto ISO `AAAA-MM-DD` |

### 8.2 Entidades

**Tanque**

```js
{
  id: "uuid",
  nome: "Tanque 01",
  especie: "Tilápia",
  volumeM3: 300,
  densidadeMaximaKgM3: 4,      // kg de peixe por m³ de água; null = não definida
  status: "ativo",             // "ativo" | "vazio" | "manutencao" | "arquivado"
  limitesAlerta: null,         // null = usa os limites padrão; ou objeto parcial
  observacoes: "",
  criadoEm: "2026-10-16T13:00:00.000Z",
  atualizadoEm: "2026-10-16T13:00:00.000Z"
}
```

**Ciclo**

```js
{
  id: "uuid",
  tanqueId: "uuid",
  dataInicio: "2026-08-01",
  quantidadeInicial: 2500,
  pesoMedioInicialG: 5,
  pesoAlvoG: 800,               // opcional
  dataPrevistaDespesca: "2027-02-01", // opcional
  dataDespesca: null,           // preenchida ao encerrar
  quantidadeDespescada: null,
  pesoMedioFinalG: null,
  status: "ativo"               // "ativo" | "encerrado"
}
```

**Registro**

```js
{
  id: "uuid",
  cicloId: "uuid",
  tanqueId: "uuid",
  data: "2026-10-16",
  pesoMedioG: 210,              // opcional
  racaoKg: 25,                  // opcional
  mortalidade: 4,               // opcional
  natalidade: 0,                // opcional
  quantidadeContada: null,      // opcional: contagem real, corrige o estoque
  observacoes: "",
  criadoEm: "2026-10-16T13:00:00.000Z"
}
```

**Lembrete** (seção 7.8)

```js
{
  id: "uuid",
  data: "2026-10-17",           // primeira ocorrência
  titulo: "Biometria quinzenal",
  tanqueId: null,               // null = Geral
  repetirDias: 15,              // null | 7 | 15 | 30
  observacao: "",
  concluidas: ["2026-10-17"],   // datas das ocorrências concluídas
  excluidas: [],                // datas das ocorrências removidas ("só esta vez")
  criadoEm: "2026-10-17T12:00:00.000Z",
  atualizadoEm: "2026-10-17T12:00:00.000Z"
}
```

- **Ocorrência num dia D:** `D >= data`, `D` não está em `excluidas` e, se houver `repetirDias`, `diasEntre(data, D)` é múltiplo de `repetirDias`.
- Remover "só esta vez" um lembrete que não se repete apaga o lembrete.
- Ao arquivar um tanque, seus lembretes ficam no histórico, mas deixam de gerar ocorrências a partir de hoje.

### 8.3 Armazenamento

Uma única chave no `localStorage`. Ela continua se chamando `fishtrack:v1` na versão 2 do formato, para não perder os dados existentes; a versão do formato fica no campo `versao`.

```js
// chave: "fishtrack:v1"
{
  versao: 2,
  tanques: [],
  ciclos: [],
  registros: [],
  lembretes: [],
  config: {
    limitesAlerta: {             // valores padrão da seção 9.5
      mortalidadeRegistroPct: 1,
      mortalidadeAcumuladaPct: 10,
      racaoDiariaPct: 5,
      capacidadePct: 90,
      pesoEsperadoPct: 85,
      diasSemRegistro: 7
    },
    metaFca: 1.6,                // meta de conversão alimentar
    ultimoBackupEm: null         // data e hora do último backup (ISO)
  }
}
```

O `limitesAlerta` de cada tanque usa as mesmas chaves e pode conter só as que forem sobrescritas.

- IDs gerados com `crypto.randomUUID()`.
- O campo `versao` permite migrar os dados quando o formato mudar (seção 8.4).

### 8.4 Migração entre versões

`migrarDados` (em `core/storage.js`) converte os dados uma versão por vez. Ela roda na leitura, que grava o resultado para a conversão acontecer uma vez só, e na restauração de backup. Backups de versão maior que a suportada são recusados com mensagem clara.

**Da versão 1 para a 2:**

1. Cria `lembretes: []`.
2. Em cada tanque, remove `capacidade` (número de peixes) e cria `densidadeMaximaKgM3: null`. O valor antigo fica em `capacidadePeixesLegado`, só como referência: não há conversão possível de peixes para kg/m³, então o produtor informa o novo valor.
3. Cria `config.metaFca = 1.6` e `config.ultimoBackupEm = null`.
4. Define `versao = 2`.

---

## 9. Regras de negócio

### 9.1 Tanques

- **RN01.** Nome e espécie são obrigatórios. O nome é único entre os tanques não arquivados, sem diferenciar maiúsculas nem acentos.
- **RN02.** O volume é obrigatório e maior que zero. A densidade máxima (kg/m³) é opcional, sem valor padrão, e maior que zero quando informada. Informada como carga total, é convertida usando o volume.
- **RN03.** O status `ativo` é definido automaticamente quando há um ciclo ativo, e `vazio` quando não há. `manutencao` e `arquivado` são definidos pelo produtor. Um tanque com ciclo ativo não pode entrar em manutenção.
- **RN04.** Um tanque com histórico não é excluído, e sim **arquivado**. Só é possível excluir um tanque sem nenhum ciclo, e arquivar um tanque sem ciclo ativo. Ao ser desarquivado, ele volta como `vazio`, desde que o nome não esteja em uso por outro tanque (RN01).

### 9.2 Ciclos

- **RN05.** Cada tanque pode ter **no máximo um ciclo ativo**.
- **RN06.** Só é possível iniciar ciclo em tanque `vazio`.
- **RN07.** Quantidade inicial e peso médio inicial são obrigatórios e maiores que zero, e a quantidade é inteira. A data do povoamento não pode ser futura nem anterior à última despesca do tanque. O peso alvo, se informado, deve ser maior que o peso inicial, e a despesca prevista deve ser depois do povoamento.
- **RN08.** Registrar a despesca encerra o ciclo, e o tanque volta a `vazio`.
- **RN09.** A data de despesca não pode ser anterior à data de início nem ao último registro, nem futura.

### 9.3 Registros

- **RN10.** Todo registro pertence a um ciclo ativo. Não há registro em tanque vazio. Registros de ciclos encerrados ficam só para consulta: não podem ser alterados nem excluídos.
- **RN11.** Apenas a **data** é obrigatória, mas pelo menos um campo de medição ou observação deve ser preenchido.
- **RN12.** A data não pode ser futura nem anterior ao início do ciclo.
- **RN13.** Valores numéricos não podem ser negativos. Contagens são inteiras, e o peso médio, se informado, é maior que zero.
- **RN14.** A mortalidade de um registro não pode ser maior que a quantidade estimada de peixes naquela data. A regra é conferida em todos os registros do ciclo a cada inclusão, alteração ou exclusão, porque um registro muda o estoque estimado dos que vêm depois dele.
- **RN15.** Pode haver mais de um registro na mesma data. Os valores de ração, mortalidade e natalidade são somados.

### 9.3.1 Lembretes

- **RN16.** O título do lembrete é obrigatório e tem até 80 caracteres.
- **RN17.** O tanque do lembrete, quando informado, precisa existir e não estar arquivado.
- **RN18.** A repetição só aceita 7, 15 ou 30 dias.

### 9.4 Indicadores

Todos os indicadores são calculados a partir do ciclo e dos registros, ordenados por data.

| Indicador | Fórmula |
|---|---|
| **Quantidade de peixes** | Parte da última `quantidadeContada` (ou da `quantidadeInicial`) e aplica `− mortalidade + natalidade` dos registros posteriores. A contagem é o estoque ao fim do registro em que foi informada. |
| **Peso médio atual** | Último `pesoMedioG` informado. Se nenhum, usa `pesoMedioInicialG`. |
| **Biomassa (kg)** | `quantidade × pesoMedio / 1000` |
| **Ração acumulada (kg)** | Soma de `racaoKg` no ciclo. |
| **Ganho de biomassa (kg)** | `biomassaAtual − biomassaInicial` |
| **Conversão alimentar (FCA)** | `racaoAcumulada / ganhoDeBiomassa`. Exibe "—" se o ganho for ≤ 0. |
| **Taxa de mortalidade (%)** | `mortalidadeAcumulada / quantidadeInicial × 100` |
| **Taxa de sobrevivência (%)** | `100 − taxaDeMortalidade` |
| **Taxa de natalidade (%)** | `natalidadeAcumulada / quantidadeInicial × 100` |
| **Taxa de crescimento (g/dia)** | `(pesoMedioAtual − pesoMedioAnterior) / dias entre as duas pesagens`. A anterior é a última pesagem de outra data; o peso inicial conta como pesagem. |
| **Crescimento no ciclo (g/dia)** | `(pesoMedioAtual − pesoMedioInicial) / dias do início até a última pesagem` |
| **Densidade (kg/m³)** | `biomassa / volumeM3` |
| **Carga máxima (kg)** | `densidadeMaximaKgM3 × volumeM3`. Derivada, nunca armazenada. |
| **Capacidade utilizada (%)** | `biomassa / cargaMaxima × 100`. Sem densidade máxima, não é calculada. |
| **Densidade de povoamento (peixes/m³)** | `quantidadeInicial / volumeM3`. Informativo. |
| **Projeção até o limite (dias)** | `(cargaMaxima − biomassa) / ganho de biomassa por dia entre as duas últimas pesagens`. Só aparece com ganho positivo e resultado entre 1 e 180 dias. Não é previsão: estende o ritmo recente. |
| **Dias de cultivo** | Dias entre `dataInicio` e hoje (ou `dataDespesca`). |

**Dashboard:** os totais somam os tanques com ciclo ativo. As taxas gerais são médias ponderadas pela quantidade inicial de cada ciclo.

**Período do dashboard:** a série diária de cada ciclo repete o último valor conhecido entre registros. O período vai do fim do dia inicial até hoje; um tanque povoado no meio dele parte da biomassa do povoamento. A **variação** compara hoje com o início do período; a **FCA do período** é a ração do período dividida pelo ganho de biomassa do período; as **perdas** são a mortalidade registrada no período. A meta de FCA fica em `config.metaFca` (padrão 1,60) e pode ser sobrescrita por tanque.

**Exibição:** números no formato brasileiro (`1.234,5`), com no máximo 1 casa decimal para percentuais e 2 para FCA.

### 9.5 Alertas

Os alertas são calculados sempre que os dados mudam e não são armazenados. Cada tanque pode sobrescrever os limites padrão.

| Alerta | Condição | Limite padrão | Gravidade |
|---|---|---|---|
| **Mortalidade elevada no registro** | mortalidade do registro > X% da quantidade estimada | 1% | Alta |
| **Mortalidade acumulada elevada** | taxa de mortalidade do ciclo > X% | 10% | Média |
| **Ração acima do limite** | ração do dia > X% da biomassa | 5% | Média |
| **Tanque próximo da capacidade** | capacidade utilizada (biomassa ÷ carga máxima) ≥ X%; não avaliado sem densidade máxima | 90% | Média |
| **Peso médio abaixo do esperado** | peso atual < X% do peso esperado na data* | 85% | Baixa |
| **Tanque sem registro** | nenhum registro há mais de X dias | 7 dias | Baixa |

\* O **peso esperado** é uma interpolação linear entre o peso inicial (na data de início) e o peso alvo (na data prevista de despesca). Esse alerta só é avaliado se o ciclo tiver peso alvo e data prevista.

Os alertas só são avaliados para tanques com ciclo ativo. Os de registro (mortalidade no registro e ração) olham o último dia com registro, somando os registros da mesma data (RN15). O peso médio é comparado com o esperado na data da última pesagem; sem pesagem após o povoamento, esse alerta não é avaliado.

> ⚠️ Os limites padrão são valores iniciais de referência e devem ser **validados com produtores** antes de serem considerados definitivos.

### 9.6 Agenda

Eventos exibidos (`listarEventosCalendario` em `domain/ciclos.js`):

- início do ciclo (povoamento);
- cada registro;
- despesca prevista;
- despesca realizada;
- alertas do dia, calculados a partir dos registros daquela data (somados, RN15): mortalidade no registro acima do limite (gravidade alta) e ração acima do limite (média), com os limites do tanque (`avaliarAlertasDosDias` em `domain/alertas.js`);
- ocorrências de lembretes (seção 8.2).

Na agenda geral, tanques arquivados ficam de fora. A despesca prevista só aparece enquanto o ciclo está ativo. Os eventos de um dia vêm na ordem das etiquetas: alertas, ciclo, lembretes, registros.

### 9.7 Exportação e backup

- **CSV de registros:** um arquivo por tanque ou geral, com uma linha por registro e colunas para tanque, espécie, ciclo, data e todos os campos.
- **CSV de lembretes:** uma linha por lembrete (não por ocorrência): título, tanque ("Geral" quando não tem), primeira data, repetição, datas concluídas e observação.
- Nos dois: separador `;` e decimal com vírgula, para abrir corretamente no Excel em português. O arquivo começa com BOM UTF-8 para manter os acentos, e textos que começam com `=`, `+`, `-` ou `@` recebem um apóstrofo, para o Excel não tratá-los como fórmula.
- **Backup JSON:** exporta o objeto completo do `localStorage` e registra a data em `config.ultimoBackupEm`. A restauração valida a `versao`, migra backups antigos (seção 8.4) e pede confirmação antes de substituir os dados.


### 9.8 Barra de capacidade

O limite real de um tanque é o peso de peixe por volume de água, e não o número de peixes: a carga cresce com o peixe, mesmo quando a quantidade cai. A barra mostra a biomassa atual contra a carga máxima, em três lugares: cartões do Dashboard, lista de tanques e página do tanque.

| Faixa | Cor da água | Rótulo |
|---|---|---|
| até 75% | verde-petróleo | — |
| acima de 75% e abaixo do limite de alerta | âmbar | "Atenção" |
| a partir do limite de alerta do tanque (padrão 90%) | laranja-escuro | "Perto do limite" |
| acima de 100% | vermelho, barra cheia | "Acima do limite" |

- Uma marca vertical indica o limite de alerta do tanque.
- Abaixo da barra: "927,8 kg de 1.200 kg · 3,09 de 4,00 kg/m³" e, se houver, a projeção.
- Sem densidade máxima: barra tracejada com o link "Defina a capacidade".
- Acessibilidade: `role="progressbar"` com o texto completo em `aria-valuetext`.
- Animação só com `transform` e `opacity`: a água enche, a borda ondula, um reflexo atravessa e bolhas sobem (só na barra grande). A agitação aumenta perto do limite, e acima de 100% a ponta pulsa. Com "reduzir movimento", a barra fica parada.

### 9.9 Imagem dos gráficos

O botão "Baixar imagem" (gráfico principal do Dashboard e gráficos do tanque) gera um PNG com `exportarGraficoPng(svg, nomeArquivo, { titulo, subtitulo, legenda })`, em `services/exportacao.js`: SVG → `Image` → `canvas` → `toBlob`. A imagem sai em 2× de resolução, com fundo branco, título, subtítulo (o que está no gráfico) e, no gráfico com vários tanques, a legenda com a cor de cada um. Como o SVG vira imagem fora da página, os estilos calculados de cada elemento vão junto, no próprio SVG.

---

## 10. Estrutura de arquivos

```
fish-track/
├── index.html                # Dashboard
├── tanques.html              # Lista de tanques
├── tanque.html               # Detalhes do tanque (abas)
├── tanque-form.html          # Novo / editar tanque
├── ciclo-form.html           # Iniciar ciclo / registrar despesca
├── registro.html             # Novo / editar registro
├── alertas.html
├── calendario.html
├── relatorio.html            # Relatório para imprimir / salvar PDF
├── configuracoes.html
├── manifest.json             # PWA
├── sw.js                     # Service worker (cache offline)
│
├── css/
│   ├── base.css              # Reset, variáveis (cores, espaçamentos, fontes)
│   ├── layout.css            # Estrutura geral, navegação, grid
│   ├── components.css        # Botões, cartões, formulários, abas, badges
│   └── pages/
│       └── relatorio.css     # Folha do relatório e regras de impressão (A4)
│
├── js/
│   ├── core/
│   │   ├── storage.js        # Único ponto de leitura/escrita no localStorage
│   │   ├── utils.js          # Datas, IDs, helpers gerais
│   │   └── format.js         # Formatação pt-BR (números, datas, unidades)
│   ├── domain/
│   │   ├── tanques.js        # CRUD e regras de tanque
│   │   ├── ciclos.js         # CRUD e regras de ciclo
│   │   ├── registros.js      # CRUD e regras de registro
│   │   ├── indicadores.js    # Cálculos (funções puras)
│   │   ├── alertas.js        # Avaliação de alertas (funções puras)
│   │   ├── lembretes.js      # Lembretes da agenda e suas ocorrências (RN16 a RN18)
│   │   ├── configuracoes.js  # Limites de alerta: padrão e por tanque
│   │   └── validacao.js      # Validações compartilhadas
│   ├── ui/
│   │   ├── nav.js            # Navegação comum
│   │   ├── componentes.js    # Cartões, badges, mensagens, modais
│   │   ├── graficos.js       # Gráficos em SVG e cor fixa por tanque
│   │   ├── icones.js         # Ícones em traço
│   │   └── calendario.js     # Agenda: grade com etiquetas, quadro do dia e formulário de lembrete
│   ├── services/
│   │   ├── exportacao.js     # CSV, backup JSON e PNG dos gráficos
│   │   └── seed.js           # Dados de exemplo
│   └── pages/
│       ├── agenda.js         # Liga a agenda ao domínio (página Agenda e aba do tanque)
│       ├── comum.js          # Menu lateral, contadores, lembretes de hoje, backup e ações dos alertas
│       ├── dashboard.js
│       ├── tanques.js
│       ├── tanque.js
│       ├── tanque-form.js
│       ├── ciclo-form.js
│       ├── registro.js
│       ├── alertas.js
│       ├── calendario.js
│       ├── relatorio.js
│       └── configuracoes.js
│
├── assets/
│   ├── icons/                # Ícones SVG e ícones do PWA
│   └── fonts/                # Figtree e Bricolage Grotesque (woff2, licença OFL)
│
├── tests/
│   ├── unit/                 # Regras e cálculos: node --test
│   └── e2e/                  # Ponta a ponta: abrir tests/e2e/ pelo servidor local
│
└── docs/
    └── fish-track.md         # Este documento
```

**Responsabilidades por camada**

| Camada | Pode acessar | Não pode |
|---|---|---|
| `core` | — | Conhecer regras de negócio ou o DOM |
| `domain` | `core` | Acessar o DOM |
| `ui` | `core` | Ler ou gravar dados diretamente |
| `services` | `core`, `domain` | Acessar o DOM, exceto para disparar download e desenhar o PNG dos gráficos num canvas |
| `pages` | todas (inclusive `pages/comum.js`) | Acessar o `localStorage` diretamente |

---

## 11. Padrões de código

### 11.1 Geral

- **Sem frameworks e sem dependências externas.** Gráficos em SVG próprio, para manter o funcionamento offline.
- **ES Modules** (`<script type="module">`). Cada página carrega apenas o seu arquivo em `js/pages/`.
- Rodar sempre por um **servidor local** (ex.: Live Server do VS Code), porque módulos e service worker não funcionam abrindo o arquivo direto (`file://`).
- Código em **português** para termos do domínio (`tanque`, `ciclo`, `registro`, `biomassa`), sem acentos nos identificadores.

### 11.2 JavaScript

- `const` por padrão, `let` quando houver reatribuição, nunca `var`.
- Nomes: `camelCase` para variáveis e funções, `PascalCase` só para classes, `UPPER_SNAKE_CASE` para constantes.
- Funções com verbo: `calcularBiomassa`, `listarTanques`, `salvarRegistro`.
- **Indicadores e alertas são funções puras:** recebem dados e retornam valores, sem acessar o DOM nem o storage. Isso facilita testar.
- **Todo acesso a dados passa por `storage.js`.**
- Regras de negócio violadas lançam `ErroValidacao` (de `validacao.js`) com uma mensagem por campo, usando como chave o `name` do campo. A página mostra cada mensagem no seu campo.
- Unidades no nome quando não forem óbvias: `pesoMedioG`, `racaoKg`, `volumeM3`.
- Valores de formulário convertidos para número na entrada, e formatados apenas na exibição.
- Inserir texto do usuário com `textContent`, nunca com `innerHTML`.
- Comentários explicam o **porquê**, não o quê. Fórmulas recebem comentário com a referência da regra (ex.: `// RN14`).

### 11.3 HTML

- HTML semântico: `header`, `nav`, `main`, `section`, `button`, `label`.
- Todo campo de formulário tem `label` associado.
- Campos numéricos usam `type="text"` com `inputmode="decimal"` (valores com casas decimais) ou `inputmode="numeric"` (contagens de peixes), para abrir o teclado numérico no celular. Não use `type="number"`: dependendo do navegador e do teclado, ele descarta a vírgula antes de o JavaScript ver o valor ("2,5" vira 25). A conversão é feita por `paraNumero` (`core/utils.js`), no padrão brasileiro: vírgula decimal e ponto de milhar. Os campos também levam `autocomplete="off"` e `pattern` (`[0-9]*[.,]?[0-9]*` para decimais, `[0-9]*` para contagens), que ajuda o teclado do iOS; a validação continua no domínio.
- O `name` de cada campo é igual à propriedade do modelo de dados (`pesoMedioG`, `racaoKg`), e cada campo aponta para sua mensagem de erro com `aria-describedby`.
- Ganchos para o JavaScript usam `data-campo` e `data-indicador` com o nome da propriedade em `camelCase`, nunca classes de estilo.
- O link da página atual no menu é marcado com `aria-current="page"`.
- `lang="pt-BR"` e `meta viewport` em todas as páginas.

### 11.4 CSS

- **Mobile-first:** estilos base para celular, com `@media (min-width: ...)` para telas maiores.
- Cores, espaçamentos e fontes em **variáveis CSS** (`--cor-primaria`, `--espaco-2`) definidas em `base.css`.
- **Fontes:** Figtree no texto (`--fonte`) e Bricolage Grotesque em títulos e números grandes (`--fonte-titulo`), com números tabulares. Os arquivos ficam em `assets/fonts/` e no service worker, nunca no Google Fonts, porque o app precisa abrir offline; a fonte do sistema é a reserva.
- **Cores:** fundo `#f3f2ec`; menu lateral `#0c3c37` com destaque `#5fd0b4`; estados em sucesso, atenção, perigo e informação, cada um com sua versão suave. Texto sempre com contraste mínimo de 4,5:1.
- **Cor fixa por tanque** nos gráficos, pela ordem de criação: `#0e5a52`, `#c47f12`, `#3f68a8`, `#7a4fa0`, `#2f8f6b`, `#b5523b` (`obterCorTanque` em `ui/graficos.js`).
- **Gravidade de alerta sempre com texto** (Alta, Média, Baixa), nunca só cor.
- **Movimento:** durações e curvas ficam em variáveis (`--duracao-rapida`, `--duracao-media`, `--duracao-lenta`, `--atraso-passo`, `--curva-saida`, `--curva-mola`). Com "reduzir movimento", elas zeram em `:root`; animações contínuas (como a da barra de capacidade) recebem `animation: none`. Animações usam `transform`, `opacity` ou `clip-path`, e todo elemento clicável responde ao toque com `:active`, porque o celular não tem hover.
- Classes no padrão **BEM** em kebab-case: `.card`, `.card__titulo`, `.card--alerta`.
- Evitar seletores por ID e `!important`. A única exceção é a regra `[hidden]` em `base.css`, que garante que o atributo `hidden` esconda até elementos com `display` definido por classe.
- Estados visuais usam atributos ARIA quando existem (`aria-current`, `aria-selected`, `aria-invalid`, `aria-pressed`), e não classes modificadoras. O JS altera o atributo, e o CSS reage a ele.
- Classes que só o JS cria (itens de listas, selos por status, calendário e elementos dos gráficos SVG) já estão definidas em `components.css`, com o comentário "gerado pelo JS" indicando a estrutura esperada.
- Área de toque mínima de 44 × 44 px e contraste adequado para uso ao ar livre.

### 11.5 Arquivos e versionamento

- Nomes de arquivos em `kebab-case`.
- Git com commits no padrão **Conventional Commits** em português: `feat: cadastro de tanques`, `fix: cálculo da FCA`, `docs: atualiza regras de alerta`.
- Uma funcionalidade por branch (`feat/novo-registro`).

---

## 12. Próximos passos

### Fase 0 — Preparação

- [ ] Conversar com 3 a 5 piscicultores para validar indicadores, campos do registro e limites dos alertas.
- [ ] Definir identidade visual básica (nome, cores, ícone). Cores e ícone provisórios já aplicados.
- [x] Criar repositório e estrutura de pastas.

### Fase 1 — Base

- [x] `storage.js`, `utils.js` e `format.js`.
- [x] Layout base, navegação e componentes visuais.
- [x] Dados de exemplo (`seed.js`).

### Fase 2 — Cadastros

- [x] Tanques: listar, criar, editar e arquivar.
- [x] Ciclos: iniciar e registrar despesca.
- [x] Registros: criar, editar e excluir.

### Fase 3 — Inteligência dos dados

- [x] `indicadores.js` com todas as fórmulas da seção 9.4.
- [x] Página de detalhes do tanque (resumo e histórico).
- [x] Gráficos em SVG.
- [x] `alertas.js` e página de alertas.

### Fase 4 — Visão geral

- [x] Dashboard.
- [x] Agenda (por tanque e geral), com etiquetas, quadro do dia e lembretes.

### Fase 5 — Dados e offline

- [x] Exportação CSV e backup/restauração JSON.
- [x] Página de configurações.
- [x] PWA: `manifest.json` e service worker.

### Fase 6 — Validação

- [ ] Testar fórmulas com dados reais ou conhecidos.
- [ ] Testar no celular, em tela pequena e sem internet.
- [ ] Teste de uso com produtores e ajustes.

### Depois do MVP (a avaliar)

- Contas de usuário e sincronização em nuvem.
- Gestão de custos.
- Parâmetros de qualidade da água.
- Relatórios em PDF.

---

## 13. Pontos em aberto

| Ponto | Decisão provisória | Validar com |
|---|---|---|
| Limites padrão dos alertas | Valores da seção 9.5 | Produtores / técnicos |
| Incluir o peso dos peixes mortos no ganho de biomassa da FCA | Não incluir no MVP | Técnicos |
| Campo de natalidade é relevante para a maioria dos produtores | Manter como opcional | Produtores |
| Registrar parâmetros da água (oxigênio, pH, temperatura) | Fora do MVP | Produtores |
| Corrigir ou cancelar um ciclo iniciado com dados errados | Não previsto no MVP: hoje só é possível registrar a despesca | Produtores |
| Conteúdo exato dos relatórios em PDF | O da seção 7.12 | Produtores |
