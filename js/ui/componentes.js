// Componentes de interface: criação de elementos, cartões, selos, listas,
// formulários, diálogo de confirmação e abas. Não lê nem grava dados (seção
// 10): recebe das páginas os textos já formatados. Texto do usuário entra
// sempre por textContent (seção 11.2).

import { formatarKg, formatarNumero, formatarPercentual, pluralizar } from '../core/format.js';

// ---------- Elementos ----------

export function criarElemento(tag, { classe, texto, atributos = {} } = {}, filhos = []) {
    const elemento = document.createElement(tag);
    if (classe) {
        elemento.className = classe;
    }
    if (texto !== undefined && texto !== null) {
        elemento.textContent = texto;
    }
    for (const [nome, valor] of Object.entries(atributos)) {
        if (valor !== null && valor !== undefined && valor !== false) {
            elemento.setAttribute(nome, valor === true ? '' : valor);
        }
    }
    elemento.append(...filhos.filter((filho) => filho !== null && filho !== undefined && filho !== false));
    return elemento;
}

export function criarSelo(texto, variante) {
    return criarElemento('span', { classe: variante ? `selo selo--${variante}` : 'selo', texto });
}

// Preenche os elementos [data-indicador] e [data-campo] de uma área da página.
export function preencherIndicadores(raiz, valores) {
    preencher(raiz, 'indicador', valores);
}

export function preencherCampos(raiz, valores) {
    preencher(raiz, 'campo', valores);
}

function preencher(raiz, gancho, valores) {
    for (const elemento of raiz.querySelectorAll(`[data-${gancho}]`)) {
        const chave = elemento.dataset[gancho];
        if (chave in valores) {
            elemento.textContent = valores[chave] ?? '—';
        }
    }
}

// ---------- Cartões e listas ----------

export function criarCartaoTanque({ nome, nivelTitulo = 2, especie, selo, metricas, extra = null, acoes }) {
    return criarElemento('article', { classe: 'cartao-tanque' }, [
        criarElemento('div', { classe: 'cartao-tanque__cabecalho' }, [
            criarElemento(`h${nivelTitulo}`, { classe: 'cartao-tanque__nome', texto: nome }),
            selo && criarSelo(selo.texto, selo.variante),
        ]),
        criarElemento('p', { classe: 'cartao-tanque__especie', texto: especie }),
        criarElemento('dl', { classe: 'cartao-tanque__metricas' }, metricas.map(({ rotulo, valor }) => (
            criarElemento('div', { classe: 'cartao-tanque__metrica' }, [
                criarElemento('dt', { texto: rotulo }),
                criarElemento('dd', { texto: valor }),
            ])
        ))),
        extra,
        criarElemento('div', { classe: 'cartao-tanque__acoes' }, acoes.map(({ texto, href }) => (
            // Vários cartões têm "Ver detalhes": o nome do tanque no rótulo diferencia os links.
            criarElemento('a', { classe: 'link', texto, atributos: { href, 'aria-label': `${texto}: ${nome}` } })
        ))),
    ]);
}

export function renderizarAlertas(lista, alertas, { mostrarTanque = false, hrefTanque = null, textoVazio = 'Nenhum alerta.' } = {}) {
    if (alertas.length === 0) {
        lista.replaceChildren(criarElemento('li', { classe: 'lista-alertas__vazio', texto: textoVazio }));
        return;
    }
    lista.replaceChildren(...alertas.map((alerta) => {
        const detalhe = criarElemento('span', { classe: 'lista-alertas__detalhe' });
        if (mostrarTanque) {
            detalhe.append(criarElemento('a', { classe: 'link', texto: alerta.tanqueNome, atributos: { href: hrefTanque(alerta) } }), ' · ');
        }
        detalhe.append(alerta.descricao);
        return criarElemento('li', { classe: `lista-alertas__item lista-alertas__item--${alerta.gravidade}` }, [
            criarElemento('span', { classe: 'lista-alertas__titulo' }, [
                alerta.titulo,
                // A gravidade vai escrita, nunca só na cor (seção 2.3).
                criarSelo(alerta.rotuloGravidade, `alerta-${alerta.gravidade}`),
            ]),
            detalhe,
        ]);
    }));
}

