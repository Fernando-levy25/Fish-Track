// Alertas da seção 9.5. Funções puras: os alertas são recalculados sempre que
// os dados mudam e nunca ficam salvos.

import { diasEntre } from '../core/utils.js';
import {
    formatarData,
    formatarDataCurta,
    formatarGramas,
    formatarMassa,
    formatarPercentual,
    pluralizar,
} from '../core/format.js';
import { calcularIndicadores, calcularLinhaDoTempo, calcularProximaBiometria } from './indicadores.js';

// Unidades dos textos quando quem chama não informa (seção 8.1). As unidades vêm
// sempre por argumento, nunca da preferência guardada em core/format.js, para a
// mesma entrada gerar sempre o mesmo texto.
export const UNIDADES_PADRAO = Object.freeze({ biomassa: 'kg', racao: 'kg' });

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
export function analisarTanque({ tanque, cicloAtivo, registros }, { limitesPadrao, hoje, unidades = UNIDADES_PADRAO }) {
    if (!cicloAtivo) {
        return { indicadores: null, alertas: [] };
    }
    const indicadores = calcularIndicadores({ tanque, ciclo: cicloAtivo, registros, hoje });
    const limites = resolverLimites(limitesPadrao, tanque.limitesAlerta);
    return { indicadores, alertas: avaliarAlertas({ tanque, ciclo: cicloAtivo, registros, indicadores, limites, hoje, unidades }) };
}

export function avaliarAlertas({ tanque, ciclo, registros, indicadores, limites, hoje, unidades = UNIDADES_PADRAO }) {
    const alertas = [];
    const racao = (kg) => formatarMassa(kg, 'racao', unidades.racao);
    const biomassa = (kg) => formatarMassa(kg, 'biomassa', unidades.biomassa);
    // resumo: o motivo em uma linha, para o estado do tanque e as tarefas do dia;
    // a descrição completa fica na página de alertas e na do tanque (seção 11.6).
    const adicionar = (tipo, gravidade, titulo, descricao, data, resumo = titulo) => {
        alertas.push({
            id: `${tanque.id}:${tipo}`,
            tipo,
            gravidade,
            rotuloGravidade: ROTULOS_GRAVIDADE[gravidade],
            titulo,
            resumo,
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
                ultimoDia.data,
                `${pluralizar(ultimoDia.mortalidadeDia, 'peixe morto', 'peixes mortos')} ${descreverDia(ultimoDia.data, hoje)}`);
        }
    }

    const dataReferencia = indicadores.ultimoRegistro?.data ?? ciclo.dataInicio;

    if (indicadores.taxaMortalidade > limites.mortalidadeAcumuladaPct) {
        adicionar('mortalidade-acumulada', 'media', 'Mortalidade acumulada elevada',
            `${formatarPercentual(indicadores.taxaMortalidade)} dos peixes do ciclo `
            + `(limite de ${formatarPercentual(limites.mortalidadeAcumuladaPct)}).`,
            dataReferencia,
            `Mortalidade de ${formatarPercentual(indicadores.taxaMortalidade)} no ciclo`);
    }

    if (ultimoDia && ultimoDia.racaoDiaKg > 0 && ultimoDia.biomassaKg > 0) {
        const percentual = (ultimoDia.racaoDiaKg / ultimoDia.biomassaKg) * 100;
        if (percentual > limites.racaoDiariaPct) {
            adicionar('racao', 'media', 'Ração acima do limite',
                `${racao(ultimoDia.racaoDiaKg)} em ${formatarData(ultimoDia.data)}: `
                + `${formatarPercentual(percentual)} da biomassa (limite de ${formatarPercentual(limites.racaoDiariaPct)}).`,
                ultimoDia.data,
                `Ração de ${formatarPercentual(percentual)} do peso dos peixes`);
        }
    }

    // Sem densidade máxima definida, não há limite para comparar (seção 4.2).
    if (indicadores.capacidadeUtilizada !== null && indicadores.capacidadeUtilizada >= limites.capacidadePct) {
        adicionar('capacidade', 'media', 'Tanque próximo da capacidade',
            `${formatarPercentual(indicadores.capacidadeUtilizada)} da capacidade: `
            + `${biomassa(indicadores.biomassaKg)} de ${biomassa(indicadores.cargaMaximaKg)} `
            + `(limite de ${formatarPercentual(limites.capacidadePct)}).`,
            dataReferencia,
            `Capacidade em ${formatarPercentual(indicadores.capacidadeUtilizada)}`);
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
                indicadores.dataPesoAtual,
                'Peso abaixo do esperado');
        }
    }

    // Biometria atrasada (seção 9.11): passou do intervalo do tanque desde a última pesagem.
    const biometria = calcularProximaBiometria({ tanque, ciclo, registros, hoje });
    if (biometria.diasAtraso > 0) {
        const desde = biometria.houveBiometria
            ? `Última biometria em ${formatarData(biometria.dataUltima)}`
            : `Nenhuma biometria desde o povoamento (${formatarData(biometria.dataUltima)})`;
        adicionar('biometria-atrasada', 'baixa', 'Biometria atrasada',
            `${desde}, há ${pluralizar(diasEntre(biometria.dataUltima, hoje), 'dia', 'dias')} (a cada ${pluralizar(biometria.intervaloDias, 'dia', 'dias')}).`,
            biometria.dataProxima,
            `Biometria atrasada há ${pluralizar(biometria.diasAtraso, 'dia', 'dias')}`);
    }

    const diasSemRegistro = diasEntre(dataReferencia, hoje);
    if (diasSemRegistro > limites.diasSemRegistro) {
        const inicio = indicadores.ultimoRegistro
            ? `Último registro em ${formatarData(dataReferencia)}, há ${pluralizar(diasSemRegistro, 'dia', 'dias')}`
            : `Nenhum registro desde o povoamento, há ${pluralizar(diasSemRegistro, 'dia', 'dias')}`;
        adicionar('sem-registro', 'baixa', 'Tanque sem registro',
            `${inicio} (limite de ${pluralizar(limites.diasSemRegistro, 'dia', 'dias')}).`,
            dataReferencia,
            `Sem registro há ${pluralizar(diasSemRegistro, 'dia', 'dias')}`);
    }

    return ordenarAlertas(alertas);
}

// "hoje", "ontem" ou "em 17/10": como o produtor fala do dia.
function descreverDia(data, hoje) {
    const dias = diasEntre(data, hoje);
    return dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `em ${formatarDataCurta(data)}`;
}

// Alertas gerados pelos registros de cada dia, para a agenda (seção 7.1):
// mortalidade elevada e ração acima do limite, avaliados dia a dia, e não só
// no último dia como nos alertas ativos.
export function avaliarAlertasDosDias({ ciclo, registros, limites, unidades = UNIDADES_PADRAO }) {
    const alertas = [];
    const racao = (kg) => formatarMassa(kg, 'racao', unidades.racao);
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
                    descricao: `${racao(dia.racaoDiaKg)}: ${formatarPercentual(percentual)} da biomassa.` });
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
