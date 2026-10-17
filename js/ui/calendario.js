// Agenda (seção 7): grade do mês com etiquetas resumidas em cada dia, filtros,
// quadro do dia e formulário de lembrete. Montada inteira aqui, porque aparece
// em duas páginas (Agenda e aba Calendário do tanque). Não lê nem grava dados:
// recebe da página os eventos e as ações por funções (seção 10).

import { diaDaSemana, montarDataISO, paraNumero, partesData, somarDias } from '../core/utils.js';
import { formatarDataCompleta, formatarDataPorExtenso, formatarMesAno, pluralizar } from '../core/format.js';
import { criarElemento, criarSelo, iniciarFormulario, limparErrosFormulario, preencherFormulario } from './componentes.js';
import { criarIcone } from './icones.js';

const DIAS_DA_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const TECLAS = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
const MAXIMO_ETIQUETAS = 3;
const TIPOS_FILTRO = [
    { grupo: 'registros', texto: 'Registros' },
    { grupo: 'lembretes', texto: 'Lembretes' },
    { grupo: 'ciclo', texto: 'Ciclo' },
    { grupo: 'alertas', texto: 'Alertas' },
];
const GRUPO_DO_TIPO = {
    registro: 'registros',
    lembrete: 'lembretes',
    povoamento: 'ciclo',
    'despesca-prevista': 'ciclo',
    'despesca-realizada': 'ciclo',
    alerta: 'alertas',
};
const ROTULO_CURTO = { povoamento: 'Povoamento', 'despesca-prevista': 'Despesca prevista', 'despesca-realizada': 'Despesca' };
const TEXTO_REPETICAO = { 7: 'repete a cada 7 dias', 15: 'repete a cada 15 dias', 30: 'repete a cada 30 dias' };

// "T" + número quando o nome termina em número ("Tanque 01" → "T01"); senão,
// os três primeiros caracteres significativos ("Viveiro Norte" → "Viv").
export function abreviarTanque(nome) {
    const numero = nome.match(/(\d+)\s*$/);
    return numero ? `T${numero[1]}` : nome.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 3);
}

