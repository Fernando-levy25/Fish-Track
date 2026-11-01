// localStorage em memória, para rodar os módulos do app no Node.
// falhas.setItem(chave, valor) devolve true para simular armazenamento cheio;
// falhas.corromper(chave, valor) devolve o texto que fica gravado no lugar.
const memoria = new Map();
export const falhas = { setItem: null, corromper: null };
Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
        getItem: (chave) => (memoria.has(chave) ? memoria.get(chave) : null),
        setItem: (chave, valor) => {
            if (falhas.setItem?.(chave, valor)) {
                throw new DOMException('Cota excedida', 'QuotaExceededError');
            }
            memoria.set(chave, falhas.corromper ? falhas.corromper(chave, String(valor)) : String(valor));
        },
        removeItem: (chave) => memoria.delete(chave),
        clear: () => memoria.clear(),
        key: (indice) => [...memoria.keys()][indice] ?? null,
        get length() {
            return memoria.size;
        },
    },
});

export const RAIZ = new URL('../../js/', import.meta.url).href;
