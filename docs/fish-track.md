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

Visão geral de toda a produção.

- Cartões de resumo: tanques ativos, total de peixes, biomassa total, ração acumulada, mortalidade média.
- Lista de alertas ativos (os 5 mais graves e recentes, com link para a página de alertas).
- Mini-cartões por tanque ativo: nome, espécie, peixes, biomassa, % de capacidade e indicador de status, que mostra a maior gravidade entre os alertas do tanque.
- Botão de ação rápida: **Novo registro**.

### 7.2 Tanques (`tanques.html`)

- Lista de todos os tanques com resumo (status, espécie, peixes, biomassa, último registro).
- Filtro por status (ativo, vazio, manutenção, arquivado). Sem filtro, a lista mostra todos menos os arquivados.
- Botão **Novo tanque**.

### 7.3 Detalhes do tanque (`tanque.html?id=...`)

Página própria de cada tanque, organizada em abas:

- **Resumo:** indicadores do ciclo atual, gráficos (peso médio, biomassa e mortalidade ao longo do tempo), registros recentes e alertas do tanque.
- **Histórico:** todos os registros do ciclo atual, com edição e exclusão. Permite consultar ciclos anteriores, que ficam só para leitura (RN10).
- **Calendário:** eventos do tanque (povoamento, registros, despesca prevista e realizada).

Ações: editar tanque, iniciar ciclo, registrar despesca, novo registro, ajustar limites de alerta (num diálogo; campo vazio usa o limite padrão), arquivar e desarquivar (ou excluir, se o tanque nunca teve ciclo). Cada ação aparece só quando o status do tanque permite.

### 7.4 Formulário de tanque (`tanque-form.html`)

Cria ou edita um tanque (nome, espécie, volume, capacidade, status, observações).

### 7.5 Formulário de ciclo (`ciclo-form.html`)

- **Iniciar ciclo:** data de povoamento, quantidade inicial, peso médio inicial, peso alvo (opcional) e data prevista de despesca (opcional).
- **Registrar despesca:** data, quantidade despescada e peso médio final. Encerra o ciclo.

### 7.6 Novo registro (`registro.html`)

Formulário rápido, com poucos campos e otimizado para o celular:

- Tanque (pré-selecionado quando vier da página do tanque);
- Data (padrão: hoje);
- Peso médio, consumo de ração, mortalidade, natalidade, quantidade contada (todos opcionais);
- Observações.

A edição usa o endereço `registro.html?id=...`, e o registro continua no mesmo tanque.

### 7.7 Alertas (`alertas.html`)

Lista de todos os alertas ativos, agrupados por tanque e ordenados por gravidade.

### 7.8 Calendário geral (`calendario.html`)

Visão mensal com os eventos de todos os tanques. Ao tocar em um dia, a lista abaixo do calendário mostra os eventos daquele dia, porque no celular não há espaço para os nomes dentro da grade.

### 7.9 Configurações (`configuracoes.html`)

- Limites padrão dos alertas.
- Exportar CSV (por tanque ou geral).
- Fazer backup e restaurar dados (JSON).
- Carregar dados de exemplo e apagar todos os dados.

### 7.10 Navegação

Barra inferior fixa no celular (Dashboard, Tanques, **+ Registro**, Alertas, Mais) e menu lateral em telas largas. O item **Mais** abre Calendário e Configurações.

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
  capacidade: 3000,            // quantidade máxima de peixes
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

### 8.3 Armazenamento

Uma única chave no `localStorage`:

```js
// chave: "fishtrack:v1"
{
  versao: 1,
  tanques: [],
  ciclos: [],
  registros: [],
  config: {
    limitesAlerta: {             // valores padrão da seção 9.5
      mortalidadeRegistroPct: 1,
      mortalidadeAcumuladaPct: 10,
      racaoDiariaPct: 5,
      capacidadePct: 90,
      pesoEsperadoPct: 85,
      diasSemRegistro: 7
    }
  }
}
```

O `limitesAlerta` de cada tanque usa as mesmas chaves e pode conter só as que forem sobrescritas.

- IDs gerados com `crypto.randomUUID()`.
- O campo `versao` permite migrar os dados quando o formato mudar.

---

## 9. Regras de negócio

### 9.1 Tanques

- **RN01.** Nome e espécie são obrigatórios. O nome é único entre os tanques não arquivados, sem diferenciar maiúsculas nem acentos.
- **RN02.** Volume e capacidade devem ser números maiores que zero.
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
| **Capacidade utilizada (%)** | `quantidade / capacidade × 100` |
| **Dias de cultivo** | Dias entre `dataInicio` e hoje (ou `dataDespesca`). |

**Dashboard:** os totais somam os tanques com ciclo ativo. As taxas gerais são médias ponderadas pela quantidade inicial de cada ciclo.

**Exibição:** números no formato brasileiro (`1.234,5`), com no máximo 1 casa decimal para percentuais e 2 para FCA.

### 9.5 Alertas

Os alertas são calculados sempre que os dados mudam e não são armazenados. Cada tanque pode sobrescrever os limites padrão.

