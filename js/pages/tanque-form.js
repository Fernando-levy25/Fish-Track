// Cadastro e edição de tanque (seção 7.4). Endereço: tanque-form.html para
// um tanque novo, tanque-form.html?id=... para editar.

import { paraNumero } from '../core/utils.js';
import { formatarKg, formatarNumero } from '../core/format.js';
import { obterSituacao, salvarTanque } from '../domain/tanques.js';
import { calcularCargaMaximaKg } from '../domain/indicadores.js';
import { irPara, lerParametro, montarUrl } from '../ui/nav.js';
import { iniciarFormulario, limparErroCampo, mostrarErroPagina, preencherFormulario } from '../ui/componentes.js';
import { iniciarPagina } from './comum.js';

const tanqueId = lerParametro('id');
const porId = (id) => document.getElementById(id);
const formulario = porId('formulario-tanque');
const campoVolume = porId('campo-volume');
const campoDensidade = porId('campo-densidade-maxima');
const campoCarga = porId('campo-carga-maxima');

iniciarPagina();
try {
    iniciar();
} catch (erro) {
    mostrarErroPagina(erro);
}

function iniciar() {
    if (tanqueId) {
        const situacao = obterSituacao(tanqueId);
        if (!situacao) {
            porId('aviso-tanque-nao-encontrado').hidden = false;
            porId('secao-formulario-tanque').hidden = true;
            return;
        }
        prepararEdicao(situacao);
    }
    for (const opcao of formulario.elements.capacidadeUnidade) {
        opcao.addEventListener('change', trocarUnidade);
    }
    for (const campo of [campoVolume, campoDensidade, campoCarga]) {
        campo.addEventListener('input', atualizarEquivalencia);
    }
    atualizarEquivalencia();

    iniciarFormulario(formulario, {
        erroGeral: porId('erro-geral-tanque'),
        aoEnviar: (valores) => {
            const tanque = salvarTanque({
                id: valores.id || null,
                nome: valores.nome,
                especie: valores.especie,
                volumeM3: paraNumero(valores.volumeM3),
                // Só o campo da unidade escolhida é enviado: o domínio converte a carga em kg/m³.
                ...(valores.capacidadeUnidade === 'carga'
                    ? { cargaMaximaKg: paraNumero(valores.cargaMaximaKg) }
                    : { densidadeMaximaKgM3: paraNumero(valores.densidadeMaximaKgM3) }),
                manutencao: Boolean(valores.manutencao),
                observacoes: valores.observacoes,
            });
            irPara(montarUrl('tanque.html', { id: tanque.id }));
        },
    });
}

function prepararEdicao({ tanque, cicloAtivo }) {
    document.title = `Fish Track - Editar ${tanque.nome}`;
    porId('titulo-formulario-tanque').textContent = 'Editar tanque';
    porId('link-cancelar-tanque').href = montarUrl('tanque.html', { id: tanque.id });
    const carga = calcularCargaMaximaKg(tanque.densidadeMaximaKgM3, tanque.volumeM3);
    preencherFormulario(formulario, {
        id: tanque.id,
        nome: tanque.nome,
        especie: tanque.especie,
        volumeM3: tanque.volumeM3,
        densidadeMaximaKgM3: arredondar(tanque.densidadeMaximaKgM3, 2),
        cargaMaximaKg: arredondar(carga, 1),
        manutencao: tanque.status === 'manutencao',
        observacoes: tanque.observacoes,
    });

    const manutencao = porId('campo-manutencao');
    if (tanque.status === 'arquivado') {
        // O arquivamento se desfaz na página do tanque; aqui o status não muda.
        manutencao.parentElement.hidden = true;
    } else if (cicloAtivo) {
        // RN03: com ciclo ativo, o status é sempre "ativo".
        manutencao.disabled = true;
        porId('ajuda-manutencao').textContent = 'Indisponível enquanto houver ciclo ativo: o status do tanque é "Ativo".';
    }
}

function arredondar(valor, casas) {
    if (valor === null || valor === undefined) {
        return null;
    }
    const fator = 10 ** casas;
    return Math.round(valor * fator) / fator;
}

// Mostra só o campo da unidade escolhida; o outro fica desabilitado e não é enviado.
function trocarUnidade() {
    const porCarga = porId('unidade-carga').checked;
    campoCarga.hidden = !porCarga;
    campoCarga.disabled = !porCarga;
    campoDensidade.hidden = porCarga;
    campoDensidade.disabled = porCarga;
    limparErroCampo(campoCarga);
    limparErroCampo(campoDensidade);
    atualizarEquivalencia();
}

// Mostra o valor na outra unidade, para o produtor conferir a conta (seção 4.2).
function atualizarEquivalencia() {
    const volume = paraNumero(campoVolume.value);
    const porCarga = porId('unidade-carga').checked;
    const valor = paraNumero(porCarga ? campoCarga.value : campoDensidade.value);
    let texto = '';
    if (volume > 0 && valor > 0) {
        texto = porCarga
            ? `Equivale a ${formatarNumero(valor / volume, 2, 2)} kg de peixe por m³ de água.`
            : `Equivale a uma carga máxima de ${formatarKg(calcularCargaMaximaKg(valor, volume))} neste tanque.`;
    }
    porId('equivalencia-capacidade').textContent = texto;
}
