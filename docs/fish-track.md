# Fish Track — Documentação do Projeto

> **Registrar os dados do cultivo de forma simples e transformar esses dados em informações claras sobre a produção.**

| | |
|---|---|
| **Versão do documento** | 1.1 |
| **Fase** | MVP (implementado, em validação) |
| **Stack** | HTML, CSS e JavaScript puros, sem frameworks e sem backend |
| **Atualizado em** | 17/10/2026 |

##  Sumário

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
| **Biometria por amostragem** | A cada 15 a 30 dias, pesa-se uma amostra (em geral 50 a 100 peixes): peso médio = peso total da amostra ÷ peixes amostrados. A cada biometria, a ração é recalculada. |
| **Tabela de arraçoamento** | Para cada faixa de peso, a taxa de ração (% da biomassa por dia) e o número de refeições. Ração do dia = biomassa × taxa ÷ 100, dividida pelas refeições. |

**Princípio:** o produtor informa só o que mede (lote contado ou pesado, amostra da biometria, ração fornecida e sobra, mortos encontrados), e o sistema calcula o resto.

**Padronização:** todos os tanques usam a mesma estrutura de dados, indicadores e alertas. Não há campos ou regras específicas por espécie.

---

## 7. Páginas

### 7.1 Hoje (`index.html`)

A primeira tela responde "o que eu faço agora?". No computador, as tarefas ficam numa coluna larga ao lado dos tanques; no celular, tudo se empilha nesta ordem.

- **Tarefas do dia** (`domain/tarefas.js`, seção 9.12), por urgência: todo alerta ativo vira tarefa ("Tanque 02 · 45 peixes mortos ontem"), com a ação do alerta (Ver tanque, Planejar despesca, Fazer biometria, Anotar); "Alimentar N tanques · X kg no total" com os tanques que têm ração sugerida e ainda não foram anotados hoje (tanque com alerta "sem registro" não entra de novo); biometrias previstas para hoje; lembretes de hoje e atrasados (selo "Atrasado"), com a caixa "Feito". As feitas descem para "Feito hoje". Lista vazia: "Nada pendente" e o próximo acontecimento ("Próxima biometria: Tanque 02, em 3 dias").
- **Tanques em cultivo:** cartão compacto por tanque, com o estado (seção 9.12) e uma linha de motivo, a ração de hoje (ou o motivo de não haver sugestão) e uma ação.
- **Primeiros passos** (sem nenhum tanque com cultivo): Cadastrar tanque → Povoar tanque → Escolher plano de alimentação → Anotar o primeiro dia, cada passo marcado quando feito.
- **Produção** (recolhida, lembra se ficou aberta): os indicadores gerais com rótulos simples (os estimados com ≈), o gráfico com seletor de período e filtro por tanque, "Baixar imagem" e "Exportar relatório" (seção 7.12). Termos técnicos com o balão de ajuda (seção 11.6).

### 7.15 Folha do dia (`folha.html`)

"Anotar o dia", o destaque do menu: uma linha por tanque com ciclo ativo, com ração (já preenchida com a sugestão, apagável), sobra e mortos, e a caixa "Anotado". "Conforme o plano" preenche a ração sugerida em todas as linhas vazias. "Salvar o dia" grava todas as linhas marcadas de uma vez, tudo ou nada (`salvarFolhaDoDia`): um erro aponta a linha e o campo e nada é salvo. Datas: hoje ou ontem. Um tanque que já tem rotina na data aparece como "Já anotado", com link para editar. `folha.html?tanque=...` destaca o tanque.

### 7.11 Menu lateral

**Logo:** gota d'água com três barras subindo (a água do viveiro e a produção que cresce). No menu escuro a gota fica verde-água com as barras escuras; no fundo claro, gota verde-petróleo com barras verde-água. Arquivos em `assets/icons/`: `icone.svg`, `icone-192.png`, `icone-512.png` e `icone-maskable-512.png` (gota na zona segura central, sobre fundo claro); as propostas originais ficam em `docs/logo/`.

Em telas largas, coluna escura com a marca, o destaque "Anotar o dia" (seção 7.15), a navegação com ícones (Hoje, Tanques e Alertas com contadores, Agenda com o número de lembretes pendentes, Relatórios, Configurações) e um rodapé com o estado do uso offline e o tempo desde o último backup (em âmbar depois de 7 dias, com o link "Fazer backup agora"). No celular, vira a barra inferior com "Mais".

### 7.2 Tanques (`tanques.html`)

- Lista de todos os tanques com o estado (seção 9.12) e a linha de motivo, espécie, peixes (≈), biomassa (≈), último registro e "Ver tanque".
- Filtro por status (ativo, vazio, manutenção, arquivado). Sem filtro, a lista mostra todos menos os arquivados.
- Botão **Novo tanque**.

### 7.3 Detalhes do tanque (`tanque.html?id=...`)

Página própria de cada tanque, organizada em abas:

- **Cabeçalho:** além de nome, espécie, volume, status e ações, a barra de andamento do ciclo: "Dia 84 de 180 · despesca prevista em 96 dias" (sem data prevista, só "84 dias de cultivo", sem barra).
- **Resumo:** só fica em destaque o que ajuda a decidir algo durante o ciclo; nenhum cálculo de `indicadores.js` foi removido, muda só a exibição. Ordem (no celular, uma coluna nesta ordem; no computador, a ração numa coluna larga ao lado dos destaques e o acompanhamento em 3 colunas):
  1. **Ração de hoje** (cartão principal): ração já registrada hoje, botão "+ Registrar alimentação" (registro com o tanque e a data de hoje) e aviso quando a última biometria tem mais de 30 dias. A ração sugerida por dia, por refeição e a faixa, com a barra do que já foi registrado, dependem da tabela de alimentação (Prompt 02, ainda não implementado); até lá, o cartão diz que a sugestão chega com ela.
  2. **Destaques:** Peso médio (barra até o peso alvo, "381 g de 800 g · 48%", "Biometria em 17/10 · há 3 dias", em âmbar acima de 30 dias); Biomassa (estimada) ("+X kg nos últimos 7 dias", "≈ 2.434 peixes"); Capacidade (estimada) (barra de capacidade compacta da seção 9.8 e densidade).
  3. **Acompanhamento:** Mortalidade observada ("Últimos 7 dias: X%", "Real só na despesca"); FCA (estimada) ("X kg de ração consumida para Y kg de ganho", meta); Crescimento (g/dia entre as duas últimas biometrias, "Peso alvo em ~N dias (dd/mm)" com peso alvo e ganho positivo).
  4. **"Ver todos os indicadores"** (recolhido; lembra se ficou aberto, como preferência de tela): tabela com nome, valor e como é calculado, estimados marcados. Natalidade só aparece com nascimento registrado no ciclo.
  5. Gráficos, alertas e registros recentes, como antes.
