import { computed, signal } from '@angular/core';
import type { Concurso, Historico, LoteriaDefinicao } from '@sorteios/core';
import { MEGA_SENA } from '@sorteios/loterias/mega-sena';
import { HistoricoStore, JogosSalvosStore, type JogoSalvo } from '../dados/historico.store';

/**
 * Definição de teste no formato da Lotomania (00..99, 20 sorteadas, aposta fixa de 50, volante 10 × 10, 7 faixas).
 * O app não importa a lib da Lotomania: as loterias chegam pela API, então os testes também usam uma cópia local.
 */
export const LOTOMANIA_FALSA: LoteriaDefinicao = {
  id: 'lotomania',
  nome: 'Lotomania',
  cor: '#f78100',
  universo: 100,
  primeiraDezena: 0,
  sorteadas: 20,
  aposta: { min: 50, max: 50 },
  volante: { colunas: 10, linhas: 10 },
  quadrantes: 4,
  faixas: [
    { faixa: 1, acertos: 20, nome: '20 acertos' },
    { faixa: 2, acertos: 19, nome: '19 acertos' },
    { faixa: 3, acertos: 18, nome: '18 acertos' },
    { faixa: 4, acertos: 17, nome: '17 acertos' },
    { faixa: 5, acertos: 16, nome: '16 acertos' },
    { faixa: 6, acertos: 15, nome: '15 acertos' },
    { faixa: 7, acertos: 0, nome: 'Nenhum acerto' },
  ],
  diasSorteio: [1, 3, 5],
  regrasDisponiveis: ['quadrantes', 'linhas', 'pares'],
};

/**
 * Concurso de teste da Lotomania: 20 dezenas distintas de 00..99 (passo 5, deslocadas conforme o número do
 * concurso), em ordem crescente. Paga o prêmio principal (1 ganhador) quando `ganhadores` > 0.
 */
export function concursoLotomaniaFalso(numero: number, data: string, ganhadores = 0): Concurso {
  const dezenas = Array.from({ length: 20 }, (_, k) => (numero * 7 + k * 5) % 100).sort((a, b) => a - b);
  const rateio = ganhadores > 0 ? 100_000_000n : 0n;
  return {
    numero,
    data,
    dezenas,
    acumulou: ganhadores === 0,
    premiacoes: [{ faixa: 1, ganhadores, rateioCentavos: rateio }],
    valorAcumuladoCentavos: ganhadores === 0 ? 50_000_000n : 0n,
    estimativaProximoCentavos: 120_000_000n,
    arrecadacaoCentavos: 0n,
    acumuladoEspecialCentavos: 0n,
    locaisGanhadores: ganhadores > 0 ? [{ descricao: 'SP', uf: 'SP', quantidade: ganhadores }] : [],
  };
}

/** Histórico de teste da Lotomania: um concurso a cada 2 dias a partir de 01/01/2026; paga a cada 5º concurso. */
export function historicoLotomaniaFalso(quantidade = 30): Historico {
  const concursos = Array.from({ length: quantidade }, (_, i) =>
    concursoLotomaniaFalso(2900 + i, new Date(Date.UTC(2026, 0, 1 + i * 2)).toISOString().slice(0, 10), i % 5 === 4 ? 1 : 0),
  );
  return { loteria: LOTOMANIA_FALSA, concursos };
}

/**
 * Fake de `HistoricoStore` sem rede nem IndexedDB; começa sem histórico (estado de carregamento).
 * `selecionarLoteria` troca `loteria` entre as definições de `loterias` (e registra o id em `selecionadas`);
 * o histórico da nova loteria é responsabilidade do teste (`historico.set(...)`).
 */
export class HistoricoStoreFalso extends HistoricoStore {
  readonly loterias = signal<LoteriaDefinicao[]>([MEGA_SENA]);
  readonly loteria = signal<LoteriaDefinicao>(MEGA_SENA);
  readonly selecionadas: string[] = [];
  readonly historico = signal<Historico | undefined>(undefined);
  readonly ultimo = computed(() => this.historico()?.concursos.at(-1));
  readonly carregando = signal(false);
  readonly erro = signal<string | undefined>(undefined);
  readonly atualizadoEm = signal<string | undefined>(undefined);
  readonly somenteCache = signal(false);

  async selecionarLoteria(id: string): Promise<void> {
    const definicao = this.loterias().find((l) => l.id === id);
    if (!definicao) return;
    this.selecionadas.push(id);
    this.loteria.set(definicao);
  }
  async carregar(): Promise<void> {
    /* sem rede */
  }
  async atualizar(): Promise<void> {
    /* sem rede */
  }
}

/** Fake de `JogosSalvosStore` em memória, sem IndexedDB; o teste preenche `jogos` direto quando precisa. */
export class JogosSalvosStoreFalso extends JogosSalvosStore {
  readonly jogos = signal<JogoSalvo[]>([]);
  private _proximoId = 1;

  async carregar(): Promise<void> {
    /* vazio */
  }
  async salvar(jogos: Omit<JogoSalvo, 'id' | 'criadoEm'>[]): Promise<void> {
    const criadoEm = new Date().toISOString();
    const novos = jogos.map((j) => ({ ...j, id: `falso-${this._proximoId++}`, criadoEm }));
    this.jogos.update((atuais) => [...novos, ...atuais]);
  }
  async remover(id: string): Promise<void> {
    this.jogos.update((atuais) => atuais.filter((j) => j.id !== id));
  }
}
