import { Injectable, signal } from '@angular/core';

/** Rutas en las que tiene sentido mostrar la secuencia de arranque. */
const BOOT_ENTRY_PATHS = new Set(['/', '/inicio']);

/**
 * La ruta de la app en la URL de carga. Con `withHashLocation` va en el hash (`#/inicio`), no en
 * `location.pathname`, que desplegado es `/kibot/index.html`. Sin hash, la app arranca en Inicio.
 */
export function rutaInicial(hash: string): string {
  const ruta = hash.replace(/^#/, '').split(/[?#]/)[0];
  return ruta === '' ? '/' : ruta;
}

/**
 * Decide si corre la secuencia de arranque (cortina + spinner de marca).
 *
 * La cortina es el encendido de la pantalla del robot, no una transición de
 * navegación: solo corre si la app se cargó directamente en Inicio y una sola
 * vez. Volver a Inicio desde otro módulo no la repite.
 *
 * Se instancia en el bootstrap (`App`) para leer la URL inicial antes de que
 * el router navegue.
 */
@Injectable({ providedIn: 'root' })
export class AppBootService {
  private readonly startedOnHome =
    typeof location === 'undefined' || BOOT_ENTRY_PATHS.has(rutaInicial(location.hash));

  private readonly booted = signal(false);

  readonly hasBooted = this.booted.asReadonly();

  shouldPlayBoot(): boolean {
    return this.startedOnHome && !this.booted();
  }

  markBooted(): void {
    this.booted.set(true);
  }
}
