// Indicadores da seção 9.4. Funções puras: recebem tanque, ciclo e registros e
// devolvem números, sem ler o storage nem tocar no DOM.

import { diasEntre, somarDias } from '../core/utils.js';

function informado(valor) {
    return valor !== null && valor !== undefined;
}

function valorOuZero(valor) {
    return informado(valor) ? valor : 0;
}

function somar(registros, campo) {
    return registros.reduce((total, registro) => total + valorOuZero(registro[campo]), 0);
}

export function ordenarRegistros(registros) {
    // RN15 permite vários registros na mesma data; a ordem de criação desempata.
    return [...registros].sort((a, b) => a.data.localeCompare(b.data) || a.criadoEm.localeCompare(b.criadoEm));
}

// Estoque antes e depois de cada registro, em ordem. A contagem é a quantidade
// real ao fim daquele registro: substitui a estimativa, e a mortalidade e a
// natalidade passam a valer só para os registros posteriores (seção 9.4).
export function calcularEstoquePorRegistro(ciclo, registros) {
    let quantidade = ciclo.quantidadeInicial;
    return ordenarRegistros(registros).map((registro) => {
        const quantidadeAntes = quantidade;
        quantidade = informado(registro.quantidadeContada)
            ? registro.quantidadeContada
            : quantidadeAntes - valorOuZero(registro.mortalidade) + valorOuZero(registro.natalidade);
        return { registro, quantidadeAntes, quantidadeDepois: quantidade };
    });
}

// RN14: devolve o primeiro registro cuja mortalidade passa do estoque estimado.
export function encontrarMortalidadeAcimaDoEstoque(ciclo, registros) {
    return calcularEstoquePorRegistro(ciclo, registros)
        .find(({ registro, quantidadeAntes }) => valorOuZero(registro.mortalidade) > quantidadeAntes) ?? null;
}

// Situação do ciclo ao fim de cada dia com registro, começando pelo povoamento.
// Base dos gráficos e dos alertas que olham o dia (RN15: valores da mesma data
// são somados).
export function calcularLinhaDoTempo(ciclo, registros) {
    const dias = [{
        data: ciclo.dataInicio,
        quantidadeInicioDia: ciclo.quantidadeInicial,
        quantidade: ciclo.quantidadeInicial,
        pesoMedioG: ciclo.pesoMedioInicialG,
        pesou: false,
        racaoDiaKg: 0,
        racaoAcumuladaKg: 0,
        mortalidadeDia: 0,
        mortalidadeAcumulada: 0,
    }];
    for (const { registro, quantidadeAntes, quantidadeDepois } of calcularEstoquePorRegistro(ciclo, registros)) {
        let dia = dias.at(-1);
        if (registro.data !== dia.data) {
            dia = { ...dia, data: registro.data, quantidadeInicioDia: quantidadeAntes, pesou: false, racaoDiaKg: 0, mortalidadeDia: 0 };
            dias.push(dia);
        }
        dia.quantidade = quantidadeDepois;
        if (informado(registro.pesoMedioG)) {
            dia.pesoMedioG = registro.pesoMedioG;
            dia.pesou = true;
        }
        dia.racaoDiaKg += valorOuZero(registro.racaoKg);
        dia.racaoAcumuladaKg += valorOuZero(registro.racaoKg);
        dia.mortalidadeDia += valorOuZero(registro.mortalidade);
        dia.mortalidadeAcumulada += valorOuZero(registro.mortalidade);
    }
    return dias.map((dia) => ({ ...dia, biomassaKg: (dia.quantidade * dia.pesoMedioG) / 1000 }));
}

