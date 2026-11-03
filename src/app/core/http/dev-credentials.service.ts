import { Injectable } from '@angular/core';
import { ApiCredentials } from './api.config';

/**
 * Las credenciales del desarrollo local, sin login (el entorno no trae `auth`).
 *
 * <p><b>No devuelve ninguna cabecera, y eso es lo correcto.</b> En local la identidad la pone el
 * proxy de `ng serve` del lado del servidor —ver `proxy.local.conf.js`—: la clave de función y el
 * `id` fijo de `DEV_USER_ID`. Con login, la credencial es <c>MsalCredentialsService</c>.</p>
 */
@Injectable()
export class DevCredentialsService implements ApiCredentials {
  async authHeaders(): Promise<Record<string, string>> {
    return {};
  }

  onUnauthorized(): void {
    // Sin login no hay sesión que cerrar.
  }
}
