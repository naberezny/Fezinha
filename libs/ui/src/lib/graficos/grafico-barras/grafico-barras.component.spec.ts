import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GraficoBarrasVerticaisComponent, type ItemBarraVertical } from './grafico-barras.component';

describe('GraficoBarrasVerticaisComponent', () => {
  let fixture: ComponentFixture<GraficoBarrasVerticaisComponent>;
  const host = () => fixture.nativeElement as HTMLElement;
  const barras = () => Array.from(host().querySelectorAll('rect.bar'));

  const itens: ItemBarraVertical[] = [
    { rotulo: '01', valor: 10 },
    { rotulo: '02', valor: 30, destaque: true },
    { rotulo: '03', valor: 20 },
    { rotulo: '04', valor: 5, destaque: true, dica: 'dezena <b>04</b>: 5×' },
  ];

  beforeEach(async () => {
    fixture = TestBed.createComponent(GraficoBarrasVerticaisComponent);
    fixture.componentRef.setInput('itens', itens);
    fixture.componentRef.setInput('rotuloAria', 'Frequência por dezena');
    await fixture.whenStable();
  });

  it('desenha uma barra por item, com viewBox 1080×240 e rótulo de acessibilidade', () => {
    const svg = host().querySelector('svg');

    expect(barras()).toHaveLength(4);
    expect(svg?.getAttribute('viewBox')).toBe('0 0 1080 240');
    expect(svg?.getAttribute('aria-label')).toBe('Frequência por dezena');
    expect(barras()[0].getAttribute('rx')).toBe('3');
  });

  it('aplica a classe dim apenas às barras sem destaque', () => {
    expect(barras().map((b) => b.classList.contains('dim'))).toEqual([true, false, true, false]);
  });

  it('não esmaece nada quando nenhum item é destacado', async () => {
    fixture.componentRef.setInput('itens', [
      { rotulo: 'a', valor: 1 },
      { rotulo: 'b', valor: 2 },
    ]);
    await fixture.whenStable();

    expect(host().querySelectorAll('rect.bar.dim')).toHaveLength(0);
  });

  it('desenha 5 linhas de grade (4 divisões) com os rótulos do eixo até o máximo', () => {
    const rotulos = Array.from(host().querySelectorAll('text.ax:not(.rotulo)')).map((t) => t.textContent);

    expect(host().querySelectorAll('line.grid')).toHaveLength(5);
    expect(rotulos).toEqual(['0', '8', '15', '23', '30']);
  });

  it('mostra o valor só acima das barras destacadas por padrão', () => {
    const valores = Array.from(host().querySelectorAll('g > text:not(.ax)')).map((t) => t.textContent);

    expect(valores).toEqual(['30', '5']);
  });

  it('mostra o valor acima de todas as barras no modo "todos" e de nenhuma no modo "nenhum"', async () => {
    fixture.componentRef.setInput('mostrarValorEm', 'todos');
    await fixture.whenStable();
    expect(host().querySelectorAll('g > text:not(.ax)')).toHaveLength(4);

    fixture.componentRef.setInput('mostrarValorEm', 'nenhum');
    await fixture.whenStable();
    expect(host().querySelectorAll('g > text:not(.ax)')).toHaveLength(0);
  });

  it('escreve o rótulo de cada barra com fonte 9 e uma área de hover por barra', () => {
    const rotulos = Array.from(host().querySelectorAll('text.rotulo'));

    expect(rotulos.map((t) => t.textContent)).toEqual(['01', '02', '03', '04']);
    expect(rotulos[0].getAttribute('font-size')).toBe('9');
    expect(host().querySelectorAll('rect.zona')).toHaveLength(4);
  });

  it('mostra a dica da barra ao passar o mouse, usando a dica padrão quando ausente', () => {
    const grupos = host().querySelectorAll('svg g');

    grupos[3].dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10 }));
    expect((document.body.querySelector('.srt-tip') as HTMLElement).innerHTML).toBe('dezena <b>04</b>: 5×');

    grupos[0].dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10 }));
    expect((document.body.querySelector('.srt-tip') as HTMLElement).innerHTML).toBe('<b>01</b>: 10');
  });

  it('aceita qualquer quantidade de itens e cresce o viewBox quando a barra mínima não cabe', async () => {
    const muitos = Array.from({ length: 200 }, (_, i) => ({ rotulo: String(i), valor: i + 1 }));
    fixture.componentRef.setInput('itens', muitos);
    fixture.componentRef.setInput('larguraMinimaBarra', 12);
    await fixture.whenStable();

    expect(barras()).toHaveLength(200);
    expect(host().querySelector('svg')?.getAttribute('viewBox')).toBe(`0 0 ${36 + 8 + 200 * 12} 240`);
  });

  it('renderiza vazio sem erro', async () => {
    fixture.componentRef.setInput('itens', []);
    await fixture.whenStable();

    expect(barras()).toHaveLength(0);
  });
});
