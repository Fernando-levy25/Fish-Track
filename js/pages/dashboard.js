// Tela "Hoje" (seção 7.1): primeiro o que fazer hoje, depois os tanques com o
// estado de cada um e, por último e recolhível, a produção (indicadores e gráfico).

import { criarSlug, hojeISO, somarDias } from '../core/utils.js';
import {
    formatarBiomassa,
    formatarDataCompleta,
    formatarFca,
    formatarInteiro,
    formatarNumero,
    formatarPercentual,
    formatarRacao,
    pluralizar,
} from '../core/format.js';
import { lerPreferencia, salvarPreferencia } from '../core/storage.js';
import { listarSituacoes, listarTanques } from '../domain/tanques.js';
import { calcularProximaBiometria, calcularResumoPeriodo } from '../domain/indicadores.js';
import { analisarTanque, ordenarAlertas, resolverLimites } from '../domain/alertas.js';
import { obterLimitesPadrao, obterMetaFca } from '../domain/configuracoes.js';
import { calcularEstadoTanque } from '../domain/estado.js';
import { encontrarProximoEvento, gerarTarefasDoDia } from '../domain/tarefas.js';
import { alternarConclusao, listarAtrasados, listarOcorrencias } from '../domain/lembretes.js';
import { temRotinaNaData } from '../domain/registros.js';
import { exportarGraficoPng } from '../services/exportacao.js';
import { montarUrl } from '../ui/nav.js';
import {
    criarBarraCapacidade,
    criarBarraLimite,
    criarElemento,
    criarEtiquetaEstado,
    criarReguaFca,
    criarSelo,
    criarTermo,
    criarValorAusente,
    criarValorEstimado,
    mostrarErroPagina,
} from '../ui/componentes.js';
import { desenharGraficoSeries, desenharSparkline, obterCorTanque } from '../ui/graficos.js';
import { GLOSSARIO } from '../ui/glossario.js';
import { criarIcone } from '../ui/icones.js';
import { atualizarMenu, descreverRacaoSugerida, EVENTO_LEMBRETES, iniciarPagina, obterAcaoDoAlerta } from './comum.js';

const PERIODOS = ['7', '30', 'ciclo'];
const PERIODO_PADRAO = '30';

// Cada indicador: como aparece no cartão e qual campo da série vai para o gráfico.
// Os estimados (seção 9.4) levam "≈" antes do valor.
const INDICADORES = {
    biomassa: { rotulo: 'Biomassa', campo: 'biomassaKg', formatar: formatarBiomassa, rotuloTotal: 'Total', estimado: true },
    peixes: { rotulo: 'Peixes', campo: 'quantidade', formatar: formatarInteiro, rotuloTotal: 'Total', estimado: true },
    fca: { rotulo: 'FCA', campo: 'fca', formatar: formatarFca, rotuloTotal: 'Geral', estimado: true },
    mortalidade: { rotulo: 'Mortalidade observada', campo: 'taxaMortalidade', formatar: formatarPercentual, rotuloTotal: 'Geral' },
    racao: { rotulo: 'Ração consumida', campo: 'racaoDiaKg', formatar: formatarRacao, rotuloTotal: 'Total' },
};
// A FCA dos primeiros dias do ciclo, com pouco ganho de peso, passa de 10:
// a escala do gráfico para em 3 para a faixa útil continuar legível.
const MAXIMO_EIXO_FCA = 3;
// Ícone de cada tipo de tarefa (o significado vai no texto ao lado).
const ICONE_TAREFA = { alimentar: 'racao', biometria: 'balanca', lembrete: 'sino' };
const ICONE_GRAVIDADE = { alta: 'alerta', media: 'relogio', baixa: 'relogio' };

const porId = (id) => document.getElementById(id);
const estado = {
    periodo: PERIODOS.includes(lerPreferencia('periodoDashboard')) ? lerPreferencia('periodoDashboard') : PERIODO_PADRAO,
    indicador: 'biomassa',
    tanqueId: null,
};
let contexto = null;
let resumo = null;
// O que está no gráfico agora, para o título e a legenda da imagem PNG.
let graficoAtual = null;

