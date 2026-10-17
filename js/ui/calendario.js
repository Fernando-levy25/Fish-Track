// Calendário mensal com a lista de eventos do dia escolhido (seções 7.3 e
// 7.8). Os eventos vêm da página por carregarEventos(inicio, fim), no formato
// { data, tipo, titulo, descricao, href? }; o tipo vira o modificador de cor.

import { diaDaSemana, diasNoMes, montarDataISO, partesData, somarDias } from '../core/utils.js';
import { formatarDataPorExtenso, formatarMesAno, pluralizar } from '../core/format.js';
import { criarElemento } from './componentes.js';

const DIAS_DA_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const TECLAS = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

export function iniciarCalendario({ grade, titulo, botaoAnterior, botaoSeguinte, botaoHoje, lista, tituloLista, hoje, carregarEventos }) {
    let { ano, mes } = partesData(hoje);
    let selecionado = hoje;
    let eventosPorData = new Map();

    function irParaMes(novoAno, novoMes) {
        ano = novoAno;
        mes = novoMes;
        const doHoje = partesData(hoje);
        // Ao trocar de mês, a seleção vai para hoje (se estiver nele) ou para o dia 1.
        selecionado = doHoje.ano === ano && doHoje.mes === mes ? hoje : montarDataISO(ano, mes, 1);
        renderizar();
    }

    function selecionar(data, { focar = false } = {}) {
        const partes = partesData(data);
        selecionado = data;
        ano = partes.ano;
        mes = partes.mes;
        renderizar({ focar });
    }

    function renderizar({ focar = false } = {}) {
        // A grade começa no domingo antes do dia 1 e termina no sábado depois do último dia.
        const primeiroDia = montarDataISO(ano, mes, 1);
        const ultimoDia = montarDataISO(ano, mes, diasNoMes(ano, mes));
        const inicio = somarDias(primeiroDia, -diaDaSemana(primeiroDia));
        const fim = somarDias(ultimoDia, 6 - diaDaSemana(ultimoDia));

        eventosPorData = new Map();
        for (const evento of carregarEventos(inicio, fim)) {
            if (!eventosPorData.has(evento.data)) {
                eventosPorData.set(evento.data, []);
            }
            eventosPorData.get(evento.data).push(evento);
        }

        titulo.textContent = formatarMesAno(ano, mes);
        const dias = [];
        for (let data = inicio; data <= fim; data = somarDias(data, 1)) {
            dias.push(criarDia(data));
        }
        grade.replaceChildren(
            criarElemento('div', { classe: 'calendario__semana', atributos: { 'aria-hidden': 'true' } },
                DIAS_DA_SEMANA.map((dia) => criarElemento('span', { texto: dia }))),
            criarElemento('div', { classe: 'calendario__grade' }, dias),
        );
        renderizarLista();
        if (focar) {
            grade.querySelector('[aria-pressed="true"]')?.focus();
        }
    }

    function criarDia(data) {
        const eventos = eventosPorData.get(data) ?? [];
        // Um marcador por tipo de evento, na ordem em que os eventos vêm.
        const tipos = [...new Set(eventos.map((evento) => evento.tipo))];
        const classes = ['calendario__dia'];
        if (partesData(data).mes !== mes) {
            classes.push('calendario__dia--fora-do-mes');
        }
        if (data === hoje) {
            classes.push('calendario__dia--hoje');
        }
        const descricaoEventos = eventos.length > 0 ? pluralizar(eventos.length, 'evento', 'eventos') : 'sem eventos';
        return criarElemento('button', {
            classe: classes.join(' '),
            atributos: {
                type: 'button',
                'data-data': data,
                'aria-pressed': String(data === selecionado),
                'aria-label': `${formatarDataPorExtenso(data)}, ${descricaoEventos}`,
                // Só o dia escolhido entra na ordem do Tab; as setas percorrem os outros.
                tabindex: data === selecionado ? '0' : '-1',
            },
        }, [
            criarElemento('span', { classe: 'calendario__numero', texto: String(partesData(data).dia) }),
            criarElemento('span', { classe: 'calendario__marcadores', atributos: { 'aria-hidden': 'true' } },
                tipos.map((tipo) => criarElemento('span', { classe: `calendario__marcador calendario__marcador--${tipo}` }))),
        ]);
    }

    function renderizarLista() {
        tituloLista.textContent = `Eventos de ${formatarDataPorExtenso(selecionado)}`;
        const eventos = eventosPorData.get(selecionado) ?? [];
        if (eventos.length === 0) {
            lista.replaceChildren(criarElemento('li', { classe: 'lista-eventos__vazio', texto: 'Nenhum evento neste dia.' }));
            return;
        }
        lista.replaceChildren(...eventos.map(({ tipo, titulo: tituloEvento, descricao, href }) => (
            criarElemento('li', { classe: `lista-eventos__item lista-eventos__item--${tipo}` }, [
                href
                    ? criarElemento('a', { classe: 'lista-eventos__tanque link', texto: tituloEvento, atributos: { href } })
                    : criarElemento('span', { classe: 'lista-eventos__tanque', texto: tituloEvento }),
                criarElemento('span', { classe: 'lista-eventos__tipo', texto: descricao }),
            ])
        )));
    }

    grade.addEventListener('click', (evento) => {
        const dia = evento.target.closest('[data-data]');
        if (dia) {
            selecionar(dia.dataset.data, { focar: true });
        }
    });
    grade.addEventListener('keydown', (evento) => {
        if (!(evento.key in TECLAS) || !evento.target.closest('[data-data]')) {
            return;
        }
        evento.preventDefault();
        selecionar(somarDias(selecionado, TECLAS[evento.key]), { focar: true });
    });
    botaoAnterior.addEventListener('click', () => irParaMes(mes === 1 ? ano - 1 : ano, mes === 1 ? 12 : mes - 1));
    botaoSeguinte.addEventListener('click', () => irParaMes(mes === 12 ? ano + 1 : ano, mes === 12 ? 1 : mes + 1));
    botaoHoje.addEventListener('click', () => selecionar(hoje));

    renderizar();
    return { atualizar: () => renderizar() };
}
