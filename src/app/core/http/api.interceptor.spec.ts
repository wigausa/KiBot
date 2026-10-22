import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL, API_CREDENTIALS, ApiCredentials } from './api.config';
import { apiInterceptor } from './api.interceptor';

const BASE = 'https://api.pruebas/WitagApi';

/**
 * El interceptor: credenciales, errores encubiertos y rechazos de identidad.
 *
 * <p>Es la única pieza de la capa de red con lógica de verdad, y la que NO debe cambiar cuando
 * entre MSAL. Si estos tests siguen en verde después de cambiar el proveedor de credenciales, el
 * cambio no rompió nada.</p>
 */
describe('apiInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let rechazos: number[];

  /**
   * Las credenciales son ASÍNCRONAS, así que la petición no sale en el mismo tick: hay que vaciar
   * la cola de microtareas antes de buscarla en el backend de pruebas. Sin esto, `expectOne` no
   * encuentra nada y el test falla por una razón que no tiene que ver con lo que prueba.
   */
  const peticionPendiente = async (url: string) => {
    await Promise.resolve();
    await Promise.resolve();
    return backend.expectOne(url);
  };

  beforeEach(() => {
    rechazos = [];

    const credenciales: ApiCredentials = {
      authHeaders: async () => ({ Authorization: 'Bearer de-prueba' }),
      onUnauthorized: (status) => rechazos.push(status)
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: BASE },
        { provide: API_CREDENTIALS, useValue: credenciales }
      ]
    });

    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('pone la credencial en lo que va a la API', async () => {
    http.get(`${BASE}/warehouseMap/company/2`).subscribe();

    const peticion = await peticionPendiente(`${BASE}/warehouseMap/company/2`);

    expect(peticion.request.headers.get('Authorization')).toBe('Bearer de-prueba');
    peticion.flush([]);
  });

  it('no toca lo que no va a la API', async () => {
    // Las fuentes y las imágenes de marca las sirve la propia app y no llevan credencial.
    http.get('/assets/brand/witag-logo.svg', { responseType: 'text' }).subscribe();

    const peticion = await peticionPendiente('/assets/brand/witag-logo.svg');

    expect(peticion.request.headers.has('Authorization')).toBeFalse();
    peticion.flush('<svg></svg>');
  });

  it('convierte en fallo un 200 que en realidad trae un error', async () => {
    // Hay endpoints de WiscanAPIs que contestan 200 con { Error }. Sin esto, la pantalla lo daría
    // por bueno y se quedaría en blanco sin decir por qué.
    let fallo: HttpErrorResponse | null = null;
    http.post(`${BASE}/warehouseMap/plan`, {}).subscribe({
      error: (e: HttpErrorResponse) => (fallo = e)
    });

    (await peticionPendiente(`${BASE}/warehouseMap/plan`)).flush({ Error: 'No existe el inventario.' });
    await Promise.resolve();

    expect(fallo).not.toBeNull();
    expect(fallo!.error.Error).toBe('No existe el inventario.');
  });

  it('un plano inválido NO es un fallo: es el contenido de la pantalla', async () => {
    // `Errors` en plural es la lista de lo que hay que arreglar en el plano, y llega con un 200
    // legítimo. Confundirlo con `Error` haría que un número mal puesto pareciera una caída del
    // servidor.
    let respuesta: unknown = null;
    let fallo: unknown = null;

    http.post(`${BASE}/warehouseMap/plan/preview`, {}).subscribe({
      next: (r) => (respuesta = r),
      error: (e: unknown) => (fallo = e)
    });

    (await peticionPendiente(`${BASE}/warehouseMap/plan/preview`)).flush({
      Valid: false,
      Errors: ['anchoBloque es 0.3 m y el mínimo es 0.6 m.'],
      Warnings: []
    });
    await Promise.resolve();

    expect(fallo).toBeNull();
    expect((respuesta as { Valid: boolean }).Valid).toBeFalse();
  });

  it('avisa al proveedor de credenciales cuando rechazan la identidad', async () => {
    http.get(`${BASE}/warehouseMap/company/2`).subscribe({ error: () => undefined });

    (await peticionPendiente(`${BASE}/warehouseMap/company/2`)).flush(
      { Error: 'No autorizado' },
      { status: 401, statusText: 'Unauthorized' }
    );
    await Promise.resolve();

    expect(rechazos).toEqual([401]);
  });

  it('un 403 también se le cuenta: es identidad válida sin permiso', async () => {
    http.post(`${BASE}/warehouseMap/plan`, {}).subscribe({ error: () => undefined });

    (await peticionPendiente(`${BASE}/warehouseMap/plan`)).flush(
      { Error: 'No tiene permiso para crear mapas en la compañía 2.' },
      { status: 403, statusText: 'Forbidden' }
    );
    await Promise.resolve();

    expect(rechazos).toEqual([403]);
  });
});
