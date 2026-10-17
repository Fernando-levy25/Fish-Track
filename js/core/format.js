// Formatação para exibição em pt-BR (seção 9.4). Os valores chegam sempre nas
// unidades de armazenamento (seção 8.1) e só aqui viram texto.

import { ehDataISO, partesData } from './utils.js';

const VAZIO = '—';
const MESES = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const formatadores = new Map();

function ehNumero(valor) {
    return typeof valor === 'number' && Number.isFinite(valor);
}

function obterFormatador(casasMin, casasMax) {
    const chave = `${casasMin}:${casasMax}`;
    if (!formatadores.has(chave)) {
        formatadores.set(chave, new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: casasMin,
            maximumFractionDigits: casasMax,
            // Evita "-0" quando um valor negativo pequeno é arredondado.
            signDisplay: 'negative',
        }));
    }
    return formatadores.get(chave);
}

export function formatarNumero(valor, casasMax = 0, casasMin = 0) {
    return ehNumero(valor) ? obterFormatador(casasMin, casasMax).format(valor) : VAZIO;
}

function comUnidade(valor, casasMax, unidade) {
    return ehNumero(valor) ? `${formatarNumero(valor, casasMax)} ${unidade}` : VAZIO;
}

export function formatarInteiro(valor) {
    return formatarNumero(valor, 0);
}

export function formatarPercentual(valor) {
    return ehNumero(valor) ? `${formatarNumero(valor, 1)}%` : VAZIO;
}

export function formatarFca(valor) {
    return formatarNumero(valor, 2, 2);
}

export function formatarGramas(valor) {
    return comUnidade(valor, 1, 'g');
}

export function formatarKg(valor) {
    return comUnidade(valor, 1, 'kg');
}

export function formatarGramasPorDia(valor) {
    return comUnidade(valor, 1, 'g/dia');
}

export function formatarDensidade(valor) {
    return comUnidade(valor, 2, 'kg/m³');
}

export function formatarVolume(valor) {
    return comUnidade(valor, 1, 'm³');
}

export function pluralizar(quantidade, singular, plural) {
    return `${formatarInteiro(quantidade)} ${quantidade === 1 ? singular : plural}`;
}

export function formatarData(dataISO) {
    if (!ehDataISO(dataISO)) {
        return VAZIO;
    }
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}/${ano}`;
}

export function formatarDataCurta(dataISO) {
    return ehDataISO(dataISO) ? formatarData(dataISO).slice(0, 5) : VAZIO;
}

export function formatarDataPorExtenso(dataISO) {
    const { ano, mes, dia } = partesData(dataISO);
    return `${dia === 1 ? '1º' : dia} de ${MESES[mes - 1]} de ${ano}`;
}

export function formatarMesAno(ano, mes) {
    const nome = MESES[mes - 1];
    return `${nome[0].toUpperCase()}${nome.slice(1)} de ${ano}`;
}
