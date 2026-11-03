import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';

import { apiFailure } from '../../core/http/api-error';
import { RobotApiService } from '../robot/robot-api.service';
import { RobotInventory, RobotTrack, RobotTrackPoint, robotsDe } from '../robot/robot.models';
import {
  PuntoDelRecorrido,
  RobotEnElPlano,
  TramoDelRecorrido
} from '../warehouse-map/plan-canvas/plan-canvas';
import { WarehouseMap } from '../warehouse-map/warehouse-map.models';
import { Async } from '../warehouse-map/warehouse-map.store';

const OCIOSO = { status: 'idle' } as const;

/** Cada cuánto se piden los puntos nuevos con el recorrido abierto. El robot late cada 2 s en marcha. */
export const REFRESCO_RECORRIDO_MS = 2000;

/** Cada cuánto avanza la repetición. */
export const PASO_DE_REPETICION_MS = 100;

export const VELOCIDADES = [1, 4, 16, 64] as const;
export type Velocidad = (typeof VELOCIDADES)[number];

/** Un punto con su instante ya convertido, para no volver a leer fechas en cada fotograma. */
interface Punto extends RobotTrackPoint {
  readonly t: number;
}

/**
 * Dónde estaba el robot en un instante: entre los dos puntos que lo rodean, a la parte
 * proporcional. El rumbo, el del punto anterior (el robot avanza hacia el siguiente).
 */
export function robotEn(puntos: readonly Punto[], instante: number): RobotEnElPlano | null {
  if (puntos.length === 0 || instante < puntos[0].t) return null;
  let i = puntos.length - 1;
  while (i > 0 && puntos[i].t > instante) i--;
  const a = puntos[i];
  const b = puntos[i + 1];
  if (!b || b.t === a.t) return { x: a.X, y: a.Y, heading: a.Heading };
  const f = Math.min(1, Math.max(0, (instante - a.t) / (b.t - a.t)));
  return { x: a.X + (b.X - a.X) * f, y: a.Y + (b.Y - a.Y) * f, heading: a.Heading ?? b.Heading };
}

/**
 * La pantalla «Recorrido»: por dónde va el robot sobre el plano del inventario, en vivo mientras el
 * recorrido está abierto y en repetición cuando ya cerró.
 *
 * <p>Los puntos llegan <b>ya en coordenadas del plano</b>: el backend los lleva desde el mapa del
 * robot con triángulos entre anclas. Aquí solo se juntan, se interpolan y se dibujan.</p>
 */
@Injectable()
export class RobotTrackStore implements OnDestroy {
  private readonly api = inject(RobotApiService);

  private readonly _inventarios = signal<Async<RobotInventory[]>>(OCIOSO);
  private readonly _recorrido = signal<Async<RobotTrack>>(OCIOSO);
  private readonly _mapa = signal<Async<WarehouseMap>>(OCIOSO);
  private readonly _puntos = signal<readonly Punto[]>([]);
  private readonly _refrescoFallido = signal(false);

  readonly inventarios = this._inventarios.asReadonly();
  readonly recorrido = this._recorrido.asReadonly();
  readonly mapa = this._mapa.asReadonly();
  readonly puntos = this._puntos.asReadonly();
  readonly refrescoFallido = this._refrescoFallido.asReadonly();

  readonly inventarioId = signal<string | null>(null);
  readonly robotId = signal<number | null>(null);

  /** El instante que se repite, en ms. Null: en vivo, el último punto. */
  readonly instante = signal<number | null>(null);
  readonly reproduciendo = signal(false);
  readonly velocidad = signal<Velocidad>(16);

  private sondeo: ReturnType<typeof setInterval> | null = null;
  private reproduccion: ReturnType<typeof setInterval> | null = null;

  readonly inventario = computed(() => {
    const lista = this._inventarios();
    return lista.status === 'ready' ? lista.value.find((i) => i._id === this.inventarioId()) ?? null : null;
  });

  readonly robots = computed(() => {
    const inv = this.inventario();
    return inv ? robotsDe([inv]) : [];
  });

