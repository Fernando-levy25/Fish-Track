// Dashboard (seção 7.1): resumo da produção no período, cinco indicadores que
// trocam o gráfico principal, alertas filtráveis e um cartão por tanque em cultivo.

import { criarSlug, diasEntre, hojeISO, somarDias } from '../core/utils.js';
import {
    formatarDataCompleta,
    formatarFca,
    formatarGramas,
    formatarInteiro,
    formatarKg,
    formatarNumero,
    formatarPercentual,
    pluralizar,
} from '../core/format.js';
import { lerPreferencia, salvarPreferencia } from '../core/storage.js';
import { listarSituacoes, listarTanques } from '../domain/tanques.js';
import { calcularResumoPeriodo } from '../domain/indicadores.js';
import { analisarTanque, gravidadeMaisAlta, ordenarAlertas, resolverLimites, ROTULOS_GRAVIDADE } from '../domain/alertas.js';
import { obterLimitesPadrao, obterMetaFca } from '../domain/configuracoes.js';
import { exportarGraficoPng } from '../services/exportacao.js';
import { montarUrl } from '../ui/nav.js';
import {
    criarAnelProgresso,
    criarBarraCapacidade,
    criarBarraLimite,
    criarElemento,
    criarReguaFca,
    criarSelo,
    mostrarErroPagina,
    renderizarAlertas,
} from '../ui/componentes.js';
import { desenharGraficoSeries, desenharSparkline, obterCorTanque } from '../ui/graficos.js';
import { criarIcone } from '../ui/icones.js';
import { iniciarPagina, obterAcaoDoAlerta } from './comum.js';

const PERIODOS = ['7', '30', 'ciclo'];
const PERIODO_PADRAO = '30';

// Cada indicador: como aparece no cartão e qual campo da série vai para o gráfico.
const INDICADORES = {
    biomassa: { rotulo: 'Biomassa (estimada)', campo: 'biomassaKg', formatar: formatarKg, rotuloTotal: 'Total' },
    peixes: { rotulo: 'Peixes (estimado)', campo: 'quantidade', formatar: formatarInteiro, rotuloTotal: 'Total' },
    fca: { rotulo: 'FCA (estimada)', campo: 'fca', formatar: formatarFca, rotuloTotal: 'Geral' },
    mortalidade: { rotulo: 'Mortalidade observada', campo: 'taxaMortalidade', formatar: formatarPercentual, rotuloTotal: 'Geral' },
    racao: { rotulo: 'Ração consumida', campo: 'racaoDiaKg', formatar: formatarKg, rotuloTotal: 'Total' },
};
// A FCA dos primeiros dias do ciclo, com pouco ganho de peso, passa de 10:
// a escala do gráfico para em 3 para a faixa útil continuar legível.
const MAXIMO_EIXO_FCA = 3;

const porId = (id) => document.getElementById(id);
const estado = {
    periodo: PERIODOS.includes(lerPreferencia('periodoDashboard')) ? lerPreferencia('periodoDashboard') : PERIODO_PADRAO,
    indicador: 'biomassa',
    tanqueId: null,
    gravidade: null,
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
        .map((situacao) => ({ ...situacao, ...analisarTanque(situacao, { limitesPadrao, hoje }) }));
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
    renderizarDestaques();
    renderizarFiltroGrafico();
    renderizarGrafico();
    renderizarAlertasDoPainel();
    renderizarTanques();
}

// ---------- Cabeçalho ----------

