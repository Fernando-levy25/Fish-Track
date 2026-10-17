// Testes das regras de negócio e dos cálculos (core e domain).
// Rodar com: node --test tests/

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RAIZ } from './ambiente.mjs';

const utils = await import(RAIZ + 'core/utils.js');
const format = await import(RAIZ + 'core/format.js');
const storage = await import(RAIZ + 'core/storage.js');
const tanques = await import(RAIZ + 'domain/tanques.js');
const ciclos = await import(RAIZ + 'domain/ciclos.js');
const registros = await import(RAIZ + 'domain/registros.js');
const ind = await import(RAIZ + 'domain/indicadores.js');
const alertas = await import(RAIZ + 'domain/alertas.js');
const config = await import(RAIZ + 'domain/configuracoes.js');

const hoje = utils.hojeISO();
const dia = (n) => utils.somarDias(hoje, n);
const tanqueBase = (extra = {}) => tanques.salvarTanque({ nome: 'Tanque 01', especie: 'Tilápia', volumeM3: 100, capacidade: 2000, ...extra });
const comCiclo = (extra = {}) => {
    const tanque = tanqueBase();
    ciclos.iniciarCiclo(tanque.id, { dataInicio: dia(-30), quantidadeInicial: 1000, pesoMedioInicialG: 10, ...extra });
    return tanque;
};
const comCicloNome = (nome) => {
    const tanque = tanques.salvarTanque({ nome, especie: 'X', volumeM3: 1, capacidade: 2000 });
    ciclos.iniciarCiclo(tanque.id, { dataInicio: dia(-10), quantidadeInicial: 1000, pesoMedioInicialG: 1 });
    return tanque.id;
};
const comCicloArquivado = () => {
    const tanque = tanques.salvarTanque({ nome: 'Arquivado', especie: 'X', volumeM3: 1, capacidade: 10 });
    ciclos.iniciarCiclo(tanque.id, { dataInicio: dia(-20), quantidadeInicial: 10, pesoMedioInicialG: 1 });
    ciclos.registrarDespesca(tanque.id, { dataDespesca: dia(-1), quantidadeDespescada: 10, pesoMedioFinalG: 5 });
    tanques.arquivarTanque(tanque.id);
    return tanque.id;
};

// Confere que a função lança ErroValidacao com o erro no campo indicado (ou geral, sem campo).
function recusa(funcao, campo, trecho) {
    try {
        funcao();
    } catch (erro) {
        assert.equal(erro.name, 'ErroValidacao', `esperava ErroValidacao, veio ${erro.message}`);
        const texto = campo ? erro.erros[campo] : erro.message;
        assert.ok(texto, `sem erro no campo ${campo}: ${JSON.stringify(erro.erros)} / ${erro.message}`);
        if (trecho) assert.match(texto, trecho);
        return;
    }
    assert.fail('a função deveria recusar');
}

beforeEach(() => localStorage.clear());

