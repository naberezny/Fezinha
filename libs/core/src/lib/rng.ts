import type { Rng } from './tipos';

/** Gerador determinístico (mulberry32) para testes e reprodutibilidade. Devolve valores em [0, 1). */
export function criarRng(semente: number): Rng {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gerador aleatório de produção (crypto quando disponível, senão Math.random). */
export function rngPadrao(): Rng {
  const criptografia = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
  if (criptografia && typeof criptografia.getRandomValues === 'function') {
    const buffer = new Uint32Array(1);
    return () => {
      criptografia.getRandomValues!(buffer);
      return buffer[0] / 4294967296;
    };
  }
  return () => Math.random();
}
