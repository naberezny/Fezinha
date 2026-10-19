import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideIonicAngular } from '@ionic/angular';
import type { Concurso, Historico, LoteriaDefinicao } from '@sorteios/core';
import { MEGA_SENA } from '@sorteios/loterias/mega-sena';
import { GraficoColunasComponent, formatarReais } from '@sorteios/ui';
import { HistoricoStore } from '../dados/historico.store';
import { LOTOMANIA_FALSA, historicoLotomaniaFalso } from '../testes/stores-fake';
import { ResultadosPage } from './resultados.page';

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

const UFS = ['SP', 'RJ', 'MG'];

/**
 * Histórico sintético: concursos de terça, quinta e sábado a partir de `inicio`; o concurso de índice i
 * paga a sena quando `i % 7 === 3` (ganhadores 1..3, rateio único) e acumula nos demais.
 * Com 120 concursos o último (índice 119) acumula e é o 4º acumulado seguido.
 */
function gerarHistorico(quantidade: number, inicio = '2025-12-02'): Historico {
  const sortear = criarGerador(42);
  const data = new Date(`${inicio}T00:00:00Z`);
  const passos = [2, 2, 3];
  const concursos: Concurso[] = [];

  for (let i = 0; i < quantidade; i++) {
    const universo = Array.from({ length: 60 }, (_, k) => k + 1);
    for (let k = 0; k < 6; k++) {
      const j = k + Math.floor(sortear() * (60 - k));
      [universo[k], universo[j]] = [universo[j], universo[k]];
    }
    const dezenas = universo.slice(0, 6).sort((a, b) => a - b);

    const paga = i % 7 === 3;
    const ganhadores = paga ? 1 + (i % 3) : 0;
    const uf = UFS[i % 3];

    concursos.push({
      numero: i + 1,
      data: data.toISOString().slice(0, 10),
      dezenas,
      acumulou: !paga,
      premiacoes: [
        {
          faixa: 1,
          ganhadores,
          rateioCentavos: BigInt(paga ? 10_000_000 + ((i * 37) % 101) * 1_000_000 + i : 0),
        },
        { faixa: 2, ganhadores: 40 + i, rateioCentavos: BigInt(5_000_000) },
      ],
      valorAcumuladoCentavos: BigInt(paga ? 0 : i + 1) * BigInt(50_000_000),
      estimativaProximoCentavos: BigInt(i + 1) * BigInt(25_000_000),
      arrecadacaoCentavos: BigInt(0),
      acumuladoEspecialCentavos: BigInt(0),
      proximoNumero: i + 2,
      locaisGanhadores: paga
        ? [
            {
              cidade: 'CIDADE',
              uf,
              descricao: `CIDADE/${uf}`,
              quantidade: ganhadores,
            },
            { descricao: 'CANAL ELETRONICO', quantidade: 1 },
          ]
        : [],
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

function dataBR(iso: string): string {
  return iso.split('-').reverse().join('/');
}

describe('ResultadosPage', () => {
  let store: HistoricoStoreFake;

  beforeEach(() => {
    store = new HistoricoStoreFake();
    TestBed.configureTestingModule({
      providers: [provideIonicAngular(), { provide: HistoricoStore, useValue: store }],
    });
  });

  async function renderizar(): Promise<ComponentFixture<ResultadosPage>> {
    const fixture = TestBed.createComponent(ResultadosPage);
    await fixture.whenStable();
    return fixture;
  }

  const raiz = (fixture: ComponentFixture<ResultadosPage>) => fixture.nativeElement as HTMLElement;
  const texto = (elemento: Element | null | undefined) => elemento?.textContent?.trim() ?? '';

  function kpis(fixture: ComponentFixture<ResultadosPage>) {
    return Array.from(raiz(fixture).querySelectorAll('srt-kpi')).map((kpi) => ({
      titulo: texto(kpi.querySelector('.eyebrow')),
      valor: texto(kpi.querySelector('.v')),
      detalhe: texto(kpi.querySelector('.s')),
    }));
  }

  function linhasDaTabela(fixture: ComponentFixture<ResultadosPage>): HTMLTableRowElement[] {
    return Array.from(raiz(fixture).querySelectorAll<HTMLTableRowElement>('srt-tabela-resultados tbody tr'));
  }

  function numerosDaTabela(fixture: ComponentFixture<ResultadosPage>): number[] {
    return linhasDaTabela(fixture).map((linha) => Number(texto(linha.querySelector('td'))));
  }

  function botao(fixture: ComponentFixture<ResultadosPage>, seletor: string): HTMLButtonElement {
    return raiz(fixture).querySelector(seletor) as HTMLButtonElement;
  }

  /** Linhas (rótulo, valor) de uma lista de barras dentro do bloco indicado. */
  function linhasDaLista(fixture: ComponentFixture<ResultadosPage>, bloco: string): [string, string][] {
    return Array.from(raiz(fixture).querySelectorAll(`[data-teste="${bloco}"] .li`)).map((li) => [
      texto(li.children[0]),
      texto(li.children[2]),
    ]);
  }

  function itensDasColunas(fixture: ComponentFixture<ResultadosPage>, indice: number) {
    const grafico = fixture.debugElement.queryAll(By.directive(GraficoColunasComponent))[indice];
    return (grafico.componentInstance as GraficoColunasComponent).itens();
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
      expect(store.chamadasCarregar).toBe(1);
    });

    it('mostra a mensagem de erro e permite tentar de novo quando não há histórico nem cache', async () => {
      // Arrange
      store.erro.set('Sem conexão com o servidor.');
      const fixture = await renderizar();

      // Act
      botao(fixture, '[data-teste="tentar-novamente"]').click();
      await fixture.whenStable();

      // Assert
      expect(texto(raiz(fixture).querySelector('[data-teste="erro"]'))).toContain('Sem conexão com o servidor.');
      expect(raiz(fixture).querySelector('[data-teste="carregando"]')).toBeNull();
      expect(store.chamadasAtualizar).toBe(1);
    });

    it('mantém o conteúdo do cache e avisa no rodapé quando a rede falha', async () => {
      // Arrange
      store.historico.set(gerarHistorico(120));
      store.erro.set('Sem conexão com o servidor.');
      store.somenteCache.set(true);

      // Act
      const fixture = await renderizar();

      // Assert
      expect(kpis(fixture)).toHaveLength(4);
      expect(texto(raiz(fixture).querySelector('[data-teste="rodape"]'))).toContain('Sem conexão com o servidor.');
      expect(raiz(fixture).querySelector('[data-teste="erro"]')).toBeNull();
    });

    it('avisa quando o histórico existe mas está vazio', async () => {
      // Arrange
      store.historico.set({ loteria: MEGA_SENA, concursos: [] });

      // Act
      const fixture = await renderizar();

      // Assert
      expect(texto(raiz(fixture).querySelector('[data-teste="sem-concursos"]'))).toBe('Nenhum concurso disponível.');
    });
  });

  describe('com histórico', () => {
    let historico: Historico;

    beforeEach(() => {
      historico = gerarHistorico(120);
      store.historico.set(historico);
    });

    it('mostra o cabeçalho com o total de concursos e a data do primeiro', async () => {
      // Arrange / Act
      const fixture = await renderizar();

      // Assert
      expect(texto(raiz(fixture).querySelector('.eyebrow'))).toBe('Mega-Sena');
      expect(texto(raiz(fixture).querySelector('h2'))).toBe('Todos os resultados');
      expect(texto(raiz(fixture).querySelector('[data-teste="resumo"]'))).toBe(
        `120 concursos desde ${dataBR(historico.concursos[0].data)}`,
      );
    });

    it('renderiza os 4 KPIs com os valores do último concurso', async () => {
      // Arrange
      const ultimo = historico.concursos[119];
      const ano = ultimo.data.slice(0, 4);
      const doAno = historico.concursos.filter((c) => c.data.startsWith(ano));
      const ganhadoresDoAno = doAno.reduce((soma, c) => soma + c.premiacoes[0].ganhadores, 0);

      // Act
      const fixture = await renderizar();

      // Assert
      expect(kpis(fixture)).toEqual([
        {
          titulo: 'Último concurso',
          valor: '120',
          detalhe: `${dataBR(ultimo.data)} · acumulou`,
        },
        {
          titulo: 'Acumulado atual',
          valor: 'R$ 60 mi',
          detalhe: '4 concursos seguidos sem ganhador',
        },
        {
          titulo: 'Estimativa do próximo',
          valor: 'R$ 30 mi',
          detalhe: 'concurso 121',
        },
        {
          titulo: `Ganhadores (Sena) em ${ano}`,
          valor: String(ganhadoresDoAno),
          detalhe: `${doAno.filter((c) => c.acumulou).length} de ${doAno.length} concursos acumularam`,
        },
      ]);
    });

    it('descreve o último concurso pelo número de ganhadores quando a sena foi paga', async () => {
      // Arrange: o concurso 116 (índice 115) foi o último a pagar; descarta os 4 seguintes.
      const ate116 = {
        ...historico,
        concursos: historico.concursos.slice(0, 116),
      };
      store.historico.set(ate116);
      const pago = ate116.concursos[115];

      // Act
      const fixture = await renderizar();

      // Assert
      expect(kpis(fixture)[0]).toEqual({
        titulo: 'Último concurso',
        valor: '116',
        detalhe: `${dataBR(pago.data)} · ${pago.premiacoes[0].ganhadores} ganhador(es)`,
      });
      expect(kpis(fixture)[1].detalhe).toBe('0 concursos seguidos sem ganhador');
    });

    it('mostra a tabela paginada de todos os resultados: 50 por página, do mais recente ao mais antigo, sem "Ver todos"', async () => {
      // Arrange / Act
      const fixture = await renderizar();

      // Assert
      expect(linhasDaTabela(fixture)).toHaveLength(50);
      expect(numerosDaTabela(fixture)[0]).toBe(120);
      expect(numerosDaTabela(fixture)[49]).toBe(71);
      expect(texto(raiz(fixture).querySelector('[data-teste="pagina-texto"]'))).toBe('Página 1 de 3');
      expect(botao(fixture, '[data-teste="pagina-anterior"]').disabled).toBe(true);
      expect(botao(fixture, '[data-teste="pagina-proxima"]').disabled).toBe(false);
      expect(raiz(fixture).querySelector('[data-teste="alternar-todos"]')).toBeNull();
    });

    it('mostra os KPIs no topo, depois a tabela e só então os gráficos', async () => {
      // Arrange / Act
      const fixture = await renderizar();
      const blocos = Array.from(raiz(fixture).querySelectorAll('[data-teste]')).map((e) => e.getAttribute('data-teste'));

      // Assert
      const posicao = (nome: string) => blocos.indexOf(nome);
      expect(posicao('kpis')).toBeLessThan(posicao('ultimos'));
      expect(posicao('ultimos')).toBeLessThan(posicao('acumulados-ano'));
      expect(posicao('acumulados-ano')).toBeLessThan(posicao('ganhadores-ano'));
      expect(posicao('ganhadores-ano')).toBeLessThan(posicao('ganhadores-uf'));
      expect(posicao('ganhadores-uf')).toBeLessThan(posicao('maiores-premios'));
    });

    it('navega entre as páginas com Próxima e Anterior respeitando os limites', async () => {
      // Arrange
      const fixture = await renderizar();

      // Act: página 2
      botao(fixture, '[data-teste="pagina-proxima"]').click();
      await fixture.whenStable();

      // Assert
      expect(numerosDaTabela(fixture)[0]).toBe(70);
      expect(texto(raiz(fixture).querySelector('[data-teste="pagina-texto"]'))).toBe('Página 2 de 3');

      // Act: página 3 (restam 20 concursos)
      botao(fixture, '[data-teste="pagina-proxima"]').click();
      await fixture.whenStable();

      // Assert
      expect(linhasDaTabela(fixture)).toHaveLength(20);
      expect(numerosDaTabela(fixture)[19]).toBe(1);
      expect(botao(fixture, '[data-teste="pagina-proxima"]').disabled).toBe(true);

      // Act: volta uma página
      botao(fixture, '[data-teste="pagina-anterior"]').click();
      await fixture.whenStable();

      // Assert
      expect(texto(raiz(fixture).querySelector('[data-teste="pagina-texto"]'))).toBe('Página 2 de 3');
    });

    it('agrega os ganhadores por UF somando a quantidade e ignorando locais sem UF', async () => {
      // Arrange
      const esperado = new Map<string, number>();
      for (const concurso of historico.concursos) {
        for (const local of concurso.locaisGanhadores) {
          if (local.uf) esperado.set(local.uf, (esperado.get(local.uf) ?? 0) + local.quantidade);
        }
      }
      const ordenado = [...esperado.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

      // Act
      const fixture = await renderizar();

      // Assert
      const linhas = linhasDaLista(fixture, 'ganhadores-uf');
      expect(linhas).toHaveLength(3);
      expect(linhas).toEqual(ordenado.map(([uf, quantidade]) => [uf, String(quantidade)]));
      expect(linhas.map(([uf]) => uf)).not.toContain('CANAL ELETRONICO');
    });

    it('lista os 8 maiores prêmios da sena em ordem decrescente com o rótulo "concurso mm/aaaa"', async () => {
      // Arrange
      const esperado = historico.concursos
        .filter((c) => c.premiacoes[0].ganhadores > 0)
        .sort((a, b) => (a.premiacoes[0].rateioCentavos > b.premiacoes[0].rateioCentavos ? -1 : 1))
        .slice(0, 8);

      // Act
      const fixture = await renderizar();

      // Assert
      const linhas = linhasDaLista(fixture, 'maiores-premios');
      expect(linhas).toHaveLength(8);
      expect(linhas).toEqual(
        esperado.map((c) => [
          `${c.numero} ${c.data.slice(5, 7)}/${c.data.slice(0, 4)}`,
          formatarReais(c.premiacoes[0].rateioCentavos),
        ]),
      );
    });

    it('monta os gráficos anuais de acumulados e ganhadores com rótulo de dois dígitos e dica "ano: n de total"', async () => {
      // Arrange
      const doAno = (ano: string) => historico.concursos.filter((c) => c.data.startsWith(ano));
      const acumulados = (ano: string) => doAno(ano).filter((c) => c.acumulou).length;
      const ganhadores = (ano: string) => doAno(ano).reduce((soma, c) => soma + c.premiacoes[0].ganhadores, 0);

      // Act
      const fixture = await renderizar();

      // Assert
      expect(itensDasColunas(fixture, 0)).toEqual([
        {
          rotulo: '25',
          valor: acumulados('2025'),
          dica: `2025: <b>${acumulados('2025')}</b> de ${doAno('2025').length}`,
        },
        {
          rotulo: '26',
          valor: acumulados('2026'),
          dica: `2026: <b>${acumulados('2026')}</b> de ${doAno('2026').length}`,
        },
      ]);
      expect(itensDasColunas(fixture, 1).map((item) => [item.rotulo, item.valor])).toEqual([
        ['25', ganhadores('2025')],
        ['26', ganhadores('2026')],
      ]);
      expect(itensDasColunas(fixture, 1)[0].dica).toBe(`2025: <b>${ganhadores('2025')}</b> apostas premiadas`);
    });

    it('mostra no rodapé a fonte, a data da atualização e o aviso de dados do cache', async () => {
      // Arrange
      store.atualizadoEm.set('2026-10-14T15:30:00Z');
      store.somenteCache.set(true);

      // Act
      const fixture = await renderizar();

      // Assert
      const rodape = texto(raiz(fixture).querySelector('[data-teste="rodape"]'));
      expect(rodape).toContain('Caixa Econômica Federal');
      expect(rodape).toContain('não é afiliado à Caixa Econômica Federal e não realiza apostas');
      expect(rodape).toContain('Atualizado em');
      expect(rodape).toContain('Dados do cache');
    });

    it('não mostra o aviso de cache quando os dados vieram da rede', async () => {
      // Arrange
      store.atualizadoEm.set('2026-10-14T15:30:00Z');

      // Act
      const fixture = await renderizar();

      // Assert
      expect(texto(raiz(fixture).querySelector('[data-teste="rodape"]'))).not.toContain('Dados do cache');
    });
  });

  it('ignora anos anteriores a 2016 nos gráficos anuais', async () => {
    // Arrange: 300 concursos a partir de dez/2015 cobrem 2015, 2016 e 2017.
    const historico = gerarHistorico(300, '2015-12-01');
    store.historico.set(historico);
    const em2016 = historico.concursos.filter((c) => c.data.startsWith('2016'));

    // Act
    const fixture = await renderizar();

    // Assert
    const acumulados = itensDasColunas(fixture, 0);
    expect(acumulados.map((item) => item.rotulo)).toEqual(['16', '17']);
    expect(acumulados[0].valor).toBe(em2016.filter((c) => c.acumulou).length);
  });

  it('não tem seletor de loteria: a loteria vem da rota', async () => {
    // Arrange
    store.loterias.set([MEGA_SENA, LOTOMANIA_FALSA]);
    store.historico.set(gerarHistorico(10));

    // Act
    const fixture = await renderizar();

    // Assert
    expect(raiz(fixture).querySelector('srt-seletor-loteria')).toBeNull();
    expect(raiz(fixture).querySelector('srt-segmento')).toBeNull();
    expect(store.selecionadas).toEqual([]);
  });

  describe('com a Lotomania ativa (fake 100/20/50)', () => {
    let historico: Historico;

    beforeEach(() => {
      historico = historicoLotomaniaFalso(30);
      store.loterias.set([MEGA_SENA, LOTOMANIA_FALSA]);
      store.loteria.set(LOTOMANIA_FALSA);
      store.historico.set(historico);
    });

    it('usa o nome da loteria no cabeçalho e o prêmio principal da definição nos KPIs', async () => {
      // Arrange
      const ano = historico.concursos[29].data.slice(0, 4);

      // Act
      const fixture = await renderizar();

      // Assert
      expect(texto(raiz(fixture).querySelector('.eyebrow'))).toBe('Lotomania');
      const titulos = kpis(fixture).map((k) => k.titulo);
      expect(titulos).toEqual(['Último concurso', 'Acumulado atual', 'Estimativa do próximo', `Ganhadores (20 acertos) em ${ano}`]);
    });

    it('mostra 20 bolas por concurso (com a 00) e o cabeçalho "Ganhadores (20 acertos)", sem citar a sena', async () => {
      // Arrange / Act
      const fixture = await renderizar();

      // Assert
      const primeiraLinha = linhasDaTabela(fixture)[0];
      const bolas = Array.from(primeiraLinha.querySelectorAll('srt-bola')).map((b) => b.firstChild?.textContent);
      expect(bolas).toHaveLength(20);
      expect(bolas).toEqual(historico.concursos[29].dezenas.map((d) => String(d).padStart(2, '0')));
      const cabecalhos = Array.from(raiz(fixture).querySelectorAll('th')).map((th) => texto(th));
      expect(cabecalhos).toContain('Ganhadores (20 acertos)');
      expect(texto(raiz(fixture).querySelector('[data-teste="ultimos"]'))).not.toMatch(/sena/i);
      expect(texto(raiz(fixture).querySelector('[data-teste="kpis"]'))).not.toMatch(/sena/i);
    });

    it('troca os textos dos gráficos pelo prêmio principal da definição', async () => {
      // Arrange / Act
      const fixture = await renderizar();
      const bloco = (nome: string) => raiz(fixture).querySelector(`[data-teste="${nome}"]`);

      // Assert
      expect(texto(bloco('acumulados-ano')?.querySelector('.sub'))).toBe(
        'concursos sem ganhador do prêmio principal (20 acertos) · desde 2016',
      );
      expect(texto(bloco('ganhadores-ano')?.querySelector('h3'))).toBe('Ganhadores (20 acertos) por ano');
      expect(texto(bloco('ganhadores-ano')?.querySelector('.sub'))).toBe('apostas premiadas com 20 acertos · desde 2016');
      expect(bloco('ganhadores-ano')?.querySelector('svg')?.getAttribute('aria-label')).toBe('Ganhadores (20 acertos) por ano');
      expect(texto(bloco('ganhadores-uf')?.querySelector('h3'))).toBe('Ganhadores do prêmio principal por UF');
      expect(texto(bloco('maiores-premios')?.querySelector('.sub'))).toBe(
        'histórico · rateio do prêmio principal (20 acertos) por aposta vencedora',
      );
    });

    it('conta os ganhadores do ano pelo prêmio principal (faixa 1)', async () => {
      // Arrange
      const ano = historico.concursos[29].data.slice(0, 4);
      const doAno = historico.concursos.filter((c) => c.data.startsWith(ano));
      const ganhadores = doAno.reduce((soma, c) => soma + (c.premiacoes.find((p) => p.faixa === 1)?.ganhadores ?? 0), 0);

      // Act
      const fixture = await renderizar();

      // Assert
      const kpi = kpis(fixture)[3];
      expect(kpi.valor).toBe(String(ganhadores));
      expect(kpi.detalhe).toBe(`${doAno.filter((c) => c.acumulou).length} de ${doAno.length} concursos acumularam`);
    });
  });
});