  readonly abierto = computed(() => {
    const r = this._recorrido();
    return r.status === 'ready' && r.value.Run.Status === 'OPEN';
  });

  readonly inicio = computed(() => this._puntos()[0]?.t ?? null);
  readonly fin = computed(() => this._puntos().at(-1)?.t ?? null);

  /** En vivo, el último punto; en repetición, hasta el instante. */
  readonly visibles = computed(() => {
    const t = this.instante();
    const puntos = this._puntos();
    return t === null ? puntos : puntos.filter((p) => p.t <= t);
  });

  readonly ruta = computed<readonly PuntoDelRecorrido[]>(() => this.visibles().map((p) => ({ x: p.X, y: p.Y })));

  readonly robot = computed<RobotEnElPlano | null>(() => {
    const t = this.instante();
    const puntos = this._puntos();
    if (t !== null) return robotEn(puntos, t);
    const ultimo = puntos.at(-1);
    return ultimo ? { x: ultimo.X, y: ultimo.Y, heading: ultimo.Heading } : null;
  });

  /** El punto del que se enseñan los datos: el último visible. */
  readonly actual = computed(() => this.visibles().at(-1) ?? null);

  /** Los tramos terminados y, con el recorrido abierto, el que está recorriendo. */
  readonly tramos = computed<readonly TramoDelRecorrido[]>(() => {
    const r = this._recorrido();
    if (r.status !== 'ready') return [];
    const t = this.instante();
    const hechos = r.value.Tramos
      .filter((x) => x.AisleId !== null && (t === null || Date.parse(x.CoveredAt) <= t))
      .map<TramoDelRecorrido>((x) => ({
        aisleId: x.AisleId!,
        tramo: x.Tramo,
        estado: x.Status?.toUpperCase() === 'COMPLETO' ? 'completo' : 'parcial'
      }));

    const enCurso = this.actual()?.MissionTramo?.split('-');
    if (enCurso?.length === 2 && (this.abierto() || t !== null)) {
      const [numero, tramo] = enCurso;
      const aisleId = `P${numero}`;
      if (!hechos.some((h) => h.aisleId === aisleId && h.tramo.toUpperCase() === tramo.toUpperCase()))
        hechos.push({ aisleId, tramo, estado: 'recorriendo' });
    }
    return hechos;
  });

  /** Puntos que no cuadran con el segmento que decía el robot, y los que salieron por la afín. */
  readonly desfasados = computed(() => this.visibles().filter((p) => p.Mismatch).length);
  readonly porAfin = computed(() => this.visibles().filter((p) => p.Method === 'AFFINE').length);

  async cargar(): Promise<void> {
    this._inventarios.set({ status: 'loading' });
    try {
      this._inventarios.set({ status: 'ready', value: await this.api.inventarios() });
    } catch (error) {
      this._inventarios.set({ status: 'error', ...apiFailure(error) });
    }
  }

  async elegirInventario(id: string | null): Promise<void> {
    this.parar();
    this.inventarioId.set(id);
    this.robotId.set(null);
    this.limpiar();
    const robots = this.robots();
    if (robots.length === 1) await this.elegirRobot(robots[0].IdDevice);
  }

  async elegirRobot(id: number | null): Promise<void> {
    this.parar();
    this.robotId.set(id);
    this.limpiar();
    if (id !== null) await this.cargarRecorrido();
  }

  async cargarRecorrido(): Promise<void> {
    const inv = this.inventarioId();
    const dev = this.robotId();
    if (inv === null || dev === null) return;

    this._recorrido.set({ status: 'loading' });
    try {
      const recorrido = await this.api.recorrido(inv, dev);
      if (inv !== this.inventarioId() || dev !== this.robotId()) return;
      this._recorrido.set({ status: 'ready', value: recorrido });
      this._puntos.set(conInstante(recorrido.Points));
      await this.cargarMapa(recorrido);

      if (recorrido.Run.Status === 'OPEN') this.empezarSondeo();
      else this.instante.set(this.inicio());
    } catch (error) {
      if (inv === this.inventarioId() && dev === this.robotId())
        this._recorrido.set({ status: 'error', ...apiFailure(error) });
    }
  }

