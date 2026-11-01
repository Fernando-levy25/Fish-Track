// Testes da proteção dos dados nos caminhos de falha (seção 8.5): dados
// ilegíveis, versão mais nova, restauração, exclusão de tanque e falta de espaço.
// Rodar com: node --test tests/

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RAIZ, falhas } from './ambiente.mjs';

const storage = await import(RAIZ + 'core/storage.js');
const tanques = await import(RAIZ + 'domain/tanques.js');
const ciclos = await import(RAIZ + 'domain/ciclos.js');
const registros = await import(RAIZ + 'domain/registros.js');
const lembretes = await import(RAIZ + 'domain/lembretes.js');
const configuracoes = await import(RAIZ + 'domain/configuracoes.js');
const { listarTabelas } = await import(RAIZ + 'domain/arracoamento.js');
const { verificarIntegridade } = await import(RAIZ + 'domain/integridade.js');
const exportacao = await import(RAIZ + 'services/exportacao.js');
const seed = await import(RAIZ + 'services/seed.js');
const { hojeISO, somarDias } = await import(RAIZ + 'core/utils.js');

const CHAVE = 'fishtrack:v1';
const ANTES = 'fishtrack:v1:antes-da-restauracao';
const hoje = hojeISO();

beforeEach(() => {
    falhas.setItem = null;
    falhas.corromper = null;
    localStorage.clear();
    // Sai do modo só leitura de um teste anterior (o módulo guarda esse estado).
    storage.tentarSalvarDeNovo();
});

const copiasIlegiveis = () => storage.listarCopiasIlegiveis().filter((copia) => copia.data);
const falharNaChave = (prefixo) => (chave) => chave.startsWith(prefixo);

function criarBase() {
    const tanque = tanques.salvarTanque({ nome: 'Tanque 01', especie: 'Tilápia', volumeM3: 10, densidadeMaximaKgM3: 20 });
    const ciclo = ciclos.iniciarCiclo(tanque.id, { dataInicio: somarDias(hoje, -20), quantidadeInicial: 100, pesoMedioInicialG: 5 });
    registros.salvarRegistro({ tanqueId: tanque.id, data: somarDias(hoje, -1), racaoKg: 1 });
    return { tanque, ciclo, texto: localStorage.getItem(CHAVE) };
}

