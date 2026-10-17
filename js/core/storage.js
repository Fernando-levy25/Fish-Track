// Único ponto de leitura e escrita no localStorage (seção 10). Guarda tudo em
// uma chave, no formato da seção 8.3. Não conhece regras de negócio: lê, confere
// a estrutura e grava. Cada leitura devolve uma cópia nova dos dados, então quem
// altera os objetos só afeta o que está salvo ao chamar salvarDados.

export const CHAVE_DADOS = 'fishtrack:v1';
export const VERSAO_DADOS = 1;

const CHAVE_COPIA_ILEGIVEL = `${CHAVE_DADOS}:ilegivel`;
const COLECOES = ['tanques', 'ciclos', 'registros'];

export function criarDadosVazios() {
    return { versao: VERSAO_DADOS, tanques: [], ciclos: [], registros: [], config: { limitesAlerta: {} } };
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
    try {
        return validarEstrutura(JSON.parse(texto));
    } catch {
        // Os dados são do produtor (seção 4): antes de recomeçar do zero, guarda
        // uma cópia do conteúdo ilegível para que ele possa ser recuperado.
        guardarCopiaIlegivel(texto);
        return criarDadosVazios();
    }
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

export function validarEstrutura(dados) {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
        throw new Error('O conteúdo não está no formato de dados do Fish Track.');
    }
    // A versão permite migrar os dados quando o formato mudar (seção 8.3). Hoje
    // só existe a versão 1; outra versão veio de um Fish Track mais novo.
    if (dados.versao !== VERSAO_DADOS) {
        throw new Error(`Estes dados são da versão ${dados.versao ?? 'desconhecida'}, e esta versão do Fish Track lê apenas a versão ${VERSAO_DADOS}.`);
    }
    for (const colecao of COLECOES) {
        const itens = dados[colecao];
        if (!Array.isArray(itens) || !itens.every((item) => item && typeof item.id === 'string')) {
            throw new Error(`A lista de ${colecao} está ausente ou corrompida.`);
        }
    }
    const limites = dados.config?.limitesAlerta;
    return {
        versao: VERSAO_DADOS,
        tanques: dados.tanques,
        ciclos: dados.ciclos,
        registros: dados.registros,
        config: { ...dados.config, limitesAlerta: limites && typeof limites === 'object' ? limites : {} },
    };
}

function guardarCopiaIlegivel(texto) {
    try {
        localStorage.setItem(CHAVE_COPIA_ILEGIVEL, texto);
    } catch {
        // Sem espaço nem para a cópia: não há mais o que fazer aqui.
    }
}
