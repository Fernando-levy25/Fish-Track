// Calendário geral com os eventos de todos os tanques (seção 7.8).

import { hojeISO } from '../core/utils.js';
import { listarEventosCalendario } from '../domain/ciclos.js';
import { iniciarNavegacao, montarUrl } from '../ui/nav.js';
import { mostrarErroPagina } from '../ui/componentes.js';
import { iniciarCalendario } from '../ui/calendario.js';

const porId = (id) => document.getElementById(id);

iniciarNavegacao();
try {
    iniciarCalendario({
        grade: porId('calendario'),
        titulo: porId('titulo-mes'),
        botaoAnterior: porId('botao-mes-anterior'),
        botaoSeguinte: porId('botao-mes-seguinte'),
        botaoHoje: porId('botao-mes-atual'),
        lista: porId('lista-eventos-dia'),
        tituloLista: porId('titulo-eventos-dia'),
        hoje: hojeISO(),
        // Aqui vários tanques dividem o mesmo dia: o título do evento é o tanque.
        carregarEventos: (inicio, fim) => listarEventosCalendario({ inicio, fim }).map((evento) => ({
            data: evento.data,
            tipo: evento.tipo,
            titulo: evento.tanqueNome,
            descricao: `${evento.rotulo} · ${evento.descricao}`,
            href: montarUrl('tanque.html', { id: evento.tanqueId }),
        })),
    });
} catch (erro) {
    mostrarErroPagina(erro);
}