describe('dados ilegíveis (seção 8.5)', () => {
    it('não começa vazio, nada é gravado e salvarDados é recusado', () => {
        localStorage.setItem(CHAVE, '{quebrado');
        assert.equal(storage.verificarEstadoArmazenamento(), 'ilegivel');
        assert.throws(() => storage.lerDados(), storage.ErroDadosIlegiveis);
        assert.throws(() => storage.salvarDados(storage.criarDadosVazios()), storage.ErroArmazenamentoBloqueado);
        assert.throws(() => tanques.salvarTanque({ nome: 'A', especie: 'B', volumeM3: 1 }));
        assert.equal(localStorage.getItem(CHAVE), '{quebrado', 'fishtrack:v1 fica byte a byte igual');
        assert.equal(copiasIlegiveis().length, 0, 'ler não cria cópia nenhuma');
    });
    it('estrutura corrompida também é ilegível', () => {
        localStorage.setItem(CHAVE, JSON.stringify({ versao: 5, tanques: 'x' }));
        assert.equal(storage.verificarEstadoArmazenamento(), 'ilegivel');
    });
    it('baixar o conteúdo bruto devolve o texto exato', () => {
        localStorage.setItem(CHAVE, '{quebrado');
        assert.equal(storage.baixarConteudoBruto().conteudo, '{quebrado');
    });
    it('base nova sem confirmação é recusada', () => {
        localStorage.setItem(CHAVE, '{quebrado');
        assert.throws(() => storage.iniciarBaseNova(), storage.ErroArmazenamentoBloqueado);
        assert.throws(() => storage.iniciarBaseNova({ confirmado: 'sim' }), storage.ErroArmazenamentoBloqueado);
        assert.equal(localStorage.getItem(CHAVE), '{quebrado');
    });
    it('base nova confirmada: cópia datada conferida antes, no máximo 3 cópias', () => {
        for (let i = 0; i < 3; i += 1) {
            localStorage.setItem(`fishtrack:v1:ilegivel:2026-10-0${i + 1}T10:00:00.000Z`, `antiga ${i}`);
        }
        localStorage.setItem('fishtrack:v1:ilegivel', 'cópia sem data, de versão antiga');
        localStorage.setItem(CHAVE, '{quebrado');
        storage.iniciarBaseNova({ confirmado: true });
        assert.equal(storage.verificarEstadoArmazenamento(), 'ok');
        assert.deepEqual(storage.lerDados(), storage.criarDadosVazios());
        const datadas = copiasIlegiveis();
        assert.equal(datadas.length, 3);
        assert.equal(storage.lerCopiaIlegivel(datadas[0].chave), '{quebrado', 'a mais nova é a dos dados de agora');
        assert.ok(!datadas.some((copia) => copia.data.startsWith('2026-10-01')), 'a mais antiga saiu');
        assert.equal(storage.listarCopiasIlegiveis().length, 4, 'a cópia sem data fica e é listada');
    });
    it('cópia datada que não grava ou não confere: nada muda, mesmo depois de baixar', () => {
        localStorage.setItem('fishtrack:v1:ilegivel:2026-10-01T10:00:00.000Z', 'antiga');
        localStorage.setItem(CHAVE, '{quebrado');
        storage.baixarConteudoBruto();
        falhas.setItem = falharNaChave('fishtrack:v1:ilegivel:');
        assert.throws(() => storage.iniciarBaseNova({ confirmado: true }), /Nada foi alterado/);
        falhas.setItem = null;
        falhas.corromper = (chave, valor) => (chave.startsWith('fishtrack:v1:ilegivel:') ? valor.slice(1) : valor);
        assert.throws(() => storage.iniciarBaseNova({ confirmado: true }), /Nada foi alterado/);
        falhas.corromper = null;
        assert.equal(localStorage.getItem(CHAVE), '{quebrado');
        assert.deepEqual(copiasIlegiveis().map((copia) => storage.lerCopiaIlegivel(copia.chave)), ['antiga']);
        assert.equal(storage.verificarEstadoArmazenamento(), 'ilegivel');
    });
    it('descartar uma cópia; chaves de fora das cópias são recusadas', () => {
        localStorage.setItem('fishtrack:v1:ilegivel:2026-10-01T10:00:00.000Z', 'antiga');
        storage.descartarCopiaIlegivel('fishtrack:v1:ilegivel:2026-10-01T10:00:00.000Z');
        assert.equal(storage.listarCopiasIlegiveis().length, 0);
        assert.throws(() => storage.descartarCopiaIlegivel(CHAVE));
        assert.throws(() => storage.lerCopiaIlegivel('fishtrack:preferencias'));
    });
});

describe('versão mais nova (seção 8.5)', () => {
    it('lerDados lança ErroVersaoMaisNova e nada é gravado', () => {
        const texto = JSON.stringify({ ...storage.criarDadosVazios(), versao: storage.VERSAO_DADOS + 1 });
        localStorage.setItem(CHAVE, texto);
        assert.throws(() => storage.lerDados(), storage.ErroVersaoMaisNova);
        assert.equal(storage.verificarEstadoArmazenamento(), 'versaoMaisNova');
        assert.throws(() => storage.salvarDados(storage.criarDadosVazios()), storage.ErroArmazenamentoBloqueado);
        assert.equal(localStorage.getItem(CHAVE), texto);
    });
});

