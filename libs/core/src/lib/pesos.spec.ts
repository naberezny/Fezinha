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
    // Dezena 1 é a que mais saiu (10), a 2 fica no meio (5) e as demais são as que menos saíram (0).
    const frequencia = lista({ 1: [0, 10], 2: [0, 5] });
    const mista = (proporcaoFrias?: number) =>
      calcularPesos(
        frequencia,
        frequencia,
        configuracao({ estrategia: 'mista', ...(proporcaoFrias === undefined ? {} : { mista: { proporcaoFrias } }) }),
        def,
      );

    it('proporção 0: só as mais frequentes ganham peso (1,05 a mais frequente, 0,05 a menos)', () => {
      // Act
      const pesos = mista(0);

      // Assert
      expect(pesos.get(1)).toBeCloseTo(1.05, 10);
      expect(pesos.get(2)).toBeCloseTo(0.3, 10);
      expect(pesos.get(3)).toBeCloseTo(0.05, 10);
    });

    it('proporção 1: só as menos frequentes ganham peso', () => {
      // Act
      const pesos = mista(1);

      // Assert
      expect(pesos.get(1)).toBeCloseTo(0.05, 10);
      expect(pesos.get(2)).toBeCloseTo(0.3, 10);
      expect(pesos.get(3)).toBeCloseTo(1.05, 10);
    });

    it('sem proporção (padrão 0,5): os dois extremos ganham peso e a do meio perde', () => {
      // Act
      const pesos = mista();

      // Assert
      expect(pesos.get(1)).toBeCloseTo(0.55, 10);
      expect(pesos.get(3)).toBeCloseTo(0.55, 10);
      expect(pesos.get(2)).toBeCloseTo(0.3, 10);
    });

    it('o atraso não muda a mista; frequências todas iguais dão o mesmo peso a todas', () => {
      // Arrange
      const comAtraso = lista({ 1: [40, 10], 2: [0, 5] });
      const iguais = lista();

      // Act
      const pesosComAtraso = calcularPesos(comAtraso, frequencia, configuracao({ estrategia: 'mista' }), def);
      const pesosIguais = calcularPesos(iguais, iguais, configuracao({ estrategia: 'mista', mista: { proporcaoFrias: 0 } }), def);

      // Assert
      expect(pesosComAtraso).toEqual(mista());
      expect(new Set(pesosIguais.values()).size).toBe(1);
    });

    it('mantém os pesos entre 0,05 e 1,05 e limita a proporção a 0..1', () => {
      // Arrange
      const variada = lista({ 1: [0, 3], 5: [0, 30], 9: [0, 17], 20: [0, 8] });

      // Act
      const todos = [0, 0.25, 0.5, 0.75, 1].flatMap((p) =>
        [...calcularPesos(variada, variada, configuracao({ estrategia: 'mista', mista: { proporcaoFrias: p } }), def).values()],
      );

      // Assert
      for (const peso of todos) {
        expect(peso).toBeGreaterThanOrEqual(0.05 - 1e-12);
        expect(peso).toBeLessThanOrEqual(1.05 + 1e-12);
      }
      expect(mista(2)).toEqual(mista(1));
      expect(mista(-1)).toEqual(mista(0));
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
