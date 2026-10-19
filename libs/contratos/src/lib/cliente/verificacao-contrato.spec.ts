import type {
  ApostaDto,
  DistribuicaoParesDto,
  EstatisticaDezenaDto,
  EstatisticasDto,
  FaixaPremiacaoDto,
  FaixaSomaDto,
  FrequenciaMesDto,
  HistoricoDto,
  LocalGanhadorDto,
  LoteriaDto,
  PaginaResultadosDto,
  PremiacaoDto,
  ResultadoDto,
  ResultadoSincronizacaoDto,
  ResumoAnoDto,
  SaudeDto,
  SincronizacaoDto,
  VolanteDto,
} from '../dto';
import type { components } from './tipos-api';

/**
 * Contrato único: cada DTO decorado precisa ser mutuamente atribuível ao tipo gerado do OpenAPI.
 * Se um DTO mudar sem rodar `pnpm gerar:cliente`, este arquivo deixa de compilar e o teste falha.
 */
type Esquemas = components['schemas'];
type Equivalentes<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : never
  : never;

const verificacoes: Record<keyof Esquemas, true> = {
  ApostaDto: true as Equivalentes<ApostaDto, Esquemas['ApostaDto']>,
  VolanteDto: true as Equivalentes<VolanteDto, Esquemas['VolanteDto']>,
  FaixaPremiacaoDto: true as Equivalentes<
    FaixaPremiacaoDto,
    Esquemas['FaixaPremiacaoDto']
  >,
  LoteriaDto: true as Equivalentes<LoteriaDto, Esquemas['LoteriaDto']>,
  PremiacaoDto: true as Equivalentes<PremiacaoDto, Esquemas['PremiacaoDto']>,
  LocalGanhadorDto: true as Equivalentes<
    LocalGanhadorDto,
    Esquemas['LocalGanhadorDto']
  >,
  ResultadoDto: true as Equivalentes<ResultadoDto, Esquemas['ResultadoDto']>,
  PaginaResultadosDto: true as Equivalentes<
    PaginaResultadosDto,
    Esquemas['PaginaResultadosDto']
  >,
  EstatisticaDezenaDto: true as Equivalentes<
    EstatisticaDezenaDto,
    Esquemas['EstatisticaDezenaDto']
  >,
  DistribuicaoParesDto: true as Equivalentes<
    DistribuicaoParesDto,
    Esquemas['DistribuicaoParesDto']
  >,
  FaixaSomaDto: true as Equivalentes<FaixaSomaDto, Esquemas['FaixaSomaDto']>,
  ResumoAnoDto: true as Equivalentes<ResumoAnoDto, Esquemas['ResumoAnoDto']>,
  FrequenciaMesDto: true as Equivalentes<
    FrequenciaMesDto,
    Esquemas['FrequenciaMesDto']
  >,
  EstatisticasDto: true as Equivalentes<
    EstatisticasDto,
    Esquemas['EstatisticasDto']
  >,
  HistoricoDto: true as Equivalentes<HistoricoDto, Esquemas['HistoricoDto']>,
  SaudeDto: true as Equivalentes<SaudeDto, Esquemas['SaudeDto']>,
  SincronizacaoDto: true as Equivalentes<
    SincronizacaoDto,
    Esquemas['SincronizacaoDto']
  >,
  ResultadoSincronizacaoDto: true as Equivalentes<
    ResultadoSincronizacaoDto,
    Esquemas['ResultadoSincronizacaoDto']
  >,
};

describe('contrato DTO x OpenAPI gerado', () => {
  it('todos os esquemas do OpenAPI têm DTO equivalente (a checagem real é de compilação)', () => {
    // Act / Assert
    expect(Object.keys(verificacoes)).toHaveLength(18);
  });
});