iniciarPagina();
try {
    carregar();
    configurarInteracoes();
    renderizarTudo();
} catch (erro) {
    mostrarErroPagina(erro);
}

function carregar() {
    const hoje = hojeISO();
    const limitesPadrao = obterLimitesPadrao();
    const todos = listarTanques({ incluirArquivados: true });
    const situacoes = listarSituacoes();
    const ativos = situacoes
        .filter((situacao) => situacao.cicloAtivo)
        .map((situacao) => {
            const analise = analisarTanque(situacao, { limitesPadrao, hoje });
            return {
                ...situacao,
                ...analise,
                estadoTanque: calcularEstadoTanque({ situacao, alertas: analise.alertas }),
                racao: descreverRacaoSugerida(situacao, hoje),
                anotadoHoje: temRotinaNaData(situacao.registros, situacao.tanque.id, hoje),
                proxima: calcularProximaBiometria({ tanque: situacao.tanque, ciclo: situacao.cicloAtivo, registros: situacao.registros, hoje }),
            };
        });
    contexto = {
        hoje,
        limitesPadrao,
        metaFca: obterMetaFca(),
        todos,
        situacoes,
        ativos,
        alertas: ordenarAlertas(ativos.flatMap((item) => item.alertas)),
        // A cor segue a ordem de criação entre todos os tanques, arquivados incluídos.
        cor: (tanque) => obterCorTanque(tanque, todos),
    };
    calcularPeriodo();
}

function calcularPeriodo() {
    const { hoje, ativos } = contexto;
    // "Ciclo inteiro" começa no povoamento mais antigo entre os ciclos ativos.
    const dataInicio = estado.periodo === 'ciclo'
        ? ativos.map((item) => item.cicloAtivo.dataInicio).sort()[0] ?? somarDias(hoje, -Number(PERIODO_PADRAO))
        : somarDias(hoje, -Number(estado.periodo));
    resumo = calcularResumoPeriodo(
        ativos.map(({ tanque, cicloAtivo, registros }) => ({ tanque, ciclo: cicloAtivo, registros })),
        { dataInicio, dataFim: hoje },
    );
}

function textoDoPeriodo() {
    return estado.periodo === 'ciclo' ? 'no ciclo' : `em ${estado.periodo} dias`;
}

function renderizarTudo() {
    renderizarCabecalho();
    // App sem nenhum tanque em cultivo: só os primeiros passos (seção 7.1).
    const semCultivo = contexto.ativos.length === 0;
    porId('conteudo-hoje').hidden = semCultivo;
    renderizarPrimeirosPassos(semCultivo);
    if (semCultivo) {
        return;
    }
    renderizarTarefas();
    renderizarTanques();
    renderizarDestaques();
    renderizarFiltroGrafico();
    renderizarGrafico();
}

// ---------- Cabeçalho ----------

function renderizarCabecalho() {
    const { hoje, ativos } = contexto;
    porId('data-hoje').textContent = formatarDataCompleta(hoje);
    const precisam = ativos.filter((item) => item.alertas.length > 0).length;
    porId('resumo-producao').replaceChildren(...(ativos.length === 0 ? ['Nenhum tanque em cultivo ainda.'] : [
        `${pluralizar(ativos.length, 'tanque em cultivo', 'tanques em cultivo')} · `,
        precisam > 0
            ? criarElemento('strong', { texto: precisam === 1 ? '1 precisa de atenção' : `${formatarInteiro(precisam)} precisam de atenção` })
            : 'todos em dia',
    ]));
    for (const botao of porId('seletor-periodo').querySelectorAll('[data-periodo]')) {
        botao.setAttribute('aria-pressed', String(botao.dataset.periodo === estado.periodo));
    }
}

// ---------- Primeiros passos (seção 7.1) ----------

