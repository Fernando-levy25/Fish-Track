// Teste de ponta a ponta: usa o Fish Track real dentro de um iframe, como o
// produtor usaria, e confere o resultado de cada passo.
// Abra tests/e2e/ pelo servidor local e clique em "Iniciar teste".
// Parâmetros: ?automatico=1 inicia sozinho; ?relatar=1 envia o resultado por
// POST para /__resultado; ?servidor-teste=1 inclui o teste sem internet (exige
// o servidor de teste, que responde a /__teste/offline).

const parametros = new URLSearchParams(window.location.search);
const BASE = new URL('../../', window.location.href).href;
const CHAVE = 'fishtrack:v1';
const quadro = document.getElementById('app');
const resultados = [];
let etapa = '';

const doc = () => quadro.contentDocument;
const porId = (id) => doc().getElementById(id);
const texto = (id) => porId(id)?.textContent.replace(/\s+/g, ' ').trim() ?? null;
const indicador = (nome) => doc().querySelector(`[data-indicador="${nome}"]`)?.textContent;
const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
const linhas = () => porId('corpo-tabela-registros').rows.length;
const pagina = () => doc().location.pathname.split('/').pop();
const dados = () => JSON.parse(localStorage.getItem(CHAVE));

function hojeISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function somarDias(iso, n) {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}
const emBr = (iso) => iso.split('-').reverse().join('/');
const HOJE = hojeISO();

function verificar(nome, condicao, detalhe = '') {
    resultados.push({ etapa, nome, ok: Boolean(condicao), detalhe: condicao ? '' : String(detalhe) });
}

function aguardarCarga() {
    return new Promise((resolver, rejeitar) => {
        const limite = setTimeout(() => rejeitar(new Error(`a página não carregou (${etapa})`)), 15000);
        quadro.addEventListener('load', () => {
            clearTimeout(limite);
            setTimeout(resolver, 120);
        }, { once: true });
    });
}
function semErroDePagina() {
    const erro = doc().querySelector('main > [role="alert"]');
    verificar(`página montada sem erro: ${pagina()}`, !erro, erro?.textContent);
}
async function abrir(caminho) {
    const carga = aguardarCarga();
    quadro.src = BASE + caminho;
    await carga;
    semErroDePagina();
}
async function navegarCom(acao) {
    const carga = aguardarCarga();
    acao();
    await carga;
    semErroDePagina();
}
async function esperarAte(condicao, ms = 5000) {
    const fim = Date.now() + ms;
    while (Date.now() < fim) {
        if (condicao()) return true;
        await esperar(40);
    }
    return false;
}
function preencher(campos) {
    for (const [id, valor] of Object.entries(campos)) {
        const campo = porId(id);
        if (campo.type === 'checkbox' || campo.type === 'radio') campo.checked = valor; else campo.value = valor;
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        campo.dispatchEvent(new Event('change', { bubbles: true }));
    }
}
async function enviarSemSair(idFormulario) {
    porId(idFormulario).requestSubmit();
    await esperar(80);
}
const enviarENavegar = (idFormulario) => navegarCom(() => porId(idFormulario).requestSubmit());
async function responderConfirmacao(aceitar) {
    await esperarAte(() => porId('dialogo-confirmacao').open, 2000);
    verificar('diálogo de confirmação abriu', porId('dialogo-confirmacao').open);
    const botao = aceitar ? porId('botao-confirmar') : porId('dialogo-confirmacao').querySelector('button[value="cancelar"]');
    botao.click();
}
function definirArquivo(nome, conteudo) {
    const janela = quadro.contentWindow;
    const transferencia = new janela.DataTransfer();
    transferencia.items.add(new janela.File([conteudo], nome, { type: 'application/json' }));
    porId('campo-arquivo-backup').files = transferencia.files;
}

