import { descreverSaidaExterna } from './saida-externa';

describe('descreverSaidaExterna', () => {
  it('sem proxy configurado, a conexão é direta', () => {
    // Act / Assert
    expect(descreverSaidaExterna({})).toBe('Chamadas à Caixa: conexão direta');
  });

  it('HTTPS_PROXY sem NODE_USE_ENV_PROXY=1 não é usado pelo fetch: conexão direta', () => {
    // Act / Assert
    expect(descreverSaidaExterna({ HTTPS_PROXY: 'http://10.0.0.1:8888' })).toBe(
      'Chamadas à Caixa: conexão direta',
    );
  });

  it('com proxy ligado, mostra protocolo, host e porta, mas nunca usuário e senha', () => {
    // Act
    const texto = descreverSaidaExterna({
      NODE_USE_ENV_PROXY: '1',
      HTTPS_PROXY: 'http://fezinha:segredo@10.0.0.1:8888',
    });

    // Assert
    expect(texto).toBe('Chamadas à Caixa: via proxy http://10.0.0.1:8888');
    expect(texto).not.toContain('segredo');
  });

  it('URL inválida avisa sem repetir o valor', () => {
    // Act
    const texto = descreverSaidaExterna({
      NODE_USE_ENV_PROXY: '1',
      HTTPS_PROXY: 'nao é url com senha',
    });

    // Assert
    expect(texto).toBe(
      'Chamadas à Caixa: via proxy (URL inválida em HTTPS_PROXY)',
    );
  });
});
