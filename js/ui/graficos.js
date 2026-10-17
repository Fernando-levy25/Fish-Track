// Gráfico de linha em SVG próprio, sem bibliotecas, para funcionar offline
// (seção 11.1). As cores e espessuras vêm das classes .grafico__* do CSS.

import { diasEntre } from '../core/utils.js';
import { formatarDataCurta } from '../core/format.js';

const SVG = 'http://www.w3.org/2000/svg';

// Cor fixa de cada tanque nos gráficos (seção 2.1). As cores diferem também em
// claridade, não só no tom, para continuarem distinguíveis para quem não
// enxerga bem as cores.
export const CORES_TANQUES = ['#0e5a52', '#c47f12', '#3f68a8', '#7a4fa0', '#2f8f6b', '#b5523b'];

// A cor segue a ordem de criação do tanque entre todos os tanques, para não
// mudar quando a lista é filtrada ou ordenada por nome.
export function obterCorTanque(tanque, tanques) {
    const porCriacao = [...tanques].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
    const indice = Math.max(porCriacao.findIndex((item) => item.id === tanque.id), 0);
    return CORES_TANQUES[indice % CORES_TANQUES.length];
}

const LARGURA = 320;
const ALTURA = 168;
const AREA = { esquerda: 4, direita: 316, topo: 20, base: 144 };
// Com mais pontos que isso, os marcadores viram ruído: só o último aparece.
const MAXIMO_MARCADORES = 31;

function criarSvg(tag, atributos = {}, texto) {
    const elemento = document.createElementNS(SVG, tag);
    for (const [nome, valor] of Object.entries(atributos)) {
        elemento.setAttribute(nome, valor);
    }
    if (texto !== undefined) {
        elemento.textContent = texto;
    }
    return elemento;
}

// pontos: [{ data: "AAAA-MM-DD", valor }] em ordem de data. O eixo x é
// proporcional ao tempo, então pesagens espaçadas aparecem espaçadas.
// Devolve false quando não há dados para uma linha (menos de duas datas).
export function desenharGraficoLinha(container, pontos, { formatarValor, rotulo }) {
    container.replaceChildren();
    const primeiro = pontos[0]?.data;
    const ultimo = pontos.at(-1)?.data;
    if (pontos.length < 2 || diasEntre(primeiro, ultimo) <= 0) {
        return false;
    }

    const totalDias = diasEntre(primeiro, ultimo);
    const maximo = Math.max(...pontos.map((ponto) => ponto.valor));
    // Folga acima do maior valor, para a linha não encostar no rótulo do topo.
    const topoEscala = maximo > 0 ? maximo * 1.15 : 1;
    const x = (data) => AREA.esquerda + (diasEntre(primeiro, data) / totalDias) * (AREA.direita - AREA.esquerda);
    const y = (valor) => AREA.base - (valor / topoEscala) * (AREA.base - AREA.topo);
    const coordenadas = pontos.map((ponto) => [x(ponto.data), y(ponto.valor)]);
    const emTexto = (lista) => lista.map(([cx, cy]) => `${cx.toFixed(1)},${cy.toFixed(1)}`).join(' ');

    const svg = criarSvg('svg', {
        viewBox: `0 0 ${LARGURA} ${ALTURA}`,
        role: 'img',
        'aria-label': `${rotulo}: de ${formatarValor(pontos[0].valor)} em ${formatarDataCurta(primeiro)} `
            + `a ${formatarValor(pontos.at(-1).valor)} em ${formatarDataCurta(ultimo)}`,
    });

    svg.append(criarSvg('line', { class: 'grafico__grade', x1: 0, x2: LARGURA, y1: AREA.base, y2: AREA.base }));
    if (maximo > 0) {
        for (const valor of [maximo, maximo / 2]) {
            svg.append(
                criarSvg('line', { class: 'grafico__grade', x1: 0, x2: LARGURA, y1: y(valor), y2: y(valor) }),
                criarSvg('text', { class: 'grafico__rotulo', x: AREA.esquerda, y: y(valor) - 4 }, formatarValor(valor)),
            );
        }
    }

    const [inicioX] = coordenadas[0];
    const [fimX] = coordenadas.at(-1);
    svg.append(
        criarSvg('path', { class: 'grafico__area', d: `M${inicioX},${AREA.base} L${emTexto(coordenadas).replaceAll(' ', ' L')} L${fimX},${AREA.base} Z` }),
        criarSvg('polyline', { class: 'grafico__linha', points: emTexto(coordenadas) }),
    );

    const marcados = pontos.length <= MAXIMO_MARCADORES ? pontos.map((_, indice) => indice) : [pontos.length - 1];
    for (const indice of marcados) {
        const [cx, cy] = coordenadas[indice];
        const ponto = criarSvg('circle', { class: 'grafico__ponto', cx: cx.toFixed(1), cy: cy.toFixed(1), r: 3.5 });
        ponto.append(criarSvg('title', {}, `${formatarDataCurta(pontos[indice].data)}: ${formatarValor(pontos[indice].valor)}`));
        svg.append(ponto);
    }

    svg.append(
        criarSvg('text', { class: 'grafico__rotulo', x: AREA.esquerda, y: ALTURA - 6 }, formatarDataCurta(primeiro)),
        criarSvg('text', { class: 'grafico__rotulo', x: AREA.direita, y: ALTURA - 6, 'text-anchor': 'end' }, formatarDataCurta(ultimo)),
    );
    container.append(svg);
    return true;
}

