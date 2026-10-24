// Editor do plano de alimentação (seção 7.14; "tabela de arraçoamento" no termo
// técnico). Fica num <dialog> e é usado em Configurações e no formulário do
// tanque. Não lê nem grava dados (seção 10): a página passa as ações.

import { paraNumero } from '../core/utils.js';
import { formatarGramas, formatarNumero, formatarPercentual, formatarRacao, pluralizar } from '../core/format.js';
import { criarElemento, iniciarFormulario, limparErrosFormulario } from './componentes.js';
import { criarIcone } from './icones.js';

const EXPLICACAO = [
    'O plano diz quanto de ração dar por dia, como uma porcentagem do peso total dos peixes no tanque.',
    'Exemplo: se o tanque tem 500 kg de peixe e o plano diz 3%, você dá 15 kg de ração por dia. Com 4 refeições, são 3,75 kg em cada.',
];

// acoes: { salvar(entrada) → plano, calcularSugestao(plano, { pesoMedioG, biomassaKg }) → { sugestao, motivo }, modelo: { nome, aviso, faixas } }
export function criarEditorPlano(dialogo, acoes) {
    let aoSalvar = () => {};
    let tipo = 'faixas';

    const numero = (valor, casas = 2) => (valor === null || valor === undefined ? '' : formatarNumero(valor, casas).replace(/\./g, ''));
    const entrada = (nome, rotulo, modo, { valor = '', classe = 'campo__input campo__input--curto' } = {}) => criarElemento('input', {
        classe,
        atributos: { name: nome, type: 'text', inputmode: modo, autocomplete: 'off', value: valor, 'aria-label': rotulo },
    });
    const erro = () => criarElemento('p', { classe: 'campo__erro' });

    // ---------- Estrutura ----------

    const titulo = criarElemento('h2', { classe: 'dialogo__titulo', texto: 'Plano de alimentação', atributos: { id: 'titulo-editor-plano' } });
    const nome = criarElemento('input', { classe: 'campo__input', atributos: { id: 'plano-nome', name: 'nome', type: 'text', maxlength: '80', autocomplete: 'off', 'aria-describedby': 'erro-plano-nome' } });
    const seletorTipo = criarElemento('fieldset', { classe: 'campo campo--grupo' }, [
        criarElemento('legend', { classe: 'campo__rotulo', texto: 'Como o plano funciona?' }),
        criarElemento('div', { classe: 'segmentado' }, [['fixo', 'Porcentagem fixa'], ['faixas', 'Muda com o tamanho do peixe']].map(([valor, texto]) => (
            criarElemento('label', { classe: 'segmentado__opcao' }, [
                criarElemento('input', { atributos: { type: 'radio', name: 'tipo', value: valor } }),
                texto,
            ])))),
    ]);

    const taxaFixa = entrada('taxaPct', 'Quanto dar por dia, em porcentagem do peso total do tanque', 'decimal');
    const refeicoesFixa = entrada('refeicoes', 'Em quantas refeições dividir', 'numeric');
    taxaFixa.id = 'plano-taxa';
    refeicoesFixa.id = 'plano-refeicoes';
    taxaFixa.setAttribute('aria-describedby', 'erro-plano-taxa');
    refeicoesFixa.setAttribute('aria-describedby', 'erro-plano-refeicoes');
    const grupoFixo = criarElemento('div', { classe: 'plano__fixo' }, [
        criarElemento('p', { classe: 'plano__frase' }, ['Quanto dar por dia: ', taxaFixa, ' % do peso total do tanque']),
        criarElemento('p', { classe: 'campo__erro', atributos: { id: 'erro-plano-taxa' } }),
        criarElemento('p', { classe: 'plano__frase' }, ['Dividir em ', refeicoesFixa, ' refeições']),
        criarElemento('p', { classe: 'campo__erro', atributos: { id: 'erro-plano-refeicoes' } }),
    ]);

    const listaFaixas = criarElemento('ol', { classe: 'plano__faixas' });
    const regua = criarElemento('div', { classe: 'plano__regua', atributos: { role: 'img' } });
    const grupoFaixas = criarElemento('div', { classe: 'plano__grupo-faixas' }, [
        regua,
        listaFaixas,
        criarElemento('button', { classe: 'botao botao--secundario botao--pequeno', atributos: { type: 'button', 'data-acao-plano': 'adicionar' } },
            [criarIcone('mais', { classe: 'icone icone--girar' }), 'Adicionar faixa']),
    ]);

    const avisoModelo = criarElemento('p', { classe: 'aviso-info', atributos: { hidden: true } });
    const simPeso = entrada('simuladorPeso', 'Peso médio dos peixes, em gramas', 'decimal', { classe: 'campo__input campo__input--curto' });
    const simBiomassa = entrada('simuladorBiomassa', 'Peso total dos peixes no tanque, em kg', 'decimal', { classe: 'campo__input campo__input--curto' });
    const resultadoSimulador = criarElemento('p', { classe: 'plano__resultado', atributos: { 'aria-live': 'polite' } });
    const simulador = criarElemento('aside', { classe: 'plano__simulador', atributos: { 'aria-labelledby': 'titulo-simulador-plano' } }, [
        criarElemento('h3', { classe: 'plano__simulador-titulo', texto: 'Simular', atributos: { id: 'titulo-simulador-plano' } }),
        criarElemento('p', { classe: 'plano__frase' }, ['Peixes com ', simPeso, ' g']),
        criarElemento('p', { classe: 'plano__frase' }, ['Peso total no tanque: ', simBiomassa, ' kg']),
        resultadoSimulador,
    ]);

    const erroGeral = criarElemento('p', { classe: 'formulario__erro-geral', atributos: { role: 'alert', hidden: true } });
    const formulario = criarElemento('form', { classe: 'formulario', atributos: { id: 'formulario-plano', novalidate: true } }, [
        criarElemento('input', { atributos: { type: 'hidden', name: 'id' } }),
        ...EXPLICACAO.map((texto) => criarElemento('p', { classe: 'plano__explicacao', texto })),
        criarElemento('div', { classe: 'campo' }, [
            criarElemento('label', { classe: 'campo__rotulo', texto: 'Nome do plano', atributos: { for: 'plano-nome' } }),
            nome,
            criarElemento('p', { classe: 'campo__erro', atributos: { id: 'erro-plano-nome' } }),
        ]),
        seletorTipo,
        criarElemento('div', { classe: 'plano__corpo' }, [
            criarElemento('div', {}, [grupoFixo, grupoFaixas, avisoModelo]),
            simulador,
        ]),
        criarElemento('p', { classe: 'campo__ajuda', texto: 'No termo técnico, este plano é a tabela de arraçoamento. A porcentagem depende da espécie, da ração e da temperatura da água: use a do fabricante da ração ou do seu técnico.' }),
        erroGeral,
        criarElemento('div', { classe: 'formulario__acoes' }, [
            criarElemento('button', { classe: 'botao botao--secundario', texto: 'Usar um modelo', atributos: { type: 'button', 'data-acao-plano': 'modelo' } }),
            criarElemento('button', { classe: 'botao botao--secundario', texto: 'Cancelar', atributos: { type: 'button', 'data-acao-plano': 'cancelar' } }),
            criarElemento('button', { classe: 'botao botao--primario', texto: 'Salvar plano', atributos: { type: 'submit' } }),
        ]),
    ]);
    dialogo.replaceChildren(criarElemento('div', { classe: 'dialogo__conteudo' }, [titulo, formulario]));

    // ---------- Faixas como frases ----------

    // "Peixes de 190 g a 225 g → 3,4% do peso total por dia, em 4 refeições"
    function criarFaixa(faixa = {}) {
        const campos = {
            pesoDeG: entrada('', 'Peso inicial da faixa, em gramas', 'decimal', { valor: numero(faixa.pesoDeG, 1) }),
            pesoAteG: entrada('', 'Peso final da faixa, em gramas', 'decimal', { valor: numero(faixa.pesoAteG, 1) }),
            taxaPct: entrada('', 'Quanto dar por dia, em porcentagem do peso total do tanque', 'decimal', { valor: numero(faixa.taxaPct) }),
            refeicoes: entrada('', 'Em quantas refeições dividir', 'numeric', { valor: numero(faixa.refeicoes, 0) }),
        };
        for (const [chave, campo] of Object.entries(campos)) {
            campo.dataset.coluna = chave;
        }
        return criarElemento('li', { classe: 'plano__faixa' }, [
            criarElemento('p', { classe: 'plano__resumo-faixa', atributos: { 'aria-live': 'polite' } }),
            criarElemento('p', { classe: 'plano__frase' }, ['Peso dos peixes: de ', campos.pesoDeG, ' g até ', campos.pesoAteG, ' g']),
            erro(), erro(),
            criarElemento('p', { classe: 'plano__frase' }, ['Quanto dar por dia: ', campos.taxaPct, ' % do peso total do tanque']),
            erro(),
            criarElemento('p', { classe: 'plano__frase' }, ['Dividir em ', campos.refeicoes, ' refeições']),
            erro(),
            criarElemento('button', { classe: 'link link--perigo', texto: 'Remover faixa', atributos: { type: 'button', 'data-acao-plano': 'remover' } }),
        ]);
    }

    // name e ids seguem a posição da faixa, para os erros (RN24) caírem no campo certo.
    function renumerar() {
        [...listaFaixas.children].forEach((item, indice) => {
            const erros = item.querySelectorAll('.campo__erro');
            item.querySelectorAll('input[data-coluna]').forEach((campo, posicao) => {
                const idErro = `erro-plano-faixa-${indice}-${campo.dataset.coluna}`;
                campo.name = `faixas.${indice}.${campo.dataset.coluna}`;
                campo.id = `plano-faixa-${indice}-${campo.dataset.coluna}`;
                campo.setAttribute('aria-describedby', idErro);
                erros[posicao].id = idErro;
            });
            item.querySelector('[data-acao-plano="remover"]').setAttribute('aria-label', `Remover a faixa ${indice + 1}`);
        });
    }

    function lerFaixas() {
        return [...listaFaixas.children].map((item) => {
            const valor = (coluna) => paraNumero(item.querySelector(`[data-coluna="${coluna}"]`).value);
            return { pesoDeG: valor('pesoDeG'), pesoAteG: valor('pesoAteG'), taxaPct: valor('taxaPct'), refeicoes: valor('refeicoes') };
        });
    }

    function lerPlano() {
        return tipo === 'fixo'
            ? { tipo, taxaPct: paraNumero(taxaFixa.value), refeicoes: paraNumero(refeicoesFixa.value), faixas: [] }
            : { tipo, faixas: lerFaixas() };
    }

    // ---------- Régua, frases e simulador, atualizados a cada digitação ----------

    function atualizar() {
        const faixas = lerFaixas();
        [...listaFaixas.children].forEach((item, indice) => {
            const faixa = faixas[indice];
            const completa = [faixa.pesoDeG, faixa.pesoAteG, faixa.taxaPct, faixa.refeicoes].every((valor) => Number.isFinite(valor));
            item.querySelector('.plano__resumo-faixa').textContent = completa
                ? `Peixes de ${formatarGramas(faixa.pesoDeG)} a ${formatarGramas(faixa.pesoAteG)} → ${formatarPercentual(faixa.taxaPct)} do peso total por dia, em ${pluralizar(faixa.refeicoes, 'refeição', 'refeições')}`
                : `Faixa ${indice + 1}: preencha os pesos, a porcentagem e as refeições`;
        });
        desenharRegua(faixas.filter((faixa) => faixa.pesoAteG > faixa.pesoDeG && Number.isFinite(faixa.pesoDeG)));
        simular();
    }

    function desenharRegua(faixas) {
        const peso = paraNumero(simPeso.value);
        regua.hidden = faixas.length === 0;
        if (faixas.length === 0) {
            regua.replaceChildren();
            return;
        }
        const minimo = Math.min(...faixas.map((faixa) => faixa.pesoDeG));
        const maximo = Math.max(...faixas.map((faixa) => faixa.pesoAteG));
        const posicao = (valor) => `${((valor - minimo) / (maximo - minimo)) * 100}%`;
        const segmentos = faixas.map((faixa) => {
            // Sem número dentro: com muitas faixas eles se sobrepõem. O detalhe fica no title e nas frases.
            const segmento = criarElemento('span', { classe: 'plano__segmento', atributos: { title: `${formatarGramas(faixa.pesoDeG)} a ${formatarGramas(faixa.pesoAteG)}: ${formatarPercentual(faixa.taxaPct)}` } });
            segmento.style.setProperty('--inicio', posicao(faixa.pesoDeG));
            segmento.style.setProperty('--fim', posicao(faixa.pesoAteG));
            return segmento;
        });
        const dentro = peso >= minimo && peso <= maximo;
        const marcador = peso > 0 && dentro ? criarElemento('span', { classe: 'plano__marcador', texto: 'seus peixes estão aqui' }) : null;
        marcador?.style.setProperty('--posicao', posicao(peso));
        regua.setAttribute('aria-label', `Faixas de ${formatarGramas(minimo)} a ${formatarGramas(maximo)}`
            + (marcador ? `; peixes com ${formatarGramas(peso)}` : ''));
        regua.replaceChildren(
            criarElemento('div', { classe: 'plano__trilho' }, [...segmentos, marcador]),
            criarElemento('div', { classe: 'plano__limites' }, [
                criarElemento('span', { texto: formatarGramas(minimo) }),
                criarElemento('span', { texto: formatarGramas(maximo) }),
            ]),
        );
    }

    function simular() {
        const pesoMedioG = paraNumero(simPeso.value);
        const biomassaKg = paraNumero(simBiomassa.value);
        if (!(pesoMedioG > 0 && biomassaKg > 0)) {
            resultadoSimulador.textContent = 'Informe o peso médio e o peso total para ver a ração do dia.';
            return;
        }
        const { sugestao, motivo } = acoes.calcularSugestao(lerPlano(), { pesoMedioG, biomassaKg });
        if (motivo === 'fora-da-tabela') {
            resultadoSimulador.textContent = `Nenhuma faixa cobre ${formatarGramas(pesoMedioG)}. Adicione uma faixa para peixes ${tipo === 'faixas' && lerFaixas().some((faixa) => faixa.pesoDeG > pesoMedioG) ? 'menores' : 'maiores'}.`;
            return;
        }
        if (!sugestao || !Number.isFinite(sugestao.racaoDiaKg)) {
            resultadoSimulador.textContent = 'Complete o plano para ver a ração do dia.';
            return;
        }
        const faixa = sugestao.faixa ? `Faixa usada: ${formatarNumero(sugestao.faixa.pesoDeG)} a ${formatarNumero(sugestao.faixa.pesoAteG)} g → ` : '';
        resultadoSimulador.replaceChildren(
            `${faixa}${formatarPercentual(sugestao.taxaPct)} → `,
            criarElemento('strong', { texto: `${formatarRacao(sugestao.racaoDiaKg)} por dia` }),
            ', ',
            criarElemento('strong', { texto: `${pluralizar(sugestao.refeicoes, 'refeição', 'refeições')} de ${formatarRacao(sugestao.racaoRefeicaoKg)}` }),
        );
    }

    function definirTipo(novo) {
        tipo = novo;
        grupoFixo.hidden = tipo !== 'fixo';
        grupoFaixas.hidden = tipo !== 'faixas';
        for (const opcao of formulario.elements.tipo) {
            opcao.checked = opcao.value === tipo;
        }
        atualizar();
    }

    function preencherFaixas(faixas) {
        listaFaixas.replaceChildren(...faixas.map(criarFaixa));
        renumerar();
    }

    // ---------- Eventos ----------

    formulario.addEventListener('input', atualizar);
    formulario.addEventListener('change', (evento) => {
        if (evento.target.name === 'tipo') {
            definirTipo(evento.target.value);
        }
    });
    formulario.addEventListener('click', (evento) => {
        const botao = evento.target.closest('[data-acao-plano]');
        if (!botao) {
            return;
        }
        const acao = botao.dataset.acaoPlano;
        if (acao === 'adicionar') {
            // A nova faixa começa onde a anterior termina.
            const ultima = lerFaixas().at(-1);
            listaFaixas.append(criarFaixa({ pesoDeG: ultima?.pesoAteG ?? null, refeicoes: ultima?.refeicoes ?? null }));
            renumerar();
            listaFaixas.lastElementChild.querySelector('[data-coluna="pesoAteG"]').focus();
            atualizar();
        } else if (acao === 'remover') {
            botao.closest('li').remove();
            renumerar();
            atualizar();
        } else if (acao === 'modelo') {
            nome.value = acoes.modelo.nome;
            definirTipo('faixas');
            preencherFaixas(acoes.modelo.faixas);
            avisoModelo.textContent = acoes.modelo.aviso;
            avisoModelo.hidden = false;
            atualizar();
        } else if (acao === 'cancelar') {
            dialogo.close();
        }
    });
    iniciarFormulario(formulario, {
        erroGeral,
        aoEnviar: (valores) => {
            const plano = acoes.salvar({ id: valores.id || null, nome: valores.nome, ...lerPlano() });
            dialogo.close();
            aoSalvar(plano);
        },
    });

    // ---------- Abrir ----------

    // simulacao: { pesoMedioG, biomassaKg } do tanque, para o simulador e a régua.
    function abrir(plano = null, { simulacao = null, depoisDeSalvar = () => {} } = {}) {
        aoSalvar = depoisDeSalvar;
        limparErrosFormulario(formulario, erroGeral);
        titulo.textContent = plano ? 'Editar plano de alimentação' : 'Novo plano de alimentação';
        formulario.elements.namedItem('id').value = plano?.id ?? '';
        nome.value = plano?.nome ?? '';
        taxaFixa.value = plano?.tipo === 'fixo' ? numero(plano.taxaPct) : '';
        refeicoesFixa.value = plano?.tipo === 'fixo' ? numero(plano.refeicoes, 0) : '';
        preencherFaixas(plano?.tipo === 'faixas' ? plano.faixas : [{}]);
        avisoModelo.hidden = !(plano && plano.nome === acoes.modelo.nome);
        avisoModelo.textContent = acoes.modelo.aviso;
        simPeso.value = simulacao?.pesoMedioG ? numero(simulacao.pesoMedioG, 1) : '';
        simBiomassa.value = simulacao?.biomassaKg ? numero(simulacao.biomassaKg, 1) : '';
        definirTipo(plano?.tipo ?? 'faixas');
        dialogo.showModal();
        nome.focus();
    }

    return { abrir };
}
