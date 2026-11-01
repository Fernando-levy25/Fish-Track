// Único ponto de leitura e escrita no localStorage (seção 10). Guarda tudo em
// uma chave, no formato da seção 8.3. Não conhece regras de negócio: lê, migra
// formatos antigos, confere a estrutura e grava. Cada leitura devolve uma cópia
// nova dos dados, então quem altera os objetos só afeta o que está salvo ao
// chamar salvarDados.

// A chave continua "v1" mesmo com o formato na versão 2: trocar a chave faria
// os dados existentes parecerem perdidos. A versão do formato fica no campo versao.
export const CHAVE_DADOS = 'fishtrack:v1';
export const VERSAO_DADOS = 5;

// Cópias de dados que não puderam ser lidos: "fishtrack:v1:ilegivel:<data ISO>".
// A chave sem data é de versões anteriores do app e fica como estava.
const PREFIXO_COPIA_ILEGIVEL = `${CHAVE_DADOS}:ilegivel`;
const MAXIMO_COPIAS_ILEGIVEIS = 3;
// Dados de antes da última restauração de backup (só a última).
const CHAVE_ANTES_RESTAURACAO = `${CHAVE_DADOS}:antes-da-restauracao`;
// Preferências de tela (como o período do dashboard) ficam fora dos dados do
// produtor: não entram no backup nem na migração.
const CHAVE_PREFERENCIAS = 'fishtrack:preferencias';
const COLECOES = ['tanques', 'ciclos', 'registros', 'lembretes'];
const META_FCA_PADRAO = 1.6;
const UNIDADES_VALIDAS = { biomassa: ['kg', 't'], racao: ['kg', 'g'] };

// Dados salvos que não puderam ser lidos. Eles ficam intactos e nada é gravado
// até o produtor escolher o que fazer (tela de bloqueio, seção 8.5).
export class ErroDadosIlegiveis extends Error {
    constructor(mensagem = 'Não foi possível ler os dados salvos neste aparelho.') {
        super(mensagem);
        this.name = 'ErroDadosIlegiveis';
    }
}

// Dados gravados por uma versão do app mais nova que esta: nada é gravado por cima.
export class ErroVersaoMaisNova extends Error {
    constructor(versao) {
        super(`Estes dados são da versão ${versao}, e esta versão do Fish Track lê até a versão ${VERSAO_DADOS}.`);
        this.name = 'ErroVersaoMaisNova';
        this.versao = versao;
    }
}

// Gravação recusada porque os dados salvos não podem ser substituídos agora.
export class ErroArmazenamentoBloqueado extends Error {
    constructor(mensagem = 'Nada pode ser salvo agora: resolva o aviso no topo da página.') {
        super(mensagem);
        this.name = 'ErroArmazenamentoBloqueado';
    }
}

// O aparelho não tem espaço para gravar: nada foi alterado.
export class ErroArmazenamentoCheio extends Error {
    constructor(mensagem = 'Não foi possível salvar: o armazenamento está cheio. Nada foi alterado.') {
        super(mensagem);
        this.name = 'ErroArmazenamentoCheio';
    }
}

// Migração lida mas não gravada por falta de espaço: o app fica só para leitura
// nesta página (seção 8.5). Cada página é carregada de novo, então a gravação é
// tentada outra vez a cada abertura.
let dadosSomenteMemoria = null;

export function criarConfigPadrao() {
    return { limitesAlerta: {}, metaFca: META_FCA_PADRAO, ultimoBackupEm: null, tabelasArracoamento: [], unidades: { biomassa: 'kg', racao: 'kg' } };
}

export function criarDadosVazios() {
    return { versao: VERSAO_DADOS, tanques: [], ciclos: [], registros: [], lembretes: [], config: criarConfigPadrao() };
}

function lerItem(chave) {
    try {
        return localStorage.getItem(chave);
    } catch {
        throw new Error('O navegador bloqueou o armazenamento local. Verifique se este site tem permissão para guardar dados.');
    }
}

// Grava e lê de volta: só uma cópia conferida caractere por caractere conta como guardada.
function gravarConferido(chave, texto) {
    try {
        localStorage.setItem(chave, texto);
        return localStorage.getItem(chave) === texto;
    } catch {
        return false;
    }
}