function renderizarPrimeirosPassos(semCultivo) {
    const area = porId('primeiros-passos');
    const tanques = contexto.situacoes;
    const vazio = tanques.find((situacao) => situacao.tanque.status === 'vazio');
    const comCiclo = contexto.ativos[0];
    const passos = [
        { feito: tanques.length > 0, titulo: 'Cadastre um tanque', texto: 'nome, espécie, volume e carga máxima.', acao: 'Cadastrar tanque', href: 'tanque-form.html' },
        {
            feito: contexto.ativos.length > 0,
            titulo: 'Povoe o tanque',
            texto: 'quantos peixes e o peso médio.',
            acao: 'Povoar tanque',
            href: vazio ? montarUrl('ciclo-form.html', { tanqueId: vazio.tanque.id, acao: 'iniciar' }) : 'tanques.html',
        },
        {
            feito: contexto.ativos.some((item) => item.tanque.tabelaArracoamentoId),
            titulo: 'Configure o plano de alimentação',
            texto: 'ou use o modelo pronto.',
            acao: 'Configurar plano',
            href: comCiclo ? montarUrl('tanque-form.html', { id: comCiclo.tanque.id }, 'alimentacao') : 'configuracoes.html',
        },
    ];
    const todosFeitos = passos.every((passo) => passo.feito);
    const dispensado = lerPreferencia('primeirosPassosDispensados', false);
    if (!todosFeitos && semCultivo) {
        salvarPreferencia('primeirosPassosVistos', true);
    }
    // Concluídos depois de vistos: uma linha discreta por um dia, e some.
    if (todosFeitos) {
        const vistos = lerPreferencia('primeirosPassosVistos', false);
        let concluidoEm = lerPreferencia('primeirosPassosConcluidosEm', null);
        if (vistos && !concluidoEm) {
            concluidoEm = contexto.hoje;
            salvarPreferencia('primeirosPassosConcluidosEm', concluidoEm);
        }
        const mostrar = vistos && concluidoEm >= somarDias(contexto.hoje, -1);
        area.hidden = !mostrar;
        area.className = 'primeiros-passos primeiros-passos--concluido';
        area.replaceChildren(...(mostrar ? [criarElemento('p', { atributos: { id: 'titulo-primeiros-passos' } }, [criarIcone('check'), 'Primeiros passos concluídos'])] : []));
        return;
    }
    area.hidden = !semCultivo && dispensado;
    area.className = 'primeiros-passos';
    const proximo = passos.findIndex((passo) => !passo.feito);
    area.replaceChildren(
        criarElemento('h2', { classe: 'primeiros-passos__titulo', texto: 'Vamos começar?', atributos: { id: 'titulo-primeiros-passos' } }),
        criarElemento('p', { texto: 'Em 3 passos o Fish Track já calcula a ração do dia para você.' }),
        criarElemento('ol', { classe: 'primeiros-passos__lista' }, passos.map((passo, indice) => criarElemento('li', {
            classe: `primeiros-passos__passo${passo.feito ? ' primeiros-passos__passo--feito' : ''}${indice === proximo ? ' primeiros-passos__passo--proximo' : ''}`,
        }, [
            passo.feito ? criarIcone('check') : criarElemento('span', { classe: 'primeiros-passos__numero', texto: String(indice + 1) }),
            criarElemento('p', {}, [criarElemento('strong', { texto: passo.titulo }), ` — ${passo.texto}`]),
            !passo.feito && criarElemento('a', {
                classe: `botao ${indice === proximo ? 'botao--primario' : 'botao--secundario'} botao--pequeno`,
                texto: passo.acao,
                atributos: { href: passo.href },
            }),
        ]))),
        criarElemento('p', {}, [
            'Quer só conhecer? ',
            criarElemento('a', { classe: 'link', texto: 'Carregar dados de exemplo', atributos: { href: 'configuracoes.html#titulo-dados' } }),
        ]),
        !semCultivo && criarElemento('button', { classe: 'link', texto: 'Dispensar', atributos: { type: 'button', 'data-dispensar-passos': '' } }),
    );
}

// ---------- O que fazer hoje ----------

