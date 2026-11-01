// Registros periódicos do ciclo (RN10 a RN15).

import { lerDados, salvarDados } from '../core/storage.js';
import { agoraISO, gerarId, hojeISO, limparTexto } from '../core/utils.js';
import {
    formatarData,
    formatarGramas,
    formatarInteiro,
    formatarRacao,
    pluralizar,
} from '../core/format.js';
import { calcularEstoquePorRegistro, encontrarMortalidadeAcimaDoEstoque, ordenarRegistros } from './indicadores.js';
import { ErroValidacao, falharRegra, lancarSeHouverErros, validarData, validarNumero, validarTexto } from './validacao.js';

const CAMPOS_MEDICAO = ['pesoMedioG', 'racaoKg', 'mortalidade', 'natalidade'];
export const CAUSAS_MORTALIDADE = Object.freeze({
    desconhecida: 'Desconhecida',
    manejo: 'Manejo',
    predacao: 'Predação',
    doenca: 'Doença',
    'qualidade-agua': 'Qualidade da água',
    outra: 'Outra',
});
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
    if (registro.biometria) {
        partes.push(`amostra de ${pluralizar(registro.biometria.peixesAmostra, 'peixe', 'peixes')}`);
    }
    if (informado(registro.racaoKg)) {
        partes.push(`Ração ${formatarRacao(registro.racaoKg)}${informado(registro.racaoSobraKg) ? ` (sobra ${formatarRacao(registro.racaoSobraKg)})` : ''}`);
    }
    if (informado(registro.mortalidade)) {
        const causa = registro.causaMortalidade ? ` (${CAUSAS_MORTALIDADE[registro.causaMortalidade].toLowerCase()})` : '';
        partes.push(`${pluralizar(registro.mortalidade, 'morto', 'mortos')}${causa}`);
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
    const registro = aplicarRegistro(dados, entrada);
    salvarDados(dados);
    return registro;
}

