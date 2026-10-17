// Relatório para imprimir ou salvar em PDF (seção 7.12): de um tanque
// (?tanqueId=...) ou de toda a produção. Sem bibliotecas: o PDF sai da
// impressão do navegador. Com ?imprimir=1, a janela de impressão abre sozinha.

import { hojeISO } from '../core/utils.js';
import {
    formatarData,
    formatarDataCompleta,
    formatarDensidade,
    formatarFca,
    formatarGramas,
    formatarGramasPorDia,
    formatarInteiro,
    formatarKg,
    formatarNumero,
    formatarPercentual,
    formatarVolume,
    pluralizar,
} from '../core/format.js';
import { listarSituacoes, obterSituacao, ROTULOS_STATUS } from '../domain/tanques.js';
import { calcularCargaMaximaKg, calcularResumoProducao, calcularSeries } from '../domain/indicadores.js';
import { analisarTanque, ordenarAlertas, resolverLimites } from '../domain/alertas.js';
import { obterLimitesPadrao, obterMetaFca } from '../domain/configuracoes.js';
import { resumirRegistro } from '../domain/registros.js';
import { criarElemento, mostrarErroPagina, renderizarAlertas } from '../ui/componentes.js';
import { desenharGraficoLinha } from '../ui/graficos.js';
import { irPara, lerParametro, montarUrl } from '../ui/nav.js';
import { iniciarPagina } from './comum.js';

const porId = (id) => document.getElementById(id);
const tanqueId = lerParametro('tanqueId');
const conteudo = porId('conteudo-relatorio');
const hoje = hojeISO();

iniciarPagina();
try {
    iniciar();
} catch (erro) {
    mostrarErroPagina(erro);
}

function iniciar() {
    const situacoes = listarSituacoes();
    const seletor = porId('campo-relatorio');
    seletor.append(...situacoes.map(({ tanque }) => criarElemento('option', { texto: tanque.nome, atributos: { value: tanque.id } })));
    seletor.addEventListener('change', () => irPara(montarUrl('relatorio.html', { tanqueId: seletor.value })));
    porId('botao-imprimir').addEventListener('click', () => window.print());

    const situacao = tanqueId ? obterSituacao(tanqueId) : null;
    if (tanqueId && !situacao) {
        conteudo.replaceChildren(criarElemento('p', { classe: 'aviso-vazio', texto: 'Tanque não encontrado. Escolha outro relatório acima.' }));
        return;
    }
    seletor.value = situacao ? situacao.tanque.id : '';
    porId('emissao-relatorio').textContent = `Emitido em ${formatarDataCompleta(hoje).toLowerCase()}`;
    if (situacao) {
        montarRelatorioTanque(situacao);
    } else {
        montarRelatorioGeral(situacoes);
    }

    // O nome do arquivo PDF sugerido pelo navegador vem do título da página.
    document.title = `Fish Track - Relatório ${situacao ? situacao.tanque.nome : 'da produção'} - ${hoje}`;
    if (lerParametro('imprimir')) {
        // Espera as fontes, senão a impressão pode sair com a fonte do sistema.
        document.fonts.ready.then(() => requestAnimationFrame(() => window.print()));
    }
}

// ---------- Relatório do tanque ----------