function renderizarTarefas() {
    const { hoje, ativos } = contexto;
    const itens = ativos.map((item) => ({
        tanque: item.tanque,
        alertas: item.alertas,
        racaoSugeridaKg: item.racao.sugestao?.racaoDiaKg ?? null,
        anotadoHoje: item.anotadoHoje,
        proxima: item.proxima,
    }));
    const lembretes = [
        ...listarAtrasados({ hoje }).map((item) => ({ ...item, atrasado: true })),
        ...listarOcorrencias({ inicio: hoje, fim: hoje, hoje }),
    ];
    const { pendentes, feitas } = gerarTarefasDoDia({ itens, lembretes });
    const lista = porId('lista-tarefas');
    if (pendentes.length === 0) {
        const proximo = encontrarProximoEvento(itens);
        lista.replaceChildren(criarElemento('li', { classe: 'tarefas__vazia' }, [
            criarIcone('check'),
            criarElemento('div', {}, [
                criarElemento('p', { classe: 'tarefas__vazia-titulo', texto: 'Tudo em dia por hoje' }),
                proximo && criarElemento('p', { classe: 'tarefas__detalhe', texto: proximo }),
            ]),
        ]));
    } else {
        lista.replaceChildren(...pendentes.map(criarTarefa));
    }
    porId('tarefas-feitas').hidden = feitas.length === 0;
    porId('resumo-tarefas-feitas').textContent = `Feitas hoje · ${formatarInteiro(feitas.length)}`;
    porId('lista-tarefas-feitas').replaceChildren(...feitas.map((tarefa) => criarTarefa(tarefa, { feita: true })));
}

function criarTarefa(tarefa, { feita = false } = {}) {
    const icone = tarefa.tipo === 'alerta' ? ICONE_GRAVIDADE[tarefa.gravidade] : ICONE_TAREFA[tarefa.tipo];
    const classes = ['tarefa', `tarefa--${tarefa.tipo === 'alerta' ? tarefa.gravidade : tarefa.tipo}`];
    if (feita) {
        classes.push('tarefa--feita');
    }
    return criarElemento('li', { classe: classes.join(' ') }, [
        criarElemento('span', { classe: 'tarefa__icone' }, [criarIcone(icone ?? 'check')]),
        criarElemento('p', { classe: 'tarefa__titulo' }, [
            tarefa.titulo,
            tarefa.atrasado && criarSelo('Atrasado', 'atencao'),
        ]),
        feita && tarefa.tipo !== 'lembrete' ? null : criarAcaoDaTarefa(tarefa, feita),
    ]);
}

// Um botão por tarefa, com os nomes padronizados (seção 11.6).
function criarAcaoDaTarefa(tarefa, feita) {
    const botao = (texto, href, icone) => criarElemento('a', { classe: 'botao botao--secundario botao--pequeno tarefa__acao', atributos: { href } },
        [icone && criarIcone(icone), texto]);
    switch (tarefa.acao.tipo) {
        case 'alerta': {
            const acao = obterAcaoDoAlerta(tarefa.acao.alerta);
            return acao ? botao(acao.texto, acao.href, acao.icone) : botao('Ver tanque', montarUrl('tanque.html', { id: tarefa.tanqueId }), 'seta');
        }
        case 'anotar-dia':
            return botao('Anotar o dia', 'folha.html', 'lapis');
        case 'biometria':
            return botao('Fazer biometria', montarUrl('tanque.html', { id: tarefa.acao.tanqueId, acao: 'biometria' }), 'balanca');
        default: {
            const { lembrete } = tarefa.acao;
            const id = `tarefa-${lembrete.lembreteId}-${lembrete.data}`;
            return criarElemento('label', { classe: 'tarefa__concluir', atributos: { for: id } }, [
                criarElemento('input', {
                    classe: 'campo__checkbox',
                    atributos: { type: 'checkbox', id, checked: feita, 'data-concluir': lembrete.lembreteId, 'data-ocorrencia': lembrete.data },
                }),
                'Feito',
            ]);
        }
    }
}

