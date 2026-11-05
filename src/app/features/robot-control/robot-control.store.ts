import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';

import { apiFailure } from '../../core/http/api-error';
import { FalloDeOrden, RobotApiService, falloDeOrden } from '../robot/robot-api.service';
import { RobotBatchView, RobotInventory, RobotProgress, RobotStatusView } from '../robot/robot.models';
import { Async } from '../warehouse-map/warehouse-map.store';

const OCIOSO = { status: 'idle' } as const;

/** Cada cuánto se refresca el avance mientras el robot anda. El robot tarda minutos por pasillo. */
export const REFRESCO_MS = 5000;

/** Lo que pasa con una orden: como `Async`, pero el fallo lleva el motivo del robot. */
export type EstadoDeOrden =
  | { status: 'idle' }
  | { status: 'loading' }
  | ({ status: 'error' } & FalloDeOrden)
  | { status: 'ready'; value: RobotBatchView };

/**
 * El estado de la pantalla de Control (B12): elegir inventario, robot y zonas en orden, iniciar la
 * tanda, ver el avance y pausarla, reanudarla, cancelarla o mandar el robot al dock.
 *
 * <p>La tanda la lleva la nube: manda un `START` por zona y encadena la siguiente cuando la anterior
 * termina bien. Aquí solo se pide y se mira. La pausa no viene en la tanda sino en el latido del
 * robot, así que el sondeo trae las dos cosas, junto con el avance.</p>
 *
 * <p><b>No es singleton</b>: se provee en el componente, como el del plano. Al salir de la pantalla
 * se destruye y con él el refresco del avance; si viviera en la raíz, seguiría consultando al
 * backend cada pocos segundos desde una pantalla que nadie mira.</p>
 */
@Injectable()
export class RobotControlStore implements OnDestroy {
  private readonly api = inject(RobotApiService);

  private readonly _inventarios = signal<Async<RobotInventory[]>>(OCIOSO);
  private readonly _tanda = signal<Async<RobotBatchView | null>>(OCIOSO);
  private readonly _accion = signal<EstadoDeOrden>(OCIOSO);
  private readonly _progreso = signal<RobotProgress | null>(null);
  private readonly _latido = signal<RobotStatusView | null>(null);

  readonly inventarios = this._inventarios.asReadonly();
  readonly tanda = this._tanda.asReadonly();
  readonly accion = this._accion.asReadonly();
  readonly progreso = this._progreso.asReadonly();
  readonly latido = this._latido.asReadonly();

  readonly inventarioId = signal<string | null>(null);
  readonly robotId = signal<number | null>(null);
  /** Las zonas marcadas, en el orden en que se recorren. */
  readonly zonasMarcadas = signal<readonly number[]>([]);

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

  /** Las marcadas con su nombre, en orden, para la lista «1. Cocina, 2. Sala…». */
  readonly zonasEnOrden = computed(() => {
    const nombres = new Map(this.zonas().map((z) => [z.IdZone, z.Name]));
    return this.zonasMarcadas().map((id) => ({ IdZone: id, Name: nombres.get(id) ?? `Zona ${id}` }));
  });

  /** La tanda del robot elegido, si tiene (en marcha o la última). */
  readonly ultima = computed(() => {
    const t = this._tanda();
    return t.status === 'ready' ? t.value : null;
  });

  /** La tanda en marcha del robot elegido, si la hay. */
  readonly enMarcha = computed(() => {
    const t = this.ultima();
    return t?.Status === 'Running' ? t : null;
  });

  /** La zona que recorre ahora, con su posición: «Zona 2 de 3». */
  readonly zonaEnCurso = computed(() => {
    const t = this.enMarcha();
    const zona = t?.Zones[t.Current];
    return t && zona ? { numero: t.Current + 1, total: t.Zones.length, zona } : null;
  });

  /** La misión que cuenta el latido, solo si es la de la zona en curso: una vieja no dice nada. */
  private readonly mision = computed(() => {
    const t = this.enMarcha();
    const m = this._latido()?.Status?.Mission ?? null;
    return t && m && t.CurrentRunId !== null && m.RunId === t.CurrentRunId ? m : null;
  });

