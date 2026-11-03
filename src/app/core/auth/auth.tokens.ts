import { InjectionToken } from '@angular/core';
import { PublicClientApplication } from '@azure/msal-browser';

/** La instancia de MSAL. Solo existe con login; en desarrollo local no se provee. */
export const MSAL = new InjectionToken<PublicClientApplication>('MSAL');

/** La subscription key de APIM, o `null` si la pone un proxy. */
export const CLAVE_APIM = new InjectionToken<string | null>('CLAVE_APIM');

/**
 * Lo que se pide a B2C. Son los mismos de WitagFrontend (`loginRequest`): solo OIDC, porque lo que
 * viaja a APIM es el **idToken**, no un access token.
 */
export const ALCANCES = ['openid', 'profile'];