// Lê, valida e migra o texto salvo, sem gravar nada.
function interpretar(texto) {
    let lidos;
    try {
        lidos = JSON.parse(texto);
    } catch {
        throw new ErroDadosIlegiveis();
    }
    if (lidos && typeof lidos === 'object' && Number.isInteger(lidos.versao) && lidos.versao > VERSAO_DADOS) {
        throw new ErroVersaoMaisNova(lidos.versao);
    }
    try {
        return { dados: validarEstrutura(lidos), versaoLida: lidos.versao };
    } catch {
        throw new ErroDadosIlegiveis();
    }
}

export function lerDados() {
    if (dadosSomenteMemoria) {
        return structuredClone(dadosSomenteMemoria);
    }
    const texto = lerItem(CHAVE_DADOS);
    if (texto === null) {
        return criarDadosVazios();
    }
    // Ilegível ou de versão mais nova: lança, e o conteúdo salvo fica como está.
    const { dados, versaoLida } = interpretar(texto);
    if (versaoLida !== VERSAO_DADOS) {
        // Formato antigo: grava já migrado, para a conversão acontecer uma vez só.
        // Sem espaço, os dados antigos ficam intactos e o app abre só para leitura.
        try {
            localStorage.setItem(CHAVE_DADOS, JSON.stringify(dados));
        } catch {
            dadosSomenteMemoria = dados;
            return structuredClone(dados);
        }
    }
    return dados;
}

// "ok" | "ilegivel" | "versaoMaisNova" | "somenteMemoria"
export function verificarEstadoArmazenamento() {
    try {
        lerDados();
    } catch (erro) {
        if (erro instanceof ErroDadosIlegiveis) {
            return 'ilegivel';
        }
        if (erro instanceof ErroVersaoMaisNova) {
            return 'versaoMaisNova';
        }
        throw erro;
    }
    return dadosSomenteMemoria ? 'somenteMemoria' : 'ok';
}

// O estado em uso só muda depois que setItem funcionou: se falhar, nada mudou.
export function salvarDados(dados) {
    if (dadosSomenteMemoria) {
        throw new ErroArmazenamentoBloqueado('Nada pode ser salvo: o armazenamento deste aparelho está cheio.');
    }
    const atual = lerItem(CHAVE_DADOS);
    if (atual !== null) {
        // Nunca grava por cima de dados que não conseguiu ler.
        try {
            interpretar(atual);
        } catch {
            throw new ErroArmazenamentoBloqueado();
        }
    }
    const texto = JSON.stringify(validarEstrutura(dados));
    try {
        localStorage.setItem(CHAVE_DADOS, texto);
    } catch {
        throw new ErroArmazenamentoCheio();
    }
}

// "Tentar salvar de novo" no modo só leitura: grava a migração guardada em memória.
export function tentarSalvarDeNovo() {
    if (!dadosSomenteMemoria) {
        return verificarEstadoArmazenamento();
    }
    try {
        localStorage.setItem(CHAVE_DADOS, JSON.stringify(dadosSomenteMemoria));
        dadosSomenteMemoria = null;
        return 'ok';
    } catch {
        return 'somenteMemoria';
    }
}

export function apagarDados() {
    if (dadosSomenteMemoria) {
        throw new ErroArmazenamentoBloqueado('Nada pode ser alterado: o armazenamento deste aparelho está cheio.');
    }
    try {
        localStorage.removeItem(CHAVE_DADOS);
    } catch {
        throw new Error('Não foi possível apagar os dados deste aparelho.');
    }
}

// Conteúdo salvo exatamente como está, para baixar mesmo quando não pode ser lido.
// No modo só leitura, os dados migrados (é o que está guardado, no formato atual).
export function baixarConteudoBruto() {
    const conteudo = dadosSomenteMemoria ? JSON.stringify(dadosSomenteMemoria, null, 2) : lerItem(CHAVE_DADOS) ?? '';
    return { conteudo, arquivo: `fish-track-dados-${new Date().toISOString().slice(0, 10)}.json` };
}

