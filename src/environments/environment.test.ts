import { CLAVE_DE_APIM } from './apim-key';
import { Environment } from './environment.model';

/**
 * Pruebas, desplegado. Mismo B2C, user flow y APIM que la build de test de WitagFrontend
 * (`auth-staging.ts` y `environment.staging.ts`).
 */
export const environment: Environment = {
  production: true,
  apiBaseUrl: 'https://az-apim-brian-wiga-wigacatalog-test.azure-api.net/WitagApi',
  auth: {
    clientId: 'e9ae8818-d538-43e4-b7d7-3bf80357da77',
    authority: 'https://wigadirectory.b2clogin.com/wigadirectory.onmicrosoft.com/B2C_1_wiscanTesting',
    knownAuthorities: ['wigadirectory.b2clogin.com']
  },
  apimSubscriptionKey: CLAVE_DE_APIM
};
