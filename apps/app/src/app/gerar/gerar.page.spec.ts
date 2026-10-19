import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { gerarJogos, type Concurso, type Historico, type LoteriaDefinicao, type ResultadoGeracao } from '@sorteios/core';
import { MEGA_SENA } from '@sorteios/loterias/mega-sena';
import { HistoricoStore, JogosSalvosStore, type JogoSalvo } from '../dados/historico.store';
import { LOTOMANIA_FALSA, historicoLotomaniaFalso } from '../testes/stores-fake';
import { GerarEstado } from './gerar.estado';
import { GerarPage } from './gerar.page';

// Geração determinística: toda chamada de `gerarJogos` usa a semente 1, qualquer que seja o rng recebido.
jest.mock('@sorteios/core', () => {
  const real = jest.requireActual('@sorteios/core');
  return { ...real, gerarJogos: jest.fn((historico, config) => real.gerarJogos(historico, config, real.criarRng(1))) };
});

function concursoTeste(numero: number, data: string, dezenas: number[]): Concurso {
  return {
    numero,
    data,
    dezenas: [...dezenas].sort((a, b) => a - b),
    acumulou: true,
    premiacoes: [],
    valorAcumuladoCentavos: 0n,
    estimativaProximoCentavos: 0n,
    arrecadacaoCentavos: 0n,
    acumuladoEspecialCentavos: 0n,
    locaisGanhadores: [],
  };
}

function historicoPequeno(): Historico {
  return {
    loteria: MEGA_SENA,
    concursos: [
      concursoTeste(1, '2025-12-27', [1, 2, 3, 4, 5, 6]),
      concursoTeste(2, '2026-01-03', [7, 8, 9, 10, 11, 12]),
      concursoTeste(3, '2026-10-14', [13, 14, 15, 16, 17, 18]),
    ],
  };
}

class HistoricoStoreFalso extends HistoricoStore {
  readonly loterias = signal<LoteriaDefinicao[]>([MEGA_SENA]);
  readonly selecionadas: string[] = [];
  readonly loteria = signal<LoteriaDefinicao>(MEGA_SENA);
  readonly historico = signal<Historico | undefined>(historicoPequeno());
  readonly ultimo = computed(() => this.historico()?.concursos.at(-1));
  readonly carregando = signal(false);
  readonly erro = signal<string | undefined>(undefined);
  readonly atualizadoEm = signal<string | undefined>(undefined);
  readonly somenteCache = signal(false);
  chamadasCarregar = 0;

  async selecionarLoteria(id: string): Promise<void> {
    this.selecionadas.push(id);
  }

  async carregar(): Promise<void> {
    this.chamadasCarregar++;
  }
  async atualizar(): Promise<void> {
    /* sem rede */
  }
}

class JogosSalvosStoreFalso extends JogosSalvosStore {
  readonly jogos = signal<JogoSalvo[]>([]);

  async carregar(): Promise<void> {
    /* vazio */
  }
  async salvar(_jogos: Omit<JogoSalvo, 'id' | 'criadoEm'>[]): Promise<void> {
    /* espionado nos testes */
  }
  async remover(_id: string): Promise<void> {
    /* não usado */
  }
}

/** Deixa as promessas pendentes terminarem e a detecção de mudanças rodar. */
async function estabilizar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise<void>((resolver) => setTimeout(resolver, 0));
  await fixture.whenStable();
}

function definirNavegador(propriedade: 'clipboard' | 'share', valor: unknown): void {
  Object.defineProperty(navigator, propriedade, { value: valor, configurable: true, writable: true });
}