export function calcularIndicadores({ tanque, ciclo, registros, hoje }) {
    const ordenados = ordenarRegistros(registros);
    const estoque = calcularEstoquePorRegistro(ciclo, ordenados);
    const quantidade = estoque.length > 0 ? estoque.at(-1).quantidadeDepois : ciclo.quantidadeInicial;

    const pesagens = [
        { data: ciclo.dataInicio, pesoMedioG: ciclo.pesoMedioInicialG },
        ...ordenados.filter((registro) => informado(registro.pesoMedioG)),
    ];
    const pesagemAtual = pesagens.at(-1);
    const pesoMedioG = pesagemAtual.pesoMedioG;

    const biomassaKg = (quantidade * pesoMedioG) / 1000;
    const cargaMaximaKg = calcularCargaMaximaKg(tanque.densidadeMaximaKgM3, tanque.volumeM3);
    const biomassaInicialKg = (ciclo.quantidadeInicial * ciclo.pesoMedioInicialG) / 1000;
    const ganhoBiomassaKg = biomassaKg - biomassaInicialKg;
    const racaoAcumuladaKg = somar(ordenados, 'racaoKg');
    const mortalidadeAcumulada = somar(ordenados, 'mortalidade');
    const natalidadeAcumulada = somar(ordenados, 'natalidade');
    const taxaMortalidade = (mortalidadeAcumulada / ciclo.quantidadeInicial) * 100;

    return {
        quantidade,
        pesoMedioG,
        dataPesoAtual: pesagemAtual.data,
        biomassaKg,
        racaoAcumuladaKg,
        ganhoBiomassaKg,
        // A FCA só faz sentido com ganho de biomassa; sem ele, a tela mostra "—".
        fca: ganhoBiomassaKg > 0 ? racaoAcumuladaKg / ganhoBiomassaKg : null,
        mortalidadeAcumulada,
        taxaMortalidade,
        taxaSobrevivencia: 100 - taxaMortalidade,
        natalidadeAcumulada,
        taxaNatalidade: (natalidadeAcumulada / ciclo.quantidadeInicial) * 100,
        taxaCrescimentoGDia: calcularTaxaCrescimento(pesagens),
        crescimentoCicloGDia: calcularCrescimentoCiclo(ciclo, pesagemAtual),
        densidadeKgM3: biomassaKg / tanque.volumeM3,
        // Seção 4: o limite do tanque é peso de peixe por volume de água, e não número de peixes.
        cargaMaximaKg,
        capacidadeUtilizada: cargaMaximaKg ? (biomassaKg / cargaMaximaKg) * 100 : null,
        projecaoDiasLimite: calcularProjecaoLimite(ciclo, ordenados, cargaMaximaKg, biomassaKg),
        densidadePovoamento: ciclo.quantidadeInicial / tanque.volumeM3,
        diasCultivo: diasEntre(ciclo.dataInicio, ciclo.dataDespesca ?? hoje),
        ultimoRegistro: ordenados.at(-1) ?? null,
    };
}

// Carga máxima de peixe que o tanque suporta, derivada e nunca armazenada.
export function calcularCargaMaximaKg(densidadeMaximaKgM3, volumeM3) {
    return Number.isFinite(densidadeMaximaKgM3) && Number.isFinite(volumeM3) ? densidadeMaximaKgM3 * volumeM3 : null;
}

// Dias até a carga máxima no ritmo de ganho de biomassa entre as duas últimas
// pesagens. Não é previsão: só estende o ritmo recente, e fica de fora quando
// não há ganho ou o resultado sai de 1 a 180 dias, onde ele deixa de ser útil.
function calcularProjecaoLimite(ciclo, registros, cargaMaximaKg, biomassaKg) {
    if (!cargaMaximaKg || biomassaKg >= cargaMaximaKg) {
        return null;
    }
    const pesagens = calcularLinhaDoTempo(ciclo, registros).filter((dia, indice) => indice === 0 || dia.pesou);
    if (pesagens.length < 2) {
        return null;
    }
    const [anterior, atual] = pesagens.slice(-2);
    const ganhoPorDia = (atual.biomassaKg - anterior.biomassaKg) / diasEntre(anterior.data, atual.data);
    if (!(ganhoPorDia > 0)) {
        return null;
    }
    const dias = Math.ceil((cargaMaximaKg - biomassaKg) / ganhoPorDia);
    return dias >= 1 && dias <= 180 ? dias : null;
}

function calcularTaxaCrescimento(pesagens) {
    const atual = pesagens.at(-1);
    // A pesagem anterior é a última de outra data; duas no mesmo dia não medem crescimento.
    const anterior = pesagens.findLast((pesagem) => pesagem.data < atual.data);
    return anterior ? (atual.pesoMedioG - anterior.pesoMedioG) / diasEntre(anterior.data, atual.data) : null;
}

