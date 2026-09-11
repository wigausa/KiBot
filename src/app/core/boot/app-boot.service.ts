import { Injectable, signal } from '@angular/core';

/** Rutas en las que tiene sentido mostrar la secuencia de arranque. */
const BOOT_ENTRY_PATHS = new Set(['/', '/inicio']);

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
    typeof location === 'undefined' || BOOT_ENTRY_PATHS.has(location.pathname);

  private readonly booted = signal(false);

  readonly hasBooted = this.booted.asReadonly();

  shouldPlayBoot(): boolean {
    return this.startedOnHome && !this.booted();
  }

  markBooted(): void {
    this.booted.set(true);
  }
}