async function roteiro() {
    localStorage.removeItem(CHAVE);

    etapa = 'App vazio: primeiros passos';
    await abrir('index.html');
    verificar('só os primeiros passos', !porId('primeiros-passos').hidden && porId('conteudo-hoje').hidden
        && texto('primeiros-passos').startsWith('Vamos começar?'), texto('primeiros-passos'));
    verificar('nenhum "0 kg" nem gráfico vazio à vista', !doc().querySelector('main').innerText.includes('0 kg'));
    verificar('o primeiro passo em destaque', doc().querySelector('.primeiros-passos__passo--proximo')?.textContent.includes('Cadastre um tanque')
        && doc().querySelector('.primeiros-passos__passo--proximo a')?.getAttribute('href') === 'tanque-form.html');
    verificar('dados de exemplo a um clique', [...porId('primeiros-passos').querySelectorAll('a')].some((link) => link.textContent === 'Carregar dados de exemplo'));

    etapa = 'Cadastro de tanque';
    await abrir('tanque-form.html');
    await enviarSemSair('formulario-tanque');
    verificar('erro no nome', texto('erro-nome') === 'Informe o nome do tanque.' && porId('campo-nome').getAttribute('aria-invalid') === 'true', texto('erro-nome'));
    verificar('erro no volume', texto('erro-volume') === 'Informe o volume.', texto('erro-volume'));
    verificar('foco vai para o primeiro erro', doc().activeElement === porId('campo-nome'));
    preencher({ 'campo-nome': 'Tanque Teste', 'campo-especie': 'Tilápia', 'campo-volume': '120', 'campo-densidade-maxima': '5', 'campo-observacoes': 'Tanque de teste' });
    verificar('equivalência da capacidade', texto('equivalencia-capacidade') === 'Equivale a uma carga máxima de 600 kg neste tanque.', texto('equivalencia-capacidade'));
    verificar('erro some ao digitar', !porId('campo-nome').hasAttribute('aria-invalid') && texto('erro-nome') === '');
    await enviarENavegar('formulario-tanque');
    const tanqueId = new URLSearchParams(doc().location.search).get('id');
    verificar('abre a página do tanque', pagina() === 'tanque.html' && tanqueId, doc().location.href);
    verificar('carga máxima no cabeçalho', texto('especie-tanque') === 'Tilápia · 120 m³ de água · carga máxima de 600 kg', texto('especie-tanque'));
    verificar('título e estado', texto('titulo-tanque') === 'Tanque Teste' && texto('estado-tanque') === 'VazioPronto para povoar', texto('estado-tanque'));
    verificar('ações de tanque vazio: "Povoar tanque" é a principal', !porId('link-iniciar-ciclo').hidden && texto('link-iniciar-ciclo') === 'Povoar tanque'
        && !porId('botao-excluir-tanque').hidden && porId('botao-arquivar-tanque').hidden && porId('link-anotar-dia').hidden);
    await abrir('index.html');
    verificar('primeiros passos: o tanque já conta', doc().querySelector('.primeiros-passos__passo--feito')?.textContent.includes('Cadastre um tanque')
        && doc().querySelector('.primeiros-passos__passo--proximo')?.textContent.includes('Povoe o tanque'));
    await abrir(`tanque.html?id=${tanqueId}`);
    verificar('aviso sem ciclo', !porId('aviso-sem-ciclo').hidden && porId('conteudo-resumo').hidden);

    etapa = 'RN01 nome único';
    await abrir('tanque-form.html');
    preencher({ 'campo-nome': ' tanque teste ', 'campo-especie': 'X', 'campo-volume': '1' });
    await enviarSemSair('formulario-tanque');
    verificar('nome repetido recusado', texto('erro-nome') === 'Já existe um tanque com esse nome.', texto('erro-nome'));

    etapa = 'Editar tanque';
    await abrir(`tanque-form.html?id=${tanqueId}`);
    verificar('modo edição preenchido', texto('titulo-formulario-tanque') === 'Editar tanque' && porId('campo-volume').value === '120');
    preencher({ 'campo-volume': '150,5' });
    await enviarENavegar('formulario-tanque');
    verificar('vírgula decimal no volume', dados().tanques[0].volumeM3 === 150.5, dados().tanques[0].volumeM3);
    await abrir(`tanque-form.html?id=${tanqueId}`);
    preencher({ 'unidade-carga': true });
    verificar('troca para carga total', !porId('campo-carga-maxima').hidden && porId('campo-densidade-maxima').hidden && porId('campo-carga-maxima').value === '752,5',
        porId('campo-carga-maxima').value);
    preencher({ 'campo-carga-maxima': '900' });
    await enviarENavegar('formulario-tanque');
    verificar('carga total convertida', texto('especie-tanque').endsWith('carga máxima de 900 kg') && Math.abs(dados().tanques[0].densidadeMaximaKgM3 - 900 / 150.5) < 1e-9,
        texto('especie-tanque'));

    etapa = 'Iniciar ciclo';
    await navegarCom(() => porId('link-iniciar-ciclo').click());
    verificar('formulário de início', !porId('secao-iniciar-ciclo').hidden && porId('secao-registrar-despesca').hidden);
    verificar('data padrão é hoje', porId('campo-data-inicio').value === HOJE, porId('campo-data-inicio').value);
    preencher({ 'campo-data-inicio': somarDias(HOJE, -30), 'campo-quantidade-inicial': '1.000', 'campo-peso-inicial': '10', 'campo-peso-alvo': '5' });
    await enviarSemSair('formulario-iniciar-ciclo');
    verificar('peso alvo deve superar o inicial', texto('erro-peso-alvo') === 'O peso alvo deve ser maior que o peso inicial.', texto('erro-peso-alvo'));
    verificar('biomassa inicial calculada ao vivo', texto('resultado-povoamento') === 'Biomassa inicial: 10 kg', texto('resultado-povoamento'));
    preencher({ 'campo-peso-alvo': '500', 'campo-data-prevista-despesca': somarDias(HOJE, 120) });
    await enviarENavegar('formulario-iniciar-ciclo');
    verificar('ponto de milhar: 1.000 peixes', dados().ciclos[0].quantidadeInicial === 1000, dados().ciclos[0].quantidadeInicial);
    verificar('estado com o motivo', texto('estado-tanque').startsWith('Atenção'), texto('estado-tanque'));
    const barra = porId('destaques-tanque').querySelector('[role="progressbar"]');
    verificar('barra de capacidade acessível, com unidade', barra?.getAttribute('aria-valuetext') === '1,1%, 10 kg de 900 kg', barra?.getAttribute('aria-valuetext'));
    verificar('densidade de povoamento em "Ver todos"', porId('corpo-todos-indicadores').textContent.includes('6,6 peixes/m³'), texto('corpo-todos-indicadores'));
    verificar('indicadores iniciais, FCA com o motivo', indicador('quantidade') === '≈ 1.000' && indicador('diasCultivo') === '30' && indicador('fca') === 'Aparece depois da primeira biometria',
        `${indicador('quantidade')} ${indicador('diasCultivo')} ${indicador('fca')}`);
    verificar('uma ação principal; despesca em "Mais ações", por último', !porId('link-anotar-dia').hidden && porId('link-anotar-dia').getAttribute('href') === `folha.html?tanque=${tanqueId}`
        && porId('mais-acoes').contains(porId('link-registrar-despesca'))
        && doc().querySelector('.mais-acoes__menu').lastElementChild === porId('link-registrar-despesca')
        && porId('link-iniciar-ciclo').hidden && porId('botao-excluir-tanque').hidden && porId('botao-arquivar-tanque').hidden);
    verificar('alertas de 30 dias sem registro e sem biometria', doc().querySelectorAll('#lista-alertas-tanque .lista-alertas__item--baixa').length === 2
        && texto('lista-alertas-tanque').includes('Biometria atrasada'), texto('lista-alertas-tanque'));

    etapa = 'Registros';
    await abrir(`registro.html?tanqueId=${tanqueId}`);
    verificar('tanque fixo no topo, sem a lista', porId('campo-tanque').value === tanqueId && texto('tanque-fixo') === 'Tanque Teste' && porId('grupo-tanque').hidden);
    verificar('data padrão é hoje', porId('campo-data').value === HOJE);
    verificar('"Mortos encontrados" com ajuda e estimativa', doc().querySelector('label[for="campo-mortalidade"]').textContent === 'Mortos encontrados'
        && texto('ajuda-mortalidade').endsWith('Estimativa atual: ≈ 1.000 peixes.') && !porId('campo-quantidade-contada'), texto('ajuda-mortalidade'));
    verificar('registro diário sem a seção de biometria', !porId('campo-peixes-amostra') && !porId('campo-peso-medio')
        && !porId('aviso-biometria').hidden && porId('link-biometria').getAttribute('href') === `tanque.html?id=${tanqueId}&acao=biometria`);
    await enviarSemSair('formulario-registro');
    verificar('RN11 pede alguma medição', texto('erro-geral-registro') === 'Preencha pelo menos uma medição ou observação.', texto('erro-geral-registro'));
    preencher({ 'campo-mortalidade': '2000' });
    await enviarSemSair('formulario-registro');
    verificar('RN14 no campo mortalidade', texto('erro-mortalidade') === 'Os mortos encontrados não podem passar da quantidade estimada de peixes nessa data (1.000).', texto('erro-mortalidade'));
    preencher({ 'campo-mortalidade': '' });
    for (const invalido of ['2,5,1', 'abc', '1e3']) {
        preencher({ 'campo-racao': invalido });
        await enviarSemSair('formulario-registro');
        verificar(`"${invalido}" recusado na ração`, texto('erro-racao') === 'Digite um número válido.', texto('erro-racao'));
    }
    verificar('sem plano, o motivo e a ação', texto('texto-sugestao-racao') === 'Sem plano de alimentação · Configurar' && porId('botao-usar-sugestao').hidden, texto('texto-sugestao-racao'));
    preencher({ 'campo-racao': '', 'campo-data': somarDias(HOJE, 1), 'campo-mortalidade': '1' });
    await enviarSemSair('formulario-registro');
    verificar('RN12 data futura', texto('erro-data') === 'A data não pode ser futura.', texto('erro-data'));
    preencher({ 'campo-data': somarDias(HOJE, -20), 'campo-racao': '2,5', 'campo-mortalidade': '5' });
    verificar('conversão visível da ração', texto('conversao-campo-racao') === '= 2.500 g', texto('conversao-campo-racao'));
    await enviarENavegar('formulario-registro');
    verificar('quantidade ≈ 995', indicador('quantidade') === '≈ 995', indicador('quantidade'));
    verificar('vírgula decimal: 2,5 kg', indicador('racaoAcumulada') === '2,5 kg', indicador('racaoAcumulada'));
    await abrir(`registro.html?tanqueId=${tanqueId}`);
    // Sobra maior que a ração é recusada (RN23).
    preencher({ 'campo-data': somarDias(HOJE, -1), 'campo-racao': '7', 'campo-sobra': '8', 'campo-mortalidade': '15', 'campo-observacoes': 'Peixes agitados' });
    await enviarSemSair('formulario-registro');
    verificar('RN23 sobra maior que a ração', texto('erro-sobra') === 'A sobra não pode ser maior que a ração fornecida.', texto('erro-sobra'));
    preencher({ 'campo-sobra': '', 'campo-causa': 'doenca' });
    await enviarENavegar('formulario-registro');
    verificar('quantidade ≈ 980', indicador('quantidade') === '≈ 980', indicador('quantidade'));

    etapa = 'Biometria pelo painel do tanque';
    const painel = () => porId('painel-biometria');
    porId('botao-fazer-biometria').click();
    await esperar(60);
    verificar('painel aberto com o tanque fixo no topo', painel().open && texto('titulo-painel-biometria') === 'Tanque Teste'
        && !painel().querySelector('select'), texto('titulo-painel-biometria'));
    preencher({ 'biometria-data': somarDias(HOJE, -1), 'biometria-peixes': '50', 'biometria-peso': '3' });
    verificar('conversão do peso da amostra', texto('conversao-biometria-peso') === '= 3.000 g', texto('conversao-biometria-peso'));
    const previa = () => painel().querySelector('.painel-biometria__previa').textContent;
    verificar('prévia ao vivo: peso médio e comparação', previa().includes('Peso médio60 g') && previa().includes('+50 g em 29 dias'), previa());
    painel().querySelector('form').requestSubmit();
    await esperar(150);
    verificar('salvo: painel fechado e próxima biometria', !painel().open && texto('mensagem-tanque').includes('Próxima biometria:'), texto('mensagem-tanque'));
    verificar('peso médio da biometria', indicador('pesoMedio') === '60 g', indicador('pesoMedio'));
    verificar('próxima biometria no cartão de peso', /^Próxima biometria em \d\d\/\d\d$/.test(indicador('proximaBiometria') ?? ''), indicador('proximaBiometria'));
    porId('aba-biometrias').click();
    await esperar(40);
    const linhasBiometria = () => [...porId('corpo-tabela-biometrias').rows].map((linha) => linha.cells[1].textContent);
    verificar('aba Biometrias com povoamento e amostra', linhasBiometria().join('|') === 'Amostra|Povoamento', linhasBiometria().join('|'));
    await abrir(`tanque.html?id=${tanqueId}&acao=biometria`);
    verificar('acao=biometria abre o painel; peixes da última amostra', painel().open && porId('biometria-peixes').value === '50', porId('biometria-peixes').value);
    // "Pesei em partes": 2 baldes (20 peixes com 1,2 kg e 30 com 1,8 kg) → 50 peixes, 3 kg → 60 g.
    painel().querySelector('[data-acao-biometria="partes"]').click();
    const partes = painel().querySelectorAll('.pesagens-parciais__item');
    [['20', '1,2'], ['30', '1,8']].forEach(([peixes, peso], indice) => {
        partes[indice].querySelector('[data-parte="peixes"]').value = peixes;
        partes[indice].querySelector('[data-parte="peso"]').value = peso;
    });
    partes[0].querySelector('input').dispatchEvent(new Event('input', { bubbles: true }));
    verificar('pesei em partes: o app soma as pesagens', previa().includes('Peso médio60 g'), previa());
    painel().querySelector('[data-acao-biometria="partes"]').click();
    doc().querySelector('[name="modoBiometria"][value="individuais"]').click();
    preencher({ 'biometria-individuais': '100\n110\n90\n105\n95' });
    verificar('pesos individuais: média, CV e lote uniforme', previa().includes('Peso médio100 g') && previa().includes('7,9%') && previa().includes('Lote uniforme'), previa());
    painel().dispatchEvent(new Event('cancel', { cancelable: true }));
    await responderConfirmacao(true);
    await esperar(80);
    verificar('fechar com dados pede confirmação e não grava', !painel().open && dados().registros.filter((registro) => registro.biometria?.pesosIndividuaisG).length === 0);
    verificar('ração de hoje é o primeiro cartão', porId('cartao-racao').querySelector('.cartao-racao__titulo')?.textContent === 'Ração de hoje'
        && porId('cartao-racao').querySelector('a[href*="data="]')?.textContent.trim() === 'Anotar');
    // O rótulo pode ter um termo com balão de ajuda: o nome é o texto do termo.
    const rotulos = (seletor) => [...doc().querySelectorAll(`${seletor} .cartao-indicador__rotulo`)].map((r) => r.querySelector('.termo')?.textContent ?? r.textContent).join('|');
    verificar('3 destaques e 3 de acompanhamento, termos com ajuda', rotulos('#destaques-tanque') === 'Peso médio|Biomassa|Capacidade'
        && rotulos('#acompanhamento-tanque') === 'Mortalidade observada|FCA|Crescimento'
        && doc().querySelectorAll('#destaques-tanque .termo, #acompanhamento-tanque .termo').length === 4, `${rotulos('#destaques-tanque')} / ${rotulos('#acompanhamento-tanque')}`);
    verificar('"Ver todos" recolhido, sem natalidade sem nascimentos', !porId('todos-indicadores').open && !porId('corpo-todos-indicadores').textContent.includes('Natalidade'));
    verificar('progresso do ciclo no cabeçalho', texto('progresso-ciclo') === `Dia 30 de 150 · despesca prevista em 120 dias`, texto('progresso-ciclo'));
    porId('botao-info-estimativa').click();
    verificar('botão "i" explica a estimativa', !porId('texto-info-estimativa').hidden && porId('botao-info-estimativa').getAttribute('aria-expanded') === 'true');
    verificar('alerta alto de mortalidade', doc().querySelector('#lista-alertas-tanque .lista-alertas__item--alta')?.textContent.includes('Mortalidade elevada no registro'));
    verificar('gráficos desenhados', porId('grafico-peso-medio').querySelector('svg') && porId('aviso-grafico-peso-medio').hidden);
    verificar('registros recentes, o mais novo primeiro', doc().querySelectorAll('#lista-registros-recentes .lista-registros__item').length === 3
        && doc().querySelector('#lista-registros-recentes .lista-registros__data').textContent === emBr(somarDias(HOJE, -1)));

    etapa = 'Abas, histórico e calendário do tanque';
    porId('aba-historico').click();
    await esperar(40);
    verificar('aba Histórico ativa', porId('aba-historico').getAttribute('aria-selected') === 'true' && !porId('painel-historico').hidden);
    verificar('aba no endereço', doc().location.hash === '#historico', doc().location.hash);
    verificar('três linhas no histórico, a biometria com etiqueta', linhas() === 3
        && porId('corpo-tabela-registros').querySelector('.tabela__linha--biometria')?.textContent.includes('Biometria 50 peixes · 60 g'), linhas());
    porId('aba-historico').focus();
    porId('aba-historico').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await esperar(40);
    verificar('seta troca de aba e leva o foco', porId('aba-biometrias').getAttribute('aria-selected') === 'true' && doc().activeElement === porId('aba-biometrias'));

    etapa = 'Editar e excluir registro';
    await abrir(`tanque.html?id=${tanqueId}&recarregar=1#historico`);
    verificar('#historico abre a aba', !porId('painel-historico').hidden);
    const linhaRotina = () => [...porId('corpo-tabela-registros').rows].find((linha) => !linha.classList.contains('tabela__linha--biometria'));
    await navegarCom(() => linhaRotina().querySelector('a.link').click());
    verificar('modo edição', texto('titulo-pagina-registro') === 'Editar registro' && porId('campo-tanque').disabled);
    verificar('valores preenchidos', porId('campo-racao').value === '7' && porId('campo-causa').value === 'doenca' && porId('peso-registro').hidden);
    preencher({ 'campo-racao': '8,75' });
    await enviarENavegar('formulario-registro');
    verificar('volta ao histórico', doc().location.hash === '#historico' && !porId('painel-historico').hidden);
    verificar('valor editado na tabela, com unidade', linhaRotina().cells[2].textContent === '8,8 kg', linhaRotina().cells[2].textContent);
    const idEditado = new URL(linhaRotina().querySelector('a.link').href).searchParams.get('id');
    await abrir(`registro.html?id=${idEditado}`);
    verificar('edição mostra o valor com vírgula', porId('campo-racao').value === '8,75', porId('campo-racao').value);
    // Registro antigo (de antes do painel) com peso e ração juntos: o peso fica só para leitura.
    const comPeso = dados();
    comPeso.registros.find((registro) => registro.id === idEditado).pesoMedioG = 61;
    localStorage.setItem(CHAVE, JSON.stringify(comPeso));
    await abrir(`registro.html?id=${idEditado}`);
    verificar('peso antigo só leitura, com "Editar na biometria"', !porId('peso-registro').hidden && texto('texto-peso-registro').startsWith('Peso médio: 61 g')
        && porId('link-editar-peso').getAttribute('href') === `tanque.html?id=${tanqueId}&acao=biometria&registro=${idEditado}`);
    preencher({ 'campo-racao': '9' });
    await enviarENavegar('formulario-registro');
    verificar('salvar a rotina mantém o peso', dados().registros.find((registro) => registro.id === idEditado).pesoMedioG === 61);
    await abrir(`tanque.html?id=${tanqueId}&recarregar=2#historico`);
    linhaRotina().querySelector('[data-excluir-registro]').click();
    await responderConfirmacao(false);
    await esperar(60);
    verificar('cancelar mantém o registro', linhas() === 3);
    linhaRotina().querySelector('[data-excluir-registro]').click();
    await responderConfirmacao(true);
    await esperar(80);
    verificar('registro excluído', linhas() === 2 && texto('mensagem-historico') === 'Registro excluído.', `${linhas()} ${texto('mensagem-historico')}`);

    etapa = 'Limites de alerta do tanque';
    porId('botao-limites-alerta').click();
    await esperar(40);
    verificar('diálogo aberto com padrões no placeholder', porId('dialogo-limites').open && porId('campo-limite-mortalidade-registro').placeholder === 'Padrão: 1');
    preencher({ 'campo-limite-capacidade': '0' });
    await enviarSemSair('formulario-limites-tanque');
    verificar('limite inválido recusado', texto('erro-limite-capacidade') === 'Use um valor maior que zero.' && porId('dialogo-limites').open, texto('erro-limite-capacidade'));
    preencher({ 'campo-limite-capacidade': '95' });
    await enviarSemSair('formulario-limites-tanque');
    verificar('salvo e fechado', !porId('dialogo-limites').open && texto('mensagem-tanque') === 'Limites de alerta do tanque atualizados.', texto('mensagem-tanque'));

    etapa = 'Despesca';
    await abrir(`ciclo-form.html?tanqueId=${tanqueId}&acao=despesca`);
    verificar('estimativa como sugestão', porId('campo-quantidade-despescada').placeholder === 'Estimativa: 995', porId('campo-quantidade-despescada').placeholder);
    verificar('biomassa estimada como sugestão', porId('campo-biomassa-final').placeholder.startsWith('Estimativa: '), porId('campo-biomassa-final').placeholder);
    await enviarSemSair('formulario-registrar-despesca');
    verificar('RN19 biomassa final obrigatória', texto('erro-biomassa-final') === 'Informe a biomassa final.', texto('erro-biomassa-final'));
    // RN20: 950 peixes x 80 g = 76 kg, contra 60 kg pesados (27% acima).
    preencher({ 'campo-biomassa-final': '60', 'campo-quantidade-despescada': '950', 'campo-peso-final': '80' });
    await enviarSemSair('formulario-registrar-despesca');
    verificar('RN20 valores que não batem', texto('erro-quantidade-despescada') === 'Os valores não batem: confira a biomassa, o peso médio ou a quantidade.', texto('erro-quantidade-despescada'));
    preencher({ 'campo-data-despesca': somarDias(HOJE, -25), 'campo-quantidade-despescada': '' });
    await enviarSemSair('formulario-registrar-despesca');
    verificar('RN09 antes do último registro', texto('erro-data-despesca') === `A despesca não pode ser anterior ao último registro (${emBr(somarDias(HOJE, -1))}).`, texto('erro-data-despesca'));
    preencher({ 'campo-data-despesca': HOJE });
    await enviarENavegar('formulario-registrar-despesca');
    // 60 kg / 80 g = 750 peixes de 1.000: 75% de sobrevivência; 250 perdidos, 5 encontrados (o outro registro foi excluído antes).
    verificar('resumo do ciclo após a despesca', !porId('aviso-despesca').hidden && porId('aviso-despesca').textContent.includes('75%')
        && porId('aviso-despesca').textContent.includes('245 não observados · 5 encontrados') && porId('aviso-despesca').textContent.includes('(estimada pela biomassa)'),
        texto('aviso-despesca'));
    porId('aba-historico').click();
    await esperar(40);
    verificar('ciclo encerrado no histórico com o resumo', !porId('resultado-ciclo-historico').hidden && porId('resultado-ciclo-historico').textContent.includes('Sobrevivência real'));
    await abrir(`ciclo-form.html?tanqueId=${tanqueId}&acao=iniciar`);
    verificar('referência do último ciclo ao iniciar', texto('referencia-ciclo-anterior')?.startsWith('Último ciclo: sobrevivência de 75%'), texto('referencia-ciclo-anterior'));
    await abrir(`tanque.html?id=${tanqueId}`);
    verificar('RN08 tanque vazio', texto('estado-tanque').startsWith('Vazio') && !porId('aviso-sem-ciclo').hidden);
    verificar('arquivar disponível com histórico', !porId('botao-arquivar-tanque').hidden && porId('botao-excluir-tanque').hidden);
    await abrir('registro.html');
    verificar('registro sem tanques com ciclo ativo', !porId('aviso-sem-ciclo-ativo').hidden);

    etapa = 'Arquivar e desarquivar';
    await abrir(`tanque.html?id=${tanqueId}`);
    porId('botao-arquivar-tanque').click();
    await responderConfirmacao(true);
    await esperar(80);
    verificar('arquivado', texto('estado-tanque').startsWith('Arquivado') && !porId('botao-desarquivar-tanque').hidden);
    await abrir('tanques.html');
    porId('filtro-status').value = 'arquivado';
    porId('filtro-status').dispatchEvent(new Event('change'));
    await esperar(40);
    verificar('filtro de arquivados', doc().querySelectorAll('#grade-tanques .cartao-tanque').length === 1 && doc().location.search === '?status=arquivado');
    await abrir(`tanque.html?id=${tanqueId}`);
    porId('botao-desarquivar-tanque').click();
    await esperar(80);
    verificar('desarquivado', texto('estado-tanque').startsWith('Vazio'), texto('estado-tanque'));

    etapa = 'Manutenção e exclusão';
    await abrir('tanque-form.html');
    preencher({ 'campo-nome': 'Descartável', 'campo-especie': 'Pacu', 'campo-volume': '10', 'campo-manutencao': true });
    await enviarENavegar('formulario-tanque');
    verificar('em manutenção, sem iniciar ciclo', texto('estado-tanque').startsWith('Em manutenção') && porId('link-iniciar-ciclo').hidden);
    verificar('sem capacidade definida', texto('especie-tanque').endsWith('capacidade não definida'), texto('especie-tanque'));
    const carga = aguardarCarga();
    porId('botao-excluir-tanque').click();
    await responderConfirmacao(true);
    await carga;
    verificar('excluído e de volta à lista', pagina() === 'tanques.html');

    etapa = 'Menu no celular';
    quadro.style.width = '390px';
    await abrir('index.html');
    porId('menu-mais').querySelector('summary').click();
    await esperar(40);
    verificar('Mais abre', porId('menu-mais').open);
    doc().querySelector('main').click();
    await esperar(40);
    verificar('Mais fecha ao tocar fora', !porId('menu-mais').open);
    quadro.style.width = '1280px';

    etapa = 'Configurações';
    await abrir('configuracoes.html');
    verificar('limites padrão preenchidos', porId('campo-mortalidade-registro').value === '1' && porId('campo-dias-sem-registro').value === '7');
    porId('botao-exportar-csv').click();
    await esperar(80);
    verificar('CSV exportado', texto('mensagem-exportar') === `2 registros exportados para fish-track-registros-${HOJE}.csv.`, texto('mensagem-exportar'));
    porId('botao-fazer-backup').click();
    await esperar(80);
    verificar('backup gerado', texto('mensagem-backup') === `Backup salvo em fish-track-backup-${HOJE}.json.`, texto('mensagem-backup'));
    const backup = localStorage.getItem(CHAVE);
    preencher({ 'campo-capacidade': '0' });
    await enviarSemSair('formulario-limites');
    verificar('limite padrão inválido', texto('erro-capacidade') === 'Use um valor maior que zero.', texto('erro-capacidade'));
    porId('botao-restaurar-limites').click();
    await esperar(60);
    verificar('limites restaurados', porId('campo-capacidade').value === '90' && texto('mensagem-limites') === 'Limites padrão restaurados.');

    etapa = 'Dados de exemplo';
    porId('botao-carregar-exemplo').click();
    await responderConfirmacao(true);
    const carregou = await esperarAte(() => (texto('mensagem-dados') ?? '').startsWith('Dados de exemplo carregados'), 15000);
    verificar('exemplo carregado', carregou && texto('mensagem-dados').includes('6 tanques, 5 ciclos'), texto('mensagem-dados'));
    await abrir('index.html');
    etapa = 'Plano de alimentação e ração sugerida';
    await abrir('configuracoes.html');
    verificar('planos do exemplo', porId('lista-tabelas').textContent.includes('Modelo Embrapa') && porId('lista-tabelas').textContent.includes('17 faixas')
        && porId('lista-tabelas').textContent.includes('3% do peso total por dia, em 3 refeições'), texto('lista-tabelas'));
    porId('botao-nova-tabela').click();
    await esperar(40);
    const editor = () => porId('dialogo-plano');
    verificar('editor com explicação e exemplo', editor().open && editor().textContent.includes('se o tanque tem 500 kg de peixe e o plano diz 3%'));
    preencher({ 'plano-nome': 'Teste', 'plano-faixa-0-pesoDeG': '100', 'plano-faixa-0-pesoAteG': '50', 'plano-faixa-0-taxaPct': '2', 'plano-faixa-0-refeicoes': '4' });
    await enviarSemSair('formulario-plano');
    verificar('RN24 no campo da faixa, em linguagem simples', texto('erro-plano-faixa-0-pesoAteG') === 'O peso final da faixa precisa ser maior que o inicial.', texto('erro-plano-faixa-0-pesoAteG'));
    doc().querySelector('#dialogo-plano [name="tipo"][value="fixo"]').click();
    preencher({ 'plano-taxa': '3', 'plano-refeicoes': '4' });
    editor().querySelector('[name="simuladorPeso"]').value = '200';
    const simuladorBiomassa = editor().querySelector('[name="simuladorBiomassa"]');
    simuladorBiomassa.value = '500';
    simuladorBiomassa.dispatchEvent(new Event('input', { bubbles: true }));
    const resultadoPlano = () => editor().querySelector('.plano__resultado').textContent;
    verificar('simulador do plano fixo: 15 kg por dia, 3,75 kg por refeição', resultadoPlano().includes('15 kg por dia') && resultadoPlano().includes('4 refeições de 3,8 kg'), resultadoPlano());
    editor().querySelector('[data-acao-plano="modelo"]').click();
    editor().querySelector('[name="simuladorPeso"]').value = '112';
    simuladorBiomassa.dispatchEvent(new Event('input', { bubbles: true }));
    verificar('modelo Embrapa com aviso; 112 g fora das faixas', editor().textContent.includes('Este modelo vale para tilápia de 190 g a 1 kg')
        && resultadoPlano() === 'Nenhuma faixa cobre 112 g. Adicione uma faixa para peixes menores.', resultadoPlano());
    editor().querySelector('[data-acao-plano="cancelar"]').click();
    const t01 = dados().tanques.find((tanque) => tanque.nome === 'Tanque 01').id;
    await abrir(`tanque.html?id=${t01}`);
    verificar('ração sugerida no cartão do tanque', /kg por dia$/.test(indicador('racaoSugerida') ?? '')
        && porId('cartao-racao').textContent.includes('4 refeições de') && porId('cartao-racao').textContent.includes('faixa 345–385 g (2,6%)'), texto('cartao-racao'));
    verificar('TCE e fator K em "Ver todos"', /%\/dia$/.test(indicador('tceCiclo') ?? '') && Boolean(indicador('fatorCondicao')), `${indicador('tceCiclo')} ${indicador('fatorCondicao')}`);
    await abrir(`registro.html?tanqueId=${t01}`);
    verificar('sugestão no registro', texto('texto-sugestao-racao')?.startsWith('Sugerida para hoje:') && !porId('botao-usar-sugestao').hidden);
    porId('botao-usar-sugestao').click();
    verificar('"Usar sugestão" preenche a ração', /^\d+,\d$/.test(porId('campo-racao').value), porId('campo-racao').value);
    await abrir('tanques.html');
    verificar('ração sugerida na lista', [...doc().querySelectorAll('.cartao-tanque')].find((cartao) => cartao.textContent.includes('Tanque 01'))?.textContent.includes('kg por dia'));
    await abrir(`tanque-form.html?id=${t01}`);
    verificar('plano e intervalo no formulário do tanque', porId('campo-intervalo-biometria').value === '15'
        && texto('resumo-plano').startsWith('Muda com o tamanho do peixe: 17 faixas') && !porId('botao-editar-plano').hidden, texto('resumo-plano'));

    etapa = 'Unidades e rodada de biometria';
    await abrir('configuracoes.html');
    doc().querySelector('#formulario-unidades [name="biomassa"][value="t"]').click();
    doc().querySelector('#formulario-unidades [name="racao"][value="g"]').click();
    await enviarSemSair('formulario-unidades');
    await abrir(`tanque.html?id=${t01}`);
    verificar('preferência de exibição: biomassa em t, ração em g', /^≈ \d+,\d\d t$/.test(indicador('biomassa') ?? '') && /^[\d.]+ g por dia$/.test(indicador('racaoSugerida') ?? ''),
        `${indicador('biomassa')} ${indicador('racaoSugerida')}`);
    await abrir('configuracoes.html');
    doc().querySelector('#formulario-unidades [name="biomassa"][value="kg"]').click();
    doc().querySelector('#formulario-unidades [name="racao"][value="kg"]').click();
    await enviarSemSair('formulario-unidades');
    await abrir(`registro.html?tanqueId=${t01}`);
    doc().querySelector('[name="racaoKgUnidade"][value="g"]').click();
    preencher({ 'campo-racao': '500' });
    verificar('ração em g com a conversão visível', texto('conversao-campo-racao') === '= 0,5 kg', texto('conversao-campo-racao'));
    await abrir(`registro.html?tanqueId=${t01}`);
    verificar('a unidade escolhida fica lembrada', doc().querySelector('[name="racaoKgUnidade"]:checked').value === 'g');
    doc().querySelector('[name="racaoKgUnidade"][value="kg"]').click();
    await abrir(`tanque.html?id=${t01}&acao=biometria`);
    const nomeAntes = texto('titulo-painel-biometria');
    preencher({ 'biometria-peixes': '30', 'biometria-peso': '12' });
    painel().querySelector('[data-proximo]').click();
    await esperar(150);
    verificar('"Salvar e ir para o próximo tanque" troca o tanque e destaca', painel().open && texto('titulo-painel-biometria') !== nomeAntes
        && painel().querySelector('.painel-biometria__troca').textContent === `Agora: ${texto('titulo-painel-biometria')}`, `${nomeAntes} → ${texto('titulo-painel-biometria')}`);
    painel().querySelector('.quadro__fechar').click();
    await esperar(60);
    await abrir('calendario.html');
    verificar('agenda mostra a biometria prevista', [...doc().querySelectorAll('.etiqueta')].some((etiqueta) => etiqueta.textContent.startsWith('Biometria prevista')));
    const viveiroPesagem = dados().tanques.find((tanque) => tanque.nome === 'Viveiro Norte').id;
    await abrir(`ciclo-form.html?tanqueId=${viveiroPesagem}&acao=iniciar`);
    doc().querySelector('[name="modoPovoamento"][value="pesagem"]').click();
    preencher({ 'campo-biomassa-inicial': '21', 'campo-peso-inicial': '8,5' });
    verificar('lote pesado: quantidade ao vivo (RN21)', texto('resultado-povoamento') === '≈ 2.471 peixes (valor estimado pela biomassa)', texto('resultado-povoamento'));

    etapa = 'Página do tanque com dados';
    const viveiroNorte = dados().tanques.find((tanque) => tanque.nome === 'Viveiro Norte').id;
    await abrir(`tanque.html?id=${viveiroNorte}`);
    verificar('tanque vazio mostra o resumo do último ciclo', !porId('ultimo-ciclo-tanque').hidden && porId('resultado-ultimo-ciclo').textContent.includes('Sobrevivência real'));
    const tanque01 = dados().tanques.find((tanque) => tanque.nome === 'Tanque 01').id;
    await abrir(`tanque.html?id=${tanque01}`);
    porId('todos-indicadores').open = true;
    await esperar(60);
    await abrir(`tanque.html?id=${tanque01}`);
    verificar('"Ver todos" lembra que ficou aberto', porId('todos-indicadores').open);
    verificar('peso alvo previsto no crescimento', porId('acompanhamento-tanque').textContent.includes('Peso alvo em ~'));
    porId('todos-indicadores').open = false;
    await esperar(60);
    await abrir('index.html');
    etapa = 'Hoje com dados';
    verificar('resumo do dia', texto('resumo-producao') === '3 tanques em cultivo · 2 precisam de atenção', texto('resumo-producao'));
    verificar('data por extenso', /^[A-ZÀ-Ú][a-zà-úç-]+, \d/.test(texto('data-hoje')), texto('data-hoje'));
    verificar('contadores do menu, inclusive lembretes na Agenda', doc().querySelector('[data-contador="alertas"]').textContent === '4'
        && doc().querySelector('[data-contador="tanques"]').textContent === '5' && Number(doc().querySelector('[data-contador="lembretes"]').textContent) > 0);
    const tarefas = () => [...porId('lista-tarefas').querySelectorAll('.tarefa')];
    verificar('"O que fazer hoje" vem antes de tudo', doc().querySelector('main .secao__titulo')?.textContent === 'O que fazer hoje');
    verificar('todo alerta vira tarefa, o alto primeiro', tarefas().filter((tarefa) => /tarefa--(alta|media|baixa)/.test(tarefa.className)).length === 4
        && tarefas()[0].classList.contains('tarefa--alta') && tarefas()[0].textContent.includes('Tanque 02 · 45 peixes mortos ontem'), tarefas().map((t) => t.textContent).join(' | '));
    verificar('alimentar os tanques com plano, com uma ação', tarefas().some((tarefa) => tarefa.textContent.startsWith('Alimentar 2 tanques')
        && tarefa.querySelector('a')?.getAttribute('href') === 'folha.html'), tarefas().map((t) => t.textContent).join(' | '));
    verificar('"sem registro" não vira duas tarefas', tarefas().filter((tarefa) => tarefa.textContent.includes('Sem registro')).length === 1
        && !tarefas().some((tarefa) => tarefa.textContent.startsWith('Alimentar') && tarefa.textContent.includes('3 tanques')));
    verificar('lembrete atrasado com selo e "Feito"', tarefas().some((tarefa) => tarefa.textContent.includes('Revisar o aerador') && tarefa.querySelector('.selo')?.textContent === 'Atrasado'));
    const cartaoHoje = (nome) => [...doc().querySelectorAll('#grade-tanques .cartao-cultivo')].find((cartao) => cartao.textContent.includes(nome));
    verificar('estado coerente com os alertas', cartaoHoje('Tanque 02').querySelector('.estado-tanque__etiqueta').textContent === 'Agir agora'
        && cartaoHoje('Tanque 05').querySelector('.estado-tanque__etiqueta').textContent === 'Atenção'
        && cartaoHoje('Tanque 01').querySelector('.estado-tanque__etiqueta').textContent === 'Tudo certo');
    verificar('cartão compacto: motivo, ração de hoje e uma ação', cartaoHoje('Tanque 02').querySelector('.estado-tanque__motivo').textContent.startsWith('45 peixes mortos ontem')
        && /em 3 refeições$/.test(cartaoHoje('Tanque 02').querySelector('.cartao-cultivo__racao').textContent)
        && cartaoHoje('Tanque 02').querySelectorAll('.cartao-cultivo__acoes a').length === 1);
    verificar('sem plano: o motivo e a ação no lugar do traço', cartaoHoje('Tanque 05').querySelector('.valor-ausente')?.textContent === 'Sem plano de alimentação · Configurar');
    verificar('"Produção" depois das tarefas, aberta no computador', porId('producao').open
        && porId('lista-tarefas').compareDocumentPosition(porId('producao')) & Node.DOCUMENT_POSITION_FOLLOWING);
    verificar('estimados com ≈ e legenda', doc().querySelector('[data-indicador-grafico="biomassa"] .destaque__valor').textContent.startsWith('≈')
        && texto('legenda-tanques').startsWith('≈ valor estimado'));
    const termoFca = [...porId('termos-producao').querySelectorAll('.termo')].find((termo) => termo.textContent === 'FCA');
    termoFca.click();
    verificar('termo técnico com ajuda e exemplo', termoFca.getAttribute('aria-expanded') === 'true'
        && doc().getElementById(termoFca.getAttribute('aria-describedby')).textContent.includes('Exemplo: 1,5 = 1,5 kg de ração por kg de peixe'));
    verificar('gráfico com uma linha por tanque', porId('grafico-principal').querySelectorAll('.grafico__linha-serie').length === 3);
    doc().querySelector('[data-indicador-grafico="fca"]').click();
    await esperar(60);
    verificar('linhas da FCA desenhadas', [...porId('grafico-principal').querySelectorAll('.grafico__linha-serie')].every((linha) => linha.getAttribute('d').length > 20));
    verificar('indicador troca o gráfico', texto('titulo-grafico') === 'FCA' && porId('grafico-principal').querySelector('.grafico__meta')
        && doc().querySelector('[data-indicador-grafico="fca"]').getAttribute('aria-pressed') === 'true');
    [...porId('filtro-grafico').querySelectorAll('[data-tanque]')].find((botao) => botao.textContent === 'Tanque 05').click();
    await esperar(60);
    verificar('filtro mostra um tanque', texto('leitura-grafico').endsWith('hoje · Tanque 05') && porId('grafico-principal').querySelectorAll('.grafico__linha-serie').length === 1, texto('leitura-grafico'));
    porId('filtro-grafico').querySelector('[data-tanque=""]').click();
    await esperar(60);
    const svgGrafico = porId('grafico-principal').querySelector('svg');
    svgGrafico.focus();
    await esperar(40);
    verificar('tooltip pelo teclado', porId('grafico-principal').querySelector('.grafico-dica--visivel')?.textContent.includes('Geral'),
        porId('grafico-principal').querySelector('.grafico-dica')?.textContent);

    etapa = 'Folha do dia';
    const registrosAntes = dados().registros.length;
    await abrir('folha.html');
    verificar('uma linha por tanque em cultivo, ração sugerida pré-preenchida, mortos 0', doc().querySelectorAll('.folha__linha').length === 3
        && porId('folha-0-racaoKg').value !== '' && porId('folha-0-mortalidade').value === '0');
    verificar('sem marcar, "Salvar o dia" fica desabilitado com a dica', porId('botao-salvar-dia').disabled && texto('dica-salvar-dia') === 'Marque os tanques que você anotou.');
    await abrir('index.html');
    verificar('abrir e sair sem marcar não grava nada', dados().registros.length === registrosAntes);
    await abrir('folha.html');
    porId('botao-conforme-plano').click();
    verificar('"Alimentei conforme o plano" marca só os tanques com plano', doc().querySelectorAll('[data-anotado]:checked').length === 2 && !porId('botao-salvar-dia').disabled);
    preencher({ 'folha-1-racaoSobraKg': '999' });
    await enviarSemSair('formulario-folha');
    verificar('erro na linha certa; nada gravado', texto('erro-folha-1-racaoSobraKg') === 'A sobra não pode ser maior que a ração fornecida.'
        && dados().registros.length === registrosAntes, texto('erro-folha-1-racaoSobraKg'));
    preencher({ 'folha-1-racaoSobraKg': '' });
    await enviarSemSair('formulario-folha');
    await esperar(80);
    verificar('salvar o dia grava um registro por tanque marcado', texto('mensagem-folha') === '2 tanques anotados.' && dados().registros.length === registrosAntes + 2, texto('mensagem-folha'));
    verificar('anotados viram "Já anotado"', doc().querySelectorAll('.folha__linha--anotada').length === 2);
    await abrir('index.html');
    verificar('a tarefa de alimentar some da tela "Hoje"', !tarefas().some((tarefa) => tarefa.textContent.startsWith('Alimentar'))
        && texto('lista-tarefas-feitas').includes('Dia anotado'), tarefas().map((t) => t.textContent).join(' | '));
    doc().querySelector('[data-periodo="7"]').click();
    await esperar(60);
    verificar('período de 7 dias', doc().querySelector('[data-indicador-grafico="peixes"] .destaque__apoio').textContent.endsWith('em 7 dias'));
    await abrir('index.html');
    verificar('período lembrado ao recarregar', doc().querySelector('[data-periodo="7"]').getAttribute('aria-pressed') === 'true');
    doc().querySelector('[data-periodo="30"]').click();
    await abrir('alertas.html');
    verificar('2 grupos de alertas', doc().querySelectorAll('#grupos-alertas .grupo-alertas').length === 2);
    await testarAgenda();
    await testarRelatorios();
    await testarProtecao();
    await abrir('tanques.html');
    verificar('5 tanques na lista padrão', doc().querySelectorAll('.cartao-tanque').length === 5);

    if (parametros.has('servidor-teste')) {
        etapa = 'Modo offline (service worker)';
        const registro = await quadro.contentWindow.navigator.serviceWorker.getRegistration();
        await esperarAte(() => registro?.active, 10000);
        verificar('service worker ativo', registro?.active?.state === 'activated', registro?.active?.state);
        await fetch('/__teste/offline?ligar=1', { method: 'POST' });
        await abrir('index.html');
        verificar('dashboard sem internet', texto('resumo-producao').startsWith('3 tanques em cultivo'), texto('resumo-producao'));
        await fetch('/__teste/offline?ligar=0', { method: 'POST' });
    }

    etapa = 'Restaurar backup e apagar dados';
    await abrir('configuracoes.html');
    porId('botao-restaurar-backup').click();
    await esperar(60);
    verificar('pede o arquivo', texto('erro-arquivo-backup') === 'Escolha o arquivo de backup.');
    definirArquivo('ruim.json', 'não é json');
    porId('botao-restaurar-backup').click();
    await esperar(120);
    verificar('arquivo inválido recusado', texto('mensagem-backup').startsWith('Este arquivo não é um backup'), texto('mensagem-backup'));
    definirArquivo('backup.json', backup);
    porId('botao-restaurar-backup').click();
    await responderConfirmacao(true);
    await esperarAte(() => (texto('mensagem-backup') ?? '').startsWith('Backup restaurado'), 3000);
    verificar('backup restaurado', texto('mensagem-backup') === 'Backup restaurado: 1 tanque, 1 ciclo e 2 registros.', texto('mensagem-backup'));
    porId('botao-apagar-dados').click();
    await responderConfirmacao(true);
    await esperar(80);
    verificar('dados apagados', localStorage.getItem(CHAVE) === null);

    etapa = 'Endereços inválidos';
    await abrir('tanque.html?id=inexistente');
    verificar('tanque não encontrado', !porId('aviso-tanque-nao-encontrado').hidden);
    await abrir('registro.html?id=inexistente');
    verificar('registro não encontrado', !porId('aviso-registro-indisponivel').hidden);
}