describe('core/utils', () => {
    it('gera UUIDs v4 únicos, também sem crypto.randomUUID', () => {
        const formato = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
        assert.match(utils.gerarId(), formato);
        const original = crypto.randomUUID;
        Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
        const ids = new Set(Array.from({ length: 200 }, () => utils.gerarId()));
        Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
        assert.equal(ids.size, 200);
        for (const id of ids) assert.match(id, formato);
    });
    it('trata datas ISO sem efeito de fuso', () => {
        assert.match(hoje, /^\d{4}-\d{2}-\d{2}$/);
        assert.equal(utils.ehDataISO('2024-02-29'), true);
        assert.equal(utils.ehDataISO('2026-02-30'), false);
        assert.equal(utils.ehDataISO('16/10/2026'), false);
        assert.equal(utils.diasEntre('2026-12-30', '2027-01-02'), 3);
        assert.equal(utils.somarDias('2026-12-31', 1), '2027-01-01');
        assert.equal(utils.diaDaSemana('2026-10-17'), 6);
        assert.equal(utils.diasNoMes(2028, 2), 29);
    });
    it('converte valores de formulário no padrão brasileiro', () => {
        assert.equal(utils.paraNumero(''), null);
        assert.equal(utils.paraNumero('  '), null);
        assert.equal(utils.paraNumero('10'), 10);
        assert.equal(utils.paraNumero(' 3 '), 3);
        assert.equal(utils.paraNumero('2,5'), 2.5);
        assert.equal(utils.paraNumero('2.5'), 2.5);
        assert.equal(utils.paraNumero('0.25'), 0.25);
        assert.equal(utils.paraNumero('1.234,5'), 1234.5);
        assert.equal(utils.paraNumero('1.000'), 1000);
        assert.equal(utils.paraNumero('12.500'), 12500);
        for (const invalido of ['abc', '2,5,1', '1.2.3', '1e3']) {
            assert.ok(Number.isNaN(utils.paraNumero(invalido)), invalido);
        }
    });
    it('compara textos como o produtor espera', () => {
        assert.ok(utils.compararTexto('Tanque 2', 'Tanque 10') < 0);
        assert.ok(utils.mesmoTexto('Viveiro Sul', 'víveiro sul'));
        assert.ok(!utils.mesmoTexto('Tanque 1', 'Tanque 01'));
        assert.equal(utils.criarSlug('Tanque-rede Água 04'), 'tanque-rede-agua-04');
    });
});

describe('core/format', () => {
    it('formata números no padrão brasileiro (seção 9.4)', () => {
        assert.equal(format.formatarNumero(1234.5, 1), '1.234,5');
        assert.equal(format.formatarInteiro(9412), '9.412');
        assert.equal(format.formatarPercentual(2.44), '2,4%');
        assert.equal(format.formatarFca(0.5), '0,50');
        assert.equal(format.formatarKg(586.14), '586,1 kg');
        assert.equal(format.formatarNumero(-0.04, 1), '0');
        assert.equal(format.formatarKg(null), '—');
        assert.equal(format.formatarPercentual(NaN), '—');
    });
    it('formata datas', () => {
        assert.equal(format.formatarData('2026-10-16'), '16/10/2026');
        assert.equal(format.formatarDataCurta('2026-10-16'), '16/10');
        assert.equal(format.formatarDataPorExtenso('2026-10-01'), '1º de outubro de 2026');
        assert.equal(format.formatarMesAno(2026, 3), 'Março de 2026');
        assert.equal(format.formatarData(null), '—');
        assert.equal(format.pluralizar(1, 'dia', 'dias'), '1 dia');
    });
});

describe('core/storage', () => {
    it('começa vazio e faz ida e volta', () => {
        assert.deepEqual(storage.lerDados(), storage.criarDadosVazios());
        const dados = storage.criarDadosVazios();
        dados.tanques.push({ id: 'x', nome: 'A' });
        storage.salvarDados(dados);
        assert.equal(storage.lerDados().tanques[0].nome, 'A');
        assert.ok(localStorage.getItem('fishtrack:v1'));
    });
    it('guarda uma cópia de conteúdo ilegível antes de recomeçar', () => {
        localStorage.setItem('fishtrack:v1', '{quebrado');
        assert.deepEqual(storage.lerDados().tanques, []);
        assert.equal(localStorage.getItem('fishtrack:v1:ilegivel'), '{quebrado');
    });
    it('valida a estrutura e recusa versão mais nova', () => {
        assert.throws(() => storage.validarEstrutura({ versao: 99, tanques: [], ciclos: [], registros: [] }), /versão 99/);
        assert.throws(() => storage.validarEstrutura({ versao: storage.VERSAO_DADOS, tanques: [] }), /ciclos/);
        assert.throws(() => storage.validarEstrutura([]), /formato/);
    });
});