describe('restaurar backup (seção 8.5)', () => {
    it('backup v5 com config vazio é completado com os padrões', () => {
        const { dados } = exportacao.analisarBackup(JSON.stringify({ ...storage.criarDadosVazios(), config: {} }));
        exportacao.restaurarBackup(dados);
        assert.deepEqual(listarTabelas(), []);
        assert.deepEqual(configuracoes.obterUnidades(), { biomassa: 'kg', racao: 'kg' });
        assert.deepEqual(storage.lerDados().config, storage.criarConfigPadrao());
    });
    it('formato inválido é recusado e nada muda (dados, memória e preferências)', () => {
        criarBase();
        storage.salvarPreferencia('periodo', 30);
        const antes = { dados: localStorage.getItem(CHAVE), preferencias: localStorage.getItem('fishtrack:preferencias'), lidos: storage.lerDados() };
        const base = storage.criarDadosVazios();
        const invalidos = [
            { ...base, config: { unidades: { biomassa: 'lb' } } },
            { ...base, config: { unidades: { racao: 't' } } },
            { ...base, config: { tabelasArracoamento: 'x' } },
            { ...base, config: { tabelasArracoamento: [{ id: 'p', nome: 'Sem faixas', tipo: 'faixas', faixas: [] }] } },
            { ...base, lembretes: 'x' },
        ];
        for (const invalido of invalidos) {
            assert.throws(() => exportacao.analisarBackup(JSON.stringify(invalido)), (erro) => erro.name === 'ErroValidacao');
        }
        assert.equal(localStorage.getItem(CHAVE), antes.dados);
        assert.equal(localStorage.getItem('fishtrack:preferencias'), antes.preferencias);
        assert.deepEqual(storage.lerDados(), antes.lidos);
        assert.equal(localStorage.getItem(ANTES), null);
    });
    it('a análise não compartilha referências com o objeto lido', () => {
        const original = storage.criarDadosVazios();
        const { dados } = exportacao.analisarBackup(JSON.stringify(original));
        dados.tanques.push({ id: 'novo' });
        assert.equal(original.tanques.length, 0);
    });
    it('relacionamentos quebrados bloqueiam, com a lista dos problemas', () => {
        criarBase();
        const antes = localStorage.getItem(CHAVE);
        const dados = storage.lerDados();
        dados.registros[0].tanqueId = 'inexistente';
        assert.throws(() => exportacao.analisarBackup(JSON.stringify(dados)), (erro) => erro.problemas?.some((problema) => problema.includes('aponta para um tanque que não existe')));
        assert.equal(localStorage.getItem(CHAVE), antes);
    });
    it('cria a cópia de antes da restauração e permite voltar a ela', () => {
        const { texto } = criarBase();
        exportacao.restaurarBackup(exportacao.analisarBackup(JSON.stringify(storage.criarDadosVazios())).dados);
        assert.equal(localStorage.getItem(ANTES), texto, 'cópia conferida dos dados de antes');
        assert.equal(tanques.listarTanques().length, 0);
        assert.ok(exportacao.existeCopiaAntesDaRestauracao());
        exportacao.voltarAntesDaRestauracao();
        assert.equal(tanques.listarTanques()[0].nome, 'Tanque 01');
        assert.equal(localStorage.getItem(ANTES), null, 'só apagada depois de gravar');
    });
    it('sem a cópia preventiva, a restauração é cancelada', () => {
        const { texto } = criarBase();
        const { dados } = exportacao.analisarBackup(JSON.stringify(storage.criarDadosVazios()));
        falhas.setItem = falharNaChave(ANTES);
        assert.throws(() => exportacao.restaurarBackup(dados), /restauração foi cancelada/);
        falhas.setItem = null;
        falhas.corromper = (chave, valor) => (chave === ANTES ? `${valor} ` : valor);
        assert.throws(() => exportacao.restaurarBackup(dados), /restauração foi cancelada/);
        falhas.corromper = null;
        assert.equal(localStorage.getItem(CHAVE), texto);
    });
    it('"voltar aos dados de antes" com cópia inválida é recusado e a cópia fica', () => {
        const { texto } = criarBase();
        localStorage.setItem(ANTES, '{"versao":5,"tanques":"x"}');
        assert.throws(() => exportacao.voltarAntesDaRestauracao());
        assert.equal(localStorage.getItem(ANTES), '{"versao":5,"tanques":"x"}');
        assert.equal(localStorage.getItem(CHAVE), texto);
    });
    it('restaurar sobre dados ilegíveis guarda a cópia datada', () => {
        localStorage.setItem(CHAVE, '{quebrado');
        exportacao.restaurarBackup(exportacao.analisarBackup(JSON.stringify(storage.criarDadosVazios())).dados);
        assert.equal(storage.verificarEstadoArmazenamento(), 'ok');
        assert.equal(storage.lerCopiaIlegivel(copiasIlegiveis()[0].chave), '{quebrado');
    });
});

