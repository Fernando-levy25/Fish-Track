// Relacionamentos de um conjunto de dados (seção 8.5), conferidos antes de
// restaurar um backup. Função pura: não corrige nada, só aponta. Erros impedem a
// restauração; avisos são mostrados antes de confirmar.

import { ehDataISO } from '../core/utils.js';
import { formatarData } from '../core/format.js';

export const MAXIMO_PROBLEMAS_LISTADOS = 10;

const ehPositivo = (valor) => Number.isFinite(valor) && valor > 0;
const ehNaoNegativoOuVazio = (valor) => valor === null || valor === undefined || (Number.isFinite(valor) && valor >= 0);
const descreverData = (data) => (ehDataISO(data) ? `de ${formatarData(data)}` : 'sem data válida');

// dados: já no formato atual (validarEstrutura). Devolve { erros, avisos } em texto simples.
export function verificarIntegridade(dados, hoje = null) {
    const erros = [];
    const avisos = [];

    for (const colecao of ['tanques', 'ciclos', 'registros', 'lembretes']) {
        const vistos = new Set();
        for (const item of dados[colecao]) {
            if (vistos.has(item.id)) {
                erros.push(`Há dois itens em ${colecao} com o mesmo identificador.`);
            }
            vistos.add(item.id);
        }
    }

    const tanques = new Map(dados.tanques.map((tanque) => [tanque.id, tanque]));
    const ciclos = new Map(dados.ciclos.map((ciclo) => [ciclo.id, ciclo]));

    for (const tanque of dados.tanques) {
        if (typeof tanque.nome !== 'string' || !tanque.nome.trim()) {
            erros.push('Um tanque está sem nome.');
        }
        if (!ehPositivo(tanque.volumeM3)) {
            erros.push(`O tanque "${tanque.nome ?? 'sem nome'}" não tem um volume válido.`);
        }
    }

    const ativosPorTanque = new Map();
    for (const ciclo of dados.ciclos) {
        const tanque = tanques.get(ciclo.tanqueId);
        if (!tanque) {
            erros.push(`O ciclo ${descreverData(ciclo.dataInicio)} aponta para um tanque que não existe no arquivo.`);
        }
        if (!ehDataISO(ciclo.dataInicio)) {
            erros.push(`Um ciclo${tanque ? ` do "${tanque.nome}"` : ''} está sem data de povoamento válida.`);
        }
        if (!ehPositivo(ciclo.quantidadeInicial)) {
            erros.push(`O ciclo ${descreverData(ciclo.dataInicio)}${tanque ? ` do "${tanque.nome}"` : ''} não tem uma quantidade inicial válida.`);
        }
        if (ciclo.status === 'ativo') {
            ativosPorTanque.set(ciclo.tanqueId, (ativosPorTanque.get(ciclo.tanqueId) ?? 0) + 1);
        }
    }
    // RN05: um ciclo ativo por tanque.
    for (const [tanqueId, quantidade] of ativosPorTanque) {
        if (quantidade > 1) {
            erros.push(`O tanque "${tanques.get(tanqueId)?.nome ?? 'sem nome'}" tem ${quantidade} ciclos ativos ao mesmo tempo.`);
        }
    }

    for (const registro of dados.registros) {
        const ciclo = ciclos.get(registro.cicloId);
        if (!tanques.has(registro.tanqueId)) {
            erros.push(`O registro ${descreverData(registro.data)} aponta para um tanque que não existe no arquivo.`);
        } else if (!ciclo) {
            erros.push(`O registro ${descreverData(registro.data)} aponta para um ciclo que não existe no arquivo.`);
        } else if (ciclo.tanqueId !== registro.tanqueId) {
            erros.push(`O registro ${descreverData(registro.data)} aponta para um ciclo de outro tanque.`);
        }
        if (!ehDataISO(registro.data)) {
            erros.push('Um registro está sem data válida.');
        }
        const numeros = ['pesoMedioG', 'racaoKg', 'racaoSobraKg', 'mortalidade', 'natalidade'];
        if (!numeros.every((campo) => ehNaoNegativoOuVazio(registro[campo]))) {
            erros.push(`O registro ${descreverData(registro.data)} tem um número inválido.`);
        }
    }

    for (const lembrete of dados.lembretes) {
        if (!lembrete.tanqueId) {
            continue;
        }
        const tanque = tanques.get(lembrete.tanqueId);
        if (!tanque) {
            avisos.push(`O lembrete "${lembrete.titulo ?? 'sem título'}" aponta para um tanque que não existe no arquivo e vai aparecer como Geral.`);
        } else if (tanque.status === 'arquivado' && hoje && (lembrete.repetirDias || lembrete.data >= hoje)) {
            avisos.push(`O tanque arquivado "${tanque.nome}" tem o lembrete futuro "${lembrete.titulo ?? 'sem título'}".`);
        }
    }

    return { erros, avisos };
}

// "no máximo 10 de cada, com 'e mais N'".
export function resumirProblemas(lista) {
    const mostrados = lista.slice(0, MAXIMO_PROBLEMAS_LISTADOS);
    const restantes = lista.length - mostrados.length;
    return restantes > 0 ? [...mostrados, `e mais ${restantes}`] : mostrados;
}
