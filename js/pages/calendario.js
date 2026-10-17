// Agenda geral, com os eventos e lembretes de todos os tanques (seção 7).

import { lerParametro } from '../ui/nav.js';
import { mostrarErroPagina } from '../ui/componentes.js';
import { montarAgenda } from './agenda.js';
import { iniciarPagina } from './comum.js';

iniciarPagina();
try {
    const agenda = montarAgenda(document.getElementById('agenda'));
    // "Adicionar lembrete" do menu lateral chega aqui com ?lembrete=novo.
    if (lerParametro('lembrete') === 'novo') {
        agenda.abrirFormularioNovo();
    }
} catch (erro) {
    mostrarErroPagina(erro);
}
