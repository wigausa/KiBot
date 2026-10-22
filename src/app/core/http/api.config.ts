import { HttpRequest } from '@angular/common/http';
import { InjectionToken } from '@angular/core';

/**
 * De dónde salen las credenciales que el interceptor pone en cada petición a la API.
 *
 * <p>Existe para que el interceptor **no sepa cómo autenticamos**. Hoy hay una implementación de
 * desarrollo; cuando WiDex tenga su registro en B2C habrá otra con MSAL, y cambiar de una a otra es
 * cambiar una línea de providers en `app.config.ts`. Ningún servicio, store ni pantalla se entera.</p>
 */
export interface ApiCredentials {
  /**
   * Cabeceras de autenticación para esta petición.
   *
   * <p><b>Asíncrono a propósito.</b> Hoy resuelve de inmediato y el `async` sobra; con MSAL hará
   * `acquireTokenSilent`, que sí espera. Naciendo síncrono, ese día habría que reescribir el
   * interceptor entero —y es la pieza que más caro sale romper—.</p>
   */
  authHeaders(req: HttpRequest<unknown>): Promise<Record<string, string>>;

  /**
   * El servidor rechazó la identidad. Hoy no hay sesión que cerrar; con MSAL, `logoutRedirect`.
   *
   * <p>Está aquí y no dentro del interceptor para que el interceptor no tenga que conocer a MSAL.</p>
   */
  onUnauthorized(status: number): void;
}

export const API_CREDENTIALS = new InjectionToken<ApiCredentials>('API_CREDENTIALS');

/**
 * La raíz de WiscanAPIs.
 *
 * <p>Va como token y no leyendo `environment` desde cada servicio para que el entorno se importe en
 * <b>un solo archivo</b> —`app.config.ts`—. Con eso los tests no necesitan sustituir un módulo: dan
 * otro valor al token y ya.</p>
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
