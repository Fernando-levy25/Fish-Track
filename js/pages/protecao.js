// Proteção dos dados do produtor nos caminhos de falha (seção 8.5): tela de
// bloqueio para dados ilegíveis ou de versão mais nova, faixa de armazenamento
// cheio (só leitura) e a lista de "Dados recuperados". Fica em pages porque
// junta storage, services e ui.

import {
    descartarCopiaIlegivel,
    ErroArmazenamentoBloqueado,
    iniciarBaseNova,
    listarCopiasIlegiveis,
    tentarSalvarDeNovo,
    verificarEstadoArmazenamento,
} from '../core/storage.js';
import { analisarBackup, baixarCopia, baixarDadosGuardados, restaurarBackup } from '../services/exportacao.js';
import { confirmar, criarElemento, mostrarErro, mostrarMensagem } from '../ui/componentes.js';

// Devolve o estado do armazenamento. Com dados ilegíveis ou de versão mais nova,
// troca o conteúdo da página pela tela de bloqueio e interrompe o script da página.
export function protegerDados() {
    let estado;
    try {
        estado = verificarEstadoArmazenamento();
    } catch {
        // Armazenamento bloqueado pelo navegador: a própria página mostra o erro.
        return 'ok';
    }
    if (estado === 'ilegivel' || estado === 'versaoMaisNova') {
        garantirDialogoConfirmacao();
        mostrarTelaBloqueio(estado);
        // O resto da página não roda: sem isso ela tentaria ler os dados.
        window.addEventListener('error', (evento) => {
            if (evento.error instanceof ErroArmazenamentoBloqueado) {
                evento.preventDefault();
            }
        });
        throw new ErroArmazenamentoBloqueado();
    }
    if (estado === 'somenteMemoria') {
        garantirDialogoConfirmacao();
        mostrarFaixaSomenteLeitura();
    }
    return estado;
}

// ---------- Tela de bloqueio ----------

function mostrarTelaBloqueio(estado) {
    const main = document.querySelector('main');
    const saida = criarElemento('p', { classe: 'mensagem', atributos: { role: 'status', 'data-campo': 'mensagemBloqueio' } });
    const botaoBaixar = criarBotao('Baixar os dados', 'botao--primario', () => {
        try {
            const { arquivo } = baixarDadosGuardados();
            mostrarMensagem(saida, `Arquivo ${arquivo} gerado. Guarde-o num lugar seguro.`);
        } catch (erro) {
            mostrarErro(saida, erro);
        }
    });
    botaoBaixar.dataset.acao = 'baixarDados';

    const conteudo = estado === 'versaoMaisNova'
        ? [
            criarElemento('h1', { classe: 'bloqueio__titulo', texto: 'Dados de uma versão mais nova' }),
            criarElemento('p', { texto: 'Estes dados foram salvos por uma versão mais nova do Fish Track. Abra o app com internet para atualizar.' }),
            criarElemento('div', { classe: 'bloqueio__acoes' }, [
                criarBotao('Tentar de novo', 'botao--secundario', () => window.location.reload()),
                botaoBaixar,
            ]),
            saida,
        ]
        : [
            criarElemento('h1', { classe: 'bloqueio__titulo', texto: 'Não foi possível ler os dados' }),
            criarElemento('p', { texto: 'Não foi possível ler os dados salvos neste aparelho. Eles foram preservados e nada será gravado até você escolher o que fazer.' }),
            criarElemento('ol', { classe: 'bloqueio__passos' }, [
                criarElemento('li', {}, [
                    criarElemento('h2', { classe: 'bloqueio__subtitulo', texto: 'Guarde uma cópia' }),
                    botaoBaixar,
                ]),
                criarElemento('li', {}, [
                    criarElemento('h2', { classe: 'bloqueio__subtitulo', texto: 'Restaurar um backup' }),
                    criarRestauracao(),
                ]),
                criarElemento('li', {}, [
                    criarElemento('h2', { classe: 'bloqueio__subtitulo', texto: 'Começar uma base nova' }),
                    criarBaseNova(),
                ]),
            ]),
            saida,
            criarSecaoCopias(),
        ];
    const secao = criarElemento('section', { classe: 'bloqueio', atributos: { role: 'alert', 'data-campo': 'telaBloqueio' } }, conteudo);
    main.replaceChildren(secao);
    document.body.dataset.bloqueio = estado;
}

