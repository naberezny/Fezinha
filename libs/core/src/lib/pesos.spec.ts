import { calcularPesos } from './pesos';
import type { ConfiguracaoGeracao, EstatisticaDezena } from './tipos';
import { LOTERIA_TESTE } from '../testes/loteria-teste';

const def = LOTERIA_TESTE; // 60 dezenas, 6 sorteadas => atraso esperado 10

function estatistica(dezena: number, atraso: number, frequencia: number): EstatisticaDezena {
  return { dezena, atraso, frequencia, atrasoMaximo: atraso, probAusencia: 1 };
}

/** Lista completa 1..60; `sobrescritas` define (atraso, frequência) das dezenas citadas, as demais ficam em 0/0. */
function lista(sobrescritas: Record<number, [number, number]> = {}): EstatisticaDezena[] {
  return Array.from({ length: def.universo }, (_, i) => {
    const dezena = i + 1;
    const [atraso, frequencia] = sobrescritas[dezena] ?? [0, 0];
    return estatistica(dezena, atraso, frequencia);
  });
}

function configuracao(parcial: Partial<ConfiguracaoGeracao> = {}): ConfiguracaoGeracao {
  return {
    estrategia: 'atrasadas',
    quantidadeJogos: 1,
    dezenasPorJogo: 6,
    fixas: [],
    atrasadas: { atrasoMinimo: 10, intensidade: 2 },
    frequentes: { periodo: { tipo: 'ultimos', quantidade: 50 } },
    regras: {},
    ...parcial,
  };
}

describe('calcularPesos', () => {
  describe('estratégia atrasadas', () => {
    it('com atraso 30, esperado 10 e intensidade 2, o peso é 10', () => {
      // Arrange
      const estatisticas = lista({ 7: [30, 0] });

      // Act
      const pesos = calcularPesos(estatisticas, estatisticas, configuracao(), def);

      // Assert
      expect(pesos.get(7)).toBeCloseTo(10, 10);
    });

    it('com intensidade 1, o peso do atraso 30 é 4', () => {
      // Arrange
      const estatisticas = lista({ 7: [30, 0] });
      const config = configuracao({ atrasadas: { atrasoMinimo: 10, intensidade: 1 } });

      // Act
      const pesos = calcularPesos(estatisticas, estatisticas, config, def);

      // Assert
      expect(pesos.get(7)).toBeCloseTo(4, 10);
    });

    it('com atraso abaixo do mínimo, o peso é 1', () => {
      // Arrange
      const estatisticas = lista({ 7: [9, 0] });

      // Act
      const pesos = calcularPesos(estatisticas, estatisticas, configuracao(), def);

      // Assert
      expect(pesos.get(7)).toBe(1);
    });

    it('com atraso exatamente igual ao mínimo, o peso passa a crescer', () => {
      // Arrange
      const estatisticas = lista({ 7: [10, 0] });

      // Act
      const pesos = calcularPesos(estatisticas, estatisticas, configuracao(), def);

      // Assert
      expect(pesos.get(7)).toBeCloseTo(2, 10);
    });

    it('respeita um atrasoMinimo maior que o esperado', () => {
      // Arrange
      const estatisticas = lista({ 7: [30, 0] });
      const config = configuracao({ atrasadas: { atrasoMinimo: 40, intensidade: 2 } });

      // Act
      const pesos = calcularPesos(estatisticas, estatisticas, config, def);

      // Assert
      expect(pesos.get(7)).toBe(1);
    });

    it('devolve um peso para cada dezena de 1 até o universo', () => {
      // Arrange
      const estatisticas = lista();

      // Act
      const pesos = calcularPesos(estatisticas, estatisticas, configuracao(), def);

      // Assert
      expect([...pesos.keys()]).toEqual(Array.from({ length: 60 }, (_, i) => i + 1));
    });
  });

  describe('estratégia frequentes', () => {
    it('usa 1 + frequência da lista de frequência (e ignora o atraso)', () => {
      // Arrange
      const atraso = lista({ 3: [50, 0] });
      const frequencia = lista({ 3: [0, 12], 4: [0, 0] });

      // Act
      const pesos = calcularPesos(atraso, frequencia, configuracao({ estrategia: 'frequentes' }), def);

      // Assert
      expect(pesos.get(3)).toBe(13);
      expect(pesos.get(4)).toBe(1);
    });
  });

  describe('estratégia mista', () => {
    it('normaliza pelo máximo e soma 0,05', () => {
      // Arrange
      const atraso = lista({ 1: [20, 0], 2: [10, 0], 3: [0, 0] });
      const frequencia = lista({ 1: [0, 10], 2: [0, 10], 3: [0, 10] });

      // Act
      const pesos = calcularPesos(atraso, frequencia, configuracao({ estrategia: 'mista' }), def);

      // Assert
      expect(pesos.get(1)).toBeCloseTo(1.05, 10); // sqrt(1 * 1) + 0,05
      expect(pesos.get(2)).toBeCloseTo(Math.sqrt(0.5) + 0.05, 10);
      expect(pesos.get(3)).toBeCloseTo(0.05, 10);
    });

    it('mantém todos os pesos entre 0,05 e 1,05', () => {
      // Arrange
      const atraso = lista({ 1: [40, 0], 5: [13, 0], 9: [2, 0] });
      const frequencia = lista({ 1: [0, 3], 5: [0, 30], 9: [0, 17] });

      // Act
      const pesos = calcularPesos(atraso, frequencia, configuracao({ estrategia: 'mista' }), def);

      // Assert
      for (const peso of pesos.values()) {
        expect(peso).toBeGreaterThanOrEqual(0.05);
        expect(peso).toBeLessThanOrEqual(1.05 + 1e-12);
      }
    });

    it('não divide por zero quando todos os atrasos e frequências são 0', () => {
      // Arrange
      const estatisticas = lista();

      // Act
      const pesos = calcularPesos(estatisticas, estatisticas, configuracao({ estrategia: 'mista' }), def);

      // Assert
      expect([...pesos.values()].every((p) => p === 0.05)).toBe(true);
    });
  });

  describe('estratégia aleatório', () => {
    it('dá peso 1 para todas as dezenas', () => {
      // Arrange
      const estatisticas = lista({ 1: [99, 99], 2: [0, 0] });

      // Act
      const pesos = calcularPesos(estatisticas, estatisticas, configuracao({ estrategia: 'aleatorio' }), def);

      // Assert
      expect([...pesos.values()].every((p) => p === 1)).toBe(true);
    });
  });

  describe('validações', () => {
    it('lança erro quando a lista de atraso não tem todas as dezenas', () => {
      // Arrange
      const incompleta = lista().filter((e) => e.dezena !== 33);

      // Act / Assert
      expect(() => calcularPesos(incompleta, lista(), configuracao(), def)).toThrow(/atraso.*33/);
    });

    it('lança erro quando a lista de frequência não tem todas as dezenas', () => {
      // Arrange
      const incompleta = lista().slice(0, 59);

      // Act / Assert
      expect(() => calcularPesos(lista(), incompleta, configuracao(), def)).toThrow(/frequência.*60/);
    });

    it('lança erro para estratégia desconhecida', () => {
      // Arrange
      const config = configuracao({ estrategia: 'xyz' as ConfiguracaoGeracao['estrategia'] });

      // Act / Assert
      expect(() => calcularPesos(lista(), lista(), config, def)).toThrow(/Estratégia desconhecida/);
    });
  });
});
