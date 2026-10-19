// Ciclos de cultivo, do povoamento à despesca (RN05 a RN09), e os eventos que
// eles e os registros geram no calendário (seção 9.6).

import { lerDados, salvarDados } from '../core/storage.js';
import { agoraISO, compararTexto, gerarId, hojeISO, somarDias } from '../core/utils.js';
import { formatarData, formatarGramas, formatarKg, pluralizar } from '../core/format.js';
import { calcularResultadoCiclo, ordenarRegistros } from './indicadores.js';
import { avaliarAlertasDosDias, resolverLimites } from './alertas.js';
import { listarOcorrencias } from './lembretes.js';
import { resumirRegistro } from './registros.js';
import { falharRegra, lancarSeHouverErros, validarData, validarNumero } from './validacao.js';

export const ROTULOS_EVENTO = Object.freeze({
    alerta: 'Alerta',
    povoamento: 'Povoamento',
    'despesca-prevista': 'Despesca prevista',
    'despesca-realizada': 'Despesca realizada',
    lembrete: 'Lembrete',
    registro: 'Registro',
});
const ORDEM_EVENTOS = Object.keys(ROTULOS_EVENTO);
// RN20: diferença aceita entre quantidade × peso médio e a biomassa pesada.
const LIMITE_DIFERENCA_DESPESCA = 0.2;

export function obterCiclo(id) {
    return lerDados().ciclos.find((ciclo) => ciclo.id === id) ?? null;
}

// Resultados reais dos ciclos encerrados do tanque, do mais recente ao mais
// antigo, cada um com o resultado do ciclo anterior para comparação.
export function listarResultadosCiclos(tanqueId) {
    const dados = lerDados();
    const tanque = dados.tanques.find((item) => item.id === tanqueId);
    if (!tanque) {
        return [];
    }
    const encerrados = dados.ciclos
        .filter((ciclo) => ciclo.tanqueId === tanqueId && ciclo.status === 'encerrado')
        .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))
        .map((ciclo) => ({
            ciclo,
            resultado: calcularResultadoCiclo({ tanque, ciclo, registros: dados.registros.filter((registro) => registro.cicloId === ciclo.id) }),
        }));
    return encerrados.map((item, indice) => ({ ...item, anterior: encerrados[indice - 1]?.resultado ?? null })).reverse();
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
        biomassaFinalKg: null,
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
        // RN19: a despesca fecha o ciclo pelo que foi pesado; a contagem é opcional.
        biomassaFinalKg: validarNumero(entrada.biomassaFinalKg, { rotulo: 'a biomassa final', obrigatorio: true, positivo: true }),
        pesoMedioFinalG: validarNumero(entrada.pesoMedioFinalG, { rotulo: 'o peso médio final', obrigatorio: true, positivo: true }),
        quantidadeDespescada: validarNumero(entrada.quantidadeDespescada ?? null, { minimo: 0, inteiro: true }),
    });
    // RN20: com a quantidade informada, quantidade × peso médio precisa bater com a biomassa (até 20% de diferença).
    const quantidadeDespescada = entrada.quantidadeDespescada ?? null;
    if (quantidadeDespescada !== null) {
        const biomassaCalculadaKg = (quantidadeDespescada * entrada.pesoMedioFinalG) / 1000;
        if (Math.abs(biomassaCalculadaKg - entrada.biomassaFinalKg) / entrada.biomassaFinalKg > LIMITE_DIFERENCA_DESPESCA) {
            lancarSeHouverErros({ quantidadeDespescada: 'Os valores não batem: confira a biomassa, o peso médio ou a quantidade.' });
        }
    }

    Object.assign(ciclo, {
        dataDespesca: entrada.dataDespesca,
        quantidadeDespescada,
        pesoMedioFinalG: entrada.pesoMedioFinalG,
        biomassaFinalKg: entrada.biomassaFinalKg,
        status: 'encerrado',
    });
    // RN08
    tanque.status = 'vazio';
    tanque.atualizadoEm = agoraISO();
    salvarDados(dados);
    return ciclo;
}

// Eventos entre duas datas (inclusive), de um tanque ou de todos os não
// arquivados. A ordem é a das etiquetas na agenda (seção 7.1): alertas,
// ciclo, lembretes e registros.
export function listarEventosCalendario({ inicio, fim, tanqueId = null }) {
    const dados = lerDados();
    const hoje = hojeISO();
    const tanques = new Map(dados.tanques
        .filter((tanque) => (tanqueId ? tanque.id === tanqueId : tanque.status !== 'arquivado'))
        .map((tanque) => [tanque.id, tanque]));
    const noPeriodo = (data) => Boolean(data) && data >= inicio && data <= fim;
    const eventos = [];
    const adicionar = (data, tipo, tanque, descricao, extra = {}) => {
        eventos.push({ data, tipo, rotulo: ROTULOS_EVENTO[tipo], tanqueId: tanque?.id ?? null, tanqueNome: tanque?.nome ?? null, descricao, ...extra });
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
                `${formatarKg(ciclo.biomassaFinalKg)} com peso médio de ${formatarGramas(ciclo.pesoMedioFinalG)}`);
        }
    }
    const ciclosAtivos = new Set(dados.ciclos.filter((ciclo) => ciclo.status === 'ativo').map((ciclo) => ciclo.id));
    for (const registro of ordenarRegistros(dados.registros)) {
        const tanque = tanques.get(registro.tanqueId);
        if (tanque && noPeriodo(registro.data)) {
            adicionar(registro.data, 'registro', tanque, resumirRegistro(registro), {
                registroId: registro.id,
                editavel: ciclosAtivos.has(registro.cicloId),
            });
        }
    }
    for (const ciclo of dados.ciclos) {
        const tanque = tanques.get(ciclo.tanqueId);
        if (!tanque) {
            continue;
        }
        const limites = resolverLimites(dados.config.limitesAlerta, tanque.limitesAlerta);
        const registros = dados.registros.filter((registro) => registro.cicloId === ciclo.id);
        for (const alerta of avaliarAlertasDosDias({ ciclo, registros, limites })) {
            if (noPeriodo(alerta.data)) {
                adicionar(alerta.data, 'alerta', tanque, alerta.descricao, { titulo: alerta.titulo, gravidade: alerta.gravidade });
            }
        }
    }
    for (const ocorrencia of listarOcorrencias({ inicio, fim, tanqueId, dados, hoje })) {
        // Lembretes de tanques fora do filtro (ou arquivados no calendário geral) ficam de fora; os gerais sempre entram.
        if (ocorrencia.tanqueId && !tanques.has(ocorrencia.tanqueId) && ocorrencia.data >= hoje) {
            continue;
        }
        const tanque = ocorrencia.tanqueId ? (tanques.get(ocorrencia.tanqueId) ?? { id: ocorrencia.tanqueId, nome: ocorrencia.tanqueNome }) : null;
        adicionar(ocorrencia.data, 'lembrete', tanque, ocorrencia.observacao, {
            titulo: ocorrencia.titulo,
            lembreteId: ocorrencia.lembreteId,
            concluida: ocorrencia.concluida,
            repetirDias: ocorrencia.repetirDias,
        });
    }
    return eventos.sort((a, b) => a.data.localeCompare(b.data)
        || ORDEM_EVENTOS.indexOf(a.tipo) - ORDEM_EVENTOS.indexOf(b.tipo)
        || compararTexto(a.tanqueNome ?? '', b.tanqueNome ?? ''));
}