function criarRestauracao() {
    const id = 'bloqueio-arquivo-backup';
    const campo = criarElemento('input', { classe: 'campo__input', atributos: { type: 'file', id, accept: '.json,application/json' } });
    const saida = criarElemento('div', { classe: 'mensagem', atributos: { role: 'status' } });
    const botao = criarBotao('Restaurar', 'botao--secundario', async () => {
        mostrarMensagem(saida, '');
        const arquivo = campo.files[0];
        if (!arquivo) {
            mostrarMensagem(saida, 'Escolha o arquivo de backup.', { erro: true });
            return;
        }
        try {
            const { dados, avisos } = analisarBackup(await arquivo.text());
            if (!(await confirmar(montarPergunta(dados, avisos), { textoConfirmar: 'Restaurar' }))) {
                return;
            }
            restaurarBackup(dados);
            window.location.reload();
        } catch (erro) {
            mostrarProblemas(saida, erro);
        }
    });
    return criarElemento('div', { classe: 'bloqueio__grupo' }, [
        criarElemento('label', { classe: 'campo__rotulo', texto: 'Arquivo de backup (.json)', atributos: { for: id } }),
        campo,
        botao,
        saida,
    ]);
}

function criarBaseNova() {
    const id = 'bloqueio-entendo';
    const caixa = criarElemento('input', { atributos: { type: 'checkbox', id } });
    const saida = criarElemento('p', { classe: 'mensagem', atributos: { role: 'status' } });
    const botao = criarBotao('Começar uma base nova', 'botao--perigo', async () => {
        mostrarMensagem(saida, '');
        const confirmado = await confirmar(
            'Começar uma base nova? Os dados atuais serão substituídos. Uma cópia deles fica guardada em "Dados recuperados".',
            { textoConfirmar: 'Começar do zero' },
        );
        if (!confirmado) {
            return;
        }
        try {
            iniciarBaseNova({ confirmado: caixa.checked });
            window.location.reload();
        } catch (erro) {
            mostrarErro(saida, erro);
        }
    });
    botao.disabled = true;
    caixa.addEventListener('change', () => {
        botao.disabled = !caixa.checked;
    });
    return criarElemento('div', { classe: 'bloqueio__grupo' }, [
        criarElemento('label', { classe: 'bloqueio__confirmacao', atributos: { for: id } }, [caixa, 'Entendo que os dados atuais serão substituídos']),
        botao,
        saida,
    ]);
}

// ---------- Armazenamento cheio: só leitura ----------

function mostrarFaixaSomenteLeitura() {
    const saida = criarElemento('p', { classe: 'mensagem', atributos: { role: 'status' } });
    const copias = criarSecaoCopias({ semTitulo: true });
    copias.hidden = true;
    const faixa = criarElemento('section', { classe: 'faixa-cheio', atributos: { role: 'alert', 'data-campo': 'faixaCheio' } }, [
        criarElemento('p', {}, [
            criarElemento('strong', { texto: 'Atenção: o armazenamento deste aparelho está cheio.' }),
            ' Seus dados estão guardados, mas nada novo pode ser salvo até liberar espaço.',
        ]),
        criarElemento('div', { classe: 'faixa-cheio__acoes' }, [
            criarBotao('Baixar os dados', 'botao--secundario', () => {
                try {
                    const { arquivo } = baixarDadosGuardados();
                    mostrarMensagem(saida, `Arquivo ${arquivo} gerado.`);
                } catch (erro) {
                    mostrarErro(saida, erro);
                }
            }),
            criarBotao('Tentar salvar de novo', 'botao--secundario', () => {
                if (tentarSalvarDeNovo() === 'ok') {
                    window.location.reload();
                } else {
                    mostrarMensagem(saida, 'Ainda não há espaço. Descarte cópias antigas ou libere espaço no navegador.', { erro: true });
                }
            }),
            criarBotao('Dados recuperados', 'botao--secundario', () => {
                copias.hidden = !copias.hidden;
            }),
        ]),
        saida,
        copias,
    ]);
    const main = document.querySelector('main');
    main.prepend(faixa);
    document.body.dataset.somenteLeitura = '';
    desativarGravacoes(main);
    new MutationObserver(() => desativarGravacoes(main)).observe(main, { childList: true, subtree: true });
    // Garantia extra: nenhum formulário é enviado enquanto nada pode ser salvo.
    document.addEventListener('submit', (evento) => {
        if (!evento.target.closest('dialog')) {
            evento.preventDefault();
            evento.stopImmediatePropagation();
        }
    }, true);
}

function desativarGravacoes(main) {
    for (const controle of main.querySelectorAll('form :is(input, select, textarea, button), input[type="checkbox"]')) {
        if (!controle.closest('.faixa-cheio') && !controle.disabled) {
            controle.disabled = true;
        }
    }
}

// ---------- Dados recuperados ----------

