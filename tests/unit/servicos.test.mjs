// Testes dos services: CSV, backup e dados de exemplo.
// Rodar com: node --test tests/

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RAIZ } from './ambiente.mjs';

const { hojeISO, somarDias } = await import(RAIZ + 'core/utils.js');
const storage = await import(RAIZ + 'core/storage.js');
const tanques = await import(RAIZ + 'domain/tanques.js');
const ciclos = await import(RAIZ + 'domain/ciclos.js');
const registros = await import(RAIZ + 'domain/registros.js');
const { analisarTanque } = await import(RAIZ + 'domain/alertas.js');
const { obterLimitesPadrao } = await import(RAIZ + 'domain/configuracoes.js');
const lembretes = await import(RAIZ + 'domain/lembretes.js');
const exportacao = await import(RAIZ + 'services/exportacao.js');
const seed = await import(RAIZ + 'services/seed.js');

const hoje = hojeISO();
beforeEach(() => localStorage.clear());

describe('services/exportacao (seção 9.7)', () => {
    it('CSV com BOM, ";", vírgula decimal, aspas e proteção contra fórmulas', () => {
        const a = tanques.salvarTanque({ nome: 'Tanque B', especie: 'Tilápia', volumeM3: 1, densidadeMaximaKgM3: 5 });
        const b = tanques.salvarTanque({ nome: 'Tanque A', especie: 'Pacu', volumeM3: 1, densidadeMaximaKgM3: 5 });
        ciclos.iniciarCiclo(a.id, { dataInicio: '2026-09-01', quantidadeInicial: 50, pesoMedioInicialG: 5 });
        ciclos.iniciarCiclo(b.id, { dataInicio: '2026-09-02', quantidadeInicial: 50, pesoMedioInicialG: 5 });
        registros.salvarRegistro({ tanqueId: a.id, data: '2026-09-10', pesoMedioG: 12.5, racaoKg: 1.25, observacoes: 'Água "turva"; ok' });
        registros.salvarRegistro({ tanqueId: b.id, data: '2026-09-05', mortalidade: 2, observacoes: '=1+1' });
        const { conteudo, quantidade } = exportacao.gerarCsvRegistros();
        assert.equal(quantidade, 2);
        assert.ok(conteudo.startsWith('﻿Tanque;Espécie;Ciclo (povoamento);Data;Peso médio (g);Ração (kg);Mortos encontrados;Natalidade;Observações\r\n'));
        const linhas = conteudo.slice(1).trimEnd().split('\r\n');
        assert.equal(linhas[1], "Tanque A;Pacu;02/09/2026;05/09/2026;;;2;;'=1+1");
        assert.equal(linhas[2], 'Tanque B;Tilápia;01/09/2026;10/09/2026;12,5;1,25;;;"Água ""turva""; ok"');
        assert.equal(exportacao.gerarCsvRegistros({ tanqueId: a.id }).quantidade, 1);
    });
    it('CSV de lembretes: uma linha por lembrete, com as conclusões', () => {
        const tanque = tanques.salvarTanque({ nome: 'Tanque A', especie: 'Pacu', volumeM3: 1, densidadeMaximaKgM3: 5 });
        const repetido = lembretes.salvarLembrete({ titulo: 'Biometria', data: '2026-09-01', tanqueId: tanque.id, repetirDias: 15 });
        lembretes.salvarLembrete({ titulo: '+ ração', data: '2026-08-20', observacao: 'Sacos; 25 kg' });
        lembretes.alternarConclusao(repetido.id, '2026-09-16');
        lembretes.alternarConclusao(repetido.id, '2026-09-01');
        const { conteudo, quantidade } = exportacao.gerarCsvLembretes();
        assert.equal(quantidade, 2);
        const linhas = conteudo.slice(1).trimEnd().split('\r\n');
        assert.equal(linhas[0], 'Título;Tanque;Data;Repetir;Concluído em;Observação');
        assert.equal(linhas[1], "'+ ração;Geral;20/08/2026;Não repete;;\"Sacos; 25 kg\"");
        assert.equal(linhas[2], 'Biometria;Tanque A;01/09/2026;A cada 15 dias;01/09/2026, 16/09/2026;');
        assert.equal(exportacao.gerarCsvLembretes({ tanqueId: tanque.id }).quantidade, 1);
    });
    it('backup: lê, valida a versão e restaura', async () => {
        tanques.salvarTanque({ nome: 'X', especie: 'Y', volumeM3: 1, densidadeMaximaKgM3: 5 });
        const texto = JSON.stringify(storage.lerDados());
        localStorage.clear();
        exportacao.restaurarBackup(await exportacao.lerBackup(new Blob([texto])));
        assert.equal(tanques.listarTanques()[0].nome, 'X');
        await assert.rejects(exportacao.lerBackup(new Blob(['não é json'])), /JSON válido/);
        const v1 = { versao: 1, tanques: [{ id: 'a', nome: 'Antigo', capacidade: 10 }], ciclos: [], registros: [], config: { limitesAlerta: {} } };
        const migrados = await exportacao.lerBackup(new Blob([JSON.stringify(v1)]));
        assert.equal(migrados.versao, storage.VERSAO_DADOS, 'backup da versão 1 continua restaurável');
        assert.equal(migrados.tanques[0].capacidadePeixesLegado, 10);
        await assert.rejects(exportacao.lerBackup(new Blob([JSON.stringify({ versao: 99, tanques: [], ciclos: [], registros: [] })])), /versão 99/);
    });
});