// ---------- Seus tanques ----------

function renderizarTanques() {
    const { ativos, situacoes } = contexto;
    const cartoes = ativos.map(criarCartaoTanque);
    const semCiclo = situacoes.filter((situacao) => !situacao.cicloAtivo);
    if (semCiclo.length > 0) {
        cartoes.push(criarCartaoSemCiclo(semCiclo));
    }
    porId('grade-tanques').replaceChildren(...cartoes);
}

// A ação principal de cada cartão, conforme o estado (seção 7.1).
function escolherAcao(item) {
    const principal = item.alertas.find((alerta) => alerta.gravidade === 'alta') ?? item.alertas[0];
    const doAlerta = principal ? obterAcaoDoAlerta(principal) : null;
    if (doAlerta) {
        return doAlerta;
    }
    if (item.proxima.diasAteProxima === 0) {
        return { texto: 'Fazer biometria', icone: 'balanca', href: montarUrl('tanque.html', { id: item.tanque.id, acao: 'biometria' }) };
    }
    if (!item.anotadoHoje) {
        return { texto: 'Anotar', icone: 'lapis', href: montarUrl('folha.html', { tanque: item.tanque.id }) };
    }
    return { texto: 'Ver tanque', icone: 'seta', href: montarUrl('tanque.html', { id: item.tanque.id }) };
}

// Cartão compacto: estado e motivo, ração de hoje, capacidade e uma ação.
// Peixes, biomassa e FCA ficam na página do tanque.
function criarCartaoTanque(item) {
    const { tanque, indicadores, racao, estadoTanque, anotadoHoje } = item;
    const limites = resolverLimites(contexto.limitesPadrao, tanque.limitesAlerta);
    const acao = escolherAcao(item);
    let linhaRacao;
    if (anotadoHoje) {
        linhaRacao = 'Dia anotado';
    } else if (racao.sugestao) {
        linhaRacao = `${formatarRacao(racao.sugestao.racaoDiaKg)} em ${pluralizar(racao.sugestao.refeicoes, 'refeição', 'refeições')}`;
    } else {
        linhaRacao = criarValorAusente({ motivo: racao.textoMotivo, acao: racao.acaoMotivo.texto, href: racao.acaoMotivo.href });
    }
    const cartao = criarElemento('article', { classe: 'cartao-cultivo', atributos: { 'data-tanque': tanque.id } }, [
        criarElemento('div', { classe: 'cartao-cultivo__cabecalho' }, [
            criarElemento('div', {}, [
                criarElemento('h3', { classe: 'cartao-cultivo__nome' }, [
                    criarElemento('a', { classe: 'cartao-cultivo__link', texto: tanque.nome, atributos: { href: montarUrl('tanque.html', { id: tanque.id }) } }),
                ]),
                criarElemento('p', { classe: 'cartao-cultivo__especie', texto: `${tanque.especie} · ${pluralizar(indicadores.diasCultivo, 'dia', 'dias')} de cultivo` }),
            ]),
        ]),
        criarEtiquetaEstado(estadoTanque),
        criarElemento('p', { classe: 'cartao-cultivo__racao' }, [criarElemento('span', { classe: 'cartao-cultivo__rotulo', texto: 'Ração de hoje: ' }), linhaRacao]),
        criarBarraCapacidade({
            percentual: indicadores.capacidadeUtilizada,
            cargaKg: indicadores.biomassaKg,
            cargaMaximaKg: indicadores.cargaMaximaKg,
            limiteAlerta: limites.capacidadePct,
            compacta: true,
            hrefDefinir: montarUrl('tanque-form.html', { id: tanque.id }),
        }),
        criarElemento('div', { classe: 'cartao-cultivo__acoes' }, [
            criarElemento('a', {
                classe: 'botao botao--primario botao--pequeno',
                atributos: { href: acao.href, 'aria-label': `${acao.texto}: ${tanque.nome}` },
            }, [criarIcone(acao.icone), acao.texto]),
        ]),
    ]);
    cartao.style.setProperty('--cor-tanque', contexto.cor(tanque));
    return cartao;
}

