// Testes de estrutura do código, sem navegador.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const PASTA_PAGINAS = new URL('../../js/pages/', import.meta.url);

describe('js/pages', () => {
    // As páginas chamam iniciarPagina() e iniciar() no topo do módulo. Um let ou
    // const do módulo declarado depois dessa chamada ainda não existe quando o
    // código roda ("Cannot access ... before initialization").
    it('não declaram variáveis do módulo depois de começar a montar a página', () => {
        for (const arquivo of readdirSync(PASTA_PAGINAS).filter((nome) => nome.endsWith('.js'))) {
            const linhas = readFileSync(new URL(arquivo, PASTA_PAGINAS), 'utf8').split('\n');
            const inicio = linhas.findIndex((linha) => linha.startsWith('iniciarPagina()'));
            if (inicio === -1) {
                continue;
            }
            const tardias = linhas
                .map((linha, indice) => ({ linha, numero: indice + 1 }))
                .filter(({ linha, numero }) => numero - 1 > inicio && /^(let|const) /.test(linha));
            assert.deepEqual(tardias, [], `${arquivo}: declare no topo, antes de iniciarPagina()`);
        }
    });
});
