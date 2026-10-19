import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListaBarrasComponent } from './lista-barras.component';

describe('ListaBarrasComponent', () => {
  let fixture: ComponentFixture<ListaBarrasComponent>;
  const host = () => fixture.nativeElement as HTMLElement;
  const linhas = () => Array.from(host().querySelectorAll('.li'));

  beforeEach(() => {
    fixture = TestBed.createComponent(ListaBarrasComponent);
  });

  it('renderiza uma bola pequena como rótulo quando há dezena', async () => {
    fixture.componentRef.setInput('itens', [
      { rotulo: '10', valor: 40, bola: 10, valorTexto: '40×' },
      { rotulo: '05', valor: 20, bola: 5, valorTexto: '20×' },
    ]);
    await fixture.whenStable();

    const bolas = Array.from(host().querySelectorAll('srt-bola'));
    expect(linhas()).toHaveLength(2);
    expect(bolas.map((b) => b.firstChild?.textContent)).toEqual(['10', '05']);
    expect(bolas[0].classList).toContain('pequena');
    expect(host().querySelector('.rotulo')).toBeNull();
    expect(Array.from(host().querySelectorAll('.li > .num')).map((v) => v.textContent)).toEqual(['40×', '20×']);
  });

  it('usa o rótulo em mono quando não há bola e o valor formatado quando não há valorTexto', async () => {
    fixture.componentRef.setInput('itens', [
      { rotulo: 'SP', valor: 1500 },
      { rotulo: 'RJ', valor: 750 },
    ]);
    await fixture.whenStable();

    expect(host().querySelectorAll('srt-bola')).toHaveLength(0);
    expect(Array.from(host().querySelectorAll('.rotulo')).map((r) => r.textContent)).toEqual(['SP', 'RJ']);
    expect(Array.from(host().querySelectorAll('.li > .num:last-child')).map((v) => v.textContent)).toEqual(['1.500', '750']);
  });

  it('dimensiona cada barra como porcentagem do maior valor', async () => {
    fixture.componentRef.setInput('itens', [
      { rotulo: 'A', valor: 80 },
      { rotulo: 'B', valor: 20 },
      { rotulo: 'C', valor: 0 },
    ]);
    await fixture.whenStable();

    const larguras = Array.from(host().querySelectorAll('.track i')).map((i) => (i as HTMLElement).style.width);
    expect(larguras).toEqual(['100%', '25%', '0%']);
  });

  it('com `maximo` informado, dimensiona as barras por ele e não pelo maior valor da lista', async () => {
    fixture.componentRef.setInput('itens', [
      { rotulo: 'A', valor: 20 },
      { rotulo: 'B', valor: 10 },
    ]);
    fixture.componentRef.setInput('maximo', 80);
    await fixture.whenStable();

    const larguras = Array.from(host().querySelectorAll('.track i')).map((i) => (i as HTMLElement).style.width);
    expect(larguras).toEqual(['25%', '12.5%']);
  });

  it('com `maximo` menor que um valor, a barra não passa de 100%', async () => {
    fixture.componentRef.setInput('itens', [{ rotulo: 'A', valor: 50 }]);
    fixture.componentRef.setInput('maximo', 20);
    await fixture.whenStable();

    expect((host().querySelector('.track i') as HTMLElement).style.width).toBe('100%');
  });

  it('não quebra com lista vazia', async () => {
    fixture.componentRef.setInput('itens', []);
    await fixture.whenStable();

    expect(linhas()).toHaveLength(0);
  });
});