describe('GerarPage', () => {
  let store: HistoricoStoreFalso;
  let salvos: JogosSalvosStoreFalso;
  let fixture: ComponentFixture<GerarPage>;

  const raiz = () => fixture.nativeElement as HTMLElement;
  const q = <T extends Element = HTMLElement>(seletor: string) => raiz().querySelector<T>(seletor);
  const qa = <T extends Element = HTMLElement>(seletor: string) => Array.from(raiz().querySelectorAll<T>(seletor));
  const texto = (seletor: string) => (q(seletor)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const botaoGerar = () => q<HTMLButtonElement>('button[type="submit"]')!;
  const botaoCopiar = () => q<HTMLButtonElement>('#gerar-copiar')!;
  const botaoSalvar = () => q<HTMLButtonElement>('#gerar-salvar')!;
  const botaoExportar = () => q<HTMLButtonElement>('#gerar-exportar')!;

  async function criarPagina(): Promise<void> {
    fixture = TestBed.createComponent(GerarPage);
    await fixture.whenStable();
  }

  async function gerar(): Promise<void> {
    botaoGerar().click();
    await estabilizar(fixture);
  }

  beforeEach(() => {
    store = new HistoricoStoreFalso();
    salvos = new JogosSalvosStoreFalso();
    jest.mocked(gerarJogos).mockClear();
    definirNavegador('clipboard', undefined);
    definirNavegador('share', undefined);
    TestBed.configureTestingModule({
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: HistoricoStore, useValue: store },
        { provide: JogosSalvosStore, useValue: salvos },
      ],
    });
  });

  afterEach(() => {
    definirNavegador('clipboard', undefined);
    definirNavegador('share', undefined);
  });

  describe('cabeçalho e carregamento', () => {
    it('mostra o título e a base de concursos com a data do último', async () => {
      // Arrange / Act
      await criarPagina();

      // Assert
      expect(texto('.eyebrow')).toBe('Tela inicial');
      expect(texto('h2')).toBe('Gerar jogos');
      expect(texto('#gerar-base')).toBe('Base: 3 concursos, último em 14/10/2026');
    });

    it('carrega o histórico ao iniciar', async () => {
      // Arrange / Act
      await criarPagina();

      // Assert
      expect(store.chamadasCarregar).toBe(1);
    });

    it('com histórico indisponível desabilita Gerar e avisa que está carregando', async () => {
      // Arrange
      store.historico.set(undefined);

      // Act
      await criarPagina();

      // Assert
      expect(botaoGerar().disabled).toBe(true);
      expect(texto('#gerar-status-historico')).toBe('Carregando histórico…');
      expect(q('#gerar-base')).toBeNull();
    });

    it('habilita Gerar e some a mensagem quando o histórico chega', async () => {
      // Arrange
      store.historico.set(undefined);
      await criarPagina();

      // Act
      store.historico.set(historicoPequeno());
      await fixture.whenStable();

      // Assert
      expect(botaoGerar().disabled).toBe(false);
      expect(q('#gerar-status-historico')).toBeNull();
    });

    it('mostra o erro de rede sem histórico e continua bloqueando o Gerar', async () => {
      // Arrange
      store.historico.set(undefined);
      store.erro.set('Sem conexão com o servidor.');

      // Act
      await criarPagina();

      // Assert
      expect(botaoGerar().disabled).toBe(true);
      expect(texto('#gerar-status-historico')).toBe('Sem conexão com o servidor.');
    });

    it('com erro de rede mas cache disponível mostra só um aviso discreto e não bloqueia', async () => {
      // Arrange
      store.erro.set('Sem conexão com o servidor.');

      // Act
      await criarPagina();

      // Assert
      expect(botaoGerar().disabled).toBe(false);
      expect(q('#gerar-status-historico')).toBeNull();
      expect(texto('srt-aviso')).toContain('Sem conexão com o servidor.');
    });
  });

  describe('configuração', () => {
    beforeEach(async () => {
      await criarPagina();
    });

    it('não tem o seletor "Tipo de jogo": mostra o jogo da rota com "trocar jogo" e o atalho dos resultados', () => {
      // Arrange / Act / Assert
      expect(q('#gerar-loteria')).toBeNull();
      expect(texto('.titulo-jogo')).toBe('Mega-Sena · trocar jogo');
      expect(q<HTMLAnchorElement>('#gerar-trocar-jogo')!.getAttribute('href')).toBe('/');
      expect(texto('#gerar-regras-aposta')).toBe('6 a 20 dezenas de 60');
      expect(texto('#gerar-ver-resultados')).toBe('Ver todos os resultados');
      expect(q<HTMLAnchorElement>('#gerar-ver-resultados')!.getAttribute('href')).toBe('/megasena/resultados');
    });

    it('mostra o estado padrão: 5 jogos, 6 dezenas, 1 combinação e chance de 1 em 50.063.860', () => {
      // Arrange / Act / Assert
      expect(q<HTMLInputElement>('#gerar-quantidade')?.value).toBe('5');
      expect(q<HTMLInputElement>('#gerar-dezenas')?.value).toBe('6');
      expect(texto('#gerar-combinacoes')).toBe('1');
      expect(texto('#gerar-chance')).toBe('1 em 50.063.860');
      expect(texto('.resumo-aposta')).toContain('Chance do prêmio principal (Sena) por jogo');
    });

    it('mostra os 4 modos com "Dezenas atrasadas" marcada e a seção aberta', () => {
      // Arrange / Act
      const radios = qa<HTMLInputElement>('input[name="gerar-modo"]');

      // Assert
      expect(radios.map((r) => r.value)).toEqual(['atrasadas', 'frequentes', 'mista', 'aleatorio']);
      expect(radios.map((r) => r.checked)).toEqual([true, false, false, false]);
      expect(texto('.modo .t')).toContain('Dezenas atrasadas');
      expect(texto('.modo .t .d')).toBe('padrão');
      expect(q('details')?.hasAttribute('open')).toBe(true);
    });

    it('mostra os parâmetros de atraso com os valores padrão', () => {
      // Arrange / Act / Assert
      expect(q<HTMLInputElement>('#gerar-atraso-minimo')?.value).toBe('10');
      expect(q<HTMLInputElement>('#gerar-intensidade')?.value).toBe('2');
      expect(qa('.escala span').map((s) => s.textContent)).toEqual(['suave', 'equilibrado', 'só as mais atrasadas']);
      expect(texto('#gerar-intensidade-texto')).toBe(TestBed.inject(GerarEstado).textoIntensidade());
      expect(texto('#gerar-intensidade-texto')).toContain('há 20 concursos tem 5× mais chance');
    });

    it('atualiza o texto vivo quando o slider de intensidade muda', async () => {
      // Arrange
      const slider = q<HTMLInputElement>('#gerar-intensidade')!;

      // Act
      slider.value = '3';
      slider.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      // Assert
      expect(TestBed.inject(GerarEstado).intensidade()).toBe(3);
      expect(texto('#gerar-intensidade-texto')).toContain('há 20 concursos tem 9× mais chance');
      expect(texto('#gerar-intensidade-texto')).toBe(TestBed.inject(GerarEstado).textoIntensidade());
      expect(texto('.params .p .hint b')).toBe('3');
    });

    it('atualiza o texto vivo quando o atraso mínimo muda', async () => {
      // Arrange
      const campo = q<HTMLInputElement>('#gerar-atraso-minimo')!;

      // Act
      campo.value = '25';
      campo.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      // Assert
      expect(TestBed.inject(GerarEstado).atrasoMinimo()).toBe(25);
      expect(texto('#gerar-intensidade-texto')).toContain('há 20 concursos tem 1× mais chance');
    });

    it('troca para "frequentes": mostra a janela de concursos e esconde os parâmetros de atraso', async () => {
      // Arrange
      const frequentes = q<HTMLInputElement>('input[name="gerar-modo"][value="frequentes"]')!;

      // Act
      frequentes.click();
      await fixture.whenStable();

      // Assert
      const opcoes = qa<HTMLOptionElement>('#gerar-janela option').map((o) => o.textContent?.trim());
      expect(opcoes).toEqual(['últimos 50', 'últimos 100', 'ano 2026', 'ano 2025', 'histórico todo']);
      expect(q('#gerar-atraso-minimo')).toBeNull();
      expect(TestBed.inject(GerarEstado).estrategia()).toBe('frequentes');
    });

    it('muda a janela de frequência pelo select', async () => {
      // Arrange
      q<HTMLInputElement>('input[name="gerar-modo"][value="frequentes"]')!.click();
      await fixture.whenStable();
      const select = q<HTMLSelectElement>('#gerar-janela')!;

      // Act
      select.value = 'anoAnterior';
      select.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      // Assert
      expect(TestBed.inject(GerarEstado).janelaFrequencia()).toBe('anoAnterior');
    });

    it('o aviso de "Suas dezenas" aparece e marcar dezenas no volante atualiza o resumo', async () => {
      // Arrange
      const secoes = qa('srt-acordeao-secao');
      const volante = () => q('srt-volante')!;

      // Act
      volante().querySelector<HTMLButtonElement>('button[aria-label^="dezena 10,"]')!.click();
      volante().querySelector<HTMLButtonElement>('button[aria-label^="dezena 03,"]')!.click();
      await fixture.whenStable();

      // Assert
      expect(secoes).toHaveLength(4);
      expect(texto('srt-aviso')).toContain('Você não precisa marcar nada.');
      expect(TestBed.inject(GerarEstado).fixas()).toEqual([3, 10]);
      expect(texto('srt-acordeao-secao:nth-of-type(2) summary')).toContain('03 10 · o sistema completa 4');
      expect(qa('srt-volante button')).toHaveLength(60);
    });

    it('os switches refletem o padrão e alteram as regras', async () => {
      // Arrange
      const marcado = (id: string) => q<HTMLInputElement>(`#gerar-regra-${id}`)!.checked;

      // Act / Assert
      expect(['quadrantes', 'colunas', 'linhas', 'historico', 'pares', 'consecutivas'].map(marcado)).toEqual([
        true,
        true,
        false,
        true,
        true,
        true,
      ]);

      q<HTMLInputElement>('#gerar-regra-linhas')!.click();
      await fixture.whenStable();

      expect(TestBed.inject(GerarEstado).regras()['linhas']).toBe(true);
      expect(texto('srt-acordeao-secao:nth-of-type(3) summary')).toContain('3 de 3 ligadas');
    });

    it('com mais de 10 dezenas a regra de colunas some (não fica desabilitada) e a legenda de pares acompanha', async () => {
      // Arrange
      const entrada = q<HTMLInputElement>('#gerar-dezenas')!;
      const mais = entrada.closest('srt-stepper')!.querySelector<HTMLButtonElement>('button[aria-label="mais"]')!;
      const switchColunas = () => q('#gerar-regra-colunas')?.closest('srt-switch');
      const switchPares = () => q('#gerar-regra-pares')!.closest('srt-switch')!;
      expect(switchPares().textContent).toContain('(2 a 4 pares em 6)');
      expect(switchColunas()!.textContent).toContain('(10 colunas)');

      // Act
      for (let i = 0; i < 3; i++) mais.click(); // 9 dezenas
      await fixture.whenStable();
      const paresCom9 = switchPares().textContent;
      const colunasCom9 = switchColunas();
      for (let i = 0; i < 3; i++) mais.click(); // 12 dezenas
      await fixture.whenStable();

      // Assert
      expect(paresCom9).toContain('(3 a 6 pares em 9)');
      expect(colunasCom9).toBeTruthy();
      expect(q('#gerar-regra-colunas')).toBeNull();
      expect(q('#gerar-regra-historico')).toBeNull();
      expect(TestBed.inject(GerarEstado).regras()['colunas']).toBe(false);
      expect(qa('srt-switch input').map((i) => i.id)).toEqual([
        'gerar-regra-quadrantes',
        'gerar-regra-linhas',
        'gerar-regra-pares',
        'gerar-regra-consecutivas',
      ]);
      expect(texto('srt-acordeao-secao:nth-of-type(3) summary')).toContain('1 de 2 ligadas');
      expect(texto('srt-acordeao-secao:nth-of-type(4) summary')).toContain('2 de 2 ligados');
      expect(texto('#gerar-combinacoes')).toBe('924');
      expect(texto('#gerar-chance')).toBe('1 em 54.182');
    });

    it('a regra oculta volta à lista quando as dezenas voltam a permitir (desligada)', async () => {
      // Arrange
      const estado = TestBed.inject(GerarEstado);
      estado.definirDezenasPorJogo(12);
      await fixture.whenStable();
      expect(q('#gerar-regra-colunas')).toBeNull();

      // Act
      estado.definirDezenasPorJogo(8);
      await fixture.whenStable();

      // Assert
      expect(q<HTMLInputElement>('#gerar-regra-colunas')!.checked).toBe(false);
      expect(q<HTMLInputElement>('#gerar-regra-colunas')!.disabled).toBe(false);
    });

    it('uma loteria só com filtros estatísticos não mostra a seção "Regras do volante"', async () => {
      // Arrange
      const soEstatistica: LoteriaDefinicao = { ...LOTOMANIA_FALSA, id: 'so-pares', regrasDisponiveis: ['pares'] };

      // Act
      store.loterias.set([MEGA_SENA, soEstatistica]);
      store.loteria.set(soEstatistica);
      store.historico.set(historicoLotomaniaFalso());
      await fixture.whenStable();

      // Assert
      const titulos = qa('srt-acordeao-secao').map((secao) => secao.getAttribute('titulo'));
      expect(titulos).toEqual(['Modo de geração', 'Suas dezenas (opcional)', 'Filtros estatísticos']);
      expect(qa('srt-switch input').map((i) => i.id)).toEqual(['gerar-regra-pares']);
    });

    it('apara as fixas quando o usuário reduz as dezenas por jogo', async () => {
      // Arrange
      const estado = TestBed.inject(GerarEstado);
      estado.definirDezenasPorJogo(8);
      estado.definirFixas([1, 2, 3, 4, 5, 6, 7, 8]);
      await fixture.whenStable();
      const menos = q('#gerar-dezenas')!.closest('srt-stepper')!.querySelector<HTMLButtonElement>('button[aria-label="menos"]')!;

      // Act
      menos.click();
      menos.click();
      await fixture.whenStable();

      // Assert
      expect(estado.dezenasPorJogo()).toBe(6);
      expect(estado.fixas()).toEqual([1, 2, 3, 4, 5, 6]);
      expect(qa('srt-volante button[aria-pressed="true"]')).toHaveLength(6);
    });
  });

  describe('saída', () => {
    beforeEach(async () => {
      await criarPagina();
    });

    it('começa com o estado vazio e os botões de ação desabilitados', () => {
      // Arrange / Act / Assert
      expect(texto('#gerar-vazio')).toContain('Configure ao lado e clique em Gerar jogos.');
      expect(texto('#gerar-titulo-saida')).toBe('Jogos gerados');
      expect(qa('srt-jogo')).toHaveLength(0);
      expect(botaoCopiar().disabled).toBe(true);
      expect(botaoSalvar().disabled).toBe(true);
      expect(botaoExportar().disabled).toBe(true);
      expect(qa('srt-aviso').at(-1)?.textContent).toContain('Cada sorteio é independente.');
      expect(qa('srt-aviso').at(-1)?.textContent).toContain('não é afiliado à Caixa Econômica Federal e não realiza apostas');
    });

    it('gera os jogos pedidos e renderiza um srt-jogo para cada um', async () => {
      // Arrange / Act
      await gerar();

      // Assert
      expect(qa('srt-jogo')).toHaveLength(5);
      expect(qa('srt-jogo')[0].querySelectorAll('srt-bola')).toHaveLength(6);
      expect(texto('#gerar-titulo-saida')).toBe('5 jogos · 6 dezenas · modo atrasadas');
      expect(q('#gerar-vazio')).toBeNull();
      expect(texto('#gerar-legenda-atraso')).toContain('O número pequeno em cada bola é o atraso da dezena');
      expect(botaoCopiar().disabled).toBe(false);
      expect(botaoSalvar().disabled).toBe(false);
      expect(botaoExportar().disabled).toBe(false);
    });

    it('mostra os atrasos do histórico nas bolas', async () => {
      // Arrange
      const estado = TestBed.inject(GerarEstado);

      // Act
      await gerar();
      const primeira = qa('srt-jogo')[0].querySelector('srt-bola')!;
      const dezena = estado.jogos()[0].dezenas[0];

      // Assert
      expect(primeira.querySelector('.at')?.textContent).toBe(String(estado.atrasos()[dezena]));
    });

    it('destaca com o anel as dezenas fixas escolhidas', async () => {
      // Arrange
      TestBed.inject(GerarEstado).definirFixas([7]);
      await fixture.whenStable();

      // Act
      await gerar();

      // Assert
      expect(qa('srt-jogo srt-bola.fixa').length).toBe(5);
      expect(texto('srt-jogo srt-bola.fixa')).toContain('07');
    });

    it('mostra a mensagem de "nenhum jogo" quando as regras reprovam tudo', async () => {
      // Arrange
      TestBed.inject(GerarEstado).definirFixas([1, 2, 3, 4, 5, 6]);
      await fixture.whenStable();

      // Act
      await gerar();

      // Assert
      expect(texto('#gerar-sem-jogos')).toContain('Nenhum jogo passou pelas regras e filtros.');
      expect(qa('srt-jogo')).toHaveLength(0);
      expect(botaoCopiar().disabled).toBe(true);
    });

    it('avisa quando só parte dos jogos pôde ser gerada', async () => {
      // Arrange
      const parcial: ResultadoGeracao = {
        jogos: [{ dezenas: [3, 6, 32, 42, 46, 51], atrasoMedio: 3, pares: 3, quadrantes: 4 }],
        incompleto: true,
        tentativas: 20000,
      };
      jest.mocked(gerarJogos).mockReturnValueOnce(parcial);

      // Act
      await gerar();

      // Assert
      expect(qa('srt-jogo')).toHaveLength(1);
      expect(texto('#gerar-aviso-incompleto')).toContain('Só foi possível gerar 1 de 5 jogos');
    });

    it('Limpar apaga a lista e volta ao estado vazio', async () => {
      // Arrange
      await gerar();

      // Act
      qa<HTMLButtonElement>('.acoes .btn').find((b) => b.textContent?.trim() === 'Limpar')!.click();
      await fixture.whenStable();

      // Assert
      expect(qa('srt-jogo')).toHaveLength(0);
      expect(q('#gerar-vazio')).not.toBeNull();
      expect(texto('#gerar-titulo-saida')).toBe('Jogos gerados');
    });

    describe('copiar', () => {
      const jogoFixo: ResultadoGeracao = {
        jogos: [{ dezenas: [3, 6, 32, 42, 46, 51], atrasoMedio: 3, pares: 3, quadrantes: 4 }],
        incompleto: false,
        tentativas: 1,
      };

      it('escreve cada jogo como "Jogo 01: 03 06 32 42 46 51" na área de transferência', async () => {
        // Arrange
        const escrever = jest.fn().mockResolvedValue(undefined);
        definirNavegador('clipboard', { writeText: escrever });
        jest.mocked(gerarJogos).mockReturnValueOnce(jogoFixo);
        TestBed.inject(GerarEstado).definirQuantidadeJogos(1);
        await gerar();

        // Act
        botaoCopiar().click();
        await estabilizar(fixture);

        // Assert
        expect(escrever).toHaveBeenCalledWith('Jogo 01: 03 06 32 42 46 51');
        expect(botaoCopiar().textContent?.trim()).toBe('Copiado');
      });

      it('junta vários jogos, um por linha', async () => {
        // Arrange
        const escrever = jest.fn().mockResolvedValue(undefined);
        definirNavegador('clipboard', { writeText: escrever });
        const dois: ResultadoGeracao = {
          jogos: [
            { dezenas: [3, 6, 32, 42, 46, 51], atrasoMedio: 3, pares: 3, quadrantes: 4 },
            { dezenas: [1, 14, 20, 33, 47, 58], atrasoMedio: 2, pares: 3, quadrantes: 4 },
          ],
          incompleto: false,
          tentativas: 2,
        };
        jest.mocked(gerarJogos).mockReturnValueOnce(dois);
        await gerar();

        // Act
        botaoCopiar().click();
        await estabilizar(fixture);

        // Assert
        expect(escrever).toHaveBeenCalledWith('Jogo 01: 03 06 32 42 46 51\nJogo 02: 01 14 20 33 47 58');
      });

      it('sem Clipboard API cai para textarea + execCommand', async () => {
        // Arrange
        const executar = jest.fn().mockReturnValue(true);
        (document as unknown as { execCommand: unknown }).execCommand = executar;
        jest.mocked(gerarJogos).mockReturnValueOnce(jogoFixo);
        await gerar();

        // Act
        botaoCopiar().click();
        await estabilizar(fixture);

        // Assert
        expect(executar).toHaveBeenCalledWith('copy');
        expect(botaoCopiar().textContent?.trim()).toBe('Copiado');
        expect(document.querySelector('textarea')).toBeNull();
        delete (document as unknown as { execCommand?: unknown }).execCommand;
      });

      it('não troca o rótulo quando a cópia falha', async () => {
        // Arrange
        definirNavegador('clipboard', { writeText: jest.fn().mockRejectedValue(new Error('negado')) });
        (document as unknown as { execCommand: unknown }).execCommand = jest.fn().mockReturnValue(false);
        await gerar();

        // Act
        botaoCopiar().click();
        await estabilizar(fixture);

        // Assert
        expect(botaoCopiar().textContent?.trim()).toBe('Copiar');
        delete (document as unknown as { execCommand?: unknown }).execCommand;
      });
    });

    describe('salvar', () => {
      it('grava os jogos no repositório e mostra a confirmação inline', async () => {
        // Arrange
        const salvar = jest.spyOn(salvos, 'salvar');
        await gerar();

        // Act
        botaoSalvar().click();
        await estabilizar(fixture);

        // Assert
        expect(salvar).toHaveBeenCalledTimes(1);
        const gravados = salvar.mock.calls[0][0];
        expect(gravados).toHaveLength(5);
        expect(gravados[0]).toEqual({
          loteriaId: 'megasena',
          dezenas: TestBed.inject(GerarEstado).jogos()[0].dezenas,
          estrategia: 'atrasadas',
          concursoBase: 3,
        });
        expect(texto('#gerar-confirmacao-salvo')).toBe('5 jogos salvos em Meus jogos');
        expect(botaoSalvar().textContent?.trim()).toBe('Salvo');
        expect(botaoSalvar().disabled).toBe(true);
      });

      it('não salva duas vezes o mesmo resultado e libera de novo após gerar outros jogos', async () => {
        // Arrange
        const salvar = jest.spyOn(salvos, 'salvar');
        await gerar();
        botaoSalvar().click();
        await estabilizar(fixture);

        // Act
        botaoSalvar().click();
        await estabilizar(fixture);
        const aposSegundoClique = salvar.mock.calls.length;
        await gerar();

        // Assert
        expect(aposSegundoClique).toBe(1);
        expect(botaoSalvar().disabled).toBe(false);
        expect(q('#gerar-confirmacao-salvo')).toBeNull();
      });

      it('mostra um erro e permite tentar de novo quando o salvamento falha', async () => {
        // Arrange
        jest.spyOn(salvos, 'salvar').mockRejectedValueOnce(new Error('IndexedDB indisponível'));
        await gerar();

        // Act
        botaoSalvar().click();
        await estabilizar(fixture);

        // Assert
        expect(texto('[role="alert"]')).toBe('Não foi possível salvar os jogos. Tente de novo.');
        expect(q('#gerar-confirmacao-salvo')).toBeNull();
        expect(botaoSalvar().disabled).toBe(false);
      });
    });

    describe('exportar', () => {
      it('usa o compartilhamento nativo quando existe', async () => {
        // Arrange
        const compartilhar = jest.fn().mockResolvedValue(undefined);
        definirNavegador('share', compartilhar);
        await gerar();
        const esperado = TestBed.inject(GerarEstado).textoJogos();

        // Act
        botaoExportar().click();
        await estabilizar(fixture);

        // Assert
        expect(compartilhar).toHaveBeenCalledWith({ title: 'Jogos da Mega-Sena', text: esperado });
      });

      it('sem compartilhamento nativo copia o texto', async () => {
        // Arrange
        const escrever = jest.fn().mockResolvedValue(undefined);
        definirNavegador('clipboard', { writeText: escrever });
        await gerar();
        const esperado = TestBed.inject(GerarEstado).textoJogos();

        // Act
        botaoExportar().click();
        await estabilizar(fixture);

        // Assert
        expect(escrever).toHaveBeenCalledWith(esperado);
        expect(botaoExportar().textContent?.trim()).toBe('Copiado');
      });

      it('cancelar o compartilhamento não copia nada', async () => {
        // Arrange
        const escrever = jest.fn().mockResolvedValue(undefined);
        definirNavegador('clipboard', { writeText: escrever });
        definirNavegador('share', jest.fn().mockRejectedValue(Object.assign(new Error('cancelado'), { name: 'AbortError' })));
        await gerar();

        // Act
        botaoExportar().click();
        await estabilizar(fixture);

        // Assert
        expect(escrever).not.toHaveBeenCalled();
        expect(botaoExportar().textContent?.trim()).toBe('Exportar');
      });
    });
  });

  describe('com a Lotomania ativa (fake 100/20/50)', () => {
    beforeEach(async () => {
      store.loterias.set([MEGA_SENA, LOTOMANIA_FALSA]);
      store.loteria.set(LOTOMANIA_FALSA);
      store.historico.set(historicoLotomaniaFalso());
      await criarPagina();
    });

    it('mostra "Lotomania · trocar jogo" e o atalho dos resultados da Lotomania', () => {
      // Arrange / Act / Assert
      expect(q('#gerar-loteria')).toBeNull();
      expect(texto('.titulo-jogo')).toBe('Lotomania · trocar jogo');
      expect(texto('#gerar-regras-aposta')).toBe('50 dezenas de 100');
      expect(q<HTMLAnchorElement>('#gerar-trocar-jogo')!.getAttribute('href')).toBe('/');
      expect(q<HTMLAnchorElement>('#gerar-ver-resultados')!.getAttribute('href')).toBe('/lotomania/resultados');
    });

    it('a página não troca a loteria: quem a seleciona é a rota (casca do jogo)', async () => {
      // Arrange / Act
      await estabilizar(fixture);

      // Assert
      expect(store.selecionadas).toEqual([]);
    });

    it('mostra o volante com 100 dezenas, de 01 a 99 e o 00 por último, na seção "Suas dezenas"', () => {
      // Arrange / Act
      const botoes = qa<HTMLButtonElement>('srt-volante button');

      // Assert
      expect(botoes).toHaveLength(100);
      expect(botoes[0].textContent?.trim()).toBe('01');
      expect(botoes[98].textContent?.trim()).toBe('99');
      expect(botoes[99].textContent?.trim()).toBe('00');
      expect(q('srt-volante')?.getAttribute('aria-label')).toBe('volante da Lotomania');
    });

    it('mostra o stepper de dezenas por jogo fixo em 50 (desabilitado) e esconde "Combinações por jogo"', () => {
      // Arrange / Act
      const entrada = q<HTMLInputElement>('#gerar-dezenas')!;

      // Assert
      expect(entrada.value).toBe('50');
      expect(entrada.disabled).toBe(true);
      expect(entrada.closest('srt-stepper')!.querySelector<HTMLButtonElement>('button[aria-label="mais"]')!.disabled).toBe(true);
      expect(q('#gerar-combinacoes')).toBeNull();
      expect(texto('.resumo-aposta')).not.toContain('Combinações por jogo');
    });

    it('mantém a chance e cita o prêmio principal da definição ("20 acertos")', () => {
      // Arrange / Act / Assert
      expect(texto('.resumo-aposta')).toContain('Chance do prêmio principal (20 acertos) por jogo');
      expect(texto('#gerar-chance')).toMatch(/^1 em 11\.372\.6\d\d$/);
    });

    it('mostra só as regras que se aplicam à Lotomania com 50 dezenas (quadrantes e pares)', () => {
      // Arrange / Act
      const switches = qa('srt-switch input').map((i) => i.id);

      // Assert
      expect(switches).toEqual(['gerar-regra-quadrantes', 'gerar-regra-pares']);
      expect(q('#gerar-regra-colunas')).toBeNull();
      expect(q('#gerar-regra-historico')).toBeNull();
      expect(q('#gerar-regra-consecutivas')).toBeNull();
      expect(texto('srt-acordeao-secao:nth-of-type(3) summary')).toContain('1 de 1 ligadas');
      expect(texto('srt-acordeao-secao:nth-of-type(4) summary')).toContain('1 de 1 ligados');
    });

    it('a regra "linhas" some: 50 dezenas não cabem com no máximo 3 por linha (3 x 10 = 30)', () => {
      // Arrange / Act / Assert
      expect(q('#gerar-regra-linhas')).toBeNull();
      expect(TestBed.inject(GerarEstado).regras()['linhas']).toBe(false);
      expect(texto('srt-acordeao')).not.toContain('impossível');
    });

    it('gera jogos de 50 dezenas entre 00 e 99 e mostra as bolas com dois dígitos', async () => {
      // Arrange
      qa<HTMLButtonElement>('srt-volante button')[99].click(); // fixa a dezena 00 (última casa do volante)
      await fixture.whenStable();

      // Act
      await gerar();

      // Assert
      const jogos = TestBed.inject(GerarEstado).jogos();
      expect(jogos).toHaveLength(5);
      for (const jogo of jogos) {
        expect(jogo.dezenas).toHaveLength(50);
        expect(jogo.dezenas.every((d) => d >= 0 && d <= 99)).toBe(true);
        expect(jogo.dezenas.at(-1)).toBe(0);
      }
      expect(texto('#gerar-titulo-saida')).toBe('5 jogos · 50 dezenas · modo atrasadas');
      expect(qa('#gerar-jogos srt-bola')).toHaveLength(250);
      const bolasDoPrimeiroJogo = qa('#gerar-jogos srt-jogo')[0].querySelectorAll('srt-bola');
      expect(bolasDoPrimeiroJogo[0].textContent).not.toContain('00');
      expect(bolasDoPrimeiroJogo[49].textContent).toContain('00'); // o 00 fecha o jogo, como no volante
    });

    it('a legenda do atraso cita o atraso esperado da Lotomania (5 concursos)', async () => {
      // Arrange / Act
      await gerar();

      // Assert
      expect(texto('#gerar-legenda-atraso')).toContain('o esperado por dezena é 5 concursos');
    });

    it('o modo atrasadas informa o atraso esperado de 5 e exemplos em múltiplos dele (10, 15 e 20)', () => {
      // Arrange / Act
      const texto_ = texto('#gerar-intensidade-texto');

      // Assert
      expect(texto('.params .hint')).toContain('esperado: 5');
      expect(texto_).toContain('não sai há 10 concursos');
      expect(texto_).toContain('há 15 concursos');
      expect(texto_).toContain('há 20,');
    });
  });
});