// Guarda o conteúdo atual numa cópia datada e conferida. Sem a cópia, nada segue.
function guardarCopiaIlegivel(texto) {
    const chave = `${PREFIXO_COPIA_ILEGIVEL}:${new Date().toISOString()}`;
    if (!gravarConferido(chave, texto)) {
        try {
            localStorage.removeItem(chave);
        } catch {
            // A cópia incompleta não chegou a existir ou será descartada depois.
        }
        throw new ErroArmazenamentoBloqueado('Não foi possível guardar uma cópia dos dados atuais. Nada foi alterado. '
            + 'Para liberar espaço, descarte cópias antigas em "Dados recuperados".');
    }
    return chave;
}

// Só as cópias datadas entram no limite; a mais nova acabou de ser conferida.
function descartarCopiasExcedentes() {
    const datadas = listarCopiasIlegiveis().filter((copia) => copia.data);
    for (const copia of datadas.slice(MAXIMO_COPIAS_ILEGIVEIS)) {
        descartarCopiaIlegivel(copia.chave);
    }
}

// "Começar uma base nova" sobre dados ilegíveis: cópia conferida primeiro, base nova depois.
// Um download não substitui a cópia: o app não sabe se o arquivo foi salvo.
export function iniciarBaseNova({ confirmado = false } = {}) {
    if (confirmado !== true) {
        throw new ErroArmazenamentoBloqueado('Confirme que os dados atuais serão substituídos.');
    }
    const texto = lerItem(CHAVE_DADOS);
    if (texto !== null) {
        guardarCopiaIlegivel(texto);
    }
    try {
        localStorage.setItem(CHAVE_DADOS, JSON.stringify(criarDadosVazios()));
    } catch {
        throw new ErroArmazenamentoCheio('Não foi possível criar a base nova: o armazenamento está cheio. Os dados atuais continuam guardados.');
    }
    dadosSomenteMemoria = null;
    descartarCopiasExcedentes();
}

// Mais nova primeiro; a cópia sem data (versões antigas do app) por último.
export function listarCopiasIlegiveis() {
    const copias = [];
    try {
        for (let i = 0; i < localStorage.length; i += 1) {
            const chave = localStorage.key(i);
            if (chave === PREFIXO_COPIA_ILEGIVEL || chave?.startsWith(`${PREFIXO_COPIA_ILEGIVEL}:`)) {
                const data = chave.slice(PREFIXO_COPIA_ILEGIVEL.length + 1) || null;
                copias.push({ chave, data, tamanho: localStorage.getItem(chave)?.length ?? 0 });
            }
        }
    } catch {
        return [];
    }
    return copias.sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''));
}

function conferirChaveCopia(chave) {
    if (chave !== PREFIXO_COPIA_ILEGIVEL && !String(chave).startsWith(`${PREFIXO_COPIA_ILEGIVEL}:`)) {
        throw new Error('Cópia não encontrada.');
    }
}

export function lerCopiaIlegivel(chave) {
    conferirChaveCopia(chave);
    const conteudo = lerItem(chave);
    if (conteudo === null) {
        throw new Error('Cópia não encontrada.');
    }
    return conteudo;
}

export function descartarCopiaIlegivel(chave) {
    conferirChaveCopia(chave);
    localStorage.removeItem(chave);
}

// Substitui os dados por um backup já validado. Antes, guarda e confere uma cópia
// do que está salvo; sem ela, nada muda (seção 8.5).
export function substituirDados(dados) {
    if (dadosSomenteMemoria) {
        throw new ErroArmazenamentoBloqueado('Nada pode ser alterado: o armazenamento deste aparelho está cheio.');
    }
    const texto = JSON.stringify(validarEstrutura(dados));
    const atual = lerItem(CHAVE_DADOS);
    if (atual !== null) {
        let legivel = true;
        try {
            interpretar(atual);
        } catch {
            legivel = false;
        }
        if (legivel) {
            if (!gravarConferido(CHAVE_ANTES_RESTAURACAO, atual)) {
                throw new ErroArmazenamentoBloqueado('Não foi possível guardar uma cópia dos dados atuais. A restauração foi cancelada e nada foi alterado.');
            }
        } else {
            // Dados ilegíveis vão para uma cópia datada, como em "Começar uma base nova".
            guardarCopiaIlegivel(atual);
        }
    }
    try {
        localStorage.setItem(CHAVE_DADOS, texto);
    } catch {
        throw new ErroArmazenamentoCheio('Não foi possível restaurar: o armazenamento está cheio. Os dados atuais continuam guardados.');
    }
    descartarCopiasExcedentes();
}

