import { EnvironmentProviders, Provider, inject, makeEnvironmentProviders, provideAppInitializer } from '@angular/core';
import { BrowserCacheLocation, PublicClientApplication } from '@azure/msal-browser';
import { AuthConfig } from '../../../environments/environment.model';
import { API_CREDENTIALS } from '../http/api.config';
import { ALCANCES, CLAVE_APIM, MSAL } from './auth.tokens';
import { MsalCredentialsService } from './msal-credentials.service';

/**
 * El login de B2C para `app.config.ts`. Sustituye a `DevCredentialsService` cuando el entorno trae
 * `auth`.
 *
 * <p>El arranque espera a tener sesión: si no la hay, manda a B2C y la aplicación no llega a
 * pintarse.</p>
 */
export function proveerLogin(auth: AuthConfig, claveApim: string | null): EnvironmentProviders {
  const proveedores: Provider[] = [
    { provide: MSAL, useFactory: () => crearMsal(auth) },
    { provide: CLAVE_APIM, useValue: claveApim },
    { provide: API_CREDENTIALS, useClass: MsalCredentialsService }
  ];
  return makeEnvironmentProviders([proveedores, provideAppInitializer(() => iniciarSesion(inject(MSAL)))]);
}

/**
 * Adonde vuelve B2C: el `index.html` de la carpeta del `<base href>`.
 *
 * <p>En local la base es `/` y queda `http://localhost:8101`, como antes. Desplegado por InfraHub,
 * KiBot vive en la carpeta `kibot/` del sitio estático del tenant y queda
 * `https://<sitio>/kibot/index.html`. Con `index.html` y no `kibot/` a secas: la raíz es de
 * WitagFrontend, y su service worker (alcance `/`) contesta con su propio `index.html` a toda
 * navegación sin extensión, así que en un navegador que ya abrió WitagFrontend la vuelta a
 * `/kibot/` acabaría en WitagFrontend. Esa URL exacta es la que InfraHub registra como redirect SPA
 * en el app de B2C.</p>
 */
export function urlDeVuelta(base: string = document.baseURI): string {
  const url = new URL('index.html', base);
  return url.pathname === '/index.html' ? url.origin : url.origin + url.pathname;
}

export function crearMsal(auth: AuthConfig): PublicClientApplication {
  return new PublicClientApplication({
    auth: {
      clientId: auth.clientId,
      authority: auth.authority,
      knownAuthorities: [...auth.knownAuthorities],
      redirectUri: urlDeVuelta(),
      postLogoutRedirectUri: urlDeVuelta()
    },
    // Como WitagFrontend: la sesión sobrevive a cerrar la pestaña.
    cache: { cacheLocation: BrowserCacheLocation.LocalStorage }
  });
}

/**
 * Lo mismo que hace WitagFrontend en `main.ts`: recoger la vuelta de B2C y fijar la cuenta activa.
 * Sin cuenta, `loginRedirect` y una promesa que no termina, para que no se pinte nada mientras el
 * navegador se va.
 */
export async function iniciarSesion(msal: PublicClientApplication): Promise<void> {
  await msal.initialize();
  const vuelta = await msal.handleRedirectPromise();
  const cuenta = vuelta?.account ?? msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;
  if (cuenta) {
    msal.setActiveAccount(cuenta);
    return;
  }
  await msal.loginRedirect({ scopes: ALCANCES });
  return new Promise<void>(() => undefined);
}
