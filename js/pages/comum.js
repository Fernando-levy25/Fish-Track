// Partes comuns a todas as páginas (seção 3.1): a navegação, os contadores do
// menu lateral, o lembrete de backup e o estado do uso offline. Fica em pages
// porque junta domínio, services e ui, o que só esta camada pode fazer.

import { diasEntre, hojeISO, paraDataLocalISO } from '../core/utils.js';
import { pluralizar } from '../core/format.js';
import { listarSituacoes } from '../domain/tanques.js';
import { analisarTanque } from '../domain/alertas.js';
import { obterLimitesPadrao, obterUltimoBackupEm } from '../domain/configuracoes.js';
import { exportarBackup } from '../services/exportacao.js';
import { iniciarNavegacao, montarUrl } from '../ui/nav.js';

// Passado esse prazo sem backup, o aviso do menu fica âmbar.
const DIAS_PARA_LEMBRAR_BACKUP = 7;

export function iniciarPagina() {
    iniciarNavegacao();
    document.getElementById('botao-backup-rapido')?.addEventListener('click', fazerBackupRapido);
    mostrarEstadoOffline();
    atualizarMenu();
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
