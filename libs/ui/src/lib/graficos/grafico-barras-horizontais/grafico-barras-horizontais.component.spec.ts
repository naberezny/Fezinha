import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GraficoBarrasHorizontaisComponent } from './grafico-barras-horizontais.component';

describe('GraficoBarrasHorizontaisComponent', () => {
  let fixture: ComponentFixture<GraficoBarrasHorizontaisComponent>;
  const host = () => fixture.nativeElement as HTMLElement;

  const itens = [
    { rotulo: '34', valor: 43, dica: 'dezena <b>34</b>: 43 concursos sem sair' },
    { rotulo: '07', valor: 20 },
    { rotulo: '51', valor: 10 },
  ];

  beforeEach(async () => {
    fixture = TestBed.createComponent(GraficoBarrasHorizontaisComponent);
    fixture.componentRef.setInput('itens', itens);
    fixture.componentRef.setInput('rotuloAria', 'Atraso atual');
    await fixture.whenStable();
  });

  it('desenha rótulo, barra e valor por item, com viewBox 520×(n×20+16)', () => {
    const svg = host().querySelector('svg');

    expect(svg?.getAttribute('viewBox')).toBe('0 0 520 76');
    expect(svg?.getAttribute('aria-label')).toBe('Atraso atual');
    expect(host().querySelectorAll('rect.bar')).toHaveLength(3);
    expect(Array.from(host().querySelectorAll('text.rotulo')).map((t) => t.textContent)).toEqual(['34', '07', '51']);
    expect(Array.from(host().querySelectorAll('text.valor')).map((t) => t.textContent)).toEqual(['43', '20', '10']);
  });

  it('dimensiona as barras proporcionalmente ao maior valor', () => {
    const larguras = Array.from(host().querySelectorAll('rect.bar')).map((r) => Number(r.getAttribute('width')));

    expect(larguras[0]).toBeCloseTo(520 - 34 - 30, 5);
    expect(larguras[1]).toBeCloseTo(((520 - 34 - 30) * 20) / 43, 5);
  });

  it('não desenha a linha de referência sem o input', () => {
    expect(host().querySelector('line.ref')).toBeNull();
  });

  it('desenha a linha de referência tracejada na posição do valor', async () => {
    fixture.componentRef.setInput('referencia', 10);
    await fixture.whenStable();

    const linha = host().querySelector('line.ref');
    const esperado = 34 + ((520 - 34 - 30) * 10) / 43;
    expect(linha).not.toBeNull();
    expect(Number(linha?.getAttribute('x1'))).toBeCloseTo(esperado, 5);
    expect(linha?.getAttribute('y1')).toBe('4');
    expect(linha?.getAttribute('y2')).toBe('72');
  });

  it('mostra a dica da linha ao passar o mouse', () => {
    host().querySelector('svg g')?.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 5 }));

    expect((document.body.querySelector('.srt-tip') as HTMLElement).innerHTML).toBe('dezena <b>34</b>: 43 concursos sem sair');
  });
});
