import { Type, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import {
  calcularComposicao,
  calcularEstatisticas,
  vereditoDe,
  type Concurso,
  type Historico,
  type LoteriaDefinicao,
} from '@sorteios/core';
import { MEGA_SENA } from '@sorteios/loterias/mega-sena';
import {
  GraficoBarrasHorizontaisComponent,
  GraficoBarrasVerticaisComponent,
  GraficoColunasComponent,
  ListaBarrasComponent,
  MapaCalorComponent,
} from '@sorteios/ui';
import { HistoricoStore } from '../dados/historico.store';
import { LOTOMANIA_FALSA, historicoLotomaniaFalso } from '../testes/stores-fake';
import { EstatisticasPage } from './estatisticas.page';

/** Gerador determinístico (mulberry32) para o histórico sintético. */
function criarGerador(semente: number): () => number {
  let a = semente;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 120 concursos (terça, quinta e sábado) a partir de 02/12/2025, com 6 dezenas sorteadas de forma determinística. */
function gerarHistorico(quantidade: number): Historico {
  const sortear = criarGerador(42);
  const data = new Date('2025-12-02T00:00:00Z');
  const passos = [2, 2, 3];
  const concursos: Concurso[] = [];

  for (let i = 0; i < quantidade; i++) {
    const universo = Array.from({ length: 60 }, (_, k) => k + 1);
    for (let k = 0; k < 6; k++) {
      const j = k + Math.floor(sortear() * (60 - k));
      [universo[k], universo[j]] = [universo[j], universo[k]];
    }
    const paga = i % 7 === 3;
    concursos.push({
      numero: i + 1,
      data: data.toISOString().slice(0, 10),
      dezenas: universo.slice(0, 6).sort((a, b) => a - b),
      acumulou: !paga,
      premiacoes: [{ faixa: 1, ganhadores: paga ? 1 : 0, rateioCentavos: BigInt(paga ? 10_000_000 : 0) }],
      valorAcumuladoCentavos: BigInt(0),
      estimativaProximoCentavos: BigInt(0),
      arrecadacaoCentavos: BigInt(0),
      acumuladoEspecialCentavos: BigInt(0),
      locaisGanhadores: [],
    });
    data.setUTCDate(data.getUTCDate() + passos[i % 3]);
  }
  return { loteria: MEGA_SENA, concursos };
}

class HistoricoStoreFake extends HistoricoStore {
  readonly loterias = signal<LoteriaDefinicao[]>([MEGA_SENA]);
  readonly selecionadas: string[] = [];
  readonly loteria = signal(MEGA_SENA);
  readonly historico = signal<Historico | undefined>(undefined);
  readonly ultimo = computed(() => {
    const concursos = this.historico()?.concursos;
    return concursos?.length ? concursos[concursos.length - 1] : undefined;
  });
  readonly carregando = signal(false);
  readonly erro = signal<string | undefined>(undefined);
  readonly atualizadoEm = signal<string | undefined>(undefined);
  readonly somenteCache = signal(false);

  chamadasCarregar = 0;
  chamadasAtualizar = 0;

  async selecionarLoteria(id: string): Promise<void> {
    this.selecionadas.push(id);
  }

  carregar(): Promise<void> {
    this.chamadasCarregar++;
    return Promise.resolve();
  }

  atualizar(): Promise<void> {
    this.chamadasAtualizar++;
    return Promise.resolve();
  }
}

const dois = (n: number) => String(n).padStart(2, '0');
const dataBR = (iso: string) => iso.split('-').reverse().join('/');

describe('EstatisticasPage', () => {
  let store: HistoricoStoreFake;

  beforeEach(() => {
    store = new HistoricoStoreFake();
    TestBed.configureTestingModule({
      providers: [provideIonicAngular(), provideRouter([]), { provide: HistoricoStore, useValue: store }],
    });
  });

  async function renderizar(): Promise<ComponentFixture<EstatisticasPage>> {
    const fixture = TestBed.createComponent(EstatisticasPage);
    await fixture.whenStable();
    return fixture;
  }

  const raiz = (fixture: ComponentFixture<EstatisticasPage>) => fixture.nativeElement as HTMLElement;
  const texto = (elemento: Element | null | undefined) => elemento?.textContent?.trim() ?? '';

  function kpis(fixture: ComponentFixture<EstatisticasPage>) {
    return Array.from(raiz(fixture).querySelectorAll('srt-kpi')).map((kpi) => ({
      titulo: texto(kpi.querySelector('.eyebrow')),
      valor: texto(kpi.querySelector('.v')),
      detalhe: texto(kpi.querySelector('.s')),
    }));
  }

  /** Botão do segmento (período ou ordenação) pelo rótulo visível. */
  function botaoDoSegmento(fixture: ComponentFixture<EstatisticasPage>, rotulo: string): HTMLButtonElement {
    const botoes = Array.from(raiz(fixture).querySelectorAll<HTMLButtonElement>('srt-segmento button'));
    return botoes.find((b) => texto(b) === rotulo) as HTMLButtonElement;
  }

  async function escolher(fixture: ComponentFixture<EstatisticasPage>, rotulo: string): Promise<void> {
    botaoDoSegmento(fixture, rotulo).click();
    await fixture.whenStable();
  }

  function componente<T>(fixture: ComponentFixture<EstatisticasPage>, tipo: Type<T>, indice = 0): T {
    return fixture.debugElement.queryAll(By.directive(tipo))[indice].componentInstance as T;
  }

  describe('estados', () => {
    it('mostra "Carregando histórico…" e pede o carregamento ao iniciar', async () => {
      // Arrange
      store.carregando.set(true);

      // Act
      const fixture = await renderizar();

      // Assert
      expect(texto(raiz(fixture).querySelector('[data-teste="carregando"]'))).toBe('Carregando histórico…');
      expect(raiz(fixture).querySelector('srt-kpi')).toBeNull();
      expect(raiz(fixture).querySelector('srt-segmento')).toBeNull();
      expect(store.chamadasCarregar).toBe(1);
    });

    it('mostra o erro e permite tentar de novo quando não há histórico nem cache', async () => {
      // Arrange
      store.erro.set('Sem conexão com o servidor.');
      const fixture = await renderizar();

      // Act
      (raiz(fixture).querySelector('[data-teste="tentar-novamente"]') as HTMLButtonElement).click();
      await fixture.whenStable();

      // Assert
      expect(texto(raiz(fixture).querySelector('[data-teste="erro"]'))).toContain('Sem conexão com o servidor.');
      expect(store.chamadasAtualizar).toBe(1);
    });
  });

  describe('com histórico', () => {
    let historico: Historico;
    let concursos: Concurso[];

    /** Frequência de cada dezena (índice 1..60) nos últimos `n` concursos, contada à mão. */
    function frequenciaNosUltimos(n: number): number[] {
      const frequencia = new Array<number>(61).fill(0);
      for (const concurso of concursos.slice(-n)) for (const dezena of concurso.dezenas) frequencia[dezena]++;
      return frequencia;
    }

    /** Dezenas 1..60 da mais para a menos frequente (empate pela menor dezena). */
    function ordemPorFrequencia(frequencia: number[]): number[] {
      return Array.from({ length: 60 }, (_, i) => i + 1).sort((a, b) => frequencia[b] - frequencia[a] || a - b);
    }

    /** Atraso de cada dezena no histórico inteiro (concursos desde a última aparição). */
    function atrasos(): { atraso: number; ultimoIndice: number }[] {
      const resultado = Array.from({ length: 61 }, () => ({ atraso: concursos.length, ultimoIndice: -1 }));
      concursos.forEach((concurso, indice) => {
        for (const dezena of concurso.dezenas) {
          resultado[dezena] = { atraso: concursos.length - 1 - indice, ultimoIndice: indice };
        }
      });
      return resultado;
    }

    beforeEach(() => {
      historico = gerarHistorico(120);
      concursos = historico.concursos;
      store.historico.set(historico);
    });

    it('usa os últimos 50 concursos como período padrão e marca o botão no filtro', async () => {
      // Arrange / Act
      const fixture = await renderizar();

      // Assert
      expect(texto(raiz(fixture).querySelector('h2'))).toBe('Estatísticas das dezenas');
      expect(kpis(fixture)[0]).toEqual({ titulo: 'Concursos no período', valor: '50', detalhe: 'últimos 50 concursos' });
      expect(botaoDoSegmento(fixture, 'Últimos 50').getAttribute('aria-pressed')).toBe('true');
      expect(botaoDoSegmento(fixture, 'Histórico').getAttribute('aria-pressed')).toBe('false');
    });

    it('oferece o filtro com os 5 períodos, calculando os anos a partir do último concurso', async () => {
      // Arrange / Act
      const fixture = await renderizar();

      // Assert
      const filtro = raiz(fixture).querySelector('.filtros srt-segmento') as HTMLElement;
      expect(Array.from(filtro.querySelectorAll('button')).map((b) => texto(b))).toEqual([
        'Últimos 50',
        'Últimos 100',
        '2026',
        '2025',
        'Histórico',
      ]);
    });

    it('mostra média por dezena e o valor esperado', async () => {
      // Arrange / Act
      const fixture = await renderizar();

      // Assert
      expect(kpis(fixture)[1]).toEqual({
        titulo: 'Média por dezena',
        valor: '5,0×',
        detalhe: 'esperado: 5,0× (10% dos concursos)',
      });
    });

    it('mostra a dezena mais e a menos sorteada do período', async () => {
      // Arrange
      const frequencia = frequenciaNosUltimos(50);
      const ordem = ordemPorFrequencia(frequencia);
      const maisSorteada = ordem[0];
      const menosSorteada = ordem[59];

      // Act
      const fixture = await renderizar();

      // Assert
      expect(kpis(fixture)[2]).toEqual({
        titulo: 'Mais sorteada',
        valor: dois(maisSorteada),
        detalhe: `${frequencia[maisSorteada]}× no período · menos sorteada: ${dois(menosSorteada)} (${frequencia[menosSorteada]}×)`,
      });
    });

    it('mostra a dezena mais atrasada com a data da última vez em que saiu', async () => {
      // Arrange
      const lista = atrasos();
      const maisAtrasada = Array.from({ length: 60 }, (_, i) => i + 1).sort(
        (a, b) => lista[b].atraso - lista[a].atraso || a - b,
      )[0];

      // Act
      const fixture = await renderizar();

      // Assert
      expect(kpis(fixture)[3]).toEqual({
        titulo: 'Mais atrasada',
        valor: dois(maisAtrasada),
        detalhe: `${lista[maisAtrasada].atraso} concursos sem sair · desde ${dataBR(concursos[lista[maisAtrasada].ultimoIndice].data)}`,
      });
    });

    it('trocar para "Histórico" recalcula os KPIs com todos os concursos', async () => {
      // Arrange
      const fixture = await renderizar();

      // Act
      await escolher(fixture, 'Histórico');

      // Assert
      expect(botaoDoSegmento(fixture, 'Histórico').getAttribute('aria-pressed')).toBe('true');
      expect(kpis(fixture)[0]).toEqual({
        titulo: 'Concursos no período',
        valor: '120',
        detalhe: 'histórico completo desde 2025',
      });
      expect(kpis(fixture)[1].valor).toBe('12,0×');
      expect(kpis(fixture)[1].detalhe).toBe('esperado: 12,0× (10% dos concursos)');
    });

    it('o filtro por ano usa só os concursos daquele ano', async () => {
      // Arrange
      const fixture = await renderizar();
      const em2025 = concursos.filter((c) => c.data.startsWith('2025')).length;

      // Act
      await escolher(fixture, '2025');

      // Assert
      expect(kpis(fixture)[0]).toEqual({
        titulo: 'Concursos no período',
        valor: String(em2025),
        detalhe: 'ano de 2025',
      });
      const grafico = componente(fixture, GraficoBarrasVerticaisComponent);
      expect(grafico.itens().reduce((soma, item) => soma + item.valor, 0)).toBe(em2025 * 6);
    });

    it('avisa quando o período escolhido não tem concursos', async () => {
      // Arrange: histórico só de 2026, então "ano anterior" (2025) fica vazio.
      store.historico.set({ loteria: MEGA_SENA, concursos: concursos.filter((c) => c.data.startsWith('2026')) });
      const fixture = await renderizar();

      // Act
      await escolher(fixture, '2025');

      // Assert
      expect(texto(raiz(fixture).querySelector('[data-teste="periodo-vazio"]'))).toBe('Nenhum concurso no período escolhido.');
      expect(kpis(fixture)[0].valor).toBe('0');
    });

    it('a frequência por dezena tem 60 barras, com as 5 mais e as 5 menos sorteadas em destaque', async () => {
      // Arrange
      const frequencia = frequenciaNosUltimos(50);
      const ordem = ordemPorFrequencia(frequencia);
      const destacadas = [...ordem.slice(0, 5), ...ordem.slice(-5)].map(dois).sort();

      // Act
      const fixture = await renderizar();

      // Assert
      const itens = componente(fixture, GraficoBarrasVerticaisComponent).itens();
      expect(itens).toHaveLength(60);
      expect(itens.map((i) => i.rotulo)).toEqual(Array.from({ length: 60 }, (_, i) => dois(i + 1)));
      expect(itens.map((i) => i.valor)).toEqual(frequencia.slice(1));
      expect(itens.filter((i) => i.destaque).map((i) => i.rotulo).sort()).toEqual(destacadas);
      expect(itens[0].dica).toBe(`dezena <b>01</b>: ${frequencia[1]}× no período`);
    });

    it('"por total" ordena a frequência da mais para a menos sorteada', async () => {
      // Arrange
      const fixture = await renderizar();
      const frequencia = frequenciaNosUltimos(50);

      // Act
      await escolher(fixture, 'por total');

      // Assert
      const itens = componente(fixture, GraficoBarrasVerticaisComponent).itens();
      expect(itens.map((i) => i.rotulo)).toEqual(ordemPorFrequencia(frequencia).map(dois));
      expect(itens.filter((i) => i.destaque)).toHaveLength(10);
    });

    it('o atraso atual mostra as 15 maiores com referência no atraso esperado (10)', async () => {
      // Arrange
      const lista = atrasos();
      const ordem = Array.from({ length: 60 }, (_, i) => i + 1)
        .sort((a, b) => lista[b].atraso - lista[a].atraso || a - b)
        .slice(0, 15);

      // Act
      const fixture = await renderizar();

      // Assert
      const grafico = componente(fixture, GraficoBarrasHorizontaisComponent);
      expect(grafico.itens()).toHaveLength(15);
      expect(grafico.itens().map((i) => i.rotulo)).toEqual(ordem.map(dois));
      expect(grafico.itens().map((i) => i.valor)).toEqual(ordem.map((d) => lista[d].atraso));
      expect(grafico.referencia()).toBe(10);
      expect(grafico.itens()[0].dica).toContain(
        `última vez no ${concursos[lista[ordem[0]].ultimoIndice].numero} (${dataBR(concursos[lista[ordem[0]].ultimoIndice].data)})`,
      );
      expect(texto(raiz(fixture).querySelector('[data-teste="atraso"] .legend'))).toContain('esperado: 10 concursos');
    });

    it('o atraso não muda com o período (é sempre do histórico inteiro)', async () => {
      // Arrange
      const fixture = await renderizar();
      const antes = componente(fixture, GraficoBarrasHorizontaisComponent).itens();

      // Act
      await escolher(fixture, 'Histórico');

      // Assert
      expect(componente(fixture, GraficoBarrasHorizontaisComponent).itens()).toEqual(antes);
    });

    it('lista as 8 mais e as 8 menos sorteadas com bola, sendo a menos sorteada a primeira da segunda lista', async () => {
      // Arrange
      const frequencia = frequenciaNosUltimos(50);
      const ordem = ordemPorFrequencia(frequencia);

      // Act
      const fixture = await renderizar();

      // Assert
      const mais = componente(fixture, ListaBarrasComponent, 0).itens();
      const menos = componente(fixture, ListaBarrasComponent, 1).itens();
      expect(mais.map((i) => i.bola)).toEqual(ordem.slice(0, 8));
      expect(mais[0].valorTexto).toBe(`${frequencia[ordem[0]]}×`);
      expect(menos.map((i) => i.bola)).toEqual(ordem.slice(-8).reverse());
      expect(menos[0].bola).toBe(ordem[59]);
      expect(raiz(fixture).querySelectorAll('[data-teste="mais-menos"] srt-bola')).toHaveLength(16);
    });

    it('as duas listas usam a mesma escala: a segunda é proporcional à maior frequência da primeira', async () => {
      // Arrange
      const frequencia = frequenciaNosUltimos(50);
      const ordem = ordemPorFrequencia(frequencia);

      // Act
      const fixture = await renderizar();

      // Assert
      expect(componente(fixture, ListaBarrasComponent, 0).maximo()).toBeUndefined();
      expect(componente(fixture, ListaBarrasComponent, 1).maximo()).toBe(frequencia[ordem[0]]);
    });

    it('o mapa de calor tem 60 colunas e uma linha por mês do histórico (até 12), no rótulo "aa/mm"', async () => {
      // Arrange
      const meses = [...new Set(concursos.map((c) => c.data.slice(0, 7)))].sort().slice(-12);

      // Act
      const fixture = await renderizar();

      // Assert
      const mapa = componente(fixture, MapaCalorComponent);
      expect(mapa.colunas()).toBe(60);
      expect(mapa.linhas().map((l) => l.chave)).toEqual(meses);
      expect(mapa.linhas().map((l) => l.rotulo)).toEqual(meses.map((m) => `${m.slice(2, 4)}/${m.slice(5)}`));
      expect(mapa.linhas()[0].rotulo).toBe('25/12');
      const valores = mapa.valores() as ReadonlyMap<string, number>;
      expect([...valores.values()].reduce((a, b) => a + b, 0)).toBe(120 * 6);
      expect(raiz(fixture).querySelectorAll('srt-mapa-calor .r')).toHaveLength(meses.length);
      expect(texto(raiz(fixture).querySelector('[data-teste="mapa-calor"] .legend'))).toContain('4+');
    });

    it('pares × ímpares mostra 7 colunas (0 a 6 pares) que somam os concursos do histórico', async () => {
      // Arrange
      const esperado = new Array<number>(7).fill(0);
      for (const c of concursos) esperado[c.dezenas.filter((d) => d % 2 === 0).length]++;

      // Act
      const fixture = await renderizar();

      // Assert
      const itens = componente(fixture, GraficoColunasComponent, 1).itens();
      expect(itens.map((i) => i.rotulo)).toEqual(['0p', '1p', '2p', '3p', '4p', '5p', '6p']);
      expect(itens.map((i) => i.valor)).toEqual(esperado);
      expect(itens[3].dica).toContain('3 pares / 3 ímpares');
    });

    it('a soma das dezenas usa faixas de 20 e soma todos os concursos do histórico', async () => {
      // Arrange
      const esperado = new Map<number, number>();
      for (const c of concursos) {
        const faixa = Math.floor(c.dezenas.reduce((a, b) => a + b, 0) / 20) * 20;
        esperado.set(faixa, (esperado.get(faixa) ?? 0) + 1);
      }
      const faixas = [...esperado.keys()].sort((a, b) => a - b);

      // Act
      const fixture = await renderizar();

      // Assert
      const itens = componente(fixture, GraficoColunasComponent, 2).itens();
      expect(itens.map((i) => i.rotulo)).toEqual(faixas.map(String));
      expect(itens.map((i) => i.valor)).toEqual(faixas.map((f) => esperado.get(f)));
      expect(itens[0].dica).toContain(`soma entre ${faixas[0]} e ${faixas[0] + 19}`);
    });

    it('pares e soma não mudam com o filtro de período (histórico completo)', async () => {
      // Arrange
      const fixture = await renderizar();
      const pares = componente(fixture, GraficoColunasComponent, 1).itens();

      // Act
      await escolher(fixture, 'Últimos 100');

      // Assert
      expect(componente(fixture, GraficoColunasComponent, 1).itens()).toEqual(pares);
    });

    describe('ritmo de cada dezena', () => {
      /** Ritmo contado à mão: intervalos entre aparições, atraso e fração das ausências mais curtas que o atraso. */
      function ritmoManual(dezena: number) {
        const indices = concursos.flatMap((c, i) => (c.dezenas.includes(dezena) ? [i] : []));
        const intervalos = indices.slice(1).map((indice, i) => indice - indices[i]);
        const atraso = indices.length ? concursos.length - 1 - indices[indices.length - 1] : concursos.length;
        const media = intervalos.length ? intervalos.reduce((a, b) => a + b, 0) / intervalos.length : undefined;
        const passouDe = intervalos.length ? intervalos.filter((g) => g - 1 < atraso).length / intervalos.length : 0;
        return { dezena, atraso, media, passouDe, maiorAusencia: Math.max(0, ...intervalos.map((g) => g - 1)) };
      }

      /** Linhas da tabela: [dezena, atraso, % fora, sai a cada, maior ausência]. */
      function linhasRitmo(fixture: ComponentFixture<EstatisticasPage>): string[][] {
        return Array.from(raiz(fixture).querySelectorAll('[data-teste="ritmo"] tbody tr')).map((tr) =>
          Array.from(tr.querySelectorAll('td')).map((td) => texto(td)),
        );
      }

      it('começa pelas dezenas mais fora do ritmo (fração das ausências, depois atraso, depois dezena)', async () => {
        // Arrange
        const esperado = Array.from({ length: 60 }, (_, i) => ritmoManual(i + 1)).sort(
          (a, b) => b.passouDe - a.passouDe || b.atraso - a.atraso || a.dezena - b.dezena,
        );

        // Act
        const fixture = await renderizar();

        // Assert
        const linhas = linhasRitmo(fixture);
        expect(linhas).toHaveLength(60);
        expect(linhas.map((l) => Number(l[0]))).toEqual(esperado.map((r) => r.dezena));
        expect(linhas[0][1]).toBe(String(esperado[0].atraso));
        expect(linhas[0][2]).toBe(`${Math.round(esperado[0].passouDe * 100)}%`);
      });

      it('"por dezena" mostra 01 a 60 com média de intervalo e maior ausência contadas à mão', async () => {
        // Arrange
        const fixture = await renderizar();
        const um = ritmoManual(1);

        // Act
        const botao = Array.from(raiz(fixture).querySelectorAll<HTMLButtonElement>('[data-teste="ritmo"] srt-segmento button')).find(
          (b) => texto(b) === 'por dezena',
        ) as HTMLButtonElement;
        botao.click();
        await fixture.whenStable();

        // Assert
        const linhas = linhasRitmo(fixture);
        expect(linhas.map((l) => l[0])).toEqual(Array.from({ length: 60 }, (_, i) => dois(i + 1)));
        expect(linhas[0][3]).toBe((um.media as number).toFixed(1).replace('.', ','));
        expect(linhas[0][4]).toBe(String(um.maiorAusencia));
      });

      it('a nota compara com o acaso (a cada 10,0 concursos, 10% de chance) e leva ao teste das estratégias', async () => {
        // Act
        const fixture = await renderizar();

        // Assert
        const nota = raiz(fixture).querySelector('[data-teste="nota-ritmo"]');
        expect(texto(nota)).toContain('cada dezena sai em média a cada 10,0 concursos');
        expect(texto(nota)).toContain('a mesma chance de sair (10%)');
        expect(nota?.querySelector('a')?.getAttribute('href')).toMatch(/teste$/);
      });
    });

    describe('composição dos concursos', () => {
      const linhas = (fixture: ComponentFixture<EstatisticasPage>) =>
        Array.from(raiz(fixture).querySelectorAll('[data-teste="composicao"] tbody tr')).map((tr) => ({
          grupo: tr.getAttribute('data-grupo'),
          celulas: Array.from(tr.querySelectorAll('td')).map((td) => texto(td)),
        }));

      it('com os últimos 50 (padrão), mostra os 4 grupos com os números do core e o acaso', async () => {
        // Arrange
        const esperado = calcularComposicao(historico, { tipo: 'ultimos', quantidade: 50 });

        // Act
        const fixture = await renderizar();

        // Assert
        const tabela = linhas(fixture);
        expect(tabela.map((l) => l.grupo)).toEqual(['quentes', 'frias', 'atrasadas', 'repetidas']);
        expect(tabela[0].celulas[0]).toContain('as 20 que mais saíram nos 50 concursos anteriores');
        expect(tabela[0].celulas[2]).toBe('2,00 (33,3%)');
        expect(tabela[3].celulas[2]).toBe('0,60 (10%)');
        const quentes = esperado.grupos[0];
        expect(tabela[0].celulas[1]).toContain(quentes.mediaObservada.toFixed(2).replace('.', ','));
        const resultadoTexto = { dentro: 'dentro do acaso', acima: 'acima do acaso', abaixo: 'abaixo do acaso' };
        expect(tabela[0].celulas[5]).toBe(resultadoTexto[vereditoDe(quentes.mediaObservada, quentes.margem, quentes.mediaAcaso)]);
      });

      it('o gráfico mostra a distribuição do grupo escolhido, com o acaso como referência', async () => {
        // Arrange
        const fixture = await renderizar();
        const esperado = calcularComposicao(historico, { tipo: 'ultimos', quantidade: 50 });
        const grafico = () => componente(fixture, GraficoColunasComponent, 0).itens();

        // Act
        const atrasadas = grafico();
        await escolher(fixture, 'Repetidas');

        // Assert
        const grupo = (id: string) => esperado.grupos.find((g) => g.grupo === id);
        expect(atrasadas.map((i) => i.valor)).toEqual(grupo('atrasadas')?.distribuicaoObservada);
        expect(atrasadas.map((i) => i.referencia)).toEqual(grupo('atrasadas')?.distribuicaoAcaso);
        expect(grafico().map((i) => i.valor)).toEqual(grupo('repetidas')?.distribuicaoObservada);
        expect(texto(raiz(fixture).querySelector('[data-teste="composicao"] h4'))).toBe(
          'Concursos por quantidade de repetidas',
        );
      });

      it('segue o filtro de período e avisa quando nenhum concurso tem 50 anteriores', async () => {
        // Arrange
        const fixture = await renderizar();

        // Act
        await escolher(fixture, '2025');

        // Assert: os concursos de 2025 são os primeiros do histórico sintético (sem 50 anteriores).
        expect(raiz(fixture).querySelector('[data-teste="composicao"] table')).toBeNull();
        expect(texto(raiz(fixture).querySelector('[data-teste="composicao-vazia"]'))).toContain('50 concursos anteriores');
      });
    });
  });

  describe('sem seletor de loteria (a loteria vem da rota)', () => {
    it('não mostra o seletor, mesmo com mais de uma loteria, e não troca a loteria sozinha', async () => {
      // Arrange
      store.loterias.set([MEGA_SENA, LOTOMANIA_FALSA]);
      store.historico.set(gerarHistorico(60));

      // Act
      const fixture = await renderizar();

      // Assert
      expect(raiz(fixture).querySelector('srt-seletor-loteria')).toBeNull();
      expect(store.selecionadas).toEqual([]);
    });

    it('enquanto o histórico carrega mostra só o estado de carregamento', async () => {
      // Arrange
      store.loterias.set([MEGA_SENA, LOTOMANIA_FALSA]);
      store.carregando.set(true);

      // Act
      const fixture = await renderizar();

      // Assert
      expect(raiz(fixture).querySelector('srt-seletor-loteria')).toBeNull();
      expect(raiz(fixture).querySelector('[data-teste="carregando"]')).not.toBeNull();
    });
  });

  describe('com a Lotomania ativa (fake 100/20/50)', () => {
    let historico: Historico;

    beforeEach(() => {
      historico = historicoLotomaniaFalso(30);
      store.loterias.set([MEGA_SENA, LOTOMANIA_FALSA]);
      store.loteria.set(LOTOMANIA_FALSA);
      store.historico.set(historico);
    });

    it('usa o nome da loteria no cabeçalho e "Soma das 20 dezenas"', async () => {
      // Arrange / Act
      const fixture = await renderizar();

      // Assert
      expect(texto(raiz(fixture).querySelector('.eyebrow'))).toBe('Lotomania');
      expect(texto(raiz(fixture).querySelector('[data-teste="soma"] h3'))).toBe('Soma das 20 dezenas');
    });

    it('a frequência tem 100 barras, de 01 a 99 e o 00 por último, com largura mínima por barra (rolagem no celular)', async () => {
      // Arrange / Act
      const fixture = await renderizar();

      // Assert
      const itens = componente(fixture, GraficoBarrasVerticaisComponent).itens();
      expect(itens).toHaveLength(100);
      expect(itens[0].rotulo).toBe('01');
      expect(itens[98].rotulo).toBe('99');
      expect(itens[99].rotulo).toBe('00');
      const svg = raiz(fixture).querySelector<SVGElement>('[data-teste="frequencia"] svg')!;
      expect(svg.style.minWidth).toBe('1644px'); // 36 + 8 + 100 x 16
      expect(raiz(fixture).querySelectorAll('[data-teste="frequencia"] rect.bar')).toHaveLength(100);
    });

    it('os KPIs usam as 100 dezenas, o esperado de 20% e o formato de dois dígitos (inclui a 00)', async () => {
      // Arrange
      const ultimos50 = calcularEstatisticas(historico, { tipo: 'ultimos', quantidade: 50 });
      const soma = ultimos50.reduce((total, e) => total + e.frequencia, 0);
      const media = (soma / 100).toFixed(1).replace('.', ',');
      const mais = [...ultimos50].sort((a, b) => b.frequencia - a.frequencia || a.dezena - b.dezena)[0];

      // Act
      const fixture = await renderizar();

      // Assert
      const [concursos, mediaPorDezena, maisSorteada] = kpis(fixture);
      expect(concursos.valor).toBe('30');
      expect(mediaPorDezena.valor).toBe(`${media}×`);
      expect(mediaPorDezena.detalhe).toBe('esperado: 6,0× (20% dos concursos)');
      expect(maisSorteada.valor).toBe(dois(mais.dezena));
    });

    it('o atraso usa o esperado de 5 concursos e considera a dezena 00', async () => {
      // Arrange
      const atrasos = calcularEstatisticas(historico, { tipo: 'tudo' });
      const maior = [...atrasos].sort((a, b) => b.atraso - a.atraso || a.dezena - b.dezena)[0];

      // Act
      const fixture = await renderizar();

      // Assert
      expect(texto(raiz(fixture).querySelector('[data-teste="atraso"] .legend'))).toContain('esperado: 5 concursos');
      expect(componente(fixture, GraficoBarrasHorizontaisComponent).referencia()).toBe(5);
      expect(kpis(fixture)[3].valor).toBe(dois(maior.dezena));
    });

    it('o mapa de calor tem 100 colunas rotuladas de 01 a 99 e o 00 por último, com rolagem horizontal', async () => {
      // Arrange / Act
      const fixture = await renderizar();

      // Assert
      const mapa = componente(fixture, MapaCalorComponent);
      expect(mapa.colunas()).toBe(100);
      const cabecalho = Array.from(raiz(fixture).querySelectorAll('[data-teste="mapa-calor"] .hx span')).map((s) => s.textContent);
      expect(cabecalho).toHaveLength(101);
      expect(cabecalho[1]).toBe('01');
      expect(cabecalho[99]).toBe('99');
      expect(cabecalho[100]).toBe('00');
      expect(raiz(fixture).querySelector('[data-teste="mapa-calor"] .r')!.querySelectorAll('.c')).toHaveLength(100);
      expect(raiz(fixture).querySelector<HTMLElement>('[data-teste="mapa-calor"] .heat')!.style.minWidth).toBe('1244px');
    });

    it('o mapa de calor liga a dezena 00 à primeira coluna', async () => {
      // Arrange
      const fixture = await renderizar();
      const mapa = componente(fixture, MapaCalorComponent);
      const comZero = historico.concursos.find((c) => c.dezenas.includes(0))!;
      const mesDoZero = comZero.data.slice(0, 7);

      // Act
      const valores = mapa.valores() as ReadonlyMap<string, number>;

      // Assert
      expect(comZero).toBeDefined();
      expect(valores.get(`${mesDoZero}|1`)).toBeGreaterThan(0);
      expect(valores.has(`${mesDoZero}|0`)).toBe(false);
      expect(valores.has(`${mesDoZero}|101`)).toBe(false);
    });
  });
});
