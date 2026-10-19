// Partes comuns a todas as páginas (seção 3.1): a navegação, os contadores do
// menu lateral, os lembretes de hoje, o lembrete de backup e o estado do uso offline. Fica em pages
// porque junta domínio, services e ui, o que só esta camada pode fazer.

import { diasEntre, hojeISO, paraDataLocalISO } from '../core/utils.js';
import { formatarGramas, formatarKg, formatarNumero, formatarPercentual, pluralizar } from '../core/format.js';
import { listarSituacoes } from '../domain/tanques.js';
import { analisarTanque } from '../domain/alertas.js';
import { obterLimitesPadrao, obterUltimoBackupEm } from '../domain/configuracoes.js';
import { alternarConclusao, listarAtrasados, listarOcorrencias } from '../domain/lembretes.js';
import { obterTabela } from '../domain/arracoamento.js';
import { calcularIndicadores, calcularRacaoSugerida } from '../domain/indicadores.js';
import { exportarBackup } from '../services/exportacao.js';
import { criarElemento, criarSelo } from '../ui/componentes.js';
import { iniciarNavegacao, montarUrl } from '../ui/nav.js';

// Passado esse prazo sem backup, o aviso do menu fica âmbar.
const DIAS_PARA_LEMBRAR_BACKUP = 7;
// O menu mostra poucos lembretes; o resto fica a um clique, na agenda.
const MAXIMO_LEMBRETES_MENU = 5;
// Disparado quando um lembrete é concluído no menu, para a agenda aberta se atualizar.
export const EVENTO_LEMBRETES = 'fishtrack:lembretes';

export function iniciarPagina() {
    iniciarNavegacao();
    document.getElementById('botao-backup-rapido')?.addEventListener('click', fazerBackupRapido);
    document.getElementById('lista-lembretes-hoje')?.addEventListener('change', concluirDoMenu);
    mostrarEstadoOffline();
    atualizarMenu();
}

// Biometria com mais de 30 dias deixa a ração sugerida desatualizada (seção 9.10).
export const DIAS_BIOMETRIA_ANTIGA = 30;

// Ração sugerida de um tanque com ciclo ativo, já em texto, para o registro,
// a página do tanque e a lista de tanques. Sem como calcular, traz o motivo.
export function descreverRacaoSugerida(situacao, hoje = hojeISO()) {
    const { tanque, cicloAtivo, registros } = situacao;
    const indicadores = calcularIndicadores({ tanque, ciclo: cicloAtivo, registros, hoje });
    const houvePesagem = registros.some((registro) => registro.pesoMedioG !== null && registro.pesoMedioG !== undefined);
    const { sugestao, motivo } = calcularRacaoSugerida({ indicadores, tabela: obterTabela(tanque.tabelaArracoamentoId), houvePesagem });
    const diasBiometria = diasEntre(indicadores.dataPesoAtual, hoje);
    const motivos = {
        'sem-tabela': 'Defina uma tabela de alimentação para este tanque.',
        'sem-biometria': 'Faça uma biometria para calcular a ração.',
        'fora-da-tabela': `Peso de ${formatarGramas(indicadores.pesoMedioG)} fora da tabela.`,
    };
    return {
        sugestao,
        motivo,
        textoMotivo: motivo ? motivos[motivo] : null,
        textoDia: sugestao ? `${formatarKg(sugestao.racaoDiaKg)} por dia` : null,
        textoDetalhe: sugestao
            ? `${pluralizar(sugestao.refeicoes, 'refeição', 'refeições')} de ${formatarKg(sugestao.racaoRefeicaoKg)} · `
                + `faixa ${formatarNumero(sugestao.faixa.pesoDeG)}–${formatarNumero(sugestao.faixa.pesoAteG)} g (${formatarPercentual(sugestao.faixa.taxaPct)})`
            : null,
        aviso: sugestao && diasBiometria > DIAS_BIOMETRIA_ANTIGA
            ? `Última biometria há ${diasBiometria} dias: a sugestão pode estar desatualizada.`
            : null,
    };
}

// Link de ação de cada alerta (seção 3.5): o próximo passo mais provável.
export function obterAcaoDoAlerta(alerta) {
    const tanque = (ancora) => montarUrl('tanque.html', { id: alerta.tanqueId }, ancora);
    switch (alerta.tipo) {
        case 'mortalidade-registro':
        case 'racao':
            return { texto: 'Ver registro', href: tanque('historico') };
        case 'mortalidade-acumulada':
            return { texto: 'Ver histórico', href: tanque('historico') };
        case 'capacidade':
            return { texto: 'Planejar despesca', href: montarUrl('ciclo-form.html', { tanqueId: alerta.tanqueId, acao: 'despesca' }) };
        case 'peso':
            return { texto: 'Ver evolução', href: tanque() };
        case 'sem-registro':
            return { texto: 'Registrar agora', href: montarUrl('registro.html', { tanqueId: alerta.tanqueId }) };
        default:
            return null;
    }
}

