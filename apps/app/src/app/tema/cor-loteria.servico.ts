import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { clarear, corValida, tintaSobre } from './cor-loteria';

const PROPRIEDADE_COR = '--cor-loteria';
const ATRIBUTO_TINTA = 'data-tinta';
const ATRIBUTO_TINTA_ESCURO = 'data-tinta-escuro';

/**
 * Aplica a cor do jogo ativo no <html>: `--cor-loteria`, `data-tinta` (texto sobre a cor no tema claro) e
 * `data-tinta-escuro` (texto sobre a cor clareada do tema escuro). `styles/tokens.scss` deriva desses três valores
 * todo o destaque do app. Sem cor (tela inicial) ou com cor inválida, remove os três e valem os neutros dos tokens.
 */
@Injectable({ providedIn: 'root' })
export class CorLoteriaServico {
  private readonly raiz = inject(DOCUMENT).documentElement;

  /** Aplica `cor` (#rrggbb); `undefined` ou valor inválido volta ao neutro. */
  definir(cor: string | undefined): void {
    if (!cor || !corValida(cor)) {
      this.limpar();
      return;
    }
    this.raiz.style.setProperty(PROPRIEDADE_COR, cor);
    this.raiz.setAttribute(ATRIBUTO_TINTA, tintaSobre(cor));
    this.raiz.setAttribute(ATRIBUTO_TINTA_ESCURO, tintaSobre(clarear(cor)));
  }

  /** Volta ao neutro definido nos tokens. */
  limpar(): void {
    this.raiz.style.removeProperty(PROPRIEDADE_COR);
    this.raiz.removeAttribute(ATRIBUTO_TINTA);
    this.raiz.removeAttribute(ATRIBUTO_TINTA_ESCURO);
  }
}
