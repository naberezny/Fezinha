import {
  dezenaValida,
  type Concurso,
  type LocalGanhador,
  type LoteriaDefinicao,
  type Premiacao,
} from '@sorteios/core';
import ExcelJS from 'exceljs';
import { lerLinhasXlsxBruto } from './leitor-xlsx-bruto';

/** Valor "cru" de uma célula do exceljs: resolve fórmula, texto rico e hiperlink. */
function valorCelula(celula: ExcelJS.CellValue): string | number | Date | null {
  if (celula === null || celula === undefined) return null;
  if (
    celula instanceof Date ||
    typeof celula === 'number' ||
    typeof celula === 'string'
  )
    return celula;
  if (typeof celula === 'boolean') return celula ? 1 : 0;
  if (typeof celula === 'object') {
    if ('result' in celula)
      return valorCelula(celula.result as ExcelJS.CellValue);
    if ('richText' in celula)
      return celula.richText.map((parte) => parte.text).join('');
    if ('text' in celula) return String(celula.text);
  }
  return null;
}

/** 'R$2.307.162,23' ou número 2307162.23 para centavos inteiros. Vazio vira 0. */
export function dinheiroEmCentavos(
  valor: string | number | Date | null,
): bigint {
  if (valor === null || valor instanceof Date) return 0n;
  if (typeof valor === 'number') return BigInt(Math.round(valor * 100));
  const limpo = valor
    .replace(/[^\d,.-]/g, '')
    .replaceAll('.', '')
    .replace(',', '.');
  const numero = limpo ? Number(limpo) : 0;
  return Number.isFinite(numero) ? BigInt(Math.round(numero * 100)) : 0n;
}

/** Inteiro tolerante: '1.234' (milhar) e '2,0' viram número; vazio ou inválido vira 0. */
export function inteiro(valor: string | number | Date | null): number {
  if (valor === null || valor instanceof Date) return 0;
  if (typeof valor === 'number') return Math.trunc(valor);
  const numero = Number(valor.replaceAll('.', '').replace(',', '.'));
  return Number.isFinite(numero) ? Math.trunc(numero) : 0;
}

/** '11/03/1996', ISO, Date ou serial do Excel para 'yyyy-mm-dd'. Lança erro se não reconhecer. */
export function dataIso(valor: string | number | Date | null): string {
  if (valor === null || valor === '') throw new Error('data vazia');
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'number') {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(valor) * 86_400_000)
      .toISOString()
      .slice(0, 10);
  }
  const texto = valor.trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(texto);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  throw new Error(`data não reconhecida: ${texto}`);
}

/** 'MIRANTE DO PARANAPANEMA/SP; RJ' para locais, agrupando repetições em `quantidade`. */
export function separarLocais(
  texto: string | number | Date | null,
): LocalGanhador[] {
  if (texto === null || texto instanceof Date || String(texto).trim() === '')
    return [];
  const grupos = new Map<string, LocalGanhador>();
  for (const parte of String(texto).split(/\s*;\s*/)) {
    const descricao = parte.trim();
    if (!descricao) continue;
    let cidade: string | undefined;
    let uf: string | undefined;
    if (descricao.includes('/')) {
      const corte = descricao.lastIndexOf('/');
      cidade = descricao.slice(0, corte).trim() || undefined;
      uf = descricao.slice(corte + 1).trim() || undefined;
    } else if (/^[A-Z]{2}$/.test(descricao)) {
      uf = descricao;
    } else {
      cidade = descricao; // ex.: "CANAL ELETRONICO"
    }
    const chave = `${cidade ?? ''}|${uf ?? ''}|${descricao}`;
    const atual = grupos.get(chave);
    if (atual) atual.quantidade += 1;
    else grupos.set(chave, { cidade, uf, descricao, quantidade: 1 });
  }
  return [...grupos.values()];
}

type Celula = string | number | Date | null;