  /** Pausada: se puede reanudar, cancelar o volver al dock. */
  readonly enPausa = computed(() => this.mision()?.Status === 'PAUSED');
  readonly volviendo = computed(() => this.mision()?.Status === 'RETURNING');

  /**
   * El `START` de la zona en curso quedó sin confirmar (`PENDING`, o sin respuesta) y el latido todavía
   * no la ve en marcha. La nube espera 2 minutos: si no arranca, detiene la tanda (`NOT_STARTED`).
   */
  readonly arrancando = computed(() => {
    const t = this.enMarcha();
    const ack = t?.LastAck;
    if (!t || !ack || ack.Command !== 'START' || (ack.Status !== 'PENDING' && ack.Status !== 'NO_RESPONSE')) return false;
    const m = this.mision();
    return m === null || !m.Status || m.Status === 'PREPARING';
  });

  readonly ocupado = computed(() => this._accion().status === 'loading');

  readonly puedeIniciar = computed(
    () =>
      this.inventarioId() !== null &&
      this.robotId() !== null &&
      this.zonasMarcadas().length > 0 &&
      this.enMarcha() === null &&
      this._tanda().status === 'ready' &&
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
    this.zonasMarcadas.set([]);
    this._tanda.set(OCIOSO);
    this._accion.set(OCIOSO);
    this.pararRefresco();
    this._progreso.set(null);
    this._latido.set(null);
  }

  async elegirRobot(id: number | null): Promise<void> {
    this.robotId.set(id);
    this._accion.set(OCIOSO);
    this.pararRefresco();
    this._progreso.set(null);
    this._latido.set(null);
    if (id === null) {
      this._tanda.set(OCIOSO);
      return;
    }
    await this.consultarTanda();
  }

  /** Marcar la pone al final del recorrido; desmarcarla la quita y las de detrás suben. */
  alternarZona(idZone: number): void {
    const actuales = this.zonasMarcadas();
    this.zonasMarcadas.set(
      actuales.includes(idZone) ? actuales.filter((z) => z !== idZone) : [...actuales, idZone]
    );
  }

  /** El número de la zona en el recorrido (1, 2…), o `null` si no está marcada. */
  ordenDe(idZone: number): number | null {
    const i = this.zonasMarcadas().indexOf(idZone);
    return i === -1 ? null : i + 1;
  }

