// Termos técnicos com uma frase de ajuda e um exemplo (seção 11.6). Os textos
// ficam juntos aqui para a mesma explicação valer em todas as telas.

export const GLOSSARIO = Object.freeze({
    biomassa: { termo: 'Biomassa', explicacao: 'Peso total de todos os peixes do tanque.', exemplo: '2.000 peixes de 500 g = 1.000 kg' },
    fca: { termo: 'FCA', explicacao: 'Conversão alimentar: quantos kg de ração foram usados para produzir 1 kg de peixe. Quanto menor, melhor.', exemplo: '1,5 = 1,5 kg de ração por kg de peixe' },
    biometria: { termo: 'Biometria', explicacao: 'Pesar uma amostra de peixes para saber o peso médio.', exemplo: '50 peixes pesando 25 kg = 500 g cada' },
    capacidade: { termo: 'Capacidade', explicacao: 'Quanto de peixe o tanque aguenta, comparado ao limite que você definiu.', exemplo: '900 kg de 1.200 kg = 75%' },
    mortalidadeObservada: { termo: 'Mortalidade observada', explicacao: 'Mortos que foram encontrados. A real só se sabe na despesca.', exemplo: null },
    densidade: { termo: 'Densidade', explicacao: 'Quilos de peixe por m³ de água.', exemplo: '900 kg em 300 m³ = 3 kg/m³' },
    tce: { termo: 'TCE', explicacao: 'Taxa de crescimento específico: a velocidade de crescimento em % por dia (usada em pesquisa).', exemplo: '2%/dia' },
    pp: { termo: 'p.p.', explicacao: 'Pontos percentuais: a diferença entre duas porcentagens.', exemplo: 'de 1% para 2% = +1 p.p.' },
});
