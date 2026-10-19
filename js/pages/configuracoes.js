// Configurações (seção 7.9): limites padrão dos alertas, tabelas de alimentação, exportação CSV (registros e lembretes),
// backup e restauração, dados de exemplo e limpeza dos dados.

import { paraNumero } from '../core/utils.js';
import { carregarModeloEmbrapa, excluirTabela, listarTabelas, obterTabela, salvarTabela } from '../domain/arracoamento.js';
import { apagarDados, lerDados } from '../core/storage.js';
import { formatarNumero, pluralizar } from '../core/format.js';
import { listarTanques, ROTULOS_STATUS } from '../domain/tanques.js';
import { obterLimitesPadrao, obterMetaFca, restaurarLimitesPadrao, salvarLimitesPadrao } from '../domain/configuracoes.js';
import { exportarBackup, exportarCsv, exportarCsvLembretes, lerBackup, restaurarBackup } from '../services/exportacao.js';
import { carregarDadosExemplo } from '../services/seed.js';

import {
    confirmar,
    criarElemento,
    iniciarFormulario,
    limparErroCampo,
    limparErrosFormulario,
    mostrarErro,
    mostrarErroCampo,
    mostrarErroPagina,
    mostrarMensagem,
    preencherFormulario,
} from '../ui/componentes.js';
import { atualizarMenu, iniciarPagina } from './comum.js';

const porId = (id) => document.getElementById(id);
const formularioLimites = porId('formulario-limites');
const seletorExportacao = porId('campo-exportar-tanque');
const formularioTabela = porId('formulario-tabela');
// Cada célula tem o próprio campo de erro: a chave do erro é "faixas.N.campo" (RN24).
const COLUNAS_FAIXA = [
    ['pesoDeG', 'Peso de (g)', 'decimal'],
    ['pesoAteG', 'Peso até (g)', 'decimal'],
    ['taxaPct', 'Taxa (% da biomassa por dia)', 'decimal'],
    ['refeicoes', 'Refeições por dia', 'numeric'],
];

iniciarPagina();
try {
    configurarLimites();
    configurarTabelas();
    configurarExportacao();
    configurarBackup();
    configurarDados();
    atualizarTela();
} catch (erro) {
    mostrarErroPagina(erro);
}

// Depois de restaurar, carregar exemplo ou apagar, os dados da tela mudam.
function atualizarTela() {
    atualizarMenu();
    preencherFormulario(formularioLimites, { ...obterLimitesPadrao(), metaFca: obterMetaFca() });
    limparErrosFormulario(formularioLimites, porId('erro-geral-limites'));
    const todos = criarElemento('option', { texto: 'Todos os tanques', atributos: { value: '' } });
    seletorExportacao.replaceChildren(todos, ...listarTanques({ incluirArquivados: true }).map((tanque) => criarElemento('option', {
        texto: tanque.status === 'arquivado' ? `${tanque.nome} (${ROTULOS_STATUS.arquivado.toLowerCase()})` : tanque.nome,
        atributos: { value: tanque.id },
    })));
}

function resumirDados(dados) {
    return `${pluralizar(dados.tanques.length, 'tanque', 'tanques')}, ${pluralizar(dados.ciclos.length, 'ciclo', 'ciclos')} `
        + `e ${pluralizar(dados.registros.length, 'registro', 'registros')}`;
}

function configurarLimites() {
    const saida = porId('mensagem-limites');
    iniciarFormulario(formularioLimites, {
        erroGeral: porId('erro-geral-limites'),
        mensagem: saida,
        aoEnviar: (valores) => {
            salvarLimitesPadrao(Object.fromEntries(Object.entries(valores).map(([campo, valor]) => [campo, paraNumero(valor)])));
            mostrarMensagem(saida, 'Limites salvos. Os alertas já usam os novos valores.');
        },
    });
    porId('botao-restaurar-limites').addEventListener('click', () => {
        try {
            restaurarLimitesPadrao();
            atualizarTela();
            mostrarMensagem(saida, 'Limites padrão restaurados.');
        } catch (erro) {
            mostrarErro(saida, erro);
        }
    });
}

function configurarExportacao() {
    const exportar = (exportador, vazio, singular, plural) => () => {
        const saida = porId('mensagem-exportar');
        try {
            const { quantidade, arquivo } = exportador({ tanqueId: seletorExportacao.value || null });
            if (quantidade === 0) {
                mostrarMensagem(saida, vazio, { erro: true });
                return;
            }
            mostrarMensagem(saida, `${pluralizar(quantidade, singular, plural)} para ${arquivo}.`);
        } catch (erro) {
            mostrarErro(saida, erro);
        }
    };
    porId('botao-exportar-csv').addEventListener('click',
        exportar(exportarCsv, 'Não há registros para exportar.', 'registro exportado', 'registros exportados'));
    porId('botao-exportar-lembretes').addEventListener('click',
        exportar(exportarCsvLembretes, 'Não há lembretes para exportar.', 'lembrete exportado', 'lembretes exportados'));
}