- **Tanque sem ciclo ativo:** no lugar dos cartões, o resumo do último ciclo encerrado (seção 9.4.1) e "Iniciar ciclo".
- **Histórico:** todos os registros do ciclo atual, com edição e exclusão. Permite consultar ciclos anteriores, que ficam só para leitura (RN10).
- **Calendário:** a mesma agenda da seção 7.8, filtrada pelo tanque (sem os chips de tanque e sem a abreviação do tanque nas etiquetas), com o quadro do dia. Lembretes gerais também aparecem.

Cada gráfico da aba Resumo tem o botão "Baixar imagem" (seção 9.9).

Estado do tanque no cabeçalho (seção 9.12). Ações principais visíveis: "Anotar" (folha do dia com o tanque), "Fazer biometria" e, sem ciclo, "Povoar tanque"; as demais ficam em "Mais ações", com a despesca por último. Valor que não pode ser calculado mostra o motivo e a ação que resolve, nunca um traço solto. Ações: editar tanque, povoar tanque (iniciar ciclo), registrar despesca, novo registro, exportar relatório (seção 7.12, já com a janela de impressão), ajustar limites de alerta (num diálogo; campo vazio usa o limite padrão), arquivar e desarquivar (ou excluir, se o tanque nunca teve ciclo). Cada ação aparece só quando o status do tanque permite.

### 7.4 Formulário de tanque (`tanque-form.html`)

Cria ou edita um tanque (nome, espécie, volume, capacidade máxima, status, observações). A capacidade é opcional e pode ser informada em **kg por m³** ou como **carga máxima total (kg)**; o formulário mostra a equivalência na outra unidade, e o sistema guarda sempre kg/m³.

- **Biometria a cada (dias):** de 1 a 90, padrão 15 (RN25). Define a próxima biometria e o alerta de atraso (seção 9.11).
- **Alimentação** (`#alimentacao`): o plano de alimentação do tanque, com o resumo do plano escolhido, "Editar este plano" e "Criar plano", que abrem o editor da seção 7.14 já com o peso médio e a biomassa do tanque no simulador.

### 7.5 Formulário de ciclo (`ciclo-form.html`)

- **Iniciar ciclo:** data de povoamento; "Como você vai informar o lote?" com **"Contei os peixes"** (quantidade + peso médio) ou **"Pesei o lote"** (biomassa do lote em kg + peso médio da amostra), RN21; peso alvo (opcional) e data prevista de despesca (opcional). O valor calculado aparece ao vivo abaixo dos campos: "Biomassa inicial: 10 kg" ou "≈ 2.471 peixes (estimado)".
- **Iniciar ciclo:** com ciclo encerrado anterior, mostra a caixa "Último ciclo: sobrevivência de X%, FCA de Y, Z dias."
- **Biomassa do lote** e **biomassa final** têm seletor kg · t, com a conversão visível abaixo do campo (seção 8.1).
- **Registrar despesca:** data, **biomassa final** ("Peso total dos peixes despescados."), peso médio final ("Peso médio da amostra.") e quantidade despescada opcional ("Só se os peixes foram contados."), com RN19 e RN20. Encerra o ciclo e leva à página do tanque com o resumo do ciclo (seção 9.4.1).

### 7.6 Registro de um tanque (`registro.html`)

Só a rotina do dia; a biometria tem painel próprio (seção 7.13).

- Tanque (vindo da página do tanque, fica fixo no topo, sem a lista);
- Data (padrão: hoje; vindo da agenda, `registro.html?data=AAAA-MM-DD` preenche o dia escolhido, e uma data futura é ignorada);
- Duas seções recolhíveis, abertas por padrão e opcionais (RN11 continua valendo):
  - **Alimentação:** ração fornecida e sobra (RN23), cada uma com seletor kg · g e a conversão visível ("= 0,5 kg"); a ração sugerida para hoje e o botão "Usar sugestão" (seção 9.10). Sem sugestão, o motivo e o link que resolve ("Sem plano de alimentação · Configurar").
  - **Mortalidade:** mortos encontrados (com a ajuda "Peixes mortos vistos neste dia. O número real só é conhecido na despesca." e a quantidade estimada atual) e causa provável: Desconhecida, Manejo, Predação, Doença, Qualidade da água ou Outra.
- Aviso discreto: "Vai pesar os peixes? Use a Biometria do tanque" (link para `tanque.html?id=...&acao=biometria`).
- Observações e, recolhida em "Mais campos", a natalidade (rara).
- Se houver erro num campo de uma seção recolhida, a seção abre.

A edição usa o endereço `registro.html?id=...`, e o registro continua no mesmo tanque. Um registro só de biometria abre o painel de biometria do tanque. Um registro antigo com peso **e** rotina mostra o peso só para leitura, com "Editar na biometria"; salvar a rotina mantém o peso.

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
- **Planos de alimentação:** os planos salvos para reutilizar (editar, excluir) e "Novo plano", com o editor da seção 7.14. Excluir um plano deixa os tanques que o usavam sem plano.
- **Unidades:** biomassa em kg ou t; ração em kg ou g (padrão: kg e kg), em `config.unidades` (seção 8.1).
- Exportar CSV de registros ou de lembretes (por tanque ou geral).
- Fazer backup e restaurar dados (JSON), com a lista dos problemas do arquivo e os avisos antes de confirmar (seção 8.5).
- **Dados recuperados** (só aparece com algo a recuperar): cópias de dados ilegíveis (baixar, descartar) e "Voltar aos dados de antes da restauração".
- Carregar dados de exemplo e apagar todos os dados.

