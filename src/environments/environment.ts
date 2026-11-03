import { Environment } from './environment.model';

/**
 * Desarrollo. Es el archivo BASE: `fileReplacements` lo sustituye por el del entorno al compilar.
 */
export const environment: Environment = {
  production: false,

  // Relativa a propósito: la sirve el proxy de `ng serve`, que es quien añade las cabeceras.
  // Ver `proxy.local.conf.js`.
  apiBaseUrl: '/api',

  // Sin login: el proxy pone el `id` fijo de DEV_USER_ID.
  auth: null,
  apimSubscriptionKey: null
};