describe('domain/tanques (RN01 a RN04)', () => {
    it('RN01: nome obrigatório e único entre não arquivados; espécie obrigatória', () => {
        recusa(() => tanqueBase({ nome: '  ' }), 'nome', /Informe/);
        tanqueBase();
        recusa(() => tanqueBase({ nome: 'tanque 01' }), 'nome', /Já existe/);
        recusa(() => tanqueBase({ nome: 'Outro', especie: '' }), 'especie');
    });
    it('RN01: nome de tanque arquivado pode ser reutilizado, mas bloqueia o desarquivamento', () => {
        const antigo = tanqueBase();
        tanques.arquivarTanque(antigo.id);
        const novo = tanqueBase();
        recusa(() => tanques.desarquivarTanque(antigo.id), null, /Renomeie/);
        tanques.salvarTanque({ ...novo, nome: 'Tanque 01 novo' });
        tanques.desarquivarTanque(antigo.id);
        assert.equal(tanques.obterTanque(antigo.id).status, 'vazio');
    });
    it('RN02: volume maior que zero', () => {
        recusa(() => tanqueBase({ volumeM3: 0 }), 'volumeM3');
        recusa(() => tanqueBase({ volumeM3: null }), 'volumeM3', /Informe/);
        recusa(() => tanqueBase({ volumeM3: NaN }), 'volumeM3', /número válido/);
    });
    it('RN03: manutenção é escolha do produtor, mas não com ciclo ativo', () => {
        const tanque = tanqueBase({ manutencao: true });
        assert.equal(tanque.status, 'manutencao');
        const editado = tanques.salvarTanque({ ...tanque, manutencao: false });
        assert.equal(editado.status, 'vazio');
        ciclos.iniciarCiclo(tanque.id, { dataInicio: dia(-1), quantidadeInicial: 10, pesoMedioInicialG: 1 });
        assert.equal(tanques.obterTanque(tanque.id).status, 'ativo');
        recusa(() => tanques.salvarTanque({ ...editado, manutencao: true }), 'manutencao');
        assert.equal(tanques.salvarTanque({ ...editado, nome: 'Renomeado' }).status, 'ativo');
    });
    it('RN04: só exclui sem ciclos; arquiva sem ciclo ativo', () => {
        const semCiclo = tanqueBase({ nome: 'Sem ciclo' });
        tanques.excluirTanque(semCiclo.id);
        assert.equal(tanques.obterTanque(semCiclo.id), null);
        const tanque = comCiclo();
        recusa(() => tanques.excluirTanque(tanque.id), null, /Arquivar/);
        recusa(() => tanques.arquivarTanque(tanque.id), null, /despesca/);
        ciclos.registrarDespesca(tanque.id, { dataDespesca: hoje, quantidadeDespescada: 990, pesoMedioFinalG: 200 });
        tanques.arquivarTanque(tanque.id);
        assert.equal(tanques.listarTanques().length, 0);
        assert.equal(tanques.listarTanques({ incluirArquivados: true }).length, 1);
        assert.equal(tanques.salvarTanque({ ...tanques.obterTanque(tanque.id), manutencao: true }).status, 'arquivado');
    });
    it('monta a situação com ciclo ativo, registros ordenados e último registro', () => {
        const tanque = comCiclo();
        registros.salvarRegistro({ tanqueId: tanque.id, data: dia(-2), racaoKg: 5 });
        registros.salvarRegistro({ tanqueId: tanque.id, data: dia(-10), racaoKg: 4 });
        const situacao = tanques.obterSituacao(tanque.id);
        assert.deepEqual(situacao.registros.map((r) => r.data), [dia(-10), dia(-2)]);
        assert.equal(situacao.ultimoRegistro.data, dia(-2));
    });
});

