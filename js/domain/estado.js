// Estado de cada tanque em uma palavra (seção 9.12). Função pura: vem só dos
// alertas já calculados por alertas.js, sem critério novo, para que estado,
// tarefas do dia e página de alertas nunca se contradigam.

export const ESTADOS = Object.freeze({
    agir: { rotulo: 'Agir agora', icone: 'alerta' },
    atencao: { rotulo: 'Atenção', icone: 'relogio' },
    certo: { rotulo: 'Tudo certo', icone: 'check' },
    vazio: { rotulo: 'Vazio', icone: 'vazio' },
    manutencao: { rotulo: 'Em manutenção', icone: 'vazio' },
    arquivado: { rotulo: 'Arquivado', icone: 'vazio' },
});

// situacao: { tanque, cicloAtivo }; alertas: os do tanque, já ordenados por gravidade.
export function calcularEstadoTanque({ situacao, alertas }) {
    const { tanque, cicloAtivo } = situacao;
    if (!cicloAtivo) {
        const chave = tanque.status === 'manutencao' ? 'manutencao' : tanque.status === 'arquivado' ? 'arquivado' : 'vazio';
        const motivos = { vazio: 'Pronto para povoar', manutencao: 'Fora de uso por enquanto', arquivado: 'Fora de uso' };
        return { chave, ...ESTADOS[chave], motivo: motivos[chave] };
    }
    if (alertas.length === 0) {
        return { chave: 'certo', ...ESTADOS.certo, motivo: 'Tudo em dia' };
    }
    // Qualquer alerta, mesmo de gravidade baixa, tira o tanque de "Tudo certo".
    const chave = alertas.some((alerta) => alerta.gravidade === 'alta') ? 'agir' : 'atencao';
    const principal = alertas.find((alerta) => alerta.gravidade === 'alta') ?? alertas[0];
    const outros = alertas.length - 1;
    return {
        chave,
        ...ESTADOS[chave],
        motivo: principal.resumo + (outros > 0 ? ` (+${outros})` : ''),
    };
}
