// Dashboard (seção 7.1): totais da produção, alertas mais recentes e um cartão
// por tanque com ciclo ativo.

import { hojeISO } from '../core/utils.js';
import { formatarFca, formatarInteiro, formatarKg, formatarPercentual } from '../core/format.js';
import { listarSituacoes } from '../domain/tanques.js';
import { calcularResumoProducao } from '../domain/indicadores.js';
import { analisarTanque, gravidadeMaisAlta, ordenarAlertas, resolverLimites } from '../domain/alertas.js';
import { obterLimitesPadrao } from '../domain/configuracoes.js';
import { iniciarNavegacao, montarUrl } from '../ui/nav.js';
import { criarBarraCapacidade, criarCartaoTanque, criarElemento, mostrarErroPagina, preencherIndicadores, renderizarAlertas } from '../ui/componentes.js';

const MAXIMO_ALERTAS = 5;
const SELOS_GRAVIDADE = {
    alta: { texto: 'Alerta alto', variante: 'alerta-alta' },
    media: { texto: 'Alerta médio', variante: 'alerta-media' },
    baixa: { texto: 'Alerta baixo', variante: 'alerta-baixa' },
};

iniciarNavegacao();
try {
    renderizar();
} catch (erro) {
    mostrarErroPagina(erro);
}

function renderizar() {
    const hoje = hojeISO();
    const limitesPadrao = obterLimitesPadrao();
    const situacoes = listarSituacoes();
    const ativos = situacoes
        .filter((situacao) => situacao.cicloAtivo)
        .map((situacao) => ({ ...situacao, ...analisarTanque(situacao, { limitesPadrao, hoje }) }));

    // Os totais somam só os tanques com ciclo ativo (seção 9.4).
    const resumo = calcularResumoProducao(ativos.map(({ cicloAtivo, indicadores }) => ({ ciclo: cicloAtivo, indicadores })));
    preencherIndicadores(document, {
        tanquesAtivos: formatarInteiro(resumo.tanquesAtivos),
        totalPeixes: formatarInteiro(resumo.totalPeixes),
        biomassaTotal: formatarKg(resumo.biomassaTotalKg),
        racaoAcumulada: formatarKg(resumo.racaoAcumuladaKg),
        mortalidadeMedia: formatarPercentual(resumo.mortalidadeMedia),
    });

    renderizarAlertas(
        document.getElementById('lista-alertas'),
        ordenarAlertas(ativos.flatMap((item) => item.alertas)).slice(0, MAXIMO_ALERTAS),
        {
            mostrarTanque: true,
            hrefTanque: (alerta) => montarUrl('tanque.html', { id: alerta.tanqueId }),
            textoVazio: 'Nenhum alerta no momento.',
        },
    );

    const grade = document.getElementById('grade-tanques');
    if (ativos.length === 0) {
        grade.replaceChildren(criarAvisoSemTanques(situacoes.length));
        return;
    }
    grade.replaceChildren(...ativos.map((item) => criarCartao(item, limitesPadrao)));
}

function criarCartao({ tanque, indicadores, alertas }, limitesPadrao) {
    const gravidade = gravidadeMaisAlta(alertas);
    return criarCartaoTanque({
        nome: tanque.nome,
        nivelTitulo: 3,
        especie: tanque.especie,
        // Todos aqui estão ativos: o selo mostra a saúde do tanque, pelo alerta mais grave.
        selo: gravidade ? SELOS_GRAVIDADE[gravidade] : { texto: 'Sem alertas', variante: 'sem-alerta' },
        metricas: [
            { rotulo: 'Peixes', valor: formatarInteiro(indicadores.quantidade) },
            { rotulo: 'Biomassa', valor: formatarKg(indicadores.biomassaKg) },
            { rotulo: 'Conversão', valor: formatarFca(indicadores.fca) },
        ],
        extra: criarBarraCapacidade({
            percentual: indicadores.capacidadeUtilizada,
            cargaKg: indicadores.biomassaKg,
            cargaMaximaKg: indicadores.cargaMaximaKg,
            limiteAlerta: resolverLimites(limitesPadrao, tanque.limitesAlerta).capacidadePct,
            compacta: true,
            hrefDefinir: montarUrl('tanque-form.html', { id: tanque.id }),
        }),
        acoes: [
            { texto: 'Ver detalhes', href: montarUrl('tanque.html', { id: tanque.id }) },
            { texto: 'Novo registro', href: montarUrl('registro.html', { tanqueId: tanque.id }) },
        ],
    });
}

function criarAvisoSemTanques(totalTanques) {
    if (totalTanques === 0) {
        return criarElemento('p', { classe: 'grade-tanques__vazio' }, [
            'Nenhum tanque cadastrado ainda. ',
            criarElemento('a', { classe: 'link', texto: 'Cadastrar o primeiro tanque', atributos: { href: 'tanque-form.html' } }),
            ' ou ',
            criarElemento('a', { classe: 'link', texto: 'carregar dados de exemplo', atributos: { href: 'configuracoes.html' } }),
            '.',
        ]);
    }
    return criarElemento('p', { classe: 'grade-tanques__vazio' }, [
        'Nenhum tanque com ciclo ativo no momento. ',
        criarElemento('a', { classe: 'link', texto: 'Ver os tanques', atributos: { href: 'tanques.html' } }),
    ]);
}
