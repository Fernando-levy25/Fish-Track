// Registros periódicos do ciclo (RN10 a RN15).

import { lerDados, salvarDados } from '../core/storage.js';
import { agoraISO, gerarId, hojeISO, limparTexto } from '../core/utils.js';
import { formatarData, formatarGramas, formatarInteiro, formatarKg, pluralizar } from '../core/format.js';
import { encontrarMortalidadeAcimaDoEstoque, ordenarRegistros } from './indicadores.js';
import { ErroValidacao, falharRegra, lancarSeHouverErros, validarData, validarNumero, validarTexto } from './validacao.js';

const CAMPOS_MEDICAO = ['pesoMedioG', 'racaoKg', 'mortalidade', 'natalidade'];
const TAMANHO_MAXIMO_OBSERVACOES = 500;

function informado(valor) {
    return valor !== null && valor !== undefined;
}

export function obterRegistro(id) {
    return lerDados().registros.find((registro) => registro.id === id) ?? null;
}

export function listarRegistrosDoCiclo(cicloId) {
    return ordenarRegistros(lerDados().registros.filter((registro) => registro.cicloId === cicloId));
}

// Uma linha legível com o que foi medido ou observado no registro.
export function resumirRegistro(registro) {
    const partes = [];
    if (informado(registro.pesoMedioG)) {
        partes.push(`Peso ${formatarGramas(registro.pesoMedioG)}`);
    }
    if (informado(registro.racaoKg)) {
        partes.push(`Ração ${formatarKg(registro.racaoKg)}`);
    }
    if (informado(registro.mortalidade)) {
        partes.push(pluralizar(registro.mortalidade, 'morto', 'mortos'));
    }
    if (informado(registro.natalidade)) {
        partes.push(pluralizar(registro.natalidade, 'nascimento', 'nascimentos'));
    }
    if (registro.observacoes) {
        partes.push(registro.observacoes);
    }
    return partes.join(' · ');
}

export function salvarRegistro(entrada) {
    const dados = lerDados();
    const existente = entrada.id ? dados.registros.find((registro) => registro.id === entrada.id) : null;
    if (entrada.id && !existente) {
        falharRegra('Registro não encontrado.');
    }

    // Na edição, o registro continua no mesmo tanque e no mesmo ciclo.
    const tanqueId = existente ? existente.tanqueId : entrada.tanqueId;
    if (!dados.tanques.some((tanque) => tanque.id === tanqueId)) {
        throw new ErroValidacao({ tanqueId: 'Selecione um tanque.' });
    }
    const ciclo = existente
        ? dados.ciclos.find((item) => item.id === existente.cicloId)
        : dados.ciclos.find((item) => item.tanqueId === tanqueId && item.status === 'ativo');
    // RN10: só há registro em ciclo ativo; os de ciclos encerrados ficam para consulta.
    if (!ciclo || ciclo.status !== 'ativo') {
        falharRegra(existente
            ? 'Este registro pertence a um ciclo encerrado e não pode ser alterado.'
            : 'Este tanque não tem ciclo ativo. Inicie um ciclo antes de fazer registros.');
    }

    const registro = {
        id: existente?.id ?? gerarId(),
        cicloId: ciclo.id,
        tanqueId,
        data: entrada.data,
        pesoMedioG: entrada.pesoMedioG ?? null,
        racaoKg: entrada.racaoKg ?? null,
        mortalidade: entrada.mortalidade ?? null,
        natalidade: entrada.natalidade ?? null,
        observacoes: limparTexto(entrada.observacoes),
        criadoEm: existente?.criadoEm ?? agoraISO(),
    };

    lancarSeHouverErros({
        // RN12
        data: validarData(registro.data, {
            rotulo: 'a data',
            obrigatoria: true,
            maxima: hojeISO(),
            mensagemMaxima: 'A data não pode ser futura.',
            minima: ciclo.dataInicio,
            mensagemMinima: `A data não pode ser anterior ao início do ciclo (${formatarData(ciclo.dataInicio)}).`,
        }),
        // RN13: nada negativo. Peso médio zero não existe, então ele precisa ser positivo.
        pesoMedioG: validarNumero(registro.pesoMedioG, { positivo: true }),
        racaoKg: validarNumero(registro.racaoKg, { minimo: 0 }),
        mortalidade: validarNumero(registro.mortalidade, { minimo: 0, inteiro: true }),
        natalidade: validarNumero(registro.natalidade, { minimo: 0, inteiro: true }),
        observacoes: validarTexto(registro.observacoes, { maximo: TAMANHO_MAXIMO_OBSERVACOES }),
    });
    // RN11
    if (!CAMPOS_MEDICAO.some((campo) => informado(registro[campo])) && registro.observacoes === '') {
        falharRegra('Preencha pelo menos uma medição ou observação.');
    }
    const outros = dados.registros.filter((item) => item.cicloId === ciclo.id && item.id !== registro.id);
    validarEstoque(ciclo, [...outros, registro], { idAlterado: registro.id, acao: 'alteração' });

    if (existente) {
        Object.assign(existente, registro);
    } else {
        dados.registros.push(registro);
    }
    salvarDados(dados);
    return registro;
}

export function excluirRegistro(id) {
    const dados = lerDados();
    const registro = dados.registros.find((item) => item.id === id);
    if (!registro) {
        falharRegra('Registro não encontrado.');
    }
    const ciclo = dados.ciclos.find((item) => item.id === registro.cicloId);
    if (!ciclo || ciclo.status !== 'ativo') {
        falharRegra('Este registro pertence a um ciclo encerrado e não pode ser excluído.');
    }
    const restantes = dados.registros.filter((item) => item.cicloId === ciclo.id && item.id !== id);
    validarEstoque(ciclo, restantes, { idAlterado: null, acao: 'exclusão' });
    dados.registros = dados.registros.filter((item) => item.id !== id);
    salvarDados(dados);
}

// RN14 é conferida em todos os registros do ciclo: incluir, alterar ou excluir
// um registro muda a quantidade estimada de todos os que vêm depois dele.
function validarEstoque(ciclo, registros, { idAlterado, acao }) {
    const conflito = encontrarMortalidadeAcimaDoEstoque(ciclo, registros);
    if (!conflito) {
        return;
    }
    const { registro, quantidadeAntes } = conflito;
    if (registro.id === idAlterado) {
        throw new ErroValidacao({
            mortalidade: `Os mortos encontrados não podem passar da quantidade estimada de peixes nessa data (${formatarInteiro(quantidadeAntes)}).`,
        });
    }
    falharRegra(`Com essa ${acao}, os mortos encontrados em ${formatarData(registro.data)} passariam da quantidade `
        + `estimada de peixes naquela data (${formatarInteiro(quantidadeAntes)}). Revise os registros desse período.`);
}
