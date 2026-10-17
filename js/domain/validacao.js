// Validações compartilhadas pelo domínio. Cada validador devolve a mensagem de
// erro ou null. As funções de cadastro juntam os erros por campo, com a chave
// igual ao name do campo no formulário (seção 11.3), e lançam ErroValidacao.

import { ehDataISO } from '../core/utils.js';
import { formatarNumero } from '../core/format.js';

export class ErroValidacao extends Error {
    constructor(erros = {}, mensagem = 'Revise os campos destacados.') {
        super(mensagem);
        this.name = 'ErroValidacao';
        this.erros = erros;
    }
}

export function lancarSeHouverErros(erros) {
    const encontrados = Object.fromEntries(Object.entries(erros).filter(([, mensagem]) => mensagem));
    if (Object.keys(encontrados).length > 0) {
        throw new ErroValidacao(encontrados);
    }
}

// Para regras que não pertencem a um campo só, como iniciar ciclo em tanque
// que não está vazio. A página mostra a mensagem no topo do formulário.
export function falharRegra(mensagem) {
    throw new ErroValidacao({}, mensagem);
}

export function validarTexto(valor, { rotulo = 'o texto', obrigatorio = false, maximo = null } = {}) {
    if (valor === '') {
        return obrigatorio ? `Informe ${rotulo}.` : null;
    }
    if (maximo !== null && valor.length > maximo) {
        return `Use no máximo ${maximo} caracteres.`;
    }
    return null;
}

export function validarNumero(valor, {
    rotulo = 'o valor',
    obrigatorio = false,
    inteiro = false,
    positivo = false,
    minimo = null,
    maximo = null,
} = {}) {
    if (valor === null || valor === undefined) {
        return obrigatorio ? `Informe ${rotulo}.` : null;
    }
    if (!Number.isFinite(valor)) {
        return 'Digite um número válido.';
    }
    if (positivo && valor <= 0) {
        return 'Use um valor maior que zero.';
    }
    if (minimo !== null && valor < minimo) {
        return minimo === 0 ? 'O valor não pode ser negativo.' : `Use pelo menos ${formatarNumero(minimo, 2)}.`;
    }
    if (inteiro && !Number.isInteger(valor)) {
        return 'Use um número inteiro, sem casas decimais.';
    }
    if (maximo !== null && valor > maximo) {
        return `Use no máximo ${formatarNumero(maximo, 2)}.`;
    }
    return null;
}

export function validarData(valor, {
    rotulo = 'a data',
    obrigatoria = false,
    minima = null,
    mensagemMinima = '',
    maxima = null,
    mensagemMaxima = '',
} = {}) {
    if (!valor) {
        return obrigatoria ? `Informe ${rotulo}.` : null;
    }
    if (!ehDataISO(valor)) {
        return 'Informe uma data válida.';
    }
    // Datas ISO "AAAA-MM-DD" podem ser comparadas como texto.
    if (maxima && valor > maxima) {
        return mensagemMaxima;
    }
    if (minima && valor < minima) {
        return mensagemMinima;
    }
    return null;
}
