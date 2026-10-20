import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import type { Concurso } from '@sorteios/core';
import { MEGA_SENA } from '@sorteios/loterias/mega-sena';
import { HistoricoStore, JogosSalvosStore, type JogoSalvo } from '../dados/historico.store';
import { HistoricoStoreFalso, JogosSalvosStoreFalso } from '../testes/stores-fake';
import { MeusJogosPage } from './meus-jogos.page';

function concurso(numero: number, data: string, dezenas: number[], extra: Partial<Concurso> = {}): Concurso {
  return {
    numero,
    data,
    dezenas,
    acumulou: true,
    premiacoes: [],
    valorAcumuladoCentavos: 0n,
    estimativaProximoCentavos: 0n,
    arrecadacaoCentavos: 0n,
    acumuladoEspecialCentavos: 0n,
    locaisGanhadores: [],
    ...extra,
  };
}

function jogoSalvo(id: string, dezenas: number[], concursoBase: number, extra: Partial<JogoSalvo> = {}): JogoSalvo {
  return {
    id,
    loteriaId: 'megasena',
    dezenas,
    estrategia: 'atrasadas',
    criadoEm: '2026-10-15T12:00:00.000Z',
    concursoBase,
    ...extra,
  };
}

describe('MeusJogosPage', () => {
  let historico: HistoricoStoreFalso;
  let salvos: JogosSalvosStoreFalso;
  let fixture: ComponentFixture<MeusJogosPage>;

  const raiz = () => fixture.nativeElement as HTMLElement;
  const q = (seletor: string) => raiz().querySelector<HTMLElement>(seletor);
  const qa = (seletor: string) => Array.from(raiz().querySelectorAll<HTMLElement>(seletor));
  const texto = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  async function criarPagina(): Promise<void> {
    fixture = TestBed.createComponent(MeusJogosPage);
    await fixture.whenStable();
  }

  beforeEach(() => {
    historico = new HistoricoStoreFalso();
    salvos = new JogosSalvosStoreFalso();
    historico.historico.set({
      loteria: MEGA_SENA,
      concursos: [
        concurso(3070, '2026-10-14', [1, 2, 3, 4, 5, 6]),
        concurso(3071, '2026-10-17', [3, 14, 22, 35, 41, 58], {
          proximoNumero: 3072,
          dataProximoSorteio: '2026-10-21',
        }),
      ],
    });
    TestBed.configureTestingModule({
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: HistoricoStore, useValue: historico },
        { provide: JogosSalvosStore, useValue: salvos },
      ],
    });
  });

  it('sem jogos da loteria, mostra o estado vazio com link para Gerar', async () => {
    // Arrange
    salvos.jogos.set([
      jogoSalvo('outra', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 3000, { loteriaId: 'lotofacil' }),
    ]);

    // Act
    await criarPagina();

    // Assert
    expect(texto(q('[data-teste="vazio"]'))).toContain('Nenhum jogo da Mega-Sena salvo neste navegador.');
    expect(q('[data-teste="vazio"] a')?.getAttribute('href')).toBe('/megasena/gerar');
    expect(q('[data-teste="kpis"]')).toBeNull();
  });

  it('explica que os jogos ficam só neste navegador e são conferidos quando o resultado sai', async () => {
    // Act
    await criarPagina();

    // Assert
    const explicacao = texto(q('[data-teste="explicacao"]'));
    expect(explicacao).toContain('só neste navegador');
    expect(explicacao).toContain('sem cadastro');
    expect(explicacao).toContain('conferido com o concurso seguinte');
  });

  it('confere o jogo com o concurso seguinte ao da geração e destaca os acertos', async () => {
    // Arrange
    salvos.jogos.set([jogoSalvo('a', [3, 10, 14, 22, 35, 50], 3070)]);

    // Act
    await criarPagina();

    // Assert
    const item = q('[data-teste="conferidos"] [data-teste="jogo-salvo"]');
    expect(texto(item!.querySelector('[data-teste="status"]'))).toBe('Concurso 3.071 (17/10/2026): 4 acertos · Quadra');
    const apagadas = Array.from(item!.querySelectorAll('srt-bola.apagada')).map((b) => texto(b));
    expect(apagadas).toEqual(['10', '50']);
    expect(item!.classList).toContain('premiado');
  });

  it('jogo cujo concurso ainda não saiu fica aguardando, com a data prevista', async () => {
    // Arrange
    salvos.jogos.set([jogoSalvo('b', [1, 2, 3, 4, 5, 6], 3071)]);

    // Act
    await criarPagina();

    // Assert
    const item = q('[data-teste="aguardando"] [data-teste="jogo-salvo"]');
    expect(texto(item!.querySelector('[data-teste="status"]'))).toBe(
      'Aguardando o sorteio do concurso 3.072, previsto para 21/10/2026',
    );
    expect(item!.querySelectorAll('srt-bola.apagada')).toHaveLength(0);
    expect(q('[data-teste="conferidos"]')).toBeNull();
  });

  it('resume a assertividade dos jogos conferidos contra o acaso', async () => {
    // Arrange
    salvos.jogos.set([
      jogoSalvo('a', [3, 10, 14, 22, 35, 50], 3070), // 4 acertos
      jogoSalvo('b', [1, 2, 3, 4, 5, 6], 3070), // 1 acerto
      jogoSalvo('c', [7, 8, 9, 11, 12, 13], 3071), // aguardando
    ]);

    // Act
    await criarPagina();

    // Assert
    const kpis = qa('[data-teste="kpis"] srt-kpi').map((kpi) => Array.from(kpi.children).map(texto).join(' | '));
    expect(kpis).toEqual([
      'Jogos salvos | 3 | 1 aguardando sorteio',
      'Conferidos | 2 | melhor: 4 acertos',
      'Média de acertos | 2,50 | o acaso daria 0,60 por jogo',
      'Premiados | 1 | 50% dos conferidos',
    ]);
    expect(texto(q('[data-teste="distribuicao"]'))).toBe('1 acerto: 1 jogo · 4 acertos: 1 jogo');
  });

  it('remove um jogo salvo', async () => {
    // Arrange
    salvos.jogos.set([jogoSalvo('a', [3, 10, 14, 22, 35, 50], 3070), jogoSalvo('b', [1, 2, 3, 4, 5, 6], 3071)]);
    await criarPagina();

    // Act
    q('[data-teste="aguardando"] [data-teste="remover"]')!.click();
    await fixture.whenStable();

    // Assert
    expect(salvos.jogos().map((j) => j.id)).toEqual(['a']);
    expect(qa('[data-teste="jogo-salvo"]')).toHaveLength(1);
  });
});
