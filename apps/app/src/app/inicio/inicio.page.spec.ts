import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import type { Historico } from '@sorteios/core';
import { MEGA_SENA } from '@sorteios/loterias/mega-sena';
import { formatarDataBR, formatarReais } from '@sorteios/ui';
import { HistoricoStore } from '../dados/historico.store';
import { CorLoteriaServico } from '../tema/cor-loteria.servico';
import { HistoricoStoreFalso, LOTOMANIA_FALSA, historicoLotomaniaFalso } from '../testes/stores-fake';
import { InicioPage } from './inicio.page';

describe('InicioPage', () => {
  let store: HistoricoStoreFalso;
  let fixture: ComponentFixture<InicioPage>;

  const raiz = () => fixture.nativeElement as HTMLElement;
  const cartoes = () => Array.from(raiz().querySelectorAll<HTMLElement>('.cartao:not(.em-breve)'));
  const cartao = (id: string) => raiz().querySelector<HTMLElement>(`.cartao[data-loteria="${id}"]`)!;
  const texto = (elemento: Element | null | undefined) => elemento?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  async function renderizar(): Promise<void> {
    fixture = TestBed.createComponent(InicioPage);
    await fixture.whenStable();
  }

  beforeEach(() => {
    document.documentElement.style.removeProperty('--cor-loteria');
    document.documentElement.removeAttribute('data-tinta');
    store = new HistoricoStoreFalso();
    store.loterias.set([MEGA_SENA, LOTOMANIA_FALSA]);
    TestBed.configureTestingModule({
      providers: [provideIonicAngular(), provideRouter([]), { provide: HistoricoStore, useValue: store }],
    });
  });

  it('mostra o título "Sorteios" e a barra só com a marca e o tema', async () => {
    // Arrange / Act
    await renderizar();

    // Assert
    expect(texto(raiz().querySelector('h2'))).toBe('Sorteios');
    expect(raiz().querySelector('srt-barra-superior .brand')).not.toBeNull();
    expect(raiz().querySelector('srt-barra-superior nav')).toBeNull();
    expect(raiz().querySelector('srt-barra-superior button.tema')).not.toBeNull();
  });

  describe('cartões das loterias disponíveis', () => {
    beforeEach(async () => {
      await renderizar();
    });

    it('mostra um cartão por loteria da API, com o nome', () => {
      // Arrange / Act / Assert
      expect(cartoes().map((c) => texto(c.querySelector('h3')))).toEqual(['Mega-Sena', 'Lotomania']);
    });

    it('cada cartão tem "Gerar jogos" e "Ver todos os resultados" apontando para o jogo certo', () => {
      // Arrange / Act
      const links = (id: string) =>
        Array.from(cartao(id).querySelectorAll<HTMLAnchorElement>('a')).map((a) => [texto(a), a.getAttribute('href')]);

      // Assert
      expect(links('megasena')).toEqual([
        ['Gerar jogos', '/megasena/gerar'],
        ['Ver todos os resultados', '/megasena/resultados'],
      ]);
      expect(links('lotomania')).toEqual([
        ['Gerar jogos', '/lotomania/gerar'],
        ['Ver todos os resultados', '/lotomania/resultados'],
      ]);
    });

    it('usa a cor do jogo na borda e no selo, com o texto claro ou escuro conforme a luminância', () => {
      // Arrange / Act / Assert
      expect(cartao('megasena').style.getPropertyValue('--cor-cartao')).toBe('#209869');
      expect(cartao('megasena').getAttribute('data-tinta')).toBe('clara');
      expect(cartao('lotomania').style.getPropertyValue('--cor-cartao')).toBe('#f78100');
      expect(cartao('lotomania').getAttribute('data-tinta')).toBe('escura');
    });

    it('o selo mostra a quantidade de dezenas sorteadas ("06", "20")', () => {
      // Arrange / Act / Assert
      expect(texto(cartao('megasena').querySelector('.selo'))).toBe('06');
      expect(texto(cartao('lotomania').querySelector('.selo'))).toBe('20');
    });

    it('sem histórico carregado mostra só o nome (sem último concurso nem situação)', () => {
      // Arrange / Act / Assert
      expect(raiz().querySelector('[data-teste="ultimo"]')).toBeNull();
    });
  });

  describe('último concurso e situação', () => {
    it('mostra número, data, situação e estimativa só no cartão da loteria cujo histórico está carregado', async () => {
      // Arrange
      const historico: Historico = historicoLotomaniaFalso(30);
      store.loteria.set(LOTOMANIA_FALSA);
      store.historico.set(historico);
      const ultimo = historico.concursos.at(-1)!;

      // Act
      await renderizar();

      // Assert
      expect(raiz().querySelectorAll('[data-teste="ultimo"]')).toHaveLength(1);
      expect(cartao('megasena').querySelector('[data-teste="ultimo"]')).toBeNull();
      const resumo = texto(cartao('lotomania').querySelector('[data-teste="ultimo"]'));
      expect(resumo).toContain(`Concurso ${ultimo.numero} · ${formatarDataBR(ultimo.data)}`);
      expect(resumo).toContain(`Estimativa do próximo: ${formatarReais(ultimo.estimativaProximoCentavos)}`);
    });

    it('informa o acumulado quando o último concurso acumulou', async () => {
      // Arrange
      store.loteria.set(LOTOMANIA_FALSA);
      store.historico.set(historicoLotomaniaFalso(28)); // o 28º concurso (i = 27) não paga: acumulou

      // Act
      await renderizar();

      // Assert
      const ultimo = store.ultimo()!;
      expect(ultimo.acumulou).toBe(true);
      expect(texto(cartao('lotomania').querySelector('.situacao'))).toBe(
        `Acumulado em ${formatarReais(ultimo.valorAcumuladoCentavos)}`,
      );
    });

    it('informa os ganhadores quando o último concurso teve ganhador do prêmio principal', async () => {
      // Arrange
      store.loteria.set(LOTOMANIA_FALSA);
      store.historico.set(historicoLotomaniaFalso(25)); // 25º concurso (i = 24) paga com 1 ganhador

      // Act
      await renderizar();

      // Assert
      expect(store.ultimo()!.acumulou).toBe(false);
      expect(texto(cartao('lotomania').querySelector('.situacao'))).toBe('Teve 1 ganhador (20 acertos)');
    });
  });

  describe('cartões "em breve"', () => {
    it('lista Lotofácil, Quina e Dupla Sena desabilitadas, sem botões nem links', async () => {
      // Arrange / Act
      await renderizar();
      const emBreve = Array.from(raiz().querySelectorAll<HTMLElement>('.cartao.em-breve'));

      // Assert
      expect(emBreve.map((c) => texto(c.querySelector('h3')))).toEqual(['Lotofácil', 'Quina', 'Dupla Sena']);
      for (const c of emBreve) {
        expect(c.getAttribute('aria-disabled')).toBe('true');
        expect(c.querySelector('a, button')).toBeNull();
        expect(texto(c)).toContain('Em breve');
      }
    });

    it('uma loteria que a API já entrega deixa de ser "em breve" e vira cartão ativo', async () => {
      // Arrange
      store.loterias.set([MEGA_SENA, LOTOMANIA_FALSA, { ...LOTOMANIA_FALSA, id: 'quina', nome: 'Quina', cor: '#260085' }]);

      // Act
      await renderizar();

      // Assert
      expect(cartoes().map((c) => texto(c.querySelector('h3')))).toEqual(['Mega-Sena', 'Lotomania', 'Quina']);
      expect(Array.from(raiz().querySelectorAll('.cartao.em-breve h3')).map((h) => texto(h))).toEqual([
        'Lotofácil',
        'Dupla Sena',
      ]);
    });
  });

  describe('cor e carregamento', () => {
    it('volta ao neutro: remove a cor do jogo que estava aplicada no <html>', async () => {
      // Arrange
      TestBed.inject(CorLoteriaServico).definir('#f78100');

      // Act
      await renderizar();

      // Assert
      expect(document.documentElement.style.getPropertyValue('--cor-loteria')).toBe('');
      expect(document.documentElement.hasAttribute('data-tinta')).toBe(false);
    });

    it('ao voltar pela pilha do Ionic (ionViewWillEnter) também volta ao neutro', async () => {
      // Arrange
      await renderizar();
      TestBed.inject(CorLoteriaServico).definir('#209869');

      // Act
      fixture.componentInstance.ionViewWillEnter();

      // Assert
      expect(document.documentElement.style.getPropertyValue('--cor-loteria')).toBe('');
    });

    it('pede o carregamento do histórico da loteria ativa, sem deixar a falha vazar', async () => {
      // Arrange
      const carregar = jest.spyOn(store, 'carregar').mockRejectedValue(new Error('sem rede'));

      // Act
      await renderizar();

      // Assert
      expect(carregar).toHaveBeenCalledTimes(1);
      expect(cartoes()).toHaveLength(2);
    });
  });
});
