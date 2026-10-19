/** Estado persistido da sincronização relevante para decidir se a consulta à Caixa é necessária. */
export interface EstadoSincronizacao {
  ultimaEm: string | null;
  proximoSorteioEm: string | null;
}

const UMA_HORA_MS = 60 * 60 * 1000;
export const VALIDADE_MS = 24 * UMA_HORA_MS;
/** Depois do horário do sorteio, intervalo mínimo entre consultas enquanto a Caixa ainda não publicou o resultado. */
export const REVERIFICACAO_POS_SORTEIO_MS = 10 * 60 * 1000;

/** Sorteio às 20h de Brasília (UTC-3, sem horário de verão) = 23:00Z. */
export const HORA_SORTEIO_UTC = 'T23:00:00Z';

/** "aaaa-mm-dd" do próximo sorteio → instante ISO 8601 do sorteio (20h de Brasília). */
export function instanteDoSorteio(dataIso: string): string {
  return `${dataIso}${HORA_SORTEIO_UTC}`;
}

/**
 * Seção 5.3, passo 1: vencida se nunca sincronizou, se faz mais de 24 h, ou se o próximo sorteio já passou.
 * Refinamento: quando já se consultou depois do horário do sorteio e a Caixa ainda devolve o concurso antigo,
 * só reconsulta a cada 10 minutos (sem isso, cada leitura entre o sorteio e a publicação bateria na Caixa).
 */
export function estaVencida(estado: EstadoSincronizacao, agora: Date): boolean {
  if (!estado.ultimaEm) return true;
  const ultima = Date.parse(estado.ultimaEm);
  if (Number.isNaN(ultima)) return true;
  const instante = agora.getTime();
  if (instante - ultima > VALIDADE_MS) return true;

  if (estado.proximoSorteioEm) {
    const sorteio = Date.parse(estado.proximoSorteioEm);
    if (!Number.isNaN(sorteio) && sorteio <= instante) {
      if (ultima < sorteio) return true;
      return instante - ultima > REVERIFICACAO_POS_SORTEIO_MS;
    }
  }
  return false;
}