// Seção 7: grade com etiquetas, filtros, quadro do dia, lembretes e menu lateral.
// Roda com os dados de exemplo carregados.
async function testarAgenda() {
    etapa = 'Lembretes de hoje na tela Hoje';
    await abrir('index.html');
    const contadorAgenda = () => doc().querySelector('[data-contador="lembretes"]');
    verificar('Agenda conta os pendentes', contadorAgenda()?.textContent === '3' && !contadorAgenda().hidden, contadorAgenda()?.textContent);
    const tarefaLembrete = (trecho) => [...doc().querySelectorAll('.tarefa')].find((item) => item.textContent.includes(trecho));
    verificar('atrasado vira tarefa com selo', tarefaLembrete('Revisar o aerador')?.querySelector('.selo')?.textContent === 'Atrasado');
    tarefaLembrete('Biometria')?.querySelector('[data-concluir]')?.click();
    await esperar(60);
    verificar('"Feito" conclui o lembrete', contadorAgenda()?.textContent === '2'
        && tarefaLembrete('Biometria')?.querySelector('[data-concluir]')?.checked === true, contadorAgenda()?.textContent);
    tarefaLembrete('Biometria')?.querySelector('[data-concluir]')?.click();
    await esperar(60);
    verificar('desmarca na tela Hoje', contadorAgenda()?.textContent === '3', contadorAgenda()?.textContent);

    etapa = 'Agenda: grade e etiquetas';
    await abrir('calendario.html');
    const grade = () => doc().querySelector('.calendario__grade');
    const celula = (data) => grade().querySelector(`[data-data="${data}"]`);
    const etiquetas = (data) => [...celula(data).querySelectorAll('.etiqueta')].map((item) => item.textContent);
    const quadroDia = () => doc().querySelector('.quadro');
    verificar('6 semanas fixas', grade().children.length === 42);
    verificar('resumo do mês', /^\d+ registros? · \d+ lembretes?$/.test(doc().querySelector('.agenda__resumo').textContent),
        doc().querySelector('.agenda__resumo').textContent);
    verificar('hoje marcado', celula(HOJE).classList.contains('calendario__dia--hoje'));
    verificar('quadro já aberto em hoje', !quadroDia().hidden && celula(HOJE).getAttribute('aria-pressed') === 'true'
        && quadroDia().querySelector('.quadro__contagem .selo')?.textContent === 'Hoje');
    const ontem = somarDias(HOJE, -1);
    // No primeiro dia da grade, ontem fica no mês anterior.
    const ontemForaDaGrade = !celula(ontem);
    if (ontemForaDaGrade) {
        doc().querySelector('[aria-label="Mês anterior"]').click();
        await esperar(60);
    }
    verificar('vários registros viram uma etiqueta com as bolinhas', etiquetas(ontem).includes('2 registros')
        && celula(ontem).querySelectorAll('.etiqueta--registro .etiqueta__ponto').length === 2, etiquetas(ontem).join(' | '));
    const alertaT02 = [...grade().querySelectorAll('.etiqueta--alerta')].find((etiqueta) => etiqueta.textContent.startsWith('Mortalidade'));
    verificar('alerta do dia com o tanque abreviado', alertaT02?.textContent === 'Mortalidade alta · T02' && alertaT02.title === 'Mortalidade alta: Tanque 02',
        alertaT02?.textContent);
    if (ontemForaDaGrade) {
        doc().querySelector('[aria-label="Ir para hoje"]').click();
        await esperar(60);
    }
    const ordemHoje = [...celula(HOJE).querySelectorAll('.etiqueta')].map((item) => item.className.match(/etiqueta--([a-z-]+)/)[1]);
    // A folha do dia já anotou hoje sem mortos: o alerta de mortalidade fica no dia anterior.
    verificar('no máximo 3 etiquetas e "+N mais"', ordemHoje.length === 3
        && /^\+\d+ mais$/.test(celula(HOJE).querySelector('.calendario__mais')?.textContent ?? ''), ordemHoje.join(','));
    verificar('lembrete concluído riscado', celula(HOJE).querySelector('.etiqueta--lembrete.etiqueta--concluida')?.textContent === 'Comprar ração');

    etapa = 'Agenda: filtros';
    const chipTanque = (nome) => [...doc().querySelectorAll('[data-filtro-tanque]')].find((chip) => chip.textContent === nome);
    chipTanque('Tanque 01').click();
    await esperar(40);
    verificar('filtro por tanque', !grade().textContent.includes('T02') && grade().textContent.includes('Comprar ração'), 'T02 visível ou geral sumiu');
    chipTanque('Todos').click();
    doc().querySelector('[data-filtro-tipo="registros"]').click();
    await esperar(40);
    verificar('filtro por tipo', !grade().querySelector('.etiqueta--registro')
        && doc().querySelector('[data-filtro-tipo="registros"]').getAttribute('aria-pressed') === 'false');
    doc().querySelector('[data-filtro-tipo="registros"]').click();
    await esperar(40);

    etapa = 'Agenda: quadro do dia';
    const secoes = () => [...quadroDia().querySelectorAll('.quadro__secao-titulo')].map((titulo) => titulo.textContent);
    verificar('seções de hoje', secoes().join(',') === 'Atrasados,Lembretes,Registros', secoes().join(','));
    verificar('atrasado no quadro de hoje', quadroDia().querySelector('.quadro__secao')?.textContent.includes('Revisar o aerador')
        && quadroDia().querySelector('.quadro__secao .selo')?.textContent === 'Atrasado');
    verificar('aviso de repetição', quadroDia().textContent.includes('repete a cada 15 dias'));
    verificar('registro com resumo e link de edição', quadroDia().querySelector('a[href^="registro.html?id="]')?.textContent === 'Editar registro');
    verificar('"Registro neste dia" em hoje', quadroDia().querySelector('a[href*="registro.html"][href*="data="]')?.getAttribute('href').includes(`data=${HOJE}`));
    const amanha = somarDias(HOJE, 1);
    // Um dia futuro sem nenhum evento (biometrias e lembretes previstos ocupam alguns).
    const diaVazio = [...grade().querySelectorAll('[data-data]')].map((dia) => dia.dataset.data)
        .find((data) => data > HOJE && !celula(data).querySelector('.etiqueta'));
    celula(diaVazio).click();
    await esperar(40);
    verificar('dia sem nada', quadroDia().querySelector('.quadro__vazio')?.textContent === 'Nada marcado para este dia.', quadroDia().textContent);
    celula(amanha).click();
    await esperar(40);
    verificar('sem "Registro neste dia" no futuro (RN12)', !quadroDia().querySelector('a[href^="registro.html"]'));
    celula(amanha).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await esperar(40);
    verificar('setas mudam o dia e levam o foco', doc().activeElement === celula(HOJE));
    celula(HOJE).click();
    await esperar(40);

    etapa = 'Agenda: lembretes';
    quadroDia().querySelector('[data-acao-quadro="novo-lembrete"]').click();
    await esperar(40);
    verificar('formulário com a data do dia', porId('lembrete-data')?.value === HOJE && doc().activeElement === porId('lembrete-titulo'));
    verificar('aviso de que não há notificação com o app fechado', texto('ajuda-lembrete-observacao')?.includes('app fechado'));
    quadroDia().querySelector('form').id = 'form-lembrete-teste';
    preencher({ 'lembrete-titulo': '   ' });
    await enviarSemSair('form-lembrete-teste');
    verificar('RN16 no campo', texto('erro-lembrete-titulo') === 'Informe o título do lembrete.', texto('erro-lembrete-titulo'));
    const tanque01 = dados().tanques.find((tanque) => tanque.nome === 'Tanque 01').id;
    preencher({ 'lembrete-titulo': 'Teste da agenda', 'lembrete-tanque': tanque01, 'lembrete-repetir': '7', 'lembrete-data': amanha });
    await enviarSemSair('form-lembrete-teste');
    const salvo = dados().lembretes.find((item) => item.titulo === 'Teste da agenda');
    verificar('lembrete salvo', salvo?.repetirDias === 7 && salvo.tanqueId === tanque01 && salvo.data === amanha, JSON.stringify(salvo));
    verificar('aparece na hora, com animação de entrada', celula(amanha).querySelector('.etiqueta--nova')?.textContent === 'Teste da agenda · T01'
        && celula(amanha).getAttribute('aria-pressed') === 'true');
    const itemSalvo = () => [...quadroDia().querySelectorAll('.quadro__item--lembrete')].find((item) => item.textContent.includes('Teste da agenda'));
    itemSalvo().querySelector('[data-concluir]').click();
    await esperar(40);
    verificar('concluir pelo quadro', dados().lembretes.find((item) => item.id === salvo.id).concluidas.includes(amanha) && itemSalvo().classList.contains('quadro__item--concluido'));
    itemSalvo().querySelector('[data-editar-lembrete]').click();
    await esperar(40);
    verificar('editar abre o formulário preenchido', porId('lembrete-titulo').value === 'Teste da agenda' && porId('lembrete-repetir').value === '7');
    quadroDia().querySelector('[data-acao-quadro="cancelar"]').click();
    await esperar(40);
    itemSalvo().querySelector('[data-remover-lembrete]').click();
    await esperar(40);
    const pergunta = doc().querySelector('dialog[open]');
    verificar('remover repetido pergunta', pergunta?.textContent.includes('Só esta vez') && pergunta.textContent.includes('Todas as repetições'));
    pergunta.querySelector('button[value="ocorrencia"]').click();
    await esperar(60);
    verificar('"Só esta vez" remove a ocorrência', dados().lembretes.find((item) => item.id === salvo.id)?.excluidas.includes(amanha) && !itemSalvo());
    doc().querySelector('.agenda').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await esperar(40);
    verificar('Esc fecha o quadro', quadroDia().hidden && grade().querySelector('[aria-pressed="true"]') === null);

    etapa = 'Agenda: menu, registro e tanque';
    await abrir('calendario.html?lembrete=novo');
    verificar('"Adicionar lembrete" do menu abre o formulário', porId('lembrete-titulo') && doc().activeElement === porId('lembrete-titulo'));
    await abrir(`registro.html?data=${ontem}`);
    verificar('registro com a data da agenda', porId('campo-data').value === ontem, porId('campo-data').value);
    await abrir(`registro.html?data=${amanha}`);
    verificar('data futura no endereço é ignorada', porId('campo-data').value === HOJE);
    const tanque05 = dados().tanques.find((tanque) => tanque.nome === 'Tanque 05').id;
    await abrir(`tanque.html?id=${tanque05}#calendario`);
    verificar('aba Calendário do tanque usa a agenda', porId('agenda-tanque').querySelector('.calendario__grade')
        && !porId('agenda-tanque').querySelector('[data-filtro-tanque]'));
    verificar('só eventos do tanque e gerais', !porId('agenda-tanque').querySelector('.calendario__grade').textContent.includes('T01')
        && porId('agenda-tanque').textContent.includes('Revisar o aerador'));
    verificar('títulos no nível certo', porId('agenda-tanque').querySelector('h3.agenda__mes') && porId('agenda-tanque').querySelector('h4.quadro__titulo'));

    etapa = 'Agenda no celular';
    quadro.style.width = '390px';
    await abrir('calendario.html');
    verificar('no celular o quadro só abre ao tocar', quadroDia().hidden);
    verificar('sem rolagem horizontal', doc().documentElement.scrollWidth <= doc().documentElement.clientWidth,
        `${doc().documentElement.scrollWidth} > ${doc().documentElement.clientWidth}`);
    celula(HOJE).click();
    await esperar(60);
    verificar('quadro em tela cheia', doc().defaultView.getComputedStyle(quadroDia()).position === 'fixed' && doc().activeElement === quadroDia().querySelector('.quadro__fechar'));
    quadroDia().querySelector('.quadro__fechar').click();
    await esperar(40);
    verificar('fechar devolve o foco ao dia', quadroDia().hidden && doc().activeElement === celula(HOJE));
    quadro.style.width = '';
}