// Chamada também depois de ações que mudam tanques ou alertas na própria página.
export function atualizarMenu() {
    try {
        const hoje = hojeISO();
        const limitesPadrao = obterLimitesPadrao();
        const situacoes = listarSituacoes();
        const alertas = situacoes
            .filter((situacao) => situacao.cicloAtivo)
            .flatMap((situacao) => analisarTanque(situacao, { limitesPadrao, hoje }).alertas);
        definirContador('tanques', situacoes.length);
        definirContador('alertas', alertas.length);
        mostrarUltimoBackup(obterUltimoBackupEm(), hoje);
        mostrarLembretesDeHoje(hoje);
    } catch (erro) {
        // O menu não derruba a página: ela mesma mostra o erro de armazenamento.
        console.error(erro);
    }
}

function definirContador(nome, valor) {
    for (const contador of document.querySelectorAll(`[data-contador="${nome}"]`)) {
        contador.textContent = String(valor);
        contador.hidden = valor === 0;
    }
}

function mostrarUltimoBackup(ultimoBackupEm, hoje) {
    const aviso = document.getElementById('status-backup');
    if (!aviso) {
        return;
    }
    let texto = 'Nenhum backup feito ainda';
    let atrasado = true;
    if (ultimoBackupEm) {
        const dias = diasEntre(paraDataLocalISO(new Date(ultimoBackupEm)), hoje);
        texto = dias <= 0 ? 'Último backup hoje' : dias === 1 ? 'Último backup ontem' : `Último backup há ${pluralizar(dias, 'dia', 'dias')}`;
        atrasado = dias > DIAS_PARA_LEMBRAR_BACKUP;
    }
    aviso.textContent = texto;
    aviso.classList.toggle('cabecalho__backup--atrasado', atrasado);
}

// Seção 7.4: os de hoje e os atrasados, com conclusão direto no menu.
function mostrarLembretesDeHoje(hoje) {
    const lista = document.getElementById('lista-lembretes-hoje');
    if (!lista) {
        return;
    }
    const deHoje = listarOcorrencias({ inicio: hoje, fim: hoje, hoje });
    const atrasados = listarAtrasados({ hoje });
    const itens = [...atrasados.map((item) => ({ ...item, atrasado: true })), ...deHoje];
    const concluidos = deHoje.filter((item) => item.concluida).length;
    document.getElementById('contador-lembretes-hoje').textContent = deHoje.length > 0 ? `${concluidos} de ${deHoje.length}` : '';

    const visiveis = itens.slice(0, MAXIMO_LEMBRETES_MENU);
    lista.replaceChildren(...visiveis.map(criarItemDoMenu));
    if (itens.length === 0) {
        lista.append(criarElemento('li', { classe: 'lembretes-hoje__vazio', texto: 'Nada para hoje.' }));
    } else if (itens.length > visiveis.length) {
        lista.append(criarElemento('li', { classe: 'lembretes-hoje__vazio' }, [
            criarElemento('a', { classe: 'lembretes-hoje__link', texto: `e mais ${itens.length - visiveis.length} na agenda`, atributos: { href: 'calendario.html' } }),
        ]));
    }
}

function criarItemDoMenu(item) {
    const id = `menu-lembrete-${item.lembreteId}-${item.data}`;
    return criarElemento('li', { classe: `lembretes-hoje__item${item.concluida ? ' lembretes-hoje__item--concluido' : ''}` }, [
        criarElemento('input', {
            classe: 'lembretes-hoje__caixa',
            atributos: { type: 'checkbox', id, checked: item.concluida, 'data-concluir': item.lembreteId, 'data-ocorrencia': item.data },
        }),
        criarElemento('label', { classe: 'lembretes-hoje__texto', atributos: { for: id } }, [
            item.titulo,
            item.tanqueNome && criarElemento('span', { classe: 'lembretes-hoje__tanque', texto: item.tanqueNome }),
        ]),
        item.atrasado && criarSelo('Atrasado', 'atencao'),
    ]);
}

function concluirDoMenu(evento) {
    const caixa = evento.target.closest('[data-concluir]');
    if (!caixa) {
        return;
    }
    try {
        alternarConclusao(caixa.dataset.concluir, caixa.dataset.ocorrencia);
    } catch (erro) {
        console.error(erro);
    }
    atualizarMenu();
    document.dispatchEvent(new CustomEvent(EVENTO_LEMBRETES));
}

function fazerBackupRapido() {
    try {
        exportarBackup();
        atualizarMenu();
    } catch (erro) {
        document.getElementById('status-backup').textContent = erro.message;
    }
}

function mostrarEstadoOffline() {
    const estado = document.getElementById('status-offline');
    if (!estado) {
        return;
    }
    const atualizar = () => {
        const pronto = Boolean(navigator.serviceWorker?.controller);
        estado.classList.toggle('cabecalho__status--pronto', pronto);
        if (pronto) {
            estado.textContent = 'Pronto para uso offline';
        } else if ('serviceWorker' in navigator && window.isSecureContext) {
            estado.textContent = 'Preparando o uso offline…';
        } else {
            estado.textContent = 'Uso offline indisponível neste endereço';
        }
    };
    atualizar();
    navigator.serviceWorker?.addEventListener('controllerchange', atualizar);
}