function calcularCrescimentoCiclo(ciclo, pesagemAtual) {
    // Conta os dias até a última pesagem, e não até hoje: o peso atual vale para
    // aquela data, e dividir por mais dias subestimaria o crescimento.
    const dias = diasEntre(ciclo.dataInicio, pesagemAtual.data);
    return dias > 0 ? (pesagemAtual.pesoMedioG - ciclo.pesoMedioInicialG) / dias : null;
}

export function calcularSeries(ciclo, registros) {
    const dias = calcularLinhaDoTempo(ciclo, registros);
    return {
        pesoMedio: dias
            .filter((dia, indice) => indice === 0 || dia.pesou)
            .map((dia) => ({ data: dia.data, valor: dia.pesoMedioG })),
        biomassa: dias.map((dia) => ({ data: dia.data, valor: dia.biomassaKg })),
        mortalidade: dias.map((dia) => ({ data: dia.data, valor: (dia.mortalidadeAcumulada / ciclo.quantidadeInicial) * 100 })),
    };
}

// Série diária de um ciclo entre duas datas (seção 9.4): cada dia traz a
// situação ao fim dele, repetindo o último valor conhecido entre registros.
// Dias antes do povoamento ou depois da despesca ficam null.
export function calcularSerieDiaria(ciclo, registros, dataInicio, dataFim) {
    const dias = calcularLinhaDoTempo(ciclo, registros);
    const biomassaInicialKg = (ciclo.quantidadeInicial * ciclo.pesoMedioInicialG) / 1000;
    const serie = [];
    let indice = -1;
    for (let data = dataInicio; data <= dataFim; data = somarDias(data, 1)) {
        if (data < ciclo.dataInicio || (ciclo.dataDespesca && data > ciclo.dataDespesca)) {
            serie.push(null);
            continue;
        }
        while (indice + 1 < dias.length && dias[indice + 1].data <= data) {
            indice += 1;
        }
        const dia = dias[indice];
        const noProprioDia = dia.data === data;
        const ganhoKg = dia.biomassaKg - biomassaInicialKg;
        serie.push({
            data,
            quantidade: dia.quantidade,
            pesoMedioG: dia.pesoMedioG,
            biomassaKg: dia.biomassaKg,
            racaoDiaKg: noProprioDia ? dia.racaoDiaKg : 0,
            racaoAcumuladaKg: dia.racaoAcumuladaKg,
            mortalidadeDia: noProprioDia ? dia.mortalidadeDia : 0,
            mortalidadeAcumulada: dia.mortalidadeAcumulada,
            taxaMortalidade: (dia.mortalidadeAcumulada / ciclo.quantidadeInicial) * 100,
            fca: ganhoKg > 0 ? dia.racaoAcumuladaKg / ganhoKg : null,
        });
    }
    return serie;
}

// Valor no primeiro e no último dia válidos da série, e a diferença.
export function calcularVariacaoPeriodo(serie, campo) {
    const validos = serie.filter(Boolean);
    if (validos.length === 0) {
        return null;
    }
    const inicio = validos[0][campo];
    const fim = validos.at(-1)[campo];
    return { inicio, fim, variacao: fim - inicio, percentual: inicio ? ((fim - inicio) / inicio) * 100 : null };
}

