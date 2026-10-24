// Biometria (seção 9.11): pesagem de uma amostra a cada ~15 dias, feita num
// painel próprio a partir do tanque. Continua gravada como registro (com
// pesoMedioG e biometria), para os indicadores não mudarem de fonte.

import { lerDados } from '../core/storage.js';
import { diasEntre, hojeISO } from '../core/utils.js';
import { obterTabela } from './arracoamento.js';
import { calcularIndicadores, calcularProximaBiometria, calcularRacaoSugerida, ordenarRegistros } from './indicadores.js';
import { salvarRegistro } from './registros.js';
import { listarSituacoes } from './tanques.js';
import { falharRegra } from './validacao.js';

// Queda do peso médio que merece conferência (aviso, não bloqueia).
export const QUEDA_PESO_AVISO_PCT = 10;
const CAMPOS_DE_ROTINA = ['racaoKg', 'racaoSobraKg', 'mortalidade', 'natalidade'];

function informado(valor) {
    return valor !== null && valor !== undefined;
}

// Registro só de biometria: tem peso e nada da rotina diária.
export function ehRegistroDeBiometria(registro) {
    return informado(registro.pesoMedioG) && CAMPOS_DE_ROTINA.every((campo) => !informado(registro[campo]));
}

// Pesagens do ciclo em ordem de data, começando pelo peso do povoamento.
export function listarBiometriasDoCiclo(cicloId, dados = lerDados()) {
    const ciclo = dados.ciclos.find((item) => item.id === cicloId);
    if (!ciclo) {
        return [];
    }
    const pesagens = ordenarRegistros(dados.registros.filter((registro) => registro.cicloId === cicloId && informado(registro.pesoMedioG)));
    return [
        { data: ciclo.dataInicio, pesoMedioG: ciclo.pesoMedioInicialG, inicial: true, registro: null },
        ...pesagens.map((registro) => ({ data: registro.data, pesoMedioG: registro.pesoMedioG, inicial: false, registro })),
    ];
}

// Cria ou edita uma biometria. Num registro que também tem ração ou mortos
// (feito antes da biometria ter painel próprio), troca só o peso e mantém o resto.
export function salvarBiometria(entrada) {
    const existente = entrada.id ? lerDados().registros.find((registro) => registro.id === entrada.id) : null;
    if (entrada.id && !existente) {
        falharRegra('Biometria não encontrada.');
    }
    const base = existente ?? { tanqueId: entrada.tanqueId };
    return salvarRegistro({
        ...base,
        data: entrada.data,
        pesoMedioG: entrada.biometria ? null : entrada.pesoMedioG ?? null,
        biometria: entrada.biometria ?? null,
        observacoes: entrada.observacoes ?? base.observacoes ?? '',
    });
}

// Tamanho da última amostra do tanque: o laboratório costuma repetir o número.
export function obterUltimaAmostra({ cicloAtivo, registros }) {
    if (!cicloAtivo) {
        return null;
    }
    return ordenarRegistros(registros).filter((registro) => registro.biometria).at(-1)?.biometria.peixesAmostra ?? null;
}

// Prévia ao vivo do painel (seção 7.13): o que muda com o peso médio digitado.
// Função pura: recebe a situação do tanque e o plano de alimentação.
export function calcularPreviaBiometria({ situacao, plano, data, pesoMedioG, idEditado = null, hoje = hojeISO() }) {
    const { tanque, cicloAtivo: ciclo } = situacao;
    const outros = situacao.registros.filter((registro) => registro.id !== idEditado);
    const anteriores = ordenarRegistros(outros).filter((registro) => informado(registro.pesoMedioG) && registro.data <= data);
    const anterior = anteriores.at(-1)
        ? { data: anteriores.at(-1).data, pesoMedioG: anteriores.at(-1).pesoMedioG }
        : { data: ciclo.dataInicio, pesoMedioG: ciclo.pesoMedioInicialG };
    const antes = calcularIndicadores({ tanque, ciclo, registros: outros, hoje });
    const racaoAntes = calcularRacaoSugerida({ indicadores: antes, tabela: plano, houvePesagem: anteriores.length > 0 });
    if (!(pesoMedioG > 0)) {
        return { anterior, biomassaAntesKg: antes.biomassaKg, racaoAntes: racaoAntes.sugestao, pesoMedioG: null };
    }
    const simulado = { id: '__previa__', data, criadoEm: '9999', pesoMedioG, racaoKg: null, mortalidade: null, natalidade: null };
    const depois = calcularIndicadores({ tanque, ciclo, registros: [...outros, simulado], hoje });
    const dias = Math.max(diasEntre(anterior.data, data), 0);
    const ganhoG = pesoMedioG - anterior.pesoMedioG;
    return {
        pesoMedioG,
        anterior,
        ganhoG,
        dias,
        ganhoDiarioG: dias > 0 ? ganhoG / dias : null,
        percentualAlvo: ciclo.pesoAlvoG ? (pesoMedioG / ciclo.pesoAlvoG) * 100 : null,
        pesoAlvoG: ciclo.pesoAlvoG ?? null,
        biomassaAntesKg: antes.biomassaKg,
        biomassaDepoisKg: depois.biomassaKg,
        racaoAntes: racaoAntes.sugestao,
        racaoDepois: calcularRacaoSugerida({ indicadores: depois, tabela: plano, houvePesagem: true }).sugestao,
        caiuMuito: ganhoG < 0 && (-ganhoG / anterior.pesoMedioG) * 100 > QUEDA_PESO_AVISO_PCT,
    };
}

// Rodada de biometria: o próximo tanque com ciclo ativo ainda não pesado na
// data, primeiro os mais atrasados e os previstos para hoje.
export function obterProximoTanqueBiometria({ tanqueIdAtual, data = hojeISO(), hoje = hojeISO() }) {
    const candidatos = listarSituacoes()
        .filter((situacao) => situacao.cicloAtivo && situacao.tanque.id !== tanqueIdAtual)
        .filter((situacao) => !situacao.registros.some((registro) => registro.data === data && informado(registro.pesoMedioG)))
        .map((situacao) => ({ situacao, proxima: calcularProximaBiometria({ tanque: situacao.tanque, ciclo: situacao.cicloAtivo, registros: situacao.registros, hoje }) }))
        .sort((a, b) => a.proxima.diasAteProxima - b.proxima.diasAteProxima);
    return candidatos[0]?.situacao.tanque ?? null;
}

export function obterPlanoDoTanque(tanque) {
    return obterTabela(tanque.tabelaArracoamentoId);
}