describe('domain/ciclos (RN05 a RN09)', () => {
    it('RN05/RN06: um ciclo ativo por vez e só em tanque vazio', () => {
        const tanque = comCiclo();
        assert.match(ciclos.verificarInicioCiclo(tanque.id), /já tem um ciclo ativo/);
        recusa(() => ciclos.iniciarCiclo(tanque.id, { dataInicio: hoje, quantidadeInicial: 1, pesoMedioInicialG: 1 }), null, /ciclo ativo/);
        assert.match(ciclos.verificarInicioCiclo(tanqueBase({ nome: 'B', manutencao: true }).id), /manutenção/);
        assert.equal(ciclos.verificarInicioCiclo(tanqueBase({ nome: 'C' }).id), null);
    });
    it('RN07 e datas do povoamento', () => {
        const tanque = tanqueBase();
        const iniciar = (extra) => () => ciclos.iniciarCiclo(tanque.id, { dataInicio: hoje, quantidadeInicial: 100, pesoMedioInicialG: 5, ...extra });
        recusa(iniciar({ quantidadeInicial: 0 }), 'quantidadeInicial');
        recusa(iniciar({ quantidadeInicial: 10.5 }), 'quantidadeInicial', /inteiro/);
        recusa(iniciar({ pesoMedioInicialG: null }), 'pesoMedioInicialG', /Informe/);
        recusa(iniciar({ dataInicio: dia(1) }), 'dataInicio', /futura/);
        recusa(iniciar({ pesoAlvoG: 5 }), 'pesoAlvoG', /maior que o peso inicial/);
        recusa(iniciar({ dataPrevistaDespesca: hoje }), 'dataPrevistaDespesca', /depois do povoamento/);
        iniciar({ pesoAlvoG: 800, dataPrevistaDespesca: dia(180) })();
    });
    it('RN08/RN09: despesca encerra o ciclo e respeita as datas', () => {
        const tanque = comCiclo();
        registros.salvarRegistro({ tanqueId: tanque.id, data: dia(-5), racaoKg: 3 });
        const despescar = (extra) => () => ciclos.registrarDespesca(tanque.id, { dataDespesca: hoje, quantidadeDespescada: 950, pesoMedioFinalG: 300, ...extra });
        recusa(despescar({ dataDespesca: dia(-6) }), 'dataDespesca', /último registro/);
        recusa(despescar({ dataDespesca: dia(1) }), 'dataDespesca', /futura/);
        recusa(despescar({ quantidadeDespescada: -1 }), 'quantidadeDespescada', /negativo/);
        recusa(despescar({ pesoMedioFinalG: 0 }), 'pesoMedioFinalG');
        assert.equal(despescar({ dataDespesca: dia(-5) })().status, 'encerrado');
        assert.equal(tanques.obterTanque(tanque.id).status, 'vazio');
        recusa(() => ciclos.iniciarCiclo(tanque.id, { dataInicio: dia(-6), quantidadeInicial: 1, pesoMedioInicialG: 1 }), 'dataInicio', /última despesca/);
        ciclos.iniciarCiclo(tanque.id, { dataInicio: dia(-5), quantidadeInicial: 1, pesoMedioInicialG: 1 });
    });
    it('lista eventos do calendário (seção 9.6)', () => {
        const tanque = comCiclo({ pesoAlvoG: 500, dataPrevistaDespesca: dia(10) });
        registros.salvarRegistro({ tanqueId: tanque.id, data: dia(-3), pesoMedioG: 50 });
        const eventos = ciclos.listarEventosCalendario({ inicio: dia(-40), fim: dia(40) });
        assert.deepEqual(eventos.map((e) => e.tipo), ['povoamento', 'registro', 'despesca-prevista']);
        assert.equal(eventos[1].descricao, 'Peso 50 g');
        const arquivado = comCicloArquivado();
        assert.equal(ciclos.listarEventosCalendario({ inicio: dia(-40), fim: dia(40) }).filter((e) => e.tanqueId === arquivado).length, 0);
        assert.ok(ciclos.listarEventosCalendario({ inicio: dia(-40), fim: dia(40), tanqueId: arquivado }).some((e) => e.tipo === 'despesca-realizada'));
    });
});

