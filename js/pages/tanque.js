// Detalhes do tanque (seção 7.3): cabeçalho com as ações e as abas Resumo,
// Histórico e Calendário. Endereço: tanque.html?id=... (#historico abre a aba).

import { criarSlug, diasEntre, hojeISO, paraNumero } from '../core/utils.js';
import {
    formatarBiomassa,
    formatarData,
    formatarDataCurta,
    formatarDensidade,
    formatarFca,
    formatarGramas,
    formatarGramasPorDia,
    formatarInteiro,
    formatarNumero,
    formatarPercentual,
    formatarRacao,
    formatarVolume,
    obterUnidadesExibicao,
    pluralizar,
} from '../core/format.js';
import { arquivarTanque, desarquivarTanque, excluirTanque, listarTanques, obterSituacao } from '../domain/tanques.js';
import { listarResultadosCiclos } from '../domain/ciclos.js';
import { excluirRegistro, listarRegistrosDoCiclo, resumirRegistro } from '../domain/registros.js';
import { calcularAcompanhamento, calcularCargaMaximaKg, calcularEstatisticasPesos, calcularProximaBiometria, calcularSeries } from '../domain/indicadores.js';
import {
    calcularPreviaBiometria,
    ehRegistroDeBiometria,
    listarBiometriasDoCiclo,
    obterPlanoDoTanque,
    obterProximoTanqueBiometria,
    obterUltimaAmostra,
    salvarBiometria,
} from '../domain/biometrias.js';
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
    criarEtiquetaEstado,
    criarTermo,
    criarValorAusente,
    criarValorEstimado,
    criarResumoCiclo,
    criarSelo,
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
import { desenharGraficoLinha, obterCorTanque } from '../ui/graficos.js';
import { GLOSSARIO } from '../ui/glossario.js';
import { criarIcone } from '../ui/icones.js';
import { criarPainelBiometria } from '../ui/painel-biometria.js';
import { montarAgenda } from './agenda.js';
import { calcularEstadoTanque } from '../domain/estado.js';
import { atualizarMenu, descreverRacaoSugerida, iniciarPagina, obterAcaoDoAlerta } from './comum.js';

const MAXIMO_REGISTROS_RECENTES = 5;

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
let painelBiometria = null;
// Tanque mostrado no painel de biometria: começa no da página e muda na rodada de biometria.
let tanqueDoPainel = null;

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
    configurarMaisAcoes();
    configurarTodosIndicadores();
    mostrarDespescaRecente();
    configurarHistorico();
    configurarLimites();
    configurarBiometria();
    renderizar();
    abrirBiometriaDoEndereco();
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
    renderizarBiometrias();
    renderizarHistorico();
}

// ---------- Cabeçalho e ações ----------

