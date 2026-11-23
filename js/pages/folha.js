// Folha do dia (seção 7.15): a rotina de todos os tanques com ciclo ativo numa
// tela só, como a ficha de papel. folha.html?tanque=ID abre posicionada no tanque.
// Valor pré-preenchido sem a marcação "Anotado" nunca é gravado: o app não pode
// registrar uma alimentação que não aconteceu.

import { hojeISO, paraNumero, somarDias } from '../core/utils.js';
import { formatarDataCurta, formatarMassa, pluralizar } from '../core/format.js';
import { lerDados, lerPreferencia, salvarPreferencia } from '../core/storage.js';
import { analisarTanque } from '../domain/alertas.js';
import { calcularEstadoTanque } from '../domain/estado.js';
import {
    avaliarRacaoImprovavel,
    CAUSAS_MORTALIDADE,
    resumirRegistro,
    salvarFolhaDoDia,
    temRotinaNaData,
} from '../domain/registros.js';
import { obterLimitesPadrao, obterUnidades } from '../domain/configuracoes.js';
import { listarSituacoes, listarTanques } from '../domain/tanques.js';
import { ErroValidacao } from '../domain/validacao.js';
import { obterCorTanque } from '../ui/graficos.js';
import { lerParametro, montarUrl } from '../ui/nav.js';
import {
    criarElemento,
    criarEtiquetaEstado,
    criarValorAusente,
    iniciarCampoUnidade,
    iniciarFormulario,
    mostrarErroPagina,
    mostrarMensagem,
    preencherCampos,
} from '../ui/componentes.js';
import { atualizarMenu, descreverRacaoSugerida, iniciarPagina } from './comum.js';

const porId = (id) => document.getElementById(id);
const formulario = porId('formulario-folha');
const lista = porId('linhas-folha');
const tanqueDoEndereco = lerParametro('tanque');
const CHAVE_UNIDADE = 'unidadeRacaoFolha';

// Linhas editáveis da data escolhida: { situacao, sugestao, racao, sobra }.
let linhas = [];

iniciarPagina();
try {
    iniciar();
} catch (erro) {
    mostrarErroPagina(erro);
}

function iniciar() {
    const hoje = hojeISO();
    preencherCampos(document, { rotuloHoje: `Hoje (${formatarDataCurta(hoje)})`, rotuloOntem: `Ontem (${formatarDataCurta(somarDias(hoje, -1))})` });
    formulario.addEventListener('change', (evento) => {
        if (evento.target.name === 'dia') {
            renderizar();
        }
        atualizarBotao();
    });
    // Mexer num campo da linha marca a linha como anotada.
    lista.addEventListener('input', (evento) => {
        const linha = evento.target.closest('[data-linha]');
        if (linha && !evento.target.matches('[data-anotado]')) {
            linha.querySelector('[data-anotado]').checked = true;
            atualizarBotao();
        }
    });
    porId('botao-conforme-plano').addEventListener('click', alimentarConformePlano);
    iniciarFormulario(formulario, { erroGeral: porId('erro-geral-folha'), aoEnviar: salvar });
    renderizar();
    if (tanqueDoEndereco) {
        const linha = lista.querySelector(`[data-tanque="${tanqueDoEndereco}"]`);
        linha?.scrollIntoView({ block: 'center' });
        linha?.querySelector('input:not([type="checkbox"]), a')?.focus();
    }
}

function dataEscolhida() {
    const hoje = hojeISO();
    return formulario.querySelector('[name="dia"]:checked').value === 'ontem' ? somarDias(hoje, -1) : hoje;
}

function renderizar() {
    const data = dataEscolhida();
    const hoje = hojeISO();
    const situacoes = listarSituacoes().filter((situacao) => situacao.cicloAtivo && situacao.cicloAtivo.dataInicio <= data);
    porId('aviso-folha-vazia').hidden = situacoes.length > 0;
    formulario.hidden = situacoes.length === 0;
    const todos = listarTanques({ incluirArquivados: true });
    const limitesPadrao = obterLimitesPadrao();
    const registros = lerDados().registros;
    linhas = [];
    lista.replaceChildren(...situacoes.map((situacao) => {
        const { alertas } = analisarTanque(situacao, { limitesPadrao, hoje, unidades: obterUnidades() });
        const estado = calcularEstadoTanque({ situacao, alertas });
        const cor = obterCorTanque(situacao.tanque, todos);
        if (temRotinaNaData(registros, situacao.tanque.id, data)) {
            return criarLinhaAnotada(situacao, estado, cor, data);
        }
        return criarLinhaEditavel(situacao, estado, cor, linhas.length);
    }));
    atualizarBotao();
}

