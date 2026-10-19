import type {
  EstatisticaDezenaDto,
  LoteriaDto,
  ResultadoDto,
  ResumoAnoDto,
} from '@sorteios/contratos';
import type {
  Concurso,
  EstatisticaDezena,
  LoteriaDefinicao,
  ResumoAno,
} from '@sorteios/core';

/** Valores monetários do core são BigInt em centavos; os DTOs expõem number. */
const paraNumero = (valor: bigint): number => Number(valor);

export function paraLoteriaDto(def: LoteriaDefinicao): LoteriaDto {
  return {
    id: def.id,
    nome: def.nome,
    cor: def.cor,
    universo: def.universo,
    primeiraDezena: def.primeiraDezena,
    sorteadas: def.sorteadas,
    aposta: { min: def.aposta.min, max: def.aposta.max },
    volante: { colunas: def.volante.colunas, linhas: def.volante.linhas },
    quadrantes: def.quadrantes,
    faixas: def.faixas.map((f) => ({
      faixa: f.faixa,
      acertos: f.acertos,
      nome: f.nome,
    })),
    diasSorteio: [...def.diasSorteio],
    regrasDisponiveis: [...def.regrasDisponiveis],
  };
}

export function paraResultadoDto(c: Concurso): ResultadoDto {
  return {
    numero: c.numero,
    data: c.data,
    dezenas: [...c.dezenas],
    acumulou: c.acumulou,
    premiacoes: c.premiacoes.map((p) => ({
      faixa: p.faixa,
      ganhadores: p.ganhadores,
      rateioCentavos: paraNumero(p.rateioCentavos),
    })),
    valorAcumuladoCentavos: paraNumero(c.valorAcumuladoCentavos),
    estimativaProximoCentavos: paraNumero(c.estimativaProximoCentavos),
    arrecadacaoCentavos: paraNumero(c.arrecadacaoCentavos),
    acumuladoEspecialCentavos: paraNumero(c.acumuladoEspecialCentavos),
    ...(c.proximoNumero !== undefined && { proximoNumero: c.proximoNumero }),
    ...(c.dataProximoSorteio !== undefined && {
      dataProximoSorteio: c.dataProximoSorteio,
    }),
    ...(c.observacao !== undefined && { observacao: c.observacao }),
    locaisGanhadores: c.locaisGanhadores.map((l) => ({
      ...(l.cidade !== undefined && { cidade: l.cidade }),
      ...(l.uf !== undefined && { uf: l.uf }),
      descricao: l.descricao,
      quantidade: l.quantidade,
    })),
  };
}

export function paraEstatisticaDezenaDto(
  e: EstatisticaDezena,
): EstatisticaDezenaDto {
  return {
    dezena: e.dezena,
    frequencia: e.frequencia,
    atraso: e.atraso,
    atrasoMaximo: e.atrasoMaximo,
    ...(e.ultimoConcurso !== undefined && { ultimoConcurso: e.ultimoConcurso }),
    ...(e.ultimaData !== undefined && { ultimaData: e.ultimaData }),
    probAusencia: e.probAusencia,
  };
}

export function paraResumoAnoDto(r: ResumoAno): ResumoAnoDto {
  return {
    ano: r.ano,
    concursos: r.concursos,
    acumulados: r.acumulados,
    ganhadores: r.ganhadores,
    maiorPremioCentavos: paraNumero(r.maiorPremioCentavos),
  };
}
