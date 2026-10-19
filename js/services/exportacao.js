// Exportação CSV, backup/restauração em JSON (seção 9.7) e imagem PNG dos
// gráficos (seção 9.9). O DOM só é usado para disparar o download e, no PNG,
// para desenhar o gráfico num canvas (seção 10).

import { lerDados, salvarDados, validarEstrutura } from '../core/storage.js';
import { agoraISO, compararTexto, criarSlug, hojeISO } from '../core/utils.js';
import { formatarData } from '../core/format.js';
import { ordenarRegistros } from '../domain/indicadores.js';
import { falharRegra } from '../domain/validacao.js';

// Separador ";" e vírgula decimal: é o que o Excel em português espera.
const SEPARADOR = ';';
const COLUNAS_REGISTROS = [
    ['Tanque', ({ tanque }) => texto(tanque.nome)],
    ['Espécie', ({ tanque }) => texto(tanque.especie)],
    ['Ciclo (povoamento)', ({ ciclo }) => formatarData(ciclo.dataInicio)],
    ['Data', ({ registro }) => formatarData(registro.data)],
    ['Peso médio (g)', ({ registro }) => numero(registro.pesoMedioG)],
    ['Ração (kg)', ({ registro }) => numero(registro.racaoKg)],
    ['Mortos encontrados', ({ registro }) => numero(registro.mortalidade)],
    ['Natalidade', ({ registro }) => numero(registro.natalidade)],
    ['Observações', ({ registro }) => texto(registro.observacoes)],
];
// Uma linha por lembrete (não por ocorrência): as datas concluídas vão juntas.
const COLUNAS_LEMBRETES = [
    ['Título', ({ lembrete }) => texto(lembrete.titulo)],
    ['Tanque', ({ tanque }) => (tanque ? texto(tanque.nome) : 'Geral')],
    ['Data', ({ lembrete }) => formatarData(lembrete.data)],
    ['Repetir', ({ lembrete }) => (lembrete.repetirDias ? `A cada ${lembrete.repetirDias} dias` : 'Não repete')],
    ['Concluído em', ({ lembrete }) => lembrete.concluidas.map(formatarData).join(', ')],
    ['Observação', ({ lembrete }) => texto(lembrete.observacao)],
];

function numero(valor) {
    return valor === null || valor === undefined ? '' : String(valor).replace('.', ',');
}

function texto(valor) {
    // Um texto que começa com =, +, - ou @ seria lido pelo Excel como fórmula.
    return /^[=+\-@]/.test(valor) ? `'${valor}` : valor;
}

