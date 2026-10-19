import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { BarraSuperiorComponent, type JogoDaBarra } from './barra-superior.component';

describe('BarraSuperiorComponent', () => {
  let fixture: ComponentFixture<BarraSuperiorComponent>;

  const raiz = () => fixture.nativeElement as HTMLElement;
  const texto = (seletor: string) => raiz().querySelector(seletor)?.textContent?.replace(/\s+/g, ' ').trim();

  async function renderizar(jogo?: JogoDaBarra): Promise<void> {
    fixture = TestBed.createComponent(BarraSuperiorComponent);
    fixture.componentRef.setInput('jogo', jogo);
    await fixture.whenStable();
  }

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({ providers: [provideIonicAngular(), provideRouter([])] });
  });

  describe('sem jogo (tela inicial)', () => {
    beforeEach(async () => {
      await renderizar();
    });

    it('mostra só a marca "Sorteios", com o selo 06 e link para a tela inicial, e o botão de tema', () => {
      // Arrange / Act / Assert
      expect(texto('.brand')).toContain('Sorteios');
      expect(texto('.brand .mark')).toBe('06');
      expect(raiz().querySelector('.brand')?.getAttribute('href')).toBe('/');
      expect(raiz().querySelector('nav')).toBeNull();
      expect(raiz().querySelector('[data-teste="jogo-nome"]')).toBeNull();
      expect(raiz().querySelector('button.tema')).not.toBeNull();
    });

    it('fica visível também no celular (não leva a classe so-desktop)', () => {
      // Arrange / Act / Assert
      expect(raiz().querySelector('header')?.classList.contains('so-desktop')).toBe(false);
    });
  });

  describe('com jogo', () => {
    beforeEach(async () => {
      await renderizar({ id: 'lotomania', nome: 'Lotomania' });
    });

    it('mostra o nome do jogo e os links Gerar, Resultados e Estatísticas dele', () => {
      // Arrange
      const links = Array.from(raiz().querySelectorAll<HTMLAnchorElement>('nav a'));

      // Act / Assert
      expect(texto('[data-teste="jogo-nome"]')).toBe('Lotomania');
      expect(links.map((l) => l.textContent?.trim())).toEqual(['Gerar', 'Resultados', 'Estatísticas']);
      expect(links.map((l) => l.getAttribute('href'))).toEqual([
        '/lotomania/gerar',
        '/lotomania/resultados',
        '/lotomania/estatisticas',
      ]);
    });

    it('a marca continua levando à tela inicial', () => {
      // Arrange / Act / Assert
      expect(raiz().querySelector('.brand')?.getAttribute('href')).toBe('/');
    });

    it('some no celular (leva a classe so-desktop; a navegação é a tab bar)', () => {
      // Arrange / Act / Assert
      expect(raiz().querySelector('header')?.classList.contains('so-desktop')).toBe(true);
    });
  });

  it('o botão de tema alterna o data-theme do <html>', async () => {
    // Arrange
    await renderizar();
    const botao = raiz().querySelector<HTMLButtonElement>('button.tema');

    // Act
    botao?.click();
    await fixture.whenStable();

    // Assert
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(botao?.getAttribute('aria-label')).toBe('Usar tema claro');
  });
});