### 7.10 Navegação

Barra inferior fixa no celular (Dashboard, Tanques, **+ Registro**, Alertas, Mais) e menu lateral em telas largas. O item **Mais** abre Agenda, Relatórios e Configurações.

### 7.13 Painel de biometria (na página do tanque)

A biometria é feita a cada ~15 dias por amostragem, e não junto da rotina diária. Por isso tem um painel próprio (`<dialog>` em `tanque.html`), aberto **a partir do tanque**: o laboratório pensa "vou pesar o tanque 3". Lógica da interface em `js/ui/painel-biometria.js`; orquestração em `js/pages/tanque.js`; domínio em `js/domain/biometrias.js`. A biometria continua gravada como registro (com `pesoMedioG` e `biometria`), para os indicadores não mudarem de fonte.

- **Como se chega:** botão "Fazer biometria" no cabeçalho e no cartão de peso do tanque, aba "Biometrias", ação do alerta "Biometria atrasada" e o quadro do dia da agenda. Endereço: `tanque.html?id=...&acao=biometria` (com `&data=AAAA-MM-DD` opcional, ou `&registro=ID` para editar). Não há item "Biometria" no menu.
- **Topo:** faixa na cor do tanque, o **nome em destaque**, a espécie, o dia do ciclo e "Última biometria: 381 g em 09/10". Não há como trocar de tanque dentro do painel.
- **Modos:**
  - **Amostra** (padrão): data, peixes na amostra (já preenchido com o tamanho da última amostra do tanque), peso total da amostra (kg · g) e, em "Medir comprimento", o comprimento médio. "Pesei em partes" troca o peso total por uma lista de pesagens parciais (peixes e peso de cada uma), que o app soma.
  - **Pesos individuais:** um peso por linha, em g (aceita colar de planilha). O app calcula peixes, total, média, menor e maior peso e o coeficiente de variação (seção 9.11), e guarda a lista em `biometria.pesosIndividuaisG` (RN26).
  - **"Já tenho o peso médio":** só o peso médio.
- **Prévia ao vivo** (ao lado no computador, abaixo no celular): peso médio; comparação com a biometria anterior ("+48,2 g em 15 dias · 3,2 g/dia"); peso alvo ("800 g (68%)"); biomassa ≈ antes e depois; nova ração sugerida, se o tanque tiver plano. Nos pesos individuais, menor e maior peso e o CV com "Lote uniforme" (até 20%) ou "Lote desuniforme: considere classificar". Se o peso médio cair mais de 10% em relação à anterior, um aviso (não bloqueia): "O peso médio caiu em relação à última biometria. Confira os valores."
- **Salvar:** fecha o painel, atualiza a página e mostra "biometria salva … Próxima biometria: dd/mm".
- **Salvar e ir para o próximo tanque** (rodada de biometria): salva e abre o painel do próximo tanque com ciclo ativo ainda não pesado na data, primeiro os mais atrasados e os previstos para hoje. O topo mostra "Agora: Tanque 05" com uma animação curta. Sem próximo, o botão não aparece.
- **Fechar** com algo digitado pede "Descartar esta biometria?".
- **Aba "Biometrias"** na página do tanque: data, como pesou (povoamento, amostra, pesos individuais, peso médio), peixes na amostra, peso médio, ganho desde a anterior, g/dia e CV; editar abre o painel; excluir só no ciclo ativo e só registros só de biometria.
- No Histórico, os registros de biometria aparecem com a etiqueta "Biometria" e o resumo "50 peixes · 60 g".

### 7.14 Plano de alimentação

Na interface, "tabela de alimentação" / "arraçoamento" passou a se chamar **Plano de alimentação**; o termo técnico só aparece no texto de ajuda. Os nomes internos (`tabelasArracoamento`, `tabelaArracoamentoId`, `arracoamento.js`) ficaram. O editor (`js/ui/editor-plano.js`, num `<dialog>`) é o mesmo em Configurações e no formulário do tanque:

- **Explicação no topo:** "O plano diz quanto de ração dar por dia, como uma porcentagem do peso total dos peixes no tanque. Exemplo: se o tanque tem 500 kg de peixe e o plano diz 3%, você dá 15 kg de ração por dia. Com 4 refeições, são 3,75 kg em cada."
- **Dois tipos:** "Porcentagem fixa" (`tipo: "fixo"`: uma taxa e as refeições) e "Muda com o tamanho do peixe" (`tipo: "faixas"`).
- **Faixas como frases:** "Peixes de 190 g a 225 g → 3,4% do peso total por dia, em 4 refeições", editadas com rótulos completos ("Peso dos peixes: de ___ g até ___ g", "Quanto dar por dia: ___ % do peso total do tanque", "Dividir em ___ refeições"). "Adicionar faixa" começa no "até" da faixa anterior.
- **Régua** com as faixas lado a lado e o marcador "seus peixes estão aqui" no peso médio do simulador.
- **Simulador**, atualizado na hora (no tanque, já com o peso médio e a biomassa dele): "Faixa usada: 520 a 565 g → 1,9% → 19,4 kg por dia, 4 refeições de 4,85 kg". Fora das faixas: "Nenhuma faixa cobre 112 g. Adicione uma faixa para peixes menores."
- **"Usar um modelo":** o modelo Embrapa, com a fonte no nome e o aviso: "Este modelo vale para tilápia de 190 g a 1 kg com ração de 32% de proteína. A porcentagem certa depende da espécie, da ração e da temperatura da água: confira com o fabricante da ração ou com o seu técnico."
- Mensagens de validação em linguagem simples ("Esta faixa se sobrepõe à de 190 a 225 g.", "O peso final da faixa precisa ser maior que o inicial.").
- Na página do tanque, o cartão "Ração de hoje" mostra "Plano: <nome> · Ver plano".

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

**Na interface:** todo campo e todo valor de peso mostram a unidade. Onde a escala varia, o campo tem um seletor explícito (o mesmo segmentado), com a conversão visível abaixo enquanto se digita ("= 500 g", "= 1,25 t"); a última unidade escolhida em cada campo fica lembrada no aparelho (preferência de tela, fora de `fishtrack:v1`). Nunca se adivinha a unidade.

