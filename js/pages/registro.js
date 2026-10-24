// Registro de um tanque (seção 7.6): só a rotina do dia (ração, sobra, mortos).
// A biometria tem painel próprio na página do tanque (seção 7.13).
// registro.html?tanqueId=... já vem com o tanque escolhido; registro.html?id=...
// edita um registro existente.

import { ehDataISO, hojeISO, paraNumero } from '../core/utils.js';
import { formatarData, formatarGramas, formatarInteiro, pluralizar } from '../core/format.js';
import { lerPreferencia, salvarPreferencia } from '../core/storage.js';
import { listarSituacoes, obterSituacao } from '../domain/tanques.js';
import { obterRegistro, salvarRegistro } from '../domain/registros.js';
import { ehRegistroDeBiometria } from '../domain/biometrias.js';
import { calcularIndicadores } from '../domain/indicadores.js';
import { irPara, lerParametro, montarUrl } from '../ui/nav.js';
import { criarElemento, iniciarCampoUnidade, iniciarFormulario, mostrarErroPagina, preencherFormulario } from '../ui/componentes.js';
import { descreverRacaoSugerida, iniciarPagina } from './comum.js';

const AJUDA_MORTOS = 'Peixes mortos vistos neste dia. O número real só é conhecido na despesca.';

const registroId = lerParametro('id');
const tanqueDoEndereco = lerParametro('tanqueId');
// "Registro neste dia", da agenda, chega com a data do dia escolhido.
const dataDoEndereco = lerParametro('data');
const porId = (id) => document.getElementById(id);
const formulario = porId('formulario-registro');
const seletorTanque = porId('campo-tanque');
const campoData = porId('campo-data');

// Tanques que aparecem no seletor, com o ciclo ativo e os registros de cada um.
let situacoes = [];
// Ração sugerida para o tanque escolhido, para o botão "Usar sugestão".
let racaoSugeridaKg = null;
// Registro em edição: o peso que ele tiver é mantido como está (só a biometria o altera).
let registroEditado = null;
let campoRacao = null;
let campoSobra = null;

iniciarPagina();
try {
    iniciar();
} catch (erro) {
    mostrarErroPagina(erro);
}

function iniciar() {
    const hoje = hojeISO();
    campoData.max = hoje;
    const pronto = registroId ? prepararEdicao() : prepararNovo(hoje);
    if (!pronto) {
        return;
    }
    configurarUnidades();
    if (registroEditado) {
        campoRacao.definirBase(registroEditado.racaoKg);
        campoSobra.definirBase(registroEditado.racaoSobraKg);
    }
    seletorTanque.addEventListener('change', atualizarTanqueEscolhido);
    atualizarTanqueEscolhido();
    porId('botao-usar-sugestao').addEventListener('click', usarSugestao);
    iniciarFormulario(formulario, { erroGeral: porId('erro-geral-registro'), aoEnviar: enviar });
    // Erro num campo de seção recolhida: abre a seção para o produtor ver.
    formulario.addEventListener('submit', () => queueMicrotask(abrirSecoesComErro));
}

// Ração e sobra em kg ou g; a última unidade escolhida fica lembrada (seção 8.1).
function configurarUnidades() {
    const opcoes = (chave) => ({
        grandeza: 'racao',
        unidades: ['kg', 'g'],
        unidadeInicial: lerPreferencia(chave, 'kg'),
        aoTrocarUnidade: (unidade) => salvarPreferencia(chave, unidade),
    });
    campoRacao = iniciarCampoUnidade(porId('campo-racao'), opcoes('unidadeRacaoRegistro'));
    campoSobra = iniciarCampoUnidade(porId('campo-sobra'), opcoes('unidadeSobraRegistro'));
}

function prepararNovo(hoje) {
    // RN10: só tanques com ciclo ativo recebem registros.
    situacoes = listarSituacoes().filter((situacao) => situacao.cicloAtivo);
    if (situacoes.length === 0) {
        porId('aviso-sem-ciclo-ativo').hidden = false;
        porId('secao-formulario-registro').hidden = true;
        return false;
    }
    seletorTanque.append(...situacoes.map(criarOpcao));
    const doEndereco = situacoes.find((situacao) => situacao.tanque.id === tanqueDoEndereco);
    const escolhido = doEndereco ?? (situacoes.length === 1 ? situacoes[0] : null);
    if (escolhido) {
        seletorTanque.value = escolhido.tanque.id;
    }
    // Vindo de um tanque, ele fica fixo no topo, sem a lista para escolher.
    if (doEndereco) {
        mostrarTanqueFixo(doEndereco.tanque);
    }
    // RN12: data futura no endereço é ignorada; fica hoje.
    campoData.value = ehDataISO(dataDoEndereco) && dataDoEndereco <= hoje ? dataDoEndereco : hoje;
    porId('link-cancelar-registro').href = doEndereco ? montarUrl('tanque.html', { id: doEndereco.tanque.id }) : 'index.html';
    return true;
}