function celula(valor) {
    const conteudo = String(valor ?? '');
    return /[";\r\n]/.test(conteudo) ? `"${conteudo.replaceAll('"', '""')}"` : conteudo;
}

export function gerarCsvRegistros({ tanqueId = null } = {}) {
    const dados = lerDados();
    const tanques = new Map(dados.tanques.map((tanque) => [tanque.id, tanque]));
    const ciclos = new Map(dados.ciclos.map((ciclo) => [ciclo.id, ciclo]));
    const linhas = ordenarRegistros(dados.registros.filter((registro) => !tanqueId || registro.tanqueId === tanqueId))
        .map((registro) => ({ registro, tanque: tanques.get(registro.tanqueId), ciclo: ciclos.get(registro.cicloId) }))
        .filter((linha) => linha.tanque && linha.ciclo)
        .sort((a, b) => compararTexto(a.tanque.nome, b.tanque.nome));

    return montarCsv(COLUNAS_REGISTROS, linhas);
}

export function gerarCsvLembretes({ tanqueId = null } = {}) {
    const dados = lerDados();
    const tanques = new Map(dados.tanques.map((tanque) => [tanque.id, tanque]));
    const linhas = dados.lembretes
        .filter((lembrete) => !tanqueId || lembrete.tanqueId === tanqueId)
        .map((lembrete) => ({ lembrete, tanque: tanques.get(lembrete.tanqueId) ?? null }))
        .sort((a, b) => a.lembrete.data.localeCompare(b.lembrete.data) || compararTexto(a.lembrete.titulo, b.lembrete.titulo));
    return montarCsv(COLUNAS_LEMBRETES, linhas);
}

function montarCsv(colunas, linhas) {
    const cabecalho = colunas.map(([titulo]) => celula(titulo)).join(SEPARADOR);
    const corpo = linhas.map((linha) => colunas.map(([, valor]) => celula(valor(linha))).join(SEPARADOR));
    // O BOM no início faz o Excel ler o arquivo como UTF-8 e manter os acentos.
    return { conteudo: `﻿${[cabecalho, ...corpo].join('\r\n')}\r\n`, quantidade: linhas.length };
}

export function exportarCsv({ tanqueId = null } = {}) {
    return baixarCsv(gerarCsvRegistros({ tanqueId }), tanqueId, 'registros');
}

export function exportarCsvLembretes({ tanqueId = null } = {}) {
    return baixarCsv(gerarCsvLembretes({ tanqueId }), tanqueId, 'lembretes');
}

function baixarCsv({ conteudo, quantidade }, tanqueId, assunto) {
    if (quantidade === 0) {
        return { quantidade, arquivo: null };
    }
    const tanque = tanqueId ? lerDados().tanques.find((item) => item.id === tanqueId) : null;
    const arquivo = `fish-track-${assunto}${tanque ? `-${criarSlug(tanque.nome)}` : ''}-${hojeISO()}.csv`;
    baixarArquivo(arquivo, conteudo, 'text/csv;charset=utf-8');
    return { quantidade, arquivo };
}

// Marca a data do backup, que o menu usa para lembrar o produtor de fazer
// outro (seção 3.1), e devolve o conteúdo do arquivo.
export function prepararBackup() {
    const dados = lerDados();
    dados.config.ultimoBackupEm = agoraISO();
    salvarDados(dados);
    return { conteudo: JSON.stringify(dados, null, 2), dados };
}

export function exportarBackup() {
    const { conteudo, dados } = prepararBackup();
    const arquivo = `fish-track-backup-${hojeISO()}.json`;
    baixarArquivo(arquivo, conteudo, 'application/json');
    return { arquivo, dados };
}

// Lê e valida um arquivo de backup sem aplicar nada: a página confirma antes.
// Arquivo errado é engano do produtor, não falha do sistema: vira ErroValidacao.
export async function lerBackup(arquivo) {
    let dados;
    try {
        dados = JSON.parse(await arquivo.text());
    } catch {
        falharRegra('Este arquivo não é um backup do Fish Track: o conteúdo não é um JSON válido.');
    }
    try {
        return validarEstrutura(dados);
    } catch (erro) {
        return falharRegra(erro.message);
    }
}

export function restaurarBackup(dados) {
    salvarDados(dados);
}

// ---------- Imagem dos gráficos ----------

// Propriedades que o CSS dá ao gráfico. Fora da página, o SVG vira imagem sem
// as folhas de estilo, então cada elemento leva os valores calculados.
const ESTILOS_DO_GRAFICO = [
    'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
    'stroke-opacity', 'opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline',
    'visibility', 'display',
];
const ESCALA_PNG = 2;
const MARGEM_PNG = 24;

// SVG → Image → canvas → PNG, com fundo branco, título e legenda, em 2× (seção 9.9).
// legenda: [{ nome, cor }], para gráficos com uma linha por tanque.
export async function exportarGraficoPng(svg, nomeArquivo, { titulo = '', subtitulo = '', legenda = [] } = {}) {
    const { width: largura, height: altura } = svg.getBoundingClientRect();
    const imagem = await carregarImagem(serializarComEstilos(svg, largura, altura));

    const fonte = getComputedStyle(svg).fontFamily;
    const alturaTitulo = titulo ? 28 : 0;
    const alturaSubtitulo = subtitulo ? 22 : 0;
    const alturaLegenda = legenda.length > 0 ? 26 : 0;
    const topoGrafico = MARGEM_PNG + alturaTitulo + alturaSubtitulo + alturaLegenda + (titulo || subtitulo || legenda.length ? 12 : 0);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round((largura + MARGEM_PNG * 2) * ESCALA_PNG);
    canvas.height = Math.round((topoGrafico + altura + MARGEM_PNG) * ESCALA_PNG);
    const contexto = canvas.getContext('2d');
    contexto.scale(ESCALA_PNG, ESCALA_PNG);
    contexto.fillStyle = '#ffffff';
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.textBaseline = 'top';

    let y = MARGEM_PNG;
    if (titulo) {
        contexto.fillStyle = '#1b2421';
        contexto.font = `600 18px ${fonte}`;
        contexto.fillText(titulo, MARGEM_PNG, y);
        y += alturaTitulo;
    }
    if (subtitulo) {
        contexto.fillStyle = '#5a6561';
        contexto.font = `400 13px ${fonte}`;
        contexto.fillText(subtitulo, MARGEM_PNG, y);
        y += alturaSubtitulo;
    }
    let x = MARGEM_PNG;
    contexto.font = `600 13px ${fonte}`;
    for (const { nome, cor } of legenda) {
        contexto.fillStyle = cor;
        contexto.beginPath();
        contexto.arc(x + 5, y + 8, 5, 0, Math.PI * 2);
        contexto.fill();
        contexto.fillStyle = '#1b2421';
        contexto.fillText(nome, x + 16, y + 1);
        x += 16 + contexto.measureText(nome).width + 20;
    }
    contexto.drawImage(imagem, MARGEM_PNG, topoGrafico, largura, altura);

    const conteudo = await new Promise((resolver) => canvas.toBlob(resolver, 'image/png'));
    const arquivo = `${nomeArquivo}.png`;
    baixarArquivo(arquivo, conteudo, 'image/png');
    return arquivo;
}

function serializarComEstilos(svg, largura, altura) {
    const copia = svg.cloneNode(true);
    const originais = [svg, ...svg.querySelectorAll('*')];
    const copias = [copia, ...copia.querySelectorAll('*')];
    originais.forEach((original, indice) => {
        const estilo = getComputedStyle(original);
        copias[indice].setAttribute('style', ESTILOS_DO_GRAFICO.map((nome) => `${nome}:${estilo.getPropertyValue(nome)}`).join(';'));
    });
    // A imagem final é estática: sem animação, recorte de entrada nem dica.
    copia.querySelectorAll('title, .grafico-dica').forEach((elemento) => elemento.remove());
    copia.setAttribute('width', largura);
    copia.setAttribute('height', altura);
    copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return new XMLSerializer().serializeToString(copia);
}

function carregarImagem(conteudoSvg) {
    const url = URL.createObjectURL(new Blob([conteudoSvg], { type: 'image/svg+xml;charset=utf-8' }));
    return new Promise((resolver, rejeitar) => {
        const imagem = new Image();
        imagem.onload = () => {
            URL.revokeObjectURL(url);
            resolver(imagem);
        };
        imagem.onerror = () => {
            URL.revokeObjectURL(url);
            rejeitar(new Error('Não foi possível gerar a imagem do gráfico.'));
        };
        imagem.src = url;
    });
}

// ---------- Download ----------

function baixarArquivo(nome, conteudo, tipo) {
    const url = URL.createObjectURL(conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo }));
    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    document.body.append(link);
    link.click();
    link.remove();
    // O navegador ainda precisa da URL logo após o clique para iniciar o download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