// Seção 7.12 e 9.9: relatório para imprimir e imagem PNG dos gráficos.
async function testarRelatorios() {
    // Guarda os arquivos que o app manda baixar, em vez de depender do download do navegador.
    const capturarDownloads = () => {
        const janela = quadro.contentWindow;
        const arquivos = [];
        const original = janela.URL.createObjectURL.bind(janela.URL);
        janela.URL.createObjectURL = (blob) => {
            arquivos.push(blob);
            return original(blob);
        };
        return arquivos;
    };
    const esperarPng = async (arquivos) => {
        await esperarAte(() => arquivos.some((blob) => blob.type === 'image/png'), 5000);
        return arquivos.find((blob) => blob.type === 'image/png');
    };

    etapa = 'Imagem PNG dos gráficos';
    await abrir('index.html');
    verificar('"Exportar relatório" no dashboard', doc().querySelector('a[href="relatorio.html?imprimir=1"]')?.textContent.trim() === 'Exportar relatório');
    let arquivos = capturarDownloads();
    const larguraPrincipal = porId('grafico-principal').querySelector('svg').getBoundingClientRect().width;
    porId('botao-baixar-grafico').click();
    let png = await esperarPng(arquivos);
    const imagem = png && await quadro.contentWindow.createImageBitmap(png);
    verificar('PNG do gráfico principal em 2×, com margem', imagem && Math.abs(imagem.width - Math.round((larguraPrincipal + 48) * 2)) <= 2,
        `${imagem?.width} x ${imagem?.height}, svg ${larguraPrincipal}`);
    const tanque02 = dados().tanques.find((tanque) => tanque.nome === 'Tanque 02').id;
    await abrir(`tanque.html?id=${tanque02}`);
    verificar('"Exportar relatório" no tanque', porId('link-exportar-relatorio').getAttribute('href') === `relatorio.html?tanqueId=${tanque02}&imprimir=1`);
    verificar('"Baixar imagem" nos três gráficos', [...doc().querySelectorAll('[data-baixar-grafico]')].every((botao) => !botao.hidden));
    arquivos = capturarDownloads();
    doc().querySelector('[data-baixar-grafico="peso-medio"]').click();
    png = await esperarPng(arquivos);
    verificar('PNG do gráfico do tanque', png?.size > 2000, png?.size);

    etapa = 'Relatório da produção';
    await abrir('relatorio.html');
    verificar('item Relatórios no menu', doc().querySelector('.menu__link--lateral[href="relatorio.html"]')?.getAttribute('aria-current') === 'page');
    verificar('título e emissão', texto('titulo-relatorio') === 'Relatório da produção' && texto('emissao-relatorio').startsWith('Emitido em '));
    verificar('um bloco por tanque em cultivo', doc().querySelectorAll('.relatorio__secao--inteira').length === 3);
    verificar('alertas com o tanque', doc().querySelectorAll('#conteudo-relatorio .lista-alertas__item').length === 3,
        [...doc().querySelectorAll('#conteudo-relatorio .lista-alertas__item')].map((item) => item.textContent).join(' | '));
    verificar('tanques sem ciclo citados', porId('conteudo-relatorio').textContent.includes('Tanque-rede 04 (em manutenção)'));
    verificar('nome do PDF pelo título', doc().title === `Fish Track - Relatório da produção - ${HOJE}`, doc().title);
    await navegarCom(() => {
        porId('campo-relatorio').value = tanque02;
        porId('campo-relatorio').dispatchEvent(new Event('change', { bubbles: true }));
    });

    etapa = 'Relatório do tanque';
    verificar('trocar o relatório leva ao tanque', texto('titulo-relatorio') === 'Relatório do Tanque 02' && porId('campo-relatorio').value === tanque02);
    verificar('três gráficos', porId('conteudo-relatorio').querySelectorAll('.cartao-grafico svg').length === 3);
    const registrosT02 = dados().registros.filter((registro) => registro.tanqueId === tanque02).length;
    verificar('tabela com todos os registros do ciclo', porId('conteudo-relatorio').querySelectorAll('tbody tr').length === registrosT02, registrosT02);
    verificar('alertas do tanque', porId('conteudo-relatorio').querySelectorAll('.lista-alertas__item').length === 1,
        [...porId('conteudo-relatorio').querySelectorAll('.lista-alertas__item')].map((item) => item.textContent).join(' | '));
    verificar('FCA com meta e contexto', porId('conteudo-relatorio').textContent.includes('meta de 1,60'));
    const viveiro = dados().tanques.find((tanque) => tanque.nome === 'Viveiro Norte').id;
    await abrir(`relatorio.html?tanqueId=${viveiro}`);
    verificar('tanque sem ciclo mostra o último', porId('conteudo-relatorio').textContent.includes('Sem ciclo em andamento. Último ciclo'));
    await abrir('relatorio.html?tanqueId=inexistente');
    verificar('tanque inexistente', porId('conteudo-relatorio').textContent.includes('Tanque não encontrado'));
    quadro.style.width = '390px';
    await abrir(`relatorio.html?tanqueId=${tanque02}`);
    verificar('relatório sem rolagem horizontal no celular', doc().documentElement.scrollWidth <= doc().documentElement.clientWidth,
        `${doc().documentElement.scrollWidth} > ${doc().documentElement.clientWidth}`);
    quadro.style.width = '';
}

