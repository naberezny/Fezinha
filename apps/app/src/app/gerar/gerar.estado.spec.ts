import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { criarRng, type Concurso, type Historico, type LoteriaDefinicao } from '@sorteios/core';
import { MEGA_SENA } from '@sorteios/loterias/mega-sena';
import { HistoricoStore } from '../dados/historico.store';
import { LOTOMANIA_FALSA, historicoLotomaniaFalso } from '../testes/stores-fake';
import { GerarEstado } from './gerar.estado';

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

/** Histórico mínimo 60/6: atraso 0 para 13..18, 1 para 7..12, 2 para 1..6 e 3 para as que nunca saíram. */
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

  async selecionarLoteria(id: string): Promise<void> {
    this.selecionadas.push(id);
  }

  async carregar(): Promise<void> {
    /* sem rede */
  }
  async atualizar(): Promise<void> {
    /* sem rede */
  }
}

describe('GerarEstado', () => {
  let store: HistoricoStoreFalso;
  let estado: GerarEstado;

  beforeEach(() => {
    store = new HistoricoStoreFalso();
    TestBed.configureTestingModule({ providers: [{ provide: HistoricoStore, useValue: store }] });
    estado = TestBed.inject(GerarEstado);
  });

  describe('configuração padrão', () => {
    it('começa em atrasadas, 5 jogos de 6 dezenas, atraso mínimo igual ao esperado e intensidade 2', () => {
      // Arrange / Act (estado recém-criado)

      // Assert
      expect(estado.estrategia()).toBe('atrasadas');
      expect(estado.quantidadeJogos()).toBe(5);
      expect(estado.dezenasPorJogo()).toBe(6);
      expect(estado.fixas()).toEqual([]);
      expect(estado.atrasoMinimo()).toBe(10);
      expect(estado.intensidade()).toBe(2);
      expect(estado.janelaFrequencia()).toBe('50');
    });

    it('liga as regras conforme o padrão dos filtros (linhas desligada)', () => {
      // Arrange / Act / Assert
      expect(estado.regras()).toEqual({
        quadrantes: true,
        colunas: true,
        linhas: false,
        historico: true,
        pares: true,
        consecutivas: true,
      });
    });

    it('mostra 1 combinação e a chance de 1 em 50.063.860 para 6 dezenas', () => {
      // Arrange / Act / Assert
      expect(estado.combinacoes()).toBe(1);
      expect(estado.chanceTexto()).toBe('1 em 50.063.860');
      expect(estado.nomePremioPrincipal()).toBe('Sena');
    });

    it('resume as seções do acordeão', () => {
      // Arrange / Act / Assert
      expect(estado.resumoModo()).toBe('Dezenas atrasadas');
      expect(estado.resumoFixas()).toBe('nenhuma · o sistema escolhe todas as 6');
      expect(estado.resumoRegras()).toBe('2 de 3 ligadas');
      expect(estado.resumoFiltros()).toBe('3 de 3 ligados');
    });

    it('monta a ConfiguracaoGeracao com os valores atuais', () => {
      // Arrange
      estado.definirEstrategia('frequentes');
      estado.definirFixas([10, 3]);

      // Act
      const config = estado.configuracao();

      // Assert
      expect(config).toEqual({
        estrategia: 'frequentes',
        quantidadeJogos: 5,
        dezenasPorJogo: 6,
        fixas: [3, 10],
        atrasadas: { atrasoMinimo: 10, intensidade: 2 },
        frequentes: { periodo: { tipo: 'ultimos', quantidade: 50 } },
        mista: { proporcaoFrias: 0.5 },
        regras: estado.regras(),
      });
    });
  });

  describe('modo misto', () => {
    it('começa com metade para cada lado: extremos com 1,8× o peso das do meio', () => {
      // Act / Assert
      expect(estado.proporcaoFrias()).toBe(0.5);
      expect(estado.rotuloMista()).toBe('metade para cada lado');
      expect(estado.exemplosMista()).toEqual({ maisSaiu: '1,8', meio: '1', menosSaiu: '1,8' });
    });

    it('nas pontas favorece um lado só (21× contra 1×) e entra na configuração', () => {
      // Act
      estado.definirProporcaoFrias(0);
      const soQuentes = { rotulo: estado.rotuloMista(), pesos: estado.exemplosMista() };
      estado.definirProporcaoFrias(1);

      // Assert
      expect(soQuentes).toEqual({ rotulo: 'só as mais frequentes', pesos: { maisSaiu: '21', meio: '6', menosSaiu: '1' } });
      expect(estado.rotuloMista()).toBe('só as menos frequentes');
      expect(estado.exemplosMista()).toEqual({ maisSaiu: '1', meio: '6', menosSaiu: '21' });
      expect(estado.configuracao().mista).toEqual({ proporcaoFrias: 1 });
    });

    it('arredonda para passos de 0,25, limita a 0..1 e descreve as posições intermediárias', () => {
      // Act / Assert
      estado.definirProporcaoFrias(0.3);
      expect(estado.proporcaoFrias()).toBe(0.25);
      expect(estado.rotuloMista()).toBe('75% para as mais frequentes');
      estado.definirProporcaoFrias(0.8);
      expect(estado.rotuloMista()).toBe('75% para as menos frequentes');
      estado.definirProporcaoFrias(7);
      expect(estado.proporcaoFrias()).toBe(1);
      estado.definirProporcaoFrias(-2);
      expect(estado.proporcaoFrias()).toBe(0);
    });
  });

  describe('dezenas por jogo', () => {
    it('com 12 dezenas mostra 924 combinações e tira "colunas" das regras aplicáveis', () => {
      // Arrange / Act
      estado.definirDezenasPorJogo(12);

      // Assert
      expect(estado.combinacoes()).toBe(924);
      expect(estado.combinacoesTexto()).toBe('924');
      expect(estado.chanceTexto()).toBe('1 em 54.182');
      expect(estado.regrasAplicaveis()).not.toContain('colunas');
      expect(estado.regrasAplicaveis()).toContain('quadrantes');
    });

    it('desliga "colunas" quando ela deixa de se aplicar e não a religa sozinha ao voltar', () => {
      // Arrange
      expect(estado.regras()['colunas']).toBe(true);

      // Act
      estado.definirDezenasPorJogo(12);
      const aoSubir = estado.regras()['colunas'];
      estado.definirDezenasPorJogo(8);

      // Assert
      expect(aoSubir).toBe(false);
      expect(estado.regrasAplicaveis()).toContain('colunas');
      expect(estado.regras()['colunas']).toBe(false);
      expect(estado.resumoRegras()).toBe('1 de 3 ligadas');
    });

    it('com 12 dezenas "colunas" e "historico" somem da lista e são desligadas no estado', () => {
      // Arrange
      expect(estado.regrasVisiveis().map((r) => r.id)).toEqual([
        'quadrantes',
        'colunas',
        'linhas',
        'historico',
        'pares',
        'consecutivas',
      ]);

      // Act
      estado.definirDezenasPorJogo(12);

      // Assert
      expect(estado.regrasVisiveis().map((r) => r.id)).toEqual(['quadrantes', 'linhas', 'pares', 'consecutivas']);
      expect(estado.regras()['colunas']).toBe(false);
      expect(estado.regras()['historico']).toBe(false);
      expect(estado.regrasVolante().map((r) => r.id)).toEqual(['quadrantes', 'linhas']);
      expect(estado.regrasEstatisticas().map((r) => r.id)).toEqual(['pares', 'consecutivas']);
    });

    it('o resumo "N de M ligadas" conta só as regras visíveis', () => {
      // Arrange / Act
      estado.definirDezenasPorJogo(12);

      // Assert (volante visível: quadrantes ligada, linhas desligada; estatísticos visíveis: pares e consecutivas ligadas)
      expect(estado.resumoRegras()).toBe('1 de 2 ligadas');
      expect(estado.resumoFiltros()).toBe('2 de 2 ligados');
    });

    it('descreve cada regra visível com grupo, rótulo e ajuda', () => {
      // Arrange / Act
      const porId = Object.fromEntries(estado.regrasVisiveis().map((r) => [r.id, r]));

      // Assert
      expect(porId['quadrantes']).toEqual({
        id: 'quadrantes',
        grupo: 'volante',
        rotulo: 'Pelo menos uma dezena em cada quadrante',
        ajuda: '(Q1 a Q4)',
      });
      expect(porId['colunas'].ajuda).toBe('(10 colunas)');
      expect(porId['linhas'].ajuda).toBe('');
      expect(porId['historico'].grupo).toBe('estatistico');
      expect(porId['pares'].ajuda).toBe('(2 a 4 pares em 6)');
    });

    it('uma loteria que oferece só filtros estatísticos deixa o grupo do volante vazio (a seção some)', () => {
      // Arrange
      const soEstatistica: LoteriaDefinicao = { ...LOTOMANIA_FALSA, id: 'so-pares', regrasDisponiveis: ['pares'] };

      // Act
      store.loterias.set([MEGA_SENA, soEstatistica]);
      store.loteria.set(soEstatistica);

      // Assert
      expect(estado.regrasVolante()).toEqual([]);
      expect(estado.regrasEstatisticas().map((r) => r.id)).toEqual(['pares']);
      expect(estado.resumoRegras()).toBe('0 de 0 ligadas');
    });

    it('uma loteria nova só precisa declarar regrasDisponiveis: a lista da tela segue o que o filtro aceita', () => {
      // Arrange: volante 5 x 5, 25 dezenas, apostas de 15 a 20 (formato da Lotofácil)
      const nova: LoteriaDefinicao = {
        ...MEGA_SENA,
        id: 'nova',
        nome: 'Nova',
        universo: 25,
        primeiraDezena: 1,
        sorteadas: 15,
        aposta: { min: 15, max: 20 },
        volante: { colunas: 5, linhas: 5 },
        regrasDisponiveis: ['quadrantes', 'colunas', 'linhas', 'historico', 'pares', 'consecutivas'],
      };

      // Act
      store.loterias.set([MEGA_SENA, nova]);
      store.loteria.set(nova);

      // Assert: 15 dezenas não cabem em 5 colunas, e 3 por linha x 5 linhas = 15 cabe
      expect(estado.regrasVisiveis().map((r) => r.id)).toEqual(['quadrantes', 'linhas', 'historico', 'pares', 'consecutivas']);
      expect(estado.regras()['colunas']).toBe(false);
    });

    it('restringe o valor ao intervalo da loteria (6 a 20)', () => {
      // Arrange / Act
      estado.definirDezenasPorJogo(2);
      const minimo = estado.dezenasPorJogo();
      estado.definirDezenasPorJogo(99);

      // Assert
      expect(minimo).toBe(6);
      expect(estado.dezenasPorJogo()).toBe(20);
    });

    it('apara as fixas ao reduzir as dezenas por jogo', () => {
      // Arrange
      estado.definirDezenasPorJogo(8);
      estado.definirFixas([1, 2, 3, 4, 5, 6, 7, 8]);

      // Act
      estado.definirDezenasPorJogo(6);

      // Assert
      expect(estado.fixas()).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('gera a legenda de pares para 6 e para 9 dezenas', () => {
      // Arrange / Act
      const para6 = estado.legendaPares();
      estado.definirDezenasPorJogo(9);

      // Assert
      expect(para6).toBe('2 a 4 pares em 6');
      expect(estado.legendaPares()).toBe('3 a 6 pares em 9');
    });
  });

  describe('quantidade de jogos', () => {
    it('limita de 1 a 50 e arredonda', () => {
      // Arrange / Act / Assert
      estado.definirQuantidadeJogos(0);
      expect(estado.quantidadeJogos()).toBe(1);
      estado.definirQuantidadeJogos(99);
      expect(estado.quantidadeJogos()).toBe(50);
      estado.definirQuantidadeJogos(7.4);
      expect(estado.quantidadeJogos()).toBe(7);
    });
  });

  describe('dezenas fixas', () => {
    it('ordena, remove repetidas e ignora dezenas fora do volante', () => {
      // Arrange / Act
      estado.definirFixas([30, 5, 5, 0, 61, 12]);

      // Assert
      expect(estado.fixas()).toEqual([5, 12, 30]);
    });

    it('não aceita mais fixas do que as dezenas por jogo', () => {
      // Arrange / Act
      estado.definirFixas([1, 2, 3, 4, 5, 6, 7, 8]);

      // Assert
      expect(estado.fixas()).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('resume as fixas e quantas o sistema completa', () => {
      // Arrange / Act
      estado.definirFixas([10, 3]);

      // Assert
      expect(estado.resumoFixas()).toBe('03 10 · o sistema completa 4');
    });
  });

  describe('intensidade das atrasadas', () => {
    it('explica 20, 30 e 40 concursos com a intensidade 2 e atraso mínimo 10', () => {
      // Arrange / Act
      const texto = estado.textoIntensidade();

      // Assert
      expect(texto).toContain('há 20 concursos tem 5× mais chance de entrar no jogo');
      expect(texto).toContain('há 30 concursos, 10×');
      expect(texto).toContain('há 40, 17×');
    });

    it('muda o texto quando o slider muda', () => {
      // Arrange
      const antes = estado.textoIntensidade();

      // Act
      estado.definirIntensidade(3);
      const comTres = estado.textoIntensidade();
      estado.definirIntensidade(1);
      const comUm = estado.textoIntensidade();

      // Assert
      expect(comTres).not.toBe(antes);
      expect(comTres).toContain('há 20 concursos tem 9× mais chance');
      expect(comTres).toContain('há 30 concursos, 28×');
      expect(comUm).toContain('há 20 concursos tem 3× mais chance');
      expect(comUm).toContain('há 40, 5×');
    });

    it('com atraso mínimo acima do exemplo o peso volta a 1×', () => {
      // Arrange / Act
      estado.definirAtrasoMinimo(25);

      // Assert
      expect(estado.exemplosIntensidade().map((e) => e.vezes)).toEqual([1, 10, 17]);
    });

    it('usa passos de 0,5 entre 1 e 3 e mostra vírgula decimal', () => {
      // Arrange / Act
      estado.definirIntensidade(2.7);
      const rotulo = estado.intensidadeRotulo();
      const valor = estado.intensidade();
      estado.definirIntensidade(9);

      // Assert
      expect(valor).toBe(2.5);
      expect(rotulo).toBe('2,5');
      expect(estado.intensidade()).toBe(3);
    });
  });

  describe('janela de frequência', () => {
    it('usa o ano do último concurso como "ano atual"', () => {
      // Arrange / Act
      const rotulos = estado.opcoesJanela().map((o) => o.rotulo);

      // Assert
      expect(rotulos).toEqual(['últimos 50', 'últimos 100', 'ano 2026', 'ano 2025', 'histórico todo']);
    });

    it.each([
      ['50', { tipo: 'ultimos', quantidade: 50 }],
      ['100', { tipo: 'ultimos', quantidade: 100 }],
      ['anoAtual', { tipo: 'ano', ano: 2026 }],
      ['anoAnterior', { tipo: 'ano', ano: 2025 }],
      ['tudo', { tipo: 'tudo' }],
    ] as const)('janela %s vira o período correto', (janela, periodo) => {
      // Arrange / Act
      estado.definirJanelaFrequencia(janela);

      // Assert
      expect(estado.configuracao().frequentes.periodo).toEqual(periodo);
    });
  });

  describe('atrasos', () => {
    it('calcula o atraso de cada dezena no histórico inteiro', () => {
      // Arrange / Act
      const atrasos = estado.atrasos();

      // Assert
      expect(atrasos[13]).toBe(0);
      expect(atrasos[7]).toBe(1);
      expect(atrasos[1]).toBe(2);
      expect(atrasos[30]).toBe(3);
    });

    it('fica vazio sem histórico', () => {
      // Arrange / Act
      store.historico.set(undefined);

      // Assert
      expect(estado.atrasos()).toEqual({});
    });
  });

  describe('gerar', () => {
    it('gera a quantidade de jogos pedida, cada um com as dezenas por jogo', () => {
      // Arrange / Act
      const resultado = estado.gerar(criarRng(1));

      // Assert
      expect(resultado?.jogos).toHaveLength(5);
      expect(resultado?.incompleto).toBe(false);
      expect(estado.resultado()).toBe(resultado);
      for (const jogo of estado.jogos()) {
        expect(jogo.dezenas).toHaveLength(6);
      }
    });

    it('é determinístico para a mesma semente', () => {
      // Arrange
      const primeiro = estado.gerar(criarRng(1))?.jogos.map((j) => j.dezenas);

      // Act
      const segundo = estado.gerar(criarRng(1))?.jogos.map((j) => j.dezenas);

      // Assert
      expect(segundo).toEqual(primeiro);
    });

    it('monta o título da saída com a configuração usada, mesmo se a tela mudar depois', () => {
      // Arrange
      estado.definirQuantidadeJogos(3);
      estado.definirDezenasPorJogo(7);
      estado.definirEstrategia('mista');

      // Act
      estado.gerar(criarRng(1));
      estado.definirQuantidadeJogos(10);
      estado.definirEstrategia('aleatorio');

      // Assert
      expect(estado.tituloSaida()).toBe('3 jogos · 7 dezenas · modo mista');
      expect(estado.configuracaoUsada()?.quantidadeJogos).toBe(3);
      expect(estado.quantidadeSolicitada()).toBe(3);
    });

    it('usa o singular com 1 jogo', () => {
      // Arrange
      estado.definirQuantidadeJogos(1);

      // Act
      estado.gerar(criarRng(1));

      // Assert
      expect(estado.tituloSaida()).toBe('1 jogo · 6 dezenas · modo atrasadas');
    });

    it('gera texto de cópia e jogos para salvar com o concurso base', () => {
      // Arrange
      estado.definirQuantidadeJogos(2);
      estado.gerar(criarRng(1));
      const [primeiro, segundo] = estado.jogos();
      const formatar = (dezenas: number[]) => dezenas.map((d) => String(d).padStart(2, '0')).join(' ');

      // Act
      const texto = estado.textoJogos();
      const paraSalvar = estado.jogosParaSalvar();

      // Assert
      expect(texto).toBe(`Jogo 01: ${formatar(primeiro.dezenas)}\nJogo 02: ${formatar(segundo.dezenas)}`);
      expect(paraSalvar).toEqual([
        { loteriaId: 'megasena', dezenas: primeiro.dezenas, estrategia: 'atrasadas', concursoBase: 3 },
        { loteriaId: 'megasena', dezenas: segundo.dezenas, estrategia: 'atrasadas', concursoBase: 3 },
      ]);
    });

    it('com todas as fixas em sequência nenhum jogo passa pelos filtros', () => {
      // Arrange
      estado.definirFixas([1, 2, 3, 4, 5, 6]);

      // Act
      const resultado = estado.gerar(criarRng(1));

      // Assert
      expect(resultado?.jogos).toEqual([]);
      expect(resultado?.incompleto).toBe(true);
      expect(estado.semJogos()).toBe(true);
      expect(estado.temJogos()).toBe(false);
      expect(estado.tituloSaida()).toBe('Jogos gerados');
    });

    it('sem histórico não gera e não altera o resultado', () => {
      // Arrange
      store.historico.set(undefined);

      // Act
      const resultado = estado.gerar(criarRng(1));

      // Assert
      expect(resultado).toBeUndefined();
      expect(estado.resultado()).toBeUndefined();
      expect(estado.semJogos()).toBe(false);
    });
  });

  describe('limpar', () => {
    it('apaga o resultado e mantém a configuração', () => {
      // Arrange
      estado.definirQuantidadeJogos(4);
      estado.gerar(criarRng(1));

      // Act
      estado.limpar();

      // Assert
      expect(estado.resultado()).toBeUndefined();
      expect(estado.configuracaoUsada()).toBeUndefined();
      expect(estado.jogos()).toEqual([]);
      expect(estado.tituloSaida()).toBe('Jogos gerados');
      expect(estado.quantidadeJogos()).toBe(4);
    });
  });

  describe('com atraso esperado fracionário (25/15, como a Lotofácil)', () => {
    const LOTERIA_25: LoteriaDefinicao = {
      ...MEGA_SENA,
      id: 'teste25',
      universo: 25,
      sorteadas: 15,
      aposta: { min: 15, max: 20 },
      volante: { colunas: 5, linhas: 5 },
    };

    beforeEach(() => {
      store.loterias.set([MEGA_SENA, LOTERIA_25]);
      store.loteria.set(LOTERIA_25);
    });

    it('mantém a referência exata, exibe "1,7" e começa o atraso mínimo no inteiro mais próximo (2)', () => {
      // Arrange / Act / Assert
      expect(estado.atrasoReferencia()).toBeCloseTo(25 / 15);
      expect(estado.atrasoReferenciaTexto()).toBe('1,7');
      expect(estado.atrasoMinimo()).toBe(2);
    });
  });

  describe('com a definição da Lotomania (fake 100/20/50)', () => {
    beforeEach(() => {
      store.loterias.set([MEGA_SENA, LOTOMANIA_FALSA]);
      store.loteria.set(LOTOMANIA_FALSA);
      store.historico.set(historicoLotomaniaFalso());
    });

    it('usa a aposta fixa de 50 dezenas e o atraso esperado de 5 concursos', () => {
      // Arrange / Act / Assert
      expect(estado.apostaFixa()).toBe(true);
      expect(estado.dezenasPorJogo()).toBe(50);
      expect(estado.atrasoReferencia()).toBe(5);
      expect(estado.atrasoMinimo()).toBe(5);
      expect(estado.nomePremioPrincipal()).toBe('20 acertos');
      expect(estado.resumoFixas()).toBe('nenhuma · o sistema escolhe todas as 50');
    });

    it('não deixa mudar o tamanho da aposta fixa', () => {
      // Arrange / Act
      estado.definirDezenasPorJogo(20);
      const menor = estado.dezenasPorJogo();
      estado.definirDezenasPorJogo(80);

      // Assert
      expect(menor).toBe(50);
      expect(estado.dezenasPorJogo()).toBe(50);
    });

    it('mostra só quadrantes no volante e pares nos filtros estatísticos ("linhas" não cabe em 50 dezenas)', () => {
      // Arrange / Act / Assert
      expect(estado.regrasVolante().map((r) => r.id)).toEqual(['quadrantes']);
      expect(estado.regrasEstatisticas().map((r) => r.id)).toEqual(['pares']);
      expect(estado.resumoRegras()).toBe('1 de 1 ligadas');
      expect(estado.resumoFiltros()).toBe('1 de 1 ligados');
    });

    it('"linhas" não se aplica a 50 dezenas (3 por linha x 10 linhas = 30): fica oculta e desligada desde o início', () => {
      // Arrange / Act / Assert
      expect(estado.regrasAplicaveis()).toEqual(['quadrantes', 'pares']);
      expect(estado.regras()).toEqual({
        quadrantes: true,
        colunas: false,
        linhas: false,
        historico: false,
        pares: true,
        consecutivas: false,
      });
    });

    it('ligar uma regra que não se aplica é ignorado', () => {
      // Arrange / Act
      estado.definirRegra('linhas', true);
      estado.definirRegra('colunas', true);

      // Assert
      expect(estado.regras()['linhas']).toBe(false);
      expect(estado.regras()['colunas']).toBe(false);
    });

    it('aceita a dezena 00 como fixa e rejeita 100', () => {
      // Arrange / Act
      estado.definirFixas([99, 0, 100, -1, 5, 5]);

      // Assert
      expect(estado.fixas()).toEqual([5, 99, 0]);
      expect(estado.resumoFixas()).toBe('05 99 00 · o sistema completa 47');
    });

    it('calcula o atraso de todas as dezenas, inclusive a 00', () => {
      // Arrange / Act
      const atrasos = estado.atrasos();

      // Assert
      expect(Object.keys(atrasos)).toHaveLength(100);
      expect(atrasos[0]).toBeDefined();
      expect(atrasos[99]).toBeDefined();
    });

    it('usa 2x, 3x e 4x o atraso esperado nos exemplos da intensidade (10, 15 e 20 concursos)', () => {
      // Arrange / Act
      const exemplos = estado.exemplosIntensidade();

      // Assert
      expect(exemplos.map((e) => e.atraso)).toEqual([10, 15, 20]);
      expect(estado.textoIntensidade()).toContain('não sai há 10 concursos');
    });

    it('mostra a chance do prêmio principal com 50 dezenas (1 em C(100,20)/C(50,20))', () => {
      // Arrange / Act / Assert
      expect(estado.chanceTexto()).toMatch(/^1 em 11\.372\.6\d\d$/);
    });

    it('gera 50 dezenas distintas em 00..99 por jogo', () => {
      // Arrange
      estado.definirQuantidadeJogos(3);
      estado.definirFixas([0, 99]);

      // Act
      const resultado = estado.gerar(criarRng(7));

      // Assert
      expect(resultado?.jogos).toHaveLength(3);
      for (const jogo of resultado?.jogos ?? []) {
        expect(jogo.dezenas).toHaveLength(50);
        expect(new Set(jogo.dezenas).size).toBe(50);
        expect(Math.min(...jogo.dezenas)).toBe(0);
        expect(Math.max(...jogo.dezenas)).toBe(99);
      }
      expect(estado.tituloSaida()).toBe('3 jogos · 50 dezenas · modo atrasadas');
      expect(estado.textoJogos().split('\n')[0].endsWith(' 99 00')).toBe(true);
      expect(estado.jogosParaSalvar()[0].loteriaId).toBe('lotomania');
    });
  });

  describe('troca de loteria', () => {
    it('reinicia a configuração específica e limpa o resultado, mas mantém quantidade, modo e intensidade', () => {
      // Arrange
      estado.definirQuantidadeJogos(7);
      estado.definirEstrategia('mista');
      estado.definirIntensidade(3);
      estado.definirDezenasPorJogo(9);
      estado.definirFixas([1, 2]);
      estado.definirAtrasoMinimo(33);
      estado.definirRegra('quadrantes', false);
      estado.gerar(criarRng(1));
      expect(estado.temJogos()).toBe(true);

      // Act
      store.loterias.set([MEGA_SENA, LOTOMANIA_FALSA]);
      store.loteria.set(LOTOMANIA_FALSA);
      store.historico.set(historicoLotomaniaFalso());

      // Assert
      expect(estado.dezenasPorJogo()).toBe(50);
      expect(estado.fixas()).toEqual([]);
      expect(estado.atrasoMinimo()).toBe(5);
      expect(estado.regras()['quadrantes']).toBe(true);
      expect(estado.resultado()).toBeUndefined();
      expect(estado.configuracaoUsada()).toBeUndefined();
      expect(estado.quantidadeJogos()).toBe(7);
      expect(estado.estrategia()).toBe('mista');
      expect(estado.intensidade()).toBe(3);
    });

    it('voltar à Mega-Sena restaura o tamanho mínimo da aposta', () => {
      // Arrange
      store.loterias.set([MEGA_SENA, LOTOMANIA_FALSA]);
      store.loteria.set(LOTOMANIA_FALSA);
      expect(estado.dezenasPorJogo()).toBe(50);

      // Act
      store.loteria.set(MEGA_SENA);

      // Assert
      expect(estado.dezenasPorJogo()).toBe(6);
      expect(estado.apostaFixa()).toBe(false);
      expect(estado.atrasoMinimo()).toBe(10);
    });

    it('trocar para uma definição nova da MESMA loteria não reinicia a configuração', () => {
      // Arrange
      estado.definirDezenasPorJogo(9);

      // Act
      store.loteria.set({ ...MEGA_SENA });

      // Assert
      expect(estado.dezenasPorJogo()).toBe(9);
    });
  });
});
