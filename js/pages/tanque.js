// Detalhes do tanque (seção 7.3): cabeçalho com as ações e as abas Resumo,
// Histórico e Calendário. Endereço: tanque.html?id=... (#historico abre a aba).

import { hojeISO, paraNumero } from '../core/utils.js';
import {
    formatarData,
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
import { listarEventosCalendario } from '../domain/ciclos.js';
import { excluirRegistro, listarRegistrosDoCiclo, resumirRegistro } from '../domain/registros.js';
import { calcularCargaMaximaKg, calcularSeries } from '../domain/indicadores.js';
import { analisarTanque, resolverLimites } from '../domain/alertas.js';
import { obterLimitesPadrao, obterMetaFca, salvarLimitesTanque } from '../domain/configuracoes.js';
import { irPara, lerParametro, montarUrl } from '../ui/nav.js';
import {
    confirmar,
    criarBarraCapacidade,
    criarElemento,
    criarItemRegistro,
    iniciarAbas,
    iniciarFormulario,
    limparErrosFormulario,
    mostrarErro,
    mostrarErroPagina,
    mostrarMensagem,
    preencherFormulario,
    preencherIndicadores,
    renderizarAlertas,
} from '../ui/componentes.js';
import { desenharGraficoLinha } from '../ui/graficos.js';
import { iniciarCalendario } from '../ui/calendario.js';
import { atualizarMenu, iniciarPagina, obterAcaoDoAlerta } from './comum.js';

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
    calendario = iniciarCalendario({
        grade: porId('calendario'),
        titulo: porId('titulo-mes'),
        botaoAnterior: porId('botao-mes-anterior'),
        botaoSeguinte: porId('botao-mes-seguinte'),
        botaoHoje: porId('botao-mes-atual'),
        lista: porId('lista-eventos-dia'),
        tituloLista: porId('titulo-eventos-dia'),
        hoje: hojeISO(),
        carregarEventos: (inicio, fim) => listarEventosCalendario({ inicio, fim, tanqueId }).map((evento) => ({
            data: evento.data,
            tipo: evento.tipo,
            titulo: evento.rotulo,
            descricao: evento.descricao,
        })),
    });
    configurarAcoes();
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
    porId('observacoes-tanque').textContent = tanque.observacoes;

    const arquivado = tanque.status === 'arquivado';
    mostrarLink('link-novo-registro', Boolean(cicloAtivo), montarUrl('registro.html', { tanqueId: tanque.id }));
    mostrarLink('link-iniciar-ciclo', tanque.status === 'vazio', montarUrl('ciclo-form.html', { tanqueId: tanque.id, acao: 'iniciar' }));
    mostrarLink('link-registrar-despesca', Boolean(cicloAtivo), montarUrl('ciclo-form.html', { tanqueId: tanque.id, acao: 'despesca' }));
    mostrarLink('link-editar-tanque', true, montarUrl('tanque-form.html', { id: tanque.id }));
    porId('botao-limites-alerta').hidden = arquivado;
    porId('botao-desarquivar-tanque').hidden = !arquivado;
    // RN04: com histórico, o tanque é arquivado; sem nenhum ciclo, pode ser excluído.
    porId('botao-arquivar-tanque').hidden = arquivado || Boolean(cicloAtivo) || ciclos.length === 0;
    porId('botao-excluir-tanque').hidden = ciclos.length > 0;
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
        return;
    }

    const limitesPadrao = obterLimitesPadrao();
    const { indicadores, alertas } = analisarTanque(situacao, { limitesPadrao, hoje: hojeISO() });
    porId('barra-capacidade-tanque').replaceChildren(criarBarraCapacidade({
        percentual: indicadores.capacidadeUtilizada,
        cargaKg: indicadores.biomassaKg,
        cargaMaximaKg: indicadores.cargaMaximaKg,
        densidade: indicadores.densidadeKgM3,
        densidadeMaxima: tanque.densidadeMaximaKgM3,
        limiteAlerta: resolverLimites(limitesPadrao, tanque.limitesAlerta).capacidadePct,
        projecaoDias: indicadores.projecaoDiasLimite,
        hrefDefinir: montarUrl('tanque-form.html', { id: tanque.id }),
    }));
    // Informativo (seção 4.2): quantos peixes por m³ entraram no povoamento.
    porId('densidade-povoamento').textContent = `Povoamento com ${formatarNumero(indicadores.densidadePovoamento, 1)} peixes por m³ de água.`;
    preencherIndicadores(porId('conteudo-resumo'), {
        quantidade: formatarInteiro(indicadores.quantidade),
        pesoMedio: formatarGramas(indicadores.pesoMedioG),
        biomassa: formatarKg(indicadores.biomassaKg),
        racaoAcumulada: formatarKg(indicadores.racaoAcumuladaKg),
        ganhoBiomassa: formatarKg(indicadores.ganhoBiomassaKg),
        fca: formatarFca(indicadores.fca),
        taxaMortalidade: formatarPercentual(indicadores.taxaMortalidade),
        taxaSobrevivencia: formatarPercentual(indicadores.taxaSobrevivencia),
        taxaNatalidade: formatarPercentual(indicadores.taxaNatalidade),
        taxaCrescimento: formatarGramasPorDia(indicadores.taxaCrescimentoGDia),
        crescimentoCiclo: formatarGramasPorDia(indicadores.crescimentoCicloGDia),
        densidade: formatarDensidade(indicadores.densidadeKgM3),
        capacidadeUtilizada: formatarPercentual(indicadores.capacidadeUtilizada),
        diasCultivo: formatarInteiro(indicadores.diasCultivo),
    });

    const series = calcularSeries(cicloAtivo, registros);
    desenharGrafico('peso-medio', series.pesoMedio, formatarGramas, 'Peso médio');
    desenharGrafico('biomassa', series.biomassa, formatarKg, 'Biomassa');
    desenharGrafico('mortalidade', series.mortalidade, formatarPercentual, 'Mortalidade acumulada');

    renderizarAlertas(porId('lista-alertas-tanque'), alertas, { obterAcao: obterAcaoDoAlerta, textoVazio: 'Nenhum alerta para este tanque.' });

    const recentes = registros.slice(-MAXIMO_REGISTROS_RECENTES).reverse();
    porId('lista-registros-recentes').replaceChildren(...(recentes.length > 0
        ? recentes.map((registro) => criarItemRegistro({ data: formatarData(registro.data), resumo: resumirRegistro(registro) }))
        : [criarElemento('li', { classe: 'lista-registros__vazio', texto: 'Nenhum registro neste ciclo.' })]));
}