function cabecalhoDaLinha({ tanque }, estado, cor) {
    const faixa = criarElemento('span', { classe: 'folha__faixa', atributos: { 'aria-hidden': 'true' } });
    faixa.style.setProperty('--cor-serie', cor);
    return criarElemento('div', { classe: 'folha__cabecalho' }, [
        faixa,
        criarElemento('h2', { classe: 'folha__tanque', texto: tanque.nome }),
        criarEtiquetaEstado(estado, { comMotivo: false }),
    ]);
}

// Tanque já anotado na data: só leitura, com o link para o registro.
function criarLinhaAnotada(situacao, estado, cor, data) {
    const doDia = situacao.registros.filter((registro) => registro.data === data
        && [registro.racaoKg, registro.racaoSobraKg, registro.mortalidade].some((valor) => valor !== null && valor !== undefined));
    return criarElemento('li', { classe: 'folha__linha folha__linha--anotada', atributos: { 'data-tanque': situacao.tanque.id } }, [
        cabecalhoDaLinha(situacao, estado, cor),
        criarElemento('p', { classe: 'folha__resumo' }, [
            `Já anotado: ${doDia.map(resumirRegistro).join(' · ')} · `,
            criarElemento('a', { classe: 'link', texto: 'Editar', atributos: { href: montarUrl('registro.html', { id: doDia.at(-1).id }) } }),
        ]),
    ]);
}

function criarLinhaEditavel(situacao, estado, cor, posicao) {
    const { tanque } = situacao;
    const descricao = descreverRacaoSugerida(situacao);
    const nome = (campo) => `linhas.${posicao}.${campo}`;
    const id = (campo) => `folha-${posicao}-${campo}`;
    const campo = (chave, rotulo, controle, extra = null) => criarElemento('div', { classe: 'campo' }, [
        criarElemento('label', { classe: 'campo__rotulo', texto: rotulo, atributos: { for: id(chave) } }),
        controle,
        extra,
        criarElemento('p', { classe: 'campo__erro', atributos: { id: `erro-${id(chave)}` } }),
    ]);
    const entrada = (chave, modo, valor = '') => criarElemento('input', {
        classe: 'campo__input',
        atributos: { id: id(chave), name: nome(chave), type: 'text', inputmode: modo, pattern: modo === 'numeric' ? '[0-9]*' : '[0-9]*[.,]?[0-9]*', autocomplete: 'off', value: valor, 'aria-describedby': `erro-${id(chave)}` },
    });

    const entradaRacao = entrada('racaoKg', 'decimal');
    const entradaSobra = entrada('racaoSobraKg', 'decimal');
    const entradaMortos = entrada('mortalidade', 'numeric', '0');
    const causa = criarElemento('select', { classe: 'campo__select', atributos: { id: id('causaMortalidade'), name: nome('causaMortalidade'), 'aria-describedby': `erro-${id('causaMortalidade')}` } }, [
        criarElemento('option', { texto: 'Não informada', atributos: { value: '' } }),
        ...Object.entries(CAUSAS_MORTALIDADE).map(([valor, texto]) => criarElemento('option', { texto, atributos: { value: valor } })),
    ]);
    const observacoes = criarElemento('textarea', { classe: 'campo__input campo__input--area', atributos: { id: id('observacoes'), name: nome('observacoes'), rows: '2' } });
    const sugestao = descricao.sugestao
        ? criarElemento('p', { classe: 'campo__ajuda', texto: `Sugerida: ${descricao.textoDia} (${descricao.textoDetalhe})` })
        : criarElemento('p', { classe: 'campo__ajuda' }, [criarValorAusente({ motivo: descricao.textoMotivo, acao: descricao.acaoMotivo?.texto, href: descricao.acaoMotivo?.href })]);
    const marcacao = criarElemento('label', { classe: 'folha__anotado' }, [
        criarElemento('input', { classe: 'campo__checkbox', atributos: { type: 'checkbox', 'data-anotado': '', name: nome('anotado') } }),
        'Anotado',
    ]);

    const item = criarElemento('li', { classe: 'folha__linha', atributos: { 'data-tanque': tanque.id, 'data-linha': String(posicao) } }, [
        criarElemento('div', { classe: 'folha__topo-linha' }, [cabecalhoDaLinha(situacao, estado, cor), marcacao]),
        criarElemento('div', { classe: 'folha__campos' }, [
            campo('racaoKg', 'Ração do dia', entradaRacao, sugestao),
            campo('racaoSobraKg', 'Sobra', entradaSobra),
            campo('mortalidade', 'Mortos encontrados', entradaMortos),
        ]),
        criarElemento('details', { classe: 'folha__mais' }, [
            criarElemento('summary', { classe: 'link', texto: 'Causa da mortalidade e observações' }),
            campo('causaMortalidade', 'Causa provável', causa),
            campo('observacoes', 'Observações', observacoes),
        ]),
    ]);
    // Uma unidade só para a ração e a sobra de todas as linhas, em qualquer data
    // (seção 7.15): a unidade em uso é lida a cada montagem e, trocada num campo,
    // vale para todos. Antes cada campo tinha a sua, e trocar a data mudava a
    // unidade sem aviso ("0,5" pensado em kg virava 0,5 g).
    const unidade = {
        grandeza: 'racao',
        unidades: ['kg', 'g'],
        unidadeInicial: unidadeEmUso(),
        aoTrocarUnidade: trocarUnidade,
    };
    const racao = iniciarCampoUnidade(entradaRacao, unidade);
    const sobra = iniciarCampoUnidade(entradaSobra, unidade);
    // A ração sugerida já vem no campo, exata (até 3 casas na unidade em uso),
    // mas só vale se a linha for marcada.
    if (descricao.sugestao) {
        racao.definirBase(descricao.sugestao.racaoDiaKg);
    }
    const avisoUnidade = criarElemento('p', { classe: 'campo__aviso', atributos: { 'aria-live': 'polite', 'data-campo': 'avisoUnidade' } });
    entradaRacao.closest('.campo').querySelector('.campo__erro').before(avisoUnidade);
    const linha = { situacao, sugestao: descricao.sugestao, racao, sobra, item, avisoUnidade };
    entradaRacao.addEventListener('input', () => avisarUnidade(linha));
    linhas.push(linha);
    return item;
}

