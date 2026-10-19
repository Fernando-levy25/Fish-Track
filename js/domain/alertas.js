// Alertas da seção 9.5. Funções puras: os alertas são recalculados sempre que
// os dados mudam e nunca ficam salvos.

import { diasEntre } from '../core/utils.js';
import { formatarData, formatarGramas, formatarKg, formatarPercentual, pluralizar } from '../core/format.js';
import { calcularIndicadores, calcularLinhaDoTempo } from './indicadores.js';

export const LIMITES_PADRAO = Object.freeze({
    mortalidadeRegistroPct: 1,
    mortalidadeAcumuladaPct: 10,
    racaoDiariaPct: 5,
    capacidadePct: 90,
    pesoEsperadoPct: 85,
    diasSemRegistro: 7,
});

export const ROTULOS_GRAVIDADE = Object.freeze({ alta: 'Alta', media: 'Média', baixa: 'Baixa' });
const ORDEM_GRAVIDADE = Object.keys(ROTULOS_GRAVIDADE);

// Cada camada (configuração geral, tanque) sobrescreve só as chaves que define (seção 8.3).
export function resolverLimites(...camadas) {
    const limites = { ...LIMITES_PADRAO };
    for (const camada of camadas) {
        for (const [chave, valor] of Object.entries(camada ?? {})) {
            if (chave in LIMITES_PADRAO && Number.isFinite(valor)) {
                limites[chave] = valor;
            }
        }
    }
    return limites;
}

// Indicadores e alertas do ciclo ativo de uma situação (veja tanques.js).
export function analisarTanque({ tanque, cicloAtivo, registros }, { limitesPadrao, hoje }) {
    if (!cicloAtivo) {
        return { indicadores: null, alertas: [] };
    }
    const indicadores = calcularIndicadores({ tanque, ciclo: cicloAtivo, registros, hoje });
    const limites = resolverLimites(limitesPadrao, tanque.limitesAlerta);
    return { indicadores, alertas: avaliarAlertas({ tanque, ciclo: cicloAtivo, registros, indicadores, limites, hoje }) };
}

export function avaliarAlertas({ tanque, ciclo, registros, indicadores, limites, hoje }) {
    const alertas = [];
    const adicionar = (tipo, gravidade, titulo, descricao, data) => {
        alertas.push({
            id: `${tanque.id}:${tipo}`,
            tipo,
            gravidade,
            rotuloGravidade: ROTULOS_GRAVIDADE[gravidade],
            titulo,
            descricao,
            data,
            tanqueId: tanque.id,
            tanqueNome: tanque.nome,
        });
    };

    // Os alertas "do registro" olham o último dia com registro, que é a situação
    // atual do tanque. Os registros da mesma data são somados (RN15).
    const ultimoDia = registros.length > 0 ? calcularLinhaDoTempo(ciclo, registros).at(-1) : null;

    if (ultimoDia && ultimoDia.mortalidadeDia > 0 && ultimoDia.quantidadeInicioDia > 0) {
        const percentual = (ultimoDia.mortalidadeDia / ultimoDia.quantidadeInicioDia) * 100;
        if (percentual > limites.mortalidadeRegistroPct) {
            adicionar('mortalidade-registro', 'alta', 'Mortalidade elevada no registro',
                `${pluralizar(ultimoDia.mortalidadeDia, 'peixe morto', 'peixes mortos')} em ${formatarData(ultimoDia.data)}: `
                + `${formatarPercentual(percentual)} do estoque estimado (limite de ${formatarPercentual(limites.mortalidadeRegistroPct)}).`,
                ultimoDia.data);
        }
    }

    const dataReferencia = indicadores.ultimoRegistro?.data ?? ciclo.dataInicio;

    if (indicadores.taxaMortalidade > limites.mortalidadeAcumuladaPct) {
        adicionar('mortalidade-acumulada', 'media', 'Mortalidade acumulada elevada',
            `${formatarPercentual(indicadores.taxaMortalidade)} dos peixes do ciclo `
            + `(limite de ${formatarPercentual(limites.mortalidadeAcumuladaPct)}).`,
            dataReferencia);
    }

    if (ultimoDia && ultimoDia.racaoDiaKg > 0 && ultimoDia.biomassaKg > 0) {
        const percentual = (ultimoDia.racaoDiaKg / ultimoDia.biomassaKg) * 100;
        if (percentual > limites.racaoDiariaPct) {
            adicionar('racao', 'media', 'Ração acima do limite',
                `${formatarKg(ultimoDia.racaoDiaKg)} em ${formatarData(ultimoDia.data)}: `
                + `${formatarPercentual(percentual)} da biomassa (limite de ${formatarPercentual(limites.racaoDiariaPct)}).`,
                ultimoDia.data);
        }
    }

    // Sem densidade máxima definida, não há limite para comparar (seção 4.2).
    if (indicadores.capacidadeUtilizada !== null && indicadores.capacidadeUtilizada >= limites.capacidadePct) {
        adicionar('capacidade', 'media', 'Tanque próximo da capacidade',
            `${formatarPercentual(indicadores.capacidadeUtilizada)} da capacidade: `
            + `${formatarKg(indicadores.biomassaKg)} de ${formatarKg(indicadores.cargaMaximaKg)} `
            + `(limite de ${formatarPercentual(limites.capacidadePct)}).`,
            dataReferencia);
    }

    // Compara na data da última pesagem, e não hoje: dias sem pesar não podem
    // fazer o peso parecer atrasado. Sem pesagem após o povoamento, não há o que comparar.
    const esperado = calcularPesoEsperado(ciclo, indicadores.dataPesoAtual);
    if (esperado !== null && indicadores.dataPesoAtual > ciclo.dataInicio) {
        const percentual = (indicadores.pesoMedioG / esperado) * 100;
        if (percentual < limites.pesoEsperadoPct) {
            adicionar('peso', 'baixa', 'Peso médio abaixo do esperado',
                `${formatarGramas(indicadores.pesoMedioG)} em ${formatarData(indicadores.dataPesoAtual)}, `
                + `quando o esperado era ${formatarGramas(esperado)}: ${formatarPercentual(percentual)} do esperado `
                + `(mínimo de ${formatarPercentual(limites.pesoEsperadoPct)}).`,
                indicadores.dataPesoAtual);
        }
    }

    const diasSemRegistro = diasEntre(dataReferencia, hoje);
    if (diasSemRegistro > limites.diasSemRegistro) {
        const inicio = indicadores.ultimoRegistro
            ? `Último registro em ${formatarData(dataReferencia)}, há ${pluralizar(diasSemRegistro, 'dia', 'dias')}`
            : `Nenhum registro desde o povoamento, há ${pluralizar(diasSemRegistro, 'dia', 'dias')}`;
        adicionar('sem-registro', 'baixa', 'Tanque sem registro',
            `${inicio} (limite de ${pluralizar(limites.diasSemRegistro, 'dia', 'dias')}).`,
            dataReferencia);
    }

    return ordenarAlertas(alertas);
}

