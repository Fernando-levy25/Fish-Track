// Iniciar ciclo e registrar despesca (seção 7.5). O endereço indica o tanque e
// a ação: ciclo-form.html?tanqueId=...&acao=iniciar (ou acao=despesca).

import { hojeISO, paraNumero } from '../core/utils.js';
import { formatarFca, formatarGramas, formatarInteiro, formatarKg, formatarPercentual } from '../core/format.js';
import { obterSituacao } from '../domain/tanques.js';
import { iniciarCiclo, listarResultadosCiclos, registrarDespesca, verificarInicioCiclo } from '../domain/ciclos.js';
import { calcularIndicadores } from '../domain/indicadores.js';
import { irPara, lerParametro, montarUrl } from '../ui/nav.js';
import { iniciarFormulario, mostrarErroPagina, preencherCampos } from '../ui/componentes.js';
import { iniciarPagina } from './comum.js';

const tanqueId = lerParametro('tanqueId');
const acao = lerParametro('acao') === 'despesca' ? 'despesca' : 'iniciar';
const porId = (id) => document.getElementById(id);

iniciarPagina();
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
    // O resultado real do último ciclo é a referência para planejar o próximo.
    const ultimo = listarResultadosCiclos(tanque.id)[0]?.resultado;
    if (ultimo) {
        const referencia = porId('referencia-ciclo-anterior');
        referencia.textContent = `Último ciclo: sobrevivência de ${formatarPercentual(ultimo.sobrevivenciaReal)}, `
            + `FCA de ${formatarFca(ultimo.fcaFinal)}, ${formatarInteiro(ultimo.diasCultivo)} dias.`;
        referencia.hidden = false;
    }
    const hoje = hojeISO();
    const data = porId('campo-data-inicio');
    data.value = hoje;
    data.max = hoje;

    configurarModoPovoamento(porId('formulario-iniciar-ciclo'));
    iniciarFormulario(porId('formulario-iniciar-ciclo'), {
        erroGeral: porId('erro-geral-iniciar-ciclo'),
        aoEnviar: (valores) => {
            iniciarCiclo(tanque.id, {
                dataInicio: valores.dataInicio,
                modoPovoamento: valores.modoPovoamento,
                quantidadeInicial: paraNumero(valores.quantidadeInicial),
                biomassaInicialKg: paraNumero(valores.biomassaInicialKg),
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
    // que foi pesado (e, se houver, contado) de fato.
    porId('campo-biomassa-final').placeholder = `Estimativa: ${formatarKg(indicadores.biomassaKg)}`;
    porId('campo-quantidade-despescada').placeholder = `Estimativa: ${formatarInteiro(indicadores.quantidade)}`;
    porId('campo-peso-final').placeholder = `Último peso: ${formatarGramas(indicadores.pesoMedioG)}`;

    iniciarFormulario(porId('formulario-registrar-despesca'), {
        erroGeral: porId('erro-geral-registrar-despesca'),
        aoEnviar: (valores) => {
            registrarDespesca(tanque.id, {
                dataDespesca: valores.dataDespesca,
                biomassaFinalKg: paraNumero(valores.biomassaFinalKg),
                pesoMedioFinalG: paraNumero(valores.pesoMedioFinalG),
                quantidadeDespescada: paraNumero(valores.quantidadeDespescada),
            });
            // A página do tanque abre com o resumo do ciclo que acabou de fechar.
            irPara(montarUrl('tanque.html', { id: tanque.id, despesca: 1 }));
        },
    });
}

// "Contei os peixes" ou "Pesei o lote" (RN21): o valor que falta aparece ao
// vivo, abaixo dos campos, enquanto o produtor digita.
function configurarModoPovoamento(formulario) {
    const atualizar = () => {
        const pesagem = formulario.querySelector('[name="modoPovoamento"]:checked').value === 'pesagem';
        porId('grupo-quantidade-inicial').hidden = pesagem;
        porId('grupo-biomassa-inicial').hidden = !pesagem;
        const peso = paraNumero(porId('campo-peso-inicial').value);
        const quantidade = paraNumero(porId('campo-quantidade-inicial').value);
        const biomassa = paraNumero(porId('campo-biomassa-inicial').value);
        let texto = '';
        if (pesagem && biomassa > 0 && peso > 0) {
            texto = `≈ ${formatarInteiro(Math.round((biomassa * 1000) / peso))} peixes (estimado)`;
        } else if (!pesagem && quantidade > 0 && peso > 0) {
            texto = `Biomassa inicial: ${formatarKg((quantidade * peso) / 1000)}`;
        }
        porId('resultado-povoamento').textContent = texto;
    };
    formulario.addEventListener('input', atualizar);
    formulario.addEventListener('change', atualizar);
    atualizar();
}
