/**
 * Cálculos puros da cor por jogo: luminância, tinta do texto sobre a cor e versão clareada para o tema escuro.
 * Sem DOM; quem grava o resultado no <html> é `CorLoteriaServico`.
 */

/** Tinta do texto sobre a cor do jogo: "clara" = texto claro (branco), "escura" = texto escuro. */
export type Tinta = 'clara' | 'escura';

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Maior luminância relativa (WCAG) em que ainda se usa texto claro: é onde o contraste do branco cai a 3,5:1
 * (1,05 / (L + 0,05) = 3,5), o mínimo para texto grande e rótulos em negrito de botões e bolas. Acima disso o
 * texto escuro tem contraste maior. Mega-Sena (L 0,24) fica com texto branco; Lotomania (L 0,36), com texto escuro.
 */
export const LIMITE_LUMINANCIA_TINTA_CLARA = 0.25;

/** Proporção da cor do jogo mantida ao clarear para o tema escuro (o resto é branco), igual ao CSS dos tokens. */
export const PROPORCAO_COR_NO_TEMA_ESCURO = 0.7;

/** Verdadeiro para `#rgb` e `#rrggbb`. */
export function corValida(hex: string): boolean {
  return HEX.test(hex);
}

function canais(hex: string): [number, number, number] {
  if (!corValida(hex)) throw new RangeError(`Cor inválida: "${hex}"`);
  const cheio = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  return [1, 3, 5].map((i) => parseInt(cheio.slice(i, i + 2), 16)) as [number, number, number];
}

function linearizar(canal: number): number {
  const c = canal / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Luminância relativa WCAG (0 = preto, 1 = branco). Lança `RangeError` para cor inválida. */
export function luminancia(hex: string): number {
  const [r, g, b] = canais(hex).map(linearizar);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Tinta do texto sobre `hex`: "clara" para cores escuras/saturadas, "escura" para cores claras. */
export function tintaSobre(hex: string): Tinta {
  return luminancia(hex) <= LIMITE_LUMINANCIA_TINTA_CLARA ? 'clara' : 'escura';
}

/**
 * Mistura `hex` com branco mantendo `proporcaoDaCor` da cor original; mesmo cálculo do
 * `color-mix(in srgb, cor 70%, white)` dos tokens. Devolve `#rrggbb` minúsculo.
 */
export function clarear(hex: string, proporcaoDaCor = PROPORCAO_COR_NO_TEMA_ESCURO): string {
  const misturado = canais(hex).map((canal) => Math.round(canal * proporcaoDaCor + 255 * (1 - proporcaoDaCor)));
  return `#${misturado.map((canal) => canal.toString(16).padStart(2, '0')).join('')}`;
}
