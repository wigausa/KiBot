/**
 * Proxy del dev server de WiDex.
 *
 * Sustituye a tres cosas que en Azure existen y en local no:
 *
 *  1. CORS. El navegador llama a /api sobre su propio origen y el dev server
 *     reenvia. El contenedor de Functions no contesta el preflight OPTIONS.
 *
 *  2. La clave de funcion. El host en contenedor SI exige
 *     AuthorizationLevel.Function; "func start" se la salta. En Azure la pone APIM.
 *
 *  3. La cabecera "id". Es APIM quien lee el token, saca el identificador del
 *     usuario y lo reenvia como "id", que es lo que el AuthenticationMiddleware
 *     resuelve contra SQL. Sin ella TODAS las rutas responden 401, incluida la
 *     previsualizacion del plano.
 *
 * ---------------------------------------------------------------------------
 * POR QUE AQUI Y NO EN EL CODIGO
 *
 * Esto corre en el servidor de desarrollo: nunca entra en el bundle. Una
 * credencial compilada en un frontend la lee cualquiera desde las herramientas
 * del navegador, y lo que abriria aqui es POST /warehouseMap/plan, que crea y
 * sobrescribe mapas de almacen.
 *
 * Efecto secundario deseable: esto solo existe bajo "ng serve". El dia que
 * alguien intente desplegar WiDex antes de que MSAL este, no va a funcionar.
 *
 * ---------------------------------------------------------------------------
 * EL id VA EN MINUSCULAS, y no da igual
 *
 *  - SQL lo guarda en una columna uniqueidentifier y compara sin distinguir
 *    mayusculas: por ahi entra de cualquier forma.
 *  - WigaAuthz (permisos de recurso) lo compara como TEXTO y lo tiene guardado
 *    en minusculas.
 *
 * En mayusculas la peticion responde 200 con lista VACIA: ni error ni 401,
 * simplemente no aparece nada. Es el fallo mas dificil de ver de todos.
 *
 * SOLO PARA DESARROLLO LOCAL.
 * ---------------------------------------------------------------------------
 */

const target = process.env.API_TARGET || 'http://localhost:7021';
const functionsKey = process.env.FUNCTIONS_KEY || '';
const devUserId = (process.env.DEV_USER_ID || '').toLowerCase();

const headers = {};
if (functionsKey) headers['x-functions-key'] = functionsKey;
if (devUserId) headers['id'] = devUserId;

if (!devUserId) {
  console.warn('[proxy] DEV_USER_ID vacio: el backend respondera 401 a todo, incluido el preview.');
} else {
  console.log('[proxy] id fijo -> ' + devUserId + '   destino ' + target);
}

// Cuando WiDex tenga MSAL, aqui ira el hook que saca el id del token real y pisa
// al estatico, como hace WitagFrontend. Hoy no hay token del que sacarlo.
module.exports = {
  '/api': {
    target,
    secure: false,
    changeOrigin: true,
    headers
  }
};
