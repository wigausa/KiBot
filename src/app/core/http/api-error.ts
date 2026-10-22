import { HttpErrorResponse } from '@angular/common/http';

/** Un fallo de la API, ya legible. */
export interface ApiFailure {
  readonly message: string;
  readonly details: readonly string[];
}

const GENERICO = 'No se pudo completar la operación.';

/**
 * Saca de un fallo el mensaje que el backend quiso dar.
 *
 * <p>WiscanAPIs contesta sus errores como <c>{ Error, Detalles }</c>, y ese texto está escrito para
 * que lo lea una persona: «la excepción entre 1 y 3 no corresponde a dos pasillos consecutivos» dice
 * qué arreglar, mientras que «Http failure response: 400 Bad Request» no dice nada.</p>
 */
export function apiFailure(error: unknown): ApiFailure {
  if (!(error instanceof HttpErrorResponse)) {
    return { message: error instanceof Error ? error.message : GENERICO, details: [] };
  }

  const cuerpo: unknown = error.error;

  if (typeof cuerpo === 'string' && cuerpo.trim() !== '') {
    return { message: cuerpo, details: [] };
  }

  if (cuerpo !== null && typeof cuerpo === 'object') {
    const registro = cuerpo as Record<string, unknown>;
    const mensaje = registro['Error'] ?? registro['message'];
    const detalles = registro['Detalles'];

    return {
      message: typeof mensaje === 'string' && mensaje.trim() !== '' ? mensaje : error.message,
      details: Array.isArray(detalles) ? detalles.filter((d): d is string => typeof d === 'string') : []
    };
  }

  return { message: error.message || GENERICO, details: [] };
}

/**
 * Si un cuerpo que llegó con 200 es en realidad un fallo.
 *
 * <p><b>Aquí está la trampa del contrato, y conviene mirarla dos veces.</b> Hay endpoints de
 * WiscanAPIs que contestan <c>200</c> con <c>{ Error: "..." }</c>: eso es un fallo disfrazado de
 * éxito y hay que convertirlo.</p>
 *
 * <p>Pero la previsualización del plano devuelve <c>{ Valid: false, Errors: [...] }</c> con un
 * <c>200</c> legítimo, y eso <b>no es un fallo</b>: es el contenido de la pantalla, la lista de lo
 * que hay que arreglar en el plano.</p>
 *
 * <p>Por eso la comprobación es exactamente «<c>Error</c>, en singular, y que sea un string».
 * Confundirlo con <c>Errors</c> haría que un plano con un número mal puesto pareciera una caída del
 * servidor.</p>
 */
export function errorEncubierto(cuerpo: unknown): string | null {
  if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return null;

  const valor = (cuerpo as Record<string, unknown>)['Error'];
  return typeof valor === 'string' && valor.trim() !== '' ? valor : null;
}