function montarRelatorioTanque(situacao) {
    const { tanque, cicloAtivo, ciclos, registros } = situacao;
    porId('titulo-relatorio').textContent = `Relatório do ${tanque.nome}`;
    const limitesPadrao = obterLimitesPadrao();
    const secoes = [criarSecao('Tanque e ciclo', [criarDadosTanque(situacao)])];

    if (!cicloAtivo) {
        const ultimo = ciclos.find((ciclo) => ciclo.status === 'encerrado');
        secoes.push(criarElemento('p', {
            classe: 'relatorio__nota',
            texto: ultimo
                ? `Sem ciclo em andamento. Último ciclo: povoamento em ${formatarData(ultimo.dataInicio)}, despesca em ${formatarData(ultimo.dataDespesca)} `
                    + `com ${pluralizar(ultimo.quantidadeDespescada, 'peixe', 'peixes')} de ${formatarGramas(ultimo.pesoMedioFinalG)}.`
                : 'Este tanque ainda não teve ciclos.',
        }));
        conteudo.replaceChildren(...secoes);
        return;
    }

    const { indicadores, alertas } = analisarTanque(situacao, { limitesPadrao, hoje });
    const limites = resolverLimites(limitesPadrao, tanque.limitesAlerta);
    const metaFca = obterMetaFca(tanque);
    secoes.push(
        criarSecao('Indicadores', [criarIndicadores([
            { rotulo: 'Peixes no estoque', valor: formatarInteiro(indicadores.quantidade), apoio: `${pluralizar(indicadores.mortalidadeAcumulada, 'perda', 'perdas')} no ciclo · sobrevivência de ${formatarPercentual(indicadores.taxaSobrevivencia)}` },
            { rotulo: 'Peso médio', valor: formatarGramas(indicadores.pesoMedioG), apoio: [`pesado em ${formatarData(indicadores.dataPesoAtual)}`, cicloAtivo.pesoAlvoG && `alvo de ${formatarGramas(cicloAtivo.pesoAlvoG)}`] },
            { rotulo: 'Biomassa', valor: formatarKg(indicadores.biomassaKg), apoio: `${formatarDensidade(indicadores.densidadeKgM3)} de água` },
            { rotulo: 'Conversão alimentar (FCA)', valor: formatarFca(indicadores.fca), apoio: [`meta de ${formatarFca(metaFca)}`, `${formatarKg(indicadores.racaoAcumuladaKg)} de ração para ${formatarKg(indicadores.ganhoBiomassaKg)} de ganho`] },
            { rotulo: 'Mortalidade acumulada', valor: formatarPercentual(indicadores.taxaMortalidade), apoio: `limite de ${formatarPercentual(limites.mortalidadeAcumuladaPct)}` },
            { rotulo: 'Capacidade usada', valor: formatarPercentual(indicadores.capacidadeUtilizada), apoio: indicadores.cargaMaximaKg ? `de ${formatarKg(indicadores.cargaMaximaKg)} de carga máxima` : 'capacidade não definida' },
            { rotulo: 'Crescimento', valor: formatarGramasPorDia(indicadores.taxaCrescimentoGDia), apoio: `média do ciclo: ${formatarGramasPorDia(indicadores.crescimentoCicloGDia)}` },
            { rotulo: 'Dias de cultivo', valor: formatarInteiro(indicadores.diasCultivo), apoio: cicloAtivo.dataPrevistaDespesca ? `despesca prevista para ${formatarData(cicloAtivo.dataPrevistaDespesca)}` : '' },
        ])]),
        criarSecaoGraficos(calcularSeries(cicloAtivo, registros)),
        criarSecao('Alertas ativos', [criarListaAlertas(alertas, { textoVazio: 'Nenhum alerta para este tanque.' })]),
        criarSecao(`Registros do ciclo (${formatarInteiro(registros.length)})`, [criarTabelaRegistros(registros)]),
    );
    conteudo.replaceChildren(...secoes);
}

function criarDadosTanque({ tanque, cicloAtivo }) {
    const cargaMaxima = calcularCargaMaximaKg(tanque.densidadeMaximaKgM3, tanque.volumeM3);
    const itens = [
        ['Espécie', tanque.especie],
        ['Volume', formatarVolume(tanque.volumeM3)],
        ['Capacidade', cargaMaxima ? `${formatarDensidade(tanque.densidadeMaximaKgM3)} (${formatarKg(cargaMaxima)})` : 'Não definida'],
        ['Situação', ROTULOS_STATUS[tanque.status]],
    ];
    if (cicloAtivo) {
        itens.push(
            ['Povoamento', `${formatarData(cicloAtivo.dataInicio)}: ${pluralizar(cicloAtivo.quantidadeInicial, 'peixe', 'peixes')} de ${formatarGramas(cicloAtivo.pesoMedioInicialG)}`],
            ['Peso alvo', cicloAtivo.pesoAlvoG ? formatarGramas(cicloAtivo.pesoAlvoG) : '—'],
            ['Despesca prevista', cicloAtivo.dataPrevistaDespesca ? formatarData(cicloAtivo.dataPrevistaDespesca) : '—'],
        );
    }
    return criarElemento('dl', { classe: 'relatorio__dados' }, itens.map(([rotulo, valor]) => criarElemento('div', {}, [
        criarElemento('dt', { texto: rotulo }),
        criarElemento('dd', { texto: valor }),
    ])));
}

