// Ponto de entrada leve para o app: só o cliente HTTP e os tipos gerados, sem DTOs decorados nem @nestjs/swagger.
export * from './lib/cliente/cliente-api';
export type { components, paths, operations } from './lib/cliente/tipos-api';
