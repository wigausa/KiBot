import { CLAVE_DE_APIM } from './apim-key';
import { CLIENT_ID_DEL_BUILD } from './client-id';
import { Environment } from './environment.model';

/** Producción. Entra por `fileReplacements`; ver `angular.json`. */
export const environment: Environment = {
  production: true,

  // APIM. Es quien inyecta la cabecera `id` del usuario a partir del token, así que KiBot
  // nunca habla con la Function directamente.
  apiBaseUrl: 'https://wigaapimanagement.azure-api.net/WitagApi',

  // El app registration `Witag_<Cliente>` del tenant al que se despliega: lo pone InfraHub en el
  // build (ver `client-id.ts`). Vacío, MSAL falla al arrancar, que es lo que se quiere antes que
  // entrar sin login.
  auth: {
    clientId: CLIENT_ID_DEL_BUILD,
    authority: 'https://wigadirectory.b2clogin.com/wigadirectory.onmicrosoft.com/B2C_1_login',
    knownAuthorities: ['wigadirectory.b2clogin.com']
  },
  apimSubscriptionKey: CLAVE_DE_APIM
};