export function lerCopiaAntesDaRestauracao() {
    return lerItem(CHAVE_ANTES_RESTAURACAO);
}

// Só depois de gravar a cópia de volta ela é apagada; quem chama já a validou.
export function voltarParaCopiaAntesDaRestauracao(dados) {
    if (dadosSomenteMemoria) {
        throw new ErroArmazenamentoBloqueado('Nada pode ser alterado: o armazenamento deste aparelho está cheio.');
    }
    const texto = JSON.stringify(validarEstrutura(dados));
    try {
        localStorage.setItem(CHAVE_DADOS, texto);
    } catch {
        throw new ErroArmazenamentoCheio('Não foi possível voltar aos dados de antes: o armazenamento está cheio. A cópia continua guardada.');
    }
    localStorage.removeItem(CHAVE_ANTES_RESTAURACAO);
}

// Confere a estrutura e devolve os dados no formato atual, com todo o config
// completo. Formatos antigos passam pela migração; usado na leitura e na
// restauração de backup. Não altera o objeto recebido.
export function validarEstrutura(dados) {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
        throw new Error('O conteúdo não está no formato de dados do Fish Track.');
    }
    if (!Number.isInteger(dados.versao) || dados.versao < 1 || dados.versao > VERSAO_DADOS) {
        throw new Error(`Estes dados são da versão ${dados.versao ?? 'desconhecida'}, e esta versão do Fish Track lê até a versão ${VERSAO_DADOS}.`);
    }
    const atuais = migrarDados(dados);
    for (const colecao of COLECOES) {
        const itens = atuais[colecao];
        if (!Array.isArray(itens) || !itens.every((item) => item && typeof item.id === 'string')) {
            throw new Error(`A lista de ${colecao} está ausente ou corrompida.`);
        }
    }
    return {
        versao: VERSAO_DADOS,
        tanques: atuais.tanques,
        ciclos: atuais.ciclos,
        registros: atuais.registros,
        lembretes: atuais.lembretes,
        config: completarConfig(atuais.config),
    };
}

// Campo ausente recebe o padrão; campo presente com formato inválido é recusado.
function completarConfig(lido) {
    const padrao = criarConfigPadrao();
    const config = lido && typeof lido === 'object' && !Array.isArray(lido) ? lido : {};
    const limites = config.limitesAlerta;
    const tabelas = config.tabelasArracoamento ?? padrao.tabelasArracoamento;
    if (!Array.isArray(tabelas)) {
        throw new Error('A lista de planos de alimentação está corrompida.');
    }
    tabelas.forEach(conferirPlano);
    const unidades = { ...padrao.unidades, ...(config.unidades && typeof config.unidades === 'object' ? config.unidades : {}) };
    for (const [grandeza, validas] of Object.entries(UNIDADES_VALIDAS)) {
        if (!validas.includes(unidades[grandeza])) {
            throw new Error(`A unidade de ${grandeza === 'racao' ? 'ração' : 'biomassa'} "${unidades[grandeza]}" não é válida.`);
        }
    }
    return {
        ...config,
        limitesAlerta: limites && typeof limites === 'object' && !Array.isArray(limites) ? limites : padrao.limitesAlerta,
        metaFca: Number.isFinite(config.metaFca) ? config.metaFca : padrao.metaFca,
        ultimoBackupEm: config.ultimoBackupEm ?? null,
        tabelasArracoamento: tabelas,
        unidades,
    };
}

// Só formato, para o backup não quebrar o app. Os limites da RN24 ficam em domain/arracoamento.js.
function conferirPlano(plano) {
    const numero = (valor) => Number.isFinite(valor);
    const valido = plano && typeof plano === 'object' && typeof plano.id === 'string'
        && (plano.tipo === 'fixo'
            ? numero(plano.taxaPct)
            : Array.isArray(plano.faixas) && plano.faixas.length > 0
                && plano.faixas.every((faixa) => faixa && numero(faixa.pesoDeG) && numero(faixa.pesoAteG) && numero(faixa.taxaPct)));
    if (!valido) {
        throw new Error(`O plano de alimentação "${plano?.nome ?? 'sem nome'}" não tem faixas válidas.`);
    }
}

