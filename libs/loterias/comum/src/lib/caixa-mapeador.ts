import { z } from 'zod';
import { dezenaValida, ultimaDezena } from '@sorteios/core';
import type { Concurso, LocalGanhador, LoteriaDefinicao, Premiacao } from '@sorteios/core';

/**
 * Mapeador genérico da resposta da API da Caixa (`/portaldeloterias/api/<loteria>/[numero]`) para `Concurso`.
 *
 * O formato da resposta é o mesmo para as loterias numéricas; o que muda vem da `LoteriaDefinicao`:
 * quantidade de dezenas sorteadas (`sorteadas`) e intervalo válido de dezenas (`primeiraDezena..ultimaDezena`).
 * As premiações vêm de `listaRateioPremio` e são mapeadas pela `faixa` numérica (1..n) informada pela Caixa.
 *
 * A API é pública e não documentada: o schema é tolerante (campos extras são ignorados, valores
 * monetários aceitam número ou texto) e restrito apenas ao que o domínio precisa.
 */

// ---------------------------------------------------------------------------
// Conversões primitivas
// ---------------------------------------------------------------------------

/**
 * Converte valor monetário em reais para centavos, sem erro de ponto flutuante.
 * - número: `BigInt(Math.round(n * 100))`;
 * - texto: "1.234,56" (formato brasileiro), "1234,56" ou "1234.56" (decimal com ponto).
 * Retorna `undefined` quando o valor não é interpretável ou é negativo.
 */
function reaisParaCentavos(valor: number | string): bigint | undefined {
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor) || valor < 0) return undefined;
    return BigInt(Math.round(valor * 100));
  }
  const texto = valor.trim();
  if (texto === '' || texto.startsWith('-')) return undefined;

  let inteiro: string;
  let fracao: string;
  if (texto.includes(',')) {
    // Formato brasileiro: remove tudo que não é dígito ou vírgula; a vírgula separa os centavos.
    const partes = texto.replace(/[^\d,]/g, '').split(',');
    if (partes.length !== 2) return undefined;
    inteiro = partes[0] ?? '';
    fracao = partes[1] ?? '';
  } else if (/^\d{1,3}(\.\d{3})+$/.test(texto)) {
    // "1.234.567": pontos como separador de milhar, sem centavos.
    inteiro = texto.replace(/\./g, '');
    fracao = '';
  } else if (/^\d+(\.\d+)?$/.test(texto)) {
    // "1234.56": decimal com ponto.
    const partes = texto.split('.');
    inteiro = partes[0] ?? '';
    fracao = partes[1] ?? '';
  } else {
    return undefined;
  }
  if (inteiro === '' && fracao === '') return undefined;
  const centavos = (fracao + '00').slice(0, 2);
  return BigInt(inteiro === '' ? '0' : inteiro) * 100n + BigInt(centavos);
}

