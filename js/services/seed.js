// Dados de exemplo (seção 7.9): tanques em situações diferentes, para conhecer
// o sistema. São gerados pelas mesmas funções do domínio que o produtor usa,
// então respeitam todas as regras de negócio. As datas são relativas a hoje e
// o sorteio usa uma semente fixa, para o exemplo sair sempre igual.

import { apagarDados, lerDados, salvarDados } from '../core/storage.js';
import { hojeISO, somarDias } from '../core/utils.js';
import { arquivarTanque, salvarTanque } from '../domain/tanques.js';
import { iniciarCiclo, registrarDespesca } from '../domain/ciclos.js';
import { salvarRegistro } from '../domain/registros.js';
import { alternarConclusao, salvarLembrete } from '../domain/lembretes.js';
import { carregarModeloEmbrapa } from '../domain/arracoamento.js';

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

    // Tabela de alimentação de exemplo (seção 9.10), usada pelo Tanque 01.
    const tabelaEmbrapa = carregarModeloEmbrapa();

    // Bom crescimento. Capacidade informada como carga total; ração sugerida pela tabela.
    const tanque01 = salvarTanque({
        nome: 'Tanque 01', especie: 'Tilápia', volumeM3: 300, cargaMaximaKg: 1200, tabelaArracoamentoId: tabelaEmbrapa.id,
        observacoes: 'Viveiro escavado, com aerador de pás.',
    });
    simularCiclo(tanque01.id, {
        inicio: dia(-84), dias: 84, quantidadeInicial: 2500, pesoInicialG: 5, pesoFinalG: 385,
        pesoAlvoG: 800, duracaoPrevista: 180, sortear,
    });

    // Crescimento abaixo do esperado e mortalidade alta no último registro.
    const tanque02 = salvarTanque({ nome: 'Tanque 02', especie: 'Tambaqui', volumeM3: 450, densidadeMaximaKgM3: 2 });
    simularCiclo(tanque02.id, {
        inicio: dia(-63), dias: 63, quantidadeInicial: 3200, pesoInicialG: 3, pesoFinalG: 230,
        pesoAlvoG: 1200, duracaoPrevista: 240, sortear,
        ultimoRegistro: { mortalidade: 45, observacoes: 'Peixes na superfície pela manhã. Possível falta de oxigênio.' },
    });

    // Sem registros há quase duas semanas e perto da carga máxima.
    const tanque05 = salvarTanque({ nome: 'Tanque 05', especie: 'Tambacu', volumeM3: 200, densidadeMaximaKgM3: 0.9 });
    simularCiclo(tanque05.id, { inicio: dia(-70), dias: 58, quantidadeInicial: 1500, pesoInicialG: 8, pesoFinalG: 120, sortear });

    // Vazio, com um ciclo encerrado no histórico.
    const viveiro = salvarTanque({
        nome: 'Viveiro Norte', especie: 'Tilápia', volumeM3: 800, densidadeMaximaKgM3: 1.5,
        observacoes: 'Abastecido pela represa; esvaziado após a despesca.',
    });
    simularCiclo(viveiro.id, {
        inicio: dia(-330), dias: 180, quantidadeInicial: 5000, pesoInicialG: 4, pesoFinalG: 870,
        pesoAlvoG: 850, duracaoPrevista: 180, despesca: { naoObservados: 410, contada: false }, sortear,
    });

    // Em manutenção, sem ciclos.
    salvarTanque({ nome: 'Tanque-rede 04', especie: 'Pintado', volumeM3: 18, densidadeMaximaKgM3: 80, manutencao: true });

    // Fora de uso: arquivado depois de um ciclo antigo.
    const antigo = salvarTanque({ nome: 'Tanque 03', especie: 'Tilápia', volumeM3: 250, densidadeMaximaKgM3: 3 });
    simularCiclo(antigo.id, {
        inicio: dia(-520), dias: 120, quantidadeInicial: 1800, pesoInicialG: 5, pesoFinalG: 520,
        despesca: { naoObservados: 160, contada: true }, sortear,
    });
    arquivarTanque(antigo.id);

    // Lembretes (seção 7): três para hoje, um já concluído; repetidos com as
    // ocorrências passadas em dia; e um atrasado.
    const lembrete = (entrada, concluidas = []) => {
        const { id } = salvarLembrete({ observacao: '', tanqueId: null, repetirDias: null, ...entrada });
        concluidas.forEach((data) => alternarConclusao(id, data));
    };
    lembrete({ titulo: 'Biometria quinzenal', tanqueId: tanque01.id, data: dia(-30), repetirDias: 15 }, [dia(-30), dia(-15)]);
    lembrete({ titulo: 'Medir oxigênio ao amanhecer', tanqueId: tanque02.id, data: dia(-14), repetirDias: 7 }, [dia(-14), dia(-7)]);
    lembrete({ titulo: 'Comprar ração', data: hoje, observacao: '20 sacos de 25 kg, ração 32% de proteína.' }, [hoje]);
    lembrete({ titulo: 'Revisar o aerador', tanqueId: tanque05.id, data: dia(-2), observacao: 'Fazendo barulho na partida.' });
    lembrete({ titulo: 'Limpar as telas de entrada', tanqueId: viveiro.id, data: dia(5) });
    lembrete({ titulo: 'Avisar o comprador sobre a despesca', data: dia(12) });
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
            const pesoMedioG = arredondar(pesoNoDia(dia) * (0.97 + sortear() * 0.06), 1);
            // Biometrias a cada 14 dias são por amostra de 50 peixes, algumas com comprimento.
            if (dia % 14 === 0) {
                registro.biometria = {
                    peixesAmostra: 50,
                    pesoAmostraG: arredondar(pesoMedioG * 50, 0),
                    comprimentoMedioCm: dia % 28 === 0 ? arredondar(4.6 * Math.cbrt(pesoMedioG), 1) : null,
                };
            } else {
                registro.pesoMedioG = pesoMedioG;
            }
        }
        // De vez em quando sobra ração (pesada e anotada).
        if (dia % 9 === 0) {
            registro.racaoSobraKg = arredondar(registro.racaoKg * 0.06, 1);
        }
        if (sortear() < 0.25) {
            registro.mortalidade = 1 + Math.floor(sortear() * 3);
            registro.causaMortalidade = ['desconhecida', 'manejo', 'predacao'][dia % 3];
        }
        if (sortear() < 0.06) {
            registro.observacoes = OBSERVACOES[Math.floor(sortear() * OBSERVACOES.length)];
        }
        if (ultimoRegistro && dia === dias) {
            Object.assign(registro, ultimoRegistro);
        }
        estoque -= registro.mortalidade ?? 0;
        salvarRegistro(registro);
    }

    if (despesca) {
        // Na despesca aparecem as perdas que ninguém viu: a quantidade real fica
        // abaixo da estimada, e a biomassa é a pesada (RN19).
        const pesoFinalG = arredondar(pesoNoDia(dias), 0);
        const quantidadeReal = estoque - despesca.naoObservados;
        registrarDespesca(tanqueId, {
            dataDespesca: somarDias(inicio, dias),
            biomassaFinalKg: arredondar((quantidadeReal * pesoFinalG) / 1000, 1),
            pesoMedioFinalG: pesoFinalG,
            quantidadeDespescada: despesca.contada ? quantidadeReal : null,
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
