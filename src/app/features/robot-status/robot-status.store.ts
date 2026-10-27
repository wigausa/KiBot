import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';

import { apiFailure } from '../../core/http/api-error';
import { RobotApiService } from '../robot/robot-api.service';
import { RobotStatusView, robotsDe } from '../robot/robot.models';
import { Async } from '../warehouse-map/warehouse-map.store';

const OCIOSO = { status: 'idle' } as const;

/**
 * Cada cuánto se refresca. El robot late cada 2 s en marcha; mirar cada 5 s basta para una pantalla
 * que lee una persona, y no multiplica las llamadas por cada robot.
 */
export const REFRESCO_ESTADO_MS = 5000;

/**
 * El estado de los robots según su latido, para las pantallas de Estado y de Ubicación.
 *
 * <p>Los robots salen de los inventarios (todos, también los cerrados): el latido no pertenece a un
 * inventario, y un robot en el dock sin inventario abierto también tiene que verse.</p>
 *
 * <p><b>No es singleton</b>, como el de Control: al salir de la pantalla se destruye y deja de
 * consultar.</p>
 */
@Injectable()
export class RobotStatusStore implements OnDestroy {
  private readonly api = inject(RobotApiService);

  private readonly _robots = signal<Async<{ IdDevice: number; Name: string }[]>>(OCIOSO);
  private readonly _estados = signal<Async<RobotStatusView[]>>(OCIOSO);
  private readonly _detalle = signal<RobotStatusView | null>(null);

  /** Si el último refresco falló. Se sigue enseñando lo último bueno, avisando de que puede ser viejo. */
  readonly refrescoFallido = signal(false);

  readonly robots = this._robots.asReadonly();
  readonly estados = this._estados.asReadonly();
  readonly detalle = this._detalle.asReadonly();

  /** El robot del que se mira el detalle. */
  readonly elegido = signal<number | null>(null);

  private temporizador: ReturnType<typeof setInterval> | null = null;

  /** Cada robot con su último latido, o `null` si nunca mandó uno. En el orden de los inventarios. */
  readonly filas = computed(() => {
    const robots = this._robots();
    if (robots.status !== 'ready') return [];
    const estados = this._estados();
    const porId = new Map(
      (estados.status === 'ready' ? estados.value : []).map((e) => [e.IdDevice, e] as const)
    );
    return robots.value.map((r) => ({ ...r, estado: porId.get(r.IdDevice) ?? null }));
  });

  async cargar(): Promise<void> {
    this._robots.set({ status: 'loading' });
    try {
      const robots = robotsDe(await this.api.inventarios());
      this._robots.set({ status: 'ready', value: robots });
    } catch (error) {
      this._robots.set({ status: 'error', ...apiFailure(error) });
      return;
    }

    this._estados.set({ status: 'loading' });
    await this.refrescar();
    this.pararRefresco();
    this.temporizador = setInterval(() => void this.refrescar(), REFRESCO_ESTADO_MS);
  }

  async refrescar(): Promise<void> {
    const robots = this._robots();
    if (robots.status !== 'ready') return;
    if (robots.value.length === 0) {
      this._estados.set({ status: 'ready', value: [] });
      return;
    }

    try {
      const estados = await this.api.estados(robots.value.map((r) => r.IdDevice));
      this._estados.set({ status: 'ready', value: estados });
      this.refrescoFallido.set(false);
    } catch (error) {
      // La primera vez no hay nada que enseñar: error. Después, se queda lo último bueno.
      if (this._estados().status !== 'ready') this._estados.set({ status: 'error', ...apiFailure(error) });
      this.refrescoFallido.set(true);
    }

    await this.refrescarDetalle();
  }

  async elegir(idDevice: number | null): Promise<void> {
    this.elegido.set(idDevice);
    this._detalle.set(null);
    await this.refrescarDetalle();
  }

  ngOnDestroy(): void {
    this.pararRefresco();
  }

  private async refrescarDetalle(): Promise<void> {
    const id = this.elegido();
    if (id === null) return;
    try {
      const detalle = await this.api.estado(id);
      if (this.elegido() === id) this._detalle.set(detalle);   // respuesta tardía de otro robot
    } catch {
      // El detalle es un extra: si falla, el siguiente refresco lo vuelve a intentar.
    }
  }

  private pararRefresco(): void {
    if (this.temporizador !== null) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }
}
