/**
 * Leitor mínimo de .xlsx sem dependências, no mesmo espírito do `banco.py` legado.
 *
 * Existe porque o export oficial da Caixa usa o prefixo de namespace `x:` (`<x:workbook>`), que o
 * exceljs não reconhece (falha com "Cannot read properties of undefined (reading 'sheets')").
 * Lê só a primeira aba e devolve cada célula como texto cru (ou `null`).
 */
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

/** Extrai as entradas do ZIP (central directory) que passam no filtro, já descompactadas. */
function extrairZip(buffer: Buffer, aceita: (nome: string) => boolean): Map<string, Buffer> {
  let fim = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new Error('Arquivo .xlsx inválido (ZIP sem diretório central).');

  const total = buffer.readUInt16LE(fim + 10);
  let posicao = buffer.readUInt32LE(fim + 16);
  const entradas = new Map<string, Buffer>();
  for (let n = 0; n < total; n++) {
    if (buffer.readUInt32LE(posicao) !== 0x02014b50) throw new Error('Arquivo .xlsx inválido (entrada corrompida).');
    const metodo = buffer.readUInt16LE(posicao + 10);
    const tamanhoComprimido = buffer.readUInt32LE(posicao + 20);
    const tamanhoNome = buffer.readUInt16LE(posicao + 28);
    const tamanhoExtra = buffer.readUInt16LE(posicao + 30);
    const tamanhoComentario = buffer.readUInt16LE(posicao + 32);
    const deslocamentoLocal = buffer.readUInt32LE(posicao + 42);
    const nome = buffer.toString('utf-8', posicao + 46, posicao + 46 + tamanhoNome);
    posicao += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;

    if (!aceita(nome)) continue;
    const inicioDados =
      deslocamentoLocal + 30 + buffer.readUInt16LE(deslocamentoLocal + 26) + buffer.readUInt16LE(deslocamentoLocal + 28);
    const bruto = buffer.subarray(inicioDados, inicioDados + tamanhoComprimido);
    entradas.set(nome, metodo === 0 ? bruto : inflateRawSync(bruto));
  }
  return entradas;
}

function desescapar(texto: string): string {
  return texto
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

const PREFIXO = '(?:[\\w-]+:)?';

/** Concatena o texto de todos os `<t>` dentro de um trecho de XML. */
function textoDeTrechos(xml: string): string {
  const regex = new RegExp(`<${PREFIXO}t\\b[^>]*>([\\s\\S]*?)</${PREFIXO}t>`, 'g');
  return [...xml.matchAll(regex)].map((m) => desescapar(m[1])).join('');
}

function lerSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const regex = new RegExp(`<${PREFIXO}si\\b[^>]*>([\\s\\S]*?)</${PREFIXO}si>`, 'g');
  return [...xml.matchAll(regex)].map((m) => textoDeTrechos(m[1]));
}

/** 'AB12' -> índice de coluna base 0 (A = 0). */
function indiceDaColuna(referencia: string): number {
  const letras = /^[A-Z]+/.exec(referencia)?.[0] ?? 'A';
  let indice = 0;
  for (const letra of letras) indice = indice * 26 + (letra.charCodeAt(0) - 64);
  return indice - 1;
}

/** Linhas da primeira aba do .xlsx; cada célula é o texto cru ou `null`. */
export function lerLinhasXlsxBruto(caminho: string): (string | null)[][] {
  const arquivos = extrairZip(
    readFileSync(caminho),
    (nome) => nome === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(nome),
  );
  const nomesAbas = [...arquivos.keys()].filter((n) => n.startsWith('xl/worksheets/')).sort();
  if (!nomesAbas.length) throw new Error('Nenhuma aba encontrada no xlsx.');

  const compartilhadas = lerSharedStrings(arquivos.get('xl/sharedStrings.xml')?.toString('utf-8'));
  const aba = arquivos.get(nomesAbas[0])!.toString('utf-8');

  const regexLinha = new RegExp(`<${PREFIXO}row\\b[^>]*>([\\s\\S]*?)</${PREFIXO}row>`, 'g');
  const regexCelula = new RegExp(`<${PREFIXO}c\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${PREFIXO}c>)`, 'g');
  const regexValor = new RegExp(`<${PREFIXO}v\\b[^>]*>([\\s\\S]*?)</${PREFIXO}v>`);

  const linhas: (string | null)[][] = [];
  for (const linha of aba.matchAll(regexLinha)) {
    const celulas: (string | null)[] = [];
    let proximo = 0;
    for (const celula of linha[1].matchAll(regexCelula)) {
      const atributos = celula[1];
      const corpo = celula[2] ?? '';
      const referencia = /\br="([A-Z]+\d+)"/.exec(atributos)?.[1];
      const tipo = /\bt="(\w+)"/.exec(atributos)?.[1];
      const indice = referencia ? indiceDaColuna(referencia) : proximo;

      let valor: string | null = null;
      if (tipo === 'inlineStr') {
        valor = textoDeTrechos(corpo);
      } else {
        const bruto = regexValor.exec(corpo)?.[1];
        if (bruto !== undefined) valor = tipo === 's' ? (compartilhadas[Number(bruto)] ?? null) : desescapar(bruto);
      }
      celulas[indice] = valor;
      proximo = indice + 1;
    }
    linhas.push(Array.from(celulas, (c) => c ?? null));
  }
  return linhas;
}