// ---------- Gráfico principal do dashboard (seção 3.4) ----------

// Uma linha por tanque, eixos, linha de meta e tooltip. O SVG é desenhado na
// largura real do contêiner (a página redesenha ao redimensionar), para os
// textos não encolherem no celular.
//   datas: ["AAAA-MM-DD"]; series: [{ nome, cor, valores: [número | null] }];
//   totais: [número | null] por data, mostrados no tooltip com rotuloTotal.
export function desenharGraficoSeries(container, {
    datas,
    series,
    formatarValor,
    rotulo,
    hoje,
    meta = null,
    totais = null,
    rotuloTotal = 'Total',
    maximoY = null,
}) {
    container.replaceChildren();
    const valores = series.flatMap((serie) => serie.valores).filter(Number.isFinite);
    if (datas.length < 2 || valores.length === 0) {
        return false;
    }
    const largura = Math.max(container.clientWidth, 280);
    const altura = largura < 520 ? 220 : 280;
    const margem = { esquerda: 56, direita: 14, topo: 16, base: 30 };
    const larguraUtil = largura - margem.esquerda - margem.direita;
    const alturaUtil = altura - margem.topo - margem.base;

    // Escala de 0 a um valor "redondo" acima do maior ponto (ou da meta). Para
    // a FCA, os primeiros dias do ciclo dão valores enormes: maximoY corta a escala.
    const maior = Math.max(...valores, meta?.valor ?? 0);
    const topo = arredondarParaCima(maximoY ? Math.min(maior, maximoY) : maior) || 1;
    const x = (indice) => margem.esquerda + (indice / (datas.length - 1)) * larguraUtil;
    const y = (valor) => margem.topo + alturaUtil - (Math.min(valor, topo) / topo) * alturaUtil;

    const svg = criarSvg('svg', {
        class: 'grafico-series',
        viewBox: `0 0 ${largura} ${altura}`,
        width: largura,
        height: altura,
        role: 'img',
        tabindex: '0',
        'aria-label': `${rotulo}, de ${formatarDataCurta(datas[0])} a ${formatarDataCurta(datas.at(-1))}. Use as setas para ler cada dia.`,
    });

    // Eixo Y com 4 marcas e eixo X com 5 datas; a última é "Hoje".
    for (let marca = 0; marca <= 3; marca += 1) {
        const valor = (topo / 3) * marca;
        svg.append(
            criarSvg('line', { class: 'grafico__grade', x1: margem.esquerda, x2: largura - margem.direita, y1: y(valor), y2: y(valor) }),
            criarSvg('text', { class: 'grafico__rotulo', x: margem.esquerda - 8, y: y(valor) + 4, 'text-anchor': 'end' }, formatarValor(valor)),
        );
    }
    for (let marca = 0; marca <= 4; marca += 1) {
        const indice = Math.round((marca / 4) * (datas.length - 1));
        const ancora = marca === 0 ? 'start' : marca === 4 ? 'end' : 'middle';
        const texto = datas[indice] === hoje ? 'Hoje' : formatarDataCurta(datas[indice]);
        svg.append(criarSvg('text', { class: 'grafico__rotulo', x: x(indice), y: altura - 8, 'text-anchor': ancora }, texto));
    }

    if (meta) {
        svg.append(
            criarSvg('line', { class: 'grafico__meta', x1: margem.esquerda, x2: largura - margem.direita, y1: y(meta.valor), y2: y(meta.valor) }),
            criarSvg('text', { class: 'grafico__rotulo grafico__rotulo--meta', x: largura - margem.direita, y: y(meta.valor) - 6, 'text-anchor': 'end' }, meta.rotulo),
        );
    }

    const linhas = criarSvg('g', { class: 'grafico__series' });
    for (const serie of series) {
        const caminho = montarCaminho(serie.valores, x, y);
        // Com um tanque só, a área preenchida ajuda a ler o volume.
        if (series.length === 1) {
            linhas.append(criarSvg('path', { class: 'grafico__area-serie', d: montarArea(serie.valores, x, y, y(0)), fill: serie.cor }));
        }
        linhas.append(criarSvg('path', { class: 'grafico__linha-serie', d: caminho, stroke: serie.cor }));
    }
    svg.append(linhas);

    const guia = criarSvg('line', { class: 'grafico__guia', y1: margem.topo, y2: margem.topo + alturaUtil, visibility: 'hidden' });
    const marcadores = criarSvg('g', { visibility: 'hidden' });
    const captura = criarSvg('rect', { class: 'grafico__captura', x: margem.esquerda, y: margem.topo, width: larguraUtil, height: alturaUtil });
    svg.append(guia, marcadores, captura);

    const dica = document.createElement('div');
    dica.className = 'grafico-dica';
    dica.setAttribute('aria-hidden', 'true');
    container.append(svg, dica);

    let indiceAtual = datas.length - 1;
    const mostrar = (indice) => {
        indiceAtual = indice;
        const posicao = x(indice);
        guia.setAttribute('x1', posicao);
        guia.setAttribute('x2', posicao);
        guia.setAttribute('visibility', 'visible');
        marcadores.replaceChildren(...series
            .filter((serie) => Number.isFinite(serie.valores[indice]))
            .map((serie) => criarSvg('circle', { class: 'grafico__marcador', cx: posicao, cy: y(serie.valores[indice]), r: 4, stroke: serie.cor })));
        marcadores.setAttribute('visibility', 'visible');
        preencherDica(dica, { data: datas[indice], series, indice, formatarValor, total: totais?.[indice], rotuloTotal, hoje });
        // A dica fica do lado com mais espaço, para não sair do gráfico.
        const aDireita = posicao < largura / 2;
        dica.style.left = aDireita ? `${posicao + 12}px` : '';
        dica.style.right = aDireita ? '' : `${largura - posicao + 12}px`;
        dica.classList.add('grafico-dica--visivel');
    };
    const esconder = () => {
        guia.setAttribute('visibility', 'hidden');
        marcadores.setAttribute('visibility', 'hidden');
        dica.classList.remove('grafico-dica--visivel');
    };
    captura.addEventListener('pointermove', (evento) => {
        const caixa = svg.getBoundingClientRect();
        const proporcao = (evento.clientX - caixa.left - margem.esquerda) / larguraUtil;
        mostrar(Math.min(Math.max(Math.round(proporcao * (datas.length - 1)), 0), datas.length - 1));
    });
    captura.addEventListener('pointerleave', esconder);
    // Pelo teclado: as setas percorrem os dias, como o mouse.
    svg.addEventListener('focus', () => mostrar(indiceAtual));
    svg.addEventListener('blur', esconder);
    svg.addEventListener('keydown', (evento) => {
        const passo = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity }[evento.key];
        if (passo === undefined) {
            return;
        }
        evento.preventDefault();
        mostrar(Math.min(Math.max(indiceAtual + passo, 0), datas.length - 1));
    });
    return true;
}