export function criarAgenda(raiz, {
    hoje,
    nivelTitulo = 2,
    tanques,
    obterCor,
    tanqueFixo = null,
    filtroFixo = false,
    carregarEventos,
    carregarAtrasados,
    acoes,
    hrefRegistro,
    hrefEditarRegistro,
    hrefTanque,
    abrirQuadroAoIniciar = true,
}) {
    let { ano, mes } = partesData(hoje);
    let selecionado = hoje;
    let quadroAberto = false;
    let filtroTanque = null;
    let ultimoSalvo = null;
    const tiposVisiveis = new Set(TIPOS_FILTRO.map(({ grupo }) => grupo));
    let eventosPorData = new Map();

    // ---------- Estrutura ----------

    const titulo = criarElemento(`h${nivelTitulo}`, { classe: 'agenda__mes', atributos: { 'aria-live': 'polite' } });
    const resumo = criarElemento('p', { classe: 'agenda__resumo' });
    const botao = (texto, rotulo) => criarElemento('button', { classe: 'botao botao--secundario botao--pequeno', texto, atributos: { type: 'button', 'aria-label': rotulo } });
    const botaoAnterior = botao('‹', 'Mês anterior');
    const botaoSeguinte = botao('›', 'Próximo mês');
    const botaoHoje = botao('Hoje', 'Ir para hoje');
    const filtroTanques = criarElemento('div', { classe: 'chips', atributos: { role: 'group', 'aria-label': 'Filtrar por tanque' } });
    const filtroTipos = criarElemento('div', { classe: 'chips', atributos: { role: 'group', 'aria-label': 'Filtrar por tipo' } });
    const grade = criarElemento('div', { classe: 'calendario__grade' });
    const calendario = criarElemento('div', { classe: 'calendario' }, [
        criarElemento('div', { classe: 'calendario__semana', atributos: { 'aria-hidden': 'true' } },
            DIAS_DA_SEMANA.map((dia) => criarElemento('span', { texto: dia }))),
        grade,
    ]);
    const quadro = criarElemento('aside', { classe: 'quadro', atributos: { 'aria-labelledby': 'quadro-titulo', hidden: true } });
    const corpo = criarElemento('div', { classe: 'agenda__corpo' }, [calendario, quadro]);

    raiz.replaceChildren(
        criarElemento('div', { classe: 'agenda__topo' }, [
            criarElemento('div', {}, [titulo, resumo]),
            criarElemento('div', { classe: 'agenda__navegacao' }, [botaoAnterior, botaoSeguinte, botaoHoje]),
        ]),
        criarElemento('div', { classe: 'agenda__filtros' }, [!filtroFixo && filtroTanques, filtroTipos]),
        corpo,
    );

    // ---------- Grade do mês ----------

    function intervaloVisivel() {
        // Seis semanas fixas a partir do domingo antes do dia 1: a grade não muda de altura.
        const primeiroDia = montarDataISO(ano, mes, 1);
        const inicio = somarDias(primeiroDia, -diaDaSemana(primeiroDia));
        return { inicio, fim: somarDias(inicio, 41) };
    }

    function passaNosFiltros(evento) {
        if (!tiposVisiveis.has(GRUPO_DO_TIPO[evento.tipo])) {
            return false;
        }
        // Lembretes gerais aparecem com qualquer filtro de tanque (seção 7.1).
        return !filtroTanque || !evento.tanqueId || evento.tanqueId === filtroTanque;
    }

    function renderizar({ focar = false } = {}) {
        const { inicio, fim } = intervaloVisivel();
        eventosPorData = new Map();
        for (const evento of carregarEventos(inicio, fim).filter(passaNosFiltros)) {
            if (!eventosPorData.has(evento.data)) {
                eventosPorData.set(evento.data, []);
            }
            eventosPorData.get(evento.data).push(evento);
        }
        titulo.textContent = formatarMesAno(ano, mes);
        const doMes = [...eventosPorData.entries()].filter(([data]) => partesData(data).mes === mes).flatMap(([, eventos]) => eventos);
        // O mês já está no título logo acima; o resumo traz só as contagens.
        resumo.textContent = [
            pluralizar(doMes.filter((evento) => evento.tipo === 'registro').length, 'registro', 'registros'),
            pluralizar(doMes.filter((evento) => evento.tipo === 'lembrete').length, 'lembrete', 'lembretes'),
        ].join(' · ');

        const dias = [];
        for (let data = inicio; data <= fim; data = somarDias(data, 1)) {
            dias.push(criarDia(data));
        }
        grade.replaceChildren(...dias);
        renderizarFiltros();
        if (quadroAberto) {
            renderizarQuadro();
        }
        if (focar) {
            grade.querySelector('[aria-pressed="true"]')?.focus();
        }
        ultimoSalvo = null;
    }

    function criarDia(data) {
        const eventos = eventosPorData.get(data) ?? [];
        const classes = ['calendario__dia'];
        if (partesData(data).mes !== mes) {
            classes.push('calendario__dia--fora-do-mes');
        }
        if (data === hoje) {
            classes.push('calendario__dia--hoje');
        }
        const etiquetas = montarEtiquetas(eventos);
        const visiveis = etiquetas.slice(0, MAXIMO_ETIQUETAS);
        const restantes = etiquetas.length - visiveis.length;
        return criarElemento('button', {
            classe: classes.join(' '),
            atributos: {
                type: 'button',
                'data-data': data,
                'aria-pressed': String(data === selecionado && quadroAberto),
                'aria-label': `${formatarDataPorExtenso(data)}, ${eventos.length > 0 ? pluralizar(eventos.length, 'evento', 'eventos') : 'nada marcado'}`,
                // Só o dia escolhido entra na ordem do Tab; as setas percorrem os outros.
                tabindex: data === selecionado ? '0' : '-1',
            },
        }, [
            criarElemento('span', { classe: 'calendario__numero', texto: String(partesData(data).dia) }),
            criarElemento('span', { classe: 'calendario__etiquetas', atributos: { 'aria-hidden': 'true' } }, [
                ...visiveis.map(criarEtiqueta),
                restantes > 0 && criarElemento('span', { classe: 'calendario__mais', texto: `+${restantes} mais` }),
            ]),
        ]);
    }

    // Seção 7.1: alertas, ciclo, lembretes e registros, nessa ordem; vários
    // registros no mesmo dia viram uma etiqueta só, com a cor de cada tanque.
    function montarEtiquetas(eventos) {
        // Na agenda de um tanque só, repetir o tanque em cada etiqueta seria ruído.
        const abreviacao = (evento) => (evento.tanqueId && !filtroFixo ? abreviarTanque(evento.tanqueNome ?? '') : null);
        const juntar = (...partes) => partes.filter(Boolean).join(' · ');
        const etiquetas = [];
        for (const evento of eventos.filter((item) => item.tipo === 'alerta')) {
            etiquetas.push({ tipo: 'alerta', texto: juntar(evento.titulo, abreviacao(evento)), completo: `${evento.titulo}: ${evento.tanqueNome}` });
        }
        for (const evento of eventos.filter((item) => item.tipo in ROTULO_CURTO)) {
            etiquetas.push({ tipo: evento.tipo, texto: juntar(ROTULO_CURTO[evento.tipo], abreviacao(evento)), completo: `${evento.rotulo}: ${evento.tanqueNome}` });
        }
        for (const evento of eventos.filter((item) => item.tipo === 'lembrete')) {
            etiquetas.push({
                tipo: 'lembrete',
                texto: juntar(evento.titulo, abreviacao(evento)),
                completo: evento.tanqueNome ? `${evento.titulo}: ${evento.tanqueNome}` : evento.titulo,
                concluida: evento.concluida,
                nova: evento.lembreteId === ultimoSalvo,
            });
        }
        const registros = eventos.filter((item) => item.tipo === 'registro');
        if (registros.length === 1) {
            etiquetas.push({ tipo: 'registro', texto: juntar('Registro', abreviacao(registros[0])), completo: `Registro: ${registros[0].tanqueNome}`, cores: [corDoTanque(registros[0].tanqueId)] });
        } else if (registros.length > 1) {
            const cores = [...new Set(registros.map((registro) => corDoTanque(registro.tanqueId)))];
            etiquetas.push({ tipo: 'registro', texto: `${registros.length} registros`, completo: registros.map((registro) => registro.tanqueNome).join(', '), cores });
        }
        return etiquetas;
    }

    function corDoTanque(tanqueId) {
        return obterCor(tanqueId) ?? 'var(--cor-texto-suave)';
    }

    function criarEtiqueta({ tipo, texto, completo, concluida, nova, cores = [] }) {
        const classes = [`etiqueta etiqueta--${tipo}`];
        if (concluida) {
            classes.push('etiqueta--concluida');
        }
        if (nova) {
            classes.push('etiqueta--nova');
        }
        const pontos = cores.map((cor) => {
            const ponto = criarElemento('span', { classe: 'etiqueta__ponto' });
            ponto.style.setProperty('--cor-serie', cor);
            return ponto;
        });
        return criarElemento('span', { classe: classes.join(' '), atributos: { title: completo } }, [
            tipo === 'lembrete' && criarIcone('sino', { classe: 'icone etiqueta__icone' }),
            ...pontos,
            criarElemento('span', { classe: 'etiqueta__texto', texto }),
        ]);
    }

    // ---------- Filtros ----------

    function renderizarFiltros() {
        filtroTanques.replaceChildren(...[{ id: null, nome: 'Todos' }, ...tanques].map(({ id, nome, cor }) => {
            const chip = criarElemento('button', {
                classe: 'chip',
                atributos: { type: 'button', 'aria-pressed': String(id === filtroTanque), 'data-filtro-tanque': id ?? '' },
            }, [cor && criarElemento('span', { classe: 'segmentado__cor', atributos: { 'aria-hidden': 'true' } }), nome]);
            chip.querySelector('.segmentado__cor')?.style.setProperty('--cor-serie', cor);
            return chip;
        }));
        filtroTipos.replaceChildren(...TIPOS_FILTRO.map(({ grupo, texto }) => criarElemento('button', {
            classe: 'chip',
            texto,
            atributos: { type: 'button', 'aria-pressed': String(tiposVisiveis.has(grupo)), 'data-filtro-tipo': grupo },
        })));
    }

    filtroTanques.addEventListener('click', (evento) => {
        const chip = evento.target.closest('[data-filtro-tanque]');
        if (chip) {
            filtroTanque = chip.dataset.filtroTanque || null;
            renderizar();
        }
    });
    filtroTipos.addEventListener('click', (evento) => {
        const chip = evento.target.closest('[data-filtro-tipo]');
        if (!chip) {
            return;
        }
        // Liga e desliga; pelo menos um tipo fica sempre ligado.
        const grupo = chip.dataset.filtroTipo;
        if (tiposVisiveis.has(grupo) && tiposVisiveis.size > 1) {
            tiposVisiveis.delete(grupo);
        } else {
            tiposVisiveis.add(grupo);
        }
        renderizar();
    });

    // ---------- Quadro do dia ----------

    function abrirQuadro(data, { focar = false } = {}) {
        selecionado = data;
        quadroAberto = true;
        const partes = partesData(data);
        if (partes.ano !== ano || partes.mes !== mes) {
            ano = partes.ano;
            mes = partes.mes;
        }
        renderizar();
        quadro.hidden = false;
        corpo.classList.add('agenda__corpo--com-quadro');
        if (focar) {
            quadro.querySelector('.quadro__fechar')?.focus();
        }
    }

    function fecharQuadro() {
        quadroAberto = false;
        quadro.hidden = true;
        corpo.classList.remove('agenda__corpo--com-quadro');
        renderizar();
        grade.querySelector(`[data-data="${selecionado}"]`)?.focus();
    }

    function renderizarQuadro() {
        const eventos = eventosPorData.get(selecionado) ?? [];
        const atrasados = selecionado === hoje && tiposVisiveis.has('lembretes')
            ? carregarAtrasados().filter((item) => !filtroTanque || !item.tanqueId || item.tanqueId === filtroTanque)
            : [];
        const secoes = [
            atrasados.length > 0 && criarSecao('Atrasados', atrasados.map((item) => criarItemLembrete({ ...item, tipo: 'lembrete' }, { atrasado: true }))),
            criarSecao('Lembretes', eventos.filter((item) => item.tipo === 'lembrete').map((item) => criarItemLembrete(item))),
            criarSecao('Registros', eventos.filter((item) => item.tipo === 'registro').map(criarItemRegistro)),
            criarSecao('Ciclo', eventos.filter((item) => item.tipo in ROTULO_CURTO).map(criarItemCiclo)),
            criarSecao('Alertas', eventos.filter((item) => item.tipo === 'alerta').map(criarItemAlerta)),
        ].filter(Boolean);
        const total = eventos.length + atrasados.length;

        const cabecalho = criarElemento('div', { classe: 'quadro__cabecalho' }, [
            criarElemento('div', {}, [
                criarElemento(`h${nivelTitulo + 1}`, { classe: 'quadro__titulo', texto: formatarDataCompleta(selecionado), atributos: { id: 'quadro-titulo' } }),
                criarElemento('p', { classe: 'quadro__contagem' }, [
                    selecionado === hoje && criarSelo('Hoje', 'sucesso'),
                    total > 0 ? pluralizar(total, 'item', 'itens') : 'Nada marcado',
                ]),
            ]),
            criarElemento('button', { classe: 'quadro__fechar', texto: '×', atributos: { type: 'button', 'aria-label': 'Fechar o quadro do dia' } }),
        ]);
        const conteudo = criarElemento('div', { classe: 'quadro__conteudo' },
            secoes.length > 0 ? secoes : [criarElemento('p', { classe: 'quadro__vazio', texto: 'Nada marcado para este dia.' })]);
        // RN12: registro só em hoje ou datas passadas.
        const rodape = criarElemento('div', { classe: 'quadro__rodape' }, [
            criarElemento('button', { classe: 'botao botao--primario', atributos: { type: 'button', 'data-acao-quadro': 'novo-lembrete' } },
                [criarIcone('mais', { classe: 'icone icone--girar' }), 'Adicionar lembrete']),
            selecionado <= hoje && criarElemento('a', { classe: 'botao botao--secundario', atributos: { href: hrefRegistro(selecionado) } },
                [criarIcone('mais', { classe: 'icone icone--girar' }), 'Registro neste dia']),
        ]);
        quadro.replaceChildren(cabecalho, conteudo, rodape);
    }

    function criarSecao(titulo, itens) {
        if (itens.length === 0) {
            return null;
        }
        return criarElemento('section', { classe: 'quadro__secao' }, [
            criarElemento(`h${nivelTitulo + 2}`, { classe: 'quadro__secao-titulo', texto: titulo }),
            criarElemento('ul', { classe: 'quadro__lista' }, itens),
        ]);
    }

    function marcaDoTanque(tanqueId, tanqueNome) {
        if (!tanqueId) {
            return criarElemento('span', { classe: 'quadro__tanque', texto: 'Geral' });
        }
        const marca = criarElemento('a', { classe: 'quadro__tanque link', texto: tanqueNome, atributos: { href: hrefTanque(tanqueId) } });
        marca.style.setProperty('--cor-serie', corDoTanque(tanqueId));
        return marca;
    }

    function criarItemLembrete(item, { atrasado = false } = {}) {
        const idCampo = `concluir-${item.lembreteId}-${item.data}`;
        const detalhes = [item.repetirDias && TEXTO_REPETICAO[item.repetirDias], atrasado && formatarDataPorExtenso(item.data)].filter(Boolean).join(' · ');
        return criarElemento('li', { classe: `quadro__item quadro__item--lembrete${item.concluida ? ' quadro__item--concluido' : ''}` }, [
            criarElemento('div', { classe: 'quadro__linha' }, [
                criarElemento('input', {
                    classe: 'campo__checkbox',
                    atributos: { type: 'checkbox', id: idCampo, checked: item.concluida, 'data-concluir': item.lembreteId, 'data-ocorrencia': item.data },
                }),
                criarElemento('label', { classe: 'quadro__item-titulo', texto: item.titulo, atributos: { for: idCampo } }),
                atrasado && criarSelo('Atrasado', 'atencao'),
            ]),
            criarElemento('p', { classe: 'quadro__item-detalhe' }, [marcaDoTanque(item.tanqueId, item.tanqueNome), detalhes && ` · ${detalhes}`]),
            item.observacao && criarElemento('p', { classe: 'quadro__item-detalhe', texto: item.observacao }),
            criarElemento('div', { classe: 'quadro__acoes' }, [
                criarElemento('button', { classe: 'link', texto: 'Editar', atributos: { type: 'button', 'data-editar-lembrete': item.lembreteId } }),
                criarElemento('button', {
                    classe: 'link link--perigo',
                    texto: 'Remover',
                    atributos: { type: 'button', 'data-remover-lembrete': item.lembreteId, 'data-ocorrencia': item.data, 'data-repete': item.repetirDias ? 'sim' : 'nao' },
                }),
            ]),
        ]);
    }

    function criarItemRegistro(item) {
        return criarElemento('li', { classe: 'quadro__item' }, [
            criarElemento('p', { classe: 'quadro__item-titulo' }, [marcaDoTanque(item.tanqueId, item.tanqueNome)]),
            criarElemento('p', { classe: 'quadro__item-detalhe', texto: item.descricao }),
            item.editavel && criarElemento('a', { classe: 'link quadro__acoes', texto: 'Editar registro', atributos: { href: hrefEditarRegistro(item.registroId) } }),
        ]);
    }

    function criarItemCiclo(item) {
        return criarElemento('li', { classe: `quadro__item quadro__item--${item.tipo}` }, [
            criarElemento('p', { classe: 'quadro__item-titulo', texto: item.rotulo }),
            criarElemento('p', { classe: 'quadro__item-detalhe' }, [marcaDoTanque(item.tanqueId, item.tanqueNome), ` · ${item.descricao}`]),
        ]);
    }

    function criarItemAlerta(item) {
        return criarElemento('li', { classe: 'quadro__item quadro__item--alerta' }, [
            criarElemento('p', { classe: 'quadro__item-titulo' }, [item.titulo, criarSelo(item.gravidade === 'alta' ? 'Alta' : 'Média', `alerta-${item.gravidade}`)]),
            criarElemento('p', { classe: 'quadro__item-detalhe' }, [marcaDoTanque(item.tanqueId, item.tanqueNome), ` · ${item.descricao}`]),
        ]);
    }

    // ---------- Formulário de lembrete ----------

    function abrirFormulario(lembrete = null) {
        const opcoesTanque = [criarElemento('option', { texto: 'Geral', atributos: { value: '' } }),
            ...tanques.map(({ id, nome }) => criarElemento('option', { texto: nome, atributos: { value: id } }))];
        const campo = (id, rotulo, controle, ajuda) => criarElemento('div', { classe: 'campo' }, [
            criarElemento('label', { classe: 'campo__rotulo', texto: rotulo, atributos: { for: id } }),
            controle,
            ajuda && criarElemento('p', { classe: 'campo__ajuda', texto: ajuda, atributos: { id: `ajuda-${id}` } }),
            criarElemento('p', { classe: 'campo__erro', atributos: { id: `erro-${id}` } }),
        ]);
        const descrito = (id, ajuda = false) => (ajuda ? `ajuda-${id} erro-${id}` : `erro-${id}`);
        const formulario = criarElemento('form', { classe: 'formulario quadro__formulario', atributos: { novalidate: true } }, [
            criarElemento(`h${nivelTitulo + 2}`, { classe: 'quadro__secao-titulo', texto: lembrete ? 'Editar lembrete' : 'Novo lembrete' }),
            criarElemento('input', { atributos: { type: 'hidden', name: 'id' } }),
            campo('lembrete-titulo', 'Título', criarElemento('input', {
                classe: 'campo__input',
                atributos: { id: 'lembrete-titulo', name: 'titulo', type: 'text', maxlength: '80', autocomplete: 'off', required: true, 'aria-describedby': descrito('lembrete-titulo') },
            })),
            campo('lembrete-data', 'Data', criarElemento('input', {
                classe: 'campo__input',
                atributos: { id: 'lembrete-data', name: 'data', type: 'date', required: true, 'aria-describedby': descrito('lembrete-data') },
            })),
            campo('lembrete-tanque', 'Tanque', criarElemento('select', {
                classe: 'campo__select',
                atributos: { id: 'lembrete-tanque', name: 'tanqueId', 'aria-describedby': descrito('lembrete-tanque') },
            }, opcoesTanque)),
            campo('lembrete-repetir', 'Repetir', criarElemento('select', {
                classe: 'campo__select',
                atributos: { id: 'lembrete-repetir', name: 'repetirDias', 'aria-describedby': descrito('lembrete-repetir') },
            }, [['', 'Não repete'], ['7', 'A cada 7 dias'], ['15', 'A cada 15 dias'], ['30', 'A cada 30 dias']]
                .map(([valor, texto]) => criarElemento('option', { texto, atributos: { value: valor } })))),
            campo('lembrete-observacao', 'Observação (opcional)', criarElemento('textarea', {
                classe: 'campo__input campo__input--area',
                atributos: { id: 'lembrete-observacao', name: 'observacao', rows: '3', maxlength: '300', 'aria-describedby': descrito('lembrete-observacao', true) },
            }), 'O lembrete aparece só dentro do app: sem servidor, o celular não avisa com o app fechado.'),
            criarElemento('p', { classe: 'formulario__erro-geral', atributos: { role: 'alert', hidden: true } }),
            criarElemento('div', { classe: 'formulario__acoes' }, [
                criarElemento('button', { classe: 'botao botao--secundario', texto: 'Cancelar', atributos: { type: 'button', 'data-acao-quadro': 'cancelar' } }),
                criarElemento('button', { classe: 'botao botao--primario', texto: 'Salvar lembrete', atributos: { type: 'submit' } }),
            ]),
        ]);
        const conteudo = quadro.querySelector('.quadro__conteudo');
        conteudo.replaceChildren(formulario);
        quadro.querySelector('.quadro__rodape').hidden = true;
        preencherFormulario(formulario, {
            id: lembrete?.id ?? '',
            titulo: lembrete?.titulo ?? '',
            data: lembrete?.data ?? selecionado,
            tanqueId: lembrete ? lembrete.tanqueId ?? '' : tanqueFixo ?? '',
            repetirDias: lembrete?.repetirDias ? String(lembrete.repetirDias) : '',
            observacao: lembrete?.observacao ?? '',
        });
        const erroGeral = formulario.querySelector('.formulario__erro-geral');
        limparErrosFormulario(formulario, erroGeral);
        iniciarFormulario(formulario, {
            erroGeral,
            aoEnviar: (valores) => {
                const salvo = acoes.salvarLembrete({
                    id: valores.id || null,
                    titulo: valores.titulo,
                    data: valores.data,
                    tanqueId: valores.tanqueId || null,
                    repetirDias: paraNumero(valores.repetirDias),
                    observacao: valores.observacao,
                });
                // O lembrete aparece na hora na grade, com uma pequena animação de entrada (seção 7.3).
                selecionado = salvo.data;
                const partes = partesData(salvo.data);
                ano = partes.ano;
                mes = partes.mes;
                ultimoSalvo = salvo.id;
                renderizar();
            },
        });
        formulario.querySelector('#lembrete-titulo').focus();
    }

    // ---------- Remoção ----------

    // Remover lembrete repetido pergunta se é só esta vez ou todas as repetições (seção 7.2).
    function perguntarRemocao(repete) {
        const dialogo = criarElemento('dialog', { classe: 'dialogo', atributos: { 'aria-labelledby': 'pergunta-remocao' } }, [
            criarElemento('form', { classe: 'dialogo__conteudo', atributos: { method: 'dialog' } }, [
                criarElemento('p', {
                    classe: 'dialogo__mensagem',
                    texto: repete ? 'Este lembrete se repete. O que você quer remover?' : 'Remover este lembrete?',
                    atributos: { id: 'pergunta-remocao' },
                }),
                criarElemento('div', { classe: 'dialogo__acoes' }, [
                    criarElemento('button', { classe: 'botao botao--secundario', texto: 'Cancelar', atributos: { value: 'cancelar' } }),
                    repete && criarElemento('button', { classe: 'botao botao--secundario', texto: 'Só esta vez', atributos: { value: 'ocorrencia' } }),
                    criarElemento('button', { classe: 'botao botao--perigo', texto: repete ? 'Todas as repetições' : 'Remover', atributos: { value: 'todas' } }),
                ]),
            ]),
        ]);
        document.body.append(dialogo);
        dialogo.showModal();
        return new Promise((resolver) => {
            dialogo.addEventListener('close', () => {
                resolver(dialogo.returnValue);
                dialogo.remove();
            }, { once: true });
        });
    }

    // ---------- Eventos ----------

    grade.addEventListener('click', (evento) => {
        const dia = evento.target.closest('[data-data]');
        if (dia) {
            abrirQuadro(dia.dataset.data, { focar: window.matchMedia('(max-width: 59.99rem)').matches });
        }
    });
    grade.addEventListener('keydown', (evento) => {
        if (!(evento.key in TECLAS) || !evento.target.closest('[data-data]')) {
            return;
        }
        evento.preventDefault();
        selecionado = somarDias(selecionado, TECLAS[evento.key]);
        const partes = partesData(selecionado);
        ano = partes.ano;
        mes = partes.mes;
        renderizar({ focar: true });
    });
    quadro.addEventListener('click', async (evento) => {
        const alvo = evento.target;
        if (alvo.closest('.quadro__fechar')) {
            fecharQuadro();
        } else if (alvo.closest('[data-acao-quadro="novo-lembrete"]')) {
            abrirFormulario();
        } else if (alvo.closest('[data-acao-quadro="cancelar"]')) {
            renderizarQuadro();
        } else if (alvo.closest('[data-editar-lembrete]')) {
            abrirFormulario(acoes.obterLembrete(alvo.closest('[data-editar-lembrete]').dataset.editarLembrete));
        } else if (alvo.closest('[data-remover-lembrete]')) {
            const botaoRemover = alvo.closest('[data-remover-lembrete]');
            const resposta = await perguntarRemocao(botaoRemover.dataset.repete === 'sim');
            if (resposta === 'ocorrencia') {
                acoes.removerOcorrencia(botaoRemover.dataset.removerLembrete, botaoRemover.dataset.ocorrencia);
            } else if (resposta === 'todas') {
                acoes.removerLembrete(botaoRemover.dataset.removerLembrete);
            }
            renderizar();
        }
    });
    quadro.addEventListener('change', (evento) => {
        const caixa = evento.target.closest('[data-concluir]');
        if (caixa) {
            acoes.alternarConclusao(caixa.dataset.concluir, caixa.dataset.ocorrencia);
            renderizar();
        }
    });
    raiz.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape' && quadroAberto && !document.querySelector('dialog[open]')) {
            fecharQuadro();
        }
    });
    botaoAnterior.addEventListener('click', () => irParaMes(mes === 1 ? ano - 1 : ano, mes === 1 ? 12 : mes - 1));
    botaoSeguinte.addEventListener('click', () => irParaMes(mes === 12 ? ano + 1 : ano, mes === 12 ? 1 : mes + 1));
    botaoHoje.addEventListener('click', () => (quadroAberto ? abrirQuadro(hoje) : irParaMes(partesData(hoje).ano, partesData(hoje).mes)));

    function irParaMes(novoAno, novoMes) {
        ano = novoAno;
        mes = novoMes;
        const doHoje = partesData(hoje);
        selecionado = doHoje.ano === ano && doHoje.mes === mes ? hoje : montarDataISO(ano, mes, 1);
        renderizar();
    }

    // Ao abrir a página, o quadro já vem em hoje (seção 7.2). No celular ele
    // ocupa a tela inteira, então lá só abre quando o produtor toca num dia.
    if (abrirQuadroAoIniciar && window.matchMedia('(min-width: 60rem)').matches) {
        abrirQuadro(hoje);
    } else {
        renderizar();
    }

    return {
        atualizar: () => renderizar(),
        abrirFormularioNovo: (data = hoje) => {
            abrirQuadro(data);
            abrirFormulario();
        },
    };
}
