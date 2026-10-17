// Service worker: guarda os arquivos do app para que ele abra sem internet
// (seções 4 e 5.1). Estratégia "rede primeiro": com internet, busca sempre a
// versão mais nova e atualiza a cópia; sem internet, usa a cópia guardada.
// Os dados do produtor ficam no localStorage e não passam por aqui.

// Ao mudar a lista de arquivos, troque a versão para descartar o cache antigo.
const VERSAO_CACHE = 'fish-track-v5';
const ARQUIVOS = [
    './',
    'index.html',
    'tanques.html',
    'tanque.html',
    'tanque-form.html',
    'ciclo-form.html',
    'registro.html',
    'relatorio.html',
    'alertas.html',
    'calendario.html',
    'configuracoes.html',
    'manifest.json',
    'css/base.css',
    'css/layout.css',
    'css/components.css',
    'css/pages/relatorio.css',
    'js/core/storage.js',
    'js/core/utils.js',
    'js/core/format.js',
    'js/domain/tanques.js',
    'js/domain/ciclos.js',
    'js/domain/registros.js',
    'js/domain/indicadores.js',
    'js/domain/lembretes.js',
    'js/domain/alertas.js',
    'js/domain/configuracoes.js',
    'js/domain/validacao.js',
    'js/ui/nav.js',
    'js/ui/componentes.js',
    'js/ui/graficos.js',
    'js/ui/calendario.js',
    'js/ui/icones.js',
    'js/services/exportacao.js',
    'js/services/seed.js',
    'js/pages/agenda.js',
    'js/pages/comum.js',
    'js/pages/dashboard.js',
    'js/pages/tanques.js',
    'js/pages/tanque.js',
    'js/pages/tanque-form.js',
    'js/pages/ciclo-form.js',
    'js/pages/registro.js',
    'js/pages/relatorio.js',
    'js/pages/alertas.js',
    'js/pages/calendario.js',
    'js/pages/configuracoes.js',
    'assets/icons/icone.svg',
    'assets/icons/icone-192.png',
    'assets/icons/icone-512.png',
    'assets/fonts/figtree.woff2',
    'assets/fonts/bricolage-grotesque.woff2',
];

self.addEventListener('install', (evento) => {
    evento.waitUntil(
        caches.open(VERSAO_CACHE)
            .then((cache) => cache.addAll(ARQUIVOS))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (evento) => {
    evento.waitUntil(
        caches.keys()
            .then((chaves) => Promise.all(chaves.filter((chave) => chave !== VERSAO_CACHE).map((chave) => caches.delete(chave))))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (evento) => {
    const { request } = evento;
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
        return;
    }
    evento.respondWith(buscarComCopia(request));
});

async function buscarComCopia(request) {
    const cache = await caches.open(VERSAO_CACHE);
    // Páginas como tanque.html?id=... são o mesmo arquivo: guarda uma cópia só, sem os parâmetros.
    const chave = request.mode === 'navigate' ? new URL(request.url).pathname : request;
    try {
        const resposta = await fetch(request);
        if (resposta.ok) {
            await cache.put(chave, resposta.clone());
        }
        return resposta;
    } catch {
        const copia = await cache.match(chave, { ignoreSearch: true });
        return copia ?? Response.error();
    }
}
