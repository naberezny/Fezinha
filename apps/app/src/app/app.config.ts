import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideIonicAngular } from '@ionic/angular';
import { ambiente } from '../ambientes/ambiente';
import { appRoutes } from './app.routes';
import { HistoricoStore, JogosSalvosStore } from './dados/historico.store';
import { HistoricoStoreImpl } from './dados/historico.store.impl';
import { JogosSalvosStoreImpl } from './dados/jogos-salvos.store.impl';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideIonicAngular(),
    // Hospedagem estática sem reescrita de URL (build "artefato") usa rotas por hash.
    ambiente.rotasPorHash ? provideRouter(appRoutes, withHashLocation()) : provideRouter(appRoutes),
    provideHttpClient(withFetch()),
    { provide: HistoricoStore, useClass: HistoricoStoreImpl },
    { provide: JogosSalvosStore, useClass: JogosSalvosStoreImpl },
    // PWA / offline (especificação 6.5): só em produção; o app shell e /loterias/** ficam em cache (ngsw-config.json).
    provideServiceWorker('ngsw-worker.js', {
      enabled: ambiente.serviceWorker && !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