function configurarBackup() {
    const saida = porId('mensagem-backup');
    const campoArquivo = porId('campo-arquivo-backup');
    campoArquivo.addEventListener('change', () => limparErroCampo(campoArquivo));

    porId('botao-fazer-backup').addEventListener('click', () => {
        try {
            const { arquivo } = exportarBackup();
            mostrarMensagem(saida, `Backup salvo em ${arquivo}.`);
        } catch (erro) {
            mostrarErro(saida, erro);
        }
    });

    porId('botao-restaurar-backup').addEventListener('click', async () => {
        mostrarMensagem(saida, '');
        limparErroCampo(campoArquivo);
        const arquivo = campoArquivo.files[0];
        if (!arquivo) {
            mostrarErroCampo(campoArquivo, 'Escolha o arquivo de backup.');
            campoArquivo.focus();
            return;
        }
        try {
            // 9.7: a leitura valida a versão antes de qualquer confirmação.
            const dados = await lerBackup(arquivo);
            const confirmado = await confirmar(
                `Restaurar o backup com ${resumirDados(dados)}? Os dados atuais deste aparelho serão substituídos.`,
                { textoConfirmar: 'Restaurar' },
            );
            if (!confirmado) {
                return;
            }
            restaurarBackup(dados);
            campoArquivo.value = '';
            atualizarTela();
            mostrarMensagem(saida, `Backup restaurado: ${resumirDados(dados)}.`);
        } catch (erro) {
            mostrarErro(saida, erro);
        }
    });
}

function configurarDados() {
    const saida = porId('mensagem-dados');
    const botaoExemplo = porId('botao-carregar-exemplo');

    botaoExemplo.addEventListener('click', async () => {
        mostrarMensagem(saida, '');
        const atuais = lerDados();
        if (atuais.tanques.length > 0) {
            const confirmado = await confirmar(
                `Carregar os dados de exemplo? Os dados atuais (${resumirDados(atuais)}) serão substituídos. `
                + 'Faça um backup antes, se quiser guardá-los.',
                { textoConfirmar: 'Carregar exemplo' },
            );
            if (!confirmado) {
                return;
            }
        }
        botaoExemplo.disabled = true;
        mostrarMensagem(saida, 'Gerando os dados de exemplo…');
        // Dá tempo de a mensagem aparecer antes do processamento, que leva alguns instantes.
        await new Promise((resolver) => setTimeout(resolver, 50));
        try {
            const dados = carregarDadosExemplo();
            atualizarTela();
            mostrarMensagem(saida, `Dados de exemplo carregados: ${resumirDados(dados)}. Veja o resultado no Dashboard.`);
        } catch (erro) {
            mostrarErro(saida, erro);
        } finally {
            botaoExemplo.disabled = false;
        }
    });

    porId('botao-apagar-dados').addEventListener('click', async () => {
        mostrarMensagem(saida, '');
        const confirmado = await confirmar(
            `Apagar todos os dados deste aparelho (${resumirDados(lerDados())})? Esta ação não pode ser desfeita. `
            + 'Faça um backup antes, se quiser guardá-los.',
            { textoConfirmar: 'Apagar tudo' },
        );
        if (!confirmado) {
            return;
        }
        try {
            apagarDados();
            atualizarTela();
            mostrarMensagem(saida, 'Todos os dados foram apagados.');
        } catch (erro) {
            mostrarErro(saida, erro);
        }
    });
}

// ---------- Tabelas de alimentação (seção 9.10) ----------

function configurarTabelas() {
    renderizarTabelas();
    porId('botao-nova-tabela').addEventListener('click', () => abrirEditorTabela(null));
    porId('botao-modelo-tabela').addEventListener('click', () => {
        const saida = porId('mensagem-tabelas');
        try {
            const tabela = carregarModeloEmbrapa();
            renderizarTabelas();
            mostrarMensagem(saida, `Tabela "${tabela.nome}" carregada. Confira se ela vale para a sua ração.`);
        } catch (erro) {
            mostrarErro(saida, erro);
        }
    });
    porId('botao-adicionar-faixa').addEventListener('click', () => {
        porId('corpo-faixas').append(criarLinhaFaixa({}, porId('corpo-faixas').rows.length));
        renumerarFaixas();
        porId('corpo-faixas').lastElementChild.querySelector('input').focus();
    });
    porId('botao-cancelar-tabela').addEventListener('click', fecharEditorTabela);
    porId('corpo-faixas').addEventListener('click', (evento) => {
        const botao = evento.target.closest('[data-remover-faixa]');
        if (botao) {
            botao.closest('tr').remove();
            renumerarFaixas();
        }
    });
    porId('lista-tabelas').addEventListener('click', async (evento) => {
        const editar = evento.target.closest('[data-editar-tabela]');
        const excluir = evento.target.closest('[data-excluir-tabela]');
        if (editar) {
            abrirEditorTabela(obterTabela(editar.dataset.editarTabela));
        } else if (excluir) {
            const tabela = obterTabela(excluir.dataset.excluirTabela);
            const confirmado = await confirmar(`Excluir a tabela "${tabela.nome}"? Os tanques que a usam ficam sem tabela.`, { textoConfirmar: 'Excluir' });
            if (confirmado) {
                excluirTabela(tabela.id);
                renderizarTabelas();
                mostrarMensagem(porId('mensagem-tabelas'), 'Tabela excluída.');
            }
        }
    });
    iniciarFormulario(formularioTabela, {
        erroGeral: porId('erro-geral-tabela'),
        aoEnviar: (valores) => {
            const faixas = [...porId('corpo-faixas').rows].map((_, indice) => ({
                pesoDeG: paraNumero(valores[`faixas.${indice}.pesoDeG`]),
                pesoAteG: paraNumero(valores[`faixas.${indice}.pesoAteG`]),
                taxaPct: paraNumero(valores[`faixas.${indice}.taxaPct`]),
                refeicoes: paraNumero(valores[`faixas.${indice}.refeicoes`]),
            }));
            const tabela = salvarTabela({ id: valores.id || null, nome: valores.nome, faixas });
            fecharEditorTabela();
            renderizarTabelas();
            mostrarMensagem(porId('mensagem-tabelas'), `Tabela "${tabela.nome}" salva.`);
        },
    });
}