function renderizarCabecalho() {
    const { hoje, ativos, todos, alertas } = contexto;
    porId('data-hoje').textContent = formatarDataCompleta(hoje);
    const partes = [`${pluralizar(ativos.length, 'tanque em cultivo', 'tanques em cultivo')}, de ${pluralizar(todos.length, 'cadastrado', 'cadastrados')}`];
    partes.push(alertas.length > 0 ? pluralizar(alertas.length, 'alerta pede atenção', 'alertas pedem atenção') : 'nenhum alerta');
    porId('resumo-producao').textContent = partes.join(' · ');
    for (const botao of porId('seletor-periodo').querySelectorAll('[data-periodo]')) {
        botao.setAttribute('aria-pressed', String(botao.dataset.periodo === estado.periodo));
    }
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
        criarElemento('span', { classe: 'destaque__valor', texto: valor }),
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
                valor: formatarKg(atual),
                apoio: `${variacao >= 0 ? '▲' : '▼'} ${formatarKg(Math.abs(variacao))} ${periodo}`,
                selo: Number.isFinite(percentual)
                    ? { texto: `${percentual >= 0 ? '+' : '−'}${formatarNumero(Math.abs(percentual), 0)}%`, variante: percentual >= 0 ? 'sucesso' : 'perigo' }
                    : null,
                visual: sparkline('biomassaKg'),
            };
        }
        case 'peixes':
            return {
                valor: formatarInteiro(resumo.peixes.atual),
                apoio: `${pluralizar(resumo.peixes.perdas, 'perda', 'perdas')} ${periodo}`,
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
                valor: formatarKg(resumo.racao.total),
                apoio: `Média de ${formatarKg(resumo.racao.mediaPorDia)} por dia`,
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

// ---------- Alertas ----------

function renderizarAlertasDoPainel() {
    const { alertas } = contexto;
    const contagem = (gravidade) => alertas.filter((alerta) => alerta.gravidade === gravidade).length;
    const chips = [
        { gravidade: null, texto: `Todos · ${alertas.length}` },
        ...Object.entries(ROTULOS_GRAVIDADE).map(([gravidade, nome]) => ({ gravidade, texto: `${nome} · ${contagem(gravidade)}` })),
    ];
    porId('filtro-alertas').replaceChildren(...chips.map(({ gravidade, texto }) => criarElemento('button', {
        classe: gravidade ? `chip chip--${gravidade}` : 'chip',
        texto,
        atributos: { type: 'button', 'aria-pressed': String(gravidade === estado.gravidade), 'data-gravidade': gravidade ?? '' },
    })));
    renderizarAlertas(porId('lista-alertas'), alertas.filter((alerta) => !estado.gravidade || alerta.gravidade === estado.gravidade), {
        mostrarTanque: true,
        hrefTanque: (alerta) => montarUrl('tanque.html', { id: alerta.tanqueId }),
        obterAcao: obterAcaoDoAlerta,
        textoVazio: estado.gravidade ? 'Nenhum alerta com essa gravidade.' : 'Nenhum alerta no momento.',
    });
}

// ---------- Tanques em cultivo ----------

function renderizarTanques() {
    const { ativos, situacoes } = contexto;
    const cartoes = ativos.map(criarCartaoCultivo);
    const semCiclo = situacoes.filter((situacao) => !situacao.cicloAtivo);
    if (semCiclo.length > 0) {
        cartoes.push(criarCartaoSemCiclo(semCiclo));
    }
    if (cartoes.length === 0) {
        cartoes.push(criarElemento('p', { classe: 'grade-tanques__vazio' }, [
            'Nenhum tanque cadastrado ainda. ',
            criarElemento('a', { classe: 'link', texto: 'Cadastrar o primeiro tanque', atributos: { href: 'tanque-form.html' } }),
            ' ou ',
            criarElemento('a', { classe: 'link', texto: 'carregar dados de exemplo', atributos: { href: 'configuracoes.html' } }),
            '.',
        ]));
    }
    porId('grade-tanques').replaceChildren(...cartoes);
}

function criarCartaoCultivo({ tanque, cicloAtivo, indicadores, alertas, ultimoRegistro }) {
    const { hoje, limitesPadrao } = contexto;
    const limites = resolverLimites(limitesPadrao, tanque.limitesAlerta);
    const gravidade = gravidadeMaisAlta(alertas);
    const selo = gravidade
        ? criarSelo(`Alerta ${{ alta: 'alto', media: 'médio', baixa: 'baixo' }[gravidade]}`, `alerta-${gravidade}`)
        : criarSelo('Sem alertas', 'sem-alerta');

    const peso = indicadores.pesoMedioG;
    const alvo = cicloAtivo.pesoAlvoG;
    const anel = alvo
        ? criarAnelProgresso({
            percentual: (peso / alvo) * 100,
            valor: formatarGramas(peso),
            apoio: `de ${formatarGramas(alvo)}`,
            descricao: `Peso médio de ${formatarGramas(peso)}, de um alvo de ${formatarGramas(alvo)}`,
        })
        : criarAnelProgresso({ valor: formatarGramas(peso), apoio: 'sem alvo', descricao: `Peso médio de ${formatarGramas(peso)}` });

    const diasParaDespesca = cicloAtivo.dataPrevistaDespesca ? diasEntre(hoje, cicloAtivo.dataPrevistaDespesca) : null;
    let despesca = '—';
    if (diasParaDespesca !== null) {
        despesca = diasParaDespesca >= 0 ? `em ${diasParaDespesca} d` : `atrasada ${-diasParaDespesca} d`;
    }

    const selecionado = estado.tanqueId === tanque.id;
    const cartao = criarElemento('article', { classe: 'cartao-cultivo', atributos: { 'data-tanque': tanque.id } }, [
        criarElemento('div', { classe: 'cartao-cultivo__cabecalho' }, [
            criarElemento('div', {}, [
                criarElemento('h3', { classe: 'cartao-cultivo__nome', texto: tanque.nome }),
                criarElemento('p', { classe: 'cartao-cultivo__especie', texto: `${tanque.especie} · ${pluralizar(indicadores.diasCultivo, 'dia', 'dias')} de cultivo` }),
            ]),
            selo,
        ]),
        criarElemento('div', { classe: 'cartao-cultivo__corpo' }, [
            anel,
            criarElemento('dl', { classe: 'cartao-cultivo__dados' }, [
                ['Peixes (estimado)', formatarInteiro(indicadores.quantidade)],
                ['Biomassa (estimada)', formatarKg(indicadores.biomassaKg)],
                ['FCA (estimada)', formatarFca(indicadores.fca)],
                ['Despesca', despesca],
            ].map(([rotulo, valor]) => criarElemento('div', { classe: 'cartao-cultivo__dado' }, [
                criarElemento('dt', { texto: rotulo }),
                criarElemento('dd', { texto: valor }),
            ]))),
        ]),
        criarBarraCapacidade({
            percentual: indicadores.capacidadeUtilizada,
            cargaKg: indicadores.biomassaKg,
            cargaMaximaKg: indicadores.cargaMaximaKg,
            limiteAlerta: limites.capacidadePct,
            compacta: true,
            hrefDefinir: montarUrl('tanque-form.html', { id: tanque.id }),
        }),
        criarAvisoRegistro(ultimoRegistro?.data ?? null, cicloAtivo.dataInicio, limites.diasSemRegistro),
        criarElemento('div', { classe: 'cartao-cultivo__acoes' }, [
            criarElemento('a', {
                classe: 'botao botao--primario botao--pequeno',
                atributos: { href: montarUrl('registro.html', { tanqueId: tanque.id }), 'aria-label': `Novo registro: ${tanque.nome}` },
            }, [criarIcone('mais', { classe: 'icone icone--girar' }), 'Registro']),
            criarElemento('button', {
                classe: 'botao botao--secundario botao--pequeno',
                texto: selecionado ? 'Mostrando no gráfico' : 'Ver no gráfico',
                atributos: { type: 'button', 'aria-pressed': String(selecionado), 'data-ver-grafico': tanque.id },
            }),
            criarElemento('a', {
                classe: 'link',
                texto: 'Abrir',
                atributos: { href: montarUrl('tanque.html', { id: tanque.id }), 'aria-label': `Abrir ${tanque.nome}` },
            }),
        ]),
    ]);
    cartao.style.setProperty('--cor-tanque', contexto.cor(tanque));
    return cartao;
}

function criarAvisoRegistro(dataUltimo, dataInicio, limiteDias) {
    const dias = diasEntre(dataUltimo ?? dataInicio, contexto.hoje);
    let texto;
    if (!dataUltimo) {
        texto = dias === 0 ? 'Povoado hoje, sem registros ainda' : `Sem registro desde o povoamento, há ${pluralizar(dias, 'dia', 'dias')}`;
    } else if (dias === 0) {
        texto = 'Último registro hoje';
    } else if (dias === 1) {
        texto = 'Último registro ontem';
    } else {
        texto = dias > limiteDias ? `Sem registro há ${dias} dias` : `Último registro há ${dias} dias`;
    }
    let situacao = 'normal';
    if (dias > limiteDias) {
        situacao = 'atrasado';
    } else if (dias === 0 && dataUltimo) {
        situacao = 'em-dia';
    }
    return criarElemento('p', { classe: `cartao-cultivo__registro cartao-cultivo__registro--${situacao}`, texto });
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
        acao = { texto: 'Iniciar ciclo', href: montarUrl('ciclo-form.html', { tanqueId: vazios[0].tanque.id, acao: 'iniciar' }) };
    } else if (vazios.length > 1) {
        acao = { texto: 'Iniciar ciclo', href: montarUrl('tanques.html', { status: 'vazio' }) };
    }
    return criarElemento('article', { classe: 'cartao-cultivo cartao-cultivo--sem-ciclo' }, [
        criarElemento('p', { classe: 'cartao-cultivo__nome', texto: pluralizar(semCiclo.length, 'tanque sem ciclo', 'tanques sem ciclo') }),
        criarElemento('p', { classe: 'cartao-cultivo__especie', texto: detalhes.join(' e ') }),
        criarElemento('a', { classe: 'botao botao--secundario botao--pequeno', texto: acao.texto, atributos: { href: acao.href } }),
    ]);
}

// ---------- Interações ----------

function configurarInteracoes() {
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
    porId('grade-tanques').addEventListener('click', (evento) => {
        const botao = evento.target.closest('[data-ver-grafico]');
        if (!botao) {
            return;
        }
        // Clicar de novo no tanque que já está no gráfico volta para "Todos".
        filtrarTanque(estado.tanqueId === botao.dataset.verGrafico ? null : botao.dataset.verGrafico);
        const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        porId('grafico-principal').scrollIntoView({ behavior: reduzirMovimento ? 'auto' : 'smooth', block: 'center' });
    });
    porId('filtro-alertas').addEventListener('click', (evento) => {
        const chip = evento.target.closest('[data-gravidade]');
        if (chip) {
            estado.gravidade = chip.dataset.gravidade || null;
            renderizarAlertasDoPainel();
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
    for (const botao of porId('grade-tanques').querySelectorAll('[data-ver-grafico]')) {
        const ativo = botao.dataset.verGrafico === tanqueId;
        botao.setAttribute('aria-pressed', String(ativo));
        botao.textContent = ativo ? 'Mostrando no gráfico' : 'Ver no gráfico';
    }
    renderizarGrafico();
}