describe('verificarIntegridade (seção 8.5)', () => {
    const dadosValidos = () => {
        criarBase();
        return storage.lerDados();
    };
    it('o backup dos dados de exemplo passa sem erros', () => {
        seed.carregarDadosExemplo();
        const { dados } = exportacao.analisarBackup(exportacao.prepararBackup().conteudo);
        assert.deepEqual(verificarIntegridade(dados, hoje).erros, []);
    });
    it('aponta cada tipo de erro', () => {
        const casos = [
            [(d) => d.tanques.push({ ...d.tanques[0] }), /mesmo identificador/],
            [(d) => { d.ciclos[0].tanqueId = 'x'; }, /ciclo .*tanque que não existe/],
            [(d) => { d.registros[0].cicloId = 'x'; }, /ciclo que não existe/],
            [(d) => { d.registros[0].tanqueId = 'x'; }, /registro .*tanque que não existe/],
            [(d) => {
                d.tanques.push({ ...d.tanques[0], id: 't2', nome: 'Tanque 02' });
                d.ciclos.push({ ...d.ciclos[0], id: 'c2', tanqueId: 't2' });
                d.registros[0].cicloId = 'c2';
            }, /ciclo de outro tanque/],
            [(d) => d.ciclos.push({ ...d.ciclos[0], id: 'c2' }), /2 ciclos ativos/],
            [(d) => { d.tanques[0].nome = ''; }, /sem nome/],
            [(d) => { d.tanques[0].volumeM3 = 0; }, /volume válido/],
            [(d) => { d.ciclos[0].dataInicio = '01/10/2026'; }, /data de povoamento/],
            [(d) => { d.ciclos[0].quantidadeInicial = -1; }, /quantidade inicial/],
            [(d) => { d.registros[0].data = 'ontem'; }, /sem data válida/],
            [(d) => { d.registros[0].racaoKg = -2; }, /número inválido/],
        ];
        for (const [estragar, esperado] of casos) {
            localStorage.clear();
            const dados = dadosValidos();
            estragar(dados);
            const { erros } = verificarIntegridade(dados, hoje);
            assert.ok(erros.some((erro) => esperado.test(erro)), `${esperado}: ${erros.join(' | ')}`);
        }
    });
    it('avisos: lembrete órfão e tanque arquivado com lembrete futuro', () => {
        const dados = dadosValidos();
        dados.lembretes.push({ id: 'l1', titulo: 'Órfão', tanqueId: 'x', data: hoje, repetirDias: null, concluidas: [], excluidas: [] });
        dados.tanques.push({ ...dados.tanques[0], id: 't9', nome: 'Velho', status: 'arquivado' });
        dados.lembretes.push({ id: 'l2', titulo: 'Futuro', tanqueId: 't9', data: somarDias(hoje, 3), repetirDias: null, concluidas: [], excluidas: [] });
        const { erros, avisos } = verificarIntegridade(dados, hoje);
        assert.deepEqual(erros, []);
        assert.ok(avisos.some((aviso) => aviso.includes('"Órfão"') && aviso.includes('Geral')));
        assert.ok(avisos.some((aviso) => aviso.includes('"Velho"')));
        const { avisos: listados } = exportacao.analisarBackup(JSON.stringify(dados), hoje);
        assert.equal(listados.length, 2, 'avisos não bloqueiam a análise');
    });
    it('no máximo 10 problemas listados, com "e mais N"', () => {
        const dados = dadosValidos();
        for (let i = 0; i < 15; i += 1) {
            dados.registros.push({ ...dados.registros[0], id: `r${i}`, tanqueId: 'x' });
        }
        assert.throws(() => exportacao.analisarBackup(JSON.stringify(dados)), (erro) => erro.problemas.length === 11 && erro.problemas[10] === 'e mais 5');
    });
});