function preencherDica(dica, { data, series, indice, formatarValor, total, rotuloTotal, hoje }) {
    const linha = (rotulo, valor, cor) => {
        const item = document.createElement('div');
        item.className = 'grafico-dica__linha';
        const nome = document.createElement('span');
        nome.className = 'grafico-dica__nome';
        if (cor) {
            nome.style.setProperty('--cor-serie', cor);
        }
        nome.textContent = rotulo;
        const numero = document.createElement('span');
        numero.className = 'grafico-dica__valor';
        numero.textContent = valor;
        item.append(nome, numero);
        return item;
    };
    const titulo = document.createElement('div');
    titulo.className = 'grafico-dica__data';
    titulo.textContent = data === hoje ? `Hoje, ${formatarDataCurta(data)}` : formatarDataCurta(data);
    dica.replaceChildren(
        titulo,
        ...series
            .filter((serie) => Number.isFinite(serie.valores[indice]))
            .map((serie) => linha(serie.nome, formatarValor(serie.valores[indice]), serie.cor)),
        ...(series.length > 1 && Number.isFinite(total) ? [linha(rotuloTotal, formatarValor(total))] : []),
    );
}

// Linha com falhas: começa de novo depois de um dia sem valor (tanque ainda não povoado).
function montarCaminho(valores, x, y) {
    let anteriorValido = false;
    return valores.map((valor, indice) => {
        if (!Number.isFinite(valor)) {
            anteriorValido = false;
            return '';
        }
        const comando = anteriorValido ? 'L' : 'M';
        anteriorValido = true;
        return `${comando}${x(indice).toFixed(1)},${y(valor).toFixed(1)}`;
    }).join('');
}

