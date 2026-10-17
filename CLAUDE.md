# Fish Track

Sistema web para gerenciamento de cultivos de peixes, voltado ao pequeno e médio produtor que hoje usa caderno ou planilha. MVP em HTML, CSS e JavaScript puros: sem frameworks, sem dependências externas e sem backend. Os dados ficam no `localStorage` e o app deve funcionar offline (PWA).

## Documentação

A especificação completa está em [docs/fish-track.md](docs/fish-track.md) e é a fonte de verdade do projeto. Antes de implementar ou alterar uma funcionalidade, leia a seção correspondente:

- Páginas e o que cada uma mostra: seção 7
- Modelo de dados e formato do `localStorage`: seção 8
- Regras de negócio (RN01 a RN18), fórmulas dos indicadores e alertas: seção 9
- Estrutura de pastas e responsabilidades por camada: seção 10
- Padrões de código: seção 11
- Fases de desenvolvimento: seção 12
- Decisões ainda provisórias: seção 13

Se o código e o documento divergirem, avise antes de seguir um dos dois. Quando uma decisão mudar uma regra, atualize o documento na mesma alteração.

## Como rodar

Use um servidor local (ex.: Live Server do VS Code). ES Modules e service worker não funcionam abrindo o arquivo via `file://`. Não há build. Testes: `node --test` (regras e cálculos, sem dependências) e `tests/e2e/` aberto pelo servidor local (usa o app de verdade e devolve os dados do navegador ao final). Rode os dois antes de cada commit e atualize-os junto com o comportamento. Para ver o app com dados, use "Carregar dados de exemplo" em Configurações.

O service worker (`sw.js`) busca na rede primeiro, então alterações aparecem ao recarregar. Ao criar, renomear ou remover arquivos do app, atualize a lista `ARQUIVOS` em `sw.js` e troque `VERSAO_CACHE`.

## Regras essenciais

- Fluxo: Tanque → Ciclo (do povoamento à despesca) → Registro. Indicadores e alertas são sempre calculados, nunca digitados nem armazenados.
- Unidades armazenadas: peso em g, ração e biomassa em kg, volume em m³, datas em `AAAA-MM-DD`. Converter só na exibição, em formato brasileiro (`1.234,5`). Unidade no nome quando não for óbvia (`pesoMedioG`, `racaoKg`, `volumeM3`).
- Camadas: `core` não conhece DOM nem regras de negócio, `domain` não acessa o DOM, `ui` não lê nem grava dados, `pages` nunca acessa o `localStorage` direto. Todo acesso a dados passa por `js/core/storage.js`.
- `indicadores.js` e `alertas.js` contêm apenas funções puras. Limites de alerta são gravados por `domain/configuracoes.js`.
- Regra de negócio violada lança `ErroValidacao` com mensagens por campo (chave = `name` do campo); a página usa `iniciarFormulario` de `ui/componentes.js`, que mostra cada erro no seu campo.
- Texto do usuário entra no DOM com `textContent`, nunca com `innerHTML`.
- Identificadores em português e sem acentos, em `camelCase`, com verbo nas funções (`calcularBiomassa`). `const` por padrão, nunca `var`.
- Comentários explicam o porquê. Fórmulas e validações citam a regra (`// RN14`).
- Gráficos em SVG próprio, sem bibliotecas.
- HTML semântico, todo campo com `label`, campos numéricos com `type="text"` e `inputmode="decimal"` (ou `numeric` para contagens), nunca `type="number"`, que descarta a vírgula decimal em alguns celulares; `paraNumero` converte. O `name` do campo é a propriedade do modelo (`pesoMedioG`). Ganchos de JS via `data-campo`/`data-indicador` em `camelCase`, nunca por classes de estilo.
- CSS mobile-first, variáveis em `css/base.css`, classes BEM em kebab-case (`.card__titulo`, `.card--alerta`), sem seletores por ID nem `!important`. Área de toque mínima de 44 × 44 px.
- Commits em Conventional Commits, em português (`feat: cadastro de tanques`), uma funcionalidade por branch.
- Fora do escopo do MVP: login, nuvem, financeiro, IA, sensores e campos específicos por espécie.
