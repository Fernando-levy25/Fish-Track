# 🐟 Fish Track

> Registrar os dados do cultivo de forma simples e transformar esses dados em informações claras sobre a produção.

**Versão atual:** v1.0 (MVP) · **Status:** implementado, em validação com produtores · **Atualizado em:** 17/10/2026

## O que é

O **Fish Track** é um sistema web para gerenciar cultivos de peixes, pensado para o pequeno e médio produtor que hoje controla a produção em cadernos, fichas ou planilhas.

Esse controle manual dificulta acompanhar a evolução do cultivo, comparar ciclos, perceber problemas a tempo e ter uma visão geral de vários tanques ao mesmo tempo. O Fish Track reúne tudo num só lugar e transforma os registros do dia a dia em indicadores, gráficos e alertas fáceis de entender.

O sistema é feito para ser **simples**: um registro leva menos de um minuto, e a situação de cada tanque é entendida olhando a tela.

## Diferenciais

* **Qualquer espécie:** tilápia, tambaqui, pintado ou outra; todos os tanques usam a mesma estrutura.
* **Funciona sem internet:** depois de aberto uma vez, roda no celular, tablet ou computador, sem instalação.
* **Visão de toda a produção:** um painel compara todos os tanques.
* **Os dados são do produtor:** não é preciso criar conta, e os dados podem ser exportados a qualquer momento.

## Como funciona

O uso segue um fluxo simples:

1. **Tanque:** o produtor cadastra cada tanque, viveiro ou tanque-rede, com volume e capacidade.
2. **Ciclo:** ao povoar um tanque, inicia um ciclo com a quantidade e o peso médio dos peixes. O ciclo termina na despesca.
3. **Registros:** durante o ciclo, anota o que mediu ou observou no dia. Todos os campos são opcionais:
   * peso médio;
   * ração fornecida;
   * mortalidade e natalidade;
   * quantidade contada;
   * observações.
4. **Indicadores:** o sistema calcula automaticamente a quantidade estimada de peixes, biomassa, conversão alimentar (FCA), taxas de mortalidade e crescimento, densidade e capacidade utilizada.
5. **Alertas:** avisa quando algo pede atenção, como mortalidade elevada, ração acima do limite, peso abaixo do esperado, tanque perto da capacidade ou muitos dias sem registro.

## Telas

* **Dashboard:** totais da produção, alertas mais importantes e um resumo de cada tanque ativo.
* **Tanques:** lista com filtro por status (ativo, vazio, em manutenção, arquivado).
* **Página do tanque:** indicadores, gráficos de evolução, histórico de registros e calendário do tanque.
* **Alertas:** todos os alertas, agrupados por tanque e ordenados por gravidade.
* **Agenda:** povoamentos, registros, despescas, alertas do dia e lembretes (com repetição) de todos os tanques, com quadro do dia e "Lembretes de hoje" no menu lateral.
* **Relatórios:** relatório da produção ou de um tanque, pronto para imprimir ou salvar em PDF, e gráficos baixados como imagem PNG.
* **Configurações:** limites dos alertas, exportação em CSV (abre no Excel), backup e restauração dos dados, e dados de exemplo.

## ▶️ Como usar

1. Abra a pasta do projeto com um servidor local, como o Live Server do VS Code. Abrir o `index.html` direto pelo arquivo não funciona, porque os módulos JavaScript e o modo offline exigem um servidor.
2. Para conhecer o sistema sem cadastrar nada, vá em **Mais → Configurações → Carregar dados de exemplo**.

Os dados ficam guardados no navegador do próprio aparelho. Use o **backup** em Configurações para guardar uma cópia ou levar os dados para outro aparelho.

## 📦 Versão v1.0 (MVP)

Esta é a primeira versão completa do sistema. Ela inclui:

* cadastro de tanques, ciclos e registros, com validação das regras de negócio;
* todos os indicadores e alertas previstos na documentação;
* gráficos, histórico e calendário;
* exportação CSV, backup e restauração;
* funcionamento offline (PWA).

**Fora desta versão:** contas de usuário e sincronização na nuvem, gestão financeira, parâmetros de qualidade da água, sensores e relatórios em PDF. Esses itens serão avaliados depois da validação com produtores.

## 🛠️ Tecnologias

* HTML, CSS e JavaScript puros, sem frameworks nem dependências;
* dados no `localStorage` do navegador;
* PWA com service worker para funcionar offline.

## 📄 Documentação

A documentação completa do projeto, com regras de negócio, fórmulas dos indicadores, modelo de dados e padrões de código, está em [docs/fish-track.md](docs/fish-track.md).
