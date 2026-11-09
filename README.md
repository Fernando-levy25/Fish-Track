# 🐟 Fish Track

> Registrar os dados do cultivo de forma simples e transformar esses dados em informações claras sobre a produção.

**Versão atual:** v1.0 (MVP) · **Status:** em teste no laboratório, com dados reais · **Atualizado em:** 01/11/2026

## O que é

O **Fish Track** é um sistema web para gerenciar cultivos aquícolas (peixes e, em teste, camarão), pensado para o pequeno e médio produtor que hoje controla a produção em cadernos, fichas ou planilhas.

Esse controle manual dificulta acompanhar a evolução do cultivo, comparar ciclos, perceber problemas a tempo e ter uma visão geral de vários tanques ao mesmo tempo. O Fish Track reúne tudo num só lugar e transforma os registros do dia a dia em indicadores, gráficos e alertas fáceis de entender.

O sistema é feito para ser **simples**: o produtor informa só o que mede, o sistema calcula o resto, e a situação de cada tanque aparece em uma palavra.

## Diferenciais

* **Qualquer espécie:** a espécie é só uma identificação, e todos os tanques usam a mesma estrutura. Validado com fontes de piscicultura; em teste com camarão.
* **Funciona sem internet:** depois de aberto uma vez, roda no celular, tablet ou computador, sem instalação.
* **Visão de toda a produção:** a tela Hoje mostra o que fazer em cada tanque e, recolhida, a produção de todos eles.
* **Os dados são do produtor:** não é preciso criar conta, e os dados podem ser exportados a qualquer momento.

## Como funciona

O uso segue um fluxo simples:

1. **Tanque:** o produtor cadastra cada tanque, viveiro ou tanque-rede, com volume e capacidade.
2. **Ciclo:** ao povoar um tanque, inicia um ciclo com a quantidade e o peso médio dos animais. O ciclo termina na despesca.
3. **Registros:** durante o ciclo, anota o que mediu ou observou no dia. Todos os campos são opcionais:
   * ração fornecida e sobra, em kg ou g (com a ração sugerida pelo plano de alimentação do tanque);
   * mortos encontrados, com a causa provável, e natalidade;
   * observações.
   A **biometria** (pesar uma amostra a cada ~15 dias) é feita à parte, no painel "Fazer biometria" da página do tanque: amostra, pesos individuais (com o coeficiente de variação) ou só o peso médio. O app avisa quando ela atrasa.
4. **Indicadores:** durante o ciclo o sistema estima a quantidade de animais (o povoamento menos os mortos encontrados), biomassa, conversão alimentar (FCA), taxas de mortalidade e crescimento, densidade e capacidade utilizada.
5. **Alertas:** avisa quando algo pede atenção, como mortalidade elevada, ração acima do limite, peso abaixo do esperado, tanque perto da capacidade ou muitos dias sem registro.

## Telas

* **Hoje:** as tarefas do dia por urgência (alertas, ração a dar, biometrias e lembretes), o estado de cada tanque em uma palavra (Agir agora, Atenção, Tudo certo) e, recolhida, a produção geral.
* **Anotar o dia:** uma folha com todos os tanques para anotar ração, sobra e mortos de uma vez, já com a ração do plano.
* **Nomes do dia a dia:** "Fazer biometria", "Povoar tanque" e "Plano de alimentação"; valores estimados levam ≈ e termos técnicos têm um balão de ajuda.
* **Tanques:** lista com filtro por status (ativo, vazio, em manutenção, arquivado).
* **Página do tanque:** indicadores, gráficos de evolução, histórico de registros e calendário do tanque.
* **Alertas:** todos os alertas, agrupados por tanque e ordenados por gravidade.
* **Agenda:** povoamentos, registros, despescas, alertas do dia e lembretes (com repetição) de todos os tanques, com quadro do dia; os lembretes de hoje aparecem como tarefas na tela Hoje, e a Agenda no menu mostra quantos estão pendentes.
* **Relatórios:** relatório da produção ou de um tanque, pronto para imprimir ou salvar em PDF, e gráficos baixados como imagem PNG.
* **Configurações:** limites dos alertas, planos de alimentação, unidades, exportação em CSV (abre no Excel), backup e restauração dos dados (com a lista do que estiver errado no arquivo), dados recuperados e dados de exemplo.

## ▶️ Como usar

1. Abra a pasta do projeto com um servidor local, como o Live Server do VS Code. Abrir o `index.html` direto pelo arquivo não funciona, porque os módulos JavaScript e o modo offline exigem um servidor.
2. Para conhecer o sistema sem cadastrar nada, vá em **Mais → Configurações → Carregar dados de exemplo**.

Os dados ficam guardados no navegador do próprio aparelho. Use o **backup** em Configurações para guardar uma cópia ou levar os dados para outro aparelho.

Se os dados salvos não puderem ser lidos, o app não os apaga: mostra uma tela para baixá-los, restaurar um backup ou, com confirmação, começar de novo (guardando uma cópia antes). Com o armazenamento cheio, o app abre só para leitura até liberar espaço.

## 📦 Versão v1.0 (MVP)

Esta é a primeira versão completa do sistema. Ela inclui:

* cadastro de tanques, ciclos e registros, com validação das regras de negócio;
* todos os indicadores e alertas previstos na documentação;
* gráficos, histórico e calendário;
* exportação CSV, backup e restauração;
* funcionamento offline (PWA).

**Fora desta versão:** contas de usuário e sincronização na nuvem, gestão financeira, parâmetros de qualidade da água e sensores. Esses itens serão avaliados depois da validação com produtores.

## 🧪 Etapa atual: teste no laboratório

O app está sendo usado pelo laboratório com dados reais. Antes do teste entraram:

* biometria no tanque, unidades com seletor, plano de alimentação, tela Hoje, folha do dia e textos mais claros;
* proteção dos dados (dados ilegíveis, restauração de backup, exclusão de tanque e falta de espaço);
* conversão alimentar (FCA) correta logo depois de um povoamento por pesagem.

Depois do teste, o retorno do laboratório orienta as próximas mudanças de tela. O formato dos dados está na versão 5, e os dados dos testadores são preservados em toda atualização.

## 🛠️ Tecnologias

* HTML, CSS e JavaScript puros, sem frameworks nem dependências;
* dados no `localStorage` do navegador;
* PWA com service worker para funcionar offline.

## 📄 Documentação

A documentação completa do projeto, com regras de negócio, fórmulas dos indicadores, modelo de dados e padrões de código, está em [docs/fish-track.md](docs/fish-track.md).
