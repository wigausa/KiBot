import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';

import { apiFailure } from '../../core/http/api-error';
import { RobotApiService } from '../robot/robot-api.service';
import { RobotInventory, RobotProgress, RobotRun } from '../robot/robot.models';
import { Async } from '../warehouse-map/warehouse-map.store';

const OCIOSO = { status: 'idle' } as const;

/** Cada cuánto se refresca el avance mientras el robot anda. El robot tarda minutos por pasillo. */
export const REFRESCO_MS = 5000;

/**
 * El estado de la pantalla de Control (B12): elegir inventario, robot y zonas, iniciar, ver el
 * avance y cerrar.
 *
 * <p><b>No es singleton</b>: se provee en el componente, como el del plano. Al salir de la pantalla
 * se destruye y con él el refresco del avance; si viviera en la raíz, seguiría consultando al
 * backend cada pocos segundos desde una pantalla que nadie mira.</p>
 */
@Injectable()
export class RobotControlStore implements OnDestroy {
  private readonly api = inject(RobotApiService);

  private readonly _inventarios = signal<Async<RobotInventory[]>>(OCIOSO);
  private readonly _recorrido = signal<Async<RobotRun | null>>(OCIOSO);
  private readonly _accion = signal<Async<RobotRun>>(OCIOSO);
  private readonly _progreso = signal<RobotProgress | null>(null);

  readonly inventarios = this._inventarios.asReadonly();
  readonly recorrido = this._recorrido.asReadonly();
  readonly accion = this._accion.asReadonly();
  readonly progreso = this._progreso.asReadonly();

  readonly inventarioId = signal<string | null>(null);
  readonly robotId = signal<number | null>(null);
  readonly zonasMarcadas = signal<ReadonlySet<number>>(new Set());

  private temporizador: ReturnType<typeof setInterval> | null = null;

  readonly inventario = computed(() => {
    const lista = this._inventarios();
    return lista.status === 'ready' ? lista.value.find((i) => i._id === this.inventarioId()) ?? null : null;
  });

  /** Solo los robots del inventario: las puertas y pistolas no recorren. Uno por id. */
  readonly robots = computed(() => {
    const vistos = new Map<number, string>();
    for (const d of this.inventario()?.Devices ?? []) {
      if (d.Type?.toLowerCase() === 'robot' && !vistos.has(d.IdDevice)) vistos.set(d.IdDevice, d.Name);
    }
    return [...vistos].map(([IdDevice, Name]) => ({ IdDevice, Name }));
  });

  readonly zonas = computed(() => this.inventario()?.Zones ?? []);

  /** El recorrido abierto del robot elegido, si lo hay. */
  readonly abierto = computed(() => {
    const r = this._recorrido();
    return r.status === 'ready' && r.value?.Status === 'OPEN' ? r.value : null;
  });

  readonly ocupado = computed(() => this._accion().status === 'loading');

  readonly puedeIniciar = computed(
    () =>
      this.inventarioId() !== null &&
      this.robotId() !== null &&
      this.zonasMarcadas().size > 0 &&
      this.abierto() === null &&
      this._recorrido().status === 'ready' &&
      !this.ocupado()
  );

  async cargar(): Promise<void> {
    this._inventarios.set({ status: 'loading' });
    try {
      const todos = await this.api.inventarios();
      // Solo los abiertos: en un inventario cerrado no se recorre.
      this._inventarios.set({ status: 'ready', value: todos.filter((i) => !i.EndDate) });
    } catch (error) {
      this._inventarios.set({ status: 'error', ...apiFailure(error) });
    }
  }

  elegirInventario(id: string | null): void {
    this.inventarioId.set(id);
    this.robotId.set(null);
    this.zonasMarcadas.set(new Set());
    this._recorrido.set(OCIOSO);
    this._accion.set(OCIOSO);
    this.pararRefresco();
    this._progreso.set(null);
  }

  async elegirRobot(id: number | null): Promise<void> {
    this.robotId.set(id);
    this._accion.set(OCIOSO);
    this.pararRefresco();
    this._progreso.set(null);
    if (id === null) {
      this._recorrido.set(OCIOSO);
      return;
    }
    await this.consultarRecorrido();
  }

  alternarZona(idZone: number): void {
    const nuevas = new Set(this.zonasMarcadas());
    if (nuevas.has(idZone)) nuevas.delete(idZone);
    else nuevas.add(idZone);
    this.zonasMarcadas.set(nuevas);
  }

  /** Abre el recorrido con las zonas marcadas. A GHT le sale `robot.run.started` desde el backend. */
  async iniciar(): Promise<void> {
    const inv = this.inventarioId();
    const robot = this.robotId();
    if (!this.puedeIniciar() || inv === null || robot === null) return;

    this._accion.set({ status: 'loading' });
    try {
      const run = await this.api.abrir(inv, robot, [...this.zonasMarcadas()].sort((a, b) => a - b));
      this._accion.set({ status: 'ready', value: run });
      this._recorrido.set({ status: 'ready', value: run });
      this.empezarRefresco();
    } catch (error) {
      this._accion.set({ status: 'error', ...apiFailure(error) });
    }
  }

  /** Cierra el recorrido. Queda `ABORTED` y el barrido lo calcula en unos minutos. */
  async cerrar(): Promise<void> {
    const inv = this.inventarioId();
    const robot = this.robotId();
    if (inv === null || robot === null || this.abierto() === null || this.ocupado()) return;

    this._accion.set({ status: 'loading' });
    try {
      const run = await this.api.cerrar(inv, robot);
      this._accion.set({ status: 'ready', value: run });
      this._recorrido.set({ status: 'ready', value: run });
      this.pararRefresco();
      await this.refrescarProgreso();
    } catch (error) {
      this._accion.set({ status: 'error', ...apiFailure(error) });
    }
  }

  async refrescarProgreso(): Promise<void> {
    const inv = this.inventarioId();
    if (inv === null) return;
    try {
      const progreso = await this.api.progreso(inv);
      // Si mientras tanto se cambió de inventario, esta respuesta ya no es de lo que se mira.
      if (this.inventarioId() === inv) this._progreso.set(progreso);
    } catch {
      // Un refresco que falla no tumba la pantalla: el siguiente lo vuelve a intentar.
    }
  }

  ngOnDestroy(): void {
    this.pararRefresco();
  }

  private async consultarRecorrido(): Promise<void> {
    const inv = this.inventarioId();
    const robot = this.robotId();
    if (inv === null || robot === null) return;

    this._recorrido.set({ status: 'loading' });
    try {
      const run = await this.api.recorridoAbierto(inv, robot);
      if (this.inventarioId() !== inv || this.robotId() !== robot) return;   // respuesta tardía
      this._recorrido.set({ status: 'ready', value: run });
      if (run?.Status === 'OPEN') {
        // Ya estaba andando: se marcan sus zonas y se sigue su avance.
        this.zonasMarcadas.set(new Set(run.Zones ?? []));
        this.empezarRefresco();
      }
    } catch (error) {
      this._recorrido.set({ status: 'error', ...apiFailure(error) });
    }
  }

  private empezarRefresco(): void {
    this.pararRefresco();
    void this.refrescarProgreso();
    this.temporizador = setInterval(() => void this.refrescarProgreso(), REFRESCO_MS);
  }

  private pararRefresco(): void {
    if (this.temporizador !== null) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }
}
