// Tarefas do dia da tela "Hoje" (seção 7.1). Função pura: junta alertas,
// ração a dar, biometrias previstas e lembretes numa lista por urgência.
// Todo alerta ativo vira tarefa; quando duas origens dizem a mesma coisa,
// fica uma tarefa só.

import { formatarRacao, pluralizar } from '../core/format.js';

// Ordem da lista: menor número, mais urgente.
const URGENCIA = Object.freeze({
    alertaAlta: 0,
    alertaMedia: 1,
    alimentar: 2,
    lembreteAtrasado: 3,
    alertaBaixa: 4,
    biometria: 5,
    lembrete: 6,
});
const URGENCIA_DO_ALERTA = { alta: URGENCIA.alertaAlta, media: URGENCIA.alertaMedia, baixa: URGENCIA.alertaBaixa };

// itens: [{ tanque, alertas, racaoSugeridaKg (ou null), anotadoHoje, proxima }] dos tanques com ciclo ativo.
// lembretes: ocorrências de hoje e atrasadas ({ lembreteId, data, titulo, tanqueNome, concluida, atrasado }).
export function gerarTarefasDoDia({ itens, lembretes = [] }) {
    const pendentes = [];
    const feitas = [];

    for (const { tanque, alertas } of itens) {
        for (const alerta of alertas) {
            pendentes.push({
                id: alerta.id,
                tipo: 'alerta',
                urgencia: URGENCIA_DO_ALERTA[alerta.gravidade],
                gravidade: alerta.gravidade,
                titulo: `${tanque.nome} · ${alerta.resumo}`,
                tanqueId: tanque.id,
                acao: { tipo: 'alerta', alerta },
            });
        }
    }

    // "Tanque sem registro" já pede para anotar: esse tanque não entra de novo em "Alimentar".
    const semRegistro = (item) => item.alertas.some((alerta) => alerta.tipo === 'sem-registro');
    const paraAlimentar = itens.filter((item) => item.racaoSugeridaKg !== null && !item.anotadoHoje && !semRegistro(item));
    if (paraAlimentar.length > 0) {
        const totalKg = paraAlimentar.reduce((total, item) => total + item.racaoSugeridaKg, 0);
        pendentes.push({
            id: 'alimentar',
            tipo: 'alimentar',
            urgencia: URGENCIA.alimentar,
            titulo: paraAlimentar.length === 1
                ? `Alimentar o ${paraAlimentar[0].tanque.nome} · ${formatarRacao(totalKg)}`
                : `Alimentar ${pluralizar(paraAlimentar.length, 'tanque', 'tanques')} · ${formatarRacao(totalKg)} no total`,
            acao: { tipo: 'anotar-dia' },
        });
    }
    const anotados = itens.filter((item) => item.anotadoHoje);
    if (anotados.length > 0) {
        feitas.push({ id: 'anotados', tipo: 'alimentar', titulo: `Dia anotado: ${anotados.map((item) => item.tanque.nome).join(', ')}` });
    }

    // Biometria prevista para hoje (atrasada já é um alerta, que vira tarefa acima).
    for (const { tanque, proxima } of itens) {
        if (proxima && proxima.diasAteProxima === 0) {
            pendentes.push({
                id: `biometria:${tanque.id}`,
                tipo: 'biometria',
                urgencia: URGENCIA.biometria,
                titulo: `Biometria do ${tanque.nome} · prevista para hoje`,
                tanqueId: tanque.id,
                acao: { tipo: 'biometria', tanqueId: tanque.id },
            });
        }
    }

    for (const lembrete of lembretes) {
        const tarefa = {
            id: `lembrete:${lembrete.lembreteId}:${lembrete.data}`,
            tipo: 'lembrete',
            urgencia: lembrete.atrasado ? URGENCIA.lembreteAtrasado : URGENCIA.lembrete,
            titulo: [lembrete.titulo, lembrete.tanqueNome].filter(Boolean).join(' · '),
            atrasado: Boolean(lembrete.atrasado),
            acao: { tipo: 'concluir', lembrete },
        };
        (lembrete.concluida ? feitas : pendentes).push(tarefa);
    }

    return { pendentes: pendentes.sort((a, b) => a.urgencia - b.urgencia), feitas };
}

// Próximo acontecimento, para a lista vazia: "Próxima biometria: Tanque 02, em 3 dias".
export function encontrarProximoEvento(itens) {
    const futuras = itens.filter((item) => item.proxima && item.proxima.diasAteProxima > 0)
        .sort((a, b) => a.proxima.diasAteProxima - b.proxima.diasAteProxima);
    const primeira = futuras[0];
    return primeira
        ? `Próxima biometria: ${primeira.tanque.nome}, em ${pluralizar(primeira.proxima.diasAteProxima, 'dia', 'dias')}`
        : null;
}
