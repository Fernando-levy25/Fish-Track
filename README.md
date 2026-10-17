# 🐟 Fish Track

O **Fish Track** é um sistema web desenvolvido para auxiliar no gerenciamento de cultivos de peixes.

A proposta é substituir o controle realizado manualmente em cadernos ou planilhas por uma plataforma que centralize as informações dos tanques e facilite o acompanhamento da produção.

## Como funciona

O produtor cadastra seus **tanques de cultivo**, inicia um **ciclo** em cada um (do povoamento à despesca) e, periodicamente, faz **registros** com o que mediu ou observou:

* Peso médio;
* Consumo de ração;
* Mortalidade;
* Natalidade;
* Quantidade contada;
* Data e observações do cultivo.

A partir desses registros, o sistema calcula indicadores como quantidade estimada de peixes, biomassa, conversão alimentar e taxa de crescimento, e apresenta:

* **Dashboard geral:** visão consolidada de todos os tanques;
* **Página do tanque:** indicadores, gráficos, histórico e calendário de cada tanque;
* **Alertas:** situações que podem exigir atenção, como mortalidade elevada, ração acima do limite ou tanque próximo da capacidade;
* **Calendário:** povoamentos, registros e despescas de todos os tanques;
* **Configurações:** limites dos alertas, exportação em CSV, backup e dados de exemplo.

O objetivo do Fish Track é transformar os dados registrados durante o cultivo em informações organizadas e fáceis de acompanhar, permitindo que o produtor tenha uma visão mais clara do desenvolvimento dos seus peixes e da produção de cada tanque.

## ▶️ Como usar

1. Abra a pasta do projeto com um servidor local, como o Live Server do VS Code. Abrir o `index.html` direto pelo arquivo não funciona, porque os módulos JavaScript e o modo offline exigem um servidor.
2. Para conhecer o sistema, vá em **Mais → Configurações → Carregar dados de exemplo**.

Os dados ficam guardados no próprio navegador do aparelho. Não é preciso criar conta, e o backup em Configurações gera um arquivo com tudo. Depois de aberto uma vez, o app funciona sem internet.

## 🛠️ Tecnologias

* HTML, CSS e JavaScript puros, sem frameworks nem dependências;
* Dados no `localStorage` do navegador;
* PWA com service worker para funcionar offline.

A documentação completa, com regras de negócio e padrões de código, está em [docs/fish-track.md](docs/fish-track.md).

**Status:** MVP implementado, em validação com produtores.
