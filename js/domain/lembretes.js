// Lembretes da agenda (seção 7.5): tarefas com data, de um tanque ou gerais,
// que podem se repetir. Uma ocorrência é o lembrete num dia específico; as
// concluídas e as removidas "só esta vez" ficam guardadas por data.

import { lerDados, salvarDados } from '../core/storage.js';
import { agoraISO, diasEntre, gerarId, hojeISO, limparTexto, somarDias } from '../core/utils.js';
import { falharRegra, lancarSeHouverErros, validarData, validarTexto } from './validacao.js';

export const REPETICOES = Object.freeze([7, 15, 30]);
const TAMANHO_MAXIMO_TITULO = 80;
const TAMANHO_MAXIMO_OBSERVACAO = 300;
// Atrasados olham só para trás até este limite: um lembrete semanal esquecido
// por meses não deve encher o quadro de hoje.
export const JANELA_ATRASADOS_DIAS = 30;

export function obterLembrete(id) {
    return lerDados().lembretes.find((lembrete) => lembrete.id === id) ?? null;
}

export function salvarLembrete(entrada) {
    const dados = lerDados();
    const existente = entrada.id ? dados.lembretes.find((lembrete) => lembrete.id === entrada.id) : null;
    if (entrada.id && !existente) {
        falharRegra('Lembrete não encontrado.');
    }
    const titulo = limparTexto(entrada.titulo);
    const observacao = limparTexto(entrada.observacao);
    const tanqueId = entrada.tanqueId || null;
    const repetirDias = entrada.repetirDias ?? null;
    const tanque = tanqueId ? dados.tanques.find((item) => item.id === tanqueId) : null;

    lancarSeHouverErros({
        // RN16
        titulo: validarTexto(titulo, { rotulo: 'o título do lembrete', obrigatorio: true, maximo: TAMANHO_MAXIMO_TITULO }),
        // Lembretes podem ser de qualquer data, passada ou futura (seção 7.3).
        data: validarData(entrada.data, { rotulo: 'a data', obrigatoria: true }),
        // RN17
        tanqueId: tanqueId && (!tanque || tanque.status === 'arquivado') ? 'Escolha um tanque que não esteja arquivado, ou Geral.' : null,
        // RN18
        repetirDias: repetirDias !== null && !REPETICOES.includes(repetirDias) ? 'A repetição só pode ser a cada 7, 15 ou 30 dias.' : null,
        observacao: validarTexto(observacao, { maximo: TAMANHO_MAXIMO_OBSERVACAO }),
    });

    const agora = agoraISO();
    const campos = { data: entrada.data, titulo, tanqueId, repetirDias, observacao, atualizadoEm: agora };
    if (existente) {
        Object.assign(existente, campos);
        salvarDados(dados);
        return existente;
    }
    const lembrete = {
        id: gerarId(),
        data: entrada.data,
        titulo,
        tanqueId,
        repetirDias,
        observacao,
        concluidas: [],
        excluidas: [],
        criadoEm: agora,
        atualizadoEm: agora,
    };
    dados.lembretes.push(lembrete);
    salvarDados(dados);
    return lembrete;
}

export function alternarConclusao(id, data) {
    const dados = lerDados();
    const lembrete = buscarLembrete(dados, id);
    lembrete.concluidas = lembrete.concluidas.includes(data)
        ? lembrete.concluidas.filter((item) => item !== data)
        : [...lembrete.concluidas, data].sort();
    lembrete.atualizadoEm = agoraISO();
    salvarDados(dados);
    return lembrete.concluidas.includes(data);
}

// "Só esta vez": a ocorrência some, as outras repetições continuam.
// Num lembrete que não se repete, remover a ocorrência é remover o lembrete.
export function removerOcorrencia(id, data) {
    const dados = lerDados();
    const lembrete = buscarLembrete(dados, id);
    if (!lembrete.repetirDias) {
        dados.lembretes = dados.lembretes.filter((item) => item.id !== id);
    } else {
        lembrete.excluidas = [...new Set([...lembrete.excluidas, data])].sort();
        lembrete.atualizadoEm = agoraISO();
    }
    salvarDados(dados);
}

export function removerLembrete(id) {
    const dados = lerDados();
    buscarLembrete(dados, id);
    dados.lembretes = dados.lembretes.filter((item) => item.id !== id);
    salvarDados(dados);
}

function buscarLembrete(dados, id) {
    const lembrete = dados.lembretes.find((item) => item.id === id);
    if (!lembrete) {
        falharRegra('Lembrete não encontrado.');
    }
    return lembrete;
}

// Ocorrências entre duas datas (inclusive). Com tanqueId, só as daquele tanque
// e as gerais, que aparecem com qualquer filtro de tanque (seção 7.1).
export function listarOcorrencias({ inicio, fim, tanqueId = null, dados = lerDados(), hoje = hojeISO() }) {
    const tanques = new Map(dados.tanques.map((tanque) => [tanque.id, tanque]));
    const ocorrencias = [];
    for (const lembrete of dados.lembretes) {
        if (tanqueId && lembrete.tanqueId && lembrete.tanqueId !== tanqueId) {
            continue;
        }
        const tanque = lembrete.tanqueId ? tanques.get(lembrete.tanqueId) : null;
        // Tanque arquivado: os lembretes ficam no histórico, sem ocorrências futuras.
        const ultimaData = tanque?.status === 'arquivado' && hoje < fim ? somarDias(hoje, -1) : fim;
        for (const data of datasDoLembrete(lembrete, inicio, ultimaData)) {
            ocorrencias.push({
                lembreteId: lembrete.id,
                data,
                titulo: lembrete.titulo,
                tanqueId: lembrete.tanqueId,
                tanqueNome: tanque?.nome ?? null,
                repetirDias: lembrete.repetirDias,
                observacao: lembrete.observacao,
                concluida: lembrete.concluidas.includes(data),
            });
        }
    }
    return ocorrencias.sort((a, b) => a.data.localeCompare(b.data) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

// Ocorrências de dias anteriores que ninguém concluiu (seção 7.2).
export function listarAtrasados({ hoje = hojeISO(), tanqueId = null } = {}) {
    return listarOcorrencias({ inicio: somarDias(hoje, -JANELA_ATRASADOS_DIAS), fim: somarDias(hoje, -1), tanqueId, hoje })
        .filter((ocorrencia) => !ocorrencia.concluida);
}

// Ocorrência num dia D: D >= data, D não removido e, se repetir, a distância
// até a primeira data é múltipla da repetição (seção 7.5).
function datasDoLembrete(lembrete, inicio, fim) {
    const datas = [];
    if (!lembrete.repetirDias) {
        if (lembrete.data >= inicio && lembrete.data <= fim && !lembrete.excluidas.includes(lembrete.data)) {
            datas.push(lembrete.data);
        }
        return datas;
    }
    const passos = Math.max(Math.ceil(diasEntre(lembrete.data, inicio) / lembrete.repetirDias), 0);
    for (let data = somarDias(lembrete.data, passos * lembrete.repetirDias); data <= fim; data = somarDias(data, lembrete.repetirDias)) {
        if (!lembrete.excluidas.includes(data)) {
            datas.push(data);
        }
    }
    return datas;
}
