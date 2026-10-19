// DTOs decorados (dependem de @nestjs/swagger): usados pela API.
export * from './lib/dto';
// Cliente fino e tipado (sem Nest/Angular). Para o app, prefira o ponto de entrada leve `./cliente`.
export * from './lib/cliente/cliente-api';
export type { components, paths, operations } from './lib/cliente/tipos-api';
