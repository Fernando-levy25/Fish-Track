// Dados de exemplo (seção 7.9): tanques em situações diferentes, para conhecer
// o sistema. São gerados pelas mesmas funções do domínio que o produtor usa,
// então respeitam todas as regras de negócio. As datas são relativas a hoje e
// o sorteio usa uma semente fixa, para o exemplo sair sempre igual.

import { apagarDados, lerDados, salvarDados } from '../core/storage.js';
import { hojeISO, somarDias } from '../core/utils.js';
import { arquivarTanque, salvarTanque } from '../domain/tanques.js';
import { iniciarCiclo, registrarDespesca } from '../domain/ciclos.js';
import { salvarRegistro } from '../domain/registros.js';

const SEMENTE = 20261016;
const OBSERVACOES = [
    'Água turva pela manhã.',
    'Troca parcial de água.',
    'Peixes comendo bem.',
    'Aerador ligado durante a noite.',
    'Chuva forte à tarde.',
    'Limpeza das telas de entrada.',
];

export function carregarDadosExemplo() {
    const anteriores = lerDados();
    apagarDados();
    try {
        criarExemplo(hojeISO());
    } catch (erro) {
        // Se algo falhar no meio, volta aos dados de antes em vez de deixar um exemplo pela metade.
        salvarDados(anteriores);
        throw erro;
    }
    return lerDados();
}

function criarExemplo(hoje) {
    const sortear = criarSorteio(SEMENTE);
    const dia = (deslocamento) => somarDias(hoje, deslocamento);

    // Bom crescimento, perto da capacidade e com uma contagem que corrigiu o estoque.
    const tanque01 = salvarTanque({
        nome: 'Tanque 01', especie: 'Tilápia', volumeM3: 300, capacidade: 2600,
        observacoes: 'Viveiro escavado, com aerador de pás.',
    });
    simularCiclo(tanque01.id, {
        inicio: dia(-84), dias: 84, quantidadeInicial: 2500, pesoInicialG: 5, pesoFinalG: 385,
        pesoAlvoG: 800, duracaoPrevista: 180, contagem: { dia: 42, ajuste: -30 }, sortear,
    });

    // Crescimento abaixo do esperado e mortalidade alta no último registro.
    const tanque02 = salvarTanque({ nome: 'Tanque 02', especie: 'Tambaqui', volumeM3: 450, capacidade: 4000 });
    simularCiclo(tanque02.id, {
        inicio: dia(-63), dias: 63, quantidadeInicial: 3200, pesoInicialG: 3, pesoFinalG: 230,
        pesoAlvoG: 1200, duracaoPrevista: 240, sortear,
        ultimoRegistro: { mortalidade: 45, observacoes: 'Peixes na superfície pela manhã. Possível falta de oxigênio.' },
    });

    // Sem registros há quase duas semanas.
    const tanque05 = salvarTanque({ nome: 'Tanque 05', especie: 'Tambacu', volumeM3: 200, capacidade: 1800 });
    simularCiclo(tanque05.id, { inicio: dia(-70), dias: 58, quantidadeInicial: 1500, pesoInicialG: 8, pesoFinalG: 120, sortear });

    // Vazio, com um ciclo encerrado no histórico.
    const viveiro = salvarTanque({
        nome: 'Viveiro Norte', especie: 'Tilápia', volumeM3: 800, capacidade: 6000,
        observacoes: 'Abastecido pela represa; esvaziado após a despesca.',
    });
    simularCiclo(viveiro.id, {
        inicio: dia(-330), dias: 180, quantidadeInicial: 5000, pesoInicialG: 4, pesoFinalG: 870,
        pesoAlvoG: 850, duracaoPrevista: 180, despesca: { perda: 25 }, sortear,
    });

    // Em manutenção, sem ciclos.
    salvarTanque({ nome: 'Tanque-rede 04', especie: 'Pintado', volumeM3: 18, capacidade: 900, manutencao: true });

    // Fora de uso: arquivado depois de um ciclo antigo.
    const antigo = salvarTanque({ nome: 'Tanque 03', especie: 'Tilápia', volumeM3: 250, capacidade: 2000 });
    simularCiclo(antigo.id, {
        inicio: dia(-520), dias: 120, quantidadeInicial: 1800, pesoInicialG: 5, pesoFinalG: 520,
        despesca: { perda: 10 }, sortear,
    });
    arquivarTanque(antigo.id);
}

// Um ciclo com registro diário de ração, pesagem semanal, mortalidade baixa e
// observações ocasionais.
function simularCiclo(tanqueId, {
    inicio,
    dias,
    quantidadeInicial,
    pesoInicialG,
    pesoFinalG,
    pesoAlvoG = null,
    duracaoPrevista = null,
    contagem = null,
    ultimoRegistro = null,
    despesca = null,
    sortear,
}) {
    iniciarCiclo(tanqueId, {
        dataInicio: inicio,
        quantidadeInicial,
        pesoMedioInicialG: pesoInicialG,
        pesoAlvoG,
        dataPrevistaDespesca: duracaoPrevista ? somarDias(inicio, duracaoPrevista) : null,
    });

    // Curva levemente acelerada: peixes maiores ganham mais gramas por dia.
    const pesoNoDia = (dia) => pesoInicialG + (pesoFinalG - pesoInicialG) * (dia / dias) ** 1.15;
    let estoque = quantidadeInicial;

    for (let dia = 1; dia <= dias; dia += 1) {
        // Ração pelo ganho de biomassa do dia, com conversão alimentar de 1,3 a 1,6.
        const ganhoKg = (estoque * (pesoNoDia(dia) - pesoNoDia(dia - 1))) / 1000;
        const registro = {
            tanqueId,
            data: somarDias(inicio, dia),
            racaoKg: arredondar(ganhoKg * (1.3 + sortear() * 0.3), 1),
        };
        if (dia % 7 === 0) {
            registro.pesoMedioG = arredondar(pesoNoDia(dia) * (0.97 + sortear() * 0.06), 1);
        }
        if (sortear() < 0.25) {
            registro.mortalidade = 1 + Math.floor(sortear() * 3);
        }
        if (sortear() < 0.06) {
            registro.observacoes = OBSERVACOES[Math.floor(sortear() * OBSERVACOES.length)];
        }
        if (ultimoRegistro && dia === dias) {
            Object.assign(registro, ultimoRegistro);
        }
        estoque -= registro.mortalidade ?? 0;
        if (contagem?.dia === dia) {
            registro.quantidadeContada = estoque + contagem.ajuste;
            registro.observacoes = 'Contagem feita na biometria.';
            estoque = registro.quantidadeContada;
        }
        salvarRegistro(registro);
    }

    if (despesca) {
        registrarDespesca(tanqueId, {
            dataDespesca: somarDias(inicio, dias),
            quantidadeDespescada: estoque - despesca.perda,
            pesoMedioFinalG: arredondar(pesoNoDia(dias), 0),
        });
    }
}

function arredondar(valor, casas) {
    const fator = 10 ** casas;
    return Math.round(valor * fator) / fator;
}

// Gerador pseudoaleatório com semente (mulberry32): mesma semente, mesmo exemplo.
function criarSorteio(semente) {
    let estado = semente >>> 0;
    return () => {
        estado = (estado + 0x6d2b79f5) >>> 0;
        let t = estado;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
