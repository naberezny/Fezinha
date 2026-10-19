import { MEGA_SENA, registrarMegaSena } from '@sorteios/loterias/mega-sena';
import { PrismaService } from '../prisma/prisma.service';
import {
  type BancoTemporario,
  criarBancoTemporario,
} from '../testes/banco-temporario';
import { criarConcurso } from '../testes/fabrica-concurso';
import { ConcursosRepositorio } from './concursos.repositorio';

describe('ConcursosRepositorio', () => {
  let banco: BancoTemporario;
  let prisma: PrismaService;
  let repositorio: ConcursosRepositorio;

  beforeAll(async () => {
    registrarMegaSena();
    banco = await criarBancoTemporario();
    prisma = new PrismaService(banco.url);
    await prisma.onModuleInit();
    repositorio = new ConcursosRepositorio(prisma);
    await repositorio.garantirLoteria(MEGA_SENA);
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
    await banco.remover();
  });

  beforeEach(async () => {
    await prisma.concurso.deleteMany();
  });

  describe('migração e unicidade', () => {
    it('aplica a migration em banco vazio e cria todas as tabelas', async () => {
      // Arrange / Act
      const tabelas = await prisma.$queryRawUnsafe<{ name: string }[]>(
        "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
      );

      // Assert
      expect(tabelas.map((t) => t.name).sort()).toEqual(
        [
          'Concurso',
          'Dezena',
          'LocalGanhador',
          'Loteria',
          'Premiacao',
          'Sincronizacao',
        ].sort(),
      );
    });

    it('impede dois concursos com o mesmo (loteriaId, numero)', async () => {
      // Arrange
      const dados = {
        loteriaId: 'megasena',
        numero: 10,
        dataSorteio: '2026-01-01',
        acumulou: false,
        origem: 'manual',
        atualizadoEm: new Date().toISOString(),
      };
      await prisma.concurso.create({ data: dados });

      // Act / Assert
      await expect(prisma.concurso.create({ data: dados })).rejects.toThrow();
    });
  });

  describe('upsertConcurso', () => {
    it('insere um concurso novo com dezenas, premiações com descrição, locais e origem', async () => {
      // Arrange
      const concurso = criarConcurso(100, { dezenas: [5, 10, 15, 20, 25, 30] });

      // Act
      const resultado = await repositorio.upsertConcurso(
        'megasena',
        concurso,
        'planilha',
      );

      // Assert
      expect(resultado).toBe('novo');
      const linha = await prisma.concurso.findUniqueOrThrow({
        where: { loteriaId_numero: { loteriaId: 'megasena', numero: 100 } },
        include: {
          dezenas: { orderBy: { ordem: 'asc' } },
          premiacoes: { orderBy: { faixa: 'asc' } },
          locais: true,
        },
      });
      expect(linha.origem).toBe('planilha');
      expect(new Date(linha.atualizadoEm).toISOString()).toBe(
        linha.atualizadoEm,
      );
      expect(linha.dezenas.map((d) => d.dezena)).toEqual([
        5, 10, 15, 20, 25, 30,
      ]);
      expect(linha.premiacoes.map((p) => p.descricao)).toEqual([
        'Sena',
        'Quina',
        'Quadra',
      ]);
      expect(linha.locais).toHaveLength(1);
    });

    it('devolve "inalterado" ao repetir o mesmo concurso, sem tocar em atualizadoEm', async () => {
      // Arrange
      const concurso = criarConcurso(101);
      await repositorio.upsertConcurso('megasena', concurso, 'planilha');
      const antes = await prisma.concurso.findFirstOrThrow({
        where: { numero: 101 },
      });

      // Act
      const resultado = await repositorio.upsertConcurso(
        'megasena',
        concurso,
        'caixa',
      );

      // Assert
      expect(resultado).toBe('inalterado');
      const depois = await prisma.concurso.findFirstOrThrow({
        where: { numero: 101 },
      });
      expect(depois.atualizadoEm).toBe(antes.atualizadoEm);
      expect(depois.origem).toBe('planilha');
      expect(await prisma.concurso.count({ where: { numero: 101 } })).toBe(1);
    });

    it('devolve "atualizado" ao mudar uma dezena e regrava os filhos sem duplicar', async () => {
      // Arrange
      await repositorio.upsertConcurso(
        'megasena',
        criarConcurso(102),
        'planilha',
      );
      const alterado = criarConcurso(102, {
        dezenas: [1, 2, 3, 4, 5, 60],
        locaisGanhadores: [
          { uf: 'SP', descricao: 'SP', quantidade: 2 },
          {
            cidade: 'CANAL ELETRONICO',
            descricao: 'CANAL ELETRONICO',
            quantidade: 1,
          },
        ],
      });

      // Act
      const resultado = await repositorio.upsertConcurso(
        'megasena',
        alterado,
        'caixa',
      );

      // Assert
      expect(resultado).toBe('atualizado');
      const lido = await repositorio.obter('megasena', 102);
      expect(lido?.dezenas).toEqual([1, 2, 3, 4, 5, 60]);
      expect(lido?.locaisGanhadores).toEqual([
        { cidade: undefined, uf: 'SP', descricao: 'SP', quantidade: 2 },
        {
          cidade: 'CANAL ELETRONICO',
          uf: undefined,
          descricao: 'CANAL ELETRONICO',
          quantidade: 1,
        },
      ]);
      const concursoId = (
        await prisma.concurso.findFirstOrThrow({ where: { numero: 102 } })
      ).id;
      expect(await prisma.dezena.count({ where: { concursoId } })).toBe(6);
      expect(await prisma.premiacao.count({ where: { concursoId } })).toBe(3);
      expect(
        (await prisma.concurso.findFirstOrThrow({ where: { numero: 102 } }))
          .origem,
      ).toBe('caixa');
    });

    it('detecta mudança só em valor monetário (BigInt)', async () => {
      // Arrange
      await repositorio.upsertConcurso(
        'megasena',
        criarConcurso(103),
        'planilha',
      );

      // Act
      const resultado = await repositorio.upsertConcurso(
        'megasena',
        criarConcurso(103, { arrecadacaoCentavos: 999n }),
        'caixa',
      );

      // Assert
      expect(resultado).toBe('atualizado');
      expect(
        (await repositorio.obter('megasena', 103))?.arrecadacaoCentavos,
      ).toBe(999n);
    });

    it('preserva valores acima de 2^31 em centavos (BigInt)', async () => {
      // Arrange
      const grande = 15_269_598_822n;
      await repositorio.upsertConcurso(
        'megasena',
        criarConcurso(104, { valorAcumuladoCentavos: grande }),
        'planilha',
      );

      // Act
      const lido = await repositorio.obter('megasena', 104);

      // Assert
      expect(lido?.valorAcumuladoCentavos).toBe(grande);
    });
  });

  describe('leituras', () => {
    beforeEach(async () => {
      for (let numero = 1; numero <= 25; numero++) {
        await repositorio.upsertConcurso(
          'megasena',
          criarConcurso(numero, { dezenas: [1, 2, 3, 4, 5, numero + 5] }),
          'planilha',
        );
      }
    });

    it('listar devolve em ordem decrescente e informa o total', async () => {
      // Act
      const { itens, total } = await repositorio.listar('megasena', {
        limite: 8,
        pagina: 1,
      });

      // Assert
      expect(total).toBe(25);
      expect(itens.map((c) => c.numero)).toEqual([
        25, 24, 23, 22, 21, 20, 19, 18,
      ]);
    });

    it('listar pagina: segunda página continua de onde a primeira parou', async () => {
      // Act
      const pagina2 = await repositorio.listar('megasena', {
        limite: 10,
        pagina: 2,
      });
      const pagina3 = await repositorio.listar('megasena', {
        limite: 10,
        pagina: 3,
      });

      // Assert
      expect(pagina2.itens.map((c) => c.numero)).toEqual([
        15, 14, 13, 12, 11, 10, 9, 8, 7, 6,
      ]);
      expect(pagina3.itens.map((c) => c.numero)).toEqual([5, 4, 3, 2, 1]);
    });

    it('listar fora do intervalo devolve lista vazia com o total', async () => {
      // Act
      const { itens, total } = await repositorio.listar('megasena', {
        limite: 10,
        pagina: 99,
      });

      // Assert
      expect(itens).toEqual([]);
      expect(total).toBe(25);
    });

    it('obter devolve o concurso ou null', async () => {
      // Act / Assert
      expect((await repositorio.obter('megasena', 7))?.numero).toBe(7);
      expect(await repositorio.obter('megasena', 999)).toBeNull();
      expect(await repositorio.obter('outra', 7)).toBeNull();
    });

    it('historico devolve todos em ordem crescente', async () => {
      // Act
      const historico = await repositorio.historico('megasena');

      // Assert
      expect(historico).toHaveLength(25);
      expect(historico[0].numero).toBe(1);
      expect(historico[24].numero).toBe(25);
    });

    it('ultimoNumero devolve o maior número, ou null sem concursos', async () => {
      // Act / Assert
      expect(await repositorio.ultimoNumero('megasena')).toBe(25);
      expect(await repositorio.ultimoNumero('outra')).toBeNull();
    });
  });

  describe('garantirLoteria', () => {
    it('é idempotente', async () => {
      // Act
      await repositorio.garantirLoteria(MEGA_SENA);
      await repositorio.garantirLoteria(MEGA_SENA);

      // Assert
      expect(await prisma.loteria.count({ where: { id: 'megasena' } })).toBe(1);
    });
  });
});