// Cópias de dados que não puderam ser lidos. Some quando não há nenhuma.
export function criarSecaoCopias({ semTitulo = false } = {}) {
    const secao = criarElemento('section', { classe: 'copias', atributos: { 'data-campo': 'dadosRecuperados' } });
    const saida = criarElemento('p', { classe: 'mensagem', atributos: { role: 'status' } });
    const lista = criarElemento('ul', { classe: 'copias__lista' });

    function renderizar() {
        const copias = listarCopiasIlegiveis();
        secao.dataset.vazio = copias.length === 0 ? 'sim' : 'nao';
        lista.replaceChildren(...(copias.length > 0
            ? copias.map((copia) => criarElemento('li', { classe: 'copias__item' }, [
                criarElemento('span', { texto: copia.data ? `Cópia de ${descreverMomento(copia.data)}` : 'Cópia antiga (sem data)' }),
                criarElemento('span', { classe: 'copias__acoes' }, [
                    criarBotao('Baixar cópia', 'botao--secundario botao--pequeno', () => {
                        try {
                            baixarCopia(copia.chave);
                        } catch (erro) {
                            mostrarErro(saida, erro);
                        }
                    }),
                    criarBotao('Descartar', 'botao--perigo botao--pequeno', async () => {
                        if (!(await confirmar('Descartar esta cópia? Ela não poderá ser recuperada depois.', { textoConfirmar: 'Descartar' }))) {
                            return;
                        }
                        descartarCopiaIlegivel(copia.chave);
                        renderizar();
                        mostrarMensagem(saida, 'Cópia descartada.');
                    }),
                ]),
            ]))
            : [criarElemento('li', { classe: 'copias__vazio', texto: 'Nenhuma cópia guardada.' })]));
    }

    secao.append(...[
        semTitulo ? null : criarElemento('h2', { classe: 'bloqueio__subtitulo', texto: 'Dados recuperados' }),
        criarElemento('p', { classe: 'copias__ajuda', texto: 'Cópias de dados que não puderam ser lidos. Baixe antes de descartar, se quiser guardar.' }),
        lista,
        saida,
    ].filter(Boolean));
    renderizar();
    return secao;
}

// ---------- Partes comuns ----------

// A chave guarda o momento em UTC; o produtor vê no horário do aparelho.
function descreverMomento(iso) {
    const momento = new Date(iso);
    return Number.isNaN(momento.getTime()) ? iso : momento.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// Pergunta de restauração com os avisos, que não impedem mas precisam ser vistos.
export function montarPergunta(dados, avisos) {
    const resumo = `${dados.tanques.length} tanque(s), ${dados.ciclos.length} ciclo(s) e ${dados.registros.length} registro(s)`;
    const textoAvisos = avisos.length > 0 ? `\n\nAvisos:\n${avisos.map((aviso) => `• ${aviso}`).join('\n')}` : '';
    return `Restaurar o backup com ${resumo}? Os dados atuais deste aparelho serão substituídos; uma cópia deles fica guardada.${textoAvisos}`;
}

// Erro de restauração com a lista dos problemas encontrados no arquivo.
export function mostrarProblemas(elemento, erro) {
    mostrarErro(elemento, erro);
    if (erro?.problemas?.length) {
        elemento.append(criarElemento('ul', { classe: 'lista-problemas' }, erro.problemas.map((problema) => criarElemento('li', { texto: problema }))));
    }
}

function criarBotao(texto, variante, aoClicar) {
    const botao = criarElemento('button', { classe: `botao ${variante}`, texto, atributos: { type: 'button' } });
    botao.addEventListener('click', aoClicar);
    return botao;
}

// As páginas sem diálogo de confirmação ganham um, para não cair no confirm() do navegador.
function garantirDialogoConfirmacao() {
    if (document.getElementById('dialogo-confirmacao')) {
        return;
    }
    document.body.append(criarElemento('dialog', { classe: 'dialogo', atributos: { id: 'dialogo-confirmacao', 'aria-labelledby': 'mensagem-confirmacao' } }, [
        criarElemento('form', { classe: 'dialogo__conteudo', atributos: { method: 'dialog' } }, [
            criarElemento('p', { classe: 'dialogo__mensagem', atributos: { id: 'mensagem-confirmacao' } }),
            criarElemento('div', { classe: 'dialogo__acoes' }, [
                criarElemento('button', { classe: 'botao botao--secundario', texto: 'Cancelar', atributos: { value: 'cancelar' } }),
                criarElemento('button', { classe: 'botao botao--perigo', texto: 'Confirmar', atributos: { id: 'botao-confirmar', value: 'confirmar' } }),
            ]),
        ]),
    ]));
}