function unidadeEmUso() {
    return lerPreferencia(CHAVE_UNIDADE, 'kg') === 'g' ? 'g' : 'kg';
}

function trocarUnidade(escolhida) {
    salvarPreferencia(CHAVE_UNIDADE, escolhida);
    for (const linha of linhas) {
        linha.racao.definirUnidade(escolhida);
        linha.sobra.definirUnidade(escolhida);
        avisarUnidade(linha);
    }
}

// Valor muito longe da sugestão: provavelmente a unidade errada (não bloqueia).
function avisarUnidade(linha) {
    const improvavel = linha.sugestao && avaliarRacaoImprovavel(linha.racao.lerBase(), linha.sugestao.racaoDiaKg);
    linha.avisoUnidade.textContent = improvavel
        ? `Confira a unidade: a sugestão é ${formatarMassa(linha.sugestao.racaoDiaKg, 'racao', linha.racao.unidade())}.`
        : '';
}

function linhasMarcadas() {
    return linhas.filter(({ item }) => item.querySelector('[data-anotado]').checked);
}

function atualizarBotao() {
    const marcadas = linhasMarcadas().length;
    porId('botao-salvar-dia').disabled = marcadas === 0;
    porId('dica-salvar-dia').textContent = marcadas === 0
        ? 'Marque os tanques que você anotou.'
        : `${pluralizar(marcadas, 'tanque marcado', 'tanques marcados')} para salvar.`;
    porId('botao-conforme-plano').hidden = !linhas.some((linha) => linha.sugestao);
}

// Marca como anotadas as linhas com ração sugerida, com os valores mostrados;
// o produtor ainda revisa antes de salvar.
function alimentarConformePlano() {
    for (const linha of linhas) {
        if (linha.sugestao) {
            // A sugestão exata: o que o campo mostra é o que será gravado.
            linha.racao.definirBase(linha.sugestao.racaoDiaKg);
            avisarUnidade(linha);
            linha.item.querySelector('[data-anotado]').checked = true;
        }
    }
    atualizarBotao();
    mostrarMensagem(porId('mensagem-folha'), 'Tanques com plano marcados. Revise e salve o dia.');
}

function salvar(valores) {
    const marcadas = linhasMarcadas();
    const posicoes = marcadas.map(({ item }) => Number(item.dataset.linha));
    try {
        salvarFolhaDoDia({
            data: dataEscolhida(),
            linhas: marcadas.map(({ situacao, racao, sobra, item }) => {
                const posicao = item.dataset.linha;
                return {
                    tanqueId: situacao.tanque.id,
                    racaoKg: racao.lerBase(),
                    racaoSobraKg: sobra.lerBase(),
                    mortalidade: paraNumero(valores[`linhas.${posicao}.mortalidade`]),
                    causaMortalidade: valores[`linhas.${posicao}.causaMortalidade`],
                    observacoes: valores[`linhas.${posicao}.observacoes`],
                };
            }),
        });
    } catch (erro) {
        // O domínio numera só as linhas enviadas; aqui elas voltam para a linha da tela.
        if (erro instanceof ErroValidacao) {
            const erros = Object.fromEntries(Object.entries(erro.erros).map(([chave, mensagem]) => [
                chave.replace(/^linhas\.(\d+)/, (_, indice) => `linhas.${posicoes[Number(indice)]}`),
                mensagem,
            ]));
            throw new ErroValidacao(erros, erro.message);
        }
        throw erro;
    }
    const total = marcadas.length;
    // Os tanques anotados passam a aparecer como "Já anotado".
    renderizar();
    atualizarMenu();
    mostrarMensagem(porId('mensagem-folha'), `${pluralizar(total, 'tanque anotado', 'tanques anotados')}.`);
}
