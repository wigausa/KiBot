import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { environment } from '../environments/environment';
import { API_BASE_URL, API_CREDENTIALS } from './core/http/api.config';
import { apiInterceptor } from './core/http/api.interceptor';
import { DevCredentialsService } from './core/http/dev-credentials.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // `withComponentInputBinding` alimenta los inputs de los componentes de
    // ruta desde `data` (lo usa ModulePlaceholder para su título e ícono).
    provideRouter(routes, withComponentInputBinding()),

    provideHttpClient(withFetch(), withInterceptors([apiInterceptor])),

    // Este es el ÚNICO archivo que importa `environment`. Todo lo demás pide el token, y así un
    // test da otro valor en vez de tener que sustituir un módulo.
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },

    // La costura. El día que KiBot tenga su registro en B2C, esta línea pasa a
    // `MsalCredentialsService` y no se toca ningún servicio, store ni pantalla.
    { provide: API_CREDENTIALS, useClass: DevCredentialsService }
  ]
};
