// Limites de alerta configuráveis (seção 8.3): o padrão geral, em
// config.limitesAlerta, e as exceções de cada tanque, em tanque.limitesAlerta.
// Fica fora de alertas.js porque grava dados, e aquele módulo é puro.

import { lerDados, salvarDados } from '../core/storage.js';
import { agoraISO } from '../core/utils.js';
import { LIMITES_PADRAO, resolverLimites } from './alertas.js';
import { falharRegra, lancarSeHouverErros, validarNumero } from './validacao.js';

// Meta de conversão alimentar (seção 8.3): fica em config.metaFca, e cada
// tanque pode ter a sua em tanque.limitesAlerta.metaFca.
export const META_FCA_PADRAO = 1.6;

// Os limites em porcentagem vão até 100; os dias sem registro, até um ano.
const REGRAS_LIMITES = {
    mortalidadeRegistroPct: { maximo: 100 },
    mortalidadeAcumuladaPct: { maximo: 100 },
    racaoDiariaPct: { maximo: 100 },
    capacidadePct: { maximo: 100 },
    pesoEsperadoPct: { maximo: 100 },
    diasSemRegistro: { maximo: 365, inteiro: true },
    metaFca: { maximo: 5 },
};

export function obterLimitesPadrao() {
    return resolverLimites(lerDados().config.limitesAlerta);
}

export function obterMetaFca(tanque = null) {
    return tanque?.limitesAlerta?.metaFca ?? lerDados().config.metaFca;
}

export function obterUltimoBackupEm() {
    return lerDados().config.ultimoBackupEm;
}

export function salvarLimitesPadrao(entrada) {
    // A meta de FCA é validada com os limites, mas fica guardada à parte.
    const { metaFca, ...limites } = validarLimites(entrada, { obrigatorios: true });
    const dados = lerDados();
    dados.config.limitesAlerta = limites;
    dados.config.metaFca = metaFca;
    salvarDados(dados);
    return limites;
}

export function restaurarLimitesPadrao() {
    const dados = lerDados();
    dados.config.limitesAlerta = { ...LIMITES_PADRAO };
    dados.config.metaFca = META_FCA_PADRAO;
    salvarDados(dados);
    return { ...LIMITES_PADRAO };
}

export function salvarLimitesTanque(tanqueId, entrada) {
    // Campo vazio significa "usar o padrão": o tanque guarda só o que sobrescreve.
    const limites = validarLimites(entrada, { obrigatorios: false });
    const dados = lerDados();
    const tanque = dados.tanques.find((item) => item.id === tanqueId);
    if (!tanque) {
        falharRegra('Tanque não encontrado.');
    }
    tanque.limitesAlerta = Object.keys(limites).length > 0 ? limites : null;
    tanque.atualizadoEm = agoraISO();
    salvarDados(dados);
    return tanque.limitesAlerta;
}

function validarLimites(entrada, { obrigatorios }) {
    const erros = {};
    const limites = {};
    for (const [campo, regra] of Object.entries(REGRAS_LIMITES)) {
        const valor = entrada[campo] ?? null;
        erros[campo] = validarNumero(valor, { rotulo: 'o limite', obrigatorio: obrigatorios, positivo: true, ...regra });
        if (valor !== null && !erros[campo]) {
            limites[campo] = valor;
        }
    }
    lancarSeHouverErros(erros);
    return limites;
}
