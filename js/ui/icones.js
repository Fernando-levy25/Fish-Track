// Ícones em traço (seção 3.1), desenhados em SVG próprio para funcionar
// offline. Usam a cor do texto (currentColor) e são sempre decorativos: o
// significado vai no texto ao lado.

const SVG = 'http://www.w3.org/2000/svg';

// Cada ícone é uma lista de elementos SVG numa grade de 24 × 24.
const ICONES = {
    alerta: [
        ['path', { d: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z' }],
        ['path', { d: 'M12 9v4M12 17h.01' }],
    ],
    tendencia: [['path', { d: 'm22 17-8.5-8.5-5 5L2 7' }], ['path', { d: 'M16 17h6v-6' }]],
    racao: [['path', { d: 'M3 11h18a9 9 0 0 1-18 0Z' }], ['path', { d: 'M8 7c.6-1.5 1.9-1.5 2.5 0M13.5 6c.6-1.5 1.9-1.5 2.5 0' }]],
    medidor: [['path', { d: 'M3.3 19a10 10 0 1 1 17.4 0' }], ['path', { d: 'm12 14 4-4' }]],
    balanca: [['path', { d: 'M6.5 8h11l2 12h-15Z' }], ['circle', { cx: 12, cy: 5, r: 2 }]],
    relogio: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 7v5l3 2' }]],
    mais: [['path', { d: 'M12 5v14M5 12h14' }]],
    grafico: [['path', { d: 'M3 3v18h18' }], ['path', { d: 'm7 15 4-4 3 3 6-6' }]],
    abrir: [['path', { d: 'M7 17 17 7M9 7h8v8' }]],
    download: [['path', { d: 'M12 3v12M7 10l5 5 5-5M5 21h14' }]],
    sino: [['path', { d: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9' }], ['path', { d: 'M10.3 21a1.9 1.9 0 0 0 3.4 0' }]],
    check: [['path', { d: 'M20 6 9 17l-5-5' }]],
};

export function criarIcone(nome, { classe = 'icone' } = {}) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', classe);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    for (const [tag, atributos] of ICONES[nome] ?? []) {
        const elemento = document.createElementNS(SVG, tag);
        for (const [atributo, valor] of Object.entries(atributos)) {
            elemento.setAttribute(atributo, valor);
        }
        svg.append(elemento);
    }
    return svg;
}
