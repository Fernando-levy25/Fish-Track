// Cadastro de tanques (RN01 a RN04) e consulta da situação de cada um. A
// situação junta o tanque, seus ciclos, o ciclo ativo e os registros desse
// ciclo numa única leitura, que é o que as páginas precisam para calcular.

import { lerDados, salvarDados } from '../core/storage.js';
import { agoraISO, compararTexto, gerarId, limparTexto, mesmoTexto } from '../core/utils.js';
import { ordenarRegistros } from './indicadores.js';
import { falharRegra, lancarSeHouverErros, validarNumero, validarTexto } from './validacao.js';

export const ROTULOS_STATUS = Object.freeze({
    ativo: 'Ativo',
    vazio: 'Vazio',
    manutencao: 'Em manutenção',
    arquivado: 'Arquivado',
});

const TAMANHO_MAXIMO_NOME = 60;
const TAMANHO_MAXIMO_OBSERVACOES = 500;

export function listarTanques({ incluirArquivados = false } = {}) {
    return filtrarTanques(lerDados().tanques, incluirArquivados);
}

export function obterTanque(id) {
    return lerDados().tanques.find((tanque) => tanque.id === id) ?? null;
}

export function listarSituacoes({ incluirArquivados = false } = {}) {
    const dados = lerDados();
    return filtrarTanques(dados.tanques, incluirArquivados).map((tanque) => montarSituacao(dados, tanque));
}

export function obterSituacao(id) {
    const dados = lerDados();
    const tanque = dados.tanques.find((item) => item.id === id);
    return tanque ? montarSituacao(dados, tanque) : null;
}

function filtrarTanques(tanques, incluirArquivados) {
    return tanques
        .filter((tanque) => incluirArquivados || tanque.status !== 'arquivado')
        .sort((a, b) => compararTexto(a.nome, b.nome));
}

function montarSituacao(dados, tanque) {
    const ciclos = dados.ciclos
        .filter((ciclo) => ciclo.tanqueId === tanque.id)
        .sort((a, b) => b.dataInicio.localeCompare(a.dataInicio));
    const cicloAtivo = ciclos.find((ciclo) => ciclo.status === 'ativo') ?? null;
    const registrosDoTanque = ordenarRegistros(dados.registros.filter((registro) => registro.tanqueId === tanque.id));
    return {
        tanque,
        ciclos,
        cicloAtivo,
        registros: cicloAtivo ? registrosDoTanque.filter((registro) => registro.cicloId === cicloAtivo.id) : [],
        ultimoRegistro: registrosDoTanque.at(-1) ?? null,
    };
}

export function salvarTanque(entrada) {
    const dados = lerDados();
    const existente = entrada.id ? dados.tanques.find((tanque) => tanque.id === entrada.id) : null;
    if (entrada.id && !existente) {
        falharRegra('Tanque não encontrado.');
    }

    const nome = limparTexto(entrada.nome);
    const especie = limparTexto(entrada.especie);
    const observacoes = limparTexto(entrada.observacoes);
    const arquivado = existente?.status === 'arquivado';
    const temCicloAtivo = Boolean(existente)
        && dados.ciclos.some((ciclo) => ciclo.tanqueId === existente.id && ciclo.status === 'ativo');
    // A capacidade pode vir como densidade (kg/m³) ou como carga total (kg); o
    // formulário envia só a que o produtor escolheu. Fica guardada sempre em kg/m³.
    const informouCarga = entrada.cargaMaximaKg !== undefined;
    const valorCapacidade = (informouCarga ? entrada.cargaMaximaKg : entrada.densidadeMaximaKgM3) ?? null;
    const erroCapacidade = validarNumero(valorCapacidade, { positivo: true });
    // Sem o campo (ex.: formulário antigo), mantém a tabela que o tanque já tinha.
    const tabelaArracoamentoId = entrada.tabelaArracoamentoId === undefined
        ? existente?.tabelaArracoamentoId ?? null
        : entrada.tabelaArracoamentoId || null;

    lancarSeHouverErros({
        nome: validarTexto(nome, { rotulo: 'o nome do tanque', obrigatorio: true, maximo: TAMANHO_MAXIMO_NOME })
            ?? (arquivado ? null : validarNomeUnico(dados.tanques, nome, existente?.id)),
        especie: validarTexto(especie, { rotulo: 'a espécie', obrigatorio: true, maximo: TAMANHO_MAXIMO_NOME }),
        // RN02
        volumeM3: validarNumero(entrada.volumeM3, { rotulo: 'o volume', obrigatorio: true, positivo: true }),
        [informouCarga ? 'cargaMaximaKg' : 'densidadeMaximaKgM3']: erroCapacidade,
        // RN03: com ciclo ativo o status é sempre "ativo".
        manutencao: entrada.manutencao && temCicloAtivo
            ? 'Um tanque com ciclo ativo não pode entrar em manutenção. Registre a despesca antes.'
            : null,
        observacoes: validarTexto(observacoes, { maximo: TAMANHO_MAXIMO_OBSERVACOES }),
        tabelaArracoamentoId: tabelaArracoamentoId && !dados.config.tabelasArracoamento.some((tabela) => tabela.id === tabelaArracoamentoId)
            ? 'Escolha uma tabela de alimentação existente.'
            : null,
    });

    const agora = agoraISO();
    const status = definirStatus({ arquivado, temCicloAtivo, manutencao: Boolean(entrada.manutencao) });
    const densidadeMaximaKgM3 = valorCapacidade === null || !informouCarga ? valorCapacidade : valorCapacidade / entrada.volumeM3;
    if (existente) {
        Object.assign(existente, {
            nome, especie, volumeM3: entrada.volumeM3, densidadeMaximaKgM3, tabelaArracoamentoId, status, observacoes, atualizadoEm: agora,
        });
        salvarDados(dados);
        return existente;
    }
    const tanque = {
        id: gerarId(),
        nome,
        especie,
        volumeM3: entrada.volumeM3,
        densidadeMaximaKgM3,
        tabelaArracoamentoId,
        status,
        limitesAlerta: null,
        observacoes,
        criadoEm: agora,
        atualizadoEm: agora,
    };
    dados.tanques.push(tanque);
    salvarDados(dados);
    return tanque;
}

