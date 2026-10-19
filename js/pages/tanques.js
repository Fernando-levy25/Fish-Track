// Lista de tanques com filtro por status (seção 7.2).

import { hojeISO } from '../core/utils.js';
import { formatarData, formatarInteiro, formatarKg } from '../core/format.js';
import { listarSituacoes, listarTanques, ROTULOS_STATUS } from '../domain/tanques.js';
import { calcularIndicadores } from '../domain/indicadores.js';
import { resolverLimites } from '../domain/alertas.js';
import { obterLimitesPadrao } from '../domain/configuracoes.js';
import { lerParametro, montarUrl } from '../ui/nav.js';
import { criarBarraCapacidade, criarCartaoTanque, criarElemento, mostrarErroPagina } from '../ui/componentes.js';
import { descreverRacaoSugerida, iniciarPagina } from './comum.js';

const filtro = document.getElementById('filtro-status');
const grade = document.getElementById('grade-tanques');

iniciarPagina();
try {
    iniciar();
} catch (erro) {
    mostrarErroPagina(erro);
}

function iniciar() {
    const statusDoEndereco = lerParametro('status');
    if ([...filtro.options].some((opcao) => opcao.value === statusDoEndereco)) {
        filtro.value = statusDoEndereco;
    }
    filtro.addEventListener('change', () => {
        // O filtro fica no endereço para que, ao voltar de um tanque, a lista continue filtrada.
        history.replaceState(null, '', montarUrl('tanques.html', { status: filtro.value }));
        renderizar();
    });
    renderizar();
}

function renderizar() {
    const status = filtro.value;
    const hoje = hojeISO();
    // Sem filtro, a lista mostra todos menos os arquivados, que têm opção própria.
    const situacoes = listarSituacoes({ incluirArquivados: status === 'arquivado' })
        .filter((situacao) => !status || situacao.tanque.status === status);
    if (situacoes.length === 0) {
        grade.replaceChildren(criarAvisoVazio());
        return;
    }
    const limitesPadrao = obterLimitesPadrao();
    grade.replaceChildren(...situacoes.map((situacao) => criarCartao(situacao, hoje, limitesPadrao)));
}

function criarCartao({ tanque, cicloAtivo, registros, ultimoRegistro }, hoje, limitesPadrao) {
    const indicadores = cicloAtivo ? calcularIndicadores({ tanque, ciclo: cicloAtivo, registros, hoje }) : null;
    return criarCartaoTanque({
        nome: tanque.nome,
        especie: tanque.especie,
        selo: { texto: ROTULOS_STATUS[tanque.status], variante: tanque.status },
        metricas: [
            { rotulo: 'Peixes (estimado)', valor: formatarInteiro(indicadores?.quantidade) },
            { rotulo: 'Biomassa (estimada)', valor: formatarKg(indicadores?.biomassaKg) },
            { rotulo: 'Último registro', valor: formatarData(ultimoRegistro?.data) },
            cicloAtivo && { rotulo: 'Ração sugerida', valor: descreverRacaoSugerida({ tanque, cicloAtivo, registros }, hoje).textoDia ?? '—' },
        ].filter(Boolean),
        extra: criarBarra(tanque, indicadores, limitesPadrao),
        acoes: [
            { texto: 'Ver detalhes', href: montarUrl('tanque.html', { id: tanque.id }) },
            { texto: 'Editar', href: montarUrl('tanque-form.html', { id: tanque.id }) },
        ],
    });
}

// Com peixes, a barra mostra a carga; sem peixes, só aparece para pedir que
// a capacidade seja definida, se ainda não foi.
function criarBarra(tanque, indicadores, limitesPadrao) {
    if (!indicadores && (tanque.densidadeMaximaKgM3 || tanque.status === 'arquivado')) {
        return null;
    }
    return criarBarraCapacidade({
        percentual: indicadores?.capacidadeUtilizada ?? null,
        cargaKg: indicadores?.biomassaKg,
        cargaMaximaKg: indicadores?.cargaMaximaKg,
        limiteAlerta: resolverLimites(limitesPadrao, tanque.limitesAlerta).capacidadePct,
        compacta: true,
        hrefDefinir: montarUrl('tanque-form.html', { id: tanque.id }),
    });
}

function criarAvisoVazio() {
    if (listarTanques({ incluirArquivados: true }).length === 0) {
        return criarElemento('p', { classe: 'grade-tanques__vazio' }, [
            'Nenhum tanque cadastrado ainda. ',
            criarElemento('a', { classe: 'link', texto: 'Cadastrar o primeiro tanque', atributos: { href: 'tanque-form.html' } }),
        ]);
    }
    return criarElemento('p', { classe: 'grade-tanques__vazio', texto: 'Nenhum tanque com o status escolhido.' });
}