describe('domain/registros (RN10 a RN15)', () => {
    it('RN10: só em ciclo ativo; ciclo encerrado fica só para consulta', () => {
        recusa(() => registros.salvarRegistro({ tanqueId: tanqueBase({ nome: 'Vazio' }).id, data: hoje, racaoKg: 1 }), null, /não tem ciclo ativo/);
        recusa(() => registros.salvarRegistro({ tanqueId: '', data: hoje, racaoKg: 1 }), 'tanqueId');
        const tanque = comCiclo();
        const registro = registros.salvarRegistro({ tanqueId: tanque.id, data: dia(-1), racaoKg: 1 });
        ciclos.registrarDespesca(tanque.id, { dataDespesca: hoje, quantidadeDespescada: 1000, pesoMedioFinalG: 50 });
        recusa(() => registros.salvarRegistro({ ...registro, racaoKg: 2 }), null, /encerrado/);
        recusa(() => registros.excluirRegistro(registro.id), null, /encerrado/);
    });
    it('RN11 a RN13: data obrigatória, algo preenchido, sem datas inválidas nem negativos', () => {
        const tanque = comCiclo();
        const salvar = (extra) => () => registros.salvarRegistro({ tanqueId: tanque.id, data: hoje, ...extra });
        recusa(salvar({}), null, /pelo menos uma/);
        recusa(salvar({ data: '', racaoKg: 1 }), 'data', /Informe/);
        recusa(salvar({ data: dia(1), racaoKg: 1 }), 'data', /futura/);
        recusa(salvar({ data: dia(-31), racaoKg: 1 }), 'data', /anterior ao início/);
        recusa(salvar({ racaoKg: -1 }), 'racaoKg', /negativo/);
        recusa(salvar({ racaoKg: NaN }), 'racaoKg', /número válido/);
        recusa(salvar({ pesoMedioG: 0 }), 'pesoMedioG');
        recusa(salvar({ mortalidade: 1.5 }), 'mortalidade', /inteiro/);
        assert.equal(salvar({ observacoes: 'Água turva' })().pesoMedioG, null);
    });
    it('RN14: mortalidade até o estoque estimado, conferida em todo o ciclo', () => {
        const tanque = comCiclo();
        recusa(() => registros.salvarRegistro({ tanqueId: tanque.id, data: dia(-10), mortalidade: 1001 }), 'mortalidade', /1\.000/);
        registros.salvarRegistro({ tanqueId: tanque.id, data: dia(-10), mortalidade: 600 });
        registros.salvarRegistro({ tanqueId: tanque.id, data: dia(-5), mortalidade: 400 });
        recusa(() => registros.salvarRegistro({ tanqueId: tanque.id, data: dia(-20), mortalidade: 1 }), null, /passaria/);
        const outro = comCicloNome('Contado');
        const contagem = registros.salvarRegistro({ tanqueId: outro, data: dia(-9), quantidadeContada: 1500 });
        registros.salvarRegistro({ tanqueId: outro, data: dia(-8), mortalidade: 1200 });
        recusa(() => registros.excluirRegistro(contagem.id), null, /exclusão/);
    });
    it('RN15: registros da mesma data somam ração e mortalidade no dia', () => {
        const tanque = comCiclo();
        registros.salvarRegistro({ tanqueId: tanque.id, data: dia(-1), racaoKg: 2, mortalidade: 3 });
        registros.salvarRegistro({ tanqueId: tanque.id, data: dia(-1), racaoKg: 1.5, mortalidade: 4 });
        const situacao = tanques.obterSituacao(tanque.id);
        const ultimoDia = ind.calcularLinhaDoTempo(situacao.cicloAtivo, situacao.registros).at(-1);
        assert.equal(ultimoDia.racaoDiaKg, 3.5);
        assert.equal(ultimoDia.mortalidadeDia, 7);
        assert.equal(ultimoDia.quantidadeInicioDia, 1000);
    });
    it('edita e exclui registros do ciclo ativo', () => {
        const tanque = comCiclo();
        const registro = registros.salvarRegistro({ tanqueId: tanque.id, data: dia(-1), racaoKg: 2 });
        const editado = registros.salvarRegistro({ ...registro, racaoKg: 3, tanqueId: 'ignorado' });
        assert.equal(editado.tanqueId, tanque.id);
        assert.equal(editado.criadoEm, registro.criadoEm);
        registros.excluirRegistro(registro.id);
        assert.equal(registros.obterRegistro(registro.id), null);
        assert.equal(registros.resumirRegistro({ pesoMedioG: 210, racaoKg: 25, mortalidade: 1, natalidade: null, quantidadeContada: 980, observacoes: 'ok' }),
            'Peso 210 g · Ração 25 kg · 1 morto · Contagem de 980 peixes · ok');
    });
});

