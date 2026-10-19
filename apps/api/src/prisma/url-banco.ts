/**
 * URL padrão do banco de desenvolvimento: o PostgreSQL do `docker-compose.yml` da raiz
 * (`docker compose up -d postgres`). Em outros ambientes, defina `DATABASE_URL`.
 */
export const URL_BANCO_PADRAO =
  'postgresql://sorteios:sorteios@localhost:5432/sorteios';
