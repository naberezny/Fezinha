import type { WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import {
  criarRng,
  testarEstrategias,
  vereditoDe,
  type Concurso,
  type Historico,
  type ResultadoTesteEstrategias,
} from '@sorteios/core';
import { MEGA_SENA } from '@sorteios/loterias/mega-sena';
import { HistoricoStore } from '../dados/historico.store';
import { HistoricoStoreFalso, LOTOMANIA_FALSA } from '../testes/stores-fake';
import { TestePage } from './teste.page';

/** `quantidade` concursos da Mega-Sena com 6 dezenas sorteadas de forma determinística. */
function historicoMegaSena(quantidade: number): Historico {
  const rng = criarRng(7);
  const concursos: Concurso[] = Array.from({ length: quantidade }, (_, i) => {
    const dezenas = new Set<number>();
    while (dezenas.size < 6) dezenas.add(1 + Math.floor(rng() * 60));
    return {
      numero: i + 1,
      data: '2026-01-01',
      dezenas: [...dezenas].sort((a, b) => a - b),
      acumulou: true,
      premiacoes: [],
      valorAcumuladoCentavos: 0n,
      estimativaProximoCentavos: 0n,
      arrecadacaoCentavos: 0n,
      acumuladoEspecialCentavos: 0n,
      locaisGanhadores: [],
    };
  });
  return { loteria: MEGA_SENA, concursos };
}

describe('TestePage', () => {
  let store: HistoricoStoreFalso;

  beforeEach(() => {
    store = new HistoricoStoreFalso();
    store.loterias.set([MEGA_SENA, LOTOMANIA_FALSA]);
    TestBed.configureTestingModule({
      providers: [provideIonicAngular(), { provide: HistoricoStore, useValue: store }],
    });
  });

  async function renderizar(): Promise<ComponentFixture<TestePage>> {
    const fixture = TestBed.createComponent(TestePage);
    await fixture.whenStable();
    return fixture;
  }

  const raiz = (fixture: ComponentFixture<TestePage>) => fixture.nativeElement as HTMLElement;
  const texto = (elemento: Element | null | undefined) => elemento?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  async function escolher(fixture: ComponentFixture<TestePage>, rotulo: string): Promise<void> {
    const botoes = Array.from(raiz(fixture).querySelectorAll<HTMLButtonElement>('srt-segmento button'));
    (botoes.find((b) => texto(b) === rotulo) as HTMLButtonElement).click();
    await fixture.whenStable();
  }

  async function rodar(fixture: ComponentFixture<TestePage>): Promise<void> {
    await fixture.componentInstance.rodar();
    await fixture.whenStable();
  }

  it('mostra "Carregando histórico…" enquanto não há histórico', async () => {
    // Act
    const fixture = await renderizar();

    // Assert
    expect(texto(raiz(fixture).querySelector('[data-teste="carregando"]'))).toBe('Carregando histórico…');
  });

  it('com 100 concursos ou menos avisa que o histórico é curto demais', async () => {
    // Arrange
    store.historico.set(historicoMegaSena(100));

    // Act
    const fixture = await renderizar();

    // Assert
    expect(texto(raiz(fixture).querySelector('[data-teste="sem-concursos"]'))).toContain('curto demais');
    expect(raiz(fixture).querySelector('[data-teste="rodar"]')).toBeNull();
  });

  it('a janela deixa os 100 primeiros concursos de fora: "Últimos 500" com 300 concursos testa 200', async () => {
    // Arrange
    store.historico.set(historicoMegaSena(300));
    const fixture = await renderizar();
    const dica = () => texto(raiz(fixture).querySelector('[data-teste="explicacao"] .hint'));

    // Act
    const padrao = dica();
    await escolher(fixture, 'Últimos 100');

    // Assert
    expect(padrao).toContain('200 concursos');
    expect(dica()).toContain('100 concursos');
    expect(texto(raiz(fixture).querySelector('[data-teste="explicacao"] p'))).toContain('10 jogos de 6 dezenas');
  });

  it('rodar mostra o resultado de cada estratégia igual ao do core, com o acaso como referência', async () => {
    // Arrange
    const historico = historicoMegaSena(300);
    store.historico.set(historico);
    const esperado = testarEstrategias(historico, { concursos: 200, dezenasPorJogo: 6, jogosPorConcurso: 10, semente: 1 });
    const fixture = await renderizar();

    // Act
    await rodar(fixture);

    // Assert
    const kpis = Array.from(raiz(fixture).querySelectorAll('srt-kpi')).map(texto);
    expect(kpis[0]).toContain('200');
    expect(kpis[0]).toContain('do 101 ao 300');
    expect(kpis[2]).toContain('0,600');
    const linhas = Array.from(raiz(fixture).querySelectorAll('[data-teste="tabela"] tbody tr'));
    expect(linhas.map((l) => l.getAttribute('data-estrategia'))).toEqual(['aleatorio', 'atrasadas', 'frequentes', 'mista', 'ritmo']);
    esperado.estrategias.forEach((estrategia, i) => {
      const celulas = Array.from(linhas[i].querySelectorAll('td')).map(texto);
      expect(celulas[1]).toBe(estrategia.mediaAcertos.toFixed(3).replace('.', ','));
      expect(celulas[5]).toBe(
        { dentro: 'dentro do acaso', acima: 'acima do acaso', abaixo: 'abaixo do acaso' }[
          vereditoDe(estrategia.mediaAcertos, estrategia.margem, 0.6)
        ],
      );
    });
    expect(raiz(fixture).querySelectorAll('[data-teste="grafico"] circle')).toHaveLength(5);
    expect(texto(raiz(fixture).querySelector('[data-teste="rodar"]'))).toBe('Rodar de novo');
  });

  it('rodar de novo usa outra semente (outros jogos)', async () => {
    // Arrange
    const historico = historicoMegaSena(300);
    store.historico.set(historico);
    const segunda = testarEstrategias(historico, { concursos: 200, dezenasPorJogo: 6, jogosPorConcurso: 10, semente: 2 });
    const fixture = await renderizar();
    await rodar(fixture);

    // Act
    await rodar(fixture);

    // Assert
    const celula = raiz(fixture).querySelector('[data-estrategia="aleatorio"] td:nth-child(2)');
    expect(texto(celula)).toBe(segunda.estrategias[0].mediaAcertos.toFixed(3).replace('.', ','));
  });

  it('quando até o aleatório passa da margem, a conclusão avisa que é sorte da rodada', async () => {
    // Arrange
    const historico = historicoMegaSena(300);
    store.historico.set(historico);
    const fixture = await renderizar();
    const base = testarEstrategias(historico, { concursos: 200, dezenasPorJogo: 6 });
    const resultado = {
      ...base,
      estrategias: base.estrategias.map((e) =>
        e.estrategia === 'aleatorio' ? { ...e, mediaAcertos: 0.62, margem: 0.01 } : { ...e, mediaAcertos: 0.6 },
      ),
    };

    // Act
    (fixture.componentInstance as unknown as { resultado: WritableSignal<ResultadoTesteEstrategias> }).resultado.set(
      resultado,
    );
    await fixture.whenStable();

    // Assert
    const conclusao = texto(raiz(fixture).querySelectorAll('srt-kpi')[3]);
    expect(conclusao).toContain('1 fora');
    expect(conclusao).toContain('Aleatório acima do acaso · até o aleatório passou: é sorte da rodada');
  });

  it('trocar de loteria limpa o resultado', async () => {
    // Arrange
    store.historico.set(historicoMegaSena(300));
    const fixture = await renderizar();
    await rodar(fixture);

    // Act
    await store.selecionarLoteria(LOTOMANIA_FALSA.id);
    await fixture.whenStable();

    // Assert
    expect(raiz(fixture).querySelector('[data-teste="kpis"]')).toBeNull();
    expect(texto(raiz(fixture).querySelector('[data-teste="rodar"]'))).toBe('Rodar teste');
  });
});
