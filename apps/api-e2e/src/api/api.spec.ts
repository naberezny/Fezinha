import axios from 'axios';

// Roda contra a API já no ar (`nx e2e api-e2e` sobe `api:serve` antes). Requer o banco migrado e carregado.
describe('API no ar', () => {
  it('GET /saude responde ok', async () => {
    const res = await axios.get('/saude');

    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
  });

  it('GET /loterias lista a Mega-Sena', async () => {
    const res = await axios.get('/loterias');

    expect(res.status).toBe(200);
    expect(res.data.map((l: { id: string }) => l.id)).toContain('megasena');
  });

  it('GET /loterias/megasena/resultados?limite=2 devolve os dois últimos concursos em ordem decrescente', async () => {
    const res = await axios.get('/loterias/megasena/resultados', {
      params: { limite: 2 },
    });

    expect(res.status).toBe(200);
    expect(res.data.itens).toHaveLength(2);
    expect(res.data.itens[0].numero).toBeGreaterThan(res.data.itens[1].numero);
  });
});
