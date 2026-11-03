import { HttpRequest } from '@angular/common/http';
import { InjectionToken } from '@angular/core';

/**
 * De dónde salen las credenciales que el interceptor pone en cada petición a la API.
 *
 * <p>Existe para que el interceptor **no sepa cómo autenticamos**. Hay dos: la de desarrollo, sin
 * login (`DevCredentialsService`), y la de B2C con MSAL (`MsalCredentialsService`). Cuál entra lo
 * decide el entorno en `app.config.ts`. Ningún servicio, store ni pantalla se entera.</p>
 */
export interface ApiCredentials {
  /**
   * Cabeceras de autenticación para esta petición.
   *
   * <p><b>Asíncrono a propósito:</b> con MSAL hace `acquireTokenSilent`, que espera.</p>
   */
  authHeaders(req: HttpRequest<unknown>): Promise<Record<string, string>>;

  /**
   * El servidor rechazó la identidad (401) o el permiso (403). Cada implementación decide qué
   * cierra la sesión: con MSAL, solo el 401.
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
