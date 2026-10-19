# contratos

DTOs da API (classes decoradas com `@nestjs/swagger`) e cliente HTTP tipado.

- `src/lib/dto/*.ts`: fonte do contrato. Valores monetários em centavos (`number`).
- `openapi.json` e `src/lib/cliente/tipos-api.ts`: **gerados** por `pnpm gerar:cliente` (não editar à mão).
- `src/lib/cliente/cliente-api.ts`: `criarClienteApi(baseUrl)` com `fetch` tipado; sem Angular nem Nest.
- `src/cliente.ts`: ponto de entrada leve (só cliente + tipos), para o app não carregar `@nestjs/swagger`.
  O `index.ts` também exporta os DTOs decorados e serve à API.

## Testes

`nx test contratos`. `verificacao-contrato.spec.ts` quebra a compilação se algum DTO divergir do OpenAPI gerado.