// ---------- Proteção dos dados (seção 8.5) ----------

const PAGINAS = ['index.html', 'tanques.html', 'tanque.html', 'tanque-form.html', 'ciclo-form.html', 'registro.html', 'folha.html',
    'alertas.html', 'calendario.html', 'relatorio.html', 'configuracoes.html'];
const bloqueio = () => doc().querySelector('[data-campo="telaBloqueio"]');
const botaoComTexto = (raiz, rotulo) => [...(raiz ?? doc()).querySelectorAll('button')].find((botao) => botao.textContent.trim() === rotulo);
const chavesDeCopia = () => Object.keys(localStorage).filter((chave) => chave.startsWith(`${CHAVE}:`));

// Abre sem exigir página "sem erro": a tela de bloqueio é um alerta de propósito.
async function abrirBloqueada(caminho) {
    const carga = aguardarCarga();
    quadro.src = BASE + caminho;
    await carga;
}

// Captura o que a página baixaria (link com blob), sem baixar de verdade.
async function capturarDownload(acao) {
    const janela = quadro.contentWindow;
    let blob = null;
    const original = janela.URL.createObjectURL;
    janela.URL.createObjectURL = (objeto) => {
        blob = objeto;
        return original.call(janela.URL, objeto);
    };
    acao();
    janela.URL.createObjectURL = original;
    return blob ? blob.text() : null;
}

