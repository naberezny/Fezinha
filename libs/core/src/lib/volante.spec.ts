import { chanceUmEm, coluna, combinacoes, combinacoesExatas, linha, quadrante, totalCombinacoes } from './volante';
import { LOTERIA_TESTE, LOTERIA_TESTE_100 } from '../testes/loteria-teste';

describe('volante: combinações e chance', () => {
  it('combinacoes calcula C(n, k) para valores pequenos', () => {
    expect(combinacoes(6, 6)).toBe(1);
    expect(combinacoes(7, 6)).toBe(7);
    expect(combinacoes(12, 6)).toBe(924);
    expect(combinacoes(20, 6)).toBe(38760);
    expect(totalCombinacoes(LOTERIA_TESTE)).toBe(50063860);
  });

  it('combinacoesExatas é exata acima de 2^53', () => {
    // Arrange
    const esperado = BigInt('535983370403809682970');

    // Act
    const total = combinacoesExatas(100, 20);

    // Assert
    expect(total).toBe(esperado);
    expect(combinacoesExatas(50, 20)).toBe(BigInt('47129212243960'));
    expect(combinacoesExatas(5, 6)).toBe(BigInt(0));
  });

  it('chanceUmEm reproduz a tabela oficial da Mega-Sena (arredondada) e é exata na Lotomania', () => {
    expect(chanceUmEm(6, LOTERIA_TESTE)).toBe(50063860);
    expect(chanceUmEm(7, LOTERIA_TESTE)).toBe(7151980);
    expect(chanceUmEm(8, LOTERIA_TESTE)).toBe(1787995); // divisão exata (50.063.860 / 28)
    expect(chanceUmEm(12, LOTERIA_TESTE)).toBe(54182); // 54.181,67
    // quociente exato 11.372.635,885 → 11.372.636 (a Caixa publica o valor truncado, 11.372.635)
    expect(chanceUmEm(50, LOTERIA_TESTE_100)).toBe(11372636);
  });

  it('chanceUmEm devolve 0 quando o jogo tem menos dezenas que o sorteio', () => {
    expect(chanceUmEm(5, LOTERIA_TESTE)).toBe(0);
  });
});

describe('volante: geometria com primeira dezena 0 e 1', () => {
  it('Mega-Sena (01..60): 01 → coluna 0, linha 0, quadrante 0; 60 → quadrante 3', () => {
    expect(coluna(1, LOTERIA_TESTE)).toBe(0);
    expect(linha(1, LOTERIA_TESTE)).toBe(0);
    expect(quadrante(1, LOTERIA_TESTE)).toBe(0);
    expect(quadrante(10, LOTERIA_TESTE)).toBe(1);
    expect(quadrante(51, LOTERIA_TESTE)).toBe(2);
    expect(quadrante(60, LOTERIA_TESTE)).toBe(3);
  });

  it('Lotomania (00..99): 00 → coluna 0, linha 0, quadrante 0; 99 → quadrante 3', () => {
    expect(coluna(0, LOTERIA_TESTE_100)).toBe(0);
    expect(linha(0, LOTERIA_TESTE_100)).toBe(0);
    expect(quadrante(0, LOTERIA_TESTE_100)).toBe(0);
    expect(quadrante(9, LOTERIA_TESTE_100)).toBe(1);
    expect(quadrante(90, LOTERIA_TESTE_100)).toBe(2);
    expect(quadrante(99, LOTERIA_TESTE_100)).toBe(3);
  });
});