describe('services/exportacao: data do último backup', () => {
    it('o backup registra config.ultimoBackupEm e inclui lembretes', () => {
        assert.equal(storage.lerDados().config.ultimoBackupEm, null);
        const { conteudo } = exportacao.prepararBackup();
        const dados = JSON.parse(conteudo);
        assert.match(dados.config.ultimoBackupEm, /^\d{4}-\d{2}-\d{2}T/);
        assert.deepEqual(dados.lembretes, []);
        assert.equal(storage.lerDados().config.ultimoBackupEm, dados.config.ultimoBackupEm);
    });
});

describe('services/seed (dados de exemplo)', () => {
    it('gera o cenário planejado, respeitando as regras e sempre igual', () => {
        const dados = seed.carregarDadosExemplo();
        assert.equal(dados.tanques.length, 6);
        assert.equal(dados.ciclos.length, 5);
        const status = Object.fromEntries(tanques.listarTanques({ incluirArquivados: true }).map((t) => [t.nome, t.status]));
        assert.deepEqual(status, { 'Tanque 01': 'ativo', 'Tanque 02': 'ativo', 'Tanque 03': 'arquivado', 'Tanque 05': 'ativo', 'Tanque-rede 04': 'manutencao', 'Viveiro Norte': 'vazio' });

        const limitesPadrao = obterLimitesPadrao();
        const porTanque = Object.fromEntries(tanques.listarSituacoes().filter((s) => s.cicloAtivo).map((s) => {
            const { alertas, indicadores } = analisarTanque(s, { limitesPadrao, hoje });
            return [s.tanque.nome, { tipos: alertas.map((a) => a.tipo), indicadores }];
        }));
        assert.deepEqual(porTanque['Tanque 01'].tipos, []);
        assert.deepEqual(porTanque['Tanque 02'].tipos, ['mortalidade-registro', 'peso']);
        assert.deepEqual(porTanque['Tanque 05'].tipos, ['capacidade', 'sem-registro']);
        assert.ok(Math.abs(porTanque['Tanque 01'].indicadores.capacidadeUtilizada - 77) < 2, 'Tanque 01 perto de 77%');
        for (const [nome, { indicadores }] of Object.entries(porTanque)) {
            assert.ok(indicadores.fca > 1.2 && indicadores.fca < 1.7, `${nome}: FCA ${indicadores.fca}`);
        }
        const viveiro = tanques.listarSituacoes().find((s) => s.tanque.nome === 'Viveiro Norte');
        assert.equal(viveiro.ciclos[0].status, 'encerrado');
        // Despescas do exemplo fecham pela biomassa, com perdas que ninguém viu.
        const [{ resultado }] = ciclos.listarResultadosCiclos(viveiro.tanque.id);
        assert.ok(viveiro.ciclos[0].biomassaFinalKg > 0 && viveiro.ciclos[0].quantidadeDespescada === null);
        assert.ok(resultado.quantidadeFinalEstimada && resultado.mortalidadeNaoObservada > 300, JSON.stringify(resultado));
        assert.equal(viveiro.ultimoRegistro.data, somarDias(hoje, -150));

        // Lembretes: três hoje (um concluído), repetidos e um atrasado.
        const deHoje = lembretes.listarOcorrencias({ inicio: hoje, fim: hoje });
        assert.deepEqual([deHoje.length, deHoje.filter((o) => o.concluida).length], [3, 1]);
        assert.ok(dados.lembretes.some((l) => l.repetirDias));
        assert.deepEqual(lembretes.listarAtrasados({ hoje }).map((o) => o.titulo), ['Revisar o aerador']);

        const segunda = seed.carregarDadosExemplo();
        assert.deepEqual(segunda.registros.map((r) => r.racaoKg), dados.registros.map((r) => r.racaoKg));
    });
    it('substitui os dados atuais', () => {
        tanques.salvarTanque({ nome: 'Meu tanque', especie: 'Y', volumeM3: 1, densidadeMaximaKgM3: 5 });
        seed.carregarDadosExemplo();
        assert.ok(!tanques.listarTanques().some((t) => t.nome === 'Meu tanque'));
    });
});