// Enche o armazenamento até não caber mais nada, para a migração não ter onde gravar.
function encherArmazenamento() {
    let indice = 0;
    for (const tamanho of [1_000_000, 100_000, 10_000, 1_000, 100, 10, 1]) {
        const bloco = 'x'.repeat(tamanho);
        for (;;) {
            try {
                localStorage.setItem(`enchimento:${indice}`, bloco);
                indice += 1;
            } catch {
                break;
            }
        }
    }
}
const esvaziarArmazenamento = () => Object.keys(localStorage).filter((chave) => chave.startsWith('enchimento:')).forEach((chave) => localStorage.removeItem(chave));

async function testarProtecao() {
    const dadosAntes = localStorage.getItem(CHAVE);

    etapa = 'Dados ilegíveis: tela de bloqueio';
    localStorage.setItem(CHAVE, '{quebrado');
    for (const caminho of PAGINAS) {
        await abrirBloqueada(caminho);
        verificar(`bloqueio em ${caminho}`, bloqueio()?.textContent.includes('Eles foram preservados')
            && doc().querySelector('main').children.length === 1);
    }
    verificar('três saídas', ['Baixar os dados', 'Restaurar', 'Começar uma base nova'].every((rotulo) => botaoComTexto(bloqueio(), rotulo)));
    verificar('nenhum formulário do app à vista', doc().querySelectorAll('main form').length === 0);
    const baixado = await capturarDownload(() => botaoComTexto(bloqueio(), 'Baixar os dados').click());
    verificar('"Baixar os dados" baixa o conteúdo bruto', baixado === '{quebrado', baixado);
    verificar('base nova só depois de marcar a caixa', botaoComTexto(bloqueio(), 'Começar uma base nova').disabled);
    verificar('nada foi gravado', localStorage.getItem(CHAVE) === '{quebrado');

    etapa = 'Dados ilegíveis: restaurar backup';
    const campoBackup = porId('bloqueio-arquivo-backup');
    const transferencia = new quadro.contentWindow.DataTransfer();
    transferencia.items.add(new quadro.contentWindow.File([JSON.stringify({ versao: 5, tanques: [], ciclos: [], registros: [], lembretes: [], config: {} })], 'b.json'));
    campoBackup.files = transferencia.files;
    const recarga = aguardarCarga();
    botaoComTexto(bloqueio(), 'Restaurar').click();
    await responderConfirmacao(true);
    await recarga;
    verificar('backup incompleto restaurado, app de volta', !bloqueio() && dados()?.config.unidades?.biomassa === 'kg');
    verificar('dados ilegíveis guardados numa cópia datada', chavesDeCopia().some((chave) => chave.startsWith(`${CHAVE}:ilegivel:`)
        && localStorage.getItem(chave) === '{quebrado'));
    for (const caminho of ['index.html', 'tanques.html', 'configuracoes.html', 'calendario.html', 'folha.html', 'relatorio.html']) {
        await abrir(caminho);
    }

    etapa = 'Dados ilegíveis: começar uma base nova';
    localStorage.setItem(CHAVE, '{outro');
    await abrirBloqueada('index.html');
    preencher({ 'bloqueio-entendo': true });
    const recargaBase = aguardarCarga();
    botaoComTexto(bloqueio(), 'Começar uma base nova').click();
    await responderConfirmacao(true);
    await recargaBase;
    verificar('base nova gravada depois da cópia', !bloqueio() && dados()?.tanques.length === 0
        && chavesDeCopia().some((chave) => localStorage.getItem(chave) === '{outro'));

    etapa = 'Dados recuperados';
    await abrir('configuracoes.html');
    const secao = porId('secao-dados-recuperados');
    verificar('seção aparece com cópias', !secao.hidden && secao.querySelectorAll('.copias__item').length === 2, secao.querySelectorAll('.copias__item').length);
    const copiaBaixada = await capturarDownload(() => botaoComTexto(secao, 'Baixar cópia').click());
    verificar('"Baixar cópia" baixa a cópia', copiaBaixada === '{outro', copiaBaixada);
    botaoComTexto(secao, 'Descartar').click();
    await responderConfirmacao(true);
    await esperar(60);
    verificar('"Descartar" remove a cópia', secao.querySelectorAll('.copias__item').length === 1
        && !chavesDeCopia().some((chave) => localStorage.getItem(chave) === '{outro'));

    etapa = 'Versão mais nova';
    localStorage.setItem(CHAVE, JSON.stringify({ versao: 99, tanques: [], ciclos: [], registros: [] }));
    await abrirBloqueada('tanques.html');
    verificar('bloqueio com "Tentar de novo" e "Baixar os dados"', bloqueio()?.textContent.includes('versão mais nova do Fish Track')
        && botaoComTexto(bloqueio(), 'Tentar de novo') && botaoComTexto(bloqueio(), 'Baixar os dados')
        && !botaoComTexto(bloqueio(), 'Começar uma base nova'));
    verificar('dados da versão mais nova intactos', dados().versao === 99);

    etapa = 'Armazenamento cheio: só leitura';
    const v4 = { versao: 4, tanques: [{ id: 't', nome: 'Antigo', especie: 'Pacu', volumeM3: 2, status: 'vazio', limitesAlerta: {} }], ciclos: [], registros: [], lembretes: [], config: { tabelasArracoamento: [] } };
    localStorage.setItem(CHAVE, JSON.stringify(v4));
    encherArmazenamento();
    try {
        // A faixa é um alerta de propósito: abre sem exigir página "sem erro".
        for (const caminho of ['index.html', 'tanques.html', 'tanque-form.html', 'calendario.html', 'configuracoes.html']) {
            await abrirBloqueada(caminho);
            const faixa = doc().querySelector('[data-campo="faixaCheio"]');
            verificar(`faixa em ${caminho}`, faixa?.textContent.includes('o armazenamento deste aparelho está cheio'));
            const ativos = [...doc().querySelectorAll('main form :is(input, select, textarea, button)')].filter((controle) => !controle.disabled);
            verificar(`formulários desativados em ${caminho}`, ativos.length === 0, ativos.map((controle) => controle.id || controle.name).join(','));
        }
        verificar('dados antigos intactos', dados().versao === 4);
        await abrirBloqueada('tanques.html');
        verificar('lista lida dos dados migrados', doc().querySelector('.cartao-tanque')?.textContent.includes('Antigo'));
        const faixa = doc().querySelector('[data-campo="faixaCheio"]');
        const exportado = await capturarDownload(() => botaoComTexto(faixa, 'Baixar os dados').click());
        verificar('"Baixar os dados" exporta os migrados', JSON.parse(exportado ?? '{}').versao === 5);
    } finally {
        esvaziarArmazenamento();
    }
    const faixa = doc().querySelector('[data-campo="faixaCheio"]');
    const recargaEspaco = aguardarCarga();
    botaoComTexto(faixa, 'Tentar salvar de novo').click();
    await recargaEspaco;
    verificar('"Tentar salvar de novo" com espaço volta ao normal', !doc().querySelector('[data-campo="faixaCheio"]') && dados().versao === 5);

    for (const chave of chavesDeCopia()) {
        localStorage.removeItem(chave);
    }
    localStorage.setItem(CHAVE, dadosAntes);
}

