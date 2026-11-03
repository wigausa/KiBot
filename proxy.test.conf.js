/**
 * Proxy de `npm run start:test`: KiBot en el 8101 con el login de B2C de verdad, contra el APIM de
 * pruebas.
 *
 * Hace dos cosas, las dos del lado del servidor de desarrollo:
 *
 *  1. Pone la subscription key de APIM desde KIBOT_APIM_KEY, para que no haya que compilarla.
 *  2. Evita el CORS: el navegador llama a /apim sobre su propio origen. Así se puede probar antes de
 *     que el responsable de APIM añada http://localhost:8101 a los orígenes permitidos.
 *
 * El Bearer (idToken) lo pone KiBot y pasa tal cual: APIM lo valida y pone el `id`.
 * Hace falta que http://localhost:8101 esté como redirect URI en el app registration de B2C.
 *
 * SOLO PARA DESARROLLO LOCAL.
 */

const target = process.env.APIM_TARGET || 'https://az-apim-brian-wiga-wigacatalog-test.azure-api.net';
const apimKey = process.env.KIBOT_APIM_KEY || '';

if (!apimKey) {
  console.warn('[proxy] KIBOT_APIM_KEY vacia: APIM respondera 401 por falta de subscription key.');
}

module.exports = {
  '/apim': {
    target,
    secure: true,
    changeOrigin: true,
    pathRewrite: { '^/apim': '' },
    headers: apimKey ? { 'Ocp-Apim-Subscription-Key': apimKey } : {}
  }
};
