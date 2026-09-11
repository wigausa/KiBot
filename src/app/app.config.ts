import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // `withComponentInputBinding` alimenta los inputs de los componentes de
    // ruta desde `data` (lo usa ModulePlaceholder para su título e ícono).
    provideRouter(routes, withComponentInputBinding())
  ]
};
