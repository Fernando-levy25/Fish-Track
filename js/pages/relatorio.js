// Relatório para imprimir ou salvar em PDF (seção 7.12): de um tanque
// (?tanqueId=...) ou de toda a produção. Sem bibliotecas: o PDF sai da
// impressão do navegador. Com ?imprimir=1, a janela de impressão abre sozinha.

import { hojeISO, somarDias } from '../core/utils.js';
import {
    formatarBiomassa,
    formatarData,
    formatarDataCompleta,
    formatarDensidade,
    formatarFca,
    formatarGramas,
    formatarGramasPorDia,
    formatarInteiro,
    formatarNumero,
    formatarNumeroPeso,
    formatarPercentual,
    formatarRacao,
    formatarVolume,
    obterUnidadesExibicao,
    pluralizar,
} from '../core/format.js';
import { listarSituacoes, obterSituacao, ROTULOS_STATUS } from '../domain/tanques.js';
import { calcularCargaMaximaKg, calcularCoberturaRacao, calcularResumoProducao, calcularSeries } from '../domain/indicadores.js';
import { analisarTanque, ordenarAlertas, resolverLimites } from '../domain/alertas.js';
import { listarCiclosEncerrados, listarResultadosCiclos } from '../domain/ciclos.js';
import { obterLimitesPadrao, obterMetaFca, obterUnidades } from '../domain/configuracoes.js';
import { listarRegistrosDoCiclo, resumirRegistro } from '../domain/registros.js';
import {
    AVISO_COBERTURA_RACAO,
    criarElemento,
    criarResumoCiclo,
    descreverCoberturaRacao,
    mostrarErroPagina,
    renderizarAlertas,
} from '../ui/componentes.js';
import { desenharGraficoLinha } from '../ui/graficos.js';
import { irPara, lerParametro, montarUrl } from '../ui/nav.js';
import { iniciarPagina } from './comum.js';

// Período dos ciclos encerrados no relatório da produção (?periodo=30|90|365|tudo).
const PERIODOS = Object.freeze({
    30: 'nos últimos 30 dias',
    90: 'nos últimos 90 dias',
    365: 'nos últimos 12 meses',
    tudo: 'desde o início',
});

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
    const { tanque, cicloAtivo, registros } = situacao;
    porId('titulo-relatorio').textContent = `Relatório do ${tanque.nome}`;
    const limitesPadrao = obterLimitesPadrao();
    const secoes = [criarSecao('Tanque e ciclo', [criarDadosTanque(situacao)])];

    if (!cicloAtivo) {
        // Sem ciclo em andamento: o resultado real do último ciclo encerrado, os
        // mesmos números do resumo da despesca, com a comparação (seção 7.12).
        const ultimo = listarResultadosCiclos(tanque.id)[0];
        secoes.push(ultimo
            ? criarSecao('Resultado do último ciclo', [criarDadosCicloEncerrado(ultimo), criarResumoCiclo(ultimo.resultado, ultimo.anterior)])
            : criarElemento('p', { classe: 'relatorio__nota', texto: 'Este tanque ainda não teve ciclos.' }));
        if (ultimo) {
            const registrosDoUltimo = listarRegistrosDoCiclo(ultimo.ciclo.id);
            secoes.push(criarSecao(`Registros do ciclo (${formatarInteiro(registrosDoUltimo.length)})`, [criarTabelaRegistros(registrosDoUltimo)]));
        }
        conteudo.replaceChildren(...secoes);
        return;
    }

    const { indicadores, alertas } = analisarTanque(situacao, { limitesPadrao, hoje, unidades: obterUnidades() });
    const limites = resolverLimites(limitesPadrao, tanque.limitesAlerta);
    const metaFca = obterMetaFca(tanque);
    const cobertura = calcularCoberturaRacao({ ciclo: cicloAtivo, registros, ate: hoje });
    secoes.push(
        criarSecao('Indicadores', [criarIndicadores([
            { rotulo: 'Peixes', valor: `≈ ${formatarInteiro(indicadores.quantidade)}`, apoio: `${pluralizar(indicadores.mortalidadeAcumulada, 'morto encontrado', 'mortos encontrados')} · sobrevivência estimada de ${formatarPercentual(indicadores.taxaSobrevivencia)}` },
            { rotulo: 'Peso médio', valor: formatarGramas(indicadores.pesoMedioG), apoio: [`pesado em ${formatarData(indicadores.dataPesoAtual)}`, cicloAtivo.pesoAlvoG && `alvo de ${formatarGramas(cicloAtivo.pesoAlvoG)}`] },
            { rotulo: 'Biomassa', valor: `≈ ${formatarBiomassa(indicadores.biomassaKg)}`, apoio: `${formatarDensidade(indicadores.densidadeKgM3)} de água` },
            {
                rotulo: 'FCA',
                valor: descreverFca(indicadores),
                apoio: [`meta de ${formatarFca(metaFca)}`, `${formatarRacao(indicadores.racaoAcumuladaKg)} de ração para ${formatarBiomassa(indicadores.ganhoBiomassaKg)} de ganho`, descreverCoberturaRacao(cobertura)],
                aviso: cobertura.baixa ? AVISO_COBERTURA_RACAO : '',
            },
            { rotulo: 'Mortalidade observada', valor: formatarPercentual(indicadores.taxaMortalidade), apoio: `real só na despesca · limite de ${formatarPercentual(limites.mortalidadeAcumuladaPct)}` },
            { rotulo: 'Capacidade', valor: `≈ ${formatarPercentual(indicadores.capacidadeUtilizada)}`, apoio: indicadores.cargaMaximaKg ? `de ${formatarBiomassa(indicadores.cargaMaximaKg)} de carga máxima` : 'capacidade não definida' },
            { rotulo: 'Crescimento', valor: formatarGramasPorDia(indicadores.taxaCrescimentoGDia), apoio: `média do ciclo: ${formatarGramasPorDia(indicadores.crescimentoCicloGDia)}` },
            { rotulo: 'Dias de cultivo', valor: formatarInteiro(indicadores.diasCultivo), apoio: cicloAtivo.dataPrevistaDespesca ? `despesca prevista para ${formatarData(cicloAtivo.dataPrevistaDespesca)}` : '' },
        ])]),
        criarSecaoGraficos(calcularSeries(cicloAtivo, registros)),
        criarSecao('Alertas ativos', [criarListaAlertas(alertas, { textoVazio: 'Nenhum alerta para este tanque.' })]),
        criarSecao(`Registros do ciclo (${formatarInteiro(registros.length)})`, [criarTabelaRegistros(registros)]),
    );
    conteudo.replaceChildren(...secoes, criarElemento('p', { classe: 'relatorio__nota', texto: '≈ valor estimado: os números reais saem na despesca.' }));
}