| Campo | Unidades | Padrão |
|---|---|---|
| Peso total da amostra (biometria) | kg · g | kg |
| Ração fornecida e sobra (registro) | kg · g | kg |
| Biomassa do lote (povoamento por pesagem) | kg · t | kg |
| Biomassa final (despesca) | kg · t | kg |
| Peso médio (povoamento, despesca, "já tenho o peso médio") | g | g (sem seletor) |

**Exibição:** biomassa e ração seguem a preferência de Configurações (`config.unidades = { biomassa: "kg" | "t", racao: "kg" | "g" }`, padrão kg e kg) em todas as telas, gráficos (com a unidade no título) e relatórios, e **nunca trocam de unidade sozinhas** conforme o tamanho do número. Em `core/format.js`: `converterParaBase(valor, unidade, grandeza)`, `formatarBiomassa(kg)` e `formatarRacao(kg)`; a página define a preferência ao abrir (`definirUnidadesExibicao`). O CSV continua em kg, com a unidade no cabeçalho. As conversões arredondam o ruído do ponto flutuante (32,55 kg viraria 32.549,999… g).

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
  tabelaArracoamentoId: null,  // plano de alimentação (config.tabelasArracoamento) ou null
  intervaloBiometriaDias: 15,  // biometria a cada N dias (RN25)
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
  modoPovoamento: "contagem",   // "contagem" (peixes contados) | "pesagem" (lote pesado)
  quantidadeInicial: 2500,      // informada ou calculada (biomassa ÷ peso médio)
  pesoMedioInicialG: 5,
  biomassaInicialKg: 12.5,      // informada ou calculada (quantidade × peso médio)
  pesoAlvoG: 800,               // opcional
  dataPrevistaDespesca: "2027-02-01", // opcional
  dataDespesca: null,           // preenchida ao encerrar
  biomassaFinalKg: null,        // pesada na despesca (obrigatória ao encerrar)
  pesoMedioFinalG: null,        // peso médio da amostra na despesca
  quantidadeDespescada: null,   // opcional: só se os peixes foram contados
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
  biometria: {                  // opcional: amostra pesada (o pesoMedioG sai dela)
    peixesAmostra: 50,
    pesoAmostraG: 10500,
    comprimentoMedioCm: 24.5,   // opcional
    pesosIndividuaisG: null     // opcional: [102.5, 98, ...] no modo de pesos individuais (RN26)
  },
  racaoSobraKg: null,           // opcional: consumida = racaoKg − sobra
  mortalidade: 4,               // opcional: mortos encontrados no dia (observação parcial)
  causaMortalidade: null,       // opcional: "desconhecida" | "manejo" | "predacao" | "doenca" | "qualidade-agua" | "outra"
  natalidade: 0,                // opcional
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

Uma única chave no `localStorage`. Ela continua se chamando `fishtrack:v1` na versão 5 do formato, para não perder os dados existentes; a versão do formato fica no campo `versao`.

