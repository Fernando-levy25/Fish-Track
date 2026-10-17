// Cadastro e edição de tanque (seção 7.4). Endereço: tanque-form.html para
// um tanque novo, tanque-form.html?id=... para editar.

import { paraNumero } from '../core/utils.js';
import { obterSituacao, salvarTanque } from '../domain/tanques.js';
import { iniciarNavegacao, irPara, lerParametro, montarUrl } from '../ui/nav.js';
import { iniciarFormulario, mostrarErroPagina, preencherFormulario } from '../ui/componentes.js';

const tanqueId = lerParametro('id');
const formulario = document.getElementById('formulario-tanque');

iniciarNavegacao();
try {
    iniciar();
} catch (erro) {
    mostrarErroPagina(erro);
}

function iniciar() {
    if (tanqueId) {
        const situacao = obterSituacao(tanqueId);
        if (!situacao) {
            document.getElementById('aviso-tanque-nao-encontrado').hidden = false;
            document.getElementById('secao-formulario-tanque').hidden = true;
            return;
        }
        prepararEdicao(situacao);
    }
    iniciarFormulario(formulario, {
        erroGeral: document.getElementById('erro-geral-tanque'),
        aoEnviar: (valores) => {
            const tanque = salvarTanque({
                id: valores.id || null,
                nome: valores.nome,
                especie: valores.especie,
                volumeM3: paraNumero(valores.volumeM3),
                capacidade: paraNumero(valores.capacidade),
                manutencao: Boolean(valores.manutencao),
                observacoes: valores.observacoes,
            });
            irPara(montarUrl('tanque.html', { id: tanque.id }));
        },
    });
}

function prepararEdicao({ tanque, cicloAtivo }) {
    document.title = `Fish Track - Editar ${tanque.nome}`;
    document.getElementById('titulo-formulario-tanque').textContent = 'Editar tanque';
    document.getElementById('link-cancelar-tanque').href = montarUrl('tanque.html', { id: tanque.id });
    preencherFormulario(formulario, {
        id: tanque.id,
        nome: tanque.nome,
        especie: tanque.especie,
        volumeM3: tanque.volumeM3,
        capacidade: tanque.capacidade,
        manutencao: tanque.status === 'manutencao',
        observacoes: tanque.observacoes,
    });

    const manutencao = document.getElementById('campo-manutencao');
    if (tanque.status === 'arquivado') {
        // O arquivamento se desfaz na página do tanque; aqui o status não muda.
        manutencao.parentElement.hidden = true;
    } else if (cicloAtivo) {
        // RN03: com ciclo ativo, o status é sempre "ativo".
        manutencao.disabled = true;
        document.getElementById('ajuda-manutencao').textContent = 'Indisponível enquanto houver ciclo ativo: o status do tanque é "Ativo".';
    }
}