async function executar() {
    document.getElementById('iniciar').disabled = true;
    const resumo = document.getElementById('resumo');
    resumo.textContent = 'Executando…';
    const dadosDoNavegador = localStorage.getItem(CHAVE);
    const copiasDoNavegador = Object.keys(localStorage).filter((chave) => chave.startsWith(`${CHAVE}:`)).map((chave) => [chave, localStorage.getItem(chave)]);
    try {
        await roteiro();
    } catch (erro) {
        resultados.push({ etapa, nome: 'roteiro interrompido', ok: false, detalhe: `${erro.message}\n${erro.stack}` });
    } finally {
        // Devolve os dados que o navegador tinha antes do teste.
        if (dadosDoNavegador === null) localStorage.removeItem(CHAVE); else localStorage.setItem(CHAVE, dadosDoNavegador);
        Object.keys(localStorage).filter((chave) => chave.startsWith(`${CHAVE}:`)).forEach((chave) => localStorage.removeItem(chave));
        copiasDoNavegador.forEach(([chave, valor]) => localStorage.setItem(chave, valor));
    }
    const falhas = resultados.filter((item) => !item.ok);
    resumo.textContent = `${resultados.length} verificações, ${falhas.length} falhas.`;
    document.getElementById('falhas').replaceChildren(...falhas.map((falha) => {
        const item = document.createElement('li');
        item.textContent = `${falha.etapa}: ${falha.nome}${falha.detalhe ? ` (${falha.detalhe})` : ''}`;
        return item;
    }));
    if (parametros.has('relatar')) {
        await fetch('/__resultado', { method: 'POST', body: JSON.stringify({ total: resultados.length, falhas }) });
    }
}

document.getElementById('iniciar').addEventListener('click', executar);
if (parametros.has('automatico')) {
    executar();
}
