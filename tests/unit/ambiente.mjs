// localStorage em memória, para rodar os módulos do app no Node.
const memoria = new Map();
Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
        getItem: (chave) => (memoria.has(chave) ? memoria.get(chave) : null),
        setItem: (chave, valor) => memoria.set(chave, String(valor)),
        removeItem: (chave) => memoria.delete(chave),
        clear: () => memoria.clear(),
    },
});

export const RAIZ = new URL('../../js/', import.meta.url).href;
