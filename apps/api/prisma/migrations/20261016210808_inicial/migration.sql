-- CreateTable
CREATE TABLE "Loteria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Concurso" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "loteriaId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "dataSorteio" TEXT NOT NULL,
    "acumulou" BOOLEAN NOT NULL,
    "valorAcumuladoCentavos" BIGINT NOT NULL DEFAULT 0,
    "estimativaProximoCentavos" BIGINT NOT NULL DEFAULT 0,
    "arrecadacaoCentavos" BIGINT NOT NULL DEFAULT 0,
    "acumuladoEspecialCentavos" BIGINT NOT NULL DEFAULT 0,
    "proximoNumero" INTEGER,
    "dataProximoSorteio" TEXT,
    "observacao" TEXT,
    "origem" TEXT NOT NULL,
    "atualizadoEm" TEXT NOT NULL,
    CONSTRAINT "Concurso_loteriaId_fkey" FOREIGN KEY ("loteriaId") REFERENCES "Loteria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dezena" (
    "concursoId" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    "dezena" INTEGER NOT NULL,

    PRIMARY KEY ("concursoId", "ordem"),
    CONSTRAINT "Dezena_concursoId_fkey" FOREIGN KEY ("concursoId") REFERENCES "Concurso" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Premiacao" (
    "concursoId" INTEGER NOT NULL,
    "faixa" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "ganhadores" INTEGER NOT NULL,
    "rateioCentavos" BIGINT NOT NULL,

    PRIMARY KEY ("concursoId", "faixa"),
    CONSTRAINT "Premiacao_concursoId_fkey" FOREIGN KEY ("concursoId") REFERENCES "Concurso" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LocalGanhador" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "concursoId" INTEGER NOT NULL,
    "cidade" TEXT,
    "uf" TEXT,
    "descricao" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "LocalGanhador_concursoId_fkey" FOREIGN KEY ("concursoId") REFERENCES "Concurso" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sincronizacao" (
    "loteriaId" TEXT NOT NULL PRIMARY KEY,
    "ultimaEm" TEXT,
    "ultimoConcurso" INTEGER,
    "proximoSorteioEm" TEXT,
    "ultimoErro" TEXT,
    "emAndamento" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Sincronizacao_loteriaId_fkey" FOREIGN KEY ("loteriaId") REFERENCES "Loteria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Concurso_loteriaId_dataSorteio_idx" ON "Concurso"("loteriaId", "dataSorteio");

-- CreateIndex
CREATE UNIQUE INDEX "Concurso_loteriaId_numero_key" ON "Concurso"("loteriaId", "numero");

-- CreateIndex
CREATE INDEX "Dezena_dezena_idx" ON "Dezena"("dezena");

-- CreateIndex
CREATE INDEX "LocalGanhador_concursoId_idx" ON "LocalGanhador"("concursoId");
