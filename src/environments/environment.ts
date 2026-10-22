import { Environment } from './environment.model';

/**
 * Desarrollo. Es el archivo BASE: `fileReplacements` lo sustituye por `environment.prod.ts` en la
 * configuración de producción.
 */
export const environment: Environment = {
  production: false,

  // Relativa a propósito: la sirve el proxy de `ng serve`, que es quien añade las cabeceras.
  // Ver `proxy.config.example.js`.
  apiBaseUrl: '/api'
};