// FCA do ciclo ativo: "≈ 1,52", ou o motivo de não haver (seção 9.4).
function descreverFca(indicadores) {
    if (indicadores.fca !== null) {
        return `≈ ${formatarFca(indicadores.fca)}`;
    }
    return indicadores.ganhoBiomassaKg > 0 && !(indicadores.racaoAcumuladaKg > 0) ? 'Sem ração anotada' : 'Sem ganho de peso ainda';
}

// Datas e povoamento do ciclo encerrado, antes do resumo dos resultados.
function criarDadosCicloEncerrado({ ciclo, resultado }) {
    const itens = [
        ['Ciclo', `${formatarData(ciclo.dataInicio)} a ${formatarData(ciclo.dataDespesca)} (${pluralizar(resultado.diasCultivo, 'dia', 'dias')})`],
        ['Povoamento', `${pluralizar(ciclo.quantidadeInicial, 'peixe', 'peixes')} de ${formatarGramas(ciclo.pesoMedioInicialG)} · ${formatarBiomassa(resultado.biomassaInicialKg)}`],
        ['Despesca', `${pluralizar(resultado.quantidadeFinal, 'peixe', 'peixes')}${resultado.quantidadeFinalEstimada ? ' (estimados pela biomassa)' : ''} de ${formatarGramas(ciclo.pesoMedioFinalG)} · ${formatarBiomassa(resultado.biomassaFinalKg)}`],
        ['Ração total', formatarRacao(resultado.racaoTotalKg)],
    ];
    return criarElemento('dl', { classe: 'relatorio__dados' }, itens.map(([rotulo, valor]) => criarElemento('div', {}, [
        criarElemento('dt', { texto: rotulo }),
        criarElemento('dd', { texto: valor }),
    ])));
}