function criarCartaoSemCiclo(semCiclo) {
    const vazios = semCiclo.filter((situacao) => situacao.tanque.status === 'vazio');
    const emManutencao = semCiclo.length - vazios.length;
    const detalhes = [];
    if (vazios.length > 0) {
        detalhes.push(pluralizar(vazios.length, 'vazio', 'vazios'));
    }
    if (emManutencao > 0) {
        detalhes.push(`${formatarInteiro(emManutencao)} em manutenção`);
    }
    let acao = { texto: 'Ver tanques', href: 'tanques.html' };
    if (vazios.length === 1) {
        acao = { texto: 'Povoar tanque', href: montarUrl('ciclo-form.html', { tanqueId: vazios[0].tanque.id, acao: 'iniciar' }) };
    } else if (vazios.length > 1) {
        acao = { texto: 'Povoar tanque', href: montarUrl('tanques.html', { status: 'vazio' }) };
    }
    return criarElemento('article', { classe: 'cartao-cultivo cartao-cultivo--sem-ciclo' }, [
        criarElemento('p', { classe: 'cartao-cultivo__nome', texto: pluralizar(semCiclo.length, 'tanque sem peixes', 'tanques sem peixes') }),
        criarElemento('p', { classe: 'cartao-cultivo__especie', texto: detalhes.join(' e ') }),
        criarElemento('a', { classe: 'botao botao--secundario botao--pequeno', atributos: { href: acao.href } },
            [criarIcone(acao.texto === 'Povoar tanque' ? 'mais' : 'seta'), acao.texto]),
    ]);
}

// ---------- Indicadores ----------

function renderizarDestaques() {
    porId('grade-destaques').replaceChildren(...Object.keys(INDICADORES).map(criarDestaque));
}

function criarDestaque(chave) {
    const { rotulo } = INDICADORES[chave];
    const { valor, apoio, selo, visual } = montarDestaque(chave);
    return criarElemento('button', {
        classe: 'destaque',
        atributos: { type: 'button', 'aria-pressed': String(chave === estado.indicador), 'data-indicador-grafico': chave },
    }, [
        criarElemento('span', { classe: 'destaque__topo' }, [
            criarElemento('span', { classe: 'destaque__rotulo', texto: rotulo }),
            selo && criarSelo(selo.texto, selo.variante),
        ]),
        criarElemento('span', { classe: 'destaque__valor' }, [INDICADORES[chave].estimado ? criarValorEstimado(valor) : valor]),
        criarElemento('span', { classe: 'destaque__apoio', texto: apoio }),
        criarElemento('span', { classe: 'destaque__visual' }, [visual]),
    ]);
}

