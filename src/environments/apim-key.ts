/**
 * La subscription key de APIM, puesta por el build: `ng build -c test --define "KIBOT_APIM_KEY='…'"`.
 *
 * <p>No se escribe en ningún archivo del repositorio. Viaja en el bundle —como en WitagFrontend—,
 * pero desde un secreto del pipeline, no desde git. Sin `--define` queda en `null`.</p>
 */
declare const KIBOT_APIM_KEY: string | undefined;

export const CLAVE_DE_APIM: string | null =
  typeof KIBOT_APIM_KEY === 'string' && KIBOT_APIM_KEY !== '' ? KIBOT_APIM_KEY : null;