| Alerta | Condição | Limite padrão | Gravidade |
|---|---|---|---|
| **Mortalidade elevada no registro** | mortalidade do registro > X% da quantidade estimada | 1% | Alta |
| **Mortalidade acumulada elevada** | taxa de mortalidade do ciclo > X% | 10% | Média |
| **Ração acima do limite** | ração do dia > X% da biomassa | 5% | Média |
| **Tanque próximo da capacidade** | capacidade utilizada ≥ X% | 90% | Média |
| **Peso médio abaixo do esperado** | peso atual < X% do peso esperado na data* | 85% | Baixa |
| **Tanque sem registro** | nenhum registro há mais de X dias | 7 dias | Baixa |

\* O **peso esperado** é uma interpolação linear entre o peso inicial (na data de início) e o peso alvo (na data prevista de despesca). Esse alerta só é avaliado se o ciclo tiver peso alvo e data prevista.

Os alertas só são avaliados para tanques com ciclo ativo. Os de registro (mortalidade no registro e ração) olham o último dia com registro, somando os registros da mesma data (RN15). O peso médio é comparado com o esperado na data da última pesagem; sem pesagem após o povoamento, esse alerta não é avaliado.

> ⚠️ Os limites padrão são valores iniciais de referência e devem ser **validados com produtores** antes de serem considerados definitivos.

### 9.6 Calendário

Eventos exibidos:

- início do ciclo (povoamento);
- cada registro;
- despesca prevista;
- despesca realizada.

No calendário geral, tanques arquivados ficam de fora. A despesca prevista só aparece enquanto o ciclo está ativo.

### 9.7 Exportação e backup

- **CSV:** um arquivo por tanque ou geral, com uma linha por registro e colunas para tanque, espécie, ciclo, data e todos os campos. Separador `;` e decimal com vírgula, para abrir corretamente no Excel em português. O arquivo começa com BOM UTF-8 para manter os acentos, e textos que começam com `=`, `+`, `-` ou `@` recebem um apóstrofo, para o Excel não tratá-los como fórmula.
- **Backup JSON:** exporta o objeto completo do `localStorage`. A restauração valida a `versao` e pede confirmação antes de substituir os dados.

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
├── configuracoes.html
├── manifest.json             # PWA
├── sw.js                     # Service worker (cache offline)
│
├── css/
│   ├── base.css              # Reset, variáveis (cores, espaçamentos, fontes)
│   ├── layout.css            # Estrutura geral, navegação, grid
│   ├── components.css        # Botões, cartões, formulários, abas, badges
│   └── pages/                # Estilos específicos de página, se necessário
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
│   │   ├── configuracoes.js  # Limites de alerta: padrão e por tanque
│   │   └── validacao.js      # Validações compartilhadas
│   ├── ui/
│   │   ├── nav.js            # Navegação comum
│   │   ├── componentes.js    # Cartões, badges, mensagens, modais
│   │   ├── graficos.js       # Gráficos em SVG
│   │   └── calendario.js     # Componente de calendário
│   ├── services/
│   │   ├── exportacao.js     # CSV e backup JSON
│   │   └── seed.js           # Dados de exemplo
│   └── pages/
│       ├── dashboard.js
│       ├── tanques.js
│       ├── tanque.js
│       ├── tanque-form.js
│       ├── ciclo-form.js
│       ├── registro.js
│       ├── alertas.js
│       ├── calendario.js
│       └── configuracoes.js
│
├── assets/
│   └── icons/                # Ícones SVG e ícones do PWA
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
| `services` | `core`, `domain` | Acessar o DOM, exceto para disparar download |
| `pages` | todas | Acessar o `localStorage` diretamente |

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
- Campos numéricos usam `type="text"` com `inputmode="decimal"` (valores com casas decimais) ou `inputmode="numeric"` (contagens de peixes), para abrir o teclado numérico no celular. Não use `type="number"`: dependendo do navegador e do teclado, ele descarta a vírgula antes de o JavaScript ver o valor ("2,5" vira 25). A conversão é feita por `paraNumero` (`core/utils.js`), no padrão brasileiro: vírgula decimal e ponto de milhar.
- O `name` de cada campo é igual à propriedade do modelo de dados (`pesoMedioG`, `racaoKg`), e cada campo aponta para sua mensagem de erro com `aria-describedby`.
- Ganchos para o JavaScript usam `data-campo` e `data-indicador` com o nome da propriedade em `camelCase`, nunca classes de estilo.
- O link da página atual no menu é marcado com `aria-current="page"`.
- `lang="pt-BR"` e `meta viewport` em todas as páginas.

### 11.4 CSS

- **Mobile-first:** estilos base para celular, com `@media (min-width: ...)` para telas maiores.
- Cores, espaçamentos e fontes em **variáveis CSS** (`--cor-primaria`, `--espaco-2`) definidas em `base.css`.
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
- [x] Calendário (por tanque e geral).

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
| Capacidade do tanque em **quantidade de peixes** ou em **kg** | Quantidade de peixes | Produtores |
| Limites padrão dos alertas | Valores da seção 9.5 | Produtores / técnicos |
| Incluir o peso dos peixes mortos no ganho de biomassa da FCA | Não incluir no MVP | Técnicos |
| Campo de natalidade é relevante para a maioria dos produtores | Manter como opcional | Produtores |
| Registrar parâmetros da água (oxigênio, pH, temperatura) | Fora do MVP | Produtores |
| Corrigir ou cancelar um ciclo iniciado com dados errados | Não previsto no MVP: hoje só é possível registrar a despesca | Produtores |