```js
// chave: "fishtrack:v1"
{
  versao: 5,
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
    ultimoBackupEm: null,        // data e hora do último backup (ISO)
    tabelasArracoamento: [],     // planos: [{ id, nome, tipo: "fixo" | "faixas", taxaPct?, refeicoes?, faixas: [{ pesoDeG, pesoAteG, taxaPct, refeicoes }] }]
    unidades: { biomassa: "kg", racao: "kg" }  // exibição: biomassa kg | t, ração kg | g
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

**Da versão 2 para a 3** (quantidade estimada e fechamento do ciclo pela biomassa):

1. Em cada registro, remove `quantidadeContada`. Se o registro ficar sem nenhuma medição e sem observação, grava em `observacoes` "Contagem registrada: N peixes", para não perder a informação nem violar a RN11.
2. Em cada ciclo encerrado, cria `biomassaFinalKg = quantidadeDespescada × pesoMedioFinalG / 1000`; nos ativos, `biomassaFinalKg: null`.

**Da versão 3 para a 4** (entradas mínimas e ração sugerida):

1. Ciclos: `modoPovoamento = "contagem"` e `biomassaInicialKg = quantidadeInicial × pesoMedioInicialG / 1000`.
2. Registros: `biometria = null`, `racaoSobraKg = null`, `causaMortalidade = null`.
3. Tanques: `tabelaArracoamentoId = null`.
4. Config: `tabelasArracoamento = []`.

**Da versão 4 para a 5** (biometria no tanque, unidades e plano de alimentação):

1. Tanques: `intervaloBiometriaDias = 15`.
2. Planos de alimentação existentes: `tipo = "faixas"`.
3. Registros com `biometria`: acrescenta `pesosIndividuaisG = null` dentro de `biometria`.
4. Config: `unidades = { biomassa: "kg", racao: "kg" }`.

Backups das versões 1 a 4 continuam podendo ser restaurados: passam pelas migrações em sequência.

### 8.5 Falhas de leitura, restauração e espaço

Regra: o app **nunca** troca dados que não conseguiu ler por uma base vazia gravada, e nenhuma operação mostra sucesso se a gravação falhou.

- **Estado do armazenamento** (`verificarEstadoArmazenamento()` em `storage.js`): `ok`, `ilegivel` (JSON inválido ou estrutura corrompida), `versaoMaisNova` (`versao` maior que `VERSAO_DADOS`) ou `somenteMemoria` (migração lida mas não gravada por falta de espaço).
- **Ilegível ou versão mais nova:** `fishtrack:v1` fica exatamente como está, `salvarDados` recusa com `ErroArmazenamentoBloqueado`, e toda página mostra a **tela de bloqueio** no lugar do conteúdo (`pages/protecao.js`). Versão mais nova: "Tentar de novo" e "Baixar os dados". Ilegível: "Baixar os dados" (conteúdo bruto), "Restaurar um backup" (mesmas validações de Configurações) e "Começar uma base nova", que exige a caixa "Entendo que os dados atuais serão substituídos" e a confirmação. A base nova só é gravada depois de guardar o conteúdo em `fishtrack:v1:ilegivel:<data ISO>` e conferir a cópia caractere por caractere; se a cópia falhar, nada muda. Depois, ficam só as 3 cópias datadas mais novas. Um download não libera a operação: o app não sabe se o arquivo foi salvo.
- **Armazenamento cheio na migração (`somenteMemoria`):** os dados antigos ficam intactos e os migrados são usados só em memória; a migração é tentada de novo a cada abertura. O app fica **só para leitura** (cada tela é uma página, e o que ficasse só em memória se perderia): os formulários ficam desativados e uma faixa oferece "Baixar os dados", "Tentar salvar de novo" e "Dados recuperados".
- **Gravação no estado `ok`:** cada leitura devolve uma cópia nova; o que está salvo só muda quando `setItem` funciona. Se falhar: "Não foi possível salvar: o armazenamento está cheio. Nada foi alterado." (`ErroArmazenamentoCheio`).
- **Restaurar backup:** a análise trabalha numa cópia independente do arquivo (`analisarBackup` em `services/exportacao.js`): `validarEstrutura` completa todo o `config` com os padrões (`criarConfigPadrao`) e recusa formato inválido (`tabelasArracoamento` que não é lista, plano sem faixas válidas, unidade fora de kg/t e kg/g, coleção que não é lista); `verificarIntegridade` (`domain/integridade.js`, pura) aponta erros (IDs repetidos, ciclo ou registro apontando para o que não existe ou para outro tanque, mais de um ciclo ativo no tanque, campos essenciais inválidos), que impedem a restauração, e avisos (lembrete de tanque inexistente, que vale como Geral; tanque arquivado com lembrete futuro), mostrados antes de confirmar. No máximo 10 de cada, com "e mais N". Antes de gravar, os dados atuais vão para `fishtrack:v1:antes-da-restauracao` (só a última), conferida; sem ela, a restauração é cancelada. Dados ilegíveis vão para uma cópia datada, como na base nova.
- **Dados recuperados** (Configurações, tela de bloqueio e faixa de espaço): cada cópia datada com "Baixar cópia" e "Descartar"; e "Voltar aos dados de antes da restauração", que valida a cópia como um backup e só a apaga depois de gravar.

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
- **RN19.** A despesca fecha o ciclo pelo que foi pesado: **biomassa final (kg)** e **peso médio final (g)** são obrigatórios e maiores que zero. A **quantidade despescada** é opcional (só se os peixes foram contados), inteira e ≥ 0.
- **RN20.** Com a quantidade despescada informada, `quantidade × peso médio` não pode diferir mais de 20% da biomassa final. Se diferir, a despesca é recusada com a mensagem "Os valores não batem: confira a biomassa, o peso médio ou a quantidade." no campo da quantidade.

### 9.3 Registros

- **RN10.** Todo registro pertence a um ciclo ativo. Não há registro em tanque vazio. Registros de ciclos encerrados ficam só para consulta: não podem ser alterados nem excluídos.
- **RN11.** Apenas a **data** é obrigatória, mas pelo menos um campo de medição (peso médio, ração, mortos encontrados, natalidade) ou observação deve ser preenchido. Não há contagem de peixes durante o ciclo: na prática ela não é feita.
- **RN12.** A data não pode ser futura nem anterior ao início do ciclo.
- **RN13.** Valores numéricos não podem ser negativos. Contagens são inteiras, e o peso médio, se informado, é maior que zero.
- **RN14.** Os mortos encontrados de um registro não podem passar da quantidade **estimada** de peixes naquela data. A regra é conferida em todos os registros do ciclo a cada inclusão, alteração ou exclusão, porque um registro muda o estoque estimado dos que vêm depois dele.
- **RN15.** Pode haver mais de um registro na mesma data. Os valores de ração, mortalidade e natalidade são somados.

- **RN21.** No povoamento, o lote é informado de um de dois jeitos: **contado** (quantidade inteira > 0 e peso médio > 0; a biomassa inicial é calculada) ou **pesado** (biomassa do lote > 0 e peso médio da amostra > 0; a quantidade é calculada, `biomassa × 1000 ÷ peso médio`, arredondada, e precisa dar pelo menos 1 peixe).
- **RN22.** Na biometria por amostra, peixes na amostra (inteiro) e peso da amostra vêm juntos e são maiores que zero; o comprimento médio, se informado, é maior que zero. A amostra não pode passar da quantidade estimada no tanque naquela data. O peso médio do registro é `peso da amostra ÷ peixes na amostra`. Continua valendo informar só o peso médio.
- **RN23.** A sobra de ração é ≥ 0, só pode ser informada com a ração fornecida e não pode ser maior que ela. A causa da mortalidade é uma da lista e só pode ser informada com mortos encontrados.
- **RN24.** Num plano de alimentação, o nome é obrigatório (até 80 caracteres). No plano **fixo**, a taxa vai de 0,1 a 20% do peso total por dia e as refeições de 1 a 12. No plano **por faixas**, há pelo menos uma faixa; em cada uma, "peso até" é maior que "peso de", com a mesma taxa e refeições; as faixas não se sobrepõem (podem encostar, como 190–225 e 225–265). Os erros aparecem no campo da faixa, em linguagem simples. O tanque, se tiver plano, aponta para um existente.
- **RN25.** O intervalo da biometria do tanque é um número inteiro de 1 a 90 dias (padrão 15).
- **RN26.** Na biometria por pesos individuais, há pelo menos 2 pesos, todos maiores que zero; deles saem os peixes na amostra (quantidade) e o peso da amostra (soma).

### 9.3.1 Lembretes

- **RN16.** O título do lembrete é obrigatório e tem até 80 caracteres.
- **RN17.** O tanque do lembrete, quando informado, precisa existir e não estar arquivado. Excluir um tanque (só possível sem ciclos, RN04) exclui junto os lembretes dele, e a confirmação diz quantos; os lembretes de um tanque arquivado ficam como estão. Um lembrete que já aponte para um tanque inexistente (dados antigos) é tratado como Geral.
- **RN18.** A repetição só aceita 7, 15 ou 30 dias.

### 9.4 Indicadores

Todos os indicadores são calculados a partir do ciclo e dos registros, ordenados por data.

**Durante o ciclo, a quantidade é estimada.** Não dá para contar os peixes no viveiro, e muitos mortos não são vistos: os mortos anotados são uma observação parcial. Por isso a quantidade, a biomassa, a FCA e a capacidade do ciclo ativo são **estimativas**, e as telas dizem isso nos rótulos: "Peixes (estimado)", "Biomassa (estimada)", "FCA (estimada)", "Capacidade (estimada)", "Mortalidade observada" (com "Real só na despesca") e "Sobrevivência estimada". Na página do tanque, um botão "i" ao lado dos indicadores explica a estimativa. Os valores reais só saem na despesca (seção 9.4.1).

| Indicador | Fórmula |
|---|---|
| **Quantidade de peixes (estimada)** | `quantidadeInicial − mortos encontrados + natalidade`, acumulados até a data. |
| **Peso médio atual** | Último `pesoMedioG` informado. Se nenhum, usa `pesoMedioInicialG`. |
| **Biomassa (kg)** | `quantidade × pesoMedio / 1000` |
| **Ração consumida (kg)** | Soma de `racaoKg − racaoSobraKg` no ciclo. É a consumida que entra na FCA e nos totais de ração. |
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
| **TCE (%/dia)** | `(ln pesoMedioAtual − ln pesoMedioInicial) ÷ dias do início até a última pesagem × FATOR_TCE` |
| **Fator de condição K** | `FATOR_K × peso médio (g) ÷ comprimento médio (cm)³`, da última biometria com comprimento. Só aparece com comprimento. |
| **Mortalidade da semana (%)** | mortos encontrados nos últimos 7 dias ÷ peixes estimados no início da semana × 100 |
| **Dias para o peso alvo** | `(pesoAlvoG − peso atual) ÷ crescimento entre as duas últimas pesagens`, contados a partir da última; só com peso alvo e ganho positivo, com a data estimada. |

`FATOR_TCE` e `FATOR_K` valem 100 e ficam em constantes em `indicadores.js` (seção 13).

**Referências das fórmulas** (citadas também em comentário junto de cada fórmula em `indicadores.js`):

| Cálculo | Situação | Fonte |
|---|---|---|
| Nº de peixes = biomassa ÷ peso médio | Confirmado (ex.: 7.500 kg/ha ÷ 1,5 kg = 5.000 peixes/ha) | Embrapa, cálculo de povoamento de viveiros (2015) |
| Biomassa = nº de peixes × peso médio | Confirmado | Embrapa, cálculo de povoamento de viveiros (2015) |
| Biometria por amostra, a cada 15–21 dias, com cerca de 50 peixes | Confirmado | Embrapa, manejos na criação de tilápia (Queiroz, 2019) |
| Sobra pesada; FCA com a ração consumida | Confirmado | Embrapa, manejos na criação de tilápia (Queiroz, 2019) |
| Ração/dia = biomassa × taxa da faixa ÷ refeições | Confirmado (1.880 peixes × 542,5 g → 19,4 kg/dia) | Embrapa, Comunicado Técnico 12 |
| TCE = (ln peso final − ln peso inicial) ÷ dias | Confirmado (Ricker, 1979) | Redalyc, crescimento de carpas |
| Fator de condição K = peso ÷ comprimento³ | Confirmado (Fulton) | Redalyc, crescimento de carpas |

**Capacidade (referência):** a Embrapa cita cerca de 35 kg/m³ para tanques-rede maiores que 60 m³, para evitar problemas de oxigênio. Vale só para tanque-rede; em viveiro escavado a referência é em kg/ha, ordens de grandeza menor. Por isso não há valor padrão de capacidade.

### 9.4.1 Resultado do ciclo encerrado

Na despesca a biomassa é pesada, e daí saem os números reais do ciclo, que servem de referência para o próximo. `calcularResultadoCiclo({ tanque, ciclo, registros })` (função pura em `indicadores.js`) concentra as fórmulas, que ainda serão confirmadas com o laboratório (seção 13):

| Resultado | Fórmula |
|---|---|
| Biomassa inicial (kg) | `biomassaInicialKg` do ciclo (informada no povoamento por pesagem, ou `quantidadeInicial × pesoMedioInicialG / 1000`) |
| Quantidade final | `quantidadeDespescada` se informada; senão `biomassaFinalKg × 1000 / pesoMedioFinalG`, arredondado ("estimada pela biomassa") |
| Sobrevivência real (%) | `quantidadeFinal / quantidadeInicial × 100` |
| Mortalidade real (%) | `100 − sobrevivenciaReal` (mínimo 0) |
| Mortos encontrados | soma de `mortalidade` dos registros do ciclo |
| Mortalidade não observada | `max(0, quantidadeInicial − quantidadeFinal − mortosEncontrados)` |
| Ganho de biomassa (kg) | `biomassaFinalKg − biomassaInicialKg` |
| Ração total (kg) | soma de `racaoKg` dos registros do ciclo |
| FCA final | `racaoTotalKg / ganhoBiomassaKg` (vazia se o ganho for ≤ 0) |
| Dias de cultivo | dias entre `dataInicio` e `dataDespesca` |
| Ganho de peso diário (g/dia) | `(pesoMedioFinalG − pesoMedioInicialG) / diasCultivo` |
| Produtividade (kg/m³) | `biomassaFinalKg / volumeM3` |
| TCE do ciclo (%/dia) | `(ln pesoMedioFinalG − ln pesoMedioInicialG) / diasCultivo × FATOR_TCE` |

**Onde aparece:** logo depois da despesca, a página do tanque abre com o resumo do ciclo encerrado; no Histórico, cada ciclo encerrado mostra o mesmo resumo; quando há ciclo encerrado anterior, sobrevivência, mortalidade, FCA e dias trazem a comparação ("75% (ciclo anterior: 81%)"). Ao iniciar um novo ciclo, uma caixa mostra a referência do último: "Último ciclo: sobrevivência de X%, FCA de Y, Z dias."

**Onde cada indicador aparece na página do tanque (seção 7.3):**

| Lugar | Indicadores |
|---|---|
| Cabeçalho | dias de cultivo e andamento até a despesca prevista |
| Destaque | peso médio (com o peso alvo), biomassa (estimada), capacidade (estimada) com densidade |
| Acompanhamento | mortalidade observada (e a dos últimos 7 dias), FCA (estimada) com ração e ganho, crescimento entre as duas últimas biometrias |
| Só em "Ver todos" | peixes (estimado), sobrevivência estimada, ganho de biomassa, ração acumulada, crescimento no ciclo, densidade, densidade de povoamento, natalidade (só com nascimentos) |
| Resumo da despesca | sobrevivência e mortalidade reais, FCA final, ganho de peso diário, produtividade |

As leituras de curto prazo (ganho de biomassa e mortalidade dos últimos 7 dias, ração de hoje, dias desde a biometria, data prevista do peso alvo) vêm de `calcularAcompanhamento`, em `indicadores.js`. O peso alvo é projetado no ritmo das duas últimas biometrias, a partir da última. TCE e fator de condição entram em "Ver todos" quando a biometria tiver os dados do Prompt 02.

**Dashboard:** os totais somam os tanques com ciclo ativo. As taxas gerais são médias ponderadas pela quantidade inicial de cada ciclo.

**Período do dashboard:** a série diária de cada ciclo repete o último valor conhecido entre registros. O período vai do fim do dia inicial até hoje; um tanque povoado no meio dele parte da biomassa do povoamento. A **variação** compara hoje com o início do período; a **FCA do período** é a ração do período dividida pelo ganho de biomassa do período; as **perdas** são a mortalidade registrada no período. A meta de FCA fica em `config.metaFca` (padrão 1,60) e pode ser sobrescrita por tanque.

**Exibição:** números no formato brasileiro (`1.234,5`), com no máximo 1 casa decimal para percentuais e 2 para FCA.

### 9.5 Alertas

Os alertas são calculados sempre que os dados mudam e não são armazenados. Cada tanque pode sobrescrever os limites padrão.

| Alerta | Condição | Limite padrão | Gravidade |
|---|---|---|---|
| **Mortalidade elevada no registro** | mortos encontrados no registro > X% da quantidade estimada (a mensagem diz "do estoque estimado") | 1% | Alta |
| **Mortalidade acumulada elevada** | taxa de mortalidade do ciclo > X% | 10% | Média |
| **Ração acima do limite** | ração do dia > X% da biomassa | 5% | Média |
| **Tanque próximo da capacidade** | capacidade utilizada (biomassa ÷ carga máxima) ≥ X%; não avaliado sem densidade máxima | 90% | Média |
| **Peso médio abaixo do esperado** | peso atual < X% do peso esperado na data* | 85% | Baixa |
| **Tanque sem registro** | nenhum registro há mais de X dias | 7 dias | Baixa |
| **Biometria atrasada** | passou da próxima biometria (seção 9.11): "Última biometria em dd/mm, há N dias (a cada X dias)"; ação "Fazer biometria" | intervalo do tanque (15 dias) | Baixa |

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

- **CSV de registros:** um arquivo por tanque ou geral, com uma linha por registro e colunas para tanque, espécie, ciclo, data, tipo ("Biometria" ou "Rotina"), todos os campos e o CV dos pesos individuais, quando houver.
- **CSV de lembretes:** uma linha por lembrete (não por ocorrência): título, tanque ("Geral" quando não tem), primeira data, repetição, datas concluídas e observação.
- Nos dois: separador `;` e decimal com vírgula, para abrir corretamente no Excel em português. O arquivo começa com BOM UTF-8 para manter os acentos, e textos que começam com `=`, `+`, `-` ou `@` recebem um apóstrofo, para o Excel não tratá-los como fórmula.
- **Backup JSON:** exporta o objeto completo do `localStorage` e registra a data em `config.ultimoBackupEm`. A restauração valida a `versao`, migra backups antigos (seção 8.4) e pede confirmação antes de substituir os dados.


### 9.8 Barra de capacidade

O limite real de um tanque é o peso de peixe por volume de água, e não o número de peixes: a carga cresce com o peixe, mesmo quando a quantidade cai. A barra mostra a biomassa atual contra a carga máxima, em três lugares: cartões do Dashboard, lista de tanques e página do tanque.

| Faixa | Cor da água | Rótulo |
|---|---|---|
| até 75% | verde-petróleo | — |
| acima de 75% e abaixo do limite de alerta | âmbar | "Acima de 75%" (não "Atenção", que é o estado do tanque) |
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

### 9.10 Ração sugerida

`calcularRacaoSugerida({ indicadores, tabela, houvePesagem })`, função pura em `indicadores.js`, usa o peso médio atual e a biomassa estimada:

- Encontra a faixa da tabela do tanque que contém o peso médio (de "peso de" até antes de "peso até"; o fim da última faixa ainda vale).
- `racaoDiaKg = biomassaKg × taxaPct ÷ 100`; `racaoRefeicaoKg = racaoDiaKg ÷ refeicoes`. Devolve também a faixa e a data da última biometria.
- Sem como calcular, devolve o motivo, e a tela mostra: "Defina uma tabela de alimentação para este tanque." (com link para escolher), "Peso de 112 g fora da tabela." ou "Faça uma biometria para calcular a ração."
- Com a última biometria há mais de 30 dias: "Última biometria há N dias: a sugestão pode estar desatualizada."

Onde aparece: no registro (seção Alimentação, com "Usar sugestão", que preenche a ração fornecida), no cartão "Ração de hoje" da página do tanque ("19,4 kg por dia · 4 refeições de 4,85 kg · faixa 520–565 g (1,9%)", com "Registrado hoje: 12 kg de 19,4 kg" e a barra) e nos cartões da lista de tanques ("Ração sugerida").

**Ideia para depois (não implementada):** sugerir a quantidade de alevinos ao iniciar o ciclo pela mortalidade do ciclo anterior: quantidade a povoar = quantidade final desejada × (1 + mortalidade esperada). Exemplo da Embrapa: 5.000 peixes com 4% → 5.200 alevinos.

---

### 9.11 Biometria

- **Próxima biometria** = data da última pesagem do ciclo (ou o povoamento) + `intervaloBiometriaDias` do tanque (RN25, padrão 15). Atrasada quando hoje passa dessa data: o cartão de peso fica âmbar com "Fazer biometria", entra o alerta "Biometria atrasada" (seção 9.5), e a ração sugerida avisa "Biometria atrasada há N dias: a sugestão pode estar desatualizada." (no plano por faixas; o fixo não depende do peso).
- **Agenda:** a próxima biometria de cada tanque com ciclo ativo aparece como "Biometria prevista · T01" (etiqueta no estilo de lembrete; atrasada, fica na data em que venceu). No quadro do dia, "Fazer biometria" abre o tanque com o painel na data do dia.
- **Coeficiente de variação (CV)** dos pesos individuais = desvio padrão amostral (n − 1) ÷ média × 100. Até 20% (`LIMITE_CV_UNIFORME_PCT`, a validar), "Lote uniforme"; acima, "Lote desuniforme: considere classificar". Um peso só não tem CV.
- `calcularEstatisticasPesos` e `calcularProximaBiometria` (puras, em `indicadores.js`); `ehRegistroDeBiometria`, `listarBiometriasDoCiclo`, `salvarBiometria`, `calcularPreviaBiometria` e `obterProximoTanqueBiometria` em `domain/biometrias.js`. Registro só de biometria: tem peso e nada de ração, sobra, mortos ou natalidade.

### 9.12 Estado do tanque e tarefas do dia

- **Estado** (`domain/estado.js`, `calcularEstadoTanque`): vem só dos alertas da seção 9.5, sem critério novo, para que estado, tarefas e página de alertas nunca se contradigam. Algum alerta de gravidade alta: **Agir agora**; qualquer outro alerta: **Atenção**; nenhum: **Tudo certo**. Sem ciclo: **Vazio**, **Em manutenção** ou **Arquivado**. O motivo é o `resumo` do alerta principal (o alto, ou o primeiro), com "(+N)" quando há outros. Estado sempre com ícone e texto, nunca só cor.
- **Tarefas** (`domain/tarefas.js`, `gerarTarefasDoDia`, pura): ordem de urgência alerta alto → alerta médio → alimentar → lembrete atrasado → alerta baixo → biometria de hoje → lembrete. Quando duas origens dizem a mesma coisa, fica uma tarefa só (biometria atrasada é só o alerta; tanque sem registro não entra em "Alimentar").
- Cada alerta tem um `resumo` de uma linha ("45 peixes mortos ontem", "Capacidade em 82%", "Biometria atrasada há 3 dias"), usado no estado e nas tarefas.

---

## 10. Estrutura de arquivos

```
fish-track/
├── index.html                # Hoje
├── folha.html                # Folha do dia (Anotar o dia)
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
│   │   ├── arracoamento.js   # Planos de alimentação (RN24) e o modelo Embrapa
│   │   ├── biometrias.js     # Biometria: salvar, listar, prévia e rodada (RN26)
│   │   ├── integridade.js    # Relacionamentos de um backup antes de restaurar (seção 8.5)
│   │   ├── estado.js         # Estado do tanque a partir dos alertas (seção 9.12)
│   │   ├── tarefas.js        # Tarefas do dia da tela Hoje (seção 9.12)
│   │   ├── configuracoes.js  # Limites de alerta: padrão e por tanque
│   │   └── validacao.js      # Validações compartilhadas
│   ├── ui/
│   │   ├── nav.js            # Navegação comum
│   │   ├── componentes.js    # Cartões, badges, mensagens, modais
│   │   ├── graficos.js       # Gráficos em SVG e cor fixa por tanque
│   │   ├── icones.js         # Ícones em traço
│   │   ├── painel-biometria.js # Painel de biometria do tanque (seção 7.13)
│   │   ├── editor-plano.js   # Editor do plano de alimentação (seção 7.14)
│   │   ├── glossario.js      # Termos técnicos com explicação e exemplo (seção 11.6)
│   │   └── calendario.js     # Agenda: grade com etiquetas, quadro do dia e formulário de lembrete
│   ├── services/
│   │   ├── exportacao.js     # CSV, backup JSON e PNG dos gráficos
│   │   └── seed.js           # Dados de exemplo
│   └── pages/
│       ├── agenda.js         # Liga a agenda ao domínio (página Agenda e aba do tanque)
│       ├── comum.js          # Menu lateral, contadores, backup e ações dos alertas
│       ├── dashboard.js      # Tela Hoje
│       ├── folha.js          # Folha do dia
│       ├── protecao.js       # Tela de bloqueio, faixa de espaço e dados recuperados (seção 8.5)
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
│   ├── icons/                # Logo (icone.svg), PNG 192/512 e versão maskable do PWA
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