function renderizarCabecalho() {
    const { tanque, ciclos, cicloAtivo } = situacao;
    document.title = `Fish Track - ${tanque.nome}`;
    porId('titulo-tanque').textContent = tanque.nome;
    // Estado em uma palavra, com o motivo (seção 9.12), no lugar do status.
    const { alertas } = analisarTanque(situacao, { limitesPadrao: obterLimitesPadrao(), hoje: hojeISO() });
    porId('estado-tanque').replaceChildren(criarEtiquetaEstado(calcularEstadoTanque({ situacao, alertas })));
    const cargaMaxima = calcularCargaMaximaKg(tanque.densidadeMaximaKgM3, tanque.volumeM3);
    porId('especie-tanque').textContent = `${tanque.especie} · ${formatarVolume(tanque.volumeM3)} de água · `
        + (cargaMaxima ? `carga máxima de ${formatarBiomassa(cargaMaxima)}` : 'capacidade não definida');
    porId('resumo-ciclo').textContent = cicloAtivo ? descreverCicloAtivo(cicloAtivo) : '';
    renderizarProgressoCiclo(cicloAtivo);
    porId('observacoes-tanque').textContent = tanque.observacoes;

    const arquivado = tanque.status === 'arquivado';
    mostrarLink('link-anotar-dia', Boolean(cicloAtivo), montarUrl('folha.html', { tanque: tanque.id }));
    mostrarLink('link-iniciar-ciclo', tanque.status === 'vazio', montarUrl('ciclo-form.html', { tanqueId: tanque.id, acao: 'iniciar' }));
    mostrarLink('link-registrar-despesca', Boolean(cicloAtivo), montarUrl('ciclo-form.html', { tanqueId: tanque.id, acao: 'despesca' }));
    mostrarLink('link-editar-tanque', true, montarUrl('tanque-form.html', { id: tanque.id }));
    mostrarLink('link-exportar-relatorio', true, montarUrl('relatorio.html', { tanqueId: tanque.id, imprimir: 1 }));
    porId('botao-limites-alerta').hidden = arquivado;
    porId('botao-fazer-biometria').hidden = !cicloAtivo;
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
    document.querySelector('[data-campo="tituloGraficoBiomassa"]').textContent = `Biomassa (${obterUnidadesExibicao().biomassa})`;
    desenharGrafico('biomassa', series.biomassa, formatarBiomassa, 'Biomassa');
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

// termo: chave do glossário (ajuda curta, seção 11.6); estimado: "≈" antes do
// valor; ausente: { motivo, acao, href } no lugar de um traço.
function criarCartao({ rotulo, valor, indicador, apoio = [], extra = null, classe = '', termo = null, estimado = false, ausente = null }) {
    let conteudoValor = valor;
    if (ausente) {
        conteudoValor = criarValorAusente(ausente);
    } else if (estimado) {
        conteudoValor = criarValorEstimado(valor);
    }
    return criarElemento('article', { classe: `cartao-indicador ${classe}`.trim() }, [
        criarElemento('h4', { classe: 'cartao-indicador__rotulo' }, [termo ? criarTermo(GLOSSARIO[termo], rotulo) : rotulo]),
        criarElemento('p', { classe: `cartao-indicador__valor${ausente ? ' cartao-indicador__valor--ausente' : ''}`, atributos: { 'data-indicador': indicador } }, [conteudoValor]),
        extra,
        ...apoio.filter(Boolean).map((linha) => (typeof linha === 'string'
            ? criarElemento('p', { classe: 'cartao-indicador__apoio', texto: linha })
            : linha)),
    ]);
}

// Última e próxima biometria (seção 9.11); atrasada, em âmbar e com o botão.
function textoBiometria({ indicadores, acompanhamento, proxima }) {
    const linhas = [];
    if (acompanhamento.houvePesagem) {
        const dias = acompanhamento.diasDesdePesagem;
        const quando = dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`;
        linhas.push(criarElemento('p', { classe: 'cartao-indicador__apoio', texto: `Biometria em ${formatarDataCurta(indicadores.dataPesoAtual)} · ${quando}` }));
    } else {
        linhas.push(criarElemento('p', { classe: 'cartao-indicador__apoio', texto: 'Sem biometria desde o povoamento' }));
    }
    const atrasada = proxima.diasAtraso > 0;
    linhas.push(criarElemento('p', {
        classe: `cartao-indicador__apoio${atrasada ? ' cartao-indicador__apoio--atencao' : ''}`,
        texto: atrasada
            ? `Biometria atrasada há ${pluralizar(proxima.diasAtraso, 'dia', 'dias')}`
            : proxima.diasAteProxima === 0 ? 'Próxima biometria: hoje' : `Próxima biometria em ${formatarDataCurta(proxima.dataProxima)}`,
        atributos: { 'data-indicador': 'proximaBiometria' },
    }));
    linhas.push(criarElemento('button', {
        classe: `botao ${atrasada ? 'botao--primario' : 'botao--secundario'} botao--pequeno cartao-indicador__acao`,
        atributos: { type: 'button', 'data-abrir-biometria': '' },
    }, [criarIcone('balanca'), 'Fazer biometria']));
    return linhas;
}

// Ração de hoje (seção 7.3): a sugerida pelo plano de alimentação do tanque
// (seção 9.10) e quanto já foi registrado hoje. Sem sugestão, o motivo e a ação.
function criarConteudoRacao({ tanque, acompanhamento }) {
    const descricao = descreverRacaoSugerida(situacao);
    const { sugestao } = descricao;
    const conteudo = [
        criarElemento('h3', { classe: 'cartao-racao__titulo', texto: 'Ração de hoje', atributos: { id: 'titulo-racao-hoje' } }),
    ];
    if (sugestao) {
        conteudo.push(
            criarElemento('p', { classe: 'cartao-racao__valor', texto: descricao.textoDia, atributos: { 'data-indicador': 'racaoSugerida' } }),
            criarElemento('p', { classe: 'cartao-racao__detalhe', texto: descricao.textoDetalhe }),
            criarElemento('p', {
                classe: 'cartao-racao__registrado',
                texto: `Registrado hoje: ${formatarRacao(acompanhamento.racaoHojeKg)} de ${formatarRacao(sugestao.racaoDiaKg)}`,
                atributos: { 'data-indicador': 'racaoHoje' },
            }),
            criarBarraLimite({ valor: (acompanhamento.racaoHojeKg / sugestao.racaoDiaKg) * 100, limite: 100 }),
        );
    } else {
        conteudo.push(
            criarElemento('p', { classe: 'cartao-racao__registrado', texto: `Registrado hoje: ${formatarRacao(acompanhamento.racaoHojeKg)}`, atributos: { 'data-indicador': 'racaoHoje' } }),
            criarElemento('p', { classe: 'cartao-racao__motivo' }, [
                `${descricao.textoMotivo} · `,
                criarElemento('a', { classe: 'link', texto: descricao.acaoMotivo.texto, atributos: { href: descricao.acaoMotivo.href } }),
            ]),
        );
    }
    if (descricao.aviso) {
        conteudo.push(criarElemento('p', { classe: 'cartao-racao__aviso', texto: descricao.aviso }));
    }
    if (descricao.plano) {
        conteudo.push(criarElemento('p', { classe: 'cartao-racao__plano' }, [
            `Plano: ${descricao.plano.nome} · `,
            criarElemento('a', { classe: 'link', texto: 'Ver plano', atributos: { href: montarUrl('tanque-form.html', { id: tanque.id }, 'alimentacao') } }),
        ]));
    }
    conteudo.push(criarElemento('a', {
        classe: 'botao botao--primario cartao-racao__acao',
        atributos: { href: montarUrl('registro.html', { tanqueId: tanque.id, data: hojeISO() }) },
    }, [criarIcone('lapis'), 'Anotar']));
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
                ciclo.pesoAlvoG
                    ? `${formatarGramas(indicadores.pesoMedioG)} de ${formatarGramas(ciclo.pesoAlvoG)} · ${formatarPercentual(acompanhamento.percentualPesoAlvo)}`
                    : 'Sem peso alvo neste ciclo',
                ...textoBiometria({ indicadores, acompanhamento, proxima: calcularProximaBiometria({ tanque, ciclo, registros: situacao.registros, hoje: hojeISO() }) }),
            ],
        }),
        criarCartao({
            rotulo: 'Biomassa',
            termo: 'biomassa',
            estimado: true,
            valor: formatarBiomassa(indicadores.biomassaKg),
            indicador: 'biomassa',
            apoio: [
                acompanhamento.ganhoBiomassaSemanaKg !== null && `${acompanhamento.ganhoBiomassaSemanaKg >= 0 ? '+' : ''}${formatarBiomassa(acompanhamento.ganhoBiomassaSemanaKg)} nos últimos 7 dias`,
                `≈ ${formatarInteiro(indicadores.quantidade)} peixes`,
            ],
        }),
        criarCartao({
            rotulo: 'Capacidade',
            termo: 'capacidade',
            estimado: true,
            valor: formatarPercentual(indicadores.capacidadeUtilizada),
            ausente: indicadores.capacidadeUtilizada === null
                ? { motivo: 'Capacidade não definida', acao: 'Definir', href: montarUrl('tanque-form.html', { id: tanque.id }) }
                : null,
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
            apoio: [`Densidade ≈ ${formatarDensidade(indicadores.densidadeKgM3)}`],
        }),
    ];
}

function criarAcompanhamento({ tanque, ciclo, indicadores, acompanhamento }) {
    const metaFca = obterMetaFca(tanque);
    return [
        criarCartao({
            rotulo: 'Mortalidade observada',
            termo: 'mortalidadeObservada',
            valor: formatarPercentual(indicadores.taxaMortalidade),
            indicador: 'taxaMortalidade',
            classe: 'cartao-indicador--compacto',
            apoio: [`Últimos 7 dias: ${formatarPercentual(acompanhamento.taxaMortalidadeSemana)}`, 'Real só na despesca'],
        }),
        criarCartao({
            rotulo: 'FCA',
            termo: 'fca',
            estimado: true,
            valor: formatarFca(indicadores.fca),
            // FCA precisa de ganho de peso: antes da primeira biometria não há.
            ausente: indicadores.fca === null
                ? { motivo: acompanhamento.houvePesagem ? 'Ainda sem ganho de peso' : 'Aparece depois da primeira biometria' }
                : null,
            indicador: 'fca',
            classe: 'cartao-indicador--compacto',
            apoio: [
                `${formatarRacao(indicadores.racaoAcumuladaKg)} de ração consumida para ${formatarBiomassa(indicadores.ganhoBiomassaKg)} de ganho`,
                metaFca && `Meta de ${formatarFca(metaFca)}`,
            ],
        }),
        criarCartao({
            rotulo: 'Crescimento',
            valor: formatarGramasPorDia(indicadores.taxaCrescimentoGDia),
            ausente: indicadores.taxaCrescimentoGDia === null ? { motivo: 'Aparece depois da primeira biometria' } : null,
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
        ['Biomassa (estimada)', formatarBiomassa(indicadores.biomassaKg), null, 'Peixes estimados × peso médio'],
        ['Ração consumida', formatarRacao(indicadores.racaoAcumuladaKg), 'racaoAcumulada', 'Ração fornecida − sobras, somadas no ciclo'],
        ['Ganho de biomassa (estimado)', formatarBiomassa(indicadores.ganhoBiomassaKg), 'ganhoBiomassa', 'Biomassa atual − biomassa do povoamento'],
        ['FCA (estimada)', formatarFca(indicadores.fca), null, 'Ração acumulada ÷ ganho de biomassa'],
        ['Mortalidade observada', formatarPercentual(indicadores.taxaMortalidade), null, 'Mortos encontrados ÷ peixes do povoamento'],
        ['Sobrevivência (estimada)', formatarPercentual(indicadores.taxaSobrevivencia), 'taxaSobrevivencia', '100% − mortalidade observada'],
        acompanhamento.houveNascimento && ['Natalidade', formatarPercentual(indicadores.taxaNatalidade), 'taxaNatalidade', 'Nascimentos ÷ peixes do povoamento'],
        ['Crescimento', formatarGramasPorDia(indicadores.taxaCrescimentoGDia), null, 'Diferença de peso entre as duas últimas biometrias ÷ dias'],
        ['Crescimento no ciclo', formatarGramasPorDia(indicadores.crescimentoCicloGDia), 'crescimentoCiclo', '(Peso atual − peso do povoamento) ÷ dias até a última biometria'],
        ['Crescimento específico (TCE)', indicadores.tceCiclo === null ? '—' : `${formatarNumero(indicadores.tceCiclo, 2)}%/dia`, 'tceCiclo', '(ln peso atual − ln peso do povoamento) ÷ dias × 100'],
        indicadores.fatorCondicao !== null && ['Fator de condição (K)', formatarNumero(indicadores.fatorCondicao, 2), 'fatorCondicao', '100 × peso médio ÷ comprimento médio³ (última biometria com comprimento)'],
        ['Mortalidade da semana', formatarPercentual(acompanhamento.taxaMortalidadeSemana), 'mortalidadeSemana', 'Mortos dos últimos 7 dias ÷ peixes estimados no início da semana'],
        ['Densidade (estimada)', formatarDensidade(indicadores.densidadeKgM3), 'densidade', 'Biomassa ÷ volume do tanque'],
        ['Capacidade (estimada)', formatarPercentual(indicadores.capacidadeUtilizada), null, 'Biomassa ÷ carga máxima do tanque'],
        ['Densidade de povoamento', `${formatarNumero(indicadores.densidadePovoamento, 1)} peixes/m³`, null, 'Peixes do povoamento ÷ volume'],
        ['Dias de cultivo', formatarInteiro(indicadores.diasCultivo), 'diasCultivo', 'Dias desde o povoamento'],
    ];
    // "(estimado)" sai do nome e vira "≈" antes do valor (seção 11.6).
    return linhas.filter(Boolean).map(([nome, valor, indicador, calculo]) => {
        const estimado = / \(estimad[oa]\)$/.test(nome);
        return [nome.replace(/ \(estimad[oa]\)$/, ''), estimado && valor !== '—' ? `≈ ${valor}` : valor, indicador, calculo];
    }).map(([nome, valor, indicador, calculo]) => criarElemento('tr', {}, [
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

// "Mais ações" fecha ao clicar fora ou com Esc, como o "Mais" do menu.
function configurarMaisAcoes() {
    const menu = porId('mais-acoes');
    document.addEventListener('click', (evento) => {
        if (menu.open && !menu.contains(evento.target)) {
            menu.open = false;
        }
    });
    menu.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape' && menu.open) {
            menu.open = false;
            menu.querySelector('summary').focus();
        }
    });
    // Escolhida uma ação, o menu se fecha.
    menu.querySelector('.mais-acoes__menu').addEventListener('click', () => {
        menu.open = false;
    });
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
    // Excluir funciona igual no Histórico e na aba Biometrias (só no ciclo ativo, RN10).
    const aoExcluir = (idSaida) => async (evento) => {
        const botao = evento.target.closest('[data-excluir-registro]');
        if (!botao) {
            return;
        }
        const saida = porId(idSaida);
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
    };
    porId('corpo-tabela-registros').addEventListener('click', aoExcluir('mensagem-historico'));
    porId('corpo-tabela-biometrias').addEventListener('click', aoExcluir('mensagem-biometrias'));
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
        partes.push(`despesca em ${formatarData(ciclo.dataDespesca)}: ${formatarBiomassa(ciclo.biomassaFinalKg)} `
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
    const biometria = ehRegistroDeBiometria(registro);
    // Biometria se edita no painel do tanque; a rotina, no registro.
    const urlEditar = biometria
        ? montarUrl('tanque.html', { id: registro.tanqueId, acao: 'biometria', registro: registro.id })
        : montarUrl('registro.html', { id: registro.id });
    const acoes = editavel
        ? criarElemento('div', { classe: 'tabela__acoes' }, [
            criarElemento('a', {
                classe: 'link',
                texto: 'Editar',
                atributos: { href: urlEditar, 'aria-label': `Editar o registro de ${data}` },
            }),
            criarElemento('button', {
                classe: 'link',
                texto: 'Excluir',
                atributos: { type: 'button', 'data-excluir-registro': registro.id, 'aria-label': `Excluir o registro de ${data}` },
            }),
        ])
        : '—';
    if (biometria) {
        // Linha de biometria: etiqueta e o resumo "60 peixes · 542,5 g" (seção 7.3).
        const resumo = [registro.biometria && pluralizar(registro.biometria.peixesAmostra, 'peixe', 'peixes'), formatarGramas(registro.pesoMedioG)].filter(Boolean).join(' · ');
        return criarElemento('tr', { classe: 'tabela__linha--biometria' }, [
            criarElemento('td', { texto: data }),
            criarElemento('td', { atributos: { colspan: '4' } }, [criarSelo('Biometria', 'info'), ` ${resumo}`]),
            criarElemento('td', { texto: registro.observacoes || '' }),
            criarElemento('td', {}, [acoes]),
        ]);
    }
    const vazio = (valor, formatar) => (valor === null || valor === undefined ? '' : formatar(valor));
    return criarElemento('tr', {}, [
        criarElemento('td', { texto: data }),
        criarElemento('td', { texto: vazio(registro.pesoMedioG, formatarGramas) }),
        criarElemento('td', { texto: vazio(registro.racaoKg, formatarRacao) }),
        criarElemento('td', { texto: vazio(registro.mortalidade, formatarInteiro) }),
        criarElemento('td', { texto: vazio(registro.natalidade, formatarInteiro) }),
        criarElemento('td', { texto: registro.observacoes || '' }),
        criarElemento('td', {}, [acoes]),
    ]);
}

// ---------- Biometria (seção 7.13) ----------

function configurarBiometria() {
    painelBiometria = criarPainelBiometria(porId('painel-biometria'), {
        salvar: salvarDoPainel,
        calcularPrevia: ({ data, pesoMedioG, idEditado }) => {
            const doPainel = obterSituacao(tanqueDoPainel);
            return calcularPreviaBiometria({ situacao: doPainel, plano: obterPlanoDoTanque(doPainel.tanque), data, pesoMedioG, idEditado, hoje: hojeISO() });
        },
        calcularEstatisticas: calcularEstatisticasPesos,
        unidadeAmostra: {
            inicial: lerPreferencia('unidadePesoAmostra', 'kg'),
            aoTrocar: (unidade) => salvarPreferencia('unidadePesoAmostra', unidade),
        },
    });
    document.addEventListener('click', (evento) => {
        if (evento.target.closest('[data-abrir-biometria]')) {
            abrirBiometria(tanqueId);
        }
    });
    // Ao fechar (salvo ou não), a página mostra o que mudou.
    porId('painel-biometria').addEventListener('close', () => recarregar());
}

function abrirBiometria(id, { data = null, registroId = null } = {}) {
    const doPainel = obterSituacao(id);
    if (!doPainel?.cicloAtivo) {
        return;
    }
    tanqueDoPainel = id;
    const hoje = hojeISO();
    const { tanque, cicloAtivo, registros } = doPainel;
    const registro = registroId ? registros.find((item) => item.id === registroId) ?? null : null;
    const pesagens = listarBiometriasDoCiclo(cicloAtivo.id).filter((item) => !item.inicial);
    const ultima = pesagens.at(-1) ?? null;
    painelBiometria.abrir({
        tanque: { id: tanque.id, nome: tanque.nome, especie: tanque.especie, cor: obterCorTanque(tanque, listarTanques({ incluirArquivados: true })) },
        diaCiclo: diasEntre(cicloAtivo.dataInicio, hoje),
        ultima: ultima ? { pesoMedioG: ultima.pesoMedioG, data: ultima.data } : null,
        hoje,
        dataMinima: cicloAtivo.dataInicio,
        data: data && data <= hoje && data >= cicloAtivo.dataInicio ? data : hoje,
        peixesSugeridos: obterUltimaAmostra(doPainel),
        registro,
        temProximo: !registro && Boolean(obterProximoTanqueBiometria({ tanqueIdAtual: id, data: hoje, hoje })),
    });
}

// tanque.html?id=...&acao=biometria(&data=...|&registro=...): chega com o painel aberto.
function abrirBiometriaDoEndereco() {
    if (lerParametro('acao') === 'biometria') {
        abrirBiometria(tanqueId, { data: lerParametro('data'), registroId: lerParametro('registro') });
    }
}

function salvarDoPainel(entrada, { irParaProximo }) {
    const registro = salvarBiometria({ ...entrada, tanqueId: tanqueDoPainel });
    const doPainel = obterSituacao(tanqueDoPainel);
    const proxima = calcularProximaBiometria({ tanque: doPainel.tanque, ciclo: doPainel.cicloAtivo, registros: doPainel.registros, hoje: hojeISO() });
    const resumo = `${doPainel.tanque.nome}: biometria de ${formatarData(registro.data)} salva, ${formatarGramas(registro.pesoMedioG)}. `
        + `Próxima biometria: ${formatarDataCurta(proxima.dataProxima)}.`;
    const seguinte = irParaProximo ? obterProximoTanqueBiometria({ tanqueIdAtual: tanqueDoPainel, data: registro.data }) : null;
    if (seguinte) {
        mostrarMensagem(porId('mensagem-tanque'), resumo);
        abrirBiometria(seguinte.id, { data: registro.data });
        return;
    }
    painelBiometria.fechar();
    mostrarMensagem(porId('mensagem-tanque'), resumo);
}

function renderizarBiometrias() {
    const { cicloAtivo } = situacao;
    const corpo = porId('corpo-tabela-biometrias');
    if (!cicloAtivo) {
        porId('resumo-biometrias').textContent = 'Sem ciclo em andamento: as biometrias aparecem quando o tanque for povoado.';
        corpo.replaceChildren();
        porId('rolagem-tabela-biometrias').hidden = true;
        return;
    }
    const pesagens = listarBiometriasDoCiclo(cicloAtivo.id);
    const proxima = calcularProximaBiometria({ tanque: situacao.tanque, ciclo: cicloAtivo, registros: situacao.registros, hoje: hojeISO() });
    porId('resumo-biometrias').textContent = `A cada ${pluralizar(proxima.intervaloDias, 'dia', 'dias')} · `
        + (proxima.diasAtraso > 0 ? `atrasada há ${pluralizar(proxima.diasAtraso, 'dia', 'dias')}` : `próxima em ${formatarDataCurta(proxima.dataProxima)}`);
    porId('rolagem-tabela-biometrias').hidden = false;
    const linhas = pesagens.map((pesagem, indice) => {
        const anterior = pesagens[indice - 1];
        const dias = anterior ? diasEntre(anterior.data, pesagem.data) : null;
        const ganho = anterior ? pesagem.pesoMedioG - anterior.pesoMedioG : null;
        const { registro } = pesagem;
        const estatisticas = registro?.biometria?.pesosIndividuaisG ? calcularEstatisticasPesos(registro.biometria.pesosIndividuaisG) : null;
        const modo = pesagem.inicial ? 'Povoamento'
            : registro.biometria?.pesosIndividuaisG ? 'Pesos individuais'
                : registro.biometria ? 'Amostra' : 'Peso médio';
        const data = formatarData(pesagem.data);
        const acoes = registro
            ? criarElemento('div', { classe: 'tabela__acoes' }, [
                criarElemento('a', {
                    classe: 'link',
                    texto: 'Editar',
                    atributos: { href: montarUrl('tanque.html', { id: tanqueId, acao: 'biometria', registro: registro.id }), 'aria-label': `Editar a biometria de ${data}` },
                }),
                ehRegistroDeBiometria(registro) && criarElemento('button', {
                    classe: 'link',
                    texto: 'Excluir',
                    atributos: { type: 'button', 'data-excluir-registro': registro.id, 'aria-label': `Excluir a biometria de ${data}` },
                }),
            ])
            : '';
        return criarElemento('tr', {}, [
            criarElemento('td', { texto: data }),
            criarElemento('td', { texto: modo }),
            criarElemento('td', { texto: registro?.biometria ? formatarInteiro(registro.biometria.peixesAmostra) : '' }),
            criarElemento('td', { texto: formatarGramas(pesagem.pesoMedioG) }),
            criarElemento('td', { texto: ganho === null ? '' : `${ganho >= 0 ? '+' : '−'}${formatarGramas(Math.abs(ganho))}` }),
            criarElemento('td', { texto: dias > 0 ? formatarGramasPorDia(ganho / dias) : '' }),
            criarElemento('td', { texto: estatisticas?.cvPct ? formatarPercentual(estatisticas.cvPct) : '' }),
            criarElemento('td', {}, [acoes]),
        ]);
    });
    corpo.replaceChildren(...linhas.reverse());
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
