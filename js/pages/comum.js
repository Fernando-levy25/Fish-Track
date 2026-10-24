// Partes comuns a todas as páginas (seção 3.1): a navegação, os contadores do
// menu lateral (inclusive os lembretes pendentes na Agenda), o lembrete de backup e o estado do uso offline. Fica em pages
// porque junta domínio, services e ui, o que só esta camada pode fazer.

import { diasEntre, hojeISO, paraDataLocalISO } from '../core/utils.js';
import {
    definirUnidadesExibicao,
    formatarGramas,
    formatarNumero,
    formatarPercentual,
    formatarRacao,
    pluralizar,
} from '../core/format.js';
import { listarSituacoes } from '../domain/tanques.js';
import { analisarTanque } from '../domain/alertas.js';
import { obterLimitesPadrao, obterUltimoBackupEm, obterUnidades } from '../domain/configuracoes.js';
import { listarAtrasados, listarOcorrencias } from '../domain/lembretes.js';
import { obterTabela } from '../domain/arracoamento.js';
import { calcularIndicadores, calcularProximaBiometria, calcularRacaoSugerida } from '../domain/indicadores.js';
import { exportarBackup } from '../services/exportacao.js';
import { iniciarNavegacao, montarUrl } from '../ui/nav.js';

// Passado esse prazo sem backup, o aviso do menu fica âmbar.
const DIAS_PARA_LEMBRAR_BACKUP = 7;
// Disparado quando um lembrete muda fora da agenda (na tela "Hoje"), para ela se atualizar.
export const EVENTO_LEMBRETES = 'fishtrack:lembretes';

export function iniciarPagina() {
    // Unidades de exibição (config.unidades) valem para toda a página.
    try {
        definirUnidadesExibicao(obterUnidades());
    } catch (erro) {
        console.error(erro);
    }
    iniciarNavegacao();
    document.getElementById('botao-backup-rapido')?.addEventListener('click', fazerBackupRapido);
    mostrarEstadoOffline();
    atualizarMenu();
}

// Ração sugerida de um tanque com ciclo ativo, já em texto, para o registro,
// a página do tanque, a lista e a Folha do dia (seção 9.10). Sem como
// calcular, traz o motivo e a ação que resolve (nunca um traço sem motivo).
export function descreverRacaoSugerida(situacao, hoje = hojeISO()) {
    const { tanque, cicloAtivo, registros } = situacao;
    const indicadores = calcularIndicadores({ tanque, ciclo: cicloAtivo, registros, hoje });
    const houvePesagem = registros.some((registro) => registro.pesoMedioG !== null && registro.pesoMedioG !== undefined);
    const plano = obterTabela(tanque.tabelaArracoamentoId);
    const { sugestao, motivo } = calcularRacaoSugerida({ indicadores, tabela: plano, houvePesagem });
    const biometria = calcularProximaBiometria({ tanque, ciclo: cicloAtivo, registros, hoje });
    const urlPlano = montarUrl('tanque-form.html', { id: tanque.id }, 'alimentacao');
    const motivos = {
        'sem-tabela': { texto: 'Sem plano de alimentação', acao: { texto: 'Configurar', href: urlPlano } },
        'sem-biometria': { texto: 'Falta a primeira biometria', acao: { texto: 'Fazer biometria', href: montarUrl('tanque.html', { id: tanque.id, acao: 'biometria' }) } },
        'fora-da-tabela': { texto: `Peso de ${formatarGramas(indicadores.pesoMedioG)} fora do plano`, acao: { texto: 'Ajustar plano', href: urlPlano } },
    };
    const detalheTaxa = sugestao?.faixa
        ? `faixa ${formatarNumero(sugestao.faixa.pesoDeG)}–${formatarNumero(sugestao.faixa.pesoAteG)} g (${formatarPercentual(sugestao.taxaPct)})`
        : sugestao ? `${formatarPercentual(sugestao.taxaPct)} do peso total por dia` : '';
    return {
        sugestao,
        motivo,
        plano,
        textoMotivo: motivo ? motivos[motivo].texto : null,
        acaoMotivo: motivo ? motivos[motivo].acao : null,
        textoDia: sugestao ? `${formatarRacao(sugestao.racaoDiaKg)} por dia` : null,
        textoDetalhe: sugestao
            ? `${pluralizar(sugestao.refeicoes, 'refeição', 'refeições')} de ${formatarRacao(sugestao.racaoRefeicaoKg)} · ${detalheTaxa}`
            : null,
        // A sugestão usa o peso da última biometria: atrasada, ela envelhece (seção 9.11).
        aviso: sugestao && biometria.diasAtraso > 0 && plano?.tipo !== 'fixo'
            ? `Biometria atrasada há ${pluralizar(biometria.diasAtraso, 'dia', 'dias')}: a sugestão pode estar desatualizada.`
            : null,
    };
}

// Ação de cada alerta (seção 3.5), com os nomes padronizados da seção 11.6:
// o próximo passo mais provável.
export function obterAcaoDoAlerta(alerta) {
    const tanque = (ancora) => montarUrl('tanque.html', { id: alerta.tanqueId }, ancora);
    switch (alerta.tipo) {
        case 'mortalidade-registro':
        case 'racao':
        case 'mortalidade-acumulada':
        case 'peso':
            return { texto: 'Ver tanque', icone: 'seta', href: tanque() };
        case 'capacidade':
            return { texto: 'Planejar despesca', icone: 'rede', href: montarUrl('ciclo-form.html', { tanqueId: alerta.tanqueId, acao: 'despesca' }) };
        case 'biometria-atrasada':
            return { texto: 'Fazer biometria', icone: 'balanca', href: montarUrl('tanque.html', { id: alerta.tanqueId, acao: 'biometria' }) };
        case 'sem-registro':
            return { texto: 'Anotar', icone: 'lapis', href: montarUrl('folha.html', { tanque: alerta.tanqueId }) };
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
        // Os lembretes de hoje ficam na tela "Hoje"; nas outras, o contador da Agenda lembra deles.
        const pendentes = listarOcorrencias({ inicio: hoje, fim: hoje, hoje }).filter((item) => !item.concluida).length
            + listarAtrasados({ hoje }).length;
        definirContador('lembretes', pendentes);
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
