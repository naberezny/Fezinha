const formatadorInteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const formatadorMilhoes = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/**
 * Formata um valor em centavos como reais curtos.
 * Acima de R$ 1 milhão: "R$ 152,7 mi"; abaixo: "R$ 1.234" (sem centavos).
 */
export function formatarReais(centavos: bigint): string {
  const reais = Number(centavos) / 100;
  if (reais >= 1_000_000) {
    return `R$ ${formatadorMilhoes.format(reais / 1_000_000)} mi`;
  }
  return `R$ ${formatadorInteiro.format(reais)}`;
}

/** "2026-10-14" -> "14/10/2026". */
export function formatarDataBR(iso: string): string {
  return iso.split('-').reverse().join('/');
}

/** Número inteiro com separador de milhar pt-BR ("3.070"). */
export function formatarInteiro(valor: number): string {
  return formatadorInteiro.format(valor);
}

/** Dezena com dois dígitos ("07"). */
export function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

/** Escapa texto que vai para dentro de uma dica HTML. */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Maior valor de uma lista (0 quando vazia ou quando todos são não positivos). */
export function maximo(valores: readonly number[]): number {
  let maior = 0;
  for (const valor of valores) {
    if (valor > maior) maior = valor;
  }
  return maior;
}
