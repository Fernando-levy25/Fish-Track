// Liga a agenda (ui/calendario.js) ao domínio. Usada pela página Agenda e pela
// aba Calendário do tanque, que só muda o filtro fixo (seção 7.4).

import { hojeISO } from '../core/utils.js';
import { listarEventosCalendario } from '../domain/ciclos.js';
import { alternarConclusao, listarAtrasados, obterLembrete, removerLembrete, removerOcorrencia, salvarLembrete } from '../domain/lembretes.js';
import { listarTanques } from '../domain/tanques.js';
import { criarAgenda } from '../ui/calendario.js';
import { obterCorTanque } from '../ui/graficos.js';
import { montarUrl } from '../ui/nav.js';
import { EVENTO_LEMBRETES, atualizarMenu } from './comum.js';

export function montarAgenda(raiz, { tanqueId = null, nivelTitulo = 2 } = {}) {
    const hoje = hojeISO();
    const todos = listarTanques({ incluirArquivados: true });
    // A cor segue a ordem de criação entre todos os tanques, como no dashboard.
    const cores = new Map(todos.map((tanque) => [tanque.id, obterCorTanque(tanque, todos)]));
    const tanques = todos
        .filter((tanque) => tanque.status !== 'arquivado')
        .map((tanque) => ({ id: tanque.id, nome: tanque.nome, cor: cores.get(tanque.id) }));
    const fixo = tanqueId ? tanques.find((tanque) => tanque.id === tanqueId) : null;

    // Toda mudança de lembrete também atualiza o menu lateral ("Lembretes de hoje").
    const alterar = (acao) => (...argumentos) => {
        const resultado = acao(...argumentos);
        atualizarMenu();
        return resultado;
    };

    const agenda = criarAgenda(raiz, {
        hoje,
        nivelTitulo,
        tanques,
        obterCor: (id) => cores.get(id),
        // Num tanque arquivado não há como criar lembrete para ele (RN17): o formulário começa em Geral.
        tanqueFixo: tanqueId ? (fixo?.id ?? null) : null,
        filtroFixo: Boolean(tanqueId),
        carregarEventos: (inicio, fim) => listarEventosCalendario({ inicio, fim, tanqueId }),
        carregarAtrasados: () => listarAtrasados({ hoje, tanqueId }),
        acoes: {
            obterLembrete,
            salvarLembrete: alterar(salvarLembrete),
            alternarConclusao: alterar(alternarConclusao),
            removerOcorrencia: alterar(removerOcorrencia),
            removerLembrete: alterar(removerLembrete),
        },
        hrefRegistro: (data) => montarUrl('registro.html', { tanqueId, data }),
        hrefEditarRegistro: (id) => montarUrl('registro.html', { id }),
        hrefTanque: (id) => montarUrl('tanque.html', { id }),
    });
    // Conclusões feitas no menu lateral aparecem na hora na agenda aberta.
    document.addEventListener(EVENTO_LEMBRETES, () => agenda.atualizar());
    return agenda;
}