// Barra de capacidade com animação de água (seção 5). 100% é a carga máxima do
// tanque. As faixas têm sempre rótulo escrito; a cor só reforça. Sem densidade
// máxima definida, a barra fica tracejada com o link para defini-la.
export function criarBarraCapacidade({
    percentual,
    cargaKg,
    cargaMaximaKg,
    densidade,
    densidadeMaxima,
    limiteAlerta,
    projecaoDias = null,
    compacta = false,
    hrefDefinir,
}) {
    const classes = ['barra-agua'];
    if (compacta) {
        classes.push('barra-agua--compacta');
    }
    const topo = (filhos) => criarElemento('div', { classe: 'barra-agua__topo' }, [
        criarElemento('span', { classe: 'barra-agua__rotulo', texto: 'Capacidade' }),
        ...filhos,
    ]);

    if (percentual === null || percentual === undefined) {
        classes.push('barra-agua--indefinida');
        return criarElemento('div', { classe: classes.join(' ') }, [
            topo([]),
            criarElemento('div', { classe: 'barra-agua__trilho', atributos: { 'aria-hidden': 'true' } }),
            criarElemento('p', { classe: 'barra-agua__detalhe' }, [
                criarElemento('a', { classe: 'link', texto: 'Defina a capacidade', atributos: { href: hrefDefinir } }),
            ]),
        ]);
    }

    const faixa = definirFaixaCapacidade(percentual, limiteAlerta);
    if (faixa) {
        classes.push(`barra-agua--${faixa.variante}`);
    }
    const textoValor = `${formatarPercentual(percentual)}, ${formatarNumero(cargaKg, 1)} de ${formatarKg(cargaMaximaKg)}`;

    const agua = criarElemento('div', { classe: 'barra-agua__agua' }, [
        criarElemento('div', { classe: 'barra-agua__preenchimento' }, [
            criarElemento('span', { classe: 'barra-agua__reflexo' }),
            // Bolhas só na barra grande: na compacta viram ruído.
            ...(compacta ? [] : Array.from({ length: 4 }, () => criarElemento('span', { classe: 'barra-agua__bolha' }))),
        ]),
        criarElemento('span', { classe: 'barra-agua__onda' }),
    ]);
    agua.style.setProperty('--nivel', `${Math.min(percentual, 100)}%`);
    const marca = criarElemento('span', { classe: 'barra-agua__marca' });
    marca.style.setProperty('--posicao', `${Math.min(limiteAlerta, 100)}%`);

    const detalhe = compacta
        ? `${formatarKg(cargaKg)} de ${formatarKg(cargaMaximaKg)}`
        : `${formatarKg(cargaKg)} de ${formatarKg(cargaMaximaKg)} · ${formatarNumero(densidade, 2, 2)} de ${formatarNumero(densidadeMaxima, 2, 2)} kg/m³`;

    return criarElemento('div', { classe: classes.join(' ') }, [
        topo([
            faixa && criarElemento('span', { classe: 'barra-agua__faixa', texto: faixa.rotulo }),
            criarElemento('span', { classe: 'barra-agua__valor', texto: formatarPercentual(percentual) }),
        ]),
        criarElemento('div', {
            classe: 'barra-agua__trilho',
            atributos: {
                role: 'progressbar',
                'aria-label': 'Capacidade',
                'aria-valuemin': '0',
                'aria-valuemax': '100',
                'aria-valuenow': String(Math.round(Math.min(percentual, 100))),
                'aria-valuetext': textoValor,
            },
        }, [agua, marca]),
        criarElemento('p', { classe: 'barra-agua__detalhe', texto: detalhe }),
        !compacta && projecaoDias && criarElemento('p', {
            classe: 'barra-agua__detalhe',
            texto: `No ritmo atual, atinge o limite em ~${pluralizar(projecaoDias, 'dia', 'dias')}.`,
        }),
    ]);
}

