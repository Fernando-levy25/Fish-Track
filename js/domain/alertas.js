// Alertas da seção 9.5. Funções puras: os alertas são recalculados sempre que
// os dados mudam e nunca ficam salvos.

import { diasEntre, somarDias } from '../core/utils.js';
import {
    formatarData,
    formatarDataCurta,
    formatarMassa,
    formatarPercentual,
    pluralizar,
} from '../core/format.js';
import { calcularIndicadores, calcularLinhaDoTempo, calcularProximaBiometria, calcularRacaoSugerida } from './indicadores.js';

// Janela do alerta de mortalidade, em dias contados até hoje (a mesma da
// "Mortalidade da semana"). Valor provisório (seção 13).
export const JANELA_ALERTA_MORTALIDADE_DIAS = 7;
// Quanto a ração consumida pode passar da sugestão do plano antes do alerta.
// Valor provisório (seção 13).
export const TOLERANCIA_RACAO_PLANO_PCT = 20;

// Unidades dos textos quando quem chama não informa (seção 8.1). As unidades vêm
// sempre por argumento, nunca da preferência guardada em core/format.js, para a
// mesma entrada gerar sempre o mesmo texto.
export const UNIDADES_PADRAO = Object.freeze({ biomassa: 'kg', racao: 'kg' });

