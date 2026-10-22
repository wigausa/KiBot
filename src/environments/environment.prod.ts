import { Environment } from './environment.model';

/** Producción. Entra por `fileReplacements`; ver `angular.json`. */
export const environment: Environment = {
  production: true,

  // APIM. Es quien inyecta la cabecera `id` del usuario a partir del token, así que WiDex
  // nunca habla con la Function directamente.
  apiBaseUrl: 'https://wigaapimanagement.azure-api.net/WitagApi'
};