function criarSecaoGraficos(series) {
    const graficos = [
        ['Peso médio (g)', series.pesoMedio, formatarGramas, 'Peso médio'],
        ['Biomassa (kg)', series.biomassa, formatarKg, 'Biomassa'],
        ['Mortalidade acumulada (%)', series.mortalidade, formatarPercentual, 'Mortalidade acumulada'],
    ].map(([titulo, pontos, formatarValor, rotulo]) => {
        const area = criarElemento('div', { classe: 'cartao-grafico__area' });
        const desenhou = desenharGraficoLinha(area, pontos, { formatarValor, rotulo });
        return criarElemento('figure', { classe: 'cartao-grafico' }, [
            criarElemento('figcaption', { classe: 'cartao-grafico__titulo', texto: titulo }),
            desenhou ? area : criarElemento('p', { classe: 'cartao-grafico__vazio', texto: 'Sem dados suficientes para o gráfico.' }),
        ]);
    });
    return criarSecao('Evolução', [criarElemento('div', { classe: 'relatorio__graficos' }, graficos)]);
}

function criarTabelaRegistros(registros) {
    if (registros.length === 0) {
        return criarElemento('p', { classe: 'relatorio__nota', texto: 'Nenhum registro neste ciclo.' });
    }
    const numero = (valor, casas = 1) => (valor === null || valor === undefined ? '' : formatarNumero(valor, casas));
    const colunas = ['Data', 'Peso médio (g)', 'Ração (kg)', 'Mortalidade', 'Natalidade', 'Contagem', 'Observações'];
    // No celular a tabela rola para o lado; no papel ela cabe na largura da folha.
    return criarElemento('div', { classe: 'tabela-rolagem' }, [criarElemento('table', { classe: 'tabela relatorio__tabela' }, [
        criarElemento('thead', {}, [criarElemento('tr', {}, colunas.map((coluna) => criarElemento('th', { texto: coluna, atributos: { scope: 'col' } })))]),
        criarElemento('tbody', {}, registros.map((registro) => criarElemento('tr', {}, [
            formatarData(registro.data),
            numero(registro.pesoMedioG),
            numero(registro.racaoKg, 2),
            numero(registro.mortalidade, 0),
            numero(registro.natalidade, 0),
            numero(registro.quantidadeContada, 0),
            registro.observacoes,
        ].map((valor) => criarElemento('td', { texto: valor }))))),
    ])]);
}

// ---------- Relatório geral ----------

function montarRelatorioGeral(situacoes) {
    porId('titulo-relatorio').textContent = 'Relatório da produção';
    const limitesPadrao = obterLimitesPadrao();
    const ativos = situacoes
        .filter((situacao) => situacao.cicloAtivo)
        .map((situacao) => ({ ...situacao, ciclo: situacao.cicloAtivo, ...analisarTanque(situacao, { limitesPadrao, hoje }) }));
    const resumo = calcularResumoProducao(ativos);
    const alertas = ordenarAlertas(ativos.flatMap((item) => item.alertas));
    const semCiclo = situacoes.filter((situacao) => !situacao.cicloAtivo);

    const secoes = [
        criarSecao('Resumo da produção', [
            criarIndicadores([
                { rotulo: 'Tanques em cultivo', valor: formatarInteiro(resumo.tanquesAtivos), apoio: `de ${pluralizar(situacoes.length, 'tanque cadastrado', 'tanques cadastrados')}` },
                { rotulo: 'Peixes no estoque', valor: formatarInteiro(resumo.totalPeixes) },
                { rotulo: 'Biomassa total', valor: formatarKg(resumo.biomassaTotalKg) },
                { rotulo: 'Ração fornecida', valor: formatarKg(resumo.racaoAcumuladaKg), apoio: 'nos ciclos em andamento' },
                { rotulo: 'Mortalidade média', valor: formatarPercentual(resumo.mortalidadeMedia), apoio: 'ponderada pelo povoamento' },
                { rotulo: 'Alertas', valor: formatarInteiro(alertas.length), apoio: alertas.length > 0 ? 'detalhes no fim do relatório' : 'nenhum no momento' },
            ]),
            semCiclo.length > 0 && criarElemento('p', {
                classe: 'relatorio__nota',
                texto: `Sem ciclo em andamento: ${semCiclo.map(({ tanque }) => `${tanque.nome} (${ROTULOS_STATUS[tanque.status].toLowerCase()})`).join(', ')}.`,
            }),
        ]),
        ...ativos.map(criarBlocoTanque),
        criarSecao('Alertas', [criarListaAlertas(alertas, { mostrarTanque: true, textoVazio: 'Nenhum alerta no momento.' })]),
    ];
    if (ativos.length === 0) {
        secoes.splice(1, 0, criarElemento('p', { classe: 'relatorio__nota', texto: 'Nenhum tanque com ciclo em andamento.' }));
    }
    conteudo.replaceChildren(...secoes);
}