// Converte dados de versões anteriores para a atual, uma versão por vez
// (seção 8.4). Não altera o objeto recebido.
export function migrarDados(dados) {
    let atuais = dados;
    if (atuais.versao === 1) {
        atuais = {
            ...atuais,
            versao: 2,
            lembretes: atuais.lembretes ?? [],
            // A capacidade passou de número de peixes para kg por m³ de água, e
            // não há conversão possível: o produtor informa o novo valor. O antigo
            // fica guardado só como referência.
            tanques: (atuais.tanques ?? []).map(({ capacidade, ...tanque }) => ({
                ...tanque,
                densidadeMaximaKgM3: null,
                capacidadePeixesLegado: capacidade ?? null,
            })),
            config: { ...atuais.config, metaFca: META_FCA_PADRAO, ultimoBackupEm: null },
        };
    }
    if (atuais.versao === 2) {
        atuais = {
            ...atuais,
            versao: 3,
            // A contagem durante o ciclo saiu (seção 9.4): na prática não se contam
            // os peixes. Um registro que só tinha a contagem guarda o número na
            // observação, para não perder a informação nem ficar vazio (RN11).
            registros: (atuais.registros ?? []).map(({ quantidadeContada, ...registro }) => {
                const vazio = ['pesoMedioG', 'racaoKg', 'mortalidade', 'natalidade'].every((campo) => registro[campo] === null || registro[campo] === undefined)
                    && !registro.observacoes;
                return vazio && quantidadeContada !== null && quantidadeContada !== undefined
                    ? { ...registro, observacoes: `Contagem registrada: ${quantidadeContada} peixes` }
                    : registro;
            }),
            // A despesca passou a fechar pela biomassa pesada (RN19); para os
            // ciclos antigos, ela sai da quantidade e do peso médio informados.
            ciclos: (atuais.ciclos ?? []).map((ciclo) => (ciclo.status === 'encerrado'
                ? { ...ciclo, biomassaFinalKg: (ciclo.quantidadeDespescada * ciclo.pesoMedioFinalG) / 1000 }
                : { ...ciclo, biomassaFinalKg: null })),
        };
    }
    if (atuais.versao === 3) {
        atuais = {
            ...atuais,
            versao: 4,
            // Povoamento por contagem ou por pesagem do lote; os antigos foram contados.
            ciclos: (atuais.ciclos ?? []).map((ciclo) => ({
                ...ciclo,
                modoPovoamento: 'contagem',
                biomassaInicialKg: (ciclo.quantidadeInicial * ciclo.pesoMedioInicialG) / 1000,
            })),
            registros: (atuais.registros ?? []).map((registro) => ({ ...registro, biometria: null, racaoSobraKg: null, causaMortalidade: null })),
            tanques: (atuais.tanques ?? []).map((tanque) => ({ ...tanque, tabelaArracoamentoId: null })),
            config: { ...atuais.config, tabelasArracoamento: [] },
        };
    }
    if (atuais.versao === 4) {
        atuais = {
            ...atuais,
            versao: 5,
            // Biometria a cada 15 dias, o costume do laboratório (seção 13).
            tanques: (atuais.tanques ?? []).map((tanque) => ({ ...tanque, intervaloBiometriaDias: 15 })),
            registros: (atuais.registros ?? []).map((registro) => (registro.biometria
                ? { ...registro, biometria: { ...registro.biometria, pesosIndividuaisG: null } }
                : registro)),
            config: {
                ...atuais.config,
                // As tabelas que existiam são todas por faixa de peso.
                tabelasArracoamento: (atuais.config?.tabelasArracoamento ?? []).map((tabela) => ({ ...tabela, tipo: 'faixas' })),
                unidades: { biomassa: 'kg', racao: 'kg' },
            },
        };
    }
    return atuais;
}

export function lerPreferencia(nome, padrao) {
    try {
        const preferencias = JSON.parse(localStorage.getItem(CHAVE_PREFERENCIAS) ?? '{}');
        return nome in preferencias ? preferencias[nome] : padrao;
    } catch {
        return padrao;
    }
}

export function salvarPreferencia(nome, valor) {
    try {
        const preferencias = JSON.parse(localStorage.getItem(CHAVE_PREFERENCIAS) ?? '{}');
        localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify({ ...preferencias, [nome]: valor }));
    } catch {
        // Preferência de tela não é dado do produtor: se não der para guardar, segue sem ela.
    }
}
