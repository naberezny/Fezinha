import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GraficoColunasComponent } from './grafico-colunas.component';

describe('GraficoColunasComponent', () => {
  let fixture: ComponentFixture<GraficoColunasComponent>;
  const host = () => fixture.nativeElement as HTMLElement;

  const itens = [
    { rotulo: '24', valor: 12 },
    { rotulo: '25', valor: 1234, dica: '2025: <b>1.234</b> concursos' },
    { rotulo: '26', valor: 0 },
  ];

  beforeEach(async () => {
    fixture = TestBed.createComponent(GraficoColunasComponent);
    fixture.componentRef.setInput('itens', itens);
    fixture.componentRef.setInput('rotuloAria', 'Acumulados por ano');
    await fixture.whenStable();
  });

  it('desenha uma coluna por item, num viewBox 520×170, com linha de base', () => {
    const svg = host().querySelector('svg');

    expect(svg?.getAttribute('viewBox')).toBe('0 0 520 170');
    expect(svg?.getAttribute('aria-label')).toBe('Acumulados por ano');
    expect(host().querySelectorAll('rect.bar')).toHaveLength(3);
    expect(host().querySelectorAll('line.base')).toHaveLength(1);
    expect(host().querySelector('line.base')?.getAttribute('y1')).toBe('144');
  });

  it('mostra o valor formatado acima e o rótulo embaixo de cada coluna', () => {
    expect(Array.from(host().querySelectorAll('text.valor')).map((t) => t.textContent)).toEqual(['12', '1.234', '0']);
    expect(Array.from(host().querySelectorAll('text.rotulo')).map((t) => t.textContent)).toEqual(['24', '25', '26']);
  });

  it('altura da coluna é proporcional ao maior valor, e valor zero tem altura zero', () => {
    const alturas = Array.from(host().querySelectorAll('rect.bar')).map((r) => Number(r.getAttribute('height')));

    expect(alturas[1]).toBeCloseTo(170 - 14 - 26, 5);
    expect(alturas[2]).toBe(0);
  });

  it('mostra a dica ao passar o mouse', () => {
    host().querySelectorAll('svg g')[1].dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 5 }));

    expect((document.body.querySelector('.srt-tip') as HTMLElement).innerHTML).toBe('2025: <b>1.234</b> concursos');
  });
});
