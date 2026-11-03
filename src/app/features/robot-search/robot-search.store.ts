import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';

import { apiFailure } from '../../core/http/api-error';
import { FalloDeOrden, RobotApiService, falloDeOrden } from '../robot/robot-api.service';
import {
  RobotInventory,
  RobotSearch,
  RobotTrack,
  codigosDe,
  esCodigoValido,
  robotsDe
} from '../robot/robot.models';
import { CaraResaltada, PuntoDelRecorrido, RobotEnElPlano } from '../warehouse-map/plan-canvas/plan-canvas';
import { WarehouseMap } from '../warehouse-map/warehouse-map.models';
import { Async } from '../warehouse-map/warehouse-map.store';

const OCIOSO = { status: 'idle' } as const;

/** Cada cuánto se mira cómo va la búsqueda. El robot manda lecturas cada pocos segundos. */
export const REFRESCO_BUSQUEDA_MS = 3000;

/** Lo que pasa al mandar la búsqueda o una orden: como `Async`, pero el fallo lleva el motivo del robot. */
export type EstadoDeEnvio =
  | { status: 'idle' }
  | { status: 'loading' }
  | ({ status: 'error' } & FalloDeOrden)
  | { status: 'ready' };

/**
 * «Buscar con el robot»: mandarlo a buscar unas cajas en UNA zona y ver, en vivo, cuáles encuentra.
 *
 * <p>La búsqueda <b>no toca el inventario</b>: lo que encuentra se guarda aparte y Buscar caja lo
 * enseña como «vista en una búsqueda». Lo encontrado sale de las lecturas normales del robot; el
 * backend lo calcula y aquí solo se mira. Pausar, Cancelar y Volver al dock son las órdenes de
 * siempre.</p>
 */
@Injectable()
export class RobotSearchStore implements OnDestroy {
  private readonly api = inject(RobotApiService);

  private readonly _inventarios = signal<Async<RobotInventory[]>>(OCIOSO);
  private readonly _busqueda = signal<RobotSearch | null>(null);
  private readonly _envio = signal<EstadoDeEnvio>(OCIOSO);
  private readonly _mapa = signal<Async<WarehouseMap>>(OCIOSO);
  private readonly _recorrido = signal<RobotTrack | null>(null);

  readonly inventarios = this._inventarios.asReadonly();
  readonly busqueda = this._busqueda.asReadonly();
  readonly envio = this._envio.asReadonly();
  readonly mapa = this._mapa.asReadonly();

  readonly inventarioId = signal<string | null>(null);
  readonly robotId = signal<number | null>(null);
  readonly zonaId = signal<number | null>(null);
  readonly texto = signal('');

  private temporizador: ReturnType<typeof setInterval> | null = null;

  /** Solo los inventarios abiertos: a un inventario cerrado no se le manda el robot. */
  readonly abiertos = computed(() => {
    const lista = this._inventarios();
    return lista.status === 'ready' ? lista.value.filter((i) => i.EndDate === null) : [];
  });

  readonly inventario = computed(() => this.abiertos().find((i) => i._id === this.inventarioId()) ?? null);
  readonly robots = computed(() => {
    const inv = this.inventario();
    return inv ? robotsDe([inv]) : [];
  });
  readonly zonas = computed(() => this.inventario()?.Zones ?? []);

  readonly codigos = computed(() => codigosDe(this.texto()));
  readonly invalidos = computed(() => this.codigos().filter((c) => !esCodigoValido(c)));

  readonly enMarcha = computed(() => this._busqueda()?.Status === 'Running');
  readonly ocupado = computed(() => this._envio().status === 'loading');

  readonly puedeBuscar = computed(
    () =>
      this.inventarioId() !== null &&
      this.robotId() !== null &&
      this.zonaId() !== null &&
      this.codigos().length > 0 &&
      this.invalidos().length === 0 &&
      !this.enMarcha() &&
      !this.ocupado()
  );

  /** Las caras donde se vio cada caja encontrada, para señalarlas en el plano. */
  readonly resaltadas = computed<readonly CaraResaltada[]>(() =>
    (this._busqueda()?.Found ?? [])
      .filter((f) => f.RackId !== null && f.RackSide !== null)
      .map((f) => ({ rackId: f.RackId!, side: f.RackSide! }))
  );

  readonly ruta = computed<readonly PuntoDelRecorrido[]>(() =>
    (this._recorrido()?.Points ?? []).map((p) => ({ x: p.X, y: p.Y }))
  );

  readonly robot = computed<RobotEnElPlano | null>(() => {
    const ultimo = this._recorrido()?.Points.at(-1);
    return ultimo && this.enMarcha() ? { x: ultimo.X, y: ultimo.Y, heading: ultimo.Heading } : null;
  });