  /** Los puntos nuevos desde el último. Si el recorrido cerró, para y deja la repetición lista. */
  async refrescar(): Promise<void> {
    const inv = this.inventarioId();
    const dev = this.robotId();
    const r = this._recorrido();
    if (inv === null || dev === null || r.status !== 'ready') return;

    const ultimo = this._puntos().at(-1)?.T ?? null;
    try {
      const nuevo = await this.api.recorrido(inv, dev, r.value.RobotRunId ?? r.value.RunId, ultimo);
      if (inv !== this.inventarioId() || dev !== this.robotId()) return;
      this._refrescoFallido.set(false);
      this._recorrido.set({ status: 'ready', value: { ...nuevo, Points: [] } });
      if (nuevo.Points.length > 0) {
        const vistos = new Set(this._puntos().map((p) => p.T + p.Source));
        const sumados = [...this._puntos(), ...conInstante(nuevo.Points).filter((p) => !vistos.has(p.T + p.Source))];
        this._puntos.set(sumados.sort((a, b) => a.t - b.t));
      }
      if (nuevo.Run.Status !== 'OPEN') {
        this.pararSondeo();
        this.instante.set(this.inicio());
      }
    } catch {
      // Un refresco fallido no borra lo que ya se ve: se avisa y se reintenta en el siguiente.
      this._refrescoFallido.set(true);
    }
  }

  // --- la repetición ---------------------------------------------------------------------------

  reproducir(): void {
    if (this.inicio() === null) return;
    const fin = this.fin()!;
    if (this.instante() === null || this.instante()! >= fin) this.instante.set(this.inicio());
    this.reproduciendo.set(true);
    this.pararReproduccion();
    this.reproduccion = setInterval(() => this.avanzar(PASO_DE_REPETICION_MS * this.velocidad()), PASO_DE_REPETICION_MS);
  }

  pausar(): void {
    this.reproduciendo.set(false);
    this.pararReproduccion();
  }

  /** Mueve la repetición `ms` hacia delante. Al llegar al final, se para. */
  avanzar(ms: number): void {
    const fin = this.fin();
    const t = this.instante();
    if (fin === null || t === null) return;
    const siguiente = Math.min(fin, t + ms);
    this.instante.set(siguiente);
    if (siguiente >= fin) this.pausar();
  }

  irA(instante: number): void {
    this.instante.set(instante);
  }

  ngOnDestroy(): void {
    this.parar();
  }

  private async cargarMapa(recorrido: RobotTrack): Promise<void> {
    if (!recorrido.MapId || recorrido.MapVersion === null) {
      this._mapa.set({ status: 'error', message: 'El inventario no tiene plano.', details: [] });
      return;
    }
    const actual = this._mapa();
    if (actual.status === 'ready' && actual.value.MapId === recorrido.MapId && actual.value.Version === recorrido.MapVersion) return;

    this._mapa.set({ status: 'loading' });
    try {
      this._mapa.set({ status: 'ready', value: await this.api.mapa(recorrido.MapId, recorrido.MapVersion) });
    } catch (error) {
      this._mapa.set({ status: 'error', ...apiFailure(error) });
    }
  }

  private empezarSondeo(): void {
    this.pararSondeo();
    this.instante.set(null);
    this.sondeo = setInterval(() => void this.refrescar(), REFRESCO_RECORRIDO_MS);
  }

  private limpiar(): void {
    this._recorrido.set(OCIOSO);
    this._puntos.set([]);
    this.instante.set(null);
    this._refrescoFallido.set(false);
  }

  private parar(): void {
    this.pararSondeo();
    this.pausar();
  }

  private pararSondeo(): void {
    if (this.sondeo !== null) clearInterval(this.sondeo);
    this.sondeo = null;
  }

  private pararReproduccion(): void {
    if (this.reproduccion !== null) clearInterval(this.reproduccion);
    this.reproduccion = null;
  }
}

function conInstante(puntos: readonly RobotTrackPoint[]): Punto[] {
  return puntos.map((p) => ({ ...p, t: Date.parse(p.T) })).sort((a, b) => a.t - b.t);
}
