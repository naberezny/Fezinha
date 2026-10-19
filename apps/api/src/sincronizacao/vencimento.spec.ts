import { estaVencida, instanteDoSorteio } from './vencimento';

const AGORA = new Date('2026-10-16T15:00:00Z');
const antes = (minutos: number) =>
  new Date(AGORA.getTime() - minutos * 60_000).toISOString();
const depois = (minutos: number) =>
  new Date(AGORA.getTime() + minutos * 60_000).toISOString();

describe('estaVencida', () => {
  it('nunca sincronizada está vencida', () => {
    // Arrange
    const estado = { ultimaEm: null, proximoSorteioEm: null };

    // Act / Assert
    expect(estaVencida(estado, AGORA)).toBe(true);
  });

  it('data de sincronização ilegível está vencida', () => {
    expect(
      estaVencida({ ultimaEm: 'ontem', proximoSorteioEm: null }, AGORA),
    ).toBe(true);
  });

  it('sincronizada há 23 h com sorteio no futuro não está vencida', () => {
    // Arrange
    const estado = { ultimaEm: antes(23 * 60), proximoSorteioEm: depois(60) };

    // Act / Assert
    expect(estaVencida(estado, AGORA)).toBe(false);
  });

  it('sincronizada há mais de 24 h está vencida mesmo sem sorteio marcado', () => {
    // Arrange
    const estado = { ultimaEm: antes(24 * 60 + 1), proximoSorteioEm: null };

    // Act / Assert
    expect(estaVencida(estado, AGORA)).toBe(true);
  });

  it('sorteio que já passou depois da última sincronização está vencida', () => {
    // Arrange
    const estado = { ultimaEm: antes(120), proximoSorteioEm: antes(30) };

    // Act / Assert
    expect(estaVencida(estado, AGORA)).toBe(true);
  });

  it('sincronizada depois do sorteio e há menos de 10 min não reconsulta a Caixa', () => {
    // Arrange: a Caixa ainda não tinha publicado o resultado na última consulta.
    const estado = { ultimaEm: antes(5), proximoSorteioEm: antes(30) };

    // Act / Assert
    expect(estaVencida(estado, AGORA)).toBe(false);
  });

  it('sincronizada depois do sorteio e há mais de 10 min reconsulta', () => {
    // Arrange
    const estado = { ultimaEm: antes(11), proximoSorteioEm: antes(30) };

    // Act / Assert
    expect(estaVencida(estado, AGORA)).toBe(true);
  });
});

describe('instanteDoSorteio', () => {
  it('20h de Brasília são 23:00Z', () => {
    expect(instanteDoSorteio('2026-10-18')).toBe('2026-10-18T23:00:00Z');
  });
});