// Seção 5.1: até 75% a água fica calma; depois, atenção; a partir do limite de
// alerta do tanque, perto do limite; acima de 100%, acima do limite.
function definirFaixaCapacidade(percentual, limiteAlerta) {
    if (percentual > 100) {
        return { variante: 'acima', rotulo: 'Acima do limite' };
    }
    if (percentual >= limiteAlerta) {
        return { variante: 'perto', rotulo: 'Perto do limite' };
    }
    if (percentual > 75) {
        return { variante: 'atencao', rotulo: 'Atenção' };
    }
    return null;
}

export function criarItemRegistro({ data, resumo }) {
    return criarElemento('li', { classe: 'lista-registros__item' }, [
        criarElemento('span', { classe: 'lista-registros__data', texto: data }),
        criarElemento('span', { classe: 'lista-registros__resumo', texto: resumo }),
    ]);
}

// ---------- Mensagens ----------

export function mostrarMensagem(elemento, texto, { erro = false } = {}) {
    elemento.textContent = texto;
    elemento.classList.toggle('mensagem--erro', erro);
}

// Erro de uma ação. Erros de validação do domínio trazem a mensagem para o
// produtor; os inesperados também vão para o console, para diagnóstico.
export function mostrarErro(elemento, erro) {
    if (!erro?.erros) {
        console.error(erro);
    }
    mostrarMensagem(elemento, erro?.message || 'Algo deu errado. Tente de novo.', { erro: true });
}

// Erro ao montar a página, como o navegador bloquear o armazenamento local.
export function mostrarErroPagina(erro) {
    console.error(erro);
    const aviso = criarElemento('p', {
        classe: 'aviso-vazio',
        texto: erro?.message || 'Não foi possível carregar esta página.',
        atributos: { role: 'alert' },
    });
    document.querySelector('main').prepend(aviso);
}

// ---------- Formulários ----------

// Liga o envio do formulário: lê os campos, chama aoEnviar e, se o domínio
// recusar, mostra cada erro no seu campo (as chaves dos erros são os names).
export function iniciarFormulario(formulario, { erroGeral, mensagem = null, aoEnviar }) {
    formulario.addEventListener('input', (evento) => limparErroCampo(evento.target));
    formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        limparErrosFormulario(formulario, erroGeral);
        if (mensagem) {
            mostrarMensagem(mensagem, '');
        }
        try {
            await aoEnviar(lerFormulario(formulario));
        } catch (erro) {
            mostrarErrosFormulario(formulario, erro, erroGeral);
        }
    });
}

export function lerFormulario(formulario) {
    const valores = {};
    for (const campo of formulario.elements) {
        if (!campo.name || campo.disabled) {
            continue;
        }
        if (campo.type === 'checkbox') {
            valores[campo.name] = campo.checked;
        } else if (campo.type === 'radio') {
            // Num grupo de radios, só o marcado vale.
            if (campo.checked) {
                valores[campo.name] = campo.value;
            }
        } else {
            valores[campo.name] = campo.value;
        }
    }
    return valores;
}

export function preencherFormulario(formulario, valores) {
    for (const [nome, valor] of Object.entries(valores)) {
        const campo = formulario.elements.namedItem(nome);
        if (!campo) {
            continue;
        }
        if (campo.type === 'checkbox') {
            campo.checked = Boolean(valor);
        } else if (typeof valor === 'number') {
            // Números voltam ao campo com vírgula decimal, como o produtor digita.
            campo.value = String(valor).replace('.', ',');
        } else {
            campo.value = valor ?? '';
        }
    }
}

export function mostrarErrosFormulario(formulario, erro, erroGeral) {
    limparErrosFormulario(formulario, erroGeral);
    const erros = erro?.erros ?? {};
    const semCampo = [];
    let primeiroCampo = null;
    for (const [nome, texto] of Object.entries(erros)) {
        const campo = formulario.elements.namedItem(nome);
        if (campo && mostrarErroCampo(campo, texto)) {
            primeiroCampo ??= campo;
        } else {
            semCampo.push(texto);
        }
    }
    if (!erro?.erros) {
        console.error(erro);
    }
    const textoGeral = semCampo.length > 0 ? semCampo.join(' ') : (primeiroCampo ? '' : erro?.message);
    if (textoGeral && erroGeral) {
        erroGeral.textContent = textoGeral;
        erroGeral.hidden = false;
        erroGeral.scrollIntoView({ block: 'nearest' });
    }
    primeiroCampo?.focus();
}