// Produção no período, a partir de [{ tanque, ciclo, registros }] dos ciclos
// ativos. O período vai do fim de dataInicio ao fim de dataFim; um tanque
// povoado no meio dele parte da biomassa do povoamento.
export function calcularResumoPeriodo(itens, { dataInicio, dataFim }) {
    const datas = [];
    for (let data = dataInicio; data <= dataFim; data = somarDias(data, 1)) {
        datas.push(data);
    }
    const porTanque = itens.map((item) => ({ ...item, serie: calcularSerieDiaria(item.ciclo, item.registros, dataInicio, dataFim) }));
    const biomassaInicial = (ciclo) => (ciclo.quantidadeInicial * ciclo.pesoMedioInicialG) / 1000;

    // Totais de cada dia, somando só os tanques já povoados naquele dia.
    const totais = datas.map((data, indice) => {
        const presentes = porTanque.filter(({ serie }) => serie[indice]);
        const somar = (obterValor) => presentes.reduce((total, item) => total + obterValor(item), 0);
        const ganhoKg = somar(({ serie, ciclo }) => serie[indice].biomassaKg - biomassaInicial(ciclo));
        const quantidadeInicial = somar(({ ciclo }) => ciclo.quantidadeInicial);
        return {
            data,
            biomassaKg: somar(({ serie }) => serie[indice].biomassaKg),
            quantidade: somar(({ serie }) => serie[indice].quantidade),
            racaoDiaKg: somar(({ serie }) => serie[indice].racaoDiaKg),
            fca: ganhoKg > 0 ? somar(({ serie }) => serie[indice].racaoAcumuladaKg) / ganhoKg : null,
            taxaMortalidade: quantidadeInicial > 0 ? (somar(({ serie }) => serie[indice].mortalidadeAcumulada) / quantidadeInicial) * 100 : null,
        };
    });

    const pontas = porTanque
        .map(({ ciclo, serie }) => {
            const validos = serie.filter(Boolean);
            return validos.length > 0 ? { ciclo, inicio: validos[0], fim: validos.at(-1) } : null;
        })
        .filter(Boolean);
    const somarPontas = (obterValor) => pontas.reduce((total, ponta) => total + obterValor(ponta), 0);
    const biomassaInicio = somarPontas(({ inicio }) => inicio.biomassaKg);
    const biomassaFim = somarPontas(({ fim }) => fim.biomassaKg);
    const ganhoPeriodoKg = biomassaFim - biomassaInicio;
    const racaoPeriodoKg = somarPontas(({ inicio, fim }) => fim.racaoAcumuladaKg - inicio.racaoAcumuladaKg);
    const ganhoCicloKg = biomassaFim - somarPontas(({ ciclo }) => biomassaInicial(ciclo));
    const mortalidadeInicio = somarPontas(({ inicio }) => inicio.mortalidadeAcumulada);
    const mortalidadeFim = somarPontas(({ fim }) => fim.mortalidadeAcumulada);
    const quantidadeInicial = somarPontas(({ ciclo }) => ciclo.quantidadeInicial);
    const diasPeriodo = Math.max(datas.length - 1, 1);

    return {
        datas,
        porTanque,
        totais,
        biomassa: {
            atual: biomassaFim,
            variacao: ganhoPeriodoKg,
            percentual: biomassaInicio > 0 ? (ganhoPeriodoKg / biomassaInicio) * 100 : null,
        },
        peixes: { atual: somarPontas(({ fim }) => fim.quantidade), perdas: mortalidadeFim - mortalidadeInicio },
        // FCA do ciclo (geral) e do período: ração dividida pelo ganho de biomassa em cada intervalo.
        fca: {
            geral: ganhoCicloKg > 0 ? somarPontas(({ fim }) => fim.racaoAcumuladaKg) / ganhoCicloKg : null,
            periodo: ganhoPeriodoKg > 0 ? racaoPeriodoKg / ganhoPeriodoKg : null,
            racaoPeriodoKg,
            ganhoPeriodoKg,
        },
        mortalidade: {
            taxa: quantidadeInicial > 0 ? (mortalidadeFim / quantidadeInicial) * 100 : null,
            variacaoPontos: quantidadeInicial > 0 ? ((mortalidadeFim - mortalidadeInicio) / quantidadeInicial) * 100 : null,
        },
        racao: { total: racaoPeriodoKg, mediaPorDia: racaoPeriodoKg / diasPeriodo },
        diasPeriodo,
    };
}

// Totais do dashboard (seção 9.4), a partir de [{ ciclo, indicadores }] dos tanques com ciclo ativo.
export function calcularResumoProducao(itens) {
    const somarItens = (obterValor) => itens.reduce((total, item) => total + obterValor(item), 0);
    const quantidadeInicialTotal = somarItens((item) => item.ciclo.quantidadeInicial);
    return {
        tanquesAtivos: itens.length,
        totalPeixes: somarItens((item) => item.indicadores.quantidade),
        biomassaTotalKg: somarItens((item) => item.indicadores.biomassaKg),
        racaoAcumuladaKg: somarItens((item) => item.indicadores.racaoAcumuladaKg),
        // A média das taxas ponderada pela quantidade inicial de cada ciclo é a
        // soma das mortalidades dividida pela soma das quantidades iniciais.
        mortalidadeMedia: quantidadeInicialTotal > 0
            ? (somarItens((item) => item.indicadores.mortalidadeAcumulada) / quantidadeInicialTotal) * 100
            : null,
    };
}