function montarArea(valores, x, y, base) {
    const indices = valores.map((valor, indice) => (Number.isFinite(valor) ? indice : null)).filter((indice) => indice !== null);
    if (indices.length < 2) {
        return '';
    }
    const pontos = indices.map((indice) => `L${x(indice).toFixed(1)},${y(valores[indice]).toFixed(1)}`).join('');
    return `M${x(indices[0]).toFixed(1)},${base}${pontos}L${x(indices.at(-1)).toFixed(1)},${base}Z`;
}

// 1, 2, 2,5 ou 5 vezes uma potência de 10: marcas de eixo fáceis de ler.
function arredondarParaCima(valor) {
    if (!(valor > 0)) {
        return 0;
    }
    const escala = 10 ** Math.floor(Math.log10(valor));
    const passo = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((fator) => fator * escala >= valor * 1.05) ?? 10;
    return passo * escala;
}

// ---------- Minigráfico (sparkline) ----------

// Linha simples do período dentro de um cartão. Decorativo: o cartão já diz o número.
export function desenharSparkline(container, valores, { cor = 'currentColor' } = {}) {
    container.replaceChildren();
    const pontos = valores.map((valor, indice) => [indice, valor]).filter(([, valor]) => Number.isFinite(valor));
    if (pontos.length < 2) {
        return;
    }
    const menor = Math.min(...pontos.map(([, valor]) => valor));
    const maior = Math.max(...pontos.map(([, valor]) => valor));
    const faixa = maior - menor || 1;
    const x = (indice) => (indice / (valores.length - 1)) * 100;
    const y = (valor) => 28 - ((valor - menor) / faixa) * 24;
    const linha = pontos.map(([indice, valor]) => `${x(indice).toFixed(2)},${y(valor).toFixed(2)}`).join(' ');
    const svg = criarSvg('svg', { class: 'sparkline', viewBox: '0 0 100 32', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    svg.append(
        criarSvg('polygon', { class: 'sparkline__area', points: `${x(pontos[0][0])},32 ${linha} ${x(pontos.at(-1)[0])},32`, fill: cor }),
        criarSvg('polyline', { class: 'sparkline__linha', points: linha, stroke: cor }),
    );
    container.append(svg);
}
