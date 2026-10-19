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
const lembretes = await import(RAIZ + 'domain/lembretes.js');

const hoje = utils.hojeISO();
const dia = (n) => utils.somarDias(hoje, n);
const tanqueBase = (extra = {}) => tanques.salvarTanque({ nome: 'Tanque 01', especie: 'Tilápia', volumeM3: 100, densidadeMaximaKgM3: 20, ...extra });
const comCiclo = (extra = {}) => {
    const tanque = tanqueBase();
    ciclos.iniciarCiclo(tanque.id, { dataInicio: dia(-30), quantidadeInicial: 1000, pesoMedioInicialG: 10, ...extra });
    return tanque;
};
const comCicloNome = (nome) => {
    const tanque = tanques.salvarTanque({ nome, especie: 'X', volumeM3: 1, densidadeMaximaKgM3: 20 });
    ciclos.iniciarCiclo(tanque.id, { dataInicio: dia(-10), quantidadeInicial: 1000, pesoMedioInicialG: 1 });
    return tanque.id;
};
const comCicloArquivado = () => {
    const tanque = tanques.salvarTanque({ nome: 'Arquivado', especie: 'X', volumeM3: 1, densidadeMaximaKgM3: 20 });
    ciclos.iniciarCiclo(tanque.id, { dataInicio: dia(-20), quantidadeInicial: 10, pesoMedioInicialG: 1 });
    ciclos.registrarDespesca(tanque.id, { dataDespesca: dia(-1), biomassaFinalKg: 0.05, pesoMedioFinalG: 5 });
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

describe('ui/graficos: cor fixa por tanque (seção 2.1)', () => {
    it('segue a ordem de criação e repete a paleta depois do sexto tanque', async () => {
        const { obterCorTanque, CORES_TANQUES } = await import(RAIZ + 'ui/graficos.js');
        const lista = Array.from({ length: 7 }, (_, i) => ({ id: `t${i}`, criadoEm: `2026-01-0${i + 1}` })).reverse();
        assert.equal(obterCorTanque(lista.find((t) => t.id === 't0'), lista), CORES_TANQUES[0]);
        assert.equal(obterCorTanque(lista.find((t) => t.id === 't2'), lista), CORES_TANQUES[2]);
        assert.equal(obterCorTanque(lista.find((t) => t.id === 't6'), lista), CORES_TANQUES[0]);
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
    it('migra dados da versão 1 para a 2 ao ler, e grava o resultado (seção 8.4)', () => {
        const v1 = {
            versao: 1,
            tanques: [{ id: 't1', nome: 'A', capacidade: 3000, status: 'vazio' }],
            ciclos: [],
            registros: [],
            config: { limitesAlerta: { capacidadePct: 95 } },
        };
        localStorage.setItem('fishtrack:v1', JSON.stringify(v1));
        const dados = storage.lerDados();
        assert.equal(dados.versao, storage.VERSAO_DADOS);
        assert.deepEqual(dados.lembretes, []);
        assert.deepEqual(dados.config, { limitesAlerta: { capacidadePct: 95 }, metaFca: 1.6, ultimoBackupEm: null });
        assert.ok(!('capacidade' in dados.tanques[0]));
        assert.equal(dados.tanques[0].densidadeMaximaKgM3, null);
        assert.equal(dados.tanques[0].capacidadePeixesLegado, 3000);
        assert.equal(JSON.parse(localStorage.getItem('fishtrack:v1')).versao, storage.VERSAO_DADOS, 'grava migrado');
        assert.equal(v1.versao, 1, 'não altera o objeto original');
    });
    it('migra da versão 2 para a 3: sem contagem e com biomassa final (seção 8.4)', () => {
        const base = { id: 'x', cicloId: 'c', tanqueId: 't', data: '2026-01-02', criadoEm: '1', pesoMedioG: null, racaoKg: null, mortalidade: null, natalidade: null, observacoes: '' };
        const v2 = {
            versao: 2, tanques: [], lembretes: [], config: { limitesAlerta: {}, metaFca: 1.6, ultimoBackupEm: null },
            ciclos: [
                { id: 'c', status: 'encerrado', quantidadeDespescada: 750, pesoMedioFinalG: 400 },
                { id: 'd', status: 'ativo', quantidadeDespescada: null, pesoMedioFinalG: null },
            ],
            registros: [
                { ...base, id: 'so-contagem', quantidadeContada: 980 },
                { ...base, id: 'com-racao', racaoKg: 2, quantidadeContada: 500 },
            ],
        };
        const dados = storage.migrarDados(v2);
        assert.equal(dados.versao, 3);
        assert.ok(dados.registros.every((registro) => !('quantidadeContada' in registro)));
        assert.equal(dados.registros[0].observacoes, 'Contagem registrada: 980 peixes', 'RN11: não fica vazio');
        assert.equal(dados.registros[1].observacoes, '');
        assert.equal(dados.ciclos[0].biomassaFinalKg, 300);
        assert.equal(dados.ciclos[1].biomassaFinalKg, null);
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
    it('RN02: capacidade em kg/m³, opcional e maior que zero; carga total é convertida (seção 4)', () => {
        recusa(() => tanqueBase({ densidadeMaximaKgM3: 0 }), 'densidadeMaximaKgM3');
        recusa(() => tanqueBase({ densidadeMaximaKgM3: undefined, cargaMaximaKg: -5 }), 'cargaMaximaKg');
        const porCarga = tanqueBase({ densidadeMaximaKgM3: undefined, volumeM3: 300, cargaMaximaKg: 1200 });
        assert.equal(porCarga.densidadeMaximaKgM3, 4);
        assert.ok(!('capacidade' in porCarga));
        const semCapacidade = tanqueBase({ nome: 'Sem', densidadeMaximaKgM3: null });
        assert.equal(semCapacidade.densidadeMaximaKgM3, null);
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
        ciclos.registrarDespesca(tanque.id, { dataDespesca: hoje, biomassaFinalKg: 198, pesoMedioFinalG: 200 });
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
        const despescar = (extra) => () => ciclos.registrarDespesca(tanque.id, { dataDespesca: hoje, biomassaFinalKg: 300, pesoMedioFinalG: 400, ...extra });
        recusa(despescar({ dataDespesca: dia(-6) }), 'dataDespesca', /último registro/);
        recusa(despescar({ dataDespesca: dia(1) }), 'dataDespesca', /futura/);
        recusa(despescar({ quantidadeDespescada: -1 }), 'quantidadeDespescada', /negativo/);
        recusa(despescar({ pesoMedioFinalG: 0 }), 'pesoMedioFinalG');
        // RN19: biomassa final obrigatória; quantidade opcional.
        recusa(despescar({ biomassaFinalKg: null }), 'biomassaFinalKg', /biomassa final/);
        recusa(despescar({ biomassaFinalKg: 0 }), 'biomassaFinalKg');
        // RN20: 950 x 400 g = 380 kg, 27% acima dos 300 kg pesados.
        recusa(despescar({ quantidadeDespescada: 950 }), 'quantidadeDespescada', /não batem/);
        const encerrado = despescar({ dataDespesca: dia(-5), quantidadeDespescada: 780 })();
        assert.equal(encerrado.status, 'encerrado');
        assert.equal(encerrado.biomassaFinalKg, 300);
        assert.equal(encerrado.quantidadeDespescada, 780, '312 kg, 4% acima: aceito');
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
        ciclos.registrarDespesca(tanque.id, { dataDespesca: hoje, biomassaFinalKg: 50, pesoMedioFinalG: 50 });
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
        const outro = comCicloNome('Com nascimentos');
        const nascimentos = registros.salvarRegistro({ tanqueId: outro, data: dia(-9), natalidade: 500 });
        registros.salvarRegistro({ tanqueId: outro, data: dia(-8), mortalidade: 1200 });
        recusa(() => registros.excluirRegistro(nascimentos.id), null, /exclusão/);
        recusa(() => registros.salvarRegistro({ tanqueId: outro, data: dia(-7), mortalidade: 301 }), 'mortalidade', /quantidade estimada/);
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
        assert.equal(registros.resumirRegistro({ pesoMedioG: 210, racaoKg: 25, mortalidade: 1, natalidade: null, observacoes: 'ok' }),
            'Peso 210 g · Ração 25 kg · 1 morto · ok');
    });
});

describe('domain/indicadores (seção 9.4) com valores calculados à mão', () => {
    const tanque = { volumeM3: 100, densidadeMaximaKgM3: 1.2 };
    const ciclo = { dataInicio: '2026-01-01', quantidadeInicial: 1000, pesoMedioInicialG: 10, dataDespesca: null };
    const r = (data, criadoEm, campos) => ({ data, criadoEm, pesoMedioG: null, racaoKg: null, mortalidade: null, natalidade: null, ...campos });
    const lista = [
        r('2026-01-31', '4', { pesoMedioG: 60, racaoKg: 7, mortalidade: 20 }),
        r('2026-01-11', '1', { pesoMedioG: 30, racaoKg: 5, mortalidade: 10 }),
        r('2026-01-21', '2', { racaoKg: 6, mortalidade: 5, natalidade: 2 }),
    ];
    const resultado = ind.calcularIndicadores({ tanque, ciclo, registros: lista, hoje: '2026-02-10' });
    const perto = (valor, esperado) => assert.ok(Math.abs(valor - esperado) < 1e-9, `${valor} != ${esperado}`);
    // Estimada: 1.000 − 10 − 5 + 2 − 20 = 967 (sem contagem durante o ciclo).
    it('quantidade estimada: povoamento menos mortos encontrados mais natalidade', () => assert.equal(resultado.quantidade, 967));
    it('peso, biomassa, ganho e FCA', () => {
        assert.equal(resultado.pesoMedioG, 60);
        perto(resultado.biomassaKg, 58.02);
        perto(resultado.ganhoBiomassaKg, 48.02);
        assert.equal(resultado.racaoAcumuladaKg, 18);
        perto(resultado.fca, 18 / 48.02);
    });
    it('taxas de mortalidade, sobrevivência e natalidade', () => {
        perto(resultado.taxaMortalidade, 3.5);
        perto(resultado.taxaSobrevivencia, 96.5);
        perto(resultado.taxaNatalidade, 0.2);
    });
    it('crescimento, densidade, capacidade e dias', () => {
        perto(resultado.taxaCrescimentoGDia, 1.5);
        perto(resultado.crescimentoCicloGDia, 50 / 30);
        perto(resultado.densidadeKgM3, 0.5802);
        perto(resultado.capacidadeUtilizada, 48.35);
        assert.equal(resultado.diasCultivo, 40);
        assert.equal(ind.calcularIndicadores({ tanque, ciclo: { ...ciclo, dataDespesca: '2026-01-31' }, registros: lista, hoje: '2026-02-10' }).diasCultivo, 30);
    });
    it('capacidade pela carga máxima, densidade de povoamento e projeção (seção 4.2)', () => {
        perto(resultado.cargaMaximaKg, 120);
        perto(resultado.densidadePovoamento, 10);
        // Última pesagem: 967 peixes x 60 g = 58,02 kg; anterior: 990 x 30 g = 29,7 kg, 20 dias antes.
        // Ganho de 1,416 kg/dia; faltam 61,98 kg até 120 kg: 43,8, arredondado para 44 dias.
        assert.equal(resultado.projecaoDiasLimite, 44);
        const semDensidade = ind.calcularIndicadores({ tanque: { volumeM3: 100, densidadeMaximaKgM3: null }, ciclo, registros: lista, hoje: '2026-02-10' });
        assert.equal(semDensidade.capacidadeUtilizada, null);
        assert.equal(semDensidade.projecaoDiasLimite, null);
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
        assert.equal(dia21.quantidade, 987);
    });
    it('resultado do ciclo encerrado pela biomassa final (seção 9.4.1)', () => {
        // Exemplo do laboratório: 1.000 peixes de 10 g; despesca de 300 kg com peso médio de 400 g, sem contagem.
        const encerrado = { ...ciclo, dataDespesca: '2026-05-01', pesoMedioFinalG: 400, biomassaFinalKg: 300, quantidadeDespescada: null };
        const doCiclo = [r('2026-02-01', '1', { racaoKg: 200, mortalidade: 30 }), r('2026-03-01', '2', { racaoKg: 190, mortalidade: 20 })];
        const final = ind.calcularResultadoCiclo({ tanque, ciclo: encerrado, registros: doCiclo });
        assert.equal(final.biomassaInicialKg, 10);
        assert.equal(final.quantidadeFinal, 750);
        assert.equal(final.quantidadeFinalEstimada, true);
        assert.equal(final.sobrevivenciaReal, 75);
        assert.equal(final.mortalidadeReal, 25);
        assert.equal(final.mortosEncontrados, 50);
        assert.equal(final.mortalidadeNaoObservada, 200, '250 a menos, 50 encontrados');
        assert.equal(final.ganhoBiomassaKg, 290);
        assert.equal(final.racaoTotalKg, 390);
        perto(final.fcaFinal, 390 / 290);
        assert.equal(final.diasCultivo, 120);
        perto(final.ganhoPesoDiarioG, 390 / 120);
        assert.equal(final.produtividadeKgM3, 3);
        const contado = ind.calcularResultadoCiclo({ tanque, ciclo: { ...encerrado, quantidadeDespescada: 780 }, registros: [] });
        assert.equal(contado.quantidadeFinal, 780);
        assert.equal(contado.quantidadeFinalEstimada, false);
        assert.equal(ind.calcularResultadoCiclo({ tanque, ciclo: { ...encerrado, biomassaFinalKg: 8 }, registros: [] }).fcaFinal, null, 'sem ganho, sem FCA');
    });
    it('acompanhamento da aba Resumo: semana, ração de hoje e peso alvo (seção 7.3)', () => {
        const comAlvo = { ...ciclo, pesoAlvoG: 120 };
        const indicadores = ind.calcularIndicadores({ tanque, ciclo: comAlvo, registros: lista, hoje: '2026-02-03' });
        const acompanhamento = ind.calcularAcompanhamento({ ciclo: comAlvo, registros: lista, indicadores, hoje: '2026-02-03' });
        // Semana de 27/01 a 03/02: só o registro de 31/01 (20 mortos, 30 g → 60 g).
        perto(acompanhamento.taxaMortalidadeSemana, 2);
        perto(acompanhamento.ganhoBiomassaSemanaKg, 967 * 0.06 - 987 * 0.03);
        assert.equal(acompanhamento.racaoHojeKg, 0);
        assert.equal(acompanhamento.diasDesdePesagem, 3);
        perto(acompanhamento.percentualPesoAlvo, 50);
        // 1,5 g/dia entre as duas últimas pesagens: faltam 60 g, 40 dias depois de 31/01.
        assert.equal(acompanhamento.dataPesoAlvo, '2026-03-12');
        assert.equal(acompanhamento.diasAtePesoAlvo, 37);
        assert.equal(acompanhamento.houveNascimento, true);
        assert.equal(ind.calcularAcompanhamento({ ciclo: comAlvo, registros: lista, indicadores, hoje: '2026-01-31' }).racaoHojeKg, 7);
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

describe('domain/indicadores: série diária e período (seção 9.4)', () => {
    const r = (data, criadoEm, campos) => ({ data, criadoEm, pesoMedioG: null, racaoKg: null, mortalidade: null, natalidade: null, ...campos });
    const cicloA = { dataInicio: '2026-01-01', quantidadeInicial: 100, pesoMedioInicialG: 10, dataDespesca: null };
    const registrosA = [r('2026-01-03', '1', { racaoKg: 0.5, mortalidade: 2 }), r('2026-01-05', '2', { pesoMedioG: 20, racaoKg: 0.6 })];
    const perto = (valor, esperado) => assert.ok(Math.abs(valor - esperado) < 1e-9, `${valor} != ${esperado}`);
    it('repete o último valor entre registros e deixa null antes do povoamento', () => {
        const serie = ind.calcularSerieDiaria(cicloA, registrosA, '2025-12-31', '2026-01-06');
        assert.equal(serie[0], null);
        assert.deepEqual(serie.slice(1).map((dia) => dia.quantidade), [100, 100, 98, 98, 98, 98]);
        assert.deepEqual(serie.slice(1).map((dia) => dia.racaoDiaKg), [0, 0, 0.5, 0, 0.6, 0]);
        perto(serie[5].biomassaKg, 1.96);
        perto(serie[5].fca, 1.1 / 0.96);
        assert.equal(serie[3].fca, null, 'sem ganho de biomassa, sem FCA');
        perto(serie[6].taxaMortalidade, 2);
    });
    it('resume o período; tanque povoado no meio parte da biomassa do povoamento', () => {
        const cicloB = { dataInicio: '2026-01-04', quantidadeInicial: 50, pesoMedioInicialG: 4, dataDespesca: null };
        const resumo = ind.calcularResumoPeriodo([
            { tanque: { id: 'a' }, ciclo: cicloA, registros: registrosA },
            { tanque: { id: 'b' }, ciclo: cicloB, registros: [] },
        ], { dataInicio: '2026-01-02', dataFim: '2026-01-06' });
        assert.equal(resumo.datas.length, 5);
        perto(resumo.biomassa.atual, 2.16);
        perto(resumo.biomassa.variacao, 0.96);
        perto(resumo.totais[2].biomassaKg, 1.18);
        assert.equal(resumo.peixes.perdas, 2);
        perto(resumo.fca.periodo, 1.1 / 0.96);
        perto(resumo.racao.total, 1.1);
        perto(resumo.racao.mediaPorDia, 1.1 / 4);
        perto(resumo.mortalidade.taxa, (2 / 150) * 100);
        const vazio = ind.calcularResumoPeriodo([], { dataInicio: '2026-01-01', dataFim: '2026-01-02' });
        assert.equal(vazio.fca.geral, null);
        assert.equal(vazio.mortalidade.taxa, null);
    });
});

describe('domain/alertas (seção 9.5)', () => {
    // Carga máxima de 20 kg: 1.000 peixes de 10 g (10 kg) ocupam 50%.
    const tanque = { id: 't', nome: 'T', volumeM3: 100, densidadeMaximaKgM3: 0.2, limitesAlerta: null };
    const ciclo = { dataInicio: dia(-20), quantidadeInicial: 1000, pesoMedioInicialG: 10, pesoAlvoG: null, dataPrevistaDespesca: null, dataDespesca: null, status: 'ativo' };
    const r = (data, campos) => ({ data, criadoEm: data, pesoMedioG: null, racaoKg: null, mortalidade: null, natalidade: null, ...campos });
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
        // 1.000 + 800 nascimentos = 1.800 peixes de 10 g: 18 kg, 90% dos 20 kg.
        assert.deepEqual(avaliar([r(dia(-1), { natalidade: 800 })]), ['capacidade']);
        assert.deepEqual(avaliar([r(dia(-1), { natalidade: 799 })]), []);
        assert.deepEqual(avaliar([r(dia(-1), { natalidade: 4000 })], { t: { ...tanque, densidadeMaximaKgM3: null } }), [], 'sem densidade máxima não avalia');
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
        assert.deepEqual(avaliar([r(dia(-9), { mortalidade: 50 }), r(dia(-8), { mortalidade: 8 })], { limites }), ['mortalidade-registro', 'sem-registro']);
        const lista = [{ gravidade: 'baixa', data: 'a', tanqueNome: 'A' }, { gravidade: 'alta', data: 'a', tanqueNome: 'B' }];
        assert.equal(alertas.ordenarAlertas(lista)[0].gravidade, 'alta');
        assert.equal(alertas.gravidadeMaisAlta(lista), 'alta');
        assert.equal(alertas.gravidadeMaisAlta([]), null);
    });
});

describe('domain/configuracoes', () => {
    it('limites padrão: obrigatórios, positivos e dentro do máximo', () => {
        assert.deepEqual(config.obterLimitesPadrao(), alertas.LIMITES_PADRAO);
        const valido = { ...alertas.LIMITES_PADRAO, capacidadePct: 80, metaFca: 1.5 };
        recusa(() => config.salvarLimitesPadrao({ ...valido, capacidadePct: null }), 'capacidadePct', /Informe/);
        recusa(() => config.salvarLimitesPadrao({ ...valido, racaoDiariaPct: 101 }), 'racaoDiariaPct', /máximo/);
        recusa(() => config.salvarLimitesPadrao({ ...valido, diasSemRegistro: 2.5 }), 'diasSemRegistro', /inteiro/);
        recusa(() => config.salvarLimitesPadrao({ ...valido, pesoEsperadoPct: 0 }), 'pesoEsperadoPct');
        recusa(() => config.salvarLimitesPadrao({ ...valido, metaFca: null }), 'metaFca', /Informe/);
        config.salvarLimitesPadrao(valido);
        assert.equal(config.obterLimitesPadrao().capacidadePct, 80);
        assert.equal(config.obterMetaFca(), 1.5);
        assert.ok(!('metaFca' in storage.lerDados().config.limitesAlerta), 'a meta fica em config.metaFca');
        assert.equal(config.obterMetaFca({ limitesAlerta: { metaFca: 1.3 } }), 1.3, 'o tanque pode ter a sua');
        config.restaurarLimitesPadrao();
        assert.equal(config.obterLimitesPadrao().capacidadePct, 90);
        assert.equal(config.obterMetaFca(), 1.6);
    });
    it('limites do tanque guardam só o que sobrescreve', () => {
        const tanque = tanqueBase();
        assert.deepEqual(config.salvarLimitesTanque(tanque.id, { capacidadePct: 95, diasSemRegistro: null }), { capacidadePct: 95 });
        assert.equal(config.salvarLimitesTanque(tanque.id, {}), null);
    });
});

describe('domain/lembretes (seção 7, RN16 a RN18)', () => {
    const novo = (extra = {}) => lembretes.salvarLembrete({ titulo: 'Biometria', data: hoje, ...extra });
    const datas = (lista) => lista.map((item) => item.data);

    it('RN16: título obrigatório, até 80 caracteres; observação até 300', () => {
        recusa(() => novo({ titulo: '   ' }), 'titulo', /título/);
        recusa(() => novo({ titulo: 'x'.repeat(81) }), 'titulo', /80/);
        recusa(() => novo({ observacao: 'x'.repeat(301) }), 'observacao', /300/);
        recusa(() => novo({ data: '2026-02-30' }), 'data');
        assert.equal(novo({ titulo: '  Comprar ração ' }).titulo, 'Comprar ração');
    });
    it('RN17: tanque precisa existir e não estar arquivado; vazio é Geral', () => {
        recusa(() => novo({ tanqueId: 'nao-existe' }), 'tanqueId', /arquivado/);
        recusa(() => novo({ tanqueId: comCicloArquivado() }), 'tanqueId');
        const tanque = tanqueBase();
        assert.equal(novo({ tanqueId: tanque.id }).tanqueId, tanque.id);
        assert.equal(novo({ tanqueId: '' }).tanqueId, null);
    });
    it('RN18: repetição só a cada 7, 15 ou 30 dias', () => {
        recusa(() => novo({ repetirDias: 10 }), 'repetirDias', /7, 15 ou 30/);
        assert.equal(novo({ repetirDias: 15 }).repetirDias, 15);
    });
    it('aceita qualquer data, passada ou futura, e edita mantendo as conclusões', () => {
        const passado = novo({ data: dia(-400) });
        novo({ data: dia(400) });
        lembretes.alternarConclusao(passado.id, dia(-400));
        const editado = lembretes.salvarLembrete({ id: passado.id, titulo: 'Outro', data: dia(-400) });
        assert.equal(editado.titulo, 'Outro');
        assert.deepEqual(lembretes.obterLembrete(passado.id).concluidas, [dia(-400)]);
        recusa(() => lembretes.salvarLembrete({ id: 'nao-existe', titulo: 'X', data: hoje }));
    });
    it('ocorrências: a partir da data, de N em N dias, sem as removidas (seção 7.5)', () => {
        const repetido = novo({ data: dia(-10), repetirDias: 7 });
        novo({ titulo: 'Único', data: dia(3) });
        const todas = lembretes.listarOcorrencias({ inicio: dia(-20), fim: dia(20) });
        assert.deepEqual(datas(todas.filter((o) => o.lembreteId === repetido.id)), [dia(-10), dia(-3), dia(4), dia(11), dia(18)]);
        assert.deepEqual(datas(lembretes.listarOcorrencias({ inicio: dia(0), fim: dia(5) })), [dia(3), dia(4)]);

        lembretes.removerOcorrencia(repetido.id, dia(4));
        assert.deepEqual(datas(lembretes.listarOcorrencias({ inicio: dia(0), fim: dia(12) })), [dia(3), dia(11)]);
        lembretes.removerLembrete(repetido.id);
        assert.equal(lembretes.obterLembrete(repetido.id), null);
    });
    it('remover "só esta vez" um lembrete que não se repete apaga o lembrete', () => {
        const unico = novo();
        lembretes.removerOcorrencia(unico.id, hoje);
        assert.equal(lembretes.obterLembrete(unico.id), null);
    });
    it('conclusão por ocorrência e atrasados dos últimos 30 dias', () => {
        const repetido = novo({ data: dia(-45), repetirDias: 15 });
        assert.equal(lembretes.alternarConclusao(repetido.id, dia(-15)), true);
        assert.deepEqual(datas(lembretes.listarAtrasados({ hoje })), [dia(-30)]);
        assert.equal(lembretes.alternarConclusao(repetido.id, dia(-15)), false);
        assert.deepEqual(datas(lembretes.listarAtrasados({ hoje })), [dia(-30), dia(-15)]);
        const deHoje = lembretes.listarOcorrencias({ inicio: hoje, fim: hoje });
        assert.equal(deHoje[0].concluida, false);
    });
    it('filtro por tanque inclui os gerais; tanque arquivado não gera ocorrências futuras', () => {
        const a = tanqueBase();
        const b = tanques.salvarTanque({ nome: 'Tanque 02', especie: 'X', volumeM3: 1, densidadeMaximaKgM3: 5 });
        novo({ titulo: 'Geral' });
        novo({ titulo: 'Do A', tanqueId: a.id });
        const doB = novo({ titulo: 'Do B', tanqueId: b.id, data: dia(-7), repetirDias: 7 });
        const titulos = (tanqueId) => lembretes.listarOcorrencias({ inicio: hoje, fim: hoje, tanqueId }).map((o) => o.titulo);
        assert.deepEqual(titulos(a.id), ['Do A', 'Geral']);
        tanques.arquivarTanque(b.id);
        const doArquivado = lembretes.listarOcorrencias({ inicio: dia(-7), fim: dia(14), tanqueId: b.id }).filter((o) => o.lembreteId === doB.id);
        assert.deepEqual(datas(doArquivado), [dia(-7)]);
    });
    it('a agenda recebe lembretes e alertas do dia, na ordem das etiquetas (seção 7.1)', () => {
        const tanque = comCiclo();
        registros.salvarRegistro({ tanqueId: tanque.id, data: dia(-2), racaoKg: 0.2, mortalidade: 50 });
        novo({ titulo: 'Conferir', tanqueId: tanque.id, data: dia(-2) });
        novo({ titulo: 'Geral', data: dia(-2) });
        const doDia = ciclos.listarEventosCalendario({ inicio: dia(-2), fim: dia(-2), tanqueId: tanque.id });
        assert.deepEqual(doDia.map((e) => e.tipo), ['alerta', 'lembrete', 'lembrete', 'registro']);
        assert.equal(doDia[0].titulo, 'Mortalidade alta');
        assert.equal(doDia[0].gravidade, 'alta');
        assert.equal(doDia[1].tanqueNome, null, 'o geral vem antes, sem tanque');
        assert.equal(doDia[3].editavel, true);
    });
});
