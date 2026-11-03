import { Environment } from './environment.model';
import { environment as test } from './environment.test';

/**
 * El login de pruebas desde `ng serve` en el 8101: B2C de verdad, APIM de pruebas detrás de
 * `proxy.test.conf.js`.
 *
 * <p>El proxy pone la subscription key desde `KIBOT_APIM_KEY`, así que aquí no hay clave, y como
 * la llamada es del mismo origen no hace falta el CORS de APIM.</p>
 */
export const environment: Environment = {
  ...test,
  production: false,
  apiBaseUrl: '/apim/WitagApi',
  apimSubscriptionKey: null
};
