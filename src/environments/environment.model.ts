/**
 * La forma del entorno.
 *
 * Existe porque `fileReplacements` sustituye el archivo entero al compilar, y TypeScript solo
 * comprueba el que entra en la build: si el de producción pierde un campo o lo renombra, nadie se
 * entera hasta que la aplicación ya está desplegada. Tipando todos con esta interfaz, el
 * compilador lo caza.
 *
 * **El entorno se compila dentro del bundle** y cualquiera lo lee desde las herramientas del
 * navegador. Los datos de B2C no son secretos. La subscription key de APIM sí viaja en el bundle,
 * igual que en WitagFrontend: es el flujo de Witag tal cual (ver la wiki,
 * `decisiones/kibot-usa-el-login-de-witag`). Por eso no se escribe en git: la pone el build (ver
 * `apim-key.ts`).
 */
export interface Environment {
  readonly production: boolean;

  /**
   * Raíz de WiscanAPIs.
   *
   * En desarrollo es `/api` —una ruta relativa, del mismo origen— para que el proxy de `ng serve`
   * la redirija añadiendo las cabeceras. Desplegado es la API `WitagApi` de APIM.
   */
  readonly apiBaseUrl: string;

  /**
   * El login de B2C. `null` en desarrollo local: ahí la identidad la pone el proxy de `ng serve`
   * (`DEV_USER_ID`) y no hay login.
   */
  readonly auth: AuthConfig | null;

  /** `Ocp-Apim-Subscription-Key`. `null` cuando la pone un proxy o no hay APIM delante. */
  readonly apimSubscriptionKey: string | null;
}

/**
 * El app registration **de Witag** del entorno: KiBot no tiene uno propio. Con el mismo clientId el
 * idToken sale con la misma audience, y APIM y WigaCatalog lo aceptan sin cambiar nada.
 */
export interface AuthConfig {
  readonly clientId: string;
  /** `https://wigadirectory.b2clogin.com/wigadirectory.onmicrosoft.com/<user flow>` */
  readonly authority: string;
  readonly knownAuthorities: readonly string[];
}
