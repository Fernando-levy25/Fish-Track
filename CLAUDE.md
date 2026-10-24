# Fish Track

Sistema web para gerenciamento de cultivos de peixes, voltado ao pequeno e médio produtor que hoje usa caderno ou planilha. MVP em HTML, CSS e JavaScript puros: sem frameworks, sem dependências externas e sem backend. Os dados ficam no `localStorage` e o app deve funcionar offline (PWA).

## Documentação

A especificação completa está em [docs/fish-track.md](docs/fish-track.md) e é a fonte de verdade do projeto. Antes de implementar ou alterar uma funcionalidade, leia a seção correspondente:

- Páginas e o que cada uma mostra: seção 7
- Modelo de dados e formato do `localStorage`: seção 8
- Regras de negócio (RN01 a RN24), fórmulas dos indicadores e alertas: seção 9
- Estrutura de pastas e responsabilidades por camada: seção 10
- Padrões de código: seção 11
- Fases de desenvolvimento: seção 12
- Decisões ainda provisórias: seção 13

Se o código e o documento divergirem, avise antes de seguir um dos dois. Quando uma decisão mudar uma regra, atualize o documento na mesma alteração.

Contexto do produto, histórico de decisões e retorno dos testadores: `docs/CONTEXTO.md` e as atualizações datadas em `docs/` (se existirem). Prompts de implementação numerados ficam em `docs/prompts/`: cada um parte do estado atual do código; não reaplique um prompt já implementado.

## Como rodar

Use um servidor local (ex.: Live Server do VS Code). ES Modules e service worker não funcionam abrindo o arquivo via `file://`. Não há build. Testes: `node --test` (regras e cálculos, sem dependências) e `tests/e2e/` aberto pelo servidor local (usa o app de verdade e devolve os dados do navegador ao final). Rode os dois antes de cada commit e atualize-os junto com o comportamento. Para ver o app com dados, use "Carregar dados de exemplo" em Configurações.

O service worker (`sw.js`) busca na rede primeiro, então alterações aparecem ao recarregar. Ao criar, renomear ou remover arquivos do app, atualize a lista `ARQUIVOS` em `sw.js` e troque `VERSAO_CACHE`.

## Regras essenciais

- Fluxo: Tanque → Ciclo (do povoamento à despesca) → Registro. Indicadores e alertas são sempre calculados, nunca digitados nem armazenados.
- Unidades armazenadas: peso em g, ração e biomassa em kg, volume em m³, datas em `AAAA-MM-DD`. Converter só na exibição, em formato brasileiro (`1.234,5`). Unidade no nome quando não for óbvia (`pesoMedioG`, `racaoKg`, `volumeM3`).
- Unidades na interface: todo campo e todo valor de peso mostram a unidade. Onde a escala varia, o usuário escolhe a unidade num seletor explícito, com a conversão visível; nunca detectar a unidade sozinho. Valores exibidos nunca trocam de unidade conforme o tamanho do número: seguem a preferência em `config.unidades`.
- Formato dos dados: toda mudança de formato sobe `VERSAO_DADOS` e ganha uma etapa em `migrarDados` (`storage.js`), com teste. A chave `fishtrack:v1` nunca muda, e backups de versões antigas continuam restauráveis. Os testadores têm dados reais no navegador: nenhuma alteração pode apagá-los.
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
- Interface: a versão principal é a de computador, mas tudo continua funcionando no celular. Animações só em CSS, sutis e desligadas com `prefers-reduced-motion`. Fontes servidas pelo próprio app (offline).
- Fora do escopo do MVP: login, nuvem, financeiro, IA, sensores, campos específicos por espécie e reescrever o app como página única (SPA).

## Domínio: como o produtor trabalha

Aprendido com os testes do laboratório e com fontes técnicas (Embrapa). Orienta toda decisão de dados e de tela:

- Não se contam os peixes durante o ciclo. A quantidade é sempre **estimada** (inicial − mortos encontrados + natalidade), e tudo que depende dela aparece como "(estimado)". Os números reais (sobrevivência, mortalidade, FCA final) só existem na despesca, a partir da biomassa final pesada.
- Biometria é um evento próprio, feito por amostragem a cada ~15 dias, e não parte da rotina diária (ração, sobra, mortos).
- O usuário informa só o que mede; o sistema calcula o resto e mostra o resultado na hora, enquanto ele digita.
- Fale como o produtor fala: evite jargão na interface; termos técnicos (FCA, TCE, biomassa) vêm com uma frase de ajuda e um exemplo. Se algo exige explicação longa, o problema é a tela.
- Não invente valores padrão que dependem de espécie, ração ou sistema de cultivo (capacidade, % de alimentação). Modelos prontos só com a fonte explícita no nome e um aviso de quando valem.
- Métricas e números sobre o uso do app só podem ser citados se forem medidos; o app não coleta dados de uso.