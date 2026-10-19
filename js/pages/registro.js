// Novo registro e edição (seção 7.6). registro.html?tanqueId=... já vem com o
// tanque escolhido; registro.html?id=... edita um registro existente.

import { ehDataISO, hojeISO, paraNumero } from '../core/utils.js';
import { formatarGramas, formatarInteiro, formatarNumero } from '../core/format.js';
import { listarSituacoes, obterSituacao } from '../domain/tanques.js';
import { obterRegistro, salvarRegistro } from '../domain/registros.js';
import { calcularIndicadores } from '../domain/indicadores.js';
import { irPara, lerParametro, montarUrl } from '../ui/nav.js';
import { criarElemento, iniciarFormulario, mostrarErroPagina, preencherFormulario } from '../ui/componentes.js';
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
    seletorTanque.addEventListener('change', atualizarTanqueEscolhido);
    atualizarTanqueEscolhido();
    configurarBiometria();
    porId('botao-usar-sugestao').addEventListener('click', usarSugestao);
    iniciarFormulario(formulario, { erroGeral: porId('erro-geral-registro'), aoEnviar: enviar });
    // Erro num campo de seção recolhida: abre a seção para o produtor ver.
    formulario.addEventListener('submit', () => queueMicrotask(abrirSecoesComErro));
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

    situacoes = [situacao];
    document.title = 'Fish Track - Editar registro';
    porId('titulo-pagina-registro').textContent = 'Editar registro';
    seletorTanque.append(criarOpcao(situacao));
    seletorTanque.value = situacao.tanque.id;
    // Um registro não muda de tanque: na edição o seletor fica travado.
    seletorTanque.disabled = true;
    preencherFormulario(formulario, {
        id: registro.id,
        data: registro.data,
        pesoMedioG: registro.biometria ? null : registro.pesoMedioG,
        racaoKg: registro.racaoKg,
        racaoSobraKg: registro.racaoSobraKg,
        mortalidade: registro.mortalidade,
        causaMortalidade: registro.causaMortalidade ?? '',
        natalidade: registro.natalidade,
        observacoes: registro.observacoes,
        // A amostra fica guardada em gramas; na edição aparece em gramas.
        peixesAmostra: registro.biometria?.peixesAmostra ?? null,
        pesoAmostraG: registro.biometria?.pesoAmostraG ?? null,
        comprimentoMedioCm: registro.biometria?.comprimentoMedioCm ?? null,
    });
    formulario.querySelector(`[name="modoBiometria"][value="${registro.biometria || registro.pesoMedioG === null ? 'amostra' : 'peso'}"]`).checked = true;
    if (registro.biometria) {
        formulario.querySelector('[name="unidadePesoAmostra"][value="g"]').checked = true;
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

function criarOpcao({ tanque }) {
    return criarElemento('option', { texto: tanque.nome, atributos: { value: tanque.id } });
}

function atualizarTanqueEscolhido() {
    const situacao = situacoes.find((item) => item.tanque.id === seletorTanque.value);
    const ajuda = porId('ajuda-mortalidade');
    if (!situacao) {
        campoData.min = '';
        ajuda.textContent = AJUDA_MORTOS;
        return;
    }
    // RN12: o calendário do campo não deixa escolher data antes do povoamento.
    campoData.min = situacao.cicloAtivo.dataInicio;
    const { quantidade } = calcularIndicadores({
        tanque: situacao.tanque,
        ciclo: situacao.cicloAtivo,
        registros: situacao.registros,
        hoje: hojeISO(),
    });
    ajuda.textContent = `${AJUDA_MORTOS} Estimativa atual: ${formatarInteiro(quantidade)} peixes.`;
    mostrarSugestao(situacao);
}

// ---------- Ração sugerida (seção 9.10) ----------

function mostrarSugestao(situacao) {
    const descricao = descreverRacaoSugerida(situacao);
    racaoSugeridaKg = descricao.sugestao ? Math.round(descricao.sugestao.racaoDiaKg * 10) / 10 : null;
    porId('texto-sugestao-racao').textContent = descricao.sugestao
        ? `Sugerida para hoje: ${descricao.textoDia} · ${descricao.textoDetalhe}${descricao.aviso ? `. ${descricao.aviso}` : ''}`
        : descricao.textoMotivo;
    porId('botao-usar-sugestao').hidden = racaoSugeridaKg === null;
    porId('sugestao-racao').hidden = false;
}

function usarSugestao() {
    const campo = porId('campo-racao');
    campo.value = formatarNumero(racaoSugeridaKg, 1);
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.focus();
}

// ---------- Biometria por amostra (seção 9.4) ----------

function modoBiometria() {
    return formulario.querySelector('[name="modoBiometria"]:checked').value;
}

// Peso da amostra em gramas, na unidade escolhida (guardado sempre em g).
function lerPesoAmostraG() {
    const valor = paraNumero(porId('campo-peso-amostra').value);
    const emKg = formulario.querySelector('[name="unidadePesoAmostra"]:checked').value === 'kg';
    return valor === null || Number.isNaN(valor) ? valor : emKg ? valor * 1000 : valor;
}

function configurarBiometria() {
    const atualizar = () => {
        const amostra = modoBiometria() === 'amostra';
        porId('grupo-amostra').hidden = !amostra;
        porId('grupo-peso-medio').hidden = amostra;
        const peixes = paraNumero(porId('campo-peixes-amostra').value);
        const peso = lerPesoAmostraG();
        // Peso médio = peso da amostra ÷ peixes pesados, mostrado enquanto se digita.
        porId('peso-medio-calculado').textContent = peixes > 0 && peso > 0
            ? `Peso médio: ${formatarGramas(peso / peixes)}`
            : '';
    };
    formulario.addEventListener('input', atualizar);
    formulario.addEventListener('change', atualizar);
    atualizar();
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
        pesoMedioG: modoBiometria() === 'peso' ? paraNumero(valores.pesoMedioG) : null,
        biometria: modoBiometria() === 'amostra' ? {
            peixesAmostra: paraNumero(valores.peixesAmostra),
            pesoAmostraG: lerPesoAmostraG(),
            comprimentoMedioCm: paraNumero(valores.comprimentoMedioCm),
        } : null,
        racaoKg: paraNumero(valores.racaoKg),
        racaoSobraKg: paraNumero(valores.racaoSobraKg),
        mortalidade: paraNumero(valores.mortalidade),
        causaMortalidade: valores.causaMortalidade,
        natalidade: paraNumero(valores.natalidade),
        observacoes: valores.observacoes,
    });
    irPara(montarUrl('tanque.html', { id: registro.tanqueId }, registroId ? 'historico' : ''));
}