### 11.6 Clareza da interface

Sete princípios para toda tela nova:

1. A primeira tela diz o que fazer agora, não só números.
2. Cada tanque tem um estado em uma palavra, com ícone, e uma linha de motivo.
3. Valor estimado leva ≈, e a página tem a legenda "≈ estimado: os peixes não são contados durante o ciclo".
4. Nenhum traço solto: valor ausente diz o motivo e a ação que resolve.
5. Uma ação principal por tela; o resto em "Mais ações".
6. Termo técnico vem com balão de ajuda (frase + exemplo, `ui/glossario.js`, `criarTermo`).
7. Os nomes seguem a fala do produtor: Hoje, Anotar o dia, Fazer biometria, Povoar tanque, Plano de alimentação.

Textos: frases curtas, voz ativa, verbo no início dos botões, todo número com unidade, alerta com uma linha de motivo, sem siglas sem explicação.

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
| Tabela de alimentação padrão por espécie | Só o modelo Embrapa de tilápia em tanque-rede, como exemplo; cada produtor cria a sua | Laboratório de piscicultura |
| Limite de CV para "lote uniforme" | 20% (`LIMITE_CV_UNIFORME_PCT`) | Laboratório de piscicultura |
| Intervalo padrão da biometria | 15 dias, ajustável por tanque (RN25) | Laboratório de piscicultura |
| Unidades preferidas (inclusive se a tonelada é usada) | Biomassa em kg ou t, ração em kg ou g; padrão kg e kg | Laboratório de piscicultura |
| Escala da TCE e do fator K (com ou sem × 100) | Com × 100, em `FATOR_TCE` e `FATOR_K` | Laboratório de piscicultura |
| Fórmulas do fechamento do ciclo (seção 9.4.1) | As da tabela, com a quantidade final estimada pela biomassa quando não houver contagem | Laboratório de piscicultura |
