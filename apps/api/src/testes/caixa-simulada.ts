import { readFileSync } from 'node:fs';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';

/**
 * Caixa simulada: um servidor HTTP local (porta efêmera) que imita `/megasena/` e `/megasena/{numero}`.
 * Substitui o `nock`: a versão 15 é ESM puro e não carrega no Jest CommonJS deste workspace, e um
 * servidor real exercita também o `fetch` de verdade (timeout, status HTTP, cabeçalhos).
 */

const CAMINHO_FIXTURE = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'libs',
  'loterias',
  'mega-sena',
  'src',
  'lib',
  'fixtures',
  'caixa-megasena-3070.json',
);

const respostaBase = JSON.parse(
  readFileSync(CAMINHO_FIXTURE, 'utf-8'),
) as Record<string, unknown>;

/** Resposta real da Caixa (concurso 3070) com `numero` e a data do próximo sorteio (dd/mm/aaaa) trocados. */
export function corpoCaixa(
  numero: number,
  dataProximoConcurso = '18/10/2026',
): Record<string, unknown> {
  return {
    ...respostaBase,
    numero,
    numeroConcursoAnterior: numero - 1,
    numeroConcursoProximo: numero + 1,
    dataProximoConcurso,
  };
}

export interface OpcoesCaixaSimulada {
  /** Loteria simulada (segmento da URL); padrão `megasena`. */
  loteria?: string;
  /** Número devolvido por `GET /{loteria}/` (o último concurso). */
  ultimo: number;
  /** Corpo de cada concurso, no lugar do fixture da Mega-Sena (necessário para as outras loterias). */
  corpoDe?: (numero: number) => unknown;
  /** Data do próximo sorteio devolvida em todas as respostas (dd/mm/aaaa). */
  dataProximoConcurso?: string;
  /** Atraso de cada resposta, em ms. */
  atrasoMs?: number;
  /** Status HTTP de erro: quando informado, toda chamada falha com ele. */
  status?: number;
  /** Número de chamadas iniciais que respondem HTTP 503 antes de passar a responder normalmente. */
  falhasIniciais?: number;
  /** Concursos (`/megasena/{numero}`) que respondem HTTP 500; os demais seguem normais. */
  falharEm?: number[];
  /** Corpo devolvido no lugar do JSON real (para testar formato inesperado). */
  corpo?: unknown;
}

/** Estado do servidor compartilhado por todos os testes do arquivo. */
let servidor: Server | undefined;
let url = '';
let opcoesAtuais: OpcoesCaixaSimulada | undefined;
let registro: string[] = [];
/** Cabeçalhos da última requisição recebida. */
let ultimosCabecalhos: IncomingMessage['headers'] = {};

function responder(requisicao: IncomingMessage, resposta: ServerResponse) {
  const uri = requisicao.url ?? '';
  registro.push(uri);
  ultimosCabecalhos = requisicao.headers;
  const opcoes = opcoesAtuais;

  const enviar = (status: number, corpo: unknown) => {
    const enviarAgora = () => {
      if (resposta.destroyed) return;
      resposta.writeHead(status, { 'Content-Type': 'application/json' });
      resposta.end(JSON.stringify(corpo));
    };
    if (opcoes?.atrasoMs) setTimeout(enviarAgora, opcoes.atrasoMs);
    else enviarAgora();
  };

  if (!opcoes)
    return enviar(500, { mensagem: 'Caixa não simulada neste teste' });
  if (opcoes.status)
    return enviar(opcoes.status, { mensagem: 'erro simulado' });
  if (registro.length <= (opcoes.falhasIniciais ?? 0)) {
    return enviar(503, { mensagem: 'indisponível (simulado)' });
  }
  if (opcoes.corpo !== undefined) return enviar(200, opcoes.corpo);

  const correspondencia = /^\/([a-z]+)\/(\d*)$/.exec(uri);
  if (
    !correspondencia ||
    correspondencia[1] !== (opcoes.loteria ?? 'megasena')
  ) {
    return enviar(404, { mensagem: 'rota desconhecida' });
  }
  const numero = correspondencia[2]
    ? Number(correspondencia[2])
    : opcoes.ultimo;
  if (correspondencia[2] && opcoes.falharEm?.includes(numero)) {
    return enviar(500, { mensagem: 'erro simulado' });
  }
  if (opcoes.corpoDe) return enviar(200, opcoes.corpoDe(numero));
  return enviar(200, corpoCaixa(numero, opcoes.dataProximoConcurso));
}

/** Sobe o servidor (uma vez por arquivo de teste, em `beforeAll`). */
export async function iniciarCaixaSimulada(): Promise<void> {
  servidor = createServer(responder);
  await new Promise<void>((resolver) =>
    servidor?.listen(0, '127.0.0.1', resolver),
  );
  url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
}

/** Derruba o servidor e as conexões pendentes (em `afterAll`). */
export async function encerrarCaixaSimulada(): Promise<void> {
  const atual = servidor;
  servidor = undefined;
  if (!atual) return;
  atual.closeAllConnections();
  await new Promise<void>((resolver) => atual.close(() => resolver()));
}

/** URL base para `CAIXA_API_URL`. */
export function urlCaixaSimulada(): string {
  return url;
}

/** Cabeçalhos da última requisição que chegou à Caixa simulada. */
export function cabecalhosDaUltimaChamada(): IncomingMessage['headers'] {
  return ultimosCabecalhos;
}

/**
 * Passa a responder como a Caixa e devolve a lista (viva) das URIs chamadas, em ordem.
 * Cada chamada de `simularCaixa` abre uma lista nova, então um teste pode trocar o comportamento no meio.
 */
export function simularCaixa(opcoes: OpcoesCaixaSimulada): string[] {
  opcoesAtuais = opcoes;
  registro = [];
  return registro;
}

/** Volta ao estado "sem simulação" (chamar em `afterEach`): qualquer chamada inesperada responde 500. */
export function limparCaixaSimulada(): void {
  opcoesAtuais = undefined;
  registro = [];
  ultimosCabecalhos = {};
}
