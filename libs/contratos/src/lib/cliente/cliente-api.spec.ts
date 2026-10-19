import { criarClienteApi, ErroApi } from './cliente-api';

interface Chamada {
  url: string;
  init?: RequestInit;
}

function criarFetchFalso(resposta: () => Response) {
  const chamadas: Chamada[] = [];
  const falso = jest.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      chamadas.push({ url: String(url), init });
      return resposta();
    },
  );
  return { chamadas, fetch: falso as unknown as typeof fetch };
}

const json = (corpo: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

describe('criarClienteApi', () => {
  it('monta as URLs das rotas, ignora parâmetros ausentes e remove a barra final da base', async () => {
    // Arrange
    const { chamadas, fetch } = criarFetchFalso(() => json({}));
    const api = criarClienteApi('http://localhost:3000/', { fetch });

    // Act
    await api.saude();
    await api.listarLoterias();
    await api.resultados('megasena', { limite: 8, pagina: 2 });
    await api.resultados('megasena');
    await api.resultado('megasena', 3070);
    await api.estatisticas('megasena', 'ultimos:50');
    await api.estatisticas('megasena');
    await api.sincronizacao('megasena');

    // Assert
    expect(chamadas.map((c) => c.url)).toEqual([
      'http://localhost:3000/saude',
      'http://localhost:3000/loterias',
      'http://localhost:3000/loterias/megasena/resultados?limite=8&pagina=2',
      'http://localhost:3000/loterias/megasena/resultados',
      'http://localhost:3000/loterias/megasena/resultados/3070',
      'http://localhost:3000/loterias/megasena/estatisticas?periodo=ultimos%3A50',
      'http://localhost:3000/loterias/megasena/estatisticas',
      'http://localhost:3000/loterias/megasena/sincronizacao',
    ]);
  });

  it('historico devolve dados e ETag; com ETag anterior envia If-None-Match e trata 304', async () => {
    // Arrange
    let proxima: Response = json(
      { loteria: {}, concursos: [] },
      { headers: { ETag: '"3070-3070"' } },
    );
    const { chamadas, fetch } = criarFetchFalso(() => proxima);
    const api = criarClienteApi('http://api', { fetch });

    // Act
    const primeira = await api.historico('megasena');
    proxima = new Response(null, {
      status: 304,
      headers: { ETag: '"3070-3070"' },
    });
    const segunda = await api.historico('megasena', '"3070-3070"');

    // Assert
    expect(primeira).toMatchObject({
      naoModificado: false,
      etag: '"3070-3070"',
    });
    expect(segunda).toEqual({ naoModificado: true, etag: '"3070-3070"' });
    expect(chamadas[1].init?.headers).toEqual({
      'If-None-Match': '"3070-3070"',
    });
  });

  it('sincronizar envia POST com X-Chave-Admin e o intervalo', async () => {
    // Arrange
    const { chamadas, fetch } = criarFetchFalso(() =>
      json({ novos: 3, atualizados: 0, inalterados: 0, ultimoConcurso: 3073 }),
    );
    const api = criarClienteApi('http://api', { fetch });

    // Act
    const resultado = await api.sincronizar('megasena', 'segredo', {
      de: 3000,
      ate: 3005,
    });

    // Assert
    expect(resultado.novos).toBe(3);
    expect(chamadas[0].url).toBe(
      'http://api/loterias/megasena/sincronizar?de=3000&ate=3005',
    );
    expect(chamadas[0].init).toMatchObject({
      method: 'POST',
      headers: { 'X-Chave-Admin': 'segredo' },
    });
  });

  it('lança ErroApi com status e mensagem do corpo quando a API responde erro', async () => {
    // Arrange
    const { fetch } = criarFetchFalso(() =>
      json({ message: "Loteria 'xyz' não encontrada" }, { status: 404 }),
    );
    const api = criarClienteApi('http://api', { fetch });

    // Act
    const erro = await api.resultados('xyz').catch((e: unknown) => e);

    // Assert
    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro).toMatchObject({
      status: 404,
      message: "Loteria 'xyz' não encontrada",
    });
  });
});
