// Correções do teste de usuário de 23/11/2026 (Prompt 05). Os dados do teste
// servem de caso: Viveiro 01 com 10 m³, plano fixo de 6% em 4 refeições,
// povoamento em 26/10 pesando 0,1 kg de animais de 0,01 g (10.000).
// Rodar com: node --test tests/

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RAIZ } from './ambiente.mjs';

const format = await import(RAIZ + 'core/format.js');
const storage = await import(RAIZ + 'core/storage.js');
const tanques = await import(RAIZ + 'domain/tanques.js');
const ciclos = await import(RAIZ + 'domain/ciclos.js');
const registros = await import(RAIZ + 'domain/registros.js');
const biometrias = await import(RAIZ + 'domain/biometrias.js');
const arracoamento = await import(RAIZ + 'domain/arracoamento.js');
const ind = await import(RAIZ + 'domain/indicadores.js');
const alertas = await import(RAIZ + 'domain/alertas.js');

// O "hoje" do teste de usuário. Os alertas recebem a data por argumento.
const HOJE = '2026-11-23';

beforeEach(() => {
    localStorage.clear();
    format.definirUnidadesExibicao({ biomassa: 'kg', racao: 'kg' });
});

function criarViveiro({ comPlano = true } = {}) {
    const plano = comPlano ? arracoamento.salvarTabela({ nome: 'Fixo 6%', tipo: 'fixo', taxaPct: 6, refeicoes: 4 }) : null;
    const tanque = tanques.salvarTanque({
        nome: 'Viveiro 01', especie: 'Camarão', volumeM3: 10, densidadeMaximaKgM3: 4,
        intervaloBiometriaDias: 7, tabelaArracoamentoId: plano?.id ?? null,
    });
    ciclos.iniciarCiclo(tanque.id, {
        dataInicio: '2026-10-26', modoPovoamento: 'pesagem', biomassaInicialKg: 0.1, pesoMedioInicialG: 0.01,
        pesoAlvoG: 15, dataPrevistaDespesca: '2027-01-25',
    });
    return tanque.id;
}

function analisar(tanqueId, hoje = HOJE) {
    return alertas.analisarTanque(tanques.obterSituacao(tanqueId), { limitesPadrao: alertas.LIMITES_PADRAO, hoje });
}

const doTipo = (lista, tipo) => lista.filter((alerta) => alerta.tipo === tipo);

describe('Prompt 05, A1: alerta de mortalidade na janela de 7 dias', () => {
    it('400 mortos em 22/11 continuam no alerta depois de anotar 3 em 23/11', () => {
        const id = criarViveiro();
        registros.salvarRegistro({ tanqueId: id, data: '2026-11-22', racaoKg: 0.5, racaoSobraKg: 0.05, mortalidade: 400 });
        registros.salvarRegistro({ tanqueId: id, data: '2026-11-23', mortalidade: 3 });
        const [alerta] = doTipo(analisar(id).alertas, 'mortalidade-registro');
        assert.equal(alerta.data, '2026-11-22');
        assert.equal(alerta.descricao, '400 peixes mortos em 22/11/2026: 4% do estoque estimado (limite de 1%).');
        assert.equal(alerta.resumo, '400 peixes mortos ontem');
    });
    it('dois dias acima do limite: um alerta só, com o pior dia e "mais 1 dia"', () => {
        const id = criarViveiro();
        registros.salvarRegistro({ tanqueId: id, data: '2026-11-20', mortalidade: 150 });
        registros.salvarRegistro({ tanqueId: id, data: '2026-11-22', mortalidade: 400 });
        const lista = doTipo(analisar(id).alertas, 'mortalidade-registro');
        assert.equal(lista.length, 1);
        assert.equal(lista[0].data, '2026-11-22');
        assert.match(lista[0].descricao, /^400 peixes mortos em 22\/11\/2026: .* Mais 1 dia acima do limite nesta semana\.$/);
    });
    it('um pico de 10 dias atrás não gera alerta', () => {
        const id = criarViveiro();
        registros.salvarRegistro({ tanqueId: id, data: '2026-11-13', mortalidade: 400 });
        registros.salvarRegistro({ tanqueId: id, data: '2026-11-22', mortalidade: 1 });
        assert.deepEqual(doTipo(analisar(id).alertas, 'mortalidade-registro'), []);
        assert.equal(alertas.JANELA_ALERTA_MORTALIDADE_DIAS, 7);
    });
    it('um dia anotado com atraso, dentro da janela, entra', () => {
        const id = criarViveiro();
        registros.salvarRegistro({ tanqueId: id, data: '2026-11-22', mortalidade: 2 });
        registros.salvarRegistro({ tanqueId: id, data: '2026-11-23', mortalidade: 1 });
        registros.salvarRegistro({ tanqueId: id, data: '2026-11-18', mortalidade: 300 });
        const [alerta] = doTipo(analisar(id).alertas, 'mortalidade-registro');
        assert.equal(alerta.data, '2026-11-18');
    });
});