// pesoEsperadoPct saiu com o alerta de peso esperado (seção 9.5). Nos dados de
// quem já o tinha, a chave fica gravada e é ignorada: o formato não muda.
export const LIMITES_PADRAO = Object.freeze({
    mortalidadeRegistroPct: 1,
    mortalidadeAcumuladaPct: 10,
    racaoDiariaPct: 5,
    capacidadePct: 90,
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
// plano: o plano de alimentação do tanque, que a situação já traz (tanques.js).
export function analisarTanque({ tanque, cicloAtivo, registros, plano = null }, { limitesPadrao, hoje, unidades = UNIDADES_PADRAO }) {
    if (!cicloAtivo) {
        return { indicadores: null, alertas: [] };
    }
    const indicadores = calcularIndicadores({ tanque, ciclo: cicloAtivo, registros, hoje });
    const limites = resolverLimites(limitesPadrao, tanque.limitesAlerta);
    return { indicadores, alertas: avaliarAlertas({ tanque, ciclo: cicloAtivo, registros, indicadores, limites, hoje, plano, unidades }) };
}

export function avaliarAlertas({ tanque, ciclo, registros, indicadores, limites, hoje, plano = null, unidades = UNIDADES_PADRAO }) {
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

    // Os registros da mesma data são somados (RN15). O primeiro dia é o do
    // povoamento, que só traz valores se houver registro nele.
    const dias = calcularLinhaDoTempo(ciclo, registros);
    const ultimoDia = registros.length > 0 ? dias.at(-1) : null;

    // Mortalidade: cada dia com registro na janela, e não só o último. Um pico
    // não pode sumir porque alguém anotou o dia seguinte ou um dia atrasado.
    const inicioJanela = somarDias(hoje, -(JANELA_ALERTA_MORTALIDADE_DIAS - 1));
    const diasAcima = dias
        .filter((item) => item.data >= inicioJanela && item.data <= hoje)
        .map((item) => ({ ...item, percentual: calcularMortalidadeDiaPct(item) }))
        .filter((item) => item.percentual > limites.mortalidadeRegistroPct);
    if (diasAcima.length > 0) {
        const pior = diasAcima.reduce((maior, item) => (item.percentual > maior.percentual ? item : maior));
        const outros = diasAcima.length - 1;
        const mortos = pluralizar(pior.mortalidadeDia, 'peixe morto', 'peixes mortos');
        adicionar('mortalidade-registro', 'alta', 'Mortalidade elevada no registro',
            `${mortos} em ${formatarData(pior.data)}: `
            + `${formatarPercentual(pior.percentual)} do estoque estimado (limite de ${formatarPercentual(limites.mortalidadeRegistroPct)}).`
            + (outros > 0 ? ` Mais ${pluralizar(outros, 'dia', 'dias')} acima do limite nesta semana.` : ''),
            pior.data,
            `${mortos} ${descreverDia(pior.data, hoje)}`);
    }

    const dataReferencia = indicadores.ultimoRegistro?.data ?? ciclo.dataInicio;

    if (indicadores.taxaMortalidade > limites.mortalidadeAcumuladaPct) {
        adicionar('mortalidade-acumulada', 'media', 'Mortalidade acumulada elevada',
            `${formatarPercentual(indicadores.taxaMortalidade)} dos peixes do ciclo `
            + `(limite de ${formatarPercentual(limites.mortalidadeAcumuladaPct)}).`,
            dataReferencia,
            `Mortalidade de ${formatarPercentual(indicadores.taxaMortalidade)} no ciclo`);
    }

    // Ração: o último dia com registro, que é a situação atual do tanque.
    const excesso = ultimoDia ? avaliarRacaoDoDia({ dia: ultimoDia, plano, limites }) : null;
    if (excesso) {
        adicionar('racao', 'media', 'Ração acima do limite',
            descreverExcessoRacao(excesso, { racao, data: formatarData(ultimoDia.data) }),
            ultimoDia.data,
            excesso.limite.tipo === 'plano'
                ? `Ração ${formatarPercentual(excesso.acimaPct)} acima do plano`
                : `Ração de ${formatarPercentual(excesso.percentualBiomassa)} do peso dos peixes`);
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

    // "Peso médio abaixo do esperado" não é mais gerado (seção 9.5): o esperado
    // era uma linha reta do peso inicial ao alvo, que não representa o
    // crescimento de nenhuma espécie (lento no começo), e disparava em quase todo
    // começo de ciclo. Volta só com uma curva de crescimento com fonte (seção 13).

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

// Mortos do dia ÷ animais estimados no início do dia × 100 (seção 9.5).
function calcularMortalidadeDiaPct(dia) {
    return dia.mortalidadeDia > 0 && dia.quantidadeInicioDia > 0 ? (dia.mortalidadeDia / dia.quantidadeInicioDia) * 100 : 0;
}

// Limite de ração de um dia (seção 9.5). Com um plano de alimentação que cobre o
// peso do dia, o limite é a sugestão do plano mais a tolerância: comparar com o
// limite geral contradiria o próprio plano (um plano de 6% disparava o alerta de
// 5%). Sem plano, ou com o peso fora das faixas, vale o limite geral em % da biomassa.
// indicadores: { biomassaKg, pesoMedioG, houvePesagem } do dia.
export function calcularLimiteRacaoDia({ plano, indicadores, limites }) {
    const { sugestao } = calcularRacaoSugerida({ indicadores, tabela: plano, houvePesagem: indicadores.houvePesagem });
    if (sugestao) {
        return {
            tipo: 'plano',
            sugestaoKg: sugestao.racaoDiaKg,
            toleranciaPct: TOLERANCIA_RACAO_PLANO_PCT,
            limiteKg: sugestao.racaoDiaKg * (1 + TOLERANCIA_RACAO_PLANO_PCT / 100),
        };
    }
    return { tipo: 'biomassa', limitePct: limites.racaoDiariaPct, limiteKg: (indicadores.biomassaKg * limites.racaoDiariaPct) / 100 };
}

// Ração do dia acima do limite: o excesso, ou null. Compara a ração consumida
// (fornecida − sobra), como o alerta sempre fez e como a FCA conta (seção 9.4).
function avaliarRacaoDoDia({ dia, plano, limites }) {
    const racaoKg = dia.racaoDiaKg;
    if (!(racaoKg > 0) || !(dia.biomassaKg > 0)) {
        return null;
    }
    const limite = calcularLimiteRacaoDia({ plano, indicadores: dia, limites });
    const percentualBiomassa = (racaoKg / dia.biomassaKg) * 100;
    const acima = limite.tipo === 'plano' ? racaoKg > limite.limiteKg : percentualBiomassa > limite.limitePct;
    if (!acima) {
        return null;
    }
    return {
        racaoKg,
        limite,
        percentualBiomassa,
        acimaPct: limite.tipo === 'plano' ? ((racaoKg - limite.sugestaoKg) / limite.sugestaoKg) * 100 : null,
    };
}

function descreverExcessoRacao({ racaoKg, limite, percentualBiomassa, acimaPct }, { racao, data }) {
    if (limite.tipo === 'plano') {
        return `Ração de ${racao(racaoKg)} em ${data}, ${formatarPercentual(acimaPct)} acima do plano `
            + `(${racao(limite.sugestaoKg)}; tolerância de ${formatarPercentual(limite.toleranciaPct)}).`;
    }
    return `${racao(racaoKg)} em ${data}: ${formatarPercentual(percentualBiomassa)} da biomassa `
        + `(limite de ${formatarPercentual(limite.limitePct)}).`;
}

// Alertas gerados pelos registros de cada dia, para a agenda (seção 7.1):
// mortalidade elevada e ração acima do limite, avaliados dia a dia, com as
// mesmas regras dos alertas ativos.
export function avaliarAlertasDosDias({ ciclo, registros, limites, plano = null, unidades = UNIDADES_PADRAO }) {
    const alertas = [];
    const racao = (kg) => formatarMassa(kg, 'racao', unidades.racao);
    for (const dia of calcularLinhaDoTempo(ciclo, registros)) {
        const percentual = calcularMortalidadeDiaPct(dia);
        if (percentual > limites.mortalidadeRegistroPct) {
            alertas.push({ data: dia.data, tipo: 'mortalidade-registro', gravidade: 'alta', titulo: 'Mortalidade alta',
                descricao: `${pluralizar(dia.mortalidadeDia, 'peixe morto', 'peixes mortos')}: ${formatarPercentual(percentual)} do estoque estimado.` });
        }
        const excesso = avaliarRacaoDoDia({ dia, plano, limites });
        if (excesso) {
            alertas.push({ data: dia.data, tipo: 'racao', gravidade: 'media', titulo: 'Ração acima do limite',
                descricao: excesso.limite.tipo === 'plano'
                    ? `${racao(excesso.racaoKg)}: ${formatarPercentual(excesso.acimaPct)} acima do plano (${racao(excesso.limite.sugestaoKg)}).`
                    : `${racao(excesso.racaoKg)}: ${formatarPercentual(excesso.percentualBiomassa)} da biomassa.` });
        }
    }
    return alertas;
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