  /** Mueve una zona marcada un puesto antes (`-1`) o después (`1`) en el recorrido. */
  moverZona(idZone: number, sentido: -1 | 1): void {
    const lista = [...this.zonasMarcadas()];
    const i = lista.indexOf(idZone);
    const j = i + sentido;
    if (i === -1 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    this.zonasMarcadas.set(lista);
  }

  /** Inicia la tanda con las zonas marcadas, en su orden. La nube las encadena una tras otra. */
  async iniciar(): Promise<void> {
    const inv = this.inventarioId();
    const robot = this.robotId();
    if (!this.puedeIniciar() || inv === null || robot === null) return;

    const zonas = this.zonasMarcadas();
    await this.ordenar(() => this.api.iniciarTanda(inv, robot, zonas));
  }

  /** Pausa la zona en curso. Se puede reanudar después. */
  async pausar(): Promise<void> {
    await this.ordenEnMarcha((inv, robot) => this.api.pausar(inv, robot));
  }

  /** Sigue la zona pausada donde se quedó. */
  async reanudar(): Promise<void> {
    await this.ordenEnMarcha((inv, robot) => this.api.reanudar(inv, robot));
  }

  /** Cancela la zona en curso y con ella la tanda entera. El robot se queda donde está. */
  async cancelar(): Promise<void> {
    await this.ordenEnMarcha((inv, robot) => this.api.cancelar(inv, robot));
  }

  /** Manda el robot al dock: también detiene la tanda. */
  async volverAlDock(): Promise<void> {
    await this.ordenEnMarcha((inv, robot) => this.api.volverAlDock(inv, robot));
  }

  /**
   * Lo que se sondea mientras hay tanda: el avance, la tanda (en qué zona va, o si se detuvo) y el
   * latido (la pausa). Cuando la tanda deja de estar en marcha se deja de sondear: lo último que se
   * trajo ya cuenta cómo terminó.
   */
  async refrescar(): Promise<void> {
    const inv = this.inventarioId();
    const robot = this.robotId();
    if (inv === null) return;
    await Promise.all([
      this.refrescarProgreso(inv),
      robot !== null ? this.refrescarTanda(inv, robot) : Promise.resolve(),
      robot !== null ? this.refrescarLatido(robot) : Promise.resolve()
    ]);
    if (this.temporizador !== null && this.enMarcha() === null && this._tanda().status === 'ready') {
      this.pararRefresco();
    }
  }

  ngOnDestroy(): void {
    this.pararRefresco();
  }

  private async ordenEnMarcha(
    llamar: (inv: string, robot: number) => Promise<RobotBatchView>
  ): Promise<void> {
    const inv = this.inventarioId();
    const robot = this.robotId();
    if (inv === null || robot === null || this.enMarcha() === null || this.ocupado()) return;

    await this.ordenar(() => llamar(inv, robot));
  }

  /** Manda una orden y deja la tanda que devuelve como la que se mira. */
  private async ordenar(llamar: () => Promise<RobotBatchView>): Promise<void> {
    const inv = this.inventarioId();
    const robot = this.robotId();
    this._accion.set({ status: 'loading' });
    try {
      const tanda = await llamar();
      if (this.inventarioId() !== inv || this.robotId() !== robot) return;   // respuesta tardía
      this._accion.set({ status: 'ready', value: tanda });
      this._tanda.set({ status: 'ready', value: tanda });
      // En marcha o no, se sondea al menos una vez: si ya se detuvo, el propio refresco lo apaga.
      this.empezarRefresco();
    } catch (error) {
      this._accion.set({ status: 'error', ...falloDeOrden(error) });
      // Otra tanda en marcha, o ninguna a la que mandar la orden: se trae la de verdad.
      if (inv !== null && robot !== null) await this.refrescarTanda(inv, robot);
    }
  }

  private async consultarTanda(): Promise<void> {
    const inv = this.inventarioId();
    const robot = this.robotId();
    if (inv === null || robot === null) return;

    this._tanda.set({ status: 'loading' });
    try {
      const tanda = await this.api.tanda(inv, robot);
      if (this.inventarioId() !== inv || this.robotId() !== robot) return;   // respuesta tardía
      this._tanda.set({ status: 'ready', value: tanda });
      if (tanda?.Status === 'Running') {
        // Ya estaba andando: se marcan sus zonas en su orden y se sigue su avance.
        this.zonasMarcadas.set(tanda.Zones.map((z) => z.IdZone));
        this.empezarRefresco();
      }
    } catch (error) {
      this._tanda.set({ status: 'error', ...apiFailure(error) });
    }
  }

  private async refrescarProgreso(inv: string): Promise<void> {
    try {
      const progreso = await this.api.progreso(inv);
      // Si mientras tanto se cambió de inventario, esta respuesta ya no es de lo que se mira.
      if (this.inventarioId() === inv) this._progreso.set(progreso);
    } catch {
      // Un refresco que falla no tumba la pantalla: el siguiente lo vuelve a intentar.
    }
  }

  private async refrescarTanda(inv: string, robot: number): Promise<void> {
    try {
      const tanda = await this.api.tanda(inv, robot);
      if (this.inventarioId() === inv && this.robotId() === robot) this._tanda.set({ status: 'ready', value: tanda });
    } catch {
      // Igual que el avance: se queda la última que se vio hasta el siguiente refresco.
    }
  }

  private async refrescarLatido(robot: number): Promise<void> {
    try {
      const latido = await this.api.estado(robot);
      if (this.robotId() === robot) this._latido.set(latido);
    } catch {
      // Sin latido no se sabe si está en pausa: se enseña en marcha hasta el siguiente.
    }
  }

  private empezarRefresco(): void {
    this.pararRefresco();
    this.temporizador = setInterval(() => void this.refrescar(), REFRESCO_MS);
    void this.refrescar();
  }

  private pararRefresco(): void {
    if (this.temporizador !== null) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }
}
