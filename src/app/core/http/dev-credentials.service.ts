import { Injectable } from '@angular/core';
import { ApiCredentials } from './api.config';

/**
 * Las credenciales mientras WiDex no tiene su registro en B2C.
 *
 * <p><b>No devuelve ninguna cabecera, y eso es lo correcto.</b> En desarrollo la identidad la pone
 * el proxy de `ng serve` del lado del servidor —ver `proxy.config.example.js`—, así que no hay nada
 * que meter en el bundle. Un secreto compilado en un frontend no es un secreto: cualquiera lo lee
 * desde las herramientas del navegador, y el endpoint que abriría crea y sobrescribe mapas de
 * almacén.</p>
 *
 * <p>Que esta clase esté casi vacía es la señal de que la costura funciona: todo lo que hace falta
 * para autenticar está fuera de la aplicación. Se borra entera el día que entre
 * <c>MsalCredentialsService</c>.</p>
 */
@Injectable()
export class DevCredentialsService implements ApiCredentials {
  async authHeaders(): Promise<Record<string, string>> {
    return {};
  }

  onUnauthorized(): void {
    // Todavía no hay sesión que cerrar ni a dónde redirigir. Con MSAL, aquí va logoutRedirect.
  }
}
