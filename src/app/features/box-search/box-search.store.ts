import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';

import { apiFailure } from '../../core/http/api-error';
import { RobotApiService } from '../robot/robot-api.service';
import { BoxSearchResult, BoxSearchStatus, RobotInventory } from '../robot/robot.models';
import { CaraResaltada } from '../warehouse-map/plan-canvas/plan-canvas';
import { WarehouseMap } from '../warehouse-map/warehouse-map.models';
import { Async } from '../warehouse-map/warehouse-map.store';

const OCIOSO = { status: 'idle' } as const;

/**
 * El estado de la pantalla de Buscar (B12).
 *
 * <p><b>Solo se busca con el recorrido terminado</b> (regla del usuario). Mientras el robot anda, lo
 * guardado son las ubicaciones del recorrido ANTERIOR, y una búsqueda daría un sitio viejo como si
 * fuera el actual. La regla la impone el backend (<c>409</c>); aquí solo se enseña: el buscador se
 * habilita únicamente cuando el backend dice <c>Ready</c>.</p>
 */
@Injectable()
export class BoxSearchStore {
  private readonly api = inject(RobotApiService);

  private readonly _inventarios = signal<Async<RobotInventory[]>>(OCIOSO);
  private readonly _estado = signal<Async<BoxSearchStatus>>(OCIOSO);
  private readonly _resultado = signal<Async<BoxSearchResult>>(OCIOSO);
  private readonly _mapa = signal<Async<WarehouseMap>>(OCIOSO);

  readonly inventarios = this._inventarios.asReadonly();
  readonly estado = this._estado.asReadonly();
  readonly resultado = this._resultado.asReadonly();
  readonly mapa = this._mapa.asReadonly();

  readonly inventarioId = signal<string | null>(null);
  readonly codigo = signal('');

  readonly inventario = computed(() => {
    const lista = this._inventarios();
    return lista.status === 'ready' ? lista.value.find((i) => i._id === this.inventarioId()) ?? null : null;
  });

  /** Si el backend dejó buscar. Cualquier otra cosa —cargando, error, otro estado— es "no". */
  readonly habilitado = computed(() => {
    const e = this._estado();
    return e.status === 'ready' && e.value.State === 'Ready';
  });

  readonly puedeBuscar = computed(
    () => this.habilitado() && this.codigo().trim() !== '' && this._resultado().status !== 'loading'
  );

  /**
   * Las caras a señalar en el plano: la de cada ubicación resuelta y, de una ambigua, <b>todas</b>
   * sus candidatas. Elegir una sería afirmar lo que el robot no pudo decidir.
   */
  readonly resaltadas = computed<readonly CaraResaltada[]>(() => {
    const r = this._resultado();
    if (r.status !== 'ready') return [];
    return r.value.Locations.flatMap((l) =>
      l.Status === 'RESOLVED' && l.RackId && l.RackSide
        ? [{ rackId: l.RackId, side: l.RackSide }]
        : l.Candidates.map((c) => ({ rackId: c.RackId, side: c.Side }))
    );
  });

  async cargar(): Promise<void> {
    this._inventarios.set({ status: 'loading' });
    try {
      // También los cerrados: buscar una caja tiene sentido después de cerrar el inventario.
      this._inventarios.set({ status: 'ready', value: await this.api.inventarios() });
    } catch (error) {
      this._inventarios.set({ status: 'error', ...apiFailure(error) });
    }
  }

  async elegirInventario(id: string | null): Promise<void> {
    this.inventarioId.set(id);
    this._resultado.set(OCIOSO);
    this._mapa.set(OCIOSO);
    if (id === null) {
      this._estado.set(OCIOSO);
      return;
    }
    await this.consultarEstado();
  }

  async consultarEstado(): Promise<void> {
    const inv = this.inventarioId();
    if (inv === null) return;

    this._estado.set({ status: 'loading' });
    try {
      const estado = await this.api.estadoDeBusqueda(inv);
      if (this.inventarioId() === inv) this._estado.set({ status: 'ready', value: estado });
    } catch (error) {
      if (this.inventarioId() === inv) this._estado.set({ status: 'error', ...apiFailure(error) });
    }
  }

  async buscar(): Promise<void> {
    const inv = this.inventarioId();
    if (!this.puedeBuscar() || inv === null) return;

    this._resultado.set({ status: 'loading' });
    try {
      const resultado = await this.api.buscarCaja(inv, this.codigo());
      if (this.inventarioId() !== inv) return;
      this._resultado.set({ status: 'ready', value: resultado });
      if (resultado.Locations.length > 0) await this.cargarMapa();
    } catch (error) {
      // 409: entre que se habilitó el buscador y se buscó, el robot volvió a salir. Se enseña el
      // estado que manda el backend y se deshabilita: no hay resultado que dar.
      if (error instanceof HttpErrorResponse && error.status === 409 && esEstado(error.error)) {
        this._estado.set({ status: 'ready', value: error.error });
        this._resultado.set(OCIOSO);
        return;
      }
      this._resultado.set({ status: 'error', ...apiFailure(error) });
    }
  }

  /** El plano congelado del inventario, una vez: es el mismo para todas las búsquedas. */
  private async cargarMapa(): Promise<void> {
    const inv = this.inventario();
    if (!inv?.MapId || inv.MapVersion == null || this._mapa().status === 'ready') return;

    this._mapa.set({ status: 'loading' });
    try {
      this._mapa.set({ status: 'ready', value: await this.api.mapa(inv.MapId, inv.MapVersion) });
    } catch (error) {
      this._mapa.set({ status: 'error', ...apiFailure(error) });
    }
  }
}

function esEstado(cuerpo: unknown): cuerpo is BoxSearchStatus {
  return (
    cuerpo !== null &&
    typeof cuerpo === 'object' &&
    typeof (cuerpo as Record<string, unknown>)['State'] === 'string' &&
    typeof (cuerpo as Record<string, unknown>)['Message'] === 'string'
  );
}
