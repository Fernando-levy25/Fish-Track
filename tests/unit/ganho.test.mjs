// Testes do ganho de biomassa estimado (seção 9.4) e dos alertas sem estado de
// módulo (seção 9.5). Rodar com: node --test tests/

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RAIZ } from './ambiente.mjs';

const { hojeISO, somarDias } = await import(RAIZ + 'core/utils.js');
const { definirUnidadesExibicao, formatarMassa } = await import(RAIZ + 'core/format.js');
const tanques = await import(RAIZ + 'domain/tanques.js');
const ciclos = await import(RAIZ + 'domain/ciclos.js');
const registros = await import(RAIZ + 'domain/registros.js');
const ind = await import(RAIZ + 'domain/indicadores.js');
const alertas = await import(RAIZ + 'domain/alertas.js');

const hoje = hojeISO();
const inicio = somarDias(hoje, -5);
const quase = (a, b) => Math.abs(a - b) < 1e-9;

beforeEach(() => {
    localStorage.clear();
    definirUnidadesExibicao({ biomassa: 'kg', racao: 'kg' });
});

// Povoa por pesagem e anota 20 g de ração por dia nos 5 dias seguintes.
function povoarPorPesagem({ biomassaInicialKg = 1, pesoMedioInicialG = 6, volumeM3 = 10, densidadeMaximaKgM3 = 20 } = {}) {
    const tanque = tanques.salvarTanque({ nome: 'Tanque P', especie: 'Tilápia', volumeM3, densidadeMaximaKgM3 });
    ciclos.iniciarCiclo(tanque.id, { dataInicio: inicio, modoPovoamento: 'pesagem', biomassaInicialKg, pesoMedioInicialG });
    for (let dia = 1; dia <= 5; dia += 1) {
        registros.salvarRegistro({ tanqueId: tanque.id, data: somarDias(inicio, dia), racaoKg: 0.02 });
    }
    return tanque.id;
}

function calcularTudo(tanqueId) {
    const situacao = tanques.obterSituacao(tanqueId);
    const ciclo = situacao.cicloAtivo;
    const indicadores = ind.calcularIndicadores({ tanque: situacao.tanque, ciclo, registros: situacao.registros, hoje });
    const serie = ind.calcularSerieDiaria(ciclo, situacao.registros, inicio, hoje);
    const resumo = ind.calcularResumoPeriodo([{ tanque: situacao.tanque, ciclo, registros: situacao.registros }], { dataInicio: inicio, dataFim: hoje });
    return { situacao, ciclo, indicadores, serie, resumo };
}

