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

// ---------- Unidades de peso (seção 8.1) ----------

// Gramas por unidade: as conversões passam sempre por aqui.
const GRAMAS_POR_UNIDADE = Object.freeze({ g: 1, kg: 1000, t: 1000000 });
// Unidade em que cada grandeza é guardada (seção 8.1).
const UNIDADE_BASE = Object.freeze({ racao: 'kg', biomassa: 'kg', pesoAmostra: 'g', pesoMedio: 'g' });
// Preferência de exibição (config.unidades), definida ao abrir a página. Fica
// aqui porque core não lê dados: quem lê é a página, que avisa este módulo.
const unidadesExibicao = { biomassa: 'kg', racao: 'kg' };

export function definirUnidadesExibicao({ biomassa, racao } = {}) {
    if (biomassa === 'kg' || biomassa === 't') {
        unidadesExibicao.biomassa = biomassa;
    }
    if (racao === 'kg' || racao === 'g') {
        unidadesExibicao.racao = racao;
    }
}

export function obterUnidadesExibicao() {
    return { ...unidadesExibicao };
}

export function converterUnidade(valor, de, para) {
    if (!ehNumero(valor)) {
        return valor;
    }
    // Arredonda o ruído do ponto flutuante (32,55 kg viraria 32.549,999… g),
    // que de outro modo seria gravado.
    return Math.round(((valor * GRAMAS_POR_UNIDADE[de]) / GRAMAS_POR_UNIDADE[para]) * 1e6) / 1e6;
}

// Valor digitado numa unidade escolhida → unidade de armazenamento da grandeza.
export function converterParaBase(valor, unidade, grandeza) {
    return converterUnidade(valor, unidade, UNIDADE_BASE[grandeza]);
}

// "500 g", "1,25 t": o número na unidade pedida, sempre com o símbolo.
export function formatarMassa(valorBase, grandeza, unidade) {
    const casas = { g: 0, kg: 1, t: 2 }[unidade];
    return comUnidade(converterUnidade(valorBase, UNIDADE_BASE[grandeza], unidade), casas, unidade);
}

// Biomassa e ração seguem a preferência e nunca trocam de unidade sozinhas
// conforme o tamanho do número (CLAUDE.md, unidades na interface).
export function formatarBiomassa(kg) {
    return formatarMassa(kg, 'biomassa', unidadesExibicao.biomassa);
}

export function formatarRacao(kg) {
    return formatarMassa(kg, 'racao', unidadesExibicao.racao);
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

const DIAS_DA_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

// "Sábado, 17 de outubro de 2026", para o cabeçalho do dashboard.
export function formatarDataCompleta(dataISO) {
    const { ano, mes, dia } = partesData(dataISO);
    const semana = DIAS_DA_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
    return `${semana[0].toUpperCase()}${semana.slice(1)}, ${formatarDataPorExtenso(dataISO)}`;
}

export function formatarMesAno(ano, mes) {
    const nome = MESES[mes - 1];
    return `${nome[0].toUpperCase()}${nome.slice(1)} de ${ano}`;
}
