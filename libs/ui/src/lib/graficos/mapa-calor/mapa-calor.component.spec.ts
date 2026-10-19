import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapaCalorComponent } from './mapa-calor.component';

describe('MapaCalorComponent', () => {
  let fixture: ComponentFixture<MapaCalorComponent>;
  const host = () => fixture.nativeElement as HTMLElement;
  const celulas = () => Array.from(host().querySelectorAll('.r .c'));

  const linhas = [
    { rotulo: '25/11', chave: '2025-11' },
    { rotulo: '25/12', chave: '2025-12' },
  ];
  const valores = new Map<string, number>([
    ['2025-11|1', 1],
    ['2025-11|2', 3],
    ['2025-11|3', 9],
    ['2025-12|4', 2],
  ]);

  beforeEach(async () => {
    fixture = TestBed.createComponent(MapaCalorComponent);
    fixture.componentRef.setInput('linhas', linhas);
    fixture.componentRef.setInput('colunas', 6);
    fixture.componentRef.setInput('valores', valores);
    await fixture.whenStable();
  });

  it('renderiza linhas × colunas células e o cabeçalho com um rótulo por coluna', () => {
    const cabecalho = Array.from(host().querySelectorAll('.hx span')).map((s) => s.textContent);

    expect(host().querySelectorAll('.r')).toHaveLength(2);
    expect(celulas()).toHaveLength(12);
    expect(cabecalho).toEqual(['', '01', '02', '03', '04', '05', '06']);
    expect(Array.from(host().querySelectorAll('.l')).map((l) => l.textContent)).toEqual(['25/11', '25/12']);
  });

  it('define data-v por célula: ausente = 0 e valores altos limitados a 4', () => {
    const niveis = celulas().map((c) => c.getAttribute('data-v'));

    expect(niveis.slice(0, 6)).toEqual(['1', '3', '4', '0', '0', '0']);
    expect(niveis.slice(6)).toEqual(['0', '0', '0', '2', '0', '0']);
  });

  it('aceita valores como Record', async () => {
    fixture.componentRef.setInput('valores', { '2025-12|6': 2 });
    await fixture.whenStable();

    expect(celulas()[11].getAttribute('data-v')).toBe('2');
    expect(celulas()[0].getAttribute('data-v')).toBe('0');
  });

  it('usa rotuloColuna no cabeçalho e na dica', async () => {
    fixture.componentRef.setInput('rotuloColuna', (c: number) => `D${c}`);
    await fixture.whenStable();
    expect(host().querySelectorAll('.hx span')[1].textContent).toBe('D1');

    celulas()[2].dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 5 }));
    expect((document.body.querySelector('.srt-tip') as HTMLElement).innerHTML).toBe('<b>D3</b> em 25/11: 9×');
  });

  it('esconde a dica ao sair da célula', () => {
    celulas()[0].dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 5 }));
    celulas()[0].dispatchEvent(new MouseEvent('mouseleave'));

    expect((document.body.querySelector('.srt-tip') as HTMLElement).style.display).toBe('none');
  });

  it('ajusta o grid ao número de colunas', () => {
    expect((host().querySelector('.r') as HTMLElement).style.gridTemplateColumns).toBe('44px repeat(6, minmax(0, 1fr))');
  });

  it('sem larguraMinimaColuna o mapa se ajusta à tela (sem largura mínima)', () => {
    expect((host().querySelector('.heat') as HTMLElement).style.minWidth).toBe('');
  });

  it('com larguraMinimaColuna o mapa mantém células legíveis e rola na horizontal (100 dezenas)', async () => {
    // Arrange
    fixture.componentRef.setInput('colunas', 100);
    fixture.componentRef.setInput('larguraMinimaColuna', 10);
    fixture.componentRef.setInput('rotuloColuna', (coluna: number) => String(coluna - 1).padStart(2, '0'));

    // Act
    await fixture.whenStable();

    // Assert
    const cabecalho = Array.from(host().querySelectorAll('.hx span')).map((s) => s.textContent);
    expect(celulas()).toHaveLength(200);
    expect(cabecalho[1]).toBe('00');
    expect(cabecalho[100]).toBe('99');
    expect((host().querySelector('.heat') as HTMLElement).style.minWidth).toBe('1244px');
    expect(host().querySelector('.rolagem')).not.toBeNull();
  });
});