function criarBlocoTanque({ tanque, ciclo, registros, indicadores, alertas }) {
    const area = criarElemento('div', { classe: 'cartao-grafico__area' });
    const desenhou = desenharGraficoLinha(area, calcularSeries(ciclo, registros).biomassa, { formatarValor: formatarKg, rotulo: `Biomassa do ${tanque.nome}` });
    return criarSecao(tanque.nome, [
        criarElemento('p', { classe: 'relatorio__nota', texto: `${tanque.especie} · ${formatarVolume(tanque.volumeM3)} · povoado em ${formatarData(ciclo.dataInicio)} · `
            + `${pluralizar(alertas.length, 'alerta', 'alertas')}` }),
        criarElemento('div', { classe: 'relatorio__bloco' }, [
            criarIndicadores([
                { rotulo: 'Peixes', valor: formatarInteiro(indicadores.quantidade) },
                { rotulo: 'Peso médio', valor: formatarGramas(indicadores.pesoMedioG) },
                { rotulo: 'Biomassa', valor: formatarKg(indicadores.biomassaKg) },
                { rotulo: 'FCA', valor: formatarFca(indicadores.fca) },
                { rotulo: 'Mortalidade', valor: formatarPercentual(indicadores.taxaMortalidade) },
                { rotulo: 'Capacidade', valor: formatarPercentual(indicadores.capacidadeUtilizada) },
                { rotulo: 'Dias de cultivo', valor: formatarInteiro(indicadores.diasCultivo) },
                { rotulo: 'Último registro', valor: indicadores.ultimoRegistro ? formatarData(indicadores.ultimoRegistro.data) : '—' },
            ], { compacto: true }),
            criarElemento('figure', { classe: 'cartao-grafico' }, [
                criarElemento('figcaption', { classe: 'cartao-grafico__titulo', texto: 'Biomassa (kg)' }),
                desenhou ? area : criarElemento('p', { classe: 'cartao-grafico__vazio', texto: 'Sem dados suficientes para o gráfico.' }),
            ]),
        ]),
        indicadores.ultimoRegistro && criarElemento('p', {
            classe: 'relatorio__nota',
            texto: `Último registro: ${resumirRegistro(indicadores.ultimoRegistro)}`,
        }),
    ], { inteira: true });
}

// ---------- Partes comuns ----------

// inteira: a seção não se divide entre páginas (blocos curtos, como o de cada tanque).
function criarSecao(titulo, filhos, { nivel = 3, inteira = false } = {}) {
    const classes = ['relatorio__secao'];
    if (inteira) {
        classes.push('relatorio__secao--inteira');
    }
    return criarElemento('section', { classe: classes.join(' ') }, [
        criarElemento(`h${nivel}`, { classe: 'relatorio__secao-titulo', texto: titulo }),
        ...filhos,
    ]);
}

function criarIndicadores(itens, { compacto = false } = {}) {
    return criarElemento('dl', { classe: `relatorio__indicadores${compacto ? ' relatorio__indicadores--compacto' : ''}` }, itens.map(({ rotulo, valor, apoio }) => {
        const textoApoio = [apoio].flat().filter(Boolean).join(' · ');
        return criarElemento('div', { classe: 'relatorio__indicador' }, [
            criarElemento('dt', { classe: 'relatorio__rotulo', texto: rotulo }),
            criarElemento('dd', { classe: 'relatorio__valor', texto: valor }),
            textoApoio && criarElemento('dd', { classe: 'relatorio__apoio', texto: textoApoio }),
        ]);
    }));
}

function criarListaAlertas(alertas, { mostrarTanque = false, textoVazio }) {
    const lista = criarElemento('ul', { classe: 'lista-alertas' });
    renderizarAlertas(lista, alertas, { mostrarTanque, hrefTanque: (alerta) => montarUrl('tanque.html', { id: alerta.tanqueId }), textoVazio });
    return lista;
}
