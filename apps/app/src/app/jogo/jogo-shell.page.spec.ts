import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideIonicAngular } from '@ionic/angular';
import { MEGA_SENA } from '@sorteios/loterias/mega-sena';
import { HistoricoStore } from '../dados/historico.store';
import { HistoricoStoreFalso, LOTOMANIA_FALSA } from '../testes/stores-fake';
import { JogoShellPage } from './jogo-shell.page';

@Component({ template: '<p data-teste="pagina">pagina</p>' })
class PaginaFalsa {}

describe('JogoShellPage', () => {
  let store: HistoricoStoreFalso;
  let harness: RouterTestingHarness;

  const raiz = document.documentElement;
  const cor = () => raiz.style.getPropertyValue('--cor-loteria');

  async function navegar(url: string): Promise<HTMLElement | undefined> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harness.detectChanges();
    await harness.fixture.whenStable();
    return harness.routeNativeElement as HTMLElement | undefined;
  }

  beforeEach(() => {
    raiz.style.removeProperty('--cor-loteria');
    raiz.removeAttribute('data-tinta');
    raiz.removeAttribute('data-tinta-escuro');
    store = new HistoricoStoreFalso();
    store.loterias.set([MEGA_SENA, LOTOMANIA_FALSA]);
    TestBed.configureTestingModule({
      providers: [
        provideIonicAngular(),
        provideRouter([
          {
            path: ':loteria',
            component: JogoShellPage,
            children: [
              { path: 'gerar', component: PaginaFalsa },
              { path: 'resultados', component: PaginaFalsa },
            ],
          },
          { path: '', component: PaginaFalsa },
        ]),
        { provide: HistoricoStore, useValue: store },
      ],
    });
  });

  describe('seleção da loteria pela rota', () => {
    it('seleciona no store a loteria do parâmetro da rota', async () => {
      // Arrange / Act
      await navegar('/lotomania/gerar');

      // Assert
      expect(store.selecionadas).toEqual(['lotomania']);
      expect(store.loteria().id).toBe('lotomania');
    });

    it('um id desconhecido redireciona para a tela inicial, sem selecionar nada', async () => {
      // Arrange / Act
      await navegar('/lotofacil/gerar');

      // Assert
      expect(TestBed.inject(Router).url).toBe('/');
      expect(store.selecionadas).toEqual([]);
      expect(cor()).toBe('');
    });

    it('um id ainda desconhecido espera a lista da API e, se ela o traz, abre o jogo em vez de redirecionar', async () => {
      // Arrange
      store.loterias.set([MEGA_SENA]);
      const aguardar = jest.spyOn(store, 'aguardarLoterias').mockImplementation(async () => {
        store.loterias.set([MEGA_SENA, LOTOMANIA_FALSA]);
      });

      // Act
      await navegar('/lotomania/gerar');

      // Assert
      expect(aguardar).toHaveBeenCalledTimes(1);
      expect(TestBed.inject(Router).url).toBe('/lotomania/gerar');
      expect(store.selecionadas).toEqual(['lotomania']);
      expect(cor()).toBe('#f78100');
    });

    it('um id desconhecido mesmo depois da lista da API redireciona para a tela inicial', async () => {
      // Arrange
      const aguardar = jest.spyOn(store, 'aguardarLoterias').mockResolvedValue();

      // Act
      await navegar('/quina/gerar');

      // Assert
      expect(aguardar).toHaveBeenCalledTimes(1);
      expect(TestBed.inject(Router).url).toBe('/');
    });

    it('trocar só o parâmetro da rota seleciona a nova loteria', async () => {
      // Arrange
      await navegar('/megasena/gerar');

      // Act
      await harness.navigateByUrl('/lotomania/gerar');
      harness.detectChanges();
      await harness.fixture.whenStable();

      // Assert
      expect(store.selecionadas).toEqual(['megasena', 'lotomania']);
      expect(cor()).toBe('#f78100');
    });
  });

  describe('cor do jogo', () => {
    it('aplica --cor-loteria e a tinta do jogo no <html> (Mega-Sena: verde, texto claro)', async () => {
      // Arrange / Act
      await navegar('/megasena/gerar');

      // Assert
      expect(cor()).toBe('#209869');
      expect(raiz.getAttribute('data-tinta')).toBe('clara');
    });

    it('Lotomania: laranja, texto escuro', async () => {
      // Arrange / Act
      await navegar('/lotomania/resultados');

      // Assert
      expect(cor()).toBe('#f78100');
      expect(raiz.getAttribute('data-tinta')).toBe('escura');
    });

    it('ao voltar pela pilha do Ionic (ionViewWillEnter) reaplica a cor do jogo', async () => {
      // Arrange
      await navegar('/lotomania/gerar');
      raiz.style.removeProperty('--cor-loteria');
      const casca = harness.routeDebugElement!.componentInstance as JogoShellPage;

      // Act
      casca.ionViewWillEnter();

      // Assert
      expect(cor()).toBe('#f78100');
    });
  });

  describe('navegação do jogo', () => {
    it('mostra o nome do jogo e os links dele na barra superior', async () => {
      // Arrange / Act
      const elemento = await navegar('/lotomania/gerar');
      const links = Array.from(elemento!.querySelectorAll<HTMLAnchorElement>('srt-barra-superior nav a'));

      // Assert
      expect(elemento!.querySelector('srt-barra-superior [data-teste="jogo-nome"]')?.textContent).toBe('Lotomania');
      expect(links.map((l) => l.getAttribute('href'))).toEqual([
        '/lotomania/gerar',
        '/lotomania/resultados',
        '/lotomania/estatisticas',
      ]);
    });

    it('a tab bar do celular tem Início, Gerar, Resultados, Estatísticas e Tema, nessa ordem', async () => {
      // Arrange / Act
      const elemento = await navegar('/megasena/gerar');
      const itens = Array.from(elemento!.querySelectorAll('ion-tab-bar > *'));

      // Assert
      expect(itens.map((i) => i.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
        'Início',
        'Gerar',
        'Resultados',
        'Estatísticas',
        'Tema',
      ]);
      expect(elemento!.querySelector('[data-teste="aba-inicio"]')?.getAttribute('href')).toBe('/');
      expect(Array.from(elemento!.querySelectorAll('ion-tab-button')).map((a) => a.getAttribute('tab'))).toEqual([
        'gerar',
        'resultados',
        'estatisticas',
      ]);
    });

    it('o botão de tema da tab bar alterna o data-theme do <html>', async () => {
      // Arrange
      localStorage.clear();
      raiz.removeAttribute('data-theme');
      const elemento = await navegar('/megasena/gerar');

      // Act
      elemento!.querySelector<HTMLButtonElement>('ion-tab-bar button.aba-tema')!.click();

      // Assert
      expect(raiz.getAttribute('data-theme')).toBe('dark');
    });
  });
});