describe('domain/indicadores (seção 9.4) com valores calculados à mão', () => {
    const tanque = { volumeM3: 100, capacidade: 2000 };
    const ciclo = { dataInicio: '2026-01-01', quantidadeInicial: 1000, pesoMedioInicialG: 10, dataDespesca: null };
    const r = (data, criadoEm, campos) => ({ data, criadoEm, pesoMedioG: null, racaoKg: null, mortalidade: null, natalidade: null, quantidadeContada: null, ...campos });
    const lista = [
        r('2026-01-31', '4', { pesoMedioG: 60, racaoKg: 7, mortalidade: 20 }),
        r('2026-01-21', '3', { quantidadeContada: 980 }),
        r('2026-01-11', '1', { pesoMedioG: 30, racaoKg: 5, mortalidade: 10 }),
        r('2026-01-21', '2', { racaoKg: 6, mortalidade: 5, natalidade: 2 }),
    ];
    const resultado = ind.calcularIndicadores({ tanque, ciclo, registros: lista, hoje: '2026-02-10' });
    const perto = (valor, esperado) => assert.ok(Math.abs(valor - esperado) < 1e-9, `${valor} != ${esperado}`);
    it('quantidade parte da contagem e aplica os registros posteriores', () => assert.equal(resultado.quantidade, 960));
    it('peso, biomassa, ganho e FCA', () => {
        assert.equal(resultado.pesoMedioG, 60);
        perto(resultado.biomassaKg, 57.6);
        perto(resultado.ganhoBiomassaKg, 47.6);
        assert.equal(resultado.racaoAcumuladaKg, 18);
        perto(resultado.fca, 18 / 47.6);
    });
    it('taxas de mortalidade, sobrevivência e natalidade', () => {
        perto(resultado.taxaMortalidade, 3.5);
        perto(resultado.taxaSobrevivencia, 96.5);
        perto(resultado.taxaNatalidade, 0.2);
    });
    it('crescimento, densidade, capacidade e dias', () => {
        perto(resultado.taxaCrescimentoGDia, 1.5);
        perto(resultado.crescimentoCicloGDia, 50 / 30);
        perto(resultado.densidadeKgM3, 0.576);
        perto(resultado.capacidadeUtilizada, 48);
        assert.equal(resultado.diasCultivo, 40);
        assert.equal(ind.calcularIndicadores({ tanque, ciclo: { ...ciclo, dataDespesca: '2026-01-31' }, registros: lista, hoje: '2026-02-10' }).diasCultivo, 30);
    });
    it('FCA e crescimento sem dados ficam vazios', () => {
        const semPesagem = ind.calcularIndicadores({ tanque, ciclo, registros: [r('2026-01-05', '1', { racaoKg: 3, mortalidade: 5 })], hoje: '2026-01-10' });
        assert.equal(semPesagem.fca, null);
        assert.equal(semPesagem.taxaCrescimentoGDia, null);
        assert.equal(semPesagem.crescimentoCicloGDia, null);
    });
    it('séries dos gráficos e linha do tempo', () => {
        const series = ind.calcularSeries(ciclo, lista);
        assert.deepEqual(series.pesoMedio, [{ data: '2026-01-01', valor: 10 }, { data: '2026-01-11', valor: 30 }, { data: '2026-01-31', valor: 60 }]);
        assert.equal(series.biomassa.length, 4);
        perto(series.mortalidade.at(-1).valor, 3.5);
        const dia21 = ind.calcularLinhaDoTempo(ciclo, lista)[2];
        assert.equal(dia21.quantidadeInicioDia, 990);
        assert.equal(dia21.quantidade, 980);
    });
    it('totais do dashboard com média ponderada pela quantidade inicial', () => {
        const resumo = ind.calcularResumoProducao([
            { ciclo: { quantidadeInicial: 1000 }, indicadores: { quantidade: 900, biomassaKg: 90, racaoAcumuladaKg: 100, mortalidadeAcumulada: 100 } },
            { ciclo: { quantidadeInicial: 3000 }, indicadores: { quantidade: 2970, biomassaKg: 300, racaoAcumuladaKg: 400, mortalidadeAcumulada: 30 } },
        ]);
        assert.equal(resumo.totalPeixes, 3870);
        perto(resumo.mortalidadeMedia, (10 * 1000 + 1 * 3000) / 4000);
        assert.equal(ind.calcularResumoProducao([]).mortalidadeMedia, null);
    });
});

