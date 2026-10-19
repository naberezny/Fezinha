import {
  calcularEstatisticas,
  distribuicaoPares,
  distribuicaoSoma,
  frequenciaPorMes,
  resumoPorAno,
} from '@sorteios/core';
import type { EstatisticaDezena } from '@sorteios/core';
import { carregarHistoricoFixture } from '../testes/fixture';

/** Paridade com o banco legado (espec. 4.4): valores exatos do histórico congelado de 3.070 concursos. */
describe('paridade das estatísticas com o legado (Mega-Sena, 3.070 concursos)', () => {
  const historico = carregarHistoricoFixture();
  const porDezena = (estatisticas: EstatisticaDezena[], dezena: number): EstatisticaDezena =>
    estatisticas[dezena - 1];

  it('carrega 3.070 concursos', () => {
    expect(historico.concursos).toHaveLength(3070);
  });

  describe('período "tudo"', () => {
    const estatisticas = calcularEstatisticas(historico, { tipo: 'tudo' });

    it('reproduz as frequências totais', () => {
      expect(porDezena(estatisticas, 10).frequencia).toBe(359);
      expect(porDezena(estatisticas, 53).frequencia).toBe(350);
      expect(porDezena(estatisticas, 5).frequencia).toBe(335);
      expect(porDezena(estatisticas, 26).frequencia).toBe(250);
      expect(porDezena(estatisticas, 21).frequencia).toBe(261);
      expect(porDezena(estatisticas, 55).frequencia).toBe(264);
    });

    it('soma das frequências é 3070 × 6 = 18420', () => {
      const soma = estatisticas.reduce((acumulado, e) => acumulado + e.frequencia, 0);

      expect(soma).toBe(3070 * 6);
      expect(soma).toBe(18420);
    });

    it('reproduz o atraso atual', () => {
      expect(porDezena(estatisticas, 34).atraso).toBe(43);
      expect(porDezena(estatisticas, 45).atraso).toBe(40);
      expect(porDezena(estatisticas, 32).atraso).toBe(39);
      expect(porDezena(estatisticas, 59).atraso).toBe(35);
      expect(porDezena(estatisticas, 12).atraso).toBe(34);
      expect(porDezena(estatisticas, 46).atraso).toBe(32);
      expect(porDezena(estatisticas, 3).atraso).toBe(30);
    });

    it('reproduz o atraso máximo', () => {
      expect(porDezena(estatisticas, 42).atrasoMaximo).toBe(108);
      expect(porDezena(estatisticas, 26).atrasoMaximo).toBe(88);
      expect(porDezena(estatisticas, 34).atrasoMaximo).toBe(72);
    });

    it('probAusencia segue (1 - 6/60)^atraso', () => {
      const dezena34 = porDezena(estatisticas, 34);

      expect(dezena34.probAusencia).toBeCloseTo(Math.pow(0.9, 43), 12);
    });
  });

  describe('período "ultimos:50"', () => {
    const estatisticas = calcularEstatisticas(historico, { tipo: 'ultimos', quantidade: 50 });

    it('reproduz as frequências dos últimos 50 concursos', () => {
      expect(porDezena(estatisticas, 43).frequencia).toBe(11);
      expect(porDezena(estatisticas, 11).frequencia).toBe(10);
      expect(porDezena(estatisticas, 16).frequencia).toBe(10);
      expect(porDezena(estatisticas, 48).frequencia).toBe(9);
    });

    it('soma das frequências é 50 × 6', () => {
      expect(estatisticas.reduce((soma, e) => soma + e.frequencia, 0)).toBe(300);
    });
  });

  describe('período "ano:2025"', () => {
    const estatisticas = calcularEstatisticas(historico, { tipo: 'ano', ano: 2025 });

    it('reproduz as mais sorteadas do ano', () => {
      expect(porDezena(estatisticas, 15).frequencia).toBe(24);
      expect(porDezena(estatisticas, 54).frequencia).toBe(23);
    });

    it('reproduz as menos sorteadas do ano', () => {
      expect(porDezena(estatisticas, 26).frequencia).toBe(9);
      expect(porDezena(estatisticas, 41).frequencia).toBe(9);
    });
  });

  it('reproduz a distribuição de pares', () => {
    const distribuicao = distribuicaoPares(historico);

    expect(distribuicao).toEqual([
      { pares: 0, total: 40 },
      { pares: 1, total: 271 },
      { pares: 2, total: 738 },
      { pares: 3, total: 944 },
      { pares: 4, total: 747 },
      { pares: 5, total: 292 },
      { pares: 6, total: 38 },
    ]);
  });

  it('reproduz a distribuição da soma em faixas de 20', () => {
    const faixas = distribuicaoSoma(historico, 20);
    const total = (inicio: number): number | undefined => faixas.find((f) => f.inicio === inicio)?.total;

    expect(total(60)).toBe(13);
    expect(total(80)).toBe(43);
    expect(total(100)).toBe(117);
    expect(faixas.reduce((soma, f) => soma + f.total, 0)).toBe(3070);
  });

  it('resume por ano: soma dos concursos é 3070, 1996 é o primeiro e 2026 existe', () => {
    const resumo = resumoPorAno(historico);

    expect(resumo[0].ano).toBe(1996);
    expect(resumo.some((r) => r.ano === 2026)).toBe(true);
    expect(resumo.reduce((soma, r) => soma + r.concursos, 0)).toBe(3070);
  });

  it('frequência por mês cobre 12 meses distintos, de 2025-11 a 2026-10', () => {
    const linhas = frequenciaPorMes(historico, 12);
    const meses = [...new Set(linhas.map((l) => l.anoMes))];

    expect(meses).toHaveLength(12);
    expect(meses[0]).toBe('2025-11');
    expect(meses[meses.length - 1]).toBe('2026-10');
  });
});
