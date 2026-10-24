// Planos de alimentação (seção 9.10; "tabela de arraçoamento" no termo técnico):
// a taxa, em % da biomassa por dia, e o número de refeições, fixos ou por faixa de peso. Ficam em
// config.tabelasArracoamento; cada tanque escolhe a sua (tanque.tabelaArracoamentoId).

import { lerDados, salvarDados } from '../core/storage.js';
import { gerarId, limparTexto } from '../core/utils.js';
import { formatarNumero } from '../core/format.js';
import { falharRegra, lancarSeHouverErros, validarNumero, validarTexto } from './validacao.js';

const TAMANHO_MAXIMO_NOME = 80;

// Exemplo para começar, com a fonte no nome: a taxa depende da espécie, da
// ração e da temperatura, então o produtor deve usar a do fabricante ou do técnico.
export const MODELO_EMBRAPA = Object.freeze({
    nome: 'Modelo Embrapa — tilápia em tanque-rede, ração 32% PB (190 a 1.045 g)',
    aviso: 'Este modelo vale para tilápia de 190 g a 1 kg com ração de 32% de proteína. A porcentagem certa depende da espécie, '
        + 'da ração e da temperatura da água: confira com o fabricante da ração ou com o seu técnico.',
    faixas: [
        [190, 225, 3.4], [225, 265, 3.2], [265, 305, 3.0], [305, 345, 2.8], [345, 385, 2.6],
        [385, 430, 2.4], [430, 475, 2.2], [475, 520, 2.0], [520, 565, 1.9], [565, 620, 1.8],
        [620, 680, 1.7], [680, 740, 1.6], [740, 805, 1.5], [805, 870, 1.4], [870, 930, 1.3],
        [930, 990, 1.3], [990, 1045, 1.2],
    ].map(([pesoDeG, pesoAteG, taxaPct]) => Object.freeze({ pesoDeG, pesoAteG, taxaPct, refeicoes: 4 })),
});

export function listarTabelas() {
    return lerDados().config.tabelasArracoamento;
}

export function obterTabela(id) {
    return id ? listarTabelas().find((tabela) => tabela.id === id) ?? null : null;
}

// entrada: { id?, nome, tipo: "fixo" | "faixas", taxaPct?, refeicoes?, faixas? }.
// "fixo": a mesma porcentagem para qualquer peso; "faixas": muda com o peso.
// Erros das faixas vêm por campo, com o índice da linha: "faixas.2.taxaPct".
export function salvarTabela(entrada) {
    const dados = lerDados();
    const existente = entrada.id ? dados.config.tabelasArracoamento.find((tabela) => tabela.id === entrada.id) : null;
    if (entrada.id && !existente) {
        falharRegra('Plano não encontrado.');
    }
    const tipo = entrada.tipo === 'fixo' ? 'fixo' : 'faixas';
    const nome = limparTexto(entrada.nome);
    const erros = { nome: validarTexto(nome, { rotulo: 'o nome do plano', obrigatorio: true, maximo: TAMANHO_MAXIMO_NOME }) };

    if (tipo === 'fixo') {
        // RN24: taxa de 0,1 a 20% do peso total por dia; de 1 a 12 refeições.
        erros.taxaPct = validarTaxa(entrada.taxaPct ?? null);
        erros.refeicoes = validarRefeicoes(entrada.refeicoes ?? null);
        lancarSeHouverErros(erros);
        const plano = { id: existente?.id ?? gerarId(), nome, tipo, taxaPct: entrada.taxaPct, refeicoes: entrada.refeicoes, faixas: [] };
        return gravar(dados, existente, plano);
    }

    const faixas = (entrada.faixas ?? []).map((faixa) => ({
        pesoDeG: faixa.pesoDeG ?? null,
        pesoAteG: faixa.pesoAteG ?? null,
        taxaPct: faixa.taxaPct ?? null,
        refeicoes: faixa.refeicoes ?? null,
    }));
    erros.faixas = faixas.length === 0 ? 'Adicione pelo menos uma faixa de peso.' : null;
    faixas.forEach((faixa, indice) => {
        const campo = (nome) => `faixas.${indice}.${nome}`;
        erros[campo('pesoDeG')] = validarNumero(faixa.pesoDeG, { rotulo: 'o peso inicial da faixa', obrigatorio: true, minimo: 0 });
        // RN24: "até" maior que "de".
        erros[campo('pesoAteG')] = validarNumero(faixa.pesoAteG, { rotulo: 'o peso final da faixa', obrigatorio: true, positivo: true })
            ?? (Number.isFinite(faixa.pesoDeG) && faixa.pesoAteG <= faixa.pesoDeG ? 'O peso final da faixa precisa ser maior que o inicial.' : null);
        erros[campo('taxaPct')] = validarTaxa(faixa.taxaPct);
        erros[campo('refeicoes')] = validarRefeicoes(faixa.refeicoes);
    });
    lancarSeHouverErros(erros);

    // RN24: as faixas não podem se sobrepor (encostar, como 190–225 e 225–265, pode).
    const ordenadas = faixas.map((faixa, indice) => ({ ...faixa, indice })).sort((a, b) => a.pesoDeG - b.pesoDeG);
    for (let i = 1; i < ordenadas.length; i += 1) {
        const anterior = ordenadas[i - 1];
        if (ordenadas[i].pesoDeG < anterior.pesoAteG) {
            lancarSeHouverErros({
                [`faixas.${ordenadas[i].indice}.pesoDeG`]: `Esta faixa se sobrepõe à de ${formatarNumero(anterior.pesoDeG)} a ${formatarNumero(anterior.pesoAteG)} g.`,
            });
        }
    }
    const plano = { id: existente?.id ?? gerarId(), nome, tipo, faixas: ordenadas.map(({ indice, ...faixa }) => faixa) };
    return gravar(dados, existente, plano);
}

function validarTaxa(valor) {
    return validarNumero(valor, { rotulo: 'quanto dar por dia', obrigatorio: true, minimo: 0.1, maximo: 20 });
}

function validarRefeicoes(valor) {
    return validarNumero(valor, { rotulo: 'as refeições', obrigatorio: true, inteiro: true, minimo: 1, maximo: 12 });
}

function gravar(dados, existente, plano) {
    if (existente) {
        // Campos do outro tipo não ficam para trás ao trocar de "faixas" para "fixo".
        for (const chave of Object.keys(existente)) {
            delete existente[chave];
        }
        Object.assign(existente, plano);
    } else {
        dados.config.tabelasArracoamento.push(plano);
    }
    salvarDados(dados);
    return plano;
}

export function excluirTabela(id) {
    const dados = lerDados();
    if (!dados.config.tabelasArracoamento.some((tabela) => tabela.id === id)) {
        falharRegra('Plano não encontrado.');
    }
    dados.config.tabelasArracoamento = dados.config.tabelasArracoamento.filter((tabela) => tabela.id !== id);
    // Os tanques que usavam a tabela ficam sem tabela, e a ração sugerida diz o motivo.
    for (const tanque of dados.tanques) {
        if (tanque.tabelaArracoamentoId === id) {
            tanque.tabelaArracoamentoId = null;
        }
    }
    salvarDados(dados);
}

export function carregarModeloEmbrapa() {
    return salvarTabela({ nome: MODELO_EMBRAPA.nome, tipo: 'faixas', faixas: MODELO_EMBRAPA.faixas.map((faixa) => ({ ...faixa })) });
}