// Valida e coloca o registro em dados, sem gravar: a Folha do dia junta
// várias linhas e grava uma vez só.
function aplicarRegistro(dados, entrada) {
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

    // RN22: biometria por amostra. O peso médio sai do peso da amostra dividido
    // pelos peixes pesados (Embrapa, manejos na criação de tilápia, Queiroz, 2019).
    // RN26: com os pesos de cada peixe, a amostra sai deles (quantidade e soma).
    const pesosIndividuaisG = Array.isArray(entrada.biometria?.pesosIndividuaisG) ? entrada.biometria.pesosIndividuaisG : null;
    const erroPesosIndividuais = pesosIndividuaisG === null ? null
        : pesosIndividuaisG.length < 2 ? 'Informe o peso de pelo menos 2 peixes, um por linha.'
            : pesosIndividuaisG.some((peso) => !Number.isFinite(peso) || peso <= 0)
                ? `Confira o ${pesosIndividuaisG.findIndex((peso) => !Number.isFinite(peso) || peso <= 0) + 1}º peso: use um número maior que zero.`
                : null;
    const amostra = pesosIndividuaisG && !erroPesosIndividuais
        ? { ...entrada.biometria, peixesAmostra: pesosIndividuaisG.length, pesoAmostraG: pesosIndividuaisG.reduce((total, peso) => total + peso, 0) }
        : entrada.biometria ?? null;
    const temAmostra = Boolean(amostra) && !erroPesosIndividuais
        && [amostra.peixesAmostra, amostra.pesoAmostraG, amostra.comprimentoMedioCm].some(informado);
    const errosAmostra = erroPesosIndividuais ? { pesosIndividuaisG: erroPesosIndividuais } : temAmostra ? {
        peixesAmostra: validarNumero(amostra.peixesAmostra ?? null, { rotulo: 'os peixes na amostra', obrigatorio: true, positivo: true, inteiro: true }),
        pesoAmostraG: validarNumero(amostra.pesoAmostraG ?? null, { rotulo: 'o peso da amostra', obrigatorio: true, positivo: true }),
        comprimentoMedioCm: validarNumero(amostra.comprimentoMedioCm ?? null, { positivo: true }),
    } : {};
    const amostraValida = temAmostra && !Object.values(errosAmostra).some(Boolean);
    const biometria = amostraValida
        ? {
            peixesAmostra: amostra.peixesAmostra,
            pesoAmostraG: amostra.pesoAmostraG,
            comprimentoMedioCm: amostra.comprimentoMedioCm ?? null,
            pesosIndividuaisG: pesosIndividuaisG ? [...pesosIndividuaisG] : null,
        }
        : null;

    const registro = {
        id: existente?.id ?? gerarId(),
        cicloId: ciclo.id,
        tanqueId,
        data: entrada.data,
        pesoMedioG: biometria ? biometria.pesoAmostraG / biometria.peixesAmostra : entrada.pesoMedioG ?? null,
        biometria,
        racaoKg: entrada.racaoKg ?? null,
        racaoSobraKg: entrada.racaoSobraKg ?? null,
        causaMortalidade: entrada.causaMortalidade || null,
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
        ...errosAmostra,
        // RN23: a sobra é parte da ração fornecida.
        racaoSobraKg: validarNumero(registro.racaoSobraKg, { minimo: 0 })
            ?? (informado(registro.racaoSobraKg) && !informado(registro.racaoKg) ? 'Informe a ração fornecida para registrar a sobra.' : null)
            ?? (informado(registro.racaoSobraKg) && registro.racaoSobraKg > registro.racaoKg ? 'A sobra não pode ser maior que a ração fornecida.' : null),
        causaMortalidade: registro.causaMortalidade && !(registro.causaMortalidade in CAUSAS_MORTALIDADE)
            ? 'Escolha uma das causas da lista.'
            : registro.causaMortalidade && !(registro.mortalidade > 0) ? 'Informe os mortos encontrados para registrar a causa.' : null,
    });
    // RN11
    if (!CAMPOS_MEDICAO.some((campo) => informado(registro[campo])) && registro.observacoes === '') {
        falharRegra('Preencha pelo menos uma medição ou observação.');
    }
    const outros = dados.registros.filter((item) => item.cicloId === ciclo.id && item.id !== registro.id);
    validarEstoque(ciclo, [...outros, registro], { idAlterado: registro.id, acao: 'alteração' });
    // RN22: não se pesam mais peixes do que os que estão (estimados) no tanque.
    if (biometria) {
        const { quantidadeAntes } = calcularEstoquePorRegistro(ciclo, [...outros, registro]).find((item) => item.registro.id === registro.id);
        if (biometria.peixesAmostra > quantidadeAntes) {
            throw new ErroValidacao({ peixesAmostra: `A amostra não pode passar da quantidade estimada no tanque (${formatarInteiro(quantidadeAntes)}).` });
        }
    }

    if (existente) {
        Object.assign(existente, registro);
    } else {
        dados.registros.push(registro);
    }
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

// ---------- Folha do dia (seção 7.15) ----------

// Rotina do dia anotada: ração, sobra ou mortos. Uma biometria sozinha não conta.
export function temRotinaNaData(registros, tanqueId, data) {
    return registros.some((registro) => registro.tanqueId === tanqueId && registro.data === data
        && ['racaoKg', 'racaoSobraKg', 'mortalidade'].some((campo) => informado(registro[campo])));
}

// Grava a rotina de vários tanques numa operação só, com as mesmas regras do
// registro individual (RN10 a RN15, RN23). Tudo ou nada: se uma linha falhar,
// nenhuma fica gravada, e o erro vem com a linha ("linhas.2.racaoKg").
export function salvarFolhaDoDia({ data, linhas }) {
    if (linhas.length === 0) {
        falharRegra('Marque os tanques que você anotou.');
    }
    // Tudo ou nada: as linhas são montadas numa cópia e gravadas numa única vez.
    const dados = lerDados();
    const salvos = [];
    for (const [indice, linha] of linhas.entries()) {
        try {
            salvos.push(aplicarRegistro(dados, {
                tanqueId: linha.tanqueId,
                data,
                racaoKg: linha.racaoKg ?? null,
                racaoSobraKg: linha.racaoSobraKg ?? null,
                mortalidade: linha.mortalidade ?? null,
                causaMortalidade: linha.causaMortalidade ?? null,
                observacoes: linha.observacoes ?? '',
            }));
        } catch (erro) {
            const porCampo = Object.entries(erro.erros ?? {}).map(([campo, mensagem]) => [`linhas.${indice}.${campo}`, mensagem]);
            throw new ErroValidacao(
                porCampo.length > 0 ? Object.fromEntries(porCampo) : { [`linhas.${indice}`]: erro.message },
                erro.message,
            );
        }
    }
    salvarDados(dados);
    return salvos;
}