// Alertas gerados pelos registros de cada dia, para a agenda (seção 7.1):
// mortalidade elevada e ração acima do limite, avaliados dia a dia, e não só
// no último dia como nos alertas ativos.
export function avaliarAlertasDosDias({ ciclo, registros, limites }) {
    const alertas = [];
    for (const dia of calcularLinhaDoTempo(ciclo, registros).slice(1)) {
        if (dia.mortalidadeDia > 0 && dia.quantidadeInicioDia > 0) {
            const percentual = (dia.mortalidadeDia / dia.quantidadeInicioDia) * 100;
            if (percentual > limites.mortalidadeRegistroPct) {
                alertas.push({ data: dia.data, tipo: 'mortalidade-registro', gravidade: 'alta', titulo: 'Mortalidade alta',
                    descricao: `${pluralizar(dia.mortalidadeDia, 'peixe morto', 'peixes mortos')}: ${formatarPercentual(percentual)} do estoque estimado.` });
            }
        }
        if (dia.racaoDiaKg > 0 && dia.biomassaKg > 0) {
            const percentual = (dia.racaoDiaKg / dia.biomassaKg) * 100;
            if (percentual > limites.racaoDiariaPct) {
                alertas.push({ data: dia.data, tipo: 'racao', gravidade: 'media', titulo: 'Ração acima do limite',
                    descricao: `${formatarKg(dia.racaoDiaKg)}: ${formatarPercentual(percentual)} da biomassa.` });
            }
        }
    }
    return alertas;
}

// Interpolação linear entre o peso inicial, no povoamento, e o peso alvo, na
// despesca prevista (seção 9.5). Depois da data prevista, o esperado é o alvo.
export function calcularPesoEsperado(ciclo, data) {
    if (!ciclo.pesoAlvoG || !ciclo.dataPrevistaDespesca) {
        return null;
    }
    const total = diasEntre(ciclo.dataInicio, ciclo.dataPrevistaDespesca);
    const decorridos = Math.min(Math.max(diasEntre(ciclo.dataInicio, data), 0), total);
    return ciclo.pesoMedioInicialG + (ciclo.pesoAlvoG - ciclo.pesoMedioInicialG) * (decorridos / total);
}

// Mais graves primeiro; na mesma gravidade, os mais recentes.
export function ordenarAlertas(alertas) {
    return [...alertas].sort((a, b) => ORDEM_GRAVIDADE.indexOf(a.gravidade) - ORDEM_GRAVIDADE.indexOf(b.gravidade)
        || b.data.localeCompare(a.data)
        || a.tanqueNome.localeCompare(b.tanqueNome, 'pt-BR'));
}

export function gravidadeMaisAlta(alertas) {
    return ORDEM_GRAVIDADE.find((gravidade) => alertas.some((alerta) => alerta.gravidade === gravidade)) ?? null;
}