describe('excluir tanque leva os lembretes (RN17)', () => {
    it('tanque e seus 2 lembretes saem; os outros ficam', () => {
        const tanque = tanques.salvarTanque({ nome: 'Tanque 03', especie: 'Tilápia', volumeM3: 1 });
        lembretes.salvarLembrete({ titulo: 'Um', data: hoje, tanqueId: tanque.id });
        lembretes.salvarLembrete({ titulo: 'Dois', data: hoje, tanqueId: tanque.id });
        lembretes.salvarLembrete({ titulo: 'Geral', data: hoje });
        assert.equal(tanques.contarLembretesDoTanque(tanque.id), 2);
        tanques.excluirTanque(tanque.id);
        assert.equal(tanques.listarTanques().length, 0);
        assert.deepEqual(storage.lerDados().lembretes.map((lembrete) => lembrete.titulo), ['Geral']);
    });
    it('lembrete órfão antigo é lido como Geral', () => {
        const dados = storage.criarDadosVazios();
        dados.lembretes.push({ id: 'l1', titulo: 'Órfão', tanqueId: 'sumiu', data: hoje, repetirDias: null, concluidas: [], excluidas: [] });
        storage.salvarDados(dados);
        const [ocorrencia] = lembretes.listarOcorrencias({ inicio: hoje, fim: hoje, hoje });
        assert.equal(ocorrencia.tanqueId, null);
        assert.equal(ocorrencia.tanqueNome, null);
        assert.equal(lembretes.listarOcorrencias({ inicio: hoje, fim: hoje, tanqueId: 'outro', hoje }).length, 1, 'aparece com qualquer filtro');
    });
});

describe('falta de espaço (seção 8.5)', () => {
    const v4 = () => JSON.stringify({ versao: 4, tanques: [{ id: 't', nome: 'Antigo', especie: 'Pacu', volumeM3: 2, status: 'vazio' }], ciclos: [], registros: [], lembretes: [], config: { tabelasArracoamento: [] } });
    it('migração sem espaço: devolve os migrados, só leitura, e os antigos ficam intactos', () => {
        const texto = v4();
        localStorage.setItem(CHAVE, texto);
        falhas.setItem = () => true;
        const dados = storage.lerDados();
        assert.equal(dados.versao, storage.VERSAO_DADOS);
        assert.equal(dados.tanques[0].intervaloBiometriaDias, 15);
        assert.equal(storage.verificarEstadoArmazenamento(), 'somenteMemoria');
        assert.throws(() => storage.salvarDados(dados), storage.ErroArmazenamentoBloqueado);
        assert.throws(() => tanques.salvarTanque({ nome: 'Novo', especie: 'X', volumeM3: 1 }), storage.ErroArmazenamentoBloqueado);
        assert.equal(localStorage.getItem(CHAVE), texto);
        assert.equal(JSON.parse(storage.baixarConteudoBruto().conteudo).versao, storage.VERSAO_DADOS, 'baixa os dados migrados');
        assert.equal(storage.tentarSalvarDeNovo(), 'somenteMemoria', 'ainda sem espaço');
        falhas.setItem = null;
        assert.equal(storage.tentarSalvarDeNovo(), 'ok');
        assert.equal(storage.verificarEstadoArmazenamento(), 'ok');
        assert.equal(JSON.parse(localStorage.getItem(CHAVE)).versao, storage.VERSAO_DADOS);
    });
    it('estado ok com setItem falhando: nada muda e nada devolve sucesso', () => {
        const { tanque, texto } = criarBase();
        const antes = storage.lerDados();
        falhas.setItem = () => true;
        assert.throws(() => tanques.salvarTanque({ nome: 'Outro', especie: 'X', volumeM3: 1 }), storage.ErroArmazenamentoCheio);
        assert.throws(() => registros.salvarRegistro({ tanqueId: tanque.id, data: hoje, racaoKg: 2 }), storage.ErroArmazenamentoCheio);
        assert.throws(() => lembretes.salvarLembrete({ titulo: 'X', data: hoje }), storage.ErroArmazenamentoCheio);
        assert.throws(() => configuracoes.salvarUnidades({ biomassa: 't', racao: 'g' }), storage.ErroArmazenamentoCheio);
        assert.throws(() => registros.salvarFolhaDoDia({ data: hoje, linhas: [{ tanqueId: tanque.id, racaoKg: 1 }] }));
        falhas.setItem = null;
        assert.equal(localStorage.getItem(CHAVE), texto);
        assert.deepEqual(storage.lerDados(), antes);
    });
});
