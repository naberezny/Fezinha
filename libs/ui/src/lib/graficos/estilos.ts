/** Estilos de `.card svg` do protótipo, compartilhados pelos gráficos SVG (só tokens `var(--…)`). */
export const ESTILOS_SVG = `
  :host {
    display: block;
    min-width: 0;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
    font-family: var(--body);
  }
  svg text {
    fill: var(--fg);
    font-size: 11px;
  }
  svg .ax {
    fill: var(--muted);
  }
  svg .num {
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
  }
  svg .grid {
    stroke: var(--grid);
  }
  svg .bar {
    fill: var(--s1);
  }
  svg .bar.dim {
    opacity: 0.35;
  }
  svg .ref {
    stroke: var(--crit);
    stroke-dasharray: 4 3;
  }
`;
