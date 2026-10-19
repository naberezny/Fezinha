import { ConfigService } from '@nestjs/config';
import {
  cabecalhosDaUltimaChamada,
  encerrarCaixaSimulada,
  iniciarCaixaSimulada,
  limparCaixaSimulada,
  simularCaixa,
  urlCaixaSimulada,
} from '../testes/caixa-simulada';
import { CaixaCliente } from './caixa.cliente';
import {
  CONFIG_SINCRONIZACAO_PADRAO,
  type ConfiguracaoSincronizacao,
} from './configuracao';

const AJUSTES: ConfiguracaoSincronizacao = {
  ...CONFIG_SINCRONIZACAO_PADRAO,
  pausaTentativasMs: 0,
  timeoutMs: 2000,
};

const criarCliente = (ajustes = AJUSTES) =>
  new CaixaCliente(
    new ConfigService({ CAIXA_API_URL: urlCaixaSimulada() }),
    ajustes,
  );

describe('CaixaCliente', () => {
  beforeAll(() => iniciarCaixaSimulada());
  afterAll(() => encerrarCaixaSimulada());
  afterEach(() => limparCaixaSimulada());

  it('consulta o último concurso enviando o User-Agent combinado', async () => {
    // Arrange
    const chamadas = simularCaixa({ ultimo: 3070 });

    // Act
    const json = await criarCliente().ultimo('megasena');

    // Assert
    expect(chamadas).toEqual(['/megasena/']);
    expect(cabecalhosDaUltimaChamada()['user-agent']).toBe(
      'Mozilla/5.0 (Sorteios)',
    );
    expect(json).toMatchObject({ numero: 3070 });
  });

  it('consulta um concurso específico pelo número', async () => {
    // Arrange
    const chamadas = simularCaixa({ ultimo: 3070 });

    // Act
    const json = await criarCliente().concurso('megasena', 3000);

    // Assert
    expect(chamadas).toEqual(['/megasena/3000']);
    expect(json).toMatchObject({ numero: 3000 });
  });

  it('tenta de novo após uma falha e devolve a segunda resposta', async () => {
    // Arrange
    const chamadas = simularCaixa({ ultimo: 3070, falhasIniciais: 1 });

    // Act
    const json = await criarCliente().ultimo('megasena');

    // Assert
    expect(chamadas).toHaveLength(2);
    expect(json).toMatchObject({ numero: 3070 });
  });

  it('esgotadas as tentativas, o erro informa o status HTTP e o número de tentativas', async () => {
    // Arrange
    const chamadas = simularCaixa({ ultimo: 3070, status: 500 });

    // Act
    const erro = await criarCliente()
      .ultimo('megasena')
      .catch((falha: Error) => falha);

    // Assert
    expect(chamadas).toHaveLength(2);
    expect((erro as Error).message).toMatch(/HTTP 500/);
    expect((erro as Error).message).toMatch(/2 tentativa/);
  });

  it('o erro de timeout é descritivo', async () => {
    // Arrange
    simularCaixa({ ultimo: 3070, atrasoMs: 500 });

    // Act
    const erro = await criarCliente({ ...AJUSTES, timeoutMs: 100 })
      .ultimo('megasena')
      .catch((falha: Error) => falha);

    // Assert
    expect((erro as Error).message).toMatch(/tempo esgotado \(100 ms\)/);
  });

  it('sem CAIXA_API_URL usa a URL pública da Caixa', () => {
    // Arrange
    const cliente = new CaixaCliente(new ConfigService({}), AJUSTES);

    // Act
    const base = (cliente as unknown as { base(): string }).base();

    // Assert
    expect(base).toBe('https://servicebus3.caixa.gov.br/portaldeloterias/api');
  });
});