export function limparErrosFormulario(formulario, erroGeral) {
    for (const campo of formulario.elements) {
        limparErroCampo(campo);
    }
    if (erroGeral) {
        erroGeral.textContent = '';
        erroGeral.hidden = true;
    }
}

// O parágrafo de erro de cada campo é o que ele aponta em aria-describedby
// com id começando por "erro-".
function obterElementoErro(campo) {
    const ids = campo.getAttribute?.('aria-describedby')?.split(' ') ?? [];
    return ids.filter((id) => id.startsWith('erro-')).map((id) => document.getElementById(id)).find(Boolean) ?? null;
}

export function mostrarErroCampo(campo, texto) {
    const elementoErro = obterElementoErro(campo);
    if (!elementoErro) {
        return false;
    }
    campo.setAttribute('aria-invalid', 'true');
    elementoErro.textContent = texto;
    return true;
}

export function limparErroCampo(campo) {
    if (campo.getAttribute?.('aria-invalid') !== 'true') {
        return;
    }
    campo.removeAttribute('aria-invalid');
    const elementoErro = obterElementoErro(campo);
    if (elementoErro) {
        elementoErro.textContent = '';
    }
}

// ---------- Diálogo de confirmação ----------

// Usa o #dialogo-confirmacao da página. Os botões do formulário method="dialog"
// fecham o diálogo com o value no returnValue; Esc fecha sem confirmar.
export function confirmar(mensagem, { textoConfirmar = 'Confirmar' } = {}) {
    const dialogo = document.getElementById('dialogo-confirmacao');
    if (!dialogo) {
        return Promise.resolve(window.confirm(mensagem));
    }
    document.getElementById('mensagem-confirmacao').textContent = mensagem;
    document.getElementById('botao-confirmar').textContent = textoConfirmar;
    dialogo.returnValue = '';
    dialogo.showModal();
    return new Promise((resolver) => {
        dialogo.addEventListener('close', () => resolver(dialogo.returnValue === 'confirmar'), { once: true });
    });
}

// ---------- Abas ----------

// Abas acessíveis (padrão ARIA tabs): setas, Home e End trocam de aba. A aba
// aberta fica no endereço (#historico) para sobreviver ao recarregar e ao voltar.
export function iniciarAbas(lista) {
    const abas = [...lista.querySelectorAll('[role="tab"]')];
    const nomeDaAba = (aba) => aba.id.replace(/^aba-/, '');

    function ativar(aba, { focar = false, atualizarEndereco = true } = {}) {
        for (const item of abas) {
            const ativa = item === aba;
            item.setAttribute('aria-selected', String(ativa));
            item.tabIndex = ativa ? 0 : -1;
            document.getElementById(item.getAttribute('aria-controls')).hidden = !ativa;
        }
        if (focar) {
            aba.focus();
        }
        if (atualizarEndereco) {
            history.replaceState(null, '', `#${nomeDaAba(aba)}`);
        }
    }

    lista.addEventListener('click', (evento) => {
        const aba = evento.target.closest('[role="tab"]');
        if (aba) {
            ativar(aba);
        }
    });
    lista.addEventListener('keydown', (evento) => {
        const atual = abas.indexOf(document.activeElement);
        const destinos = { ArrowRight: atual + 1, ArrowLeft: atual - 1, Home: 0, End: abas.length - 1 };
        if (atual < 0 || !(evento.key in destinos)) {
            return;
        }
        evento.preventDefault();
        ativar(abas[(destinos[evento.key] + abas.length) % abas.length], { focar: true });
    });

    const inicial = abas.find((aba) => `#${nomeDaAba(aba)}` === window.location.hash) ?? abas[0];
    ativar(inicial, { atualizarEndereco: false });
    return {
        ativar: (id) => ativar(document.getElementById(id), { focar: true }),
    };
}