describe('domain/alertas (seção 9.5)', () => {
    const tanque = { id: 't', nome: 'T', volumeM3: 100, capacidade: 2000, limitesAlerta: null };
    const ciclo = { dataInicio: dia(-20), quantidadeInicial: 1000, pesoMedioInicialG: 10, pesoAlvoG: null, dataPrevistaDespesca: null, dataDespesca: null, status: 'ativo' };
    const r = (data, campos) => ({ data, criadoEm: data, pesoMedioG: null, racaoKg: null, mortalidade: null, natalidade: null, quantidadeContada: null, ...campos });
    const avaliar = (lista, { c = ciclo, t = tanque, limites = alertas.LIMITES_PADRAO } = {}) => {
        const indicadores = ind.calcularIndicadores({ tanque: t, ciclo: c, registros: lista, hoje });
        return alertas.avaliarAlertas({ tanque: t, ciclo: c, registros: lista, indicadores, limites, hoje }).map((a) => a.tipo);
    };
    it('mortalidade no registro: acima de 1% do estoque do dia, somando a data', () => {
        assert.deepEqual(avaliar([r(dia(-1), { mortalidade: 10 })]), []);
        assert.deepEqual(avaliar([r(dia(-1), { mortalidade: 6 }), r(dia(-1), { mortalidade: 5 })]), ['mortalidade-registro']);
        assert.deepEqual(avaliar([r(dia(-2), { mortalidade: 11 }), r(dia(-1), { racaoKg: 0.1 })]), [], 'só o último dia conta');
    });
    it('mortalidade acumulada acima de 10%', () => {
        assert.deepEqual(avaliar([r(dia(-5), { mortalidade: 101 }), r(dia(-1), { racaoKg: 0.1 })]), ['mortalidade-acumulada']);
    });
    it('ração do dia acima de 5% da biomassa', () => {
        assert.deepEqual(avaliar([r(dia(-1), { racaoKg: 0.5 })]), []);
        assert.deepEqual(avaliar([r(dia(-1), { racaoKg: 0.6 })]), ['racao']);
    });
    it('capacidade a partir de 90%', () => {
        assert.deepEqual(avaliar([r(dia(-1), { quantidadeContada: 1800 })]), ['capacidade']);
        assert.deepEqual(avaliar([r(dia(-1), { quantidadeContada: 1799 })]), []);
    });
    it('peso abaixo de 85% do esperado na data da pesagem', () => {
        const comAlvo = { ...ciclo, pesoAlvoG: 210, dataPrevistaDespesca: dia(180) };
        assert.deepEqual(avaliar([r(dia(-10), { pesoMedioG: 17 }), r(dia(-1), { racaoKg: 0.1 })], { c: comAlvo }), []);
        assert.deepEqual(avaliar([r(dia(-10), { pesoMedioG: 16.9 }), r(dia(-1), { racaoKg: 0.1 })], { c: comAlvo }), ['peso']);
        assert.deepEqual(avaliar([r(dia(-1), { racaoKg: 0.1 })], { c: comAlvo }), [], 'sem pesagem não compara');
        assert.equal(alertas.calcularPesoEsperado(comAlvo, dia(500)), 210);
    });
    it('sem registro há mais de 7 dias (ou desde o povoamento)', () => {
        assert.deepEqual(avaliar([r(dia(-7), { racaoKg: 0.1 })]), []);
        assert.deepEqual(avaliar([r(dia(-8), { racaoKg: 0.1 })]), ['sem-registro']);
        assert.deepEqual(avaliar([]), ['sem-registro']);
    });
    it('limites do tanque sobrescrevem os padrões; ordem por gravidade', () => {
        const limites = alertas.resolverLimites({ capacidadePct: 95 }, { mortalidadeRegistroPct: 0.5, chaveDesconhecida: 1 });
        assert.equal(limites.capacidadePct, 95);
        assert.equal(limites.mortalidadeRegistroPct, 0.5);
        assert.ok(!('chaveDesconhecida' in limites));
        assert.deepEqual(avaliar([r(dia(-9), { quantidadeContada: 950 }), r(dia(-8), { mortalidade: 8 })], { limites }), ['mortalidade-registro', 'sem-registro']);
        const lista = [{ gravidade: 'baixa', data: 'a', tanqueNome: 'A' }, { gravidade: 'alta', data: 'a', tanqueNome: 'B' }];
        assert.equal(alertas.ordenarAlertas(lista)[0].gravidade, 'alta');
        assert.equal(alertas.gravidadeMaisAlta(lista), 'alta');
        assert.equal(alertas.gravidadeMaisAlta([]), null);
    });
});

