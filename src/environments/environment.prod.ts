import { CLAVE_DE_APIM } from './apim-key';
import { Environment } from './environment.model';

/** Producción. Entra por `fileReplacements`; ver `angular.json`. */
export const environment: Environment = {
  production: true,

  // APIM. Es quien inyecta la cabecera `id` del usuario a partir del token, así que KiBot
  // nunca habla con la Function directamente.
  apiBaseUrl: 'https://wigaapimanagement.azure-api.net/WitagApi',

  // PENDIENTE: el app registration `Witag_<Cliente>` del cliente al que se despliegue. Con el
  // clientId vacío MSAL falla al arrancar, que es lo que se quiere antes que entrar sin login.
  auth: {
    clientId: '',
    authority: 'https://wigadirectory.b2clogin.com/wigadirectory.onmicrosoft.com/B2C_1_login',
    knownAuthorities: ['wigadirectory.b2clogin.com']
  },
  apimSubscriptionKey: CLAVE_DE_APIM
};