  async cargar(): Promise<void> {
    this._inventarios.set({ status: 'loading' });
    try {
      this._inventarios.set({ status: 'ready', value: await this.api.inventarios() });
    } catch (error) {
      this._inventarios.set({ status: 'error', ...apiFailure(error) });
    }
  }

  /** Viene de Buscar caja: el inventario y el código ya puestos. */
  prellenar(idInventory: string | null, codigo: string | null): void {
    if (idInventory && this.abiertos().some((i) => i._id === idInventory)) this.elegirInventario(idInventory);
    if (codigo) this.texto.set(codigo.trim().toUpperCase());
  }

  elegirInventario(id: string | null): void {
    this.parar();
    this.inventarioId.set(id);
    this.zonaId.set(null);
    this._busqueda.set(null);
    this._recorrido.set(null);
    this._envio.set(OCIOSO);
    this._mapa.set(OCIOSO);
    const robots = this.robots();
    this.robotId.set(robots.length === 1 ? robots[0].IdDevice : null);
    const zonas = this.zonas();
    if (zonas.length === 1) this.zonaId.set(zonas[0].IdZone);
  }

  async buscar(): Promise<void> {
    const inv = this.inventarioId();
    const robot = this.robotId();
    const zona = this.zonaId();
    if (!this.puedeBuscar() || inv === null || robot === null || zona === null) return;

    this._envio.set({ status: 'loading' });
    try {
      const busqueda = await this.api.iniciarBusqueda(inv, robot, zona, this.codigos());
      if (this.inventarioId() !== inv) return;
      this._busqueda.set(busqueda);
      this._envio.set({ status: 'ready' });
      void this.cargarMapa();
      if (busqueda.Status === 'Running') this.empezarRefresco();
    } catch (error) {
      this._envio.set({ status: 'error', ...falloDeOrden(error) });
      // Rechazada por el robot: la búsqueda existe y queda como rechazada; se enseña tal cual.
      const cuerpo = error instanceof HttpErrorResponse ? (error.error as { Search?: RobotSearch } | null) : null;
      if (cuerpo?.Search) this._busqueda.set(cuerpo.Search);
    }
  }

  /** Lo que lleva encontrado y por dónde va el robot. Al terminar, deja de preguntar. */
  async refrescar(): Promise<void> {
    const inv = this.inventarioId();
    const actual = this._busqueda();
    if (inv === null || actual === null) return;
    try {
      const [busqueda, recorrido] = await Promise.all([
        this.api.busqueda(inv, actual.SearchId),
        this.api.recorrido(inv, actual.IdDevice, actual.SearchId).catch(() => null)
      ]);
      if (this.inventarioId() !== inv) return;
      this._busqueda.set(busqueda);
      if (recorrido) this._recorrido.set(recorrido);
      if (busqueda.Status !== 'Running') this.parar();
    } catch {
      // Un refresco fallido no borra lo que ya se ve: el siguiente lo vuelve a intentar.
    }
  }

  pausar(): Promise<void> {
    return this.orden((inv, robot) => this.api.pausar(inv, robot));
  }

  cancelar(): Promise<void> {
    return this.orden((inv, robot) => this.api.cancelar(inv, robot));
  }

  volverAlDock(): Promise<void> {
    return this.orden((inv, robot) => this.api.volverAlDock(inv, robot));
  }

  ngOnDestroy(): void {
    this.parar();
  }

  private async orden(llamar: (inv: string, robot: number) => Promise<unknown>): Promise<void> {
    const inv = this.inventarioId();
    const b = this._busqueda();
    if (inv === null || b === null || !this.enMarcha() || this.ocupado()) return;
    this._envio.set({ status: 'loading' });
    try {
      await llamar(inv, b.IdDevice);
      this._envio.set({ status: 'ready' });
    } catch (error) {
      this._envio.set({ status: 'error', ...falloDeOrden(error) });
    }
    await this.refrescar();
  }

  private async cargarMapa(): Promise<void> {
    const inv = this.inventario();
    if (!inv?.MapId || inv.MapVersion === null || inv.MapVersion === undefined) return;
    if (this._mapa().status === 'ready') return;
    this._mapa.set({ status: 'loading' });
    try {
      this._mapa.set({ status: 'ready', value: await this.api.mapa(inv.MapId, inv.MapVersion) });
    } catch (error) {
      this._mapa.set({ status: 'error', ...apiFailure(error) });
    }
  }

  private empezarRefresco(): void {
    this.parar();
    this.temporizador = setInterval(() => void this.refrescar(), REFRESCO_BUSQUEDA_MS);
  }

  private parar(): void {
    if (this.temporizador !== null) clearInterval(this.temporizador);
    this.temporizador = null;
  }
}
