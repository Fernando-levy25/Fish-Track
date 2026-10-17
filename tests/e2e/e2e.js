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
    verificar('tanques ativos = 0', indicador('tanquesAtivos') === '0', indicador('tanquesAtivos'));
    verificar('mortalidade média sem dados', indicador('mortalidadeMedia') === '—', indicador('mortalidadeMedia'));
    verificar('aviso de nenhum tanque', texto('grade-tanques').startsWith('Nenhum tanque cadastrado ainda'), texto('grade-tanques'));
    verificar('sem alertas', texto('lista-alertas') === 'Nenhum alerta no momento.', texto('lista-alertas'));

    etapa = 'Cadastro de tanque';
    await abrir('tanque-form.html');
    await enviarSemSair('formulario-tanque');
    verificar('erro no nome', texto('erro-nome') === 'Informe o nome do tanque.' && porId('campo-nome').getAttribute('aria-invalid') === 'true', texto('erro-nome'));
    verificar('erro no volume', texto('erro-volume') === 'Informe o volume.', texto('erro-volume'));
    verificar('foco vai para o primeiro erro', doc().activeElement === porId('campo-nome'));
    preencher({ 'campo-nome': 'Tanque Teste', 'campo-especie': 'Tilápia', 'campo-volume': '120', 'campo-capacidade': '1.000', 'campo-observacoes': 'Tanque de teste' });
    verificar('erro some ao digitar', !porId('campo-nome').hasAttribute('aria-invalid') && texto('erro-nome') === '');
    await enviarENavegar('formulario-tanque');
    const tanqueId = new URLSearchParams(doc().location.search).get('id');
    verificar('abre a página do tanque', pagina() === 'tanque.html' && tanqueId, doc().location.href);
    verificar('título e selo', texto('titulo-tanque') === 'Tanque Teste' && porId('selo-status-tanque').classList.contains('selo--vazio'), texto('selo-status-tanque'));
    verificar('ações de tanque vazio sem ciclos', !porId('link-iniciar-ciclo').hidden && !porId('botao-excluir-tanque').hidden
        && porId('botao-arquivar-tanque').hidden && porId('link-novo-registro').hidden);
    verificar('aviso sem ciclo', !porId('aviso-sem-ciclo').hidden && porId('conteudo-resumo').hidden);

    etapa = 'RN01 nome único';
    await abrir('tanque-form.html');
    preencher({ 'campo-nome': ' tanque teste ', 'campo-especie': 'X', 'campo-volume': '1', 'campo-capacidade': '1' });
    await enviarSemSair('formulario-tanque');
    verificar('nome repetido recusado', texto('erro-nome') === 'Já existe um tanque com esse nome.', texto('erro-nome'));

    etapa = 'Editar tanque';
    await abrir(`tanque-form.html?id=${tanqueId}`);
    verificar('modo edição preenchido', texto('titulo-formulario-tanque') === 'Editar tanque' && porId('campo-volume').value === '120');
    preencher({ 'campo-volume': '150,5' });
    await enviarENavegar('formulario-tanque');
    verificar('vírgula decimal no volume', dados().tanques[0].volumeM3 === 150.5, dados().tanques[0].volumeM3);

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
    preencher({ 'campo-nome': 'Descartável', 'campo-especie': 'Pacu', 'campo-volume': '10', 'campo-capacidade': '50', 'campo-manutencao': true });
    await enviarENavegar('formulario-tanque');
    verificar('em manutenção, sem iniciar ciclo', texto('selo-status-tanque') === 'Em manutenção' && porId('link-iniciar-ciclo').hidden);
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
    verificar('3 tanques ativos', indicador('tanquesAtivos') === '3', indicador('tanquesAtivos'));
    verificar('alerta alto primeiro', doc().querySelector('#lista-alertas li')?.classList.contains('lista-alertas__item--alta'));
    await abrir('alertas.html');
    verificar('3 grupos de alertas', doc().querySelectorAll('#grupos-alertas .grupo-alertas').length === 3);
    await abrir('calendario.html');
    verificar('eventos de hoje', doc().querySelectorAll('#lista-eventos-dia .lista-eventos__item').length >= 2, texto('lista-eventos-dia'));
    await abrir('tanques.html');
    verificar('5 tanques na lista padrão', doc().querySelectorAll('.cartao-tanque').length === 5);

    if (parametros.has('servidor-teste')) {
        etapa = 'Modo offline (service worker)';
        const registro = await quadro.contentWindow.navigator.serviceWorker.getRegistration();
        await esperarAte(() => registro?.active, 10000);
        verificar('service worker ativo', registro?.active?.state === 'activated', registro?.active?.state);
        await fetch('/__teste/offline?ligar=1', { method: 'POST' });
        await abrir('index.html');
        verificar('dashboard sem internet', indicador('tanquesAtivos') === '3', indicador('tanquesAtivos'));
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
