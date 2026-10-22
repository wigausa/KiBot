/**
 * La forma del entorno.
 *
 * Existe porque `fileReplacements` sustituye el archivo entero al compilar, y TypeScript solo
 * comprueba el que entra en la build: si el de producción pierde un campo o lo renombra, nadie se
 * entera hasta que la aplicación ya está desplegada. Tipando los dos con esta interfaz, el
 * compilador lo caza.
 *
 * **Aquí no van credenciales.** El entorno se compila dentro del bundle y cualquiera lo lee desde
 * las herramientas del navegador. Lo que haga falta para autenticar sale del proveedor de
 * credenciales (`API_CREDENTIALS`), y en desarrollo lo pone el proxy de `ng serve` del lado del
 * servidor.
 */
export interface Environment {
  readonly production: boolean;

  /**
   * Raíz de WiscanAPIs.
   *
   * En desarrollo es `/api` —una ruta relativa, del mismo origen— para que el proxy de `ng serve`
   * la redirija añadiendo las cabeceras. Eso mantiene el bundle sin credenciales y de paso evita
   * el problema de CORS contra el puerto de la Function.
   */
  readonly apiBaseUrl: string;
}