function desenharGrafico(nome, pontos, formatarValor, rotulo) {
    const desenhou = desenharGraficoLinha(porId(`grafico-${nome}`), pontos, { formatarValor, rotulo });
    porId(`aviso-grafico-${nome}`).hidden = desenhou;
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
    porId('corpo-tabela-registros').replaceChildren(...registros.map((registro) => criarLinhaRegistro(registro, editavel)));
    porId('rolagem-tabela-registros').hidden = registros.length === 0;
    porId('aviso-tabela-registros').hidden = registros.length > 0 || !ciclo;
    mostrarLink('link-primeiro-registro', editavel, montarUrl('registro.html', { tanqueId }));
}

function descreverCicloHistorico(ciclo, quantidadeRegistros) {
    const partes = [`Povoamento em ${formatarData(ciclo.dataInicio)} com ${pluralizar(ciclo.quantidadeInicial, 'peixe', 'peixes')} `
        + `de ${formatarGramas(ciclo.pesoMedioInicialG)}`];
    if (ciclo.status === 'encerrado') {
        partes.push(`despesca em ${formatarData(ciclo.dataDespesca)}: ${pluralizar(ciclo.quantidadeDespescada, 'peixe', 'peixes')} `
            + `com ${formatarGramas(ciclo.pesoMedioFinalG)}`);
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
        criarElemento('td', { texto: formatarInteiro(registro.quantidadeContada) }),
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
