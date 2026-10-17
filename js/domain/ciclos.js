// Ciclos de cultivo, do povoamento à despesca (RN05 a RN09), e os eventos que
// eles e os registros geram no calendário (seção 9.6).

import { lerDados, salvarDados } from '../core/storage.js';
import { agoraISO, compararTexto, gerarId, hojeISO, somarDias } from '../core/utils.js';
import { formatarData, formatarGramas, pluralizar } from '../core/format.js';
import { ordenarRegistros } from './indicadores.js';
import { resumirRegistro } from './registros.js';
import { falharRegra, lancarSeHouverErros, validarData, validarNumero } from './validacao.js';

export const ROTULOS_EVENTO = Object.freeze({
    povoamento: 'Povoamento',
    registro: 'Registro',
    'despesca-prevista': 'Despesca prevista',
    'despesca-realizada': 'Despesca realizada',
});
const ORDEM_EVENTOS = Object.keys(ROTULOS_EVENTO);

export function obterCiclo(id) {
    return lerDados().ciclos.find((ciclo) => ciclo.id === id) ?? null;
}

// Motivo pelo qual o tanque não pode iniciar um ciclo agora, ou null se pode.
export function verificarInicioCiclo(tanqueId) {
    const dados = lerDados();
    return motivoParaNaoIniciar(dados, dados.tanques.find((tanque) => tanque.id === tanqueId));
}

function motivoParaNaoIniciar(dados, tanque) {
    if (!tanque) {
        return 'Tanque não encontrado.';
    }
    // RN05 e RN06: um ciclo ativo por vez, e só em tanque vazio.
    if (dados.ciclos.some((ciclo) => ciclo.tanqueId === tanque.id && ciclo.status === 'ativo')) {
        return 'Este tanque já tem um ciclo ativo. Registre a despesca antes de iniciar outro.';
    }
    if (tanque.status === 'manutencao') {
        return 'O tanque está em manutenção. Retire-o da manutenção, em Editar, antes de iniciar um ciclo.';
    }
    if (tanque.status === 'arquivado') {
        return 'O tanque está arquivado. Desarquive-o antes de iniciar um ciclo.';
    }
    return null;
}

export function iniciarCiclo(tanqueId, entrada) {
    const dados = lerDados();
    const tanque = dados.tanques.find((item) => item.id === tanqueId);
    const motivo = motivoParaNaoIniciar(dados, tanque);
    if (motivo) {
        falharRegra(motivo);
    }

    const { dataInicio, quantidadeInicial, pesoMedioInicialG } = entrada;
    const pesoAlvoG = entrada.pesoAlvoG ?? null;
    const dataPrevistaDespesca = entrada.dataPrevistaDespesca || null;
    // Um ciclo novo não pode se sobrepor ao anterior do mesmo tanque.
    const ultimaDespesca = dados.ciclos
        .filter((ciclo) => ciclo.tanqueId === tanqueId && ciclo.dataDespesca)
        .map((ciclo) => ciclo.dataDespesca)
        .sort()
        .at(-1) ?? null;

    const erroDataInicio = validarData(dataInicio, {
        rotulo: 'a data do povoamento',
        obrigatoria: true,
        maxima: hojeISO(),
        mensagemMaxima: 'A data do povoamento não pode ser futura.',
        minima: ultimaDespesca,
        mensagemMinima: `O povoamento não pode ser anterior à última despesca deste tanque (${formatarData(ultimaDespesca)}).`,
    });
    // RN07
    const erroPesoInicial = validarNumero(pesoMedioInicialG, { rotulo: 'o peso médio inicial', obrigatorio: true, positivo: true });
    lancarSeHouverErros({
        dataInicio: erroDataInicio,
        quantidadeInicial: validarNumero(quantidadeInicial, { rotulo: 'a quantidade inicial', obrigatorio: true, positivo: true, inteiro: true }),
        pesoMedioInicialG: erroPesoInicial,
        pesoAlvoG: validarNumero(pesoAlvoG, { positivo: true })
            ?? (pesoAlvoG !== null && !erroPesoInicial && pesoAlvoG <= pesoMedioInicialG
                ? 'O peso alvo deve ser maior que o peso inicial.'
                : null),
        dataPrevistaDespesca: validarData(dataPrevistaDespesca, {
            minima: erroDataInicio ? null : somarDias(dataInicio, 1),
            mensagemMinima: 'A despesca prevista deve ser depois do povoamento.',
        }),
    });

    const ciclo = {
        id: gerarId(),
        tanqueId,
        dataInicio,
        quantidadeInicial,
        pesoMedioInicialG,
        pesoAlvoG,
        dataPrevistaDespesca,
        dataDespesca: null,
        quantidadeDespescada: null,
        pesoMedioFinalG: null,
        status: 'ativo',
    };
    dados.ciclos.push(ciclo);
    // RN03
    tanque.status = 'ativo';
    tanque.atualizadoEm = agoraISO();
    salvarDados(dados);
    return ciclo;
}

