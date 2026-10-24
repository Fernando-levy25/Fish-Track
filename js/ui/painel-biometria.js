// Painel de biometria (seção 7.13), aberto a partir do tanque: o tanque fica
// fixo e em destaque no topo, e não há como trocá-lo aqui. Não lê nem grava
// dados (seção 10): recebe o contexto e as ações da página (pages/tanque.js).

import { paraNumero } from '../core/utils.js';
import {
    formatarBiomassa,
    formatarData,
    formatarDataCurta,
    formatarGramas,
    formatarInteiro,
    formatarNumero,
    formatarPercentual,
    formatarRacao,
    pluralizar,
} from '../core/format.js';
import { confirmar, criarElemento, iniciarCampoUnidade, iniciarFormulario, limparErrosFormulario, preencherFormulario } from './componentes.js';
import { criarIcone } from './icones.js';

// acoes: { salvar(entrada, { irParaProximo }), calcularPrevia({ data, pesoMedioG, idEditado }),
//          calcularEstatisticas(pesosG), unidadeAmostra: { inicial, aoTrocar } }
export function criarPainelBiometria(dialogo, acoes) {
    let contexto = null;
    let modo = 'amostra';
    let emPartes = false;
    let sujo = false;
    let irParaProximo = false;

    // ---------- Estrutura ----------

    const faixa = criarElemento('span', { classe: 'painel-biometria__faixa', atributos: { 'aria-hidden': 'true' } });
    const nomeTanque = criarElemento('h2', { classe: 'painel-biometria__nome', atributos: { id: 'titulo-painel-biometria' } });
    const troca = criarElemento('p', { classe: 'painel-biometria__troca', atributos: { 'aria-live': 'polite' } });
    const detalheTanque = criarElemento('p', { classe: 'painel-biometria__detalhe' });
    const fechar = criarElemento('button', { classe: 'quadro__fechar', texto: '×', atributos: { type: 'button', 'aria-label': 'Fechar a biometria' } });
    const topo = criarElemento('header', { classe: 'painel-biometria__topo' }, [
        faixa,
        criarElemento('div', {}, [
            criarElemento('p', { classe: 'painel-biometria__rotulo', texto: 'Biometria do' }),
            nomeTanque,
            detalheTanque,
            troca,
        ]),
        fechar,
    ]);

    const campo = (id, rotulo, controle, { ajuda = null, extra = null } = {}) => criarElemento('div', { classe: 'campo', atributos: { id: `grupo-${id}` } }, [
        criarElemento('label', { classe: 'campo__rotulo', texto: rotulo, atributos: { for: id } }),
        controle,
        ajuda && criarElemento('p', { classe: 'campo__ajuda', texto: ajuda, atributos: { id: `ajuda-${id}` } }),
        extra,
        criarElemento('p', { classe: 'campo__erro', atributos: { id: `erro-${id}` } }),
    ]);
    const entradaNumero = (id, nome, modoTeclado, descricao = `erro-${id}`) => criarElemento('input', {
        classe: 'campo__input',
        atributos: { id, name: nome, type: 'text', inputmode: modoTeclado, autocomplete: 'off', 'aria-describedby': descricao },
    });

    const entradaData = criarElemento('input', { classe: 'campo__input', atributos: { id: 'biometria-data', name: 'data', type: 'date', required: true, 'aria-describedby': 'erro-biometria-data' } });
    const entradaPeixes = entradaNumero('biometria-peixes', 'peixesAmostra', 'numeric', 'ajuda-biometria-peixes erro-biometria-peixes');
    const entradaPeso = entradaNumero('biometria-peso', 'pesoAmostraG', 'decimal');
    const entradaComprimento = entradaNumero('biometria-comprimento', 'comprimentoMedioCm', 'decimal');
    const entradaPesoMedio = entradaNumero('biometria-peso-medio', 'pesoMedioG', 'decimal');
    const entradaIndividuais = criarElemento('textarea', {
        classe: 'campo__input campo__input--area',
        atributos: { id: 'biometria-individuais', name: 'pesosIndividuaisG', rows: '8', inputmode: 'decimal', 'aria-describedby': 'ajuda-biometria-individuais erro-biometria-individuais' },
    });
    const observacoes = criarElemento('textarea', { classe: 'campo__input campo__input--area', atributos: { id: 'biometria-observacoes', name: 'observacoes', rows: '2' } });

    const seletorModo = criarElemento('fieldset', { classe: 'campo campo--grupo' }, [
        criarElemento('legend', { classe: 'campo__rotulo', texto: 'Como você pesou?' }),
        criarElemento('div', { classe: 'segmentado' }, [['amostra', 'Amostra'], ['individuais', 'Pesos individuais']].map(([valor, texto]) => (
            criarElemento('label', { classe: 'segmentado__opcao' }, [
                criarElemento('input', { atributos: { type: 'radio', name: 'modoBiometria', value: valor, checked: valor === 'amostra' } }),
                texto,
            ])))),
    ]);

    const listaPartes = criarElemento('ol', { classe: 'pesagens-parciais', atributos: { 'aria-label': 'Pesagens parciais' } });
    const blocoPartes = criarElemento('div', { classe: 'pesagens-parciais__bloco', atributos: { hidden: true } }, [
        criarElemento('p', { classe: 'campo__rotulo', texto: 'Pesagens parciais' }),
        listaPartes,
        criarElemento('button', { classe: 'botao botao--secundario botao--pequeno', atributos: { type: 'button', 'data-acao-biometria': 'adicionar-parte' } },
            [criarIcone('mais', { classe: 'icone icone--girar' }), 'Adicionar pesagem']),
    ]);
    const linkPartes = criarElemento('button', { classe: 'link', texto: 'Pesei em partes', atributos: { type: 'button', 'data-acao-biometria': 'partes' } });
    const comprimento = criarElemento('details', { classe: 'painel-biometria__comprimento' }, [
        criarElemento('summary', { classe: 'link', texto: 'Medir comprimento' }),
        campo('biometria-comprimento', 'Comprimento médio (cm)', entradaComprimento),
    ]);
    const grupoAmostra = criarElemento('div', { classe: 'painel-biometria__modo' }, [
        campo('biometria-peixes', 'Peixes na amostra', entradaPeixes, { ajuda: 'Em geral, de 30 a 100 peixes.' }),
        campo('biometria-peso', 'Peso total da amostra', entradaPeso, { extra: linkPartes }),
        blocoPartes,
        comprimento,
    ]);
    const grupoIndividuais = criarElemento('div', { classe: 'painel-biometria__modo', atributos: { hidden: true } }, [
        campo('biometria-individuais', 'Peso de cada peixe (g)', entradaIndividuais, { ajuda: 'Um peso por linha, em gramas. Pode colar de uma planilha.' }),
    ]);
    const grupoPesoMedio = criarElemento('div', { classe: 'painel-biometria__modo', atributos: { hidden: true } }, [
        campo('biometria-peso-medio', 'Peso médio (g)', entradaPesoMedio),
    ]);
    const linkPesoMedio = criarElemento('button', { classe: 'link painel-biometria__alternar', texto: 'Já tenho o peso médio', atributos: { type: 'button', 'data-acao-biometria': 'peso-medio' } });

    const previa = criarElemento('aside', { classe: 'painel-biometria__previa', atributos: { 'aria-live': 'polite', 'aria-label': 'Resultado' } });
    const erroGeral = criarElemento('p', { classe: 'formulario__erro-geral', atributos: { role: 'alert', hidden: true } });
    const botaoProximo = criarElemento('button', { classe: 'botao botao--secundario', texto: 'Salvar e ir para o próximo tanque', atributos: { type: 'submit', 'data-proximo': '' } });
    const formulario = criarElemento('form', { classe: 'formulario', atributos: { novalidate: true } }, [
        criarElemento('input', { atributos: { type: 'hidden', name: 'id' } }),
        campo('biometria-data', 'Data', entradaData),
        seletorModo,
        grupoAmostra,
        grupoIndividuais,
        grupoPesoMedio,
        linkPesoMedio,
        campo('biometria-observacoes', 'Observações (opcional)', observacoes),
        erroGeral,
        criarElemento('div', { classe: 'formulario__acoes' }, [
            botaoProximo,
            criarElemento('button', { classe: 'botao botao--primario', texto: 'Salvar', atributos: { type: 'submit' } }),
        ]),
    ]);
    dialogo.replaceChildren(topo, criarElemento('div', { classe: 'painel-biometria__corpo' }, [formulario, previa]));

    const campoPeso = iniciarCampoUnidade(entradaPeso, {
        grandeza: 'pesoAmostra',
        unidades: ['kg', 'g'],
        unidadeInicial: acoes.unidadeAmostra.inicial,
        aoTrocarUnidade: acoes.unidadeAmostra.aoTrocar,
    });

    // ---------- Leitura dos valores ----------

    function lerPesosIndividuais() {
        return entradaIndividuais.value.split(/[\n;]+/).map((linha) => linha.trim()).filter(Boolean).map(paraNumero);
    }

    // Soma das pesagens parciais (ex.: 3 baldes de 10 peixes), sem calculadora.
    function lerPartes() {
        const partes = [...listaPartes.children].map((item) => ({
            peixes: paraNumero(item.querySelector('[data-parte="peixes"]').value),
            pesoKg: paraNumero(item.querySelector('[data-parte="peso"]').value),
        }));
        const completas = partes.filter((parte) => parte.peixes > 0 && parte.pesoKg > 0);
        return {
            completas: completas.length === partes.length && partes.length > 0,
            peixes: completas.reduce((total, parte) => total + parte.peixes, 0),
            pesoG: Math.round(completas.reduce((total, parte) => total + parte.pesoKg, 0) * 1000 * 1e6) / 1e6,
        };
    }

    // O que o painel enviaria agora: a entrada de salvarBiometria.
    function lerEntrada() {
        const base = { id: formulario.elements.namedItem('id').value || null, data: entradaData.value, observacoes: observacoes.value };
        if (modo === 'peso') {
            return { ...base, pesoMedioG: paraNumero(entradaPesoMedio.value) };
        }
        if (modo === 'individuais') {
            return { ...base, biometria: { pesosIndividuaisG: lerPesosIndividuais(), comprimentoMedioCm: null } };
        }
        const partes = emPartes ? lerPartes() : null;
        return {
            ...base,
            biometria: {
                peixesAmostra: partes ? partes.peixes || null : paraNumero(entradaPeixes.value),
                pesoAmostraG: partes ? partes.pesoG || null : campoPeso.lerBase(),
                comprimentoMedioCm: paraNumero(entradaComprimento.value),
            },
        };
    }

    function calcularPesoMedio() {
        const entrada = lerEntrada();
        if (modo === 'peso') {
            return entrada.pesoMedioG > 0 ? entrada.pesoMedioG : null;
        }
        if (modo === 'individuais') {
            const estatisticas = acoes.calcularEstatisticas(entrada.biometria.pesosIndividuaisG.filter((peso) => peso > 0));
            return estatisticas?.mediaG ?? null;
        }
        const { peixesAmostra, pesoAmostraG } = entrada.biometria;
        return peixesAmostra > 0 && pesoAmostraG > 0 ? pesoAmostraG / peixesAmostra : null;
    }

    // ---------- Prévia ao vivo ----------

    function atualizarPrevia() {
        const pesoMedioG = calcularPesoMedio();
        const resultado = acoes.calcularPrevia({ data: entradaData.value || contexto.hoje, pesoMedioG, idEditado: contexto.registro?.id ?? null });
        const linhas = [];
        const linha = (rotulo, texto, classe = '') => linhas.push(criarElemento('div', { classe: `previa__linha ${classe}`.trim() }, [
            criarElemento('dt', { texto: rotulo }),
            criarElemento('dd', { texto }),
        ]));
        if (pesoMedioG) {
            linha('Peso médio', formatarGramas(pesoMedioG), 'previa__linha--destaque');
            if (resultado.dias > 0) {
                const sinal = resultado.ganhoG >= 0 ? '+' : '−';
                linha('Desde a anterior', `${sinal}${formatarGramas(Math.abs(resultado.ganhoG))} em ${pluralizar(resultado.dias, 'dia', 'dias')}`
                    + (resultado.ganhoDiarioG !== null ? ` · ${formatarNumero(resultado.ganhoDiarioG, 1)} g/dia` : ''));
            }
            if (resultado.pesoAlvoG) {
                linha('Alvo', `${formatarGramas(resultado.pesoAlvoG)} (${formatarPercentual(resultado.percentualAlvo)})`);
            }
            linha('Biomassa ≈', `${formatarBiomassa(resultado.biomassaDepoisKg)} (antes: ${formatarBiomassa(resultado.biomassaAntesKg)})`);
            if (resultado.racaoDepois) {
                linha('Ração', `passa a ser ${formatarRacao(resultado.racaoDepois.racaoDiaKg)} por dia`
                    + (resultado.racaoAntes ? ` (antes: ${formatarRacao(resultado.racaoAntes.racaoDiaKg)})` : ''));
            }
        } else {
            linhas.push(criarElemento('p', { classe: 'previa__vazia', texto: 'Preencha a pesagem para ver o peso médio e o que muda no tanque.' }));
        }
        if (modo === 'individuais') {
            const estatisticas = acoes.calcularEstatisticas(lerPesosIndividuais().filter((peso) => peso > 0));
            if (estatisticas && estatisticas.quantidade > 1) {
                linha('Peixes', formatarInteiro(estatisticas.quantidade));
                linha('Menor e maior', `${formatarGramas(estatisticas.menorG)} e ${formatarGramas(estatisticas.maiorG)}`);
                linha('Variação (CV)', `${formatarPercentual(estatisticas.cvPct)} · ${estatisticas.uniforme ? 'Lote uniforme' : 'Lote desuniforme: considere classificar'}`,
                    estatisticas.uniforme ? '' : 'previa__linha--atencao');
            }
        }
        const aviso = resultado.caiuMuito
            ? criarElemento('p', { classe: 'previa__aviso', texto: 'O peso médio caiu em relação à última biometria. Confira os valores.' })
            : null;
        previa.replaceChildren(...[
            criarElemento('h3', { classe: 'previa__titulo', texto: 'Resultado' }),
            criarElemento('dl', { classe: 'previa__lista' }, linhas),
            aviso,
        ].filter(Boolean));
    }

    // ---------- Modos ----------

    function definirModo(novo) {
        modo = novo;
        grupoAmostra.hidden = modo !== 'amostra';
        grupoIndividuais.hidden = modo !== 'individuais';
        grupoPesoMedio.hidden = modo !== 'peso';
        seletorModo.hidden = modo === 'peso';
        linkPesoMedio.textContent = modo === 'peso' ? 'Voltar para a amostra' : 'Já tenho o peso médio';
        for (const opcao of formulario.elements.modoBiometria) {
            opcao.checked = opcao.value === modo;
        }
        atualizarPrevia();
    }

    function definirPartes(ativo) {
        emPartes = ativo;
        blocoPartes.hidden = !ativo;
        formulario.querySelector('#grupo-biometria-peixes').hidden = ativo;
        entradaPeso.closest('.campo').querySelector('.campo__com-unidade').hidden = ativo;
        formulario.querySelector(`#conversao-${entradaPeso.id}`).hidden = ativo;
        linkPartes.textContent = ativo ? 'Pesei tudo junto' : 'Pesei em partes';
        if (ativo && listaPartes.children.length === 0) {
            adicionarParte();
            adicionarParte();
        }
        atualizarPrevia();
    }

    function adicionarParte() {
        const numero = listaPartes.children.length + 1;
        const entrada = (parte, rotulo, modoTeclado) => criarElemento('label', { classe: 'pesagens-parciais__campo' }, [
            criarElemento('span', { texto: rotulo }),
            criarElemento('input', { classe: 'campo__input', atributos: { type: 'text', inputmode: modoTeclado, autocomplete: 'off', 'data-parte': parte } }),
        ]);
        listaPartes.append(criarElemento('li', { classe: 'pesagens-parciais__item' }, [
            criarElemento('span', { classe: 'pesagens-parciais__numero', texto: `${numero}ª` }),
            entrada('peixes', 'Peixes', 'numeric'),
            entrada('peso', 'Peso (kg)', 'decimal'),
        ]));
    }

    // ---------- Eventos ----------

    formulario.addEventListener('input', () => {
        sujo = true;
        atualizarPrevia();
    });
    formulario.addEventListener('change', (evento) => {
        if (evento.target.name === 'modoBiometria') {
            definirModo(evento.target.value);
        }
        atualizarPrevia();
    });
    formulario.addEventListener('click', (evento) => {
        const alvo = evento.target.closest('[data-acao-biometria]');
        irParaProximo = Boolean(evento.target.closest('[data-proximo]'));
        if (!alvo) {
            return;
        }
        const acao = alvo.dataset.acaoBiometria;
        if (acao === 'partes') {
            definirPartes(!emPartes);
        } else if (acao === 'adicionar-parte') {
            adicionarParte();
            listaPartes.lastElementChild.querySelector('input').focus();
        } else if (acao === 'peso-medio') {
            definirModo(modo === 'peso' ? 'amostra' : 'peso');
        }
    });

    // Fechar com algo digitado pede confirmação (seção 7.13).
    async function pedirParaFechar() {
        if (sujo && !(await confirmar('Descartar esta biometria? O que você digitou não será salvo.', { textoConfirmar: 'Descartar' }))) {
            return;
        }
        dialogo.close();
    }
    fechar.addEventListener('click', pedirParaFechar);
    dialogo.addEventListener('cancel', (evento) => {
        evento.preventDefault();
        pedirParaFechar();
    });

    iniciarFormulario(formulario, {
        erroGeral,
        aoEnviar: () => {
            const entrada = lerEntrada();
            if (modo === 'amostra' && emPartes && !lerPartes().completas) {
                throw new Error('Preencha os peixes e o peso de cada pesagem (ou remova a pesagem vazia).');
            }
            try {
                acoes.salvar(entrada, { irParaProximo });
                sujo = false;
            } catch (erro) {
                // Em partes, os campos de amostra estão escondidos: o erro vai para o aviso geral.
                if (emPartes && modo === 'amostra' && erro?.erros && (erro.erros.peixesAmostra || erro.erros.pesoAmostraG)) {
                    throw new Error(Object.values(erro.erros).filter(Boolean).join(' '));
                }
                throw erro;
            }
        },
    });

    // ---------- Abrir ----------

    // contexto: { tanque: { id, nome, especie, cor }, diaCiclo, ultima: { pesoMedioG, data } | null,
    //             proxima: { data, diasAtraso }, hoje, dataMinima, data, peixesSugeridos, registro, temProximo }
    function abrir(novo) {
        const trocouDeTanque = dialogo.open && contexto && contexto.tanque.id !== novo.tanque.id;
        contexto = novo;
        sujo = false;
        faixa.style.setProperty('--cor-serie', novo.tanque.cor);
        nomeTanque.textContent = novo.tanque.nome;
        detalheTanque.textContent = [
            novo.tanque.especie,
            `dia ${formatarInteiro(novo.diaCiclo)} do ciclo`,
            novo.ultima ? `Última biometria: ${formatarGramas(novo.ultima.pesoMedioG)} em ${formatarDataCurta(novo.ultima.data)}` : 'Primeira biometria do ciclo',
        ].join(' · ');
        // Na rodada de biometria, a troca de tanque fica evidente (seção 7.13).
        troca.textContent = trocouDeTanque ? `Agora: ${novo.tanque.nome}` : '';
        topo.classList.remove('painel-biometria__topo--troca');
        if (trocouDeTanque) {
            void topo.offsetWidth;
            topo.classList.add('painel-biometria__topo--troca');
        }

        limparErrosFormulario(formulario, erroGeral);
        formulario.reset();
        listaPartes.replaceChildren();
        definirPartes(false);
        entradaData.max = novo.hoje;
        entradaData.min = novo.dataMinima;
        const registro = novo.registro;
        preencherFormulario(formulario, {
            id: registro?.id ?? '',
            data: registro?.data ?? novo.data,
            peixesAmostra: registro?.biometria?.pesosIndividuaisG ? null : registro?.biometria?.peixesAmostra ?? novo.peixesSugeridos,
            comprimentoMedioCm: registro?.biometria?.comprimentoMedioCm ?? null,
            pesoMedioG: registro && !registro.biometria ? registro.pesoMedioG : null,
            pesosIndividuaisG: '',
            observacoes: registro?.observacoes ?? '',
        });
        campoPeso.definirBase(registro?.biometria && !registro.biometria.pesosIndividuaisG ? registro.biometria.pesoAmostraG : null);
        if (registro?.biometria?.pesosIndividuaisG) {
            entradaIndividuais.value = registro.biometria.pesosIndividuaisG.map((peso) => formatarNumero(peso, 2).replace(/\./g, '')).join('\n');
        }
        comprimento.open = Boolean(registro?.biometria?.comprimentoMedioCm);
        definirModo(registro?.biometria?.pesosIndividuaisG ? 'individuais' : registro && !registro.biometria ? 'peso' : 'amostra');
        botaoProximo.hidden = !novo.temProximo;
        if (!dialogo.open) {
            dialogo.showModal();
        }
        (registro ? entradaData : modo === 'amostra' ? (entradaPeixes.value ? entradaPeso : entradaPeixes) : entradaIndividuais).focus();
        sujo = false;
    }

    return {
        abrir,
        fechar: () => dialogo.close(),
        estaAberto: () => dialogo.open,
        // Texto curto do que foi salvo, para a mensagem da página.
        resumir: (pesoMedioG, data) => `Biometria de ${formatarData(data)} salva: ${formatarGramas(pesoMedioG)}.`,
    };
}
