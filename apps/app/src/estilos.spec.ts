import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const RAIZ_SRC = __dirname;
const ARQUIVO_TOKENS = join(RAIZ_SRC, 'styles', 'tokens.scss');
// Cor literal: #rgb, #rrggbb (com ou sem alfa), rgb(), rgba(), hsl() e hsla().
const COR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/gi;

function listarScss(diretorio: string): string[] {
  return readdirSync(diretorio).flatMap((nome) => {
    const caminho = join(diretorio, nome);
    if (statSync(caminho).isDirectory()) {
      return listarScss(caminho);
    }
    return caminho.endsWith('.scss') ? [caminho] : [];
  });
}

function semComentarios(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('estilos', () => {
  const arquivos = listarScss(RAIZ_SRC);
  const foraDosTokens = arquivos.filter((a) => a !== ARQUIVO_TOKENS);

  it('encontra os .scss do app, incluindo os tokens', () => {
    // Arrange / Act
    const nomes = arquivos.map((a) => relative(RAIZ_SRC, a).replace(/\\/g, '/'));

    // Assert
    expect(nomes).toEqual(
      expect.arrayContaining([
        'styles.scss',
        'styles/tokens.scss',
        'styles/utilitarios.scss',
        'app/app.scss',
      ]),
    );
  });

  it('tokens.scss é o único lugar com cores literais', () => {
    // Arrange / Act
    const cores = semComentarios(readFileSync(ARQUIVO_TOKENS, 'utf8')).match(
      COR_LITERAL,
    );

    // Assert
    expect(cores?.length ?? 0).toBeGreaterThan(0);
  });

  it.each(foraDosTokens.map((a) => [relative(RAIZ_SRC, a).replace(/\\/g, '/'), a]))(
    '%s não tem cor literal (use var(--token))',
    (_nome, caminho) => {
      // Arrange
      const conteudo = semComentarios(readFileSync(caminho, 'utf8'));

      // Act
      const encontradas = conteudo.match(COR_LITERAL) ?? [];

      // Assert
      expect(encontradas).toEqual([]);
    },
  );
});
