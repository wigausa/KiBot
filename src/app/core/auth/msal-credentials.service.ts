import { Injectable, inject } from '@angular/core';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { ApiCredentials } from '../http/api.config';
import { ALCANCES, CLAVE_APIM, MSAL } from './auth.tokens';

/**
 * Las credenciales con login: el flujo de WitagFrontend tal cual.
 *
 * <p>Manda el <b>idToken</b> de B2C como `Authorization: Bearer` y la subscription key de APIM. APIM
 * valida el token, enruta al backend del tenant y pone la cabecera `id` con el `oid`: KiBot nunca la
 * pone.</p>
 *
 * <p>La única diferencia con WitagFrontend es que el token se pide con `acquireTokenSilent`, que lo
 * renueva si caducó, en vez de leer el de la cuenta tal cual. Sigue siendo el mismo idToken.</p>
 */
@Injectable()
export class MsalCredentialsService implements ApiCredentials {
  private readonly msal = inject(MSAL);
  private readonly claveApim = inject(CLAVE_APIM);
  private saliendo = false;

  async authHeaders(): Promise<Record<string, string>> {
    const cuenta = this.msal.getActiveAccount();
    if (!cuenta) {
      await this.msal.loginRedirect({ scopes: ALCANCES });
      throw new Error('No hay sesión: redirigiendo al login.');
    }

    let idToken: string;
    try {
      ({ idToken } = await this.msal.acquireTokenSilent({ scopes: ALCANCES, account: cuenta }));
    } catch (error) {
      // La sesión de B2C caducó o hay que volver a consentir: solo se arregla pasando por B2C.
      if (error instanceof InteractionRequiredAuthError) {
        await this.msal.loginRedirect({ scopes: ALCANCES, account: cuenta });
      }
      throw error;
    }

    const cabeceras: Record<string, string> = { Authorization: `Bearer ${idToken}` };
    if (this.claveApim) cabeceras['Ocp-Apim-Subscription-Key'] = this.claveApim;
    return cabeceras;
  }

  /**
   * Solo un <b>401</b> cierra la sesión: el token no vale o el usuario no está en
   * `usuario_generico`. Un 403 es que le falta un permiso, y echarlo no lo arregla.
   *
   * <p>Es `logoutRedirect` y no `loginRedirect`, como en WitagFrontend: con la sesión de B2C viva,
   * un login silencioso devolvería el mismo token y el mismo 401, en bucle.</p>
   */
  onUnauthorized(status: number): void {
    if (status !== 401 || this.saliendo) return;
    this.saliendo = true;
    void this.msal.logoutRedirect({ account: this.msal.getActiveAccount() });
  }
}
