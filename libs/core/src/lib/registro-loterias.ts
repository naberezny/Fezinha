import type { LoteriaDefinicao } from './tipos';

const registro = new Map<string, LoteriaDefinicao>();

/** Registra uma loteria. Lança erro se o id já existir ou a definição for inválida. */
export function registrarLoteria(def: LoteriaDefinicao): void {
  validarDefinicao(def);
  if (registro.has(def.id)) {
    throw new Error(`Loteria já registrada: ${def.id}`);
  }
  registro.set(def.id, def);
}

export function obterLoteria(id: string): LoteriaDefinicao {
  const def = registro.get(id);
  if (!def) {
    throw new Error(`Loteria desconhecida: ${id}. Registradas: ${[...registro.keys()].join(', ') || 'nenhuma'}`);
  }
  return def;
}

export function listarLoterias(): LoteriaDefinicao[] {
  return [...registro.values()];
}

/** Somente para testes: limpa o registro. */
export function limparRegistroLoterias(): void {
  registro.clear();
}

export function validarDefinicao(def: LoteriaDefinicao): void {
  const erros: string[] = [];
  if (!def.id?.trim()) erros.push('id obrigatório');
  if (!def.nome?.trim()) erros.push('nome obrigatório');
  if (!/^#[0-9a-fA-F]{6}$/.test(def.cor ?? '')) erros.push('cor deve ser hex #rrggbb');
  if (!(def.universo > 1)) erros.push('universo deve ser > 1');
  if (def.primeiraDezena !== 0 && def.primeiraDezena !== 1) erros.push('primeiraDezena deve ser 0 ou 1');
  if (!(def.sorteadas >= 1 && def.sorteadas <= def.universo)) erros.push('sorteadas deve estar entre 1 e universo');
  if (!(def.aposta.min >= def.sorteadas)) erros.push('aposta.min deve ser >= sorteadas');
  if (!(def.aposta.max >= def.aposta.min && def.aposta.max <= def.universo)) erros.push('aposta.max inválido');
  if (def.volante.colunas * def.volante.linhas !== def.universo) erros.push('volante (colunas × linhas) deve cobrir o universo');
  if (def.quadrantes !== 4) erros.push('quadrantes deve ser 4');
  if (!def.faixas.length) erros.push('faixas obrigatórias');
  if (!def.diasSorteio.every((d) => d >= 0 && d <= 6)) erros.push('diasSorteio deve conter 0..6');
  if (erros.length) {
    throw new Error(`Definição de loteria inválida (${def.id ?? '?'}): ${erros.join('; ')}`);
  }
}
