// Detalhes do tanque (seção 7.3): cabeçalho com as ações e as abas Resumo,
// Histórico e Calendário. Endereço: tanque.html?id=... (#historico abre a aba).

import { criarSlug, diasEntre, hojeISO, paraNumero } from '../core/utils.js';
import {
    formatarData,
    formatarDataCurta,
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
import { arquivarTanque, desarquivarTanque, excluirTanque, obterSituacao, ROTULOS_STATUS } from '../domain/tanques.js';
import { listarResultadosCiclos } from '../domain/ciclos.js';
import { excluirRegistro, listarRegistrosDoCiclo, resumirRegistro } from '../domain/registros.js';
import { calcularAcompanhamento, calcularCargaMaximaKg, calcularSeries } from '../domain/indicadores.js';
import { analisarTanque, resolverLimites } from '../domain/alertas.js';
import { obterLimitesPadrao, obterMetaFca, salvarLimitesTanque } from '../domain/configuracoes.js';
import { lerPreferencia, salvarPreferencia } from '../core/storage.js';
import { exportarGraficoPng } from '../services/exportacao.js';
import { irPara, lerParametro, montarUrl } from '../ui/nav.js';
import {
    confirmar,
    criarBarraCapacidade,
    criarBarraLimite,
    criarElemento,
    criarResumoCiclo,
    criarItemRegistro,
    iniciarAbas,
    iniciarFormulario,
    limparErrosFormulario,
    mostrarErro,
    mostrarErroPagina,
    mostrarMensagem,
    preencherFormulario,
    renderizarAlertas,
} from '../ui/componentes.js';
import { desenharGraficoLinha } from '../ui/graficos.js';
import { criarIcone } from '../ui/icones.js';
import { montarAgenda } from './agenda.js';
import { atualizarMenu, iniciarPagina, obterAcaoDoAlerta } from './comum.js';

const MAXIMO_REGISTROS_RECENTES = 5;
// Biometria com mais de 30 dias perde valor: peso, biomassa e ração dependem dela.
const DIAS_BIOMETRIA_ANTIGA = 30;

const TEXTOS_SEM_CICLO = {
    vazio: 'Este tanque não tem ciclo ativo.',
    manutencao: 'Este tanque está em manutenção, sem ciclo ativo.',
    arquivado: 'Este tanque está arquivado. Os ciclos anteriores continuam na aba Histórico.',
};

const tanqueId = lerParametro('id');
const porId = (id) => document.getElementById(id);

let situacao = null;
let abas = null;
let calendario = null;

iniciarPagina();
try {
    iniciar();
} catch (erro) {
    mostrarErroPagina(erro);
}

function iniciar() {
    situacao = tanqueId ? obterSituacao(tanqueId) : null;
    if (!situacao) {
        porId('aviso-tanque-nao-encontrado').hidden = false;
        return;
    }
    porId('conteudo-tanque').hidden = false;
    abas = iniciarAbas(porId('abas-tanque'));
    calendario = montarAgenda(porId('agenda-tanque'), { tanqueId, nivelTitulo: 3 });
    configurarAcoes();
    configurarGraficos();
    configurarInfoEstimativa();
    configurarTodosIndicadores();
    mostrarDespescaRecente();
    configurarHistorico();
    configurarLimites();
    renderizar();
}

function recarregar() {
    situacao = obterSituacao(tanqueId);
    renderizar();
    calendario.atualizar();
    atualizarMenu();
}

function renderizar() {
    renderizarCabecalho();
    renderizarResumo();
    renderizarHistorico();
}

// ---------- Cabeçalho e ações ----------

function renderizarCabecalho() {
    const { tanque, ciclos, cicloAtivo } = situacao;
    document.title = `Fish Track - ${tanque.nome}`;
    porId('titulo-tanque').textContent = tanque.nome;
    const selo = porId('selo-status-tanque');
    selo.textContent = ROTULOS_STATUS[tanque.status];
    selo.className = `selo selo--${tanque.status}`;
    const cargaMaxima = calcularCargaMaximaKg(tanque.densidadeMaximaKgM3, tanque.volumeM3);
    porId('especie-tanque').textContent = `${tanque.especie} · ${formatarVolume(tanque.volumeM3)} de água · `
        + (cargaMaxima ? `carga máxima de ${formatarKg(cargaMaxima)}` : 'capacidade não definida');
    porId('resumo-ciclo').textContent = cicloAtivo ? descreverCicloAtivo(cicloAtivo) : '';
    renderizarProgressoCiclo(cicloAtivo);
    porId('observacoes-tanque').textContent = tanque.observacoes;

    const arquivado = tanque.status === 'arquivado';
    mostrarLink('link-novo-registro', Boolean(cicloAtivo), montarUrl('registro.html', { tanqueId: tanque.id }));
    mostrarLink('link-iniciar-ciclo', tanque.status === 'vazio', montarUrl('ciclo-form.html', { tanqueId: tanque.id, acao: 'iniciar' }));
    mostrarLink('link-registrar-despesca', Boolean(cicloAtivo), montarUrl('ciclo-form.html', { tanqueId: tanque.id, acao: 'despesca' }));
    mostrarLink('link-editar-tanque', true, montarUrl('tanque-form.html', { id: tanque.id }));
    mostrarLink('link-exportar-relatorio', true, montarUrl('relatorio.html', { tanqueId: tanque.id, imprimir: 1 }));
    porId('botao-limites-alerta').hidden = arquivado;
    porId('botao-desarquivar-tanque').hidden = !arquivado;
    // RN04: com histórico, o tanque é arquivado; sem nenhum ciclo, pode ser excluído.
    porId('botao-arquivar-tanque').hidden = arquivado || Boolean(cicloAtivo) || ciclos.length === 0;
    porId('botao-excluir-tanque').hidden = ciclos.length > 0;
}

// "Dia 84 de 180 · despesca prevista em 96 dias"; sem data prevista, só os dias.
function renderizarProgressoCiclo(ciclo) {
    const area = porId('progresso-ciclo');
    area.hidden = !ciclo;
    if (!ciclo) {
        return;
    }
    const hoje = hojeISO();
    const dias = diasEntre(ciclo.dataInicio, hoje);
    const diasPrevistos = ciclo.dataPrevistaDespesca ? diasEntre(ciclo.dataInicio, ciclo.dataPrevistaDespesca) : null;
    const diasAteDespesca = ciclo.dataPrevistaDespesca ? diasEntre(hoje, ciclo.dataPrevistaDespesca) : null;
    if (!diasPrevistos) {
        area.replaceChildren(criarElemento('p', { classe: 'progresso-ciclo__texto', texto: `${pluralizar(dias, 'dia', 'dias')} de cultivo`, atributos: { 'data-indicador': 'diasCultivo' } }));
        return;
    }
    const prazo = diasAteDespesca > 0 ? `despesca prevista em ${pluralizar(diasAteDespesca, 'dia', 'dias')}`
        : diasAteDespesca === 0 ? 'despesca prevista para hoje' : `despesca prevista há ${pluralizar(-diasAteDespesca, 'dia', 'dias')}`;
    const preenchimento = criarElemento('span', { classe: 'progresso-ciclo__preenchimento' });
    preenchimento.style.setProperty('--nivel', `${Math.min(dias / diasPrevistos, 1) * 100}%`);
    area.replaceChildren(
        criarElemento('p', { classe: 'progresso-ciclo__texto', texto: `Dia ${formatarInteiro(dias)} de ${formatarInteiro(diasPrevistos)} · ${prazo}` }),
        criarElemento('span', {
            classe: 'progresso-ciclo__barra',
            atributos: { role: 'progressbar', 'aria-label': 'Andamento do ciclo', 'aria-valuemin': '0', 'aria-valuemax': String(diasPrevistos), 'aria-valuenow': String(Math.min(dias, diasPrevistos)) },
        }, [preenchimento]),
    );
}

function descreverCicloAtivo(ciclo) {
    const partes = [`Ciclo iniciado em ${formatarData(ciclo.dataInicio)}`];
    if (ciclo.dataPrevistaDespesca) {
        partes.push(`despesca prevista para ${formatarData(ciclo.dataPrevistaDespesca)}`);
    }
    return partes.join(' · ');
}

function mostrarLink(id, visivel, href) {
    const link = porId(id);
    link.hidden = !visivel;
    link.href = href;
}

function configurarAcoes() {
    const nome = () => situacao.tanque.nome;
    porId('botao-arquivar-tanque').addEventListener('click', () => executarAcao({
        pergunta: `Arquivar "${nome()}"? Ele sai das listas, do dashboard e do calendário, mas o histórico continua disponível no filtro Arquivados.`,
        textoConfirmar: 'Arquivar',
        acao: () => arquivarTanque(tanqueId),
        mensagem: 'Tanque arquivado.',
    }));
    porId('botao-desarquivar-tanque').addEventListener('click', () => executarAcao({
        acao: () => desarquivarTanque(tanqueId),
        mensagem: 'Tanque desarquivado. Ele voltou às listas como vazio.',
    }));
    porId('botao-excluir-tanque').addEventListener('click', () => executarAcao({
        pergunta: `Excluir "${nome()}"? Esta ação não pode ser desfeita.`,
        textoConfirmar: 'Excluir',
        acao: () => excluirTanque(tanqueId),
        depois: () => irPara('tanques.html'),
    }));
}

async function executarAcao({ pergunta, textoConfirmar, acao, mensagem, depois }) {
    const saida = porId('mensagem-tanque');
    mostrarMensagem(saida, '');
    if (pergunta && !(await confirmar(pergunta, { textoConfirmar }))) {
        return;
    }
    try {
        acao();
    } catch (erro) {
        mostrarErro(saida, erro);
        return;
    }
    if (depois) {
        depois();
        return;
    }
    recarregar();
    mostrarMensagem(saida, mensagem);
}

// ---------- Resumo ----------

function renderizarResumo() {
    const { tanque, cicloAtivo, registros } = situacao;
    porId('conteudo-resumo').hidden = !cicloAtivo;
    porId('aviso-sem-ciclo').hidden = Boolean(cicloAtivo);
    if (!cicloAtivo) {
        porId('texto-aviso-sem-ciclo').textContent = TEXTOS_SEM_CICLO[tanque.status];
        mostrarLink('link-aviso-iniciar-ciclo', tanque.status === 'vazio', montarUrl('ciclo-form.html', { tanqueId: tanque.id, acao: 'iniciar' }));
        renderizarUltimoCiclo();
        return;
    }
    porId('ultimo-ciclo-tanque').hidden = true;

    const hoje = hojeISO();
    const limitesPadrao = obterLimitesPadrao();
    const limites = resolverLimites(limitesPadrao, tanque.limitesAlerta);
    const { indicadores, alertas } = analisarTanque(situacao, { limitesPadrao, hoje });
    const acompanhamento = calcularAcompanhamento({ ciclo: cicloAtivo, registros, indicadores, hoje });
    const contexto = { tanque, ciclo: cicloAtivo, indicadores, acompanhamento, limites, hoje };

    porId('cartao-racao').replaceChildren(...criarConteudoRacao(contexto));
    porId('destaques-tanque').replaceChildren(...criarDestaques(contexto));
    porId('acompanhamento-tanque').replaceChildren(...criarAcompanhamento(contexto));
    porId('corpo-todos-indicadores').replaceChildren(...criarLinhasTodos(contexto));

    const series = calcularSeries(cicloAtivo, registros);
    desenharGrafico('peso-medio', series.pesoMedio, formatarGramas, 'Peso médio');
    desenharGrafico('biomassa', series.biomassa, formatarKg, 'Biomassa');
    desenharGrafico('mortalidade', series.mortalidade, formatarPercentual, 'Mortalidade observada');

    renderizarAlertas(porId('lista-alertas-tanque'), alertas, { obterAcao: obterAcaoDoAlerta, textoVazio: 'Nenhum alerta para este tanque.' });

    const recentes = registros.slice(-MAXIMO_REGISTROS_RECENTES).reverse();
    porId('lista-registros-recentes').replaceChildren(...(recentes.length > 0
        ? recentes.map((registro) => criarItemRegistro({ data: formatarData(registro.data), resumo: resumirRegistro(registro) }))
        : [criarElemento('li', { classe: 'lista-registros__vazio', texto: 'Nenhum registro neste ciclo.' })]));
}

// Tanque sem ciclo ativo: o resultado real do último ciclo no lugar dos cartões (seção 7.3).
function renderizarUltimoCiclo() {
    const ultimo = listarResultadosCiclos(tanqueId)[0];
    porId('ultimo-ciclo-tanque').hidden = !ultimo;
    if (ultimo) {
        porId('descricao-ultimo-ciclo').textContent = `${formatarData(ultimo.ciclo.dataInicio)} a ${formatarData(ultimo.ciclo.dataDespesca)}`;
        porId('resultado-ultimo-ciclo').replaceChildren(criarResumoCiclo(ultimo.resultado, ultimo.anterior));
    }
}

// ---------- Cartões da aba Resumo (seção 7.3) ----------

function criarCartao({ rotulo, valor, indicador, apoio = [], extra = null, classe = '' }) {
    return criarElemento('article', { classe: `cartao-indicador ${classe}`.trim() }, [
        criarElemento('h4', { classe: 'cartao-indicador__rotulo', texto: rotulo }),
        criarElemento('p', { classe: 'cartao-indicador__valor', texto: valor, atributos: { 'data-indicador': indicador } }),
        extra,
        ...apoio.filter(Boolean).map((linha) => (typeof linha === 'string'
            ? criarElemento('p', { classe: 'cartao-indicador__apoio', texto: linha })
            : linha)),
    ]);
}

function textoBiometria({ indicadores, acompanhamento }) {
    if (!acompanhamento.houvePesagem) {
        return criarElemento('p', { classe: 'cartao-indicador__apoio', texto: 'Sem biometria desde o povoamento' });
    }
    const dias = acompanhamento.diasDesdePesagem;
    const quando = dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`;
    return criarElemento('p', {
        classe: `cartao-indicador__apoio${dias > DIAS_BIOMETRIA_ANTIGA ? ' cartao-indicador__apoio--atencao' : ''}`,
        texto: `Biometria em ${formatarDataCurta(indicadores.dataPesoAtual)} · ${quando}`,
    });
}

// Ração de hoje: o que foi anotado hoje. A ração sugerida pela tabela de
// alimentação entra aqui quando ela existir (ainda não implementada).
function criarConteudoRacao({ tanque, acompanhamento }) {
    const conteudo = [
        criarElemento('h3', { classe: 'cartao-racao__titulo', texto: 'Ração de hoje', atributos: { id: 'titulo-racao-hoje' } }),
        criarElemento('p', { classe: 'cartao-racao__valor', texto: `${formatarKg(acompanhamento.racaoHojeKg)} registrados`, atributos: { 'data-indicador': 'racaoHoje' } }),
        criarElemento('p', { classe: 'cartao-racao__motivo', texto: 'A sugestão diária de ração chega com a tabela de alimentação.' }),
    ];
    if (acompanhamento.diasDesdePesagem > DIAS_BIOMETRIA_ANTIGA) {
        conteudo.push(criarElemento('p', {
            classe: 'cartao-racao__aviso',
            texto: `A última biometria tem ${acompanhamento.diasDesdePesagem} dias: pese uma amostra para a ração acompanhar o crescimento.`,
        }));
    }
    conteudo.push(criarElemento('a', {
        classe: 'botao botao--primario cartao-racao__acao',
        atributos: { href: montarUrl('registro.html', { tanqueId: tanque.id, data: hojeISO() }) },
    }, [criarIcone('mais', { classe: 'icone icone--girar' }), 'Registrar alimentação']));
    return conteudo;
}

function criarDestaques({ tanque, ciclo, indicadores, acompanhamento, limites }) {
    const pesoAlvo = ciclo.pesoAlvoG
        ? criarBarraLimite({ valor: acompanhamento.percentualPesoAlvo, limite: 100 })
        : null;
    return [
        criarCartao({
            rotulo: 'Peso médio',
            valor: formatarGramas(indicadores.pesoMedioG),
            indicador: 'pesoMedio',
            extra: pesoAlvo,
            apoio: [
                ciclo.pesoAlvoG && `${formatarGramas(indicadores.pesoMedioG)} de ${formatarGramas(ciclo.pesoAlvoG)} · ${formatarPercentual(acompanhamento.percentualPesoAlvo)}`,
                textoBiometria({ indicadores, acompanhamento }),
            ],
        }),
        criarCartao({
            rotulo: 'Biomassa (estimada)',
            valor: formatarKg(indicadores.biomassaKg),
            indicador: 'biomassa',
            apoio: [
                acompanhamento.ganhoBiomassaSemanaKg !== null && `${acompanhamento.ganhoBiomassaSemanaKg >= 0 ? '+' : ''}${formatarKg(acompanhamento.ganhoBiomassaSemanaKg)} nos últimos 7 dias`,
                `≈ ${formatarInteiro(indicadores.quantidade)} peixes`,
            ],
        }),
        criarCartao({
            rotulo: 'Capacidade (estimada)',
            valor: formatarPercentual(indicadores.capacidadeUtilizada),
            indicador: 'capacidadeUtilizada',
            extra: criarBarraCapacidade({
                percentual: indicadores.capacidadeUtilizada,
                cargaKg: indicadores.biomassaKg,
                cargaMaximaKg: indicadores.cargaMaximaKg,
                densidade: indicadores.densidadeKgM3,
                densidadeMaxima: tanque.densidadeMaximaKgM3,
                limiteAlerta: limites.capacidadePct,
                projecaoDias: indicadores.projecaoDiasLimite,
                compacta: true,
                hrefDefinir: montarUrl('tanque-form.html', { id: tanque.id }),
            }),
            apoio: [`Densidade de ${formatarDensidade(indicadores.densidadeKgM3)}`],
        }),
    ];
}

function criarAcompanhamento({ tanque, ciclo, indicadores, acompanhamento }) {
    const metaFca = obterMetaFca(tanque);
    return [
        criarCartao({
            rotulo: 'Mortalidade observada',
            valor: formatarPercentual(indicadores.taxaMortalidade),
            indicador: 'taxaMortalidade',
            classe: 'cartao-indicador--compacto',
            apoio: [`Últimos 7 dias: ${formatarPercentual(acompanhamento.taxaMortalidadeSemana)}`, 'Real só na despesca'],
        }),
        criarCartao({
            rotulo: 'FCA (estimada)',
            valor: formatarFca(indicadores.fca),
            indicador: 'fca',
            classe: 'cartao-indicador--compacto',
            apoio: [
                `${formatarKg(indicadores.racaoAcumuladaKg)} de ração consumida para ${formatarKg(indicadores.ganhoBiomassaKg)} de ganho`,
                metaFca && `Meta de ${formatarFca(metaFca)}`,
            ],
        }),
        criarCartao({
            rotulo: 'Crescimento',
            valor: formatarGramasPorDia(indicadores.taxaCrescimentoGDia),
            indicador: 'taxaCrescimento',
            classe: 'cartao-indicador--compacto',
            apoio: [
                'Entre as duas últimas biometrias',
                acompanhamento.dataPesoAlvo && `Peso alvo em ~${pluralizar(acompanhamento.diasAtePesoAlvo, 'dia', 'dias')} (${formatarDataCurta(acompanhamento.dataPesoAlvo)})`,
                ciclo.pesoAlvoG && indicadores.pesoMedioG >= ciclo.pesoAlvoG && 'Peso alvo atingido',
            ],
        }),
    ];
}

// "Ver todos os indicadores": tabela de conferência, com o cálculo de cada um.
function criarLinhasTodos({ indicadores, acompanhamento }) {
    const linhas = [
        ['Peixes (estimado)', formatarInteiro(indicadores.quantidade), 'quantidade', 'Povoamento − mortos encontrados + nascimentos'],
        ['Peso médio', formatarGramas(indicadores.pesoMedioG), null, 'Última biometria (ou o peso do povoamento)'],
        ['Biomassa (estimada)', formatarKg(indicadores.biomassaKg), null, 'Peixes estimados × peso médio'],
        ['Ração acumulada', formatarKg(indicadores.racaoAcumuladaKg), 'racaoAcumulada', 'Soma da ração registrada no ciclo'],
        ['Ganho de biomassa (estimado)', formatarKg(indicadores.ganhoBiomassaKg), 'ganhoBiomassa', 'Biomassa atual − biomassa do povoamento'],
        ['FCA (estimada)', formatarFca(indicadores.fca), null, 'Ração acumulada ÷ ganho de biomassa'],
        ['Mortalidade observada', formatarPercentual(indicadores.taxaMortalidade), null, 'Mortos encontrados ÷ peixes do povoamento'],
        ['Sobrevivência (estimada)', formatarPercentual(indicadores.taxaSobrevivencia), 'taxaSobrevivencia', '100% − mortalidade observada'],
        acompanhamento.houveNascimento && ['Natalidade', formatarPercentual(indicadores.taxaNatalidade), 'taxaNatalidade', 'Nascimentos ÷ peixes do povoamento'],
        ['Crescimento', formatarGramasPorDia(indicadores.taxaCrescimentoGDia), null, 'Diferença de peso entre as duas últimas biometrias ÷ dias'],
        ['Crescimento no ciclo', formatarGramasPorDia(indicadores.crescimentoCicloGDia), 'crescimentoCiclo', '(Peso atual − peso do povoamento) ÷ dias até a última biometria'],
        ['Densidade (estimada)', formatarDensidade(indicadores.densidadeKgM3), 'densidade', 'Biomassa ÷ volume do tanque'],
        ['Capacidade (estimada)', formatarPercentual(indicadores.capacidadeUtilizada), null, 'Biomassa ÷ carga máxima do tanque'],
        ['Densidade de povoamento', `${formatarNumero(indicadores.densidadePovoamento, 1)} peixes/m³`, null, 'Peixes do povoamento ÷ volume'],
        ['Dias de cultivo', formatarInteiro(indicadores.diasCultivo), 'diasCultivo', 'Dias desde o povoamento'],
    ];
    return linhas.filter(Boolean).map(([nome, valor, indicador, calculo]) => criarElemento('tr', {}, [
        criarElemento('th', { texto: nome, atributos: { scope: 'row' } }),
        criarElemento('td', { texto: valor, atributos: { 'data-indicador': indicador } }),
        criarElemento('td', { classe: 'todos-indicadores__calculo', texto: calculo }),
    ]));
}

function desenharGrafico(nome, pontos, formatarValor, rotulo) {
    const desenhou = desenharGraficoLinha(porId(`grafico-${nome}`), pontos, { formatarValor, rotulo });
    porId(`aviso-grafico-${nome}`).hidden = desenhou;
    document.querySelector(`[data-baixar-grafico="${nome}"]`).hidden = !desenhou;
}

// "Baixar imagem" de cada gráfico da aba Resumo (seção 9.9).
function configurarGraficos() {
    porId('conteudo-resumo').addEventListener('click', (evento) => {
        const botao = evento.target.closest('[data-baixar-grafico]');
        if (!botao) {
            return;
        }
        const nome = botao.dataset.baixarGrafico;
        const { tanque } = situacao;
        const hoje = hojeISO();
        exportarGraficoPng(porId(`grafico-${nome}`).querySelector('svg'), `fish-track-${criarSlug(tanque.nome)}-${nome}-${hoje}`, {
            titulo: `${botao.closest('figure').querySelector('figcaption').textContent} · ${tanque.nome}`,
            subtitulo: `Fish Track · ${formatarData(hoje)}`,
        }).catch(mostrarErroPagina);
    });
}

// O "i" ao lado dos indicadores explica por que eles são estimados.
// "Ver todos os indicadores" lembra se ficou aberto (preferência de tela, fora dos dados).
function configurarTodosIndicadores() {
    const detalhes = porId('todos-indicadores');
    detalhes.open = lerPreferencia('todosIndicadoresAbertos', false);
    detalhes.addEventListener('toggle', () => salvarPreferencia('todosIndicadoresAbertos', detalhes.open));
}

function configurarInfoEstimativa() {
    const botao = porId('botao-info-estimativa');
    botao.addEventListener('click', () => {
        const aberto = botao.getAttribute('aria-expanded') === 'true';
        botao.setAttribute('aria-expanded', String(!aberto));
        porId('texto-info-estimativa').hidden = aberto;
    });
}

// Vindo da despesca (?despesca=1): o resumo do ciclo que acabou de fechar.
function mostrarDespescaRecente() {
    if (!lerParametro('despesca')) {
        return;
    }
    const recente = listarResultadosCiclos(tanqueId)[0];
    if (recente) {
        porId('resultado-despesca').replaceChildren(criarResumoCiclo(recente.resultado, recente.anterior));
        porId('aviso-despesca').hidden = false;
    }
}

// ---------- Histórico ----------

function configurarHistorico() {
    porId('botao-ver-historico').addEventListener('click', () => abas.ativar('aba-historico'));
    porId('seletor-ciclo').addEventListener('change', renderizarTabela);
    porId('corpo-tabela-registros').addEventListener('click', async (evento) => {
        const botao = evento.target.closest('[data-excluir-registro]');
        if (!botao) {
            return;
        }
        const saida = porId('mensagem-historico');
        mostrarMensagem(saida, '');
        const confirmado = await confirmar('Excluir este registro? Os indicadores do ciclo serão recalculados.', { textoConfirmar: 'Excluir' });
        if (!confirmado) {
            return;
        }
        try {
            excluirRegistro(botao.dataset.excluirRegistro);
        } catch (erro) {
            mostrarErro(saida, erro);
            return;
        }
        recarregar();
        mostrarMensagem(saida, 'Registro excluído.');
    });
}

function renderizarHistorico() {
    const { ciclos } = situacao;
    const seletor = porId('seletor-ciclo');
    const escolhido = seletor.value;
    seletor.replaceChildren(...ciclos.map((ciclo) => criarElemento('option', {
        texto: ciclo.status === 'ativo'
            ? `Atual, desde ${formatarData(ciclo.dataInicio)}`
            : `${formatarData(ciclo.dataInicio)} a ${formatarData(ciclo.dataDespesca)}`,
        atributos: { value: ciclo.id },
    })));
    if (ciclos.some((ciclo) => ciclo.id === escolhido)) {
        seletor.value = escolhido;
    }
    seletor.parentElement.hidden = ciclos.length === 0;
    renderizarTabela();
}

function renderizarTabela() {
    const ciclo = situacao.ciclos.find((item) => item.id === porId('seletor-ciclo').value) ?? null;
    const registros = ciclo ? listarRegistrosDoCiclo(ciclo.id).reverse() : [];
    // Só os registros do ciclo ativo podem mudar; os anteriores ficam para consulta (RN10).
    const editavel = ciclo?.status === 'ativo';

    porId('resumo-ciclo-historico').textContent = ciclo
        ? descreverCicloHistorico(ciclo, registros.length)
        : 'Este tanque ainda não teve nenhum ciclo.';
    // Ciclo encerrado: o resultado real, comparado com o ciclo anterior.
    const resultado = ciclo?.status === 'encerrado' ? listarResultadosCiclos(tanqueId).find((item) => item.ciclo.id === ciclo.id) : null;
    const areaResultado = porId('resultado-ciclo-historico');
    areaResultado.replaceChildren(...(resultado ? [criarResumoCiclo(resultado.resultado, resultado.anterior)] : []));
    areaResultado.hidden = !resultado;
    porId('corpo-tabela-registros').replaceChildren(...registros.map((registro) => criarLinhaRegistro(registro, editavel)));
    porId('rolagem-tabela-registros').hidden = registros.length === 0;
    porId('aviso-tabela-registros').hidden = registros.length > 0 || !ciclo;
    mostrarLink('link-primeiro-registro', editavel, montarUrl('registro.html', { tanqueId }));
}

function descreverCicloHistorico(ciclo, quantidadeRegistros) {
    const partes = [`Povoamento em ${formatarData(ciclo.dataInicio)} com ${pluralizar(ciclo.quantidadeInicial, 'peixe', 'peixes')} `
        + `de ${formatarGramas(ciclo.pesoMedioInicialG)}`];
    if (ciclo.status === 'encerrado') {
        partes.push(`despesca em ${formatarData(ciclo.dataDespesca)}: ${formatarKg(ciclo.biomassaFinalKg)} `
            + `com peso médio de ${formatarGramas(ciclo.pesoMedioFinalG)}`);
    }
    partes.push(pluralizar(quantidadeRegistros, 'registro', 'registros'));
    if (ciclo.status === 'encerrado') {
        partes.push('somente consulta');
    }
    return partes.join(' · ');
}

function criarLinhaRegistro(registro, editavel) {
    const data = formatarData(registro.data);
    const acoes = editavel
        ? criarElemento('div', { classe: 'tabela__acoes' }, [
            criarElemento('a', {
                classe: 'link',
                texto: 'Editar',
                atributos: { href: montarUrl('registro.html', { id: registro.id }), 'aria-label': `Editar o registro de ${data}` },
            }),
            criarElemento('button', {
                classe: 'link',
                texto: 'Excluir',
                atributos: { type: 'button', 'data-excluir-registro': registro.id, 'aria-label': `Excluir o registro de ${data}` },
            }),
        ])
        : '—';
    return criarElemento('tr', {}, [
        criarElemento('td', { texto: data }),
        criarElemento('td', { texto: formatarNumero(registro.pesoMedioG, 1) }),
        criarElemento('td', { texto: formatarNumero(registro.racaoKg, 2) }),
        criarElemento('td', { texto: formatarInteiro(registro.mortalidade) }),
        criarElemento('td', { texto: formatarInteiro(registro.natalidade) }),
        criarElemento('td', { texto: registro.observacoes || '—' }),
        criarElemento('td', {}, [acoes]),
    ]);
}

// ---------- Limites de alerta do tanque ----------

function configurarLimites() {
    const dialogo = porId('dialogo-limites');
    const formulario = porId('formulario-limites-tanque');
    const erroGeral = porId('erro-geral-limites-tanque');

    porId('botao-limites-alerta').addEventListener('click', () => {
        const padrao = { ...obterLimitesPadrao(), metaFca: obterMetaFca() };
        const proprios = situacao.tanque.limitesAlerta ?? {};
        limparErrosFormulario(formulario, erroGeral);
        preencherFormulario(formulario, Object.fromEntries(Object.keys(padrao).map((campo) => [campo, proprios[campo] ?? null])));
        for (const [campo, valor] of Object.entries(padrao)) {
            formulario.elements.namedItem(campo).placeholder = `Padrão: ${formatarNumero(valor, 2)}`;
        }
        dialogo.showModal();
    });
    porId('botao-cancelar-limites').addEventListener('click', () => dialogo.close());
    porId('botao-limpar-limites').addEventListener('click', () => {
        for (const campo of formulario.elements) {
            if (campo.name) {
                campo.value = '';
            }
        }
    });
    iniciarFormulario(formulario, {
        erroGeral,
        aoEnviar: (valores) => {
            salvarLimitesTanque(tanqueId, Object.fromEntries(Object.entries(valores).map(([campo, valor]) => [campo, paraNumero(valor)])));
            dialogo.close();
            recarregar();
            mostrarMensagem(porId('mensagem-tanque'), 'Limites de alerta do tanque atualizados.');
        },
    });
}