// Todo número importante vem com contexto (seção 2.3): variação, meta ou limite.
function montarDestaque(chave) {
    const periodo = textoDoPeriodo();
    const sparkline = (campo) => {
        const area = criarElemento('span', { classe: 'destaque__sparkline' });
        desenharSparkline(area, resumo.totais.map((total) => total[campo]));
        return area;
    };
    switch (chave) {
        case 'biomassa': {
            const { atual, variacao, percentual } = resumo.biomassa;
            return {
                valor: formatarBiomassa(atual),
                apoio: `${variacao >= 0 ? '▲' : '▼'} ${formatarBiomassa(Math.abs(variacao))} ${periodo}`,
                selo: Number.isFinite(percentual)
                    ? { texto: `${percentual >= 0 ? '+' : '−'}${formatarNumero(Math.abs(percentual), 0)}%`, variante: percentual >= 0 ? 'sucesso' : 'perigo' }
                    : null,
                visual: sparkline('biomassaKg'),
            };
        }
        case 'peixes':
            return {
                valor: formatarInteiro(resumo.peixes.atual),
                apoio: `${pluralizar(resumo.peixes.perdas, 'morto encontrado', 'mortos encontrados')} ${periodo}`,
                visual: sparkline('quantidade'),
            };
        case 'fca': {
            const { geral, periodo: fcaPeriodo } = resumo.fca;
            const meta = contexto.metaFca;
            return {
                valor: formatarFca(geral),
                apoio: `FCA do período: ${formatarFca(fcaPeriodo)}`,
                selo: Number.isFinite(geral)
                    ? (geral <= meta ? { texto: 'Na meta', variante: 'sucesso' } : { texto: 'Acima da meta', variante: 'atencao' })
                    : null,
                visual: criarReguaFca({ valor: geral, meta }),
            };
        }
        case 'mortalidade': {
            const { taxa, variacaoPontos } = resumo.mortalidade;
            const limite = contexto.limitesPadrao.mortalidadeAcumuladaPct;
            return {
                valor: formatarPercentual(taxa),
                apoio: `${(variacaoPontos ?? 0) >= 0 ? '+' : '−'}${formatarNumero(Math.abs(variacaoPontos ?? 0), 1)} p.p. ${periodo}`,
                selo: { texto: `Limite ${formatarPercentual(limite)}`, variante: taxa > limite ? 'perigo' : 'info' },
                visual: criarBarraLimite({ valor: taxa ?? 0, limite }),
            };
        }
        default:
            return {
                valor: formatarRacao(resumo.racao.total),
                apoio: `Média de ${formatarRacao(resumo.racao.mediaPorDia)} por dia`,
                visual: sparkline('racaoDiaKg'),
            };
    }
}

// ---------- Gráfico principal ----------

function renderizarFiltroGrafico() {
    const opcoes = [
        { id: null, nome: 'Todos', cor: null },
        ...contexto.ativos.map(({ tanque }) => ({ id: tanque.id, nome: tanque.nome, cor: contexto.cor(tanque) })),
    ];
    porId('filtro-grafico').replaceChildren(...opcoes.map(({ id, nome, cor }) => {
        const marca = cor ? criarElemento('span', { classe: 'segmentado__cor', atributos: { 'aria-hidden': 'true' } }) : null;
        marca?.style.setProperty('--cor-serie', cor);
        return criarElemento('button', {
            classe: 'segmentado__opcao',
            atributos: { type: 'button', 'aria-pressed': String(id === estado.tanqueId), 'data-tanque': id ?? '' },
        }, [marca, nome]);
    }));
    // Com um tanque só, filtrar não muda nada.
    porId('filtro-grafico').hidden = contexto.ativos.length < 2;
}

function renderizarGrafico() {
    const chave = estado.indicador;
    const { rotulo, campo, formatar, rotuloTotal } = INDICADORES[chave];
    const selecionados = resumo.porTanque.filter(({ tanque }) => !estado.tanqueId || tanque.id === estado.tanqueId);
    const series = selecionados.map(({ tanque, serie }) => ({
        nome: tanque.nome,
        cor: contexto.cor(tanque),
        valores: serie.map((dia) => dia?.[campo] ?? null),
    }));
    const totais = resumo.totais.map((total) => total[campo]);
    porId('titulo-grafico').textContent = rotulo;

    const desenhou = desenharGraficoSeries(porId('grafico-principal'), {
        datas: resumo.datas,
        series,
        formatarValor: formatar,
        rotulo,
        hoje: contexto.hoje,
        meta: chave === 'fca' ? { valor: contexto.metaFca, rotulo: `Meta ${formatarFca(contexto.metaFca)}` } : null,
        totais: estado.tanqueId ? null : totais,
        rotuloTotal,
        maximoY: chave === 'fca' ? MAXIMO_EIXO_FCA : null,
    });
    porId('aviso-grafico-principal').hidden = desenhou;
    porId('botao-baixar-grafico').hidden = !desenhou;
    graficoAtual = { rotulo, legenda: series.map(({ nome, cor }) => ({ nome, cor })) };

    // Leitura do valor de hoje, para o número estar à vista sem passar o mouse.
    const atual = estado.tanqueId ? series[0]?.valores.at(-1) : totais.at(-1);
    const alvo = estado.tanqueId ? selecionados[0]?.tanque.nome : 'todos os tanques';
    porId('leitura-grafico').textContent = desenhou ? `${formatar(atual)} · hoje · ${alvo}` : '';
}

