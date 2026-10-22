import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, map, switchMap, throwError, timeout } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { API_BASE_URL, API_CREDENTIALS } from './api.config';
import { errorEncubierto } from './api-error';

/**
 * Lo que se espera antes de dar una petición por perdida.
 *
 * <p>No hay reintento, y es a propósito: casi todo lo que WiDex manda a esta API <b>escribe</b>
 * —abrir un recorrido, guardar un plano—. Reintentar un POST que quizá sí llegó crearía dos. Un
 * fallo se cuenta y lo repite quien decida repetirlo.</p>
 */
export const TIEMPO_LIMITE_MS = 25_000;

/**
 * Todo lo que WiDex le pide a la API pasa por aquí: credenciales, errores encubiertos y rechazos de
 * identidad.
 *
 * <p>Es la única pieza de la capa de red con lógica de verdad, y <b>no cambia cuando entre
 * MSAL</b>: las credenciales se las pide a <c>API_CREDENTIALS</c> en vez de saber de dónde salen.</p>
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const baseUrl = inject(API_BASE_URL);
  const credenciales = inject(API_CREDENTIALS);

  // Los recursos propios —fuentes, imágenes de marca, lo que sirva la app— no llevan credencial.
  if (!req.url.startsWith(baseUrl)) return next(req);

  return from(credenciales.authHeaders(req)).pipe(
    switchMap((headers) => next(req.clone({ setHeaders: headers }))),
    timeout(TIEMPO_LIMITE_MS),
    map((evento) => {
      // Un 200 que en realidad es un fallo. Se convierte aquí, UNA vez, y no en cada llamada:
      // olvidarlo en una sola se traga el error en silencio y la pantalla queda en blanco sin
      // decir por qué.
      if (evento instanceof HttpResponse) {
        const mensaje = errorEncubierto(evento.body);
        if (mensaje !== null) {
          throw new HttpErrorResponse({
            status: evento.status,
            statusText: evento.statusText,
            url: evento.url ?? undefined,
            error: { Error: mensaje }
          });
        }
      }
      return evento;
    }),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
        credenciales.onUnauthorized(error.status);
      }
      return throwError(() => error);
    })
  );
};
