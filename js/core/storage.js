// Único ponto de leitura e escrita no localStorage (seção 10). Guarda tudo em
// uma chave, no formato da seção 8.3. Não conhece regras de negócio: lê, migra
// formatos antigos, confere a estrutura e grava. Cada leitura devolve uma cópia
// nova dos dados, então quem altera os objetos só afeta o que está salvo ao
// chamar salvarDados.

// A chave continua "v1" mesmo com o formato na versão 2: trocar a chave faria
// os dados existentes parecerem perdidos. A versão do formato fica no campo versao.
export const CHAVE_DADOS = 'fishtrack:v1';
export const VERSAO_DADOS = 2;

const CHAVE_COPIA_ILEGIVEL = `${CHAVE_DADOS}:ilegivel`;
// Preferências de tela (como o período do dashboard) ficam fora dos dados do
// produtor: não entram no backup nem na migração.
const CHAVE_PREFERENCIAS = 'fishtrack:preferencias';
const COLECOES = ['tanques', 'ciclos', 'registros', 'lembretes'];
const META_FCA_PADRAO = 1.6;

export function criarDadosVazios() {
    return {
        versao: VERSAO_DADOS,
        tanques: [],
        ciclos: [],
        registros: [],
        lembretes: [],
        config: { limitesAlerta: {}, metaFca: META_FCA_PADRAO, ultimoBackupEm: null },
    };
}

export function lerDados() {
    let texto;
    try {
        texto = localStorage.getItem(CHAVE_DADOS);
    } catch {
        throw new Error('O navegador bloqueou o armazenamento local. Verifique se este site tem permissão para guardar dados.');
    }
    if (texto === null) {
        return criarDadosVazios();
    }
    let lidos;
    let dados;
    try {
        lidos = JSON.parse(texto);
        dados = validarEstrutura(lidos);
    } catch {
        // Os dados são do produtor (seção 4): antes de recomeçar do zero, guarda
        // uma cópia do conteúdo ilegível para que ele possa ser recuperado.
        guardarCopiaIlegivel(texto);
        return criarDadosVazios();
    }
    if (lidos.versao !== VERSAO_DADOS) {
        // Formato antigo: grava já migrado, para a conversão acontecer uma vez só.
        // Fica fora do try: falta de espaço não pode parecer dado ilegível.
        salvarDados(dados);
    }
    return dados;
}

export function salvarDados(dados) {
    const texto = JSON.stringify(validarEstrutura(dados));
    try {
        localStorage.setItem(CHAVE_DADOS, texto);
    } catch {
        throw new Error('Não foi possível salvar os dados neste aparelho. O armazenamento pode estar cheio ou bloqueado.');
    }
}

export function apagarDados() {
    try {
        localStorage.removeItem(CHAVE_DADOS);
    } catch {
        throw new Error('Não foi possível apagar os dados deste aparelho.');
    }
}

// Confere a estrutura e devolve os dados no formato atual. Formatos antigos
// passam pela migração; usado na leitura e na restauração de backup.
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
    const config = atuais.config && typeof atuais.config === 'object' ? atuais.config : {};
    const limites = config.limitesAlerta;
    return {
        versao: VERSAO_DADOS,
        tanques: atuais.tanques,
        ciclos: atuais.ciclos,
        registros: atuais.registros,
        lembretes: atuais.lembretes,
        config: {
            ...config,
            limitesAlerta: limites && typeof limites === 'object' ? limites : {},
            metaFca: Number.isFinite(config.metaFca) ? config.metaFca : META_FCA_PADRAO,
            ultimoBackupEm: config.ultimoBackupEm ?? null,
        },
    };
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

function guardarCopiaIlegivel(texto) {
    try {
        localStorage.setItem(CHAVE_COPIA_ILEGIVEL, texto);
    } catch {
        // Sem espaço nem para a cópia: não há mais o que fazer aqui.
    }
}