describe('domain/configuracoes', () => {
    it('limites padrão: obrigatórios, positivos e dentro do máximo', () => {
        assert.deepEqual(config.obterLimitesPadrao(), alertas.LIMITES_PADRAO);
        const valido = { ...alertas.LIMITES_PADRAO, capacidadePct: 80 };
        recusa(() => config.salvarLimitesPadrao({ ...valido, capacidadePct: null }), 'capacidadePct', /Informe/);
        recusa(() => config.salvarLimitesPadrao({ ...valido, racaoDiariaPct: 101 }), 'racaoDiariaPct', /máximo/);
        recusa(() => config.salvarLimitesPadrao({ ...valido, diasSemRegistro: 2.5 }), 'diasSemRegistro', /inteiro/);
        recusa(() => config.salvarLimitesPadrao({ ...valido, pesoEsperadoPct: 0 }), 'pesoEsperadoPct');
        config.salvarLimitesPadrao(valido);
        assert.equal(config.obterLimitesPadrao().capacidadePct, 80);
        config.restaurarLimitesPadrao();
        assert.equal(config.obterLimitesPadrao().capacidadePct, 90);
    });
    it('limites do tanque guardam só o que sobrescreve', () => {
        const tanque = tanqueBase();
        assert.deepEqual(config.salvarLimitesTanque(tanque.id, { capacidadePct: 95, diasSemRegistro: null }), { capacidadePct: 95 });
        assert.equal(config.salvarLimitesTanque(tanque.id, {}), null);
    });
});
