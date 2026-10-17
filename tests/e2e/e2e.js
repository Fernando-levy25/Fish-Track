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

    etapa = 'Dashboard vazio';
    await abrir('index.html');
    verificar('resumo sem tanques', texto('resumo-producao') === '0 tanques em cultivo, de 0 cadastrados · nenhum alerta', texto('resumo-producao'));
    verificar('cinco indicadores', doc().querySelectorAll('#grade-destaques .destaque').length === 5);
    verificar('FCA sem dados', doc().querySelector('[data-indicador-grafico="fca"] .destaque__valor')?.textContent === '—');
    verificar('aviso de nenhum tanque', texto('grade-tanques').startsWith('Nenhum tanque cadastrado ainda'), texto('grade-tanques'));
    verificar('gráfico sem dados', !porId('aviso-grafico-principal').hidden);
    verificar('sem alertas', texto('lista-alertas') === 'Nenhum alerta no momento.', texto('lista-alertas'));

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
    verificar('título e selo', texto('titulo-tanque') === 'Tanque Teste' && porId('selo-status-tanque').classList.contains('selo--vazio'), texto('selo-status-tanque'));
    verificar('ações de tanque vazio sem ciclos', !porId('link-iniciar-ciclo').hidden && !porId('botao-excluir-tanque').hidden
        && porId('botao-arquivar-tanque').hidden && porId('link-novo-registro').hidden);
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
    preencher({ 'campo-peso-alvo': '500', 'campo-data-prevista-despesca': somarDias(HOJE, 120) });
    await enviarENavegar('formulario-iniciar-ciclo');
    verificar('ponto de milhar: 1.000 peixes', dados().ciclos[0].quantidadeInicial === 1000, dados().ciclos[0].quantidadeInicial);
    verificar('tanque ativo', texto('selo-status-tanque') === 'Ativo');
    const barra = porId('barra-capacidade-tanque').querySelector('[role="progressbar"]');
    verificar('barra de capacidade acessível', barra?.getAttribute('aria-valuetext') === '1,1%, 10 de 900 kg', barra?.getAttribute('aria-valuetext'));
    verificar('densidade de povoamento', texto('densidade-povoamento') === 'Povoamento com 6,6 peixes por m³ de água.', texto('densidade-povoamento'));
    verificar('indicadores iniciais', indicador('quantidade') === '1.000' && indicador('diasCultivo') === '30' && indicador('fca') === '—',
        `${indicador('quantidade')} ${indicador('diasCultivo')} ${indicador('fca')}`);
    verificar('ações com ciclo ativo', !porId('link-novo-registro').hidden && !porId('link-registrar-despesca').hidden
        && porId('link-iniciar-ciclo').hidden && porId('botao-excluir-tanque').hidden && porId('botao-arquivar-tanque').hidden);
    verificar('alerta de 30 dias sem registro', doc().querySelectorAll('#lista-alertas-tanque .lista-alertas__item--baixa').length === 1, texto('lista-alertas-tanque'));

    etapa = 'Registros';
    await navegarCom(() => porId('link-novo-registro').click());
    verificar('tanque já escolhido', porId('campo-tanque').value === tanqueId);
    verificar('data padrão é hoje', porId('campo-data').value === HOJE);
    verificar('estimativa na ajuda', texto('ajuda-quantidade-contada').endsWith('Estimativa atual: 1.000 peixes.'), texto('ajuda-quantidade-contada'));
    await enviarSemSair('formulario-registro');
    verificar('RN11 pede alguma medição', texto('erro-geral-registro') === 'Preencha pelo menos uma medição ou observação.', texto('erro-geral-registro'));
    preencher({ 'campo-mortalidade': '2000' });
    await enviarSemSair('formulario-registro');
    verificar('RN14 no campo mortalidade', texto('erro-mortalidade') === 'A mortalidade não pode passar da quantidade estimada de peixes nessa data (1.000).', texto('erro-mortalidade'));
    preencher({ 'campo-mortalidade': '' });
    for (const invalido of ['2,5,1', 'abc', '1e3']) {
        preencher({ 'campo-racao': invalido });
        await enviarSemSair('formulario-registro');
        verificar(`"${invalido}" recusado na ração`, texto('erro-racao') === 'Digite um número válido.', texto('erro-racao'));
    }
    preencher({ 'campo-racao': '', 'campo-data': somarDias(HOJE, 1), 'campo-peso-medio': '30' });
    await enviarSemSair('formulario-registro');
    verificar('RN12 data futura', texto('erro-data') === 'A data não pode ser futura.', texto('erro-data'));
    preencher({ 'campo-data': somarDias(HOJE, -20), 'campo-racao': '2,5', 'campo-mortalidade': '5' });
    await enviarENavegar('formulario-registro');
    verificar('quantidade 995', indicador('quantidade') === '995', indicador('quantidade'));
    verificar('vírgula decimal: 2,5 kg', indicador('racaoAcumulada') === '2,5 kg', indicador('racaoAcumulada'));
    await navegarCom(() => porId('link-novo-registro').click());
    preencher({ 'campo-data': somarDias(HOJE, -1), 'campo-peso-medio': '60', 'campo-racao': '7', 'campo-mortalidade': '15', 'campo-observacoes': 'Peixes agitados' });
    await enviarENavegar('formulario-registro');
    verificar('quantidade 980', indicador('quantidade') === '980', indicador('quantidade'));
    verificar('alerta alto de mortalidade', doc().querySelector('#lista-alertas-tanque .lista-alertas__item--alta')?.textContent.includes('Mortalidade elevada no registro'));
    verificar('gráficos desenhados', porId('grafico-peso-medio').querySelector('svg') && porId('aviso-grafico-peso-medio').hidden);
    verificar('registros recentes, o mais novo primeiro', doc().querySelectorAll('#lista-registros-recentes .lista-registros__item').length === 2
        && doc().querySelector('#lista-registros-recentes .lista-registros__data').textContent === emBr(somarDias(HOJE, -1)));

    etapa = 'Abas, histórico e calendário do tanque';
    porId('aba-historico').click();
    await esperar(40);
    verificar('aba Histórico ativa', porId('aba-historico').getAttribute('aria-selected') === 'true' && !porId('painel-historico').hidden);
    verificar('aba no endereço', doc().location.hash === '#historico', doc().location.hash);
    verificar('duas linhas no histórico', linhas() === 2, linhas());
    porId('aba-historico').focus();
    porId('aba-historico').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await esperar(40);
    verificar('seta troca de aba e leva o foco', porId('aba-calendario').getAttribute('aria-selected') === 'true' && doc().activeElement === porId('aba-calendario'));

    etapa = 'Editar e excluir registro';
    await abrir(`tanque.html?id=${tanqueId}&recarregar=1#historico`);
    verificar('#historico abre a aba', !porId('painel-historico').hidden);
    await navegarCom(() => porId('corpo-tabela-registros').querySelector('a.link').click());
    verificar('modo edição', texto('titulo-pagina-registro') === 'Editar registro' && porId('campo-tanque').disabled);
    verificar('valores preenchidos', porId('campo-peso-medio').value === '60' && porId('campo-racao').value === '7');
    preencher({ 'campo-racao': '8,75' });
    await enviarENavegar('formulario-registro');
    verificar('volta ao histórico', doc().location.hash === '#historico' && !porId('painel-historico').hidden);
    verificar('valor editado na tabela', porId('corpo-tabela-registros').rows[0].cells[2].textContent === '8,75', porId('corpo-tabela-registros').rows[0].cells[2].textContent);
    const idEditado = new URL(porId('corpo-tabela-registros').querySelector('a.link').href).searchParams.get('id');
    await abrir(`registro.html?id=${idEditado}`);
    verificar('edição mostra o valor com vírgula', porId('campo-racao').value === '8,75', porId('campo-racao').value);
    await abrir(`tanque.html?id=${tanqueId}&recarregar=2#historico`);
    porId('corpo-tabela-registros').querySelector('[data-excluir-registro]').click();
    await responderConfirmacao(false);
    await esperar(60);
    verificar('cancelar mantém o registro', linhas() === 2);
    porId('corpo-tabela-registros').querySelector('[data-excluir-registro]').click();
    await responderConfirmacao(true);
    await esperar(80);
    verificar('registro excluído', linhas() === 1 && texto('mensagem-historico') === 'Registro excluído.', `${linhas()} ${texto('mensagem-historico')}`);

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
    preencher({ 'campo-data-despesca': somarDias(HOJE, -25), 'campo-quantidade-despescada': '990', 'campo-peso-final': '80' });
    await enviarSemSair('formulario-registrar-despesca');
    verificar('RN09 antes do último registro', texto('erro-data-despesca') === `A despesca não pode ser anterior ao último registro (${emBr(somarDias(HOJE, -20))}).`, texto('erro-data-despesca'));
    preencher({ 'campo-data-despesca': HOJE });
    await enviarENavegar('formulario-registrar-despesca');
    verificar('RN08 tanque vazio', texto('selo-status-tanque') === 'Vazio' && !porId('aviso-sem-ciclo').hidden);
    verificar('arquivar disponível com histórico', !porId('botao-arquivar-tanque').hidden && porId('botao-excluir-tanque').hidden);
    await abrir('registro.html');
    verificar('registro sem tanques com ciclo ativo', !porId('aviso-sem-ciclo-ativo').hidden);

    etapa = 'Arquivar e desarquivar';
    await abrir(`tanque.html?id=${tanqueId}`);
    porId('botao-arquivar-tanque').click();
    await responderConfirmacao(true);
    await esperar(80);
    verificar('arquivado', texto('selo-status-tanque') === 'Arquivado' && !porId('botao-desarquivar-tanque').hidden);
    await abrir('tanques.html');
    porId('filtro-status').value = 'arquivado';
    porId('filtro-status').dispatchEvent(new Event('change'));
    await esperar(40);
    verificar('filtro de arquivados', doc().querySelectorAll('#grade-tanques .cartao-tanque').length === 1 && doc().location.search === '?status=arquivado');
    await abrir(`tanque.html?id=${tanqueId}`);
    porId('botao-desarquivar-tanque').click();
    await esperar(80);
    verificar('desarquivado', texto('selo-status-tanque') === 'Vazio', texto('selo-status-tanque'));

    etapa = 'Manutenção e exclusão';
    await abrir('tanque-form.html');
    preencher({ 'campo-nome': 'Descartável', 'campo-especie': 'Pacu', 'campo-volume': '10', 'campo-manutencao': true });
    await enviarENavegar('formulario-tanque');
    verificar('em manutenção, sem iniciar ciclo', texto('selo-status-tanque') === 'Em manutenção' && porId('link-iniciar-ciclo').hidden);
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
    verificar('CSV exportado', texto('mensagem-exportar') === `1 registro exportado para fish-track-registros-${HOJE}.csv.`, texto('mensagem-exportar'));
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
    etapa = 'Dashboard com dados';
    verificar('resumo da produção', texto('resumo-producao') === '3 tanques em cultivo, de 6 cadastrados · 4 alertas pedem atenção', texto('resumo-producao'));
    verificar('data por extenso', /^[A-ZÀ-Ú][a-zà-úç-]+, \d/.test(texto('data-hoje')), texto('data-hoje'));
    verificar('contadores do menu', doc().querySelector('[data-contador="alertas"]').textContent === '4' && doc().querySelector('[data-contador="tanques"]').textContent === '5');
    verificar('biomassa com variação e sparkline', /kg$/.test(doc().querySelector('[data-indicador-grafico="biomassa"] .destaque__valor').textContent)
        && doc().querySelector('[data-indicador-grafico="biomassa"] .sparkline polyline'));
    verificar('FCA com régua e meta', doc().querySelector('[data-indicador-grafico="fca"] .regua__meta')?.textContent === 'Meta 1,60');
    verificar('alerta alto primeiro, com ação', doc().querySelector('#lista-alertas li')?.classList.contains('lista-alertas__item--alta')
        && doc().querySelector('#lista-alertas li .lista-alertas__acao')?.textContent === 'Ver registro');
    verificar('3 cartões em cultivo e 1 sem ciclo', doc().querySelectorAll('#grade-tanques .cartao-cultivo:not(.cartao-cultivo--sem-ciclo)').length === 3
        && doc().querySelector('.cartao-cultivo--sem-ciclo')?.textContent.includes('1 vazio e 1 em manutenção'));
    verificar('barra compacta nos cartões', doc().querySelectorAll('#grade-tanques .barra-agua--compacta').length === 3);
    const cartao05 = [...doc().querySelectorAll('#grade-tanques .cartao-cultivo')].find((c) => c.textContent.includes('Tanque 05'));
    verificar('Tanque 05 perto do limite', cartao05?.querySelector('.barra-agua--perto .barra-agua__faixa')?.textContent === 'Perto do limite');
    verificar('Tanque 05 sem registro há 12 dias', cartao05?.querySelector('.cartao-cultivo__registro--atrasado')?.textContent === 'Sem registro há 12 dias');
    verificar('anel do peso até o alvo', [...doc().querySelectorAll('.cartao-cultivo')].find((c) => c.textContent.includes('Tanque 01'))?.querySelector('.anel__apoio')?.textContent === 'de 800 g');
    verificar('gráfico com uma linha por tanque', porId('grafico-principal').querySelectorAll('.grafico__linha-serie').length === 3);
    doc().querySelector('[data-indicador-grafico="fca"]').click();
    await esperar(60);
    verificar('linhas da FCA desenhadas', [...porId('grafico-principal').querySelectorAll('.grafico__linha-serie')].every((linha) => linha.getAttribute('d').length > 20));
    verificar('indicador troca o gráfico', texto('titulo-grafico') === 'Conversão alimentar' && porId('grafico-principal').querySelector('.grafico__meta')
        && doc().querySelector('[data-indicador-grafico="fca"]').getAttribute('aria-pressed') === 'true');
    cartao05.querySelector('[data-ver-grafico]').click();
    await esperar(60);
    verificar('Ver no gráfico filtra o tanque', texto('leitura-grafico').endsWith('hoje · Tanque 05')
        && porId('grafico-principal').querySelectorAll('.grafico__linha-serie').length === 1
        && cartao05.querySelector('[data-ver-grafico]').textContent === 'Mostrando no gráfico', texto('leitura-grafico'));
    cartao05.querySelector('[data-ver-grafico]').click();
    await esperar(60);
    verificar('clicar de novo volta para Todos', texto('leitura-grafico').endsWith('todos os tanques'), texto('leitura-grafico'));
    const svgGrafico = porId('grafico-principal').querySelector('svg');
    svgGrafico.focus();
    await esperar(40);
    verificar('tooltip pelo teclado', porId('grafico-principal').querySelector('.grafico-dica--visivel')?.textContent.includes('Geral'),
        porId('grafico-principal').querySelector('.grafico-dica')?.textContent);
    doc().querySelector('[data-gravidade="baixa"]').click();
    await esperar(40);
    verificar('chips filtram os alertas', doc().querySelectorAll('#lista-alertas .lista-alertas__item').length === 2
        && doc().querySelectorAll('#lista-alertas .lista-alertas__item--baixa').length === 2);
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
    verificar('backup restaurado', texto('mensagem-backup') === 'Backup restaurado: 1 tanque, 1 ciclo e 1 registro.', texto('mensagem-backup'));
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
    etapa = 'Lembretes de hoje no menu';
    await abrir('index.html');
    verificar('contador "1 de 3"', texto('contador-lembretes-hoje') === '1 de 3', texto('contador-lembretes-hoje'));
    const itensMenu = [...porId('lista-lembretes-hoje').querySelectorAll('.lembretes-hoje__item')];
    verificar('atrasado com selo no menu', itensMenu[0]?.textContent.includes('Revisar o aerador') && itensMenu[0].querySelector('.selo')?.textContent === 'Atrasado',
        itensMenu.map((item) => item.textContent).join(' | '));
    const caixaMenu = itensMenu.find((item) => item.textContent.includes('Biometria'))?.querySelector('input');
    caixaMenu.click();
    await esperar(60);
    verificar('conclui direto no menu', texto('contador-lembretes-hoje') === '2 de 3', texto('contador-lembretes-hoje'));
    [...porId('lista-lembretes-hoje').querySelectorAll('.lembretes-hoje__item')].find((item) => item.textContent.includes('Biometria')).querySelector('input').click();
    await esperar(60);
    verificar('desmarca no menu', texto('contador-lembretes-hoje') === '1 de 3', texto('contador-lembretes-hoje'));

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
    verificar('vários registros viram uma etiqueta com as bolinhas', etiquetas(ontem).includes('2 registros')
        && celula(ontem).querySelectorAll('.etiqueta--registro .etiqueta__ponto').length === 2, etiquetas(ontem).join(' | '));
    const alertaT02 = grade().querySelector('.etiqueta--alerta');
    verificar('alerta do dia com o tanque abreviado', alertaT02?.textContent === 'Mortalidade alta · T02' && alertaT02.title === 'Mortalidade alta: Tanque 02',
        alertaT02?.textContent);
    const ordemHoje = [...celula(HOJE).querySelectorAll('.etiqueta')].map((item) => item.className.match(/etiqueta--([a-z-]+)/)[1]);
    verificar('no máximo 3 etiquetas e "+N mais", alertas primeiro', ordemHoje.length === 3 && ordemHoje[0] === 'alerta'
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
    verificar('seções de hoje', secoes().join(',') === 'Atrasados,Lembretes,Registros,Alertas', secoes().join(','));
    verificar('atrasado no quadro de hoje', quadroDia().querySelector('.quadro__secao')?.textContent.includes('Revisar o aerador')
        && quadroDia().querySelector('.quadro__secao .selo')?.textContent === 'Atrasado');
    verificar('aviso de repetição', quadroDia().textContent.includes('repete a cada 15 dias'));
    verificar('registro com resumo e link de edição', quadroDia().querySelector('a[href^="registro.html?id="]')?.textContent === 'Editar registro');
    verificar('"Registro neste dia" em hoje', quadroDia().querySelector('a[href*="registro.html"][href*="data="]')?.getAttribute('href').includes(`data=${HOJE}`));
    const amanha = somarDias(HOJE, 1);
    celula(amanha).click();
    await esperar(40);
    verificar('dia sem nada', quadroDia().querySelector('.quadro__vazio')?.textContent === 'Nada marcado para este dia.', quadroDia().textContent);
    verificar('sem "Registro neste dia" no futuro (RN12)', !quadroDia().querySelector('a[href*="data="]'));
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
    [...porId('lista-lembretes-hoje').querySelectorAll('.lembretes-hoje__item')].find((item) => item.textContent.includes('Biometria')).querySelector('input').click();
    await esperar(60);
    verificar('conclusão no menu atualiza a agenda aberta', texto('contador-lembretes-hoje') === '2 de 3'
        && [...celula(HOJE).querySelectorAll('.etiqueta--concluida')].some((item) => item.textContent.startsWith('Biometria')));
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
    verificar('alertas com o tanque', doc().querySelectorAll('#conteudo-relatorio .lista-alertas__item').length === 4);
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
    verificar('alertas do tanque', porId('conteudo-relatorio').querySelectorAll('.lista-alertas__item').length === 2);
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

async function executar() {
    document.getElementById('iniciar').disabled = true;
    const resumo = document.getElementById('resumo');
    resumo.textContent = 'Executando…';
    const dadosDoNavegador = localStorage.getItem(CHAVE);
    try {
        await roteiro();
    } catch (erro) {
        resultados.push({ etapa, nome: 'roteiro interrompido', ok: false, detalhe: `${erro.message}\n${erro.stack}` });
    } finally {
        // Devolve os dados que o navegador tinha antes do teste.
        if (dadosDoNavegador === null) localStorage.removeItem(CHAVE); else localStorage.setItem(CHAVE, dadosDoNavegador);
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
