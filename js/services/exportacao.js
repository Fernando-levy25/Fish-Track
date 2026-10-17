// Exportação CSV e backup/restauração em JSON (seção 9.7). O DOM só é usado
// para disparar o download (seção 10).

import { lerDados, salvarDados, validarEstrutura } from '../core/storage.js';
import { agoraISO, compararTexto, criarSlug, hojeISO } from '../core/utils.js';
import { formatarData } from '../core/format.js';
import { ordenarRegistros } from '../domain/indicadores.js';
import { falharRegra } from '../domain/validacao.js';

// Separador ";" e vírgula decimal: é o que o Excel em português espera.
const SEPARADOR = ';';
const COLUNAS_REGISTROS = [
    ['Tanque', ({ tanque }) => texto(tanque.nome)],
    ['Espécie', ({ tanque }) => texto(tanque.especie)],
    ['Ciclo (povoamento)', ({ ciclo }) => formatarData(ciclo.dataInicio)],
    ['Data', ({ registro }) => formatarData(registro.data)],
    ['Peso médio (g)', ({ registro }) => numero(registro.pesoMedioG)],
    ['Ração (kg)', ({ registro }) => numero(registro.racaoKg)],
    ['Mortalidade', ({ registro }) => numero(registro.mortalidade)],
    ['Natalidade', ({ registro }) => numero(registro.natalidade)],
    ['Quantidade contada', ({ registro }) => numero(registro.quantidadeContada)],
    ['Observações', ({ registro }) => texto(registro.observacoes)],
];
// Uma linha por lembrete (não por ocorrência): as datas concluídas vão juntas.
const COLUNAS_LEMBRETES = [
    ['Título', ({ lembrete }) => texto(lembrete.titulo)],
    ['Tanque', ({ tanque }) => (tanque ? texto(tanque.nome) : 'Geral')],
    ['Data', ({ lembrete }) => formatarData(lembrete.data)],
    ['Repetir', ({ lembrete }) => (lembrete.repetirDias ? `A cada ${lembrete.repetirDias} dias` : 'Não repete')],
    ['Concluído em', ({ lembrete }) => lembrete.concluidas.map(formatarData).join(', ')],
    ['Observação', ({ lembrete }) => texto(lembrete.observacao)],
];

function numero(valor) {
    return valor === null || valor === undefined ? '' : String(valor).replace('.', ',');
}

function texto(valor) {
    // Um texto que começa com =, +, - ou @ seria lido pelo Excel como fórmula.
    return /^[=+\-@]/.test(valor) ? `'${valor}` : valor;
}

function celula(valor) {
    const conteudo = String(valor ?? '');
    return /[";\r\n]/.test(conteudo) ? `"${conteudo.replaceAll('"', '""')}"` : conteudo;
}

export function gerarCsvRegistros({ tanqueId = null } = {}) {
    const dados = lerDados();
    const tanques = new Map(dados.tanques.map((tanque) => [tanque.id, tanque]));
    const ciclos = new Map(dados.ciclos.map((ciclo) => [ciclo.id, ciclo]));
    const linhas = ordenarRegistros(dados.registros.filter((registro) => !tanqueId || registro.tanqueId === tanqueId))
        .map((registro) => ({ registro, tanque: tanques.get(registro.tanqueId), ciclo: ciclos.get(registro.cicloId) }))
        .filter((linha) => linha.tanque && linha.ciclo)
        .sort((a, b) => compararTexto(a.tanque.nome, b.tanque.nome));

    return montarCsv(COLUNAS_REGISTROS, linhas);
}

export function gerarCsvLembretes({ tanqueId = null } = {}) {
    const dados = lerDados();
    const tanques = new Map(dados.tanques.map((tanque) => [tanque.id, tanque]));
    const linhas = dados.lembretes
        .filter((lembrete) => !tanqueId || lembrete.tanqueId === tanqueId)
        .map((lembrete) => ({ lembrete, tanque: tanques.get(lembrete.tanqueId) ?? null }))
        .sort((a, b) => a.lembrete.data.localeCompare(b.lembrete.data) || compararTexto(a.lembrete.titulo, b.lembrete.titulo));
    return montarCsv(COLUNAS_LEMBRETES, linhas);
}

function montarCsv(colunas, linhas) {
    const cabecalho = colunas.map(([titulo]) => celula(titulo)).join(SEPARADOR);
    const corpo = linhas.map((linha) => colunas.map(([, valor]) => celula(valor(linha))).join(SEPARADOR));
    // O BOM no início faz o Excel ler o arquivo como UTF-8 e manter os acentos.
    return { conteudo: `﻿${[cabecalho, ...corpo].join('\r\n')}\r\n`, quantidade: linhas.length };
}

export function exportarCsv({ tanqueId = null } = {}) {
    return baixarCsv(gerarCsvRegistros({ tanqueId }), tanqueId, 'registros');
}

export function exportarCsvLembretes({ tanqueId = null } = {}) {
    return baixarCsv(gerarCsvLembretes({ tanqueId }), tanqueId, 'lembretes');
}

function baixarCsv({ conteudo, quantidade }, tanqueId, assunto) {
    if (quantidade === 0) {
        return { quantidade, arquivo: null };
    }
    const tanque = tanqueId ? lerDados().tanques.find((item) => item.id === tanqueId) : null;
    const arquivo = `fish-track-${assunto}${tanque ? `-${criarSlug(tanque.nome)}` : ''}-${hojeISO()}.csv`;
    baixarArquivo(arquivo, conteudo, 'text/csv;charset=utf-8');
    return { quantidade, arquivo };
}

// Marca a data do backup, que o menu usa para lembrar o produtor de fazer
// outro (seção 3.1), e devolve o conteúdo do arquivo.
export function prepararBackup() {
    const dados = lerDados();
    dados.config.ultimoBackupEm = agoraISO();
    salvarDados(dados);
    return { conteudo: JSON.stringify(dados, null, 2), dados };
}

export function exportarBackup() {
    const { conteudo, dados } = prepararBackup();
    const arquivo = `fish-track-backup-${hojeISO()}.json`;
    baixarArquivo(arquivo, conteudo, 'application/json');
    return { arquivo, dados };
}

// Lê e valida um arquivo de backup sem aplicar nada: a página confirma antes.
// Arquivo errado é engano do produtor, não falha do sistema: vira ErroValidacao.
export async function lerBackup(arquivo) {
    let dados;
    try {
        dados = JSON.parse(await arquivo.text());
    } catch {
        falharRegra('Este arquivo não é um backup do Fish Track: o conteúdo não é um JSON válido.');
    }
    try {
        return validarEstrutura(dados);
    } catch (erro) {
        return falharRegra(erro.message);
    }
}

export function restaurarBackup(dados) {
    salvarDados(dados);
}

function baixarArquivo(nome, conteudo, tipo) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    document.body.append(link);
    link.click();
    link.remove();
    // O navegador ainda precisa da URL logo após o clique para iniciar o download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
