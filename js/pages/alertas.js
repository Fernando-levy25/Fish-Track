// Alertas ativos agrupados por tanque e ordenados por gravidade (seção 7.7).

import { compararTexto, hojeISO } from '../core/utils.js';
import { pluralizar } from '../core/format.js';
import { listarSituacoes } from '../domain/tanques.js';
import { analisarTanque, gravidadeMaisAlta, ROTULOS_GRAVIDADE } from '../domain/alertas.js';
import { obterLimitesPadrao } from '../domain/configuracoes.js';
import { iniciarNavegacao, montarUrl } from '../ui/nav.js';
import { criarElemento, mostrarErroPagina, renderizarAlertas } from '../ui/componentes.js';

const ORDEM_GRAVIDADE = Object.keys(ROTULOS_GRAVIDADE);

iniciarNavegacao();
try {
    renderizar();
} catch (erro) {
    mostrarErroPagina(erro);
}

function renderizar() {
    const hoje = hojeISO();
    const limitesPadrao = obterLimitesPadrao();
    // Os tanques com o alerta mais grave vêm primeiro.
    const grupos = listarSituacoes()
        .filter((situacao) => situacao.cicloAtivo)
        .map((situacao) => ({ tanque: situacao.tanque, alertas: analisarTanque(situacao, { limitesPadrao, hoje }).alertas }))
        .filter((grupo) => grupo.alertas.length > 0)
        .sort((a, b) => ORDEM_GRAVIDADE.indexOf(gravidadeMaisAlta(a.alertas)) - ORDEM_GRAVIDADE.indexOf(gravidadeMaisAlta(b.alertas))
            || compararTexto(a.tanque.nome, b.tanque.nome));

    const container = document.getElementById('grupos-alertas');
    if (grupos.length === 0) {
        container.replaceChildren(criarElemento('p', { classe: 'grupos-alertas__vazio', texto: 'Nenhum alerta no momento.' }));
        return;
    }
    container.replaceChildren(...grupos.map(criarGrupo));
}

function criarGrupo({ tanque, alertas }) {
    const idTitulo = `grupo-alertas-${tanque.id}`;
    const lista = criarElemento('ul', { classe: 'lista-alertas' });
    renderizarAlertas(lista, alertas);
    return criarElemento('section', { classe: 'grupo-alertas', atributos: { 'aria-labelledby': idTitulo } }, [
        criarElemento('h2', { classe: 'grupo-alertas__titulo', atributos: { id: idTitulo } }, [
            criarElemento('a', { classe: 'link', texto: tanque.nome, atributos: { href: montarUrl('tanque.html', { id: tanque.id }) } }),
        ]),
        criarElemento('p', { classe: 'grupo-alertas__especie', texto: `${tanque.especie} · ${pluralizar(alertas.length, 'alerta', 'alertas')}` }),
        lista,
    ]);
}