describe('Prompt 05, A2: casas decimais sem trocar a unidade', () => {
    it('valores pequenos ganham casas; a partir de 10, as casas de antes', () => {
        const casos = [
            [format.formatarGramas(0.01), '0,01 g'],
            [format.formatarGramas(1.04), '1,04 g'],
            [format.formatarGramas(542.5), '542,5 g'],
            [format.formatarRacao(0.624), '0,62 kg'],
            [format.formatarRacao(0.0225), '0,023 kg'],
            [format.formatarRacao(1234.5), '1.234,5 kg'],
            [format.formatarRacao(0.0004), '< 0,001 kg'],
            [format.formatarRacao(0), '0 kg'],
            [format.formatarGramasPorDia(0.04), '0,04 g/dia'],
            [format.formatarBiomassa(6.2), '6,2 kg'],
        ];
        for (const [obtido, esperado] of casos) {
            assert.equal(obtido, esperado);
        }
    });
    it('a conversão abaixo do campo nunca mostra "= 0" para um valor maior que 0', () => {
        assert.equal(format.formatarConversao(0.5, 'racao', 'kg'), '= 0,5 kg');
        assert.equal(format.formatarConversao(0.624, 'racao', 'g'), '= 624 g');
        assert.equal(format.formatarConversao(0.1, 'biomassa', 't'), '< 0,001 t');
        assert.equal(format.formatarConversao(0.1, 'biomassa', 'g'), '= 100 g');
    });
    it('uma função só decide as casas', () => {
        assert.equal(format.calcularCasasDecimais(1234.5, 1), 1);
        assert.equal(format.calcularCasasDecimais(1.04, 1), 2);
        assert.equal(format.calcularCasasDecimais(0.0225, 1), 3);
        assert.equal(format.calcularCasasDecimais(0.0001, 1), 3);
        assert.equal(format.calcularCasasDecimais(0, 1), 1);
    });
});

describe('Prompt 05, A3: "Alimentei conforme o plano" grava a sugestão exata', () => {
    it('a folha do dia grava a ração sugerida sem arredondar', () => {
        const id = criarViveiro();
        registros.salvarRegistro({ tanqueId: id, data: '2026-11-22', racaoKg: 0.5, racaoSobraKg: 0.05, mortalidade: 400 });
        biometrias.salvarBiometria({ tanqueId: id, data: '2026-11-23', biometria: { peixesAmostra: 50, pesoAmostraG: 52 } });
        const situacao = tanques.obterSituacao(id);
        const indicadores = ind.calcularIndicadores({ tanque: situacao.tanque, ciclo: situacao.cicloAtivo, registros: situacao.registros, hoje: HOJE });
        const { sugestao } = ind.calcularRacaoSugerida({ indicadores, tabela: situacao.plano });
        // 9.600 animais × 1,04 g × 6% = 599,04 g: antes, a folha gravava 600 g.
        assert.ok(Math.abs(sugestao.racaoDiaKg - 0.59904) < 1e-9);
        registros.salvarFolhaDoDia({ data: '2026-11-23', linhas: [{ tanqueId: id, racaoKg: 0.599, racaoSobraKg: 0.02, mortalidade: 3 }] });
        const salvo = storage.lerDados().registros.find((registro) => registro.data === '2026-11-23' && registro.racaoKg !== null);
        assert.equal(salvo.racaoKg, 0.599);
    });
});

describe('Prompt 05, A5: alerta de ração coerente com o plano', () => {
    const anotar = (id, racaoKg) => {
        biometrias.salvarBiometria({ tanqueId: id, data: '2026-11-23', biometria: { peixesAmostra: 50, pesoAmostraG: 52 } });
        registros.salvarRegistro({ tanqueId: id, data: '2026-11-23', racaoKg, racaoSobraKg: 0.02, mortalidade: 3 });
    };
    // 10.000 animais × 1,04 g × 6% = 624 g; o fim do dia tem 3 mortos a menos.
    const SUGESTAO_KG = 0.624;
    it('plano de 6% e ração igual à sugestão: sem alerta', () => {
        const id = criarViveiro();
        anotar(id, SUGESTAO_KG);
        assert.deepEqual(doTipo(analisar(id).alertas, 'racao'), []);
    });
    it('25% acima do plano: alerta com a sugestão e a tolerância', () => {
        const id = criarViveiro();
        anotar(id, SUGESTAO_KG * 1.25);
        const [alerta] = doTipo(analisar(id).alertas, 'racao');
        assert.match(alerta.descricao, /^Ração de 0,78 kg em 23\/11\/2026, 25(,\d)?% acima do plano \(0,62 kg; tolerância de 20%\)\.$/);
        assert.equal(alertas.TOLERANCIA_RACAO_PLANO_PCT, 20);
    });
    it('tanque sem plano: o limite geral de 5% da biomassa', () => {
        const id = criarViveiro({ comPlano: false });
        anotar(id, SUGESTAO_KG);
        const [alerta] = doTipo(analisar(id).alertas, 'racao');
        assert.match(alerta.descricao, /da biomassa \(limite de 5%\)\.$/);
    });
    it('uma função pura decide o limite', () => {
        const limites = alertas.LIMITES_PADRAO;
        const indicadores = { biomassaKg: 10, pesoMedioG: 1, houvePesagem: true };
        const comPlano = alertas.calcularLimiteRacaoDia({ plano: { tipo: 'fixo', taxaPct: 6, refeicoes: 4 }, indicadores, limites });
        assert.deepEqual([comPlano.tipo, Math.round(comPlano.limiteKg * 1000)], ['plano', 720]);
        const foraDasFaixas = alertas.calcularLimiteRacaoDia({
            plano: { tipo: 'faixas', faixas: [{ pesoDeG: 190, pesoAteG: 225, taxaPct: 3, refeicoes: 4 }] }, indicadores, limites,
        });
        assert.deepEqual([foraDasFaixas.tipo, foraDasFaixas.limiteKg], ['biomassa', 0.5]);
    });
});
