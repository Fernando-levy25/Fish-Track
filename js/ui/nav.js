// Navegação comum: parâmetros e montagem de endereços, o menu "Mais" e o
// registro do service worker, que fica aqui porque este módulo roda em todas
// as páginas.

export function lerParametro(nome) {
    return new URLSearchParams(window.location.search).get(nome);
}

export function montarUrl(pagina, parametros = {}, ancora = '') {
    const busca = new URLSearchParams();
    for (const [nome, valor] of Object.entries(parametros)) {
        if (valor !== null && valor !== undefined && valor !== '') {
            busca.set(nome, valor);
        }
    }
    const consulta = busca.toString();
    return `${pagina}${consulta ? `?${consulta}` : ''}${ancora ? `#${ancora}` : ''}`;
}

export function irPara(url) {
    window.location.assign(url);
}

export function iniciarNavegacao() {
    iniciarMenuMais();
    registrarServiceWorker();
}

// O "Mais" só existe na barra do celular, como um painel sobre a página:
// fecha ao tocar fora ou com Esc. No desktop todos os destinos ficam à vista.
function iniciarMenuMais() {
    const mais = document.getElementById('menu-mais');
    if (!mais) {
        return;
    }
    document.addEventListener('click', (evento) => {
        if (mais.open && !mais.contains(evento.target)) {
            mais.open = false;
        }
    });
    document.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape' && mais.open) {
            mais.open = false;
            mais.querySelector('summary').focus();
        }
    });
}

function registrarServiceWorker() {
    // O service worker só funciona em contexto seguro (https ou localhost).
    // Fora dele o app continua funcionando, só sem o modo offline.
    if (!('serviceWorker' in navigator) || !window.isSecureContext) {
        return;
    }
    navigator.serviceWorker.register('sw.js').catch((erro) => {
        console.warn('Service worker não registrado; o app segue sem modo offline.', erro);
    });
}
