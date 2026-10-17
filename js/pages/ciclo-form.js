// Iniciar ciclo e registrar despesca (seção 7.5). O endereço indica o tanque e
// a ação: ciclo-form.html?tanqueId=...&acao=iniciar (ou acao=despesca).

import { hojeISO, paraNumero } from '../core/utils.js';
import { formatarGramas, formatarInteiro } from '../core/format.js';
import { obterSituacao } from '../domain/tanques.js';
import { iniciarCiclo, registrarDespesca, verificarInicioCiclo } from '../domain/ciclos.js';
import { calcularIndicadores } from '../domain/indicadores.js';
import { iniciarNavegacao, irPara, lerParametro, montarUrl } from '../ui/nav.js';
import { iniciarFormulario, mostrarErroPagina, preencherCampos } from '../ui/componentes.js';

const tanqueId = lerParametro('tanqueId');
const acao = lerParametro('acao') === 'despesca' ? 'despesca' : 'iniciar';
const porId = (id) => document.getElementById(id);

iniciarNavegacao();
try {
    iniciar();
} catch (erro) {
    mostrarErroPagina(erro);
}

function iniciar() {
    const situacao = tanqueId ? obterSituacao(tanqueId) : null;
    if (!situacao) {
        porId('aviso-tanque-nao-encontrado').hidden = false;
        return;
    }
    const urlTanque = montarUrl('tanque.html', { id: situacao.tanque.id });
    preencherCampos(document, { nomeTanque: `${situacao.tanque.nome} · ${situacao.tanque.especie}` });
    for (const link of document.querySelectorAll('[data-campo="linkCancelar"]')) {
        link.href = urlTanque;
    }
    porId('link-voltar-tanque').href = urlTanque;

    if (acao === 'despesca') {
        prepararDespesca(situacao, urlTanque);
    } else {
        prepararInicio(situacao, urlTanque);
    }
}

function mostrarIndisponivel(motivo) {
    porId('texto-acao-indisponivel').textContent = motivo;
    porId('aviso-acao-indisponivel').hidden = false;
}

function prepararInicio({ tanque }, urlTanque) {
    const motivo = verificarInicioCiclo(tanque.id);
    if (motivo) {
        mostrarIndisponivel(motivo);
        return;
    }
    document.title = `Fish Track - Iniciar ciclo · ${tanque.nome}`;
    porId('secao-iniciar-ciclo').hidden = false;
    const hoje = hojeISO();
    const data = porId('campo-data-inicio');
    data.value = hoje;
    data.max = hoje;

    iniciarFormulario(porId('formulario-iniciar-ciclo'), {
        erroGeral: porId('erro-geral-iniciar-ciclo'),
        aoEnviar: (valores) => {
            iniciarCiclo(tanque.id, {
                dataInicio: valores.dataInicio,
                quantidadeInicial: paraNumero(valores.quantidadeInicial),
                pesoMedioInicialG: paraNumero(valores.pesoMedioInicialG),
                pesoAlvoG: paraNumero(valores.pesoAlvoG),
                dataPrevistaDespesca: valores.dataPrevistaDespesca,
            });
            irPara(urlTanque);
        },
    });
}

function prepararDespesca({ tanque, cicloAtivo, registros }, urlTanque) {
    if (!cicloAtivo) {
        mostrarIndisponivel('Este tanque não tem ciclo ativo, então não há despesca a registrar.');
        return;
    }
    document.title = `Fish Track - Registrar despesca · ${tanque.nome}`;
    porId('secao-registrar-despesca').hidden = false;
    const hoje = hojeISO();
    const indicadores = calcularIndicadores({ tanque, ciclo: cicloAtivo, registros, hoje });
    const data = porId('campo-data-despesca');
    data.value = hoje;
    data.max = hoje;
    // RN09: o calendário do campo já começa no último registro (ou no povoamento).
    data.min = registros.at(-1)?.data ?? cicloAtivo.dataInicio;
    // As estimativas entram como sugestão, não como valor: a despesca registra o
    // que foi contado e pesado de fato.
    porId('campo-quantidade-despescada').placeholder = `Estimativa: ${formatarInteiro(indicadores.quantidade)}`;
    porId('campo-peso-final').placeholder = `Último peso: ${formatarGramas(indicadores.pesoMedioG)}`;

    iniciarFormulario(porId('formulario-registrar-despesca'), {
        erroGeral: porId('erro-geral-registrar-despesca'),
        aoEnviar: (valores) => {
            registrarDespesca(tanque.id, {
                dataDespesca: valores.dataDespesca,
                quantidadeDespescada: paraNumero(valores.quantidadeDespescada),
                pesoMedioFinalG: paraNumero(valores.pesoMedioFinalG),
            });
            irPara(urlTanque);
        },
    });
}