function prepararEdicao() {
    const registro = obterRegistro(registroId);
    const situacao = registro ? obterSituacao(registro.tanqueId) : null;
    if (!registro || !situacao) {
        return mostrarIndisponivel('Registro não encontrado. Ele pode ter sido excluído.', 'index.html', 'Voltar ao início');
    }
    const urlHistorico = montarUrl('tanque.html', { id: registro.tanqueId }, 'historico');
    if (situacao.cicloAtivo?.id !== registro.cicloId) {
        return mostrarIndisponivel('Este registro pertence a um ciclo encerrado e não pode ser alterado.', urlHistorico, 'Voltar ao histórico');
    }
    const urlBiometria = montarUrl('tanque.html', { id: registro.tanqueId, acao: 'biometria', registro: registro.id });
    // Registro só de biometria: quem edita é o painel de biometria do tanque.
    if (ehRegistroDeBiometria(registro)) {
        irPara(urlBiometria);
        return false;
    }

    registroEditado = registro;
    situacoes = [situacao];
    document.title = 'Fish Track - Editar registro';
    porId('titulo-pagina-registro').textContent = 'Editar registro';
    seletorTanque.append(criarOpcao(situacao));
    seletorTanque.value = situacao.tanque.id;
    // Um registro não muda de tanque: na edição o tanque fica fixo.
    seletorTanque.disabled = true;
    mostrarTanqueFixo(situacao.tanque);
    preencherFormulario(formulario, {
        id: registro.id,
        data: registro.data,
        mortalidade: registro.mortalidade,
        causaMortalidade: registro.causaMortalidade ?? '',
        natalidade: registro.natalidade,
        observacoes: registro.observacoes,
    });
    // Registro antigo com peso e rotina juntos: o peso aparece só para leitura.
    if (registro.pesoMedioG !== null && registro.pesoMedioG !== undefined) {
        porId('texto-peso-registro').textContent = `Peso médio: ${formatarGramas(registro.pesoMedioG)}`
            + (registro.biometria ? ` (amostra de ${pluralizar(registro.biometria.peixesAmostra, 'peixe', 'peixes')})` : '')
            + ` em ${formatarData(registro.data)}.`;
        porId('link-editar-peso').href = urlBiometria;
        porId('peso-registro').hidden = false;
    }
    porId('link-cancelar-registro').href = urlHistorico;
    return true;
}

function mostrarIndisponivel(texto, href, rotuloLink) {
    porId('texto-registro-indisponivel').textContent = texto;
    const link = porId('link-voltar-registro');
    link.href = href;
    link.textContent = rotuloLink;
    porId('aviso-registro-indisponivel').hidden = false;
    porId('secao-formulario-registro').hidden = true;
    return false;
}

function mostrarTanqueFixo(tanque) {
    porId('tanque-fixo').textContent = tanque.nome;
    porId('tanque-fixo').hidden = false;
    porId('grupo-tanque').hidden = true;
}

function criarOpcao({ tanque }) {
    return criarElemento('option', { texto: tanque.nome, atributos: { value: tanque.id } });
}

function atualizarTanqueEscolhido() {
    const situacao = situacoes.find((item) => item.tanque.id === seletorTanque.value);
    const ajuda = porId('ajuda-mortalidade');
    porId('aviso-biometria').hidden = !situacao || Boolean(registroEditado);
    if (!situacao) {
        campoData.min = '';
        ajuda.textContent = AJUDA_MORTOS;
        porId('sugestao-racao').hidden = true;
        return;
    }
    porId('link-biometria').href = montarUrl('tanque.html', { id: situacao.tanque.id, acao: 'biometria' });
    // RN12: o calendário do campo não deixa escolher data antes do povoamento.
    campoData.min = situacao.cicloAtivo.dataInicio;
    const { quantidade } = calcularIndicadores({
        tanque: situacao.tanque,
        ciclo: situacao.cicloAtivo,
        registros: situacao.registros,
        hoje: hojeISO(),
    });
    ajuda.textContent = `${AJUDA_MORTOS} Estimativa atual: ≈ ${formatarInteiro(quantidade)} peixes.`;
    mostrarSugestao(situacao);
}

// ---------- Ração sugerida (seção 9.10) ----------

function mostrarSugestao(situacao) {
    const descricao = descreverRacaoSugerida(situacao);
    racaoSugeridaKg = descricao.sugestao ? Math.round(descricao.sugestao.racaoDiaKg * 10) / 10 : null;
    const texto = porId('texto-sugestao-racao');
    if (descricao.sugestao) {
        texto.textContent = `Sugerida para hoje: ${descricao.textoDia} · ${descricao.textoDetalhe}${descricao.aviso ? `. ${descricao.aviso}` : ''}`;
    } else {
        // Nunca um traço sem motivo: o motivo e o link que resolve.
        texto.replaceChildren(`${descricao.textoMotivo} · `,
            criarElemento('a', { classe: 'link', texto: descricao.acaoMotivo.texto, atributos: { href: descricao.acaoMotivo.href } }));
    }
    porId('botao-usar-sugestao').hidden = racaoSugeridaKg === null;
    porId('sugestao-racao').hidden = false;
}

function usarSugestao() {
    campoRacao.definirBase(racaoSugeridaKg);
    porId('campo-racao').focus();
}

function abrirSecoesComErro() {
    for (const secao of formulario.querySelectorAll('details')) {
        if ([...secao.querySelectorAll('.campo__erro')].some((erro) => erro.textContent)) {
            secao.open = true;
        }
    }
}

function enviar(valores) {
    const registro = salvarRegistro({
        id: valores.id || null,
        tanqueId: valores.tanqueId,
        data: valores.data,
        // O peso de um registro antigo fica como está; só a biometria o muda.
        pesoMedioG: registroEditado?.biometria ? null : registroEditado?.pesoMedioG ?? null,
        biometria: registroEditado?.biometria ?? null,
        racaoKg: campoRacao.lerBase(),
        racaoSobraKg: campoSobra.lerBase(),
        mortalidade: paraNumero(valores.mortalidade),
        causaMortalidade: valores.causaMortalidade,
        natalidade: paraNumero(valores.natalidade),
        observacoes: valores.observacoes,
    });
    irPara(montarUrl('tanque.html', { id: registro.tanqueId }, registroId ? 'historico' : ''));
}
