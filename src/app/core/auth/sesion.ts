import { Injectable, inject } from '@angular/core';
import { MSAL } from './auth.tokens';

/**
 * Quién está dentro, para pintarlo. Sin login (desarrollo local) no hay sesión y el shell no
 * enseña nada.
 */
@Injectable({ providedIn: 'root' })
export class Sesion {
  private readonly msal = inject(MSAL, { optional: true });

  /** El nombre del idToken (`name`) o, si no viene, el usuario. `null` sin login. */
  readonly usuario: string | null = (() => {
    const cuenta = this.msal?.getActiveAccount();
    return cuenta ? cuenta.name || cuenta.username : null;
  })();

  cerrar(): void {
    void this.msal?.logoutRedirect({ account: this.msal.getActiveAccount() });
  }
}
