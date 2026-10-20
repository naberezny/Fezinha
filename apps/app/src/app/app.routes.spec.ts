import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Route, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideIonicAngular } from '@ionic/angular';
import { appRoutes } from './app.routes';
import { HistoricoStore, JogosSalvosStore } from './dados/historico.store';
import { EstatisticasPage } from './estatisticas/estatisticas.page';
import { GerarPage } from './gerar/gerar.page';
import { InicioPage } from './inicio/inicio.page';
import { JogoShellPage } from './jogo/jogo-shell.page';
import { MeusJogosPage } from './meus-jogos/meus-jogos.page';
import { ResultadosPage } from './resultados/resultados.page';
import { TestePage } from './teste/teste.page';
import { HistoricoStoreFalso, JogosSalvosStoreFalso } from './testes/stores-fake';

type CarregarComponente = () => Promise<Type<unknown>>;

describe('appRoutes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideIonicAngular(),
        provideRouter(appRoutes),
        { provide: HistoricoStore, useClass: HistoricoStoreFalso },
        { provide: JogosSalvosStore, useClass: JogosSalvosStoreFalso },
      ],
    });
  });

  function rota(caminho: string, rotas: Route[] = appRoutes): Route {
    const encontrada = rotas.find((r) => r.path === caminho);
    if (!encontrada) {
      throw new Error(`Rota "${caminho}" não declarada`);
    }
    return encontrada;
  }

  describe('configuração', () => {
    it('a raiz é a tela inicial, carregada de forma preguiçosa', async () => {
      // Arrange
      const raiz = rota('');

      // Act
      const componente = await (raiz.loadComponent as CarregarComponente)();

      // Assert
      expect(raiz.pathMatch).toBe('full');
      expect(raiz.redirectTo).toBeUndefined();
      expect(componente).toBe(InicioPage);
    });

    it('":loteria" carrega a casca do jogo de forma preguiçosa', async () => {
      // Arrange
      const casca = rota(':loteria');

      // Act
      const componente = await (casca.loadComponent as CarregarComponente)();

      // Assert
      expect(componente).toBe(JogoShellPage);
    });

    it('a casca do jogo abre em "gerar" e tem gerar, resultados, estatisticas, meus-jogos e teste como filhas preguiçosas', async () => {
      // Arrange
      const filhas = rota(':loteria').children ?? [];

      // Act
      const [gerar, resultados, estatisticas, meusJogos, teste] = await Promise.all(
        ['gerar', 'resultados', 'estatisticas', 'meus-jogos', 'teste'].map((caminho) => (rota(caminho, filhas).loadComponent as CarregarComponente)()),
      );

      // Assert
      expect(rota('', filhas)).toMatchObject({ pathMatch: 'full', redirectTo: 'gerar' });
      expect(filhas.map((f) => f.path)).toEqual(['', 'gerar', 'resultados', 'estatisticas', 'meus-jogos', 'teste']);
      expect(gerar).toBe(GerarPage);
      expect(resultados).toBe(ResultadosPage);
      expect(estatisticas).toBe(EstatisticasPage);
      expect(meusJogos).toBe(MeusJogosPage);
      expect(teste).toBe(TestePage);
    });

    it.each([
      ['gerar', 'megasena/gerar'],
      ['resultados', 'megasena/resultados'],
      ['estatisticas', 'megasena/estatisticas'],
    ])('o caminho antigo "%s" redireciona para "%s"', (caminho, destino) => {
      // Arrange / Act
      const antiga = rota(caminho);

      // Assert
      expect(antiga).toMatchObject({ pathMatch: 'full', redirectTo: destino });
    });

    it('os caminhos antigos vêm antes de ":loteria" (senão "gerar" seria lido como loteria)', () => {
      // Arrange
      const caminhos = appRoutes.map((r) => r.path);

      // Act / Assert
      for (const antigo of ['gerar', 'resultados', 'estatisticas']) {
        expect(caminhos.indexOf(antigo)).toBeLessThan(caminhos.indexOf(':loteria'));
      }
    });

    it('um endereço desconhecido volta para a tela inicial', () => {
      // Arrange / Act / Assert
      expect(rota('**')).toMatchObject({ redirectTo: '' });
    });
  });

  describe('navegação', () => {
    it('a raiz mostra a tela inicial com o título "Sorteios"', async () => {
      // Arrange
      const harness = await RouterTestingHarness.create();

      // Act
      await harness.navigateByUrl('/');

      // Assert
      expect(TestBed.inject(Router).url).toBe('/');
      expect(harness.routeNativeElement?.querySelector('h2')?.textContent).toBe('Sorteios');
    });

    it.each([
      ['/gerar', '/megasena/gerar'],
      ['/resultados', '/megasena/resultados'],
      ['/estatisticas', '/megasena/estatisticas'],
      ['/megasena', '/megasena/gerar'],
      ['/qualquer/coisa/aqui', '/'],
    ])('%s resolve para %s', async (url, esperada) => {
      // Arrange
      const harness = await RouterTestingHarness.create();

      // Act
      await harness.navigateByUrl(url);

      // Assert
      expect(TestBed.inject(Router).url).toBe(esperada);
    });
  });
});
