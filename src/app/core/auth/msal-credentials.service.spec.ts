import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InteractionRequiredAuthError, PublicClientApplication } from '@azure/msal-browser';
import { CLAVE_APIM, MSAL } from './auth.tokens';
import { MsalCredentialsService } from './msal-credentials.service';

describe('MsalCredentialsService', () => {
  const cuenta = { homeAccountId: 'h', username: 'ana@x.com', name: 'Ana' };
  let msal: jasmine.SpyObj<PublicClientApplication>;

  function crear(clave: string | null = 'clave-de-prueba'): MsalCredentialsService {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        MsalCredentialsService,
        { provide: MSAL, useValue: msal },
        { provide: CLAVE_APIM, useValue: clave }
      ]
    });
    return TestBed.inject(MsalCredentialsService);
  }

  beforeEach(() => {
    msal = jasmine.createSpyObj<PublicClientApplication>('msal', [
      'getActiveAccount',
      'acquireTokenSilent',
      'loginRedirect',
      'logoutRedirect'
    ]);
    msal.getActiveAccount.and.returnValue(cuenta as never);
    msal.acquireTokenSilent.and.resolveTo({ idToken: 'id-token-renovado' } as never);
    msal.loginRedirect.and.resolveTo();
    msal.logoutRedirect.and.resolveTo();
  });

  it('manda el idToken como Bearer y la subscription key de APIM', async () => {
    const cabeceras = await crear().authHeaders();

    expect(cabeceras).toEqual({
      Authorization: 'Bearer id-token-renovado',
      'Ocp-Apim-Subscription-Key': 'clave-de-prueba'
    });
    expect(msal.acquireTokenSilent).toHaveBeenCalledWith(
      jasmine.objectContaining({ scopes: ['openid', 'profile'], account: cuenta as never })
    );
  });

  it('sin clave (la pone el proxy) solo manda el Bearer', async () => {
    expect(await crear(null).authHeaders()).toEqual({ Authorization: 'Bearer id-token-renovado' });
  });

  it('sin cuenta activa manda al login y no deja salir la petición', async () => {
    msal.getActiveAccount.and.returnValue(null);

    await expectAsync(crear().authHeaders()).toBeRejected();
    expect(msal.loginRedirect).toHaveBeenCalled();
  });

  it('si B2C pide interacción, vuelve a pasar por el login', async () => {
    msal.acquireTokenSilent.and.rejectWith(new InteractionRequiredAuthError('login_required'));

    await expectAsync(crear().authHeaders()).toBeRejected();
    expect(msal.loginRedirect).toHaveBeenCalled();
  });

  it('un 401 cierra la sesión una sola vez', () => {
    const credenciales = crear();

    credenciales.onUnauthorized(401);
    credenciales.onUnauthorized(401);

    expect(msal.logoutRedirect).toHaveBeenCalledTimes(1);
  });

  it('un 403 no echa al usuario: le falta un permiso, no la sesión', () => {
    crear().onUnauthorized(403);

    expect(msal.logoutRedirect).not.toHaveBeenCalled();
  });
});