/** "dd/mm/aaaa" → "aaaa-mm-dd"; `undefined` se o formato ou a data forem inválidos. */
function dataBrParaIso(texto: string): string | undefined {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return undefined;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return undefined;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Número inteiro a partir de número ou texto só com dígitos; `NaN` caso contrário. */
function paraInteiro(valor: number | string): number {
  if (typeof valor === 'number') return valor;
  return /^\d+$/.test(valor.trim()) ? Number(valor.trim()) : Number.NaN;
}

// ---------------------------------------------------------------------------
// Schemas (zod 4)
// ---------------------------------------------------------------------------

/** Valor monetário em reais (número ou texto) → centavos. Ausente/nulo vale 0. */
const dinheiro = z
  .union([z.number(), z.string()], { error: 'valor monetário deve ser número ou texto' })
  .nullish()
  .transform((valor, ctx) => {
    if (valor === null || valor === undefined) return 0n;
    const centavos = reaisParaCentavos(valor);
    if (centavos === undefined) {
      ctx.issues.push({ code: 'custom', message: `valor monetário inválido: ${JSON.stringify(valor)}`, input: valor });
      return z.NEVER;
    }
    return centavos;
  });

/** Inteiro não negativo, aceitando número ou texto numérico ("0054"). */
const inteiro = z.union([z.number(), z.string()], { error: 'deve ser um número inteiro' }).transform((valor, ctx) => {
  const n = paraInteiro(valor);
  if (!Number.isInteger(n) || n < 0) {
    ctx.issues.push({
      code: 'custom',
      message: `deve ser um inteiro não negativo: ${JSON.stringify(valor)}`,
      input: valor,
    });
    return z.NEVER;
  }
  return n;
});

/** Data "dd/mm/aaaa" → ISO "aaaa-mm-dd". */
const dataBr = z.string({ error: 'data ausente ou não é texto' }).transform((texto, ctx) => {
  const iso = dataBrParaIso(texto);
  if (iso === undefined) {
    ctx.issues.push({
      code: 'custom',
      message: `data inválida (esperado dd/mm/aaaa): ${JSON.stringify(texto)}`,
      input: texto,
    });
    return z.NEVER;
  }
  return iso;
});

/** Dezena "04" ou 4 → 4, dentro de `primeiraDezena..ultimaDezena` da loteria ("00" só é válida quando `primeiraDezena` é 0). */
function criarEsquemaDezena(def: LoteriaDefinicao) {
  return z.union([z.number(), z.string()], { error: 'dezena deve ser número ou texto' }).transform((valor, ctx) => {
    const n = paraInteiro(valor);
    if (!dezenaValida(n, def)) {
      ctx.issues.push({
        code: 'custom',
        message: `dezena fora do intervalo ${def.primeiraDezena}..${ultimaDezena(def)}: ${JSON.stringify(valor)}`,
        input: valor,
      });
      return z.NEVER;
    }
    return n;
  });
}

const texto = z.string().nullish();

const esquemaRateio = z.object({
  faixa: inteiro,
  numeroDeGanhadores: inteiro.nullish(),
  valorPremio: dinheiro,
});

const esquemaLocal = z.object({
  ganhadores: inteiro.nullish(),
  municipio: texto,
  uf: texto,
});

function criarEsquemaResposta(def: LoteriaDefinicao) {
  return z.object({
    numero: inteiro,
    dataApuracao: dataBr,
    listaDezenas: z.array(criarEsquemaDezena(def), {
      error: 'campo obrigatório: lista de dezenas ausente ou não é uma lista',
    }),
    acumulado: z.boolean().nullish(),
    listaRateioPremio: z.array(esquemaRateio).nullish(),
    listaMunicipioUFGanhadores: z.array(esquemaLocal).nullish(),
    valorAcumuladoProximoConcurso: dinheiro,
    valorEstimadoProximoConcurso: dinheiro,
    valorArrecadado: dinheiro,
    valorAcumuladoConcursoEspecial: dinheiro,
    numeroConcursoProximo: inteiro.nullish(),
    dataProximoConcurso: dataBr.nullish(),
    observacao: texto,
  });
}

type RespostaCaixa = z.infer<ReturnType<typeof criarEsquemaResposta>>;

// ---------------------------------------------------------------------------
// Mapeamento
// ---------------------------------------------------------------------------

/** Texto sem caracteres de controle nem espaços nas pontas; vazio vira `undefined`. */
function limpar(valor: string | null | undefined): string | undefined {
  // eslint-disable-next-line no-control-regex
  const t = (valor ?? '').replace(/[\u0000-\u001f]/g, '').trim();
  return t === '' ? undefined : t;
}

function mapearLocal(item: z.infer<typeof esquemaLocal>): LocalGanhador {
  const cidade = limpar(item.municipio);
  const ufBruta = limpar(item.uf);
  const uf = ufBruta === '--' ? undefined : ufBruta;
  const descricao = cidade && uf ? `${cidade}/${uf}` : (cidade ?? uf ?? '');
  const local: LocalGanhador = { descricao, quantidade: item.ganhadores ?? 1 };
  if (cidade !== undefined) local.cidade = cidade;
  if (uf !== undefined) local.uf = uf;
  return local;
}

function paraConcurso(r: RespostaCaixa, def: LoteriaDefinicao): Concurso {
  if (r.listaDezenas.length !== def.sorteadas) {
    throw new Error(
      `Resposta da Caixa inválida — campo "listaDezenas": esperadas ${def.sorteadas} dezenas, recebidas ${r.listaDezenas.length}`,
    );
  }
  const dezenas = [...r.listaDezenas].sort((a, b) => a - b);
  if (new Set(dezenas).size !== dezenas.length) {
    throw new Error('Resposta da Caixa inválida — campo "listaDezenas": dezenas repetidas');
  }

  // Cada premiação é identificada pela `faixa` numérica (1..n) da Caixa, sem reordenar nem filtrar.
  const premiacoes: Premiacao[] = (r.listaRateioPremio ?? []).map((p) => ({
    faixa: p.faixa,
    ganhadores: p.numeroDeGanhadores ?? 0,
    rateioCentavos: p.valorPremio,
  }));

  const concurso: Concurso = {
    numero: r.numero,
    data: r.dataApuracao,
    dezenas,
    acumulou: r.acumulado === true,
    premiacoes,
    valorAcumuladoCentavos: r.valorAcumuladoProximoConcurso,
    estimativaProximoCentavos: r.valorEstimadoProximoConcurso,
    arrecadacaoCentavos: r.valorArrecadado,
    acumuladoEspecialCentavos: r.valorAcumuladoConcursoEspecial,
    locaisGanhadores: (r.listaMunicipioUFGanhadores ?? []).map(mapearLocal),
  };
  if (r.numeroConcursoProximo != null) concurso.proximoNumero = r.numeroConcursoProximo;
  if (r.dataProximoConcurso != null) concurso.dataProximoSorteio = r.dataProximoConcurso;
  const observacao = limpar(r.observacao);
  if (observacao !== undefined) concurso.observacao = observacao;
  return concurso;
}

/** `["listaRateioPremio", 0, "faixa"]` → `listaRateioPremio[0].faixa`. */
function caminhoLegivel(caminho: PropertyKey[]): string {
  if (caminho.length === 0) return 'resposta';
  return caminho.reduce<string>((acc, parte, i) => {
    if (typeof parte === 'number') return `${acc}[${parte}]`;
    return i === 0 ? String(parte) : `${acc}.${String(parte)}`;
  }, '');
}

/**
 * Cria o mapeador da resposta da API da Caixa para a loteria `def`.
 * A função devolvida converte o JSON em `Concurso` e lança `Error` descritivo (nunca `ZodError`) se a resposta for inválida.
 */
export function criarMapeadorCaixa(def: LoteriaDefinicao): (json: unknown) => Concurso {
  const esquemaResposta = criarEsquemaResposta(def);
  return (json: unknown): Concurso => {
    const resultado = esquemaResposta.safeParse(json);
    if (!resultado.success) {
      const detalhes = resultado.error.issues.map((i) => `campo "${caminhoLegivel(i.path)}": ${i.message}`).join('; ');
      throw new Error(`Resposta da Caixa inválida — ${detalhes}`);
    }
    return paraConcurso(resultado.data, def);
  };
}
