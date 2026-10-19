import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { Concurso } from '@sorteios/core';
import { TabelaResultadosComponent } from './tabela-resultados.component';

function concurso(parcial: Partial<Concurso> & Pick<Concurso, 'numero' | 'data'>): Concurso {
  return {
    dezenas: [19, 27, 29, 43, 54, 60],
    acumulou: false,
    premiacoes: [],
    valorAcumuladoCentavos: BigInt(0),
    estimativaProximoCentavos: BigInt(0),
    arrecadacaoCentavos: BigInt(0),
    acumuladoEspecialCentavos: BigInt(0),
    locaisGanhadores: [],
    ...parcial,
  };
}

describe('TabelaResultadosComponent', () => {
  let fixture: ComponentFixture<TabelaResultadosComponent>;
  const host = () => fixture.nativeElement as HTMLElement;
  const linhas = () => Array.from(host().querySelectorAll('tbody tr'));
  const celulas = (linha: Element) => Array.from(linha.querySelectorAll('td'));

  const acumulado = concurso({
    numero: 3070,
    data: '2026-10-14',
    acumulou: true,
    premiacoes: [{ faixa: 1, ganhadores: 0, rateioCentavos: BigInt(0) }],
    valorAcumuladoCentavos: BigInt(15269598822),
    estimativaProximoCentavos: BigInt(17000000000),
  });
  const pago = concurso({
    numero: 3069,
    data: '2026-10-11',
    dezenas: [1, 2, 3, 4, 5, 6],
    acumulou: false,
    premiacoes: [{ faixa: 1, ganhadores: 2, rateioCentavos: BigInt(123400) }],
    valorAcumuladoCentavos: BigInt(0),
    estimativaProximoCentavos: BigInt(300000),
  });

  beforeEach(async () => {
    fixture = TestBed.createComponent(TabelaResultadosComponent);
    fixture.componentRef.setInput('concursos', [acumulado, pago]);
    await fixture.whenStable();
  });

  it('renderiza o cabeçalho com as 7 colunas e uma linha por concurso', () => {
    const titulos = Array.from(host().querySelectorAll('th')).map((th) => th.textContent?.trim());

    expect(titulos).toEqual([
      'Concurso',
      'Data',
      'Dezenas',
      'Situação',
      'Ganhadores (Sena)',
      'Prêmio / acumulado',
      'Estimativa seguinte',
    ]);
    expect(linhas()).toHaveLength(2);
    expect(host().querySelector('.tbl-wrap table')).not.toBeNull();
  });

  it('mostra número, data em dd/mm/aaaa e uma bola pequena por dezena', () => {
    const [numero, data, dezenas] = celulas(linhas()[0]);

    expect(numero.textContent).toBe('3070');
    expect(data.textContent).toBe('14/10/2026');
    expect(Array.from(dezenas.querySelectorAll('srt-bola')).map((b) => b.firstChild?.textContent)).toEqual([
      '19',
      '27',
      '29',
      '43',
      '54',
      '60',
    ]);
    expect(dezenas.querySelector('srt-bola')?.classList).toContain('pequena');
  });

  it('marca a situação com a pill correta', () => {
    expect(celulas(linhas()[0])[3].querySelector('.pill.acum')?.textContent).toBe('Acumulou');
    expect(celulas(linhas()[1])[3].querySelector('.pill.pago')?.textContent).toBe('Prêmio pago');
    expect(host().querySelectorAll('.pill')).toHaveLength(2);
  });

  it('cita o prêmio principal da loteria no cabeçalho de ganhadores (rotuloPrincipal)', async () => {
    // Arrange / Act
    fixture.componentRef.setInput('rotuloPrincipal', '20 acertos');
    await fixture.whenStable();

    // Assert
    const titulos = Array.from(host().querySelectorAll('th')).map((th) => th.textContent?.trim());
    expect(titulos[4]).toBe('Ganhadores (20 acertos)');
  });

  it('mostra as 20 dezenas da Lotomania (inclusive 00) em bolas pequenas', async () => {
    // Arrange
    const vinte = Array.from({ length: 20 }, (_, i) => i * 5);
    fixture.componentRef.setInput('concursos', [concurso({ numero: 2900, data: '2026-10-16', dezenas: vinte })]);

    // Act
    await fixture.whenStable();

    // Assert
    const bolas = Array.from(host().querySelectorAll('tbody srt-bola'));
    expect(bolas).toHaveLength(20);
    expect(bolas[0].firstChild?.textContent).toBe('00');
    expect(bolas[19].firstChild?.textContent).toBe('95');
  });

  it('mostra o valor acumulado quando acumulou e o rateio da faixa 1 quando houve ganhador', () => {
    expect(celulas(linhas()[0])[5].textContent).toBe('R$ 152,7 mi');
    expect(celulas(linhas()[1])[5].textContent).toBe('R$ 1.234');
  });

  it('mostra ganhadores da faixa 1 e a estimativa do concurso seguinte formatada', () => {
    expect(celulas(linhas()[0])[4].textContent).toBe('0');
    expect(celulas(linhas()[1])[4].textContent).toBe('2');
    expect(celulas(linhas()[0])[6].textContent).toBe('R$ 170 mi');
    expect(celulas(linhas()[1])[6].textContent).toBe('R$ 3.000');
  });

  it('trata concurso sem faixa 1 como zero ganhador e prêmio zero', async () => {
    fixture.componentRef.setInput('concursos', [concurso({ numero: 1, data: '1996-03-11' })]);
    await fixture.whenStable();

    const colunas = celulas(linhas()[0]);
    expect(colunas[4].textContent).toBe('0');
    expect(colunas[5].textContent).toBe('R$ 0');
  });
});