function criarDadosTanque({ tanque, cicloAtivo }) {
    const cargaMaxima = calcularCargaMaximaKg(tanque.densidadeMaximaKgM3, tanque.volumeM3);
    const itens = [
        ['Espécie', tanque.especie],
        ['Volume', formatarVolume(tanque.volumeM3)],
        ['Capacidade', cargaMaxima ? `${formatarDensidade(tanque.densidadeMaximaKgM3)} (${formatarBiomassa(cargaMaxima)})` : 'Não definida'],
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
        [`Biomassa (${obterUnidadesExibicao().biomassa})`, series.biomassa, formatarBiomassa, 'Biomassa'],
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
    // Pesos com as casas da seção 8.1: 0,01 g não pode virar "0".
    const peso = (valor, casas) => (valor === null || valor === undefined ? '' : formatarNumeroPeso(valor, casas));
    const colunas = ['Data', 'Peso médio (g)', 'Ração (kg)', 'Mortos encontrados', 'Natalidade', 'Observações'];
    // No celular a tabela rola para o lado; no papel ela cabe na largura da folha.
    return criarElemento('div', { classe: 'tabela-rolagem' }, [criarElemento('table', { classe: 'tabela relatorio__tabela' }, [
        criarElemento('thead', {}, [criarElemento('tr', {}, colunas.map((coluna) => criarElemento('th', { texto: coluna, atributos: { scope: 'col' } })))]),
        criarElemento('tbody', {}, registros.map((registro) => criarElemento('tr', {}, [
            formatarData(registro.data),
            peso(registro.pesoMedioG, 1),
            peso(registro.racaoKg, 2),
            numero(registro.mortalidade, 0),
            numero(registro.natalidade, 0),
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
        .map((situacao) => ({ ...situacao, ciclo: situacao.cicloAtivo, ...analisarTanque(situacao, { limitesPadrao, hoje, unidades: obterUnidades() }) }));
    const resumo = calcularResumoProducao(ativos);
    const alertas = ordenarAlertas(ativos.flatMap((item) => item.alertas));
    const semCiclo = situacoes.filter((situacao) => !situacao.cicloAtivo);

    const periodo = configurarPeriodo();
    const encerrados = listarCiclosEncerrados({ inicio: periodo.inicio, fim: hoje });

    const secoes = [
        criarSecao('Resumo da produção', [
            // Sem tanque em cultivo, a frase no lugar de uma fileira de zeros.
            ativos.length === 0
                ? criarElemento('p', { classe: 'relatorio__nota', texto: 'Nenhum tanque em cultivo agora.' })
                : criarIndicadores([
                    { rotulo: 'Tanques em cultivo', valor: formatarInteiro(resumo.tanquesAtivos), apoio: `de ${pluralizar(situacoes.length, 'tanque cadastrado', 'tanques cadastrados')}` },
                    { rotulo: 'Peixes', valor: `≈ ${formatarInteiro(resumo.totalPeixes)}` },
                    { rotulo: 'Biomassa', valor: `≈ ${formatarBiomassa(resumo.biomassaTotalKg)}` },
                    { rotulo: 'Ração consumida', valor: formatarRacao(resumo.racaoAcumuladaKg), apoio: 'nos ciclos em andamento' },
                    { rotulo: 'Mortalidade média', valor: formatarPercentual(resumo.mortalidadeMedia), apoio: 'ponderada pelo povoamento' },
                    { rotulo: 'Alertas', valor: formatarInteiro(alertas.length), apoio: alertas.length > 0 ? 'detalhes no fim do relatório' : 'nenhum no momento' },
                ]),
            semCiclo.length > 0 && criarElemento('p', {
                classe: 'relatorio__nota',
                texto: `Sem ciclo em andamento: ${semCiclo.map(({ tanque }) => `${tanque.nome} (${ROTULOS_STATUS[tanque.status].toLowerCase()})`).join(', ')}.`,
            }),
        ]),
        ...ativos.map(criarBlocoTanque),
        criarSecao(`Ciclos encerrados ${periodo.texto}`, [criarTabelaEncerrados(encerrados)]),
        criarSecao('Alertas', [criarListaAlertas(alertas, { mostrarTanque: true, textoVazio: 'Nenhum alerta no momento.' })]),
    ];
    conteudo.replaceChildren(...secoes, criarElemento('p', { classe: 'relatorio__nota', texto: '≈ valor estimado: os números reais saem na despesca.' }));
}

function configurarPeriodo() {
    const escolhido = lerParametro('periodo') in PERIODOS ? lerParametro('periodo') : '90';
    const seletor = porId('campo-periodo-relatorio');
    porId('campo-periodo-relatorio-caixa').hidden = false;
    seletor.value = escolhido;
    seletor.addEventListener('change', () => irPara(montarUrl('relatorio.html', { periodo: seletor.value })));
    return {
        inicio: escolhido === 'tudo' ? null : somarDias(hoje, -Number(escolhido)),
        texto: PERIODOS[escolhido],
    };
}

// Uma linha por ciclo encerrado, com os resultados reais (seção 9.4.1).
function criarTabelaEncerrados(encerrados) {
    if (encerrados.length === 0) {
        return criarElemento('p', { classe: 'relatorio__nota', texto: 'Nenhuma despesca neste período.' });
    }
    const colunas = ['Tanque', 'Ciclo', 'Sobrevivência', 'FCA final', 'Biomassa final', 'Produtividade'];
    return criarElemento('div', { classe: 'tabela-rolagem' }, [criarElemento('table', { classe: 'tabela relatorio__tabela', atributos: { 'data-campo': 'ciclosEncerrados' } }, [
        criarElemento('thead', {}, [criarElemento('tr', {}, colunas.map((coluna) => criarElemento('th', { texto: coluna, atributos: { scope: 'col' } })))]),
        criarElemento('tbody', {}, encerrados.map(({ tanque, ciclo, resultado }) => criarElemento('tr', {}, [
            tanque.nome,
            `${formatarData(ciclo.dataInicio)} a ${formatarData(ciclo.dataDespesca)}`,
            formatarPercentual(resultado.sobrevivenciaReal),
            resultado.fcaFinal === null ? (resultado.racaoTotalKg > 0 ? 'Sem ganho de peso' : 'Sem ração anotada') : formatarFca(resultado.fcaFinal),
            formatarBiomassa(resultado.biomassaFinalKg),
            `${formatarNumero(resultado.produtividadeKgM3, 2)} kg/m³`,
        ].map((valor) => criarElemento('td', { texto: valor }))))),
    ])]);
}

function criarBlocoTanque({ tanque, ciclo, registros, indicadores, alertas }) {
    const area = criarElemento('div', { classe: 'cartao-grafico__area' });
    const desenhou = desenharGraficoLinha(area, calcularSeries(ciclo, registros).biomassa, { formatarValor: formatarBiomassa, rotulo: `Biomassa do ${tanque.nome}` });
    return criarSecao(tanque.nome, [
        criarElemento('p', { classe: 'relatorio__nota', texto: `${tanque.especie} · ${formatarVolume(tanque.volumeM3)} · povoado em ${formatarData(ciclo.dataInicio)} · `
            + `${pluralizar(alertas.length, 'alerta', 'alertas')}` }),
        criarElemento('div', { classe: 'relatorio__bloco' }, [
            criarIndicadores([
                { rotulo: 'Peixes', valor: `≈ ${formatarInteiro(indicadores.quantidade)}` },
                { rotulo: 'Peso médio', valor: formatarGramas(indicadores.pesoMedioG) },
                { rotulo: 'Biomassa', valor: `≈ ${formatarBiomassa(indicadores.biomassaKg)}` },
                { rotulo: 'FCA', valor: `≈ ${formatarFca(indicadores.fca)}` },
                { rotulo: 'Mortalidade observada', valor: formatarPercentual(indicadores.taxaMortalidade) },
                { rotulo: 'Capacidade', valor: `≈ ${formatarPercentual(indicadores.capacidadeUtilizada)}` },
                { rotulo: 'Dias de cultivo', valor: formatarInteiro(indicadores.diasCultivo) },
                { rotulo: 'Último registro', valor: indicadores.ultimoRegistro ? formatarData(indicadores.ultimoRegistro.data) : '—' },
            ], { compacto: true }),
            criarElemento('figure', { classe: 'cartao-grafico' }, [
                criarElemento('figcaption', { classe: 'cartao-grafico__titulo', texto: `Biomassa (${obterUnidadesExibicao().biomassa})` }),
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
    return criarElemento('dl', { classe: `relatorio__indicadores${compacto ? ' relatorio__indicadores--compacto' : ''}` }, itens.map(({ rotulo, valor, apoio, aviso = '' }) => {
        const textoApoio = [apoio].flat().filter(Boolean).join(' · ');
        return criarElemento('div', { classe: 'relatorio__indicador' }, [
            criarElemento('dt', { classe: 'relatorio__rotulo', texto: rotulo }),
            criarElemento('dd', { classe: 'relatorio__valor', texto: valor }),
            textoApoio && criarElemento('dd', { classe: 'relatorio__apoio', texto: textoApoio }),
            aviso && criarElemento('dd', { classe: 'relatorio__apoio relatorio__apoio--atencao', texto: aviso }),
        ]);
    }));
}

function criarListaAlertas(alertas, { mostrarTanque = false, textoVazio }) {
    const lista = criarElemento('ul', { classe: 'lista-alertas' });
    renderizarAlertas(lista, alertas, { mostrarTanque, hrefTanque: (alerta) => montarUrl('tanque.html', { id: alerta.tanqueId }), textoVazio });
    return lista;
}