describe('ganho estimado no povoamento por pesagem (seção 9.4, RN21)', () => {
    it('1 kg a 6 g (167 peixes, arredonda para cima), sem biometria: ganho 0 e sem FCA', () => {
        const { ciclo, indicadores, serie, resumo } = calcularTudo(povoarPorPesagem());
        assert.equal(ciclo.quantidadeInicial, 167);
        assert.equal(ciclo.biomassaInicialKg, 1);
        assert.ok(quase(indicadores.biomassaKg, 1.002));
        assert.equal(indicadores.ganhoBiomassaKg, 0);
        assert.equal(indicadores.fca, null, 'antes: FCA ≈ 50');
        assert.ok(quase(indicadores.racaoAcumuladaKg, 0.1));
        assert.equal(serie[0].fca, null, 'no dia do povoamento o ganho é 0');
        assert.equal(serie.at(-1).fca, null);
        assert.equal(resumo.fca.geral, null);
    });
    it('arredondando para baixo (1 kg a 9 g, 111 peixes): ganho 0, não negativo', () => {
        const { ciclo, indicadores } = calcularTudo(povoarPorPesagem({ pesoMedioInicialG: 9 }));
        assert.equal(ciclo.quantidadeInicial, 111);
        assert.equal(indicadores.ganhoBiomassaKg, 0);
        assert.equal(indicadores.fca, null);
    });
    it('com biometria: ganho sobre a base estimada e FCA = ração ÷ ganho, igual nas três contas', () => {
        const tanqueId = povoarPorPesagem();
        registros.salvarRegistro({ tanqueId, data: hoje, pesoMedioG: 10 });
        const { indicadores, serie, resumo } = calcularTudo(tanqueId);
        const ganhoEsperado = (167 * 10 - 167 * 6) / 1000;
        assert.ok(quase(indicadores.ganhoBiomassaKg, ganhoEsperado), String(indicadores.ganhoBiomassaKg));
        assert.ok(quase(indicadores.fca, 0.1 / ganhoEsperado));
        assert.ok(quase(serie.at(-1).fca, indicadores.fca), 'série diária');
        assert.ok(quase(resumo.fca.geral, indicadores.fca), 'resumo do período');
        assert.ok(quase(resumo.totais.at(-1).fca, indicadores.fca), 'totais do dia');
    });
    it('uma única base: calcularBiomassaInicialEstimadaKg', () => {
        assert.equal(ind.calcularBiomassaInicialEstimadaKg({ quantidadeInicial: 167, pesoMedioInicialG: 6, biomassaInicialKg: 1 }), 1.002);
    });
    it('povoamento por contagem: base estimada igual à gravada', () => {
        const tanque = tanques.salvarTanque({ nome: 'Tanque C', especie: 'Tilápia', volumeM3: 10, densidadeMaximaKgM3: 20 });
        ciclos.iniciarCiclo(tanque.id, { dataInicio: inicio, quantidadeInicial: 200, pesoMedioInicialG: 5 });
        registros.salvarRegistro({ tanqueId: tanque.id, data: hoje, pesoMedioG: 8, racaoKg: 0.3 });
        const { ciclo, indicadores } = calcularTudo(tanque.id);
        assert.equal(ciclo.biomassaInicialKg, ind.calcularBiomassaInicialEstimadaKg(ciclo));
        assert.ok(quase(indicadores.ganhoBiomassaKg, 0.6));
        assert.ok(quase(indicadores.fca, 0.5));
    });
});

describe('alertas sem estado de módulo (seção 9.5)', () => {
    // Capacidade passa do limite (1,002 kg em 1 kg) e a ração de hoje (20 g + 200 g) passa de 5% da biomassa.
    function analisar(opcoes = {}) {
        const tanqueId = povoarPorPesagem({ volumeM3: 1, densidadeMaximaKgM3: 1 });
        registros.salvarRegistro({ tanqueId, data: hoje, racaoKg: 0.2 });
        return alertas.analisarTanque(tanques.obterSituacao(tanqueId), { limitesPadrao: alertas.LIMITES_PADRAO, hoje, ...opcoes }).alertas;
    }
    const textos = (lista) => Object.fromEntries(lista.map((alerta) => [alerta.tipo, alerta.descricao]));

    it('unidades por argumento: t e g', () => {
        const porTipo = textos(analisar({ unidades: { biomassa: 't', racao: 'g' } }));
        assert.ok(porTipo.capacidade.includes(formatarMassa(1.002, 'biomassa', 't')), porTipo.capacidade);
        assert.ok(porTipo.capacidade.includes(' t '), porTipo.capacidade);
        assert.ok(porTipo.racao.startsWith('220 g'), porTipo.racao);
    });
    it('sem unidades: kg nas duas', () => {
        const porTipo = textos(analisar());
        assert.ok(porTipo.capacidade.includes(`${formatarMassa(1.002, 'biomassa', 'kg')} de ${formatarMassa(1, 'biomassa', 'kg')}`), porTipo.capacidade);
        assert.ok(porTipo.racao.startsWith(formatarMassa(0.22, 'racao', 'kg')), porTipo.racao);
    });
    it('a preferência guardada em core/format.js não muda o texto', () => {
        const antes = textos(analisar());
        localStorage.clear();
        definirUnidadesExibicao({ biomassa: 't', racao: 'g' });
        assert.deepEqual(textos(analisar()), antes);
        localStorage.clear();
        assert.deepEqual(textos(analisar({ unidades: { biomassa: 'kg', racao: 'kg' } })), antes);
    });
});