// ---------- Interações ----------

function configurarInteracoes() {
    // "Produção" vem aberta no computador e recolhida no celular, onde as tarefas vêm primeiro.
    porId('producao').open = window.matchMedia('(min-width: 60rem)').matches;
    porId('producao').addEventListener('toggle', () => {
        if (porId('producao').open) {
            renderizarGrafico();
        }
    });
    porId('termos-producao').replaceChildren('O que é: ',
        ...[GLOSSARIO.biomassa, GLOSSARIO.fca, GLOSSARIO.mortalidadeObservada, GLOSSARIO.pp].flatMap((termo, indice) => [indice > 0 && ' · ', criarTermo(termo)].filter(Boolean)));
    porId('botao-baixar-grafico').addEventListener('click', () => {
        const svg = porId('grafico-principal').querySelector('svg');
        exportarGraficoPng(svg, `fish-track-${criarSlug(graficoAtual.rotulo)}-${contexto.hoje}`, {
            titulo: graficoAtual.rotulo,
            subtitulo: `Fish Track · ${porId('leitura-grafico').textContent}`,
            legenda: graficoAtual.legenda,
        }).catch(mostrarErroPagina);
    });
    porId('seletor-periodo').addEventListener('click', (evento) => {
        const botao = evento.target.closest('[data-periodo]');
        if (!botao || botao.dataset.periodo === estado.periodo) {
            return;
        }
        estado.periodo = botao.dataset.periodo;
        salvarPreferencia('periodoDashboard', estado.periodo);
        calcularPeriodo();
        renderizarCabecalho();
        renderizarDestaques();
        renderizarGrafico();
    });
    porId('grade-destaques').addEventListener('click', (evento) => {
        const cartao = evento.target.closest('[data-indicador-grafico]');
        if (!cartao) {
            return;
        }
        estado.indicador = cartao.dataset.indicadorGrafico;
        for (const item of porId('grade-destaques').querySelectorAll('[data-indicador-grafico]')) {
            item.setAttribute('aria-pressed', String(item === cartao));
        }
        renderizarGrafico();
    });
    porId('filtro-grafico').addEventListener('click', (evento) => {
        const botao = evento.target.closest('[data-tanque]');
        if (botao) {
            filtrarTanque(botao.dataset.tanque || null);
        }
    });
    // Concluir um lembrete direto na lista de tarefas.
    document.querySelector('.tarefas').addEventListener('change', (evento) => {
        const caixa = evento.target.closest('[data-concluir]');
        if (!caixa) {
            return;
        }
        alternarConclusao(caixa.dataset.concluir, caixa.dataset.ocorrencia);
        renderizarTarefas();
        atualizarMenu();
        document.dispatchEvent(new CustomEvent(EVENTO_LEMBRETES));
    });
    porId('primeiros-passos').addEventListener('click', (evento) => {
        if (evento.target.closest('[data-dispensar-passos]')) {
            salvarPreferencia('primeirosPassosDispensados', true);
            porId('primeiros-passos').hidden = true;
        }
    });
    // O gráfico é desenhado na largura real: ao redimensionar a tela, desenha de novo.
    let largura = porId('grafico-principal').clientWidth;
    new ResizeObserver(() => {
        const novaLargura = porId('grafico-principal').clientWidth;
        if (novaLargura !== largura) {
            largura = novaLargura;
            renderizarGrafico();
        }
    }).observe(porId('grafico-principal'));
}

function filtrarTanque(tanqueId) {
    estado.tanqueId = tanqueId;
    for (const botao of porId('filtro-grafico').querySelectorAll('[data-tanque]')) {
        botao.setAttribute('aria-pressed', String((botao.dataset.tanque || null) === tanqueId));
    }
    renderizarGrafico();
}
