// Gráfico de linha em SVG próprio, sem bibliotecas, para funcionar offline
// (seção 11.1). As cores e espessuras vêm das classes .grafico__* do CSS.

import { diasEntre } from '../core/utils.js';
import { formatarDataCurta } from '../core/format.js';

const SVG = 'http://www.w3.org/2000/svg';
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
