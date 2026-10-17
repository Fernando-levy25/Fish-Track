// Novo registro e edição (seção 7.6). registro.html?tanqueId=... já vem com o
// tanque escolhido; registro.html?id=... edita um registro existente.

import { ehDataISO, hojeISO, paraNumero } from '../core/utils.js';
import { formatarInteiro } from '../core/format.js';
import { listarSituacoes, obterSituacao } from '../domain/tanques.js';
import { obterRegistro, salvarRegistro } from '../domain/registros.js';
import { calcularIndicadores } from '../domain/indicadores.js';
import { irPara, lerParametro, montarUrl } from '../ui/nav.js';
import { criarElemento, iniciarFormulario, mostrarErroPagina, preencherFormulario } from '../ui/componentes.js';
import { iniciarPagina } from './comum.js';

const AJUDA_CONTAGEM = 'Só se você contou os peixes. Corrige a quantidade estimada do tanque.';

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
    iniciarFormulario(formulario, { erroGeral: porId('erro-geral-registro'), aoEnviar: enviar });
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
        pesoMedioG: registro.pesoMedioG,
        racaoKg: registro.racaoKg,
        mortalidade: registro.mortalidade,
        natalidade: registro.natalidade,
        quantidadeContada: registro.quantidadeContada,
        observacoes: registro.observacoes,
    });
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
    const ajuda = porId('ajuda-quantidade-contada');
    if (!situacao) {
        campoData.min = '';
        ajuda.textContent = AJUDA_CONTAGEM;
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
    ajuda.textContent = `${AJUDA_CONTAGEM} Estimativa atual: ${formatarInteiro(quantidade)} peixes.`;
}

function enviar(valores) {
    const registro = salvarRegistro({
        id: valores.id || null,
        tanqueId: valores.tanqueId,
        data: valores.data,
        pesoMedioG: paraNumero(valores.pesoMedioG),
        racaoKg: paraNumero(valores.racaoKg),
        mortalidade: paraNumero(valores.mortalidade),
        natalidade: paraNumero(valores.natalidade),
        quantidadeContada: paraNumero(valores.quantidadeContada),
        observacoes: valores.observacoes,
    });
    irPara(montarUrl('tanque.html', { id: registro.tanqueId }, registroId ? 'historico' : ''));
}