// RN03: "ativo" e "vazio" dependem do ciclo; manutenção e arquivamento são escolha do produtor.
function definirStatus({ arquivado, temCicloAtivo, manutencao }) {
    if (arquivado) {
        return 'arquivado';
    }
    if (temCicloAtivo) {
        return 'ativo';
    }
    return manutencao ? 'manutencao' : 'vazio';
}

// RN01: o nome é único entre os tanques não arquivados, sem diferenciar
// maiúsculas nem acentos.
function validarNomeUnico(tanques, nome, idIgnorado) {
    const repetido = tanques.some((tanque) => tanque.id !== idIgnorado
        && tanque.status !== 'arquivado'
        && mesmoTexto(tanque.nome, nome));
    return repetido ? 'Já existe um tanque com esse nome.' : null;
}

export function arquivarTanque(id) {
    const dados = lerDados();
    const tanque = buscarTanque(dados, id);
    // RN04: arquivar tira o tanque de operação; com peixes dentro, esconderia um ciclo em andamento.
    if (dados.ciclos.some((ciclo) => ciclo.tanqueId === id && ciclo.status === 'ativo')) {
        falharRegra('Registre a despesca antes de arquivar o tanque.');
    }
    tanque.status = 'arquivado';
    tanque.atualizadoEm = agoraISO();
    salvarDados(dados);
}

export function desarquivarTanque(id) {
    const dados = lerDados();
    const tanque = buscarTanque(dados, id);
    if (tanque.status !== 'arquivado') {
        return;
    }
    // RN01: enquanto arquivado, outro tanque pode ter passado a usar o mesmo nome.
    if (validarNomeUnico(dados.tanques, tanque.nome, id)) {
        falharRegra(`Já existe um tanque em uso chamado "${tanque.nome}". Renomeie um deles antes de desarquivar.`);
    }
    tanque.status = 'vazio';
    tanque.atualizadoEm = agoraISO();
    salvarDados(dados);
}

export function excluirTanque(id) {
    const dados = lerDados();
    buscarTanque(dados, id);
    // RN04: um tanque com histórico é arquivado, nunca excluído.
    if (dados.ciclos.some((ciclo) => ciclo.tanqueId === id)) {
        falharRegra('Este tanque tem histórico de ciclos e não pode ser excluído. Use a opção Arquivar.');
    }
    dados.tanques = dados.tanques.filter((tanque) => tanque.id !== id);
    salvarDados(dados);
}

function buscarTanque(dados, id) {
    const tanque = dados.tanques.find((item) => item.id === id);
    if (!tanque) {
        falharRegra('Tanque não encontrado.');
    }
    return tanque;
}