/** Linhas via exceljs: cada linha vira um array com todas as colunas da aba (índice base 0). */
async function linhasPeloExcelJs(caminho: string): Promise<Celula[][]> {
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.readFile(caminho);
  const aba = livro.worksheets[0];
  if (!aba) throw new Error('Nenhuma aba encontrada no xlsx.');
  const largura = aba.columnCount;
  const linhas: Celula[][] = [];
  aba.eachRow({ includeEmpty: false }, (linha) => {
    linhas.push(
      Array.from({ length: largura }, (_v, i) =>
        valorCelula(linha.getCell(i + 1).value),
      ),
    );
  });
  return linhas;
}

/** Minúsculas, sem acentos e com espaços simples: "Estimativa Prêmio" e "estimativa prêmio" viram a mesma chave. */
function normalizar(texto: Celula): string {
  if (texto === null || texto instanceof Date) return '';
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Posições (base 0) das colunas da planilha, descobertas pelo cabeçalho. `-1` = coluna ausente. */
interface Colunas {
  concurso: number;
  data: number;
  /** `Bola1..Bola{sorteadas}`, na ordem. */
  bolas: number[];
  /** Uma entrada por faixa de `def.faixas` (mesma ordem). */
  faixas: { ganhadores: number; rateio: number }[];
  cidadesUf: number;
  valorAcumulado: number;
  arrecadacao: number;
  estimativa: number;
  acumuladoEspecial: number;
  observacao: number;
  /** Nomes de cabeçalho obrigatórios que não foram encontrados (concurso, data, bolas). */
  ausentes: string[];
}

/**
 * Cabeçalhos aceitos para os acertos de uma faixa: "Ganhadores 6 acertos"; a faixa de 0 acertos
 * aparece como "Ganhadores Nenhum Número" (Lotomania).
 */
function rotulosDaFaixa(prefixo: string, acertos: number): string[] {
  const rotulos = [`${prefixo} ${acertos} acertos`];
  if (acertos === 0) {
    rotulos.push(
      `${prefixo} nenhum numero`,
      `${prefixo} nenhum acerto`,
      `${prefixo} 0 acerto`,
    );
  }
  return rotulos;
}

/** Descobre as colunas pelo texto do cabeçalho, dirigido pela definição da loteria. */
function descobrirColunas(
  cabecalho: Celula[],
  def: LoteriaDefinicao,
): Colunas {
  const nomes = cabecalho.map(normalizar);
  const achar = (...rotulos: string[]): number =>
    nomes.findIndex((nome) => rotulos.includes(nome));
  const acharPrefixo = (prefixo: string): number =>
    nomes.findIndex((nome) => nome.startsWith(prefixo));

  const ausentes: string[] = [];
  const obrigatoria = (indice: number, nome: string): number => {
    if (indice < 0) ausentes.push(nome);
    return indice;
  };

  const bolas = Array.from({ length: def.sorteadas }, (_v, i) =>
    obrigatoria(achar(`bola${i + 1}`, `bola ${i + 1}`), `Bola${i + 1}`),
  );

  // Maior acumulado "Acumulado N acertos": o da faixa principal; senão, o primeiro que existir.
  const principal = def.faixas[0]?.acertos;
  let valorAcumulado = achar(`acumulado ${principal} acertos`);
  if (valorAcumulado < 0) {
    valorAcumulado = nomes.findIndex((nome) =>
      /^acumulado \d+ acertos$/.test(nome),
    );
  }

  return {
    concurso: obrigatoria(achar('concurso'), 'Concurso'),
    data: obrigatoria(acharPrefixo('data'), 'Data do Sorteio'),
    bolas,
    faixas: def.faixas.map((faixa) => ({
      ganhadores: achar(...rotulosDaFaixa('ganhadores', faixa.acertos)),
      rateio: achar(...rotulosDaFaixa('rateio', faixa.acertos)),
    })),
    cidadesUf: acharPrefixo('cidade'),
    valorAcumulado,
    arrecadacao: achar('arrecadacao total'),
    estimativa: acharPrefixo('estimativa'),
    acumuladoEspecial: acharPrefixo('acumulado sorteio especial'),
    observacao: achar('observacao'),
    ausentes,
  };
}

/** Número inteiro estrito de uma célula ("07" e 7 viram 7; vazio, "-" e texto viram NaN). */
function inteiroEstrito(valor: Celula): number {
  if (typeof valor === 'number') return valor;
  if (typeof valor !== 'string') return Number.NaN;
  const texto = valor.trim();
  return /^\d+$/.test(texto) ? Number(texto) : Number.NaN;
}

/**
 * Converte linhas cruas em concursos, dirigido pela definição: o cabeçalho (primeira linha cuja
 * coluna A é "Concurso") diz onde estão as bolas e as premiações de cada faixa.
 * Linhas anteriores ao cabeçalho, incompletas ou inválidas são ignoradas.
 */
export function mapearLinhas(
  linhas: Celula[][],
  def: LoteriaDefinicao,
): Concurso[] {
  const posicaoCabecalho = linhas.findIndex(
    (linha) => normalizar(linha[0] ?? null) === 'concurso',
  );
  if (posicaoCabecalho < 0) {
    throw new Error(
      'Nenhum concurso válido lido da planilha (cabeçalho "Concurso" não encontrado).',
    );
  }
  const colunas = descobrirColunas(linhas[posicaoCabecalho], def);
  if (colunas.ausentes.length) {
    throw new Error(
      `Nenhum concurso válido lido da planilha (colunas ausentes: ${colunas.ausentes.join(', ')}).`,
    );
  }

  const concursos: Concurso[] = [];
  for (const linha of linhas.slice(posicaoCabecalho + 1)) {
    const celula = (indice: number): Celula =>
      indice < 0 ? null : (linha[indice] ?? null);
    const numero = inteiroEstrito(celula(colunas.concurso));
    const dezenas = colunas.bolas.map((i) => inteiroEstrito(celula(i)));
    let data: string;
    try {
      data = dataIso(celula(colunas.data));
    } catch {
      continue;
    }
    const valida =
      Number.isInteger(numero) &&
      numero > 0 &&
      dezenas.every((d) => dezenaValida(d, def)) &&
      new Set(dezenas).size === dezenas.length;
    if (!valida) continue;

    const premiacoes = def.faixas.map((faixa, i): Premiacao => {
      const { ganhadores, rateio } = colunas.faixas[i];
      return {
        faixa: faixa.faixa,
        ganhadores: inteiro(celula(ganhadores)),
        rateioCentavos: dinheiroEmCentavos(celula(rateio)),
      };
    });
    const observacao = String(celula(colunas.observacao) ?? '').trim();
    concursos.push({
      numero,
      data,
      dezenas: [...dezenas].sort((a, b) => a - b),
      acumulou: premiacoes[0].ganhadores === 0,
      premiacoes,
      valorAcumuladoCentavos: dinheiroEmCentavos(celula(colunas.valorAcumulado)),
      estimativaProximoCentavos: dinheiroEmCentavos(celula(colunas.estimativa)),
      arrecadacaoCentavos: dinheiroEmCentavos(celula(colunas.arrecadacao)),
      acumuladoEspecialCentavos: dinheiroEmCentavos(
        celula(colunas.acumuladoEspecial),
      ),
      observacao: observacao || undefined,
      locaisGanhadores: separarLocais(celula(colunas.cidadesUf)),
    });
  }
  if (!concursos.length)
    throw new Error('Nenhum concurso válido lido da planilha.');
  return concursos.sort((a, b) => a.numero - b.numero);
}

/**
 * Lê o export da Caixa (primeira aba) e devolve `Concurso[]` em ordem crescente, interpretando as
 * colunas conforme a definição da loteria (`Bola1..Bola{sorteadas}` e as premiações de cada faixa).
 * Usa o exceljs; se ele não conseguir abrir o arquivo (o export oficial usa o prefixo `x:` nos elementos,
 * que o exceljs não entende), cai no leitor bruto de `leitor-xlsx-bruto.ts`.
 */
export async function lerPlanilha(
  caminho: string,
  def: LoteriaDefinicao,
): Promise<Concurso[]> {
  let linhas: Celula[][];
  try {
    linhas = await linhasPeloExcelJs(caminho);
  } catch {
    linhas = lerLinhasXlsxBruto(caminho);
  }
  return mapearLinhas(linhas, def);
}
