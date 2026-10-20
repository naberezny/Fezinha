import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { LoteriaDefinicao } from '@sorteios/core';
import { VolanteComponent } from './volante.component';

const megaSena: LoteriaDefinicao = {
  id: 'megasena',
  nome: 'Mega-Sena',
  universo: 60,
  primeiraDezena: 1,
  sorteadas: 6,
  aposta: { min: 6, max: 20 },
  volante: { colunas: 10, linhas: 6 },
  quadrantes: 4,
  faixas: [{ faixa: 1, acertos: 6, nome: 'Sena' }],
  diasSorteio: [3, 6],
  regrasDisponiveis: [],
};

/** Lotomania: 00..99, volante 10 x 10, 50 dezenas por aposta. */
const lotomania: LoteriaDefinicao = {
  id: 'lotomania',
  nome: 'Lotomania',
  universo: 100,
  primeiraDezena: 0,
  sorteadas: 20,
  aposta: { min: 50, max: 50 },
  volante: { colunas: 10, linhas: 10 },
  quadrantes: 4,
  faixas: [{ faixa: 1, acertos: 20, nome: '20 acertos' }],
  diasSorteio: [1, 3, 5],
  regrasDisponiveis: [],
};

describe('VolanteComponent', () => {
  let fixture: ComponentFixture<VolanteComponent>;

  const botoes = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
  const botao = (dezena: number) => botoes()[dezena - 1];

  beforeEach(async () => {
    fixture = TestBed.createComponent(VolanteComponent);
    fixture.componentRef.setInput('definicao', megaSena);
    fixture.componentRef.setInput('limite', 2);
    await fixture.whenStable();
  });

  it('renderiza 60 botões na grade 10x6 com role group', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(botoes()).toHaveLength(60);
    expect(host.getAttribute('role')).toBe('group');
    expect(host.style.gridTemplateColumns).toContain('repeat(10');
  });

  it('marca a dezena clicada e desmarca no segundo clique', async () => {
    botao(7).click();
    await fixture.whenStable();
    expect(botao(7).getAttribute('aria-pressed')).toBe('true');
    expect(fixture.componentInstance.selecionadas()).toEqual([7]);

    botao(7).click();
    await fixture.whenStable();
    expect(botao(7).getAttribute('aria-pressed')).toBe('false');
    expect(fixture.componentInstance.selecionadas()).toEqual([]);
  });

  it('ignora o clique em dezenas livres quando atingiu o limite, mas ainda permite desmarcar', async () => {
    botao(30).click();
    botao(5).click();
    botao(40).click();
    await fixture.whenStable();

    expect(fixture.componentInstance.selecionadas()).toEqual([5, 30]);
    expect(botao(40).getAttribute('aria-pressed')).toBe('false');

    botao(5).click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selecionadas()).toEqual([30]);
  });

  it('descreve dezena e quadrante no aria-label', () => {
    expect(botao(51).getAttribute('aria-label')).toBe('dezena 51, quadrante 3');
    expect(botao(1).getAttribute('aria-label')).toBe('dezena 01, quadrante 1');
    expect(botao(10).getAttribute('aria-label')).toBe('dezena 10, quadrante 2');
    expect(botao(60).getAttribute('aria-label')).toBe('dezena 60, quadrante 4');
  });

  describe('com a definição da Lotomania (01..99 e 00 por último, como no bilhete)', () => {
    beforeEach(async () => {
      fixture = TestBed.createComponent(VolanteComponent);
      fixture.componentRef.setInput('definicao', lotomania);
      fixture.componentRef.setInput('limite', 50);
      await fixture.whenStable();
    });

    const botaoDaDezena = (dezena: number) => botoes()[dezena === 0 ? 99 : dezena - 1];

    it('renderiza 100 botões na grade 10x10, do 01 ao 99 e o 00 por último', () => {
      // Arrange / Act
      const rotulos = botoes().map((b) => b.textContent?.trim());

      // Assert
      expect(botoes()).toHaveLength(100);
      expect((fixture.nativeElement as HTMLElement).style.gridTemplateColumns).toContain('repeat(10');
      expect(rotulos[0]).toBe('01');
      expect(rotulos[9]).toBe('10');
      expect(rotulos[98]).toBe('99');
      expect(rotulos[99]).toBe('00');
    });

    it('permite marcar a dezena 00 e a devolve como o número 0', async () => {
      // Arrange / Act
      botaoDaDezena(0).click();
      await fixture.whenStable();

      // Assert
      expect(botaoDaDezena(0).getAttribute('aria-pressed')).toBe('true');
      expect(fixture.componentInstance.selecionadas()).toEqual([0]);
    });

    it('mantém a dezena 00 depois das demais nas selecionadas', async () => {
      // Arrange / Act
      botaoDaDezena(0).click();
      botaoDaDezena(99).click();
      botaoDaDezena(5).click();
      await fixture.whenStable();

      // Assert
      expect(fixture.componentInstance.selecionadas()).toEqual([5, 99, 0]);
    });

    it('descreve dezena e quadrante pelo rótulo de dois dígitos', () => {
      // Arrange / Act / Assert
      expect(botaoDaDezena(1).getAttribute('aria-label')).toBe('dezena 01, quadrante 1');
      expect(botaoDaDezena(5).getAttribute('aria-label')).toBe('dezena 05, quadrante 1');
      expect(botaoDaDezena(6).getAttribute('aria-label')).toBe('dezena 06, quadrante 2');
      expect(botaoDaDezena(10).getAttribute('aria-label')).toBe('dezena 10, quadrante 2');
      expect(botaoDaDezena(51).getAttribute('aria-label')).toBe('dezena 51, quadrante 3');
      expect(botaoDaDezena(99).getAttribute('aria-label')).toBe('dezena 99, quadrante 4');
      expect(botaoDaDezena(0).getAttribute('aria-label')).toBe('dezena 00, quadrante 4');
    });
  });

  it('reflete selecionadas vindas de fora', async () => {
    fixture.componentRef.setInput('selecionadas', [1, 2]);
    await fixture.whenStable();

    expect(botao(1).getAttribute('aria-pressed')).toBe('true');
    expect(botao(2).getAttribute('aria-pressed')).toBe('true');
    expect(botao(3).getAttribute('aria-pressed')).toBe('false');
  });

  it('as divisórias ficam depois da metade das colunas e linhas (grade 10 × 6: 5 e 3)', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.style.getPropertyValue('--colunas')).toBe('10');
    expect(host.style.getPropertyValue('--linhas')).toBe('6');
    expect(host.style.getPropertyValue('--antes-colunas')).toBe('5');
    expect(host.style.getPropertyValue('--antes-linhas')).toBe('3');
  });

  it('em grade ímpar (5 × 5) as divisórias vão no vão depois da 3ª coluna e da 3ª linha, como os quadrantes do core', async () => {
    fixture.componentRef.setInput('definicao', {
      ...megaSena,
      universo: 25,
      sorteadas: 15,
      volante: { colunas: 5, linhas: 5 },
    });
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.style.getPropertyValue('--antes-colunas')).toBe('3');
    expect(host.style.getPropertyValue('--antes-linhas')).toBe('3');
    expect(botao(3).getAttribute('aria-label')).toBe('dezena 03, quadrante 1');
    expect(botao(4).getAttribute('aria-label')).toBe('dezena 04, quadrante 2');
    expect(botao(13).getAttribute('aria-label')).toBe('dezena 13, quadrante 1');
    expect(botao(18).getAttribute('aria-label')).toBe('dezena 18, quadrante 3');
  });

  it('com quadrantes desligados não há divisórias nem quadrante no aria-label', async () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList.contains('com-quadrantes')).toBe(true);

    fixture.componentRef.setInput('quadrantes', false);
    await fixture.whenStable();

    expect(host.classList.contains('com-quadrantes')).toBe(false);
    expect(botao(7).getAttribute('aria-label')).toBe('dezena 07');
  });
});
