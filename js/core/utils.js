// Helpers gerais: identificadores, datas e textos.
// Datas do domínio são texto "AAAA-MM-DD" (seção 8.1). As contas de dias usam
// UTC para que o fuso e o horário de verão não desloquem o resultado.

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export function gerarId() {
    // crypto.randomUUID só existe em contexto seguro (https ou localhost). Ao
    // abrir o app pelo IP da rede local, como no teste pelo celular, ele não
    // está disponível, e o fallback gera um UUID v4 equivalente.
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function agoraISO() {
    return new Date().toISOString();
}

export function hojeISO() {
    // toISOString usaria UTC: à noite, no Brasil, já seria o dia seguinte.
    const agora = new Date();
    return montarDataISO(agora.getFullYear(), agora.getMonth() + 1, agora.getDate());
}

export function montarDataISO(ano, mes, dia) {
    return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function partesData(dataISO) {
    const [ano, mes, dia] = dataISO.split('-').map(Number);
    return { ano, mes, dia };
}

export function ehDataISO(texto) {
    if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        return false;
    }
    const { ano, mes, dia } = partesData(texto);
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    // Rejeita datas que o Date "corrige", como 2026-02-30.
    return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

function paraMsUtc(dataISO) {
    const { ano, mes, dia } = partesData(dataISO);
    return Date.UTC(ano, mes - 1, dia);
}

export function diasEntre(inicioISO, fimISO) {
    return Math.round((paraMsUtc(fimISO) - paraMsUtc(inicioISO)) / MS_POR_DIA);
}

export function somarDias(dataISO, dias) {
    return new Date(paraMsUtc(dataISO) + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

export function diaDaSemana(dataISO) {
    return new Date(paraMsUtc(dataISO)).getUTCDay();
}

export function diasNoMes(ano, mes) {
    return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function paraNumero(valor) {
    // Campo vazio vira null (não informado). Texto que não é número vira NaN,
    // para a validação avisar em vez de gravar zero. A vírgula é aceita porque
    // alguns teclados não a trocam por ponto.
    if (valor === null || valor === undefined) {
        return null;
    }
    if (typeof valor === 'number') {
        return Number.isFinite(valor) ? valor : NaN;
    }
    const texto = String(valor).trim().replace(',', '.');
    if (texto === '') {
        return null;
    }
    return /^-?\d+(\.\d+)?$/.test(texto) ? Number(texto) : NaN;
}

export function limparTexto(valor) {
    return String(valor ?? '').trim();
}

export function compararTexto(a, b) {
    // numeric: "Tanque 2" vem antes de "Tanque 10".
    return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

export function mesmoTexto(a, b) {
    return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }) === 0;
}

export function criarSlug(texto) {
    const slug = texto
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || 'arquivo';
}