export function registrarDespesca(tanqueId, entrada) {
    const dados = lerDados();
    const tanque = dados.tanques.find((item) => item.id === tanqueId);
    if (!tanque) {
        falharRegra('Tanque não encontrado.');
    }
    const ciclo = dados.ciclos.find((item) => item.tanqueId === tanqueId && item.status === 'ativo');
    if (!ciclo) {
        falharRegra('Este tanque não tem ciclo ativo.');
    }

    // RN09: a despesca não pode vir antes do povoamento nem do último registro.
    const ultimoRegistro = ordenarRegistros(dados.registros.filter((registro) => registro.cicloId === ciclo.id)).at(-1);
    const depoisDoUltimoRegistro = ultimoRegistro && ultimoRegistro.data > ciclo.dataInicio;
    const minima = depoisDoUltimoRegistro ? ultimoRegistro.data : ciclo.dataInicio;
    lancarSeHouverErros({
        dataDespesca: validarData(entrada.dataDespesca, {
            rotulo: 'a data da despesca',
            obrigatoria: true,
            maxima: hojeISO(),
            mensagemMaxima: 'A data da despesca não pode ser futura.',
            minima,
            mensagemMinima: depoisDoUltimoRegistro
                ? `A despesca não pode ser anterior ao último registro (${formatarData(minima)}).`
                : `A despesca não pode ser anterior ao povoamento (${formatarData(minima)}).`,
        }),
        quantidadeDespescada: validarNumero(entrada.quantidadeDespescada, { rotulo: 'a quantidade despescada', obrigatorio: true, minimo: 0, inteiro: true }),
        pesoMedioFinalG: validarNumero(entrada.pesoMedioFinalG, { rotulo: 'o peso médio final', obrigatorio: true, positivo: true }),
    });

    Object.assign(ciclo, {
        dataDespesca: entrada.dataDespesca,
        quantidadeDespescada: entrada.quantidadeDespescada,
        pesoMedioFinalG: entrada.pesoMedioFinalG,
        status: 'encerrado',
    });
    // RN08
    tanque.status = 'vazio';
    tanque.atualizadoEm = agoraISO();
    salvarDados(dados);
    return ciclo;
}

// Eventos entre duas datas (inclusive), de um tanque ou de todos os não arquivados.
export function listarEventosCalendario({ inicio, fim, tanqueId = null }) {
    const dados = lerDados();
    const tanques = new Map(dados.tanques
        .filter((tanque) => (tanqueId ? tanque.id === tanqueId : tanque.status !== 'arquivado'))
        .map((tanque) => [tanque.id, tanque]));
    const noPeriodo = (data) => Boolean(data) && data >= inicio && data <= fim;
    const eventos = [];
    const adicionar = (data, tipo, tanque, descricao) => {
        eventos.push({ data, tipo, rotulo: ROTULOS_EVENTO[tipo], tanqueId: tanque.id, tanqueNome: tanque.nome, descricao });
    };

    for (const ciclo of dados.ciclos) {
        const tanque = tanques.get(ciclo.tanqueId);
        if (!tanque) {
            continue;
        }
        if (noPeriodo(ciclo.dataInicio)) {
            adicionar(ciclo.dataInicio, 'povoamento', tanque,
                `${pluralizar(ciclo.quantidadeInicial, 'peixe', 'peixes')} com ${formatarGramas(ciclo.pesoMedioInicialG)}`);
        }
        // A previsão só interessa enquanto o ciclo está em andamento.
        if (ciclo.status === 'ativo' && noPeriodo(ciclo.dataPrevistaDespesca)) {
            adicionar(ciclo.dataPrevistaDespesca, 'despesca-prevista', tanque,
                ciclo.pesoAlvoG ? `Peso alvo de ${formatarGramas(ciclo.pesoAlvoG)}` : 'Data prevista no povoamento');
        }
        if (ciclo.status === 'encerrado' && noPeriodo(ciclo.dataDespesca)) {
            adicionar(ciclo.dataDespesca, 'despesca-realizada', tanque,
                `${pluralizar(ciclo.quantidadeDespescada, 'peixe', 'peixes')} com ${formatarGramas(ciclo.pesoMedioFinalG)}`);
        }
    }
    for (const registro of ordenarRegistros(dados.registros)) {
        const tanque = tanques.get(registro.tanqueId);
        if (tanque && noPeriodo(registro.data)) {
            adicionar(registro.data, 'registro', tanque, resumirRegistro(registro));
        }
    }
    return eventos.sort((a, b) => a.data.localeCompare(b.data)
        || ORDEM_EVENTOS.indexOf(a.tipo) - ORDEM_EVENTOS.indexOf(b.tipo)
        || compararTexto(a.tanqueNome, b.tanqueNome));
}
