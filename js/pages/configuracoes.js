// Configurações (seção 7.9): limites padrão dos alertas, exportação CSV,
// backup e restauração, dados de exemplo e limpeza dos dados.

import { paraNumero } from '../core/utils.js';
import { apagarDados, lerDados } from '../core/storage.js';
import { pluralizar } from '../core/format.js';
import { listarTanques, ROTULOS_STATUS } from '../domain/tanques.js';
import { obterLimitesPadrao, restaurarLimitesPadrao, salvarLimitesPadrao } from '../domain/configuracoes.js';
import { exportarBackup, exportarCsv, lerBackup, restaurarBackup } from '../services/exportacao.js';
import { carregarDadosExemplo } from '../services/seed.js';
import { iniciarNavegacao } from '../ui/nav.js';
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

const porId = (id) => document.getElementById(id);
const formularioLimites = porId('formulario-limites');
const seletorExportacao = porId('campo-exportar-tanque');

iniciarNavegacao();
try {
    configurarLimites();
    configurarExportacao();
    configurarBackup();
    configurarDados();
    atualizarTela();
} catch (erro) {
    mostrarErroPagina(erro);
}

// Depois de restaurar, carregar exemplo ou apagar, os dados da tela mudam.
function atualizarTela() {
    preencherFormulario(formularioLimites, obterLimitesPadrao());
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
    porId('botao-exportar-csv').addEventListener('click', () => {
        const saida = porId('mensagem-exportar');
        try {
            const { quantidade, arquivo } = exportarCsv({ tanqueId: seletorExportacao.value || null });
            if (quantidade === 0) {
                mostrarMensagem(saida, 'Não há registros para exportar.', { erro: true });
                return;
            }
            mostrarMensagem(saida, `${pluralizar(quantidade, 'registro exportado', 'registros exportados')} para ${arquivo}.`);
        } catch (erro) {
            mostrarErro(saida, erro);
        }
    });
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