function renderizarTabelas() {
    const tabelas = listarTabelas();
    porId('lista-tabelas').replaceChildren(...(tabelas.length > 0
        ? tabelas.map((tabela) => criarElemento('li', { classe: 'lista-tabelas__item' }, [
            criarElemento('div', {}, [
                criarElemento('p', { classe: 'lista-tabelas__nome', texto: tabela.nome }),
                criarElemento('p', {
                    classe: 'lista-tabelas__detalhe',
                    texto: `${pluralizar(tabela.faixas.length, 'faixa', 'faixas')} · de ${formatarNumero(tabela.faixas[0].pesoDeG)} a ${formatarNumero(tabela.faixas.at(-1).pesoAteG)} g`,
                }),
            ]),
            criarElemento('div', { classe: 'lista-tabelas__acoes' }, [
                criarElemento('button', { classe: 'link', texto: 'Editar', atributos: { type: 'button', 'data-editar-tabela': tabela.id } }),
                criarElemento('button', { classe: 'link link--perigo', texto: 'Excluir', atributos: { type: 'button', 'data-excluir-tabela': tabela.id } }),
            ]),
        ]))
        : [criarElemento('li', { classe: 'lista-tabelas__vazio', texto: 'Nenhuma tabela ainda. Crie uma ou carregue o modelo.' })]));
}

function abrirEditorTabela(tabela) {
    limparErrosFormulario(formularioTabela, porId('erro-geral-tabela'));
    porId('titulo-editor-tabela').textContent = tabela ? 'Editar tabela' : 'Nova tabela';
    formularioTabela.elements.namedItem('id').value = tabela?.id ?? '';
    formularioTabela.elements.namedItem('nome').value = tabela?.nome ?? '';
    const faixas = tabela?.faixas ?? [{}];
    porId('corpo-faixas').replaceChildren(...faixas.map((faixa, indice) => criarLinhaFaixa(faixa, indice)));
    renumerarFaixas();
    formularioTabela.hidden = false;
    porId('campo-nome-tabela').focus();
}

function fecharEditorTabela() {
    formularioTabela.hidden = true;
}


function criarLinhaFaixa(faixa, indice) {
    const numero = (valor) => (valor === undefined || valor === null ? '' : formatarNumero(valor, 2).replace(/\./g, ''));
    return criarElemento('tr', {}, [
        ...COLUNAS_FAIXA.map(([campo, rotulo, modo]) => criarElemento('td', {}, [
            criarElemento('input', {
                classe: 'campo__input campo__input--compacto',
                atributos: {
                    type: 'text', inputmode: modo, autocomplete: 'off', value: numero(faixa[campo]),
                    'data-coluna': campo, 'aria-label': `${rotulo}, faixa ${indice + 1}`,
                },
            }),
            criarElemento('p', { classe: 'campo__erro' }),
        ])),
        criarElemento('td', {}, [criarElemento('button', {
            classe: 'link link--perigo',
            texto: 'Remover',
            atributos: { type: 'button', 'data-remover-faixa': '', 'aria-label': `Remover a faixa ${indice + 1}` },
        })]),
    ]);
}

// name e ids seguem a posição da linha, para os erros caírem no campo certo.
function renumerarFaixas() {
    [...porId('corpo-faixas').rows].forEach((linha, indice) => {
        for (const entrada of linha.querySelectorAll('input[data-coluna]')) {
            const nome = `faixas.${indice}.${entrada.dataset.coluna}`;
            const idErro = `erro-faixa-${indice}-${entrada.dataset.coluna}`;
            entrada.name = nome;
            entrada.id = `campo-faixa-${indice}-${entrada.dataset.coluna}`;
            entrada.setAttribute('aria-describedby', idErro);
            entrada.nextElementSibling.id = idErro;
        }
    });
}
