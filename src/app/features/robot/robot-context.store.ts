import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';

import { apiFailure } from '../../core/http/api-error';
import { Async } from '../warehouse-map/warehouse-map.store';
import { RobotApiService } from './robot-api.service';
import { RobotBatchView, RobotInventory, RobotProgress, RobotStatusView, avanceDe } from './robot.models';

const CLAVE_INVENTARIO = 'kibot.contexto.inventario';
const CLAVE_ROBOT = 'kibot.contexto.robot';
const CLAVE_ZONA = 'kibot.contexto.zona';

/** Cada cuánto se mira la tanda con un recorrido en marcha, y cada cuánto sin él. */
export const VIGILANCIA_EN_MARCHA_MS = 5000;
export const VIGILANCIA_EN_REPOSO_MS = 30000;

/**
 * Qué inventario y qué robot se están mirando, para TODA la aplicación.
 *
 * <p>Antes cada pantalla del robot (Control, Buscar, Ubicación, Recorrido) tenía su propio selector y
 * el encargado elegía lo mismo cuatro veces. Ahora se elige una vez: aquí, recordado en el navegador,
 * y elegido solo cuando hay uno.</p>
 *
 * <p>También <b>vigila la tanda</b> del robot elegido para el mini-reproductor y el Inicio: cada 5 s
 * mientras anda, cada 30 s en reposo. Control tiene su propio sondeo, más fino; mientras está abierta,
 * esta vigilancia se suspende ({@link suspenderVigilancia}) para no pedir lo mismo dos veces.</p>
 */
@Injectable({ providedIn: 'root' })
export class RobotContextStore implements OnDestroy {
  private readonly api = inject(RobotApiService);

  private readonly _inventarios = signal<Async<RobotInventory[]>>({ status: 'idle' });
  private readonly _tanda = signal<RobotBatchView | null>(null);
  private readonly _progreso = signal<RobotProgress | null>(null);
  private readonly _latido = signal<RobotStatusView | null>(null);

  readonly inventarios = this._inventarios.asReadonly();
  readonly tanda = this._tanda.asReadonly();
  readonly progreso = this._progreso.asReadonly();
  readonly latido = this._latido.asReadonly();

  readonly inventarioId = signal<string | null>(leer(CLAVE_INVENTARIO));
  readonly robotId = signal<number | null>(numeroDe(leer(CLAVE_ROBOT)));
  /** La zona que se mira en Control y en la que se busca en Buscar. Nula: ninguna (en Control, «General»). */
  readonly zonaId = signal<number | null>(numeroDe(leer(CLAVE_ZONA)));

  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private suspendidas = 0;

  /** Todos los inventarios: primero los abiertos, después los cerrados (estos solo para mirar). */
  readonly lista = computed(() => {
    const l = this._inventarios();
    return l.status === 'ready' ? l.value : [];
  });
  readonly abiertos = computed(() => this.lista().filter((i) => !i.EndDate));
  readonly cerrados = computed(() => this.lista().filter((i) => !!i.EndDate));

  readonly inventario = computed(() => this.lista().find((i) => i._id === this.inventarioId()) ?? null);
  readonly abierto = computed(() => {
    const i = this.inventario();
    return i !== null && !i.EndDate;
  });

  /** Los robots del inventario elegido (las puertas y pistolas no recorren). */
  readonly robots = computed(() => robotsDelInventario(this.inventario()));
  readonly robot = computed(() => this.robots().find((r) => r.IdDevice === this.robotId()) ?? null);

  /** Las zonas del inventario elegido, en su orden. */
  readonly zonas = computed(() => this.inventario()?.Zones ?? []);
  readonly zona = computed(() => this.zonas().find((z) => z.IdZone === this.zonaId()) ?? null);

  /** La tanda en marcha, si la hay: es lo que enciende el mini-reproductor. */
  readonly enMarcha = computed(() => {
    const t = this._tanda();
    return t?.Status === 'Running' ? t : null;
  });

  readonly avance = computed(() => avanceDe(this._progreso()));

  /** «Zona 2 de 3 · Pasillos norte». */
  readonly zonaEnCurso = computed(() => {
    const t = this.enMarcha();
    const zona = t?.Zones[t.Current];
    return t && zona ? { numero: t.Current + 1, total: t.Zones.length, nombre: zona.Name } : null;
  });

  /** En pausa según el latido, solo si la misión es la de la zona en curso. */
  readonly enPausa = computed(() => {
    const t = this.enMarcha();
    const m = this._latido()?.Status?.Mission ?? null;
    return !!t && !!m && t.CurrentRunId !== null && m.RunId === t.CurrentRunId && m.Status === 'PAUSED';
  });

  /** Carga los inventarios (una vez; `forzar` para releerlos) y rehace la elección guardada. */
  async cargar(forzar = false): Promise<void> {
    const actual = this._inventarios().status;
    if (!forzar && (actual === 'ready' || actual === 'loading')) return;
    this._inventarios.set({ status: 'loading' });
    try {
      const todos = await this.api.inventarios();
      // Abiertos primero; dentro de cada grupo, como vienen.
      const ordenados = [...todos.filter((i) => !i.EndDate), ...todos.filter((i) => !!i.EndDate)];
      this._inventarios.set({ status: 'ready', value: ordenados });
      this.reconciliar();
    } catch (error) {
      this._inventarios.set({ status: 'error', ...apiFailure(error) });
    }
  }

  elegirInventario(id: string | null): void {
    if (id === this.inventarioId()) return;
    this.inventarioId.set(id);
    guardar(CLAVE_INVENTARIO, id);
    // Las zonas son de cada inventario: la de otro no vale. Con una sola, esa.
    const zonas = this.zonas();
    this.elegirZona(zonas.length === 1 ? zonas[0].IdZone : null);
    const robots = robotsDelInventario(this.inventario());
    this.fijarRobot(robots.length === 1 ? robots[0].IdDevice : null);
  }

  elegirZona(id: number | null): void {
    this.zonaId.set(id);
    guardar(CLAVE_ZONA, id === null ? null : String(id));
  }

  elegirRobot(id: number | null): void {
    if (id === this.robotId()) return;
    this.fijarRobot(id);
  }

  /** Control tiene su propio sondeo: mientras está abierta, este calla. */
  suspenderVigilancia(): void {
    this.suspendidas++;
    this.pararVigilancia();
  }

  reanudarVigilancia(): void {
    this.suspendidas = Math.max(0, this.suspendidas - 1);
    if (this.suspendidas === 0) void this.vigilar();
  }

  /** Lo que Control ya trajo: así el mini-reproductor sale al día al salir de Control. */
  informar(tanda: RobotBatchView | null, progreso: RobotProgress | null, latido: RobotStatusView | null): void {
    this._tanda.set(tanda);
    this._progreso.set(progreso);
    this._latido.set(latido);
  }

  /** Mira la tanda ahora (tras una orden del mini-reproductor) y sigue vigilando. */
  async vigilar(): Promise<void> {
    this.pararVigilancia();
    const inv = this.inventarioId();
    const robot = this.robotId();
    if (inv === null || robot === null || !this.abierto()) {
      this.informar(null, null, null);
      return;
    }
    try {
      const [tanda, progreso, latido] = await Promise.all([
        this.api.tanda(inv, robot),
        this.api.progreso(inv).catch(() => null),
        this.api.estado(robot).catch(() => null)
      ]);
      // Si mientras tanto se eligió otra cosa, esta respuesta ya no es de lo que se mira.
      if (inv !== this.inventarioId() || robot !== this.robotId()) return;
      this.informar(tanda, progreso, latido);
    } catch {
      // Un fallo de red no apaga la vigilancia: lo intenta en la siguiente vuelta.
    }
    this.programar();
  }

  ngOnDestroy(): void {
    this.pararVigilancia();
  }

  private fijarRobot(id: number | null): void {
    this.robotId.set(id);
    guardar(CLAVE_ROBOT, id === null ? null : String(id));
    this.informar(null, null, null);
    if (this.suspendidas === 0) void this.vigilar();
  }

  /** Tras cargar: la elección guardada solo vale si sigue existiendo; si hay uno solo, ese. */
  private reconciliar(): void {
    const lista = this.lista();
    if (!lista.some((i) => i._id === this.inventarioId())) {
      const abiertos = this.abiertos();
      this.inventarioId.set(abiertos.length === 1 ? abiertos[0]._id : null);
      guardar(CLAVE_INVENTARIO, this.inventarioId());
    }
    if (this.zonaId() !== null && !this.zonas().some((z) => z.IdZone === this.zonaId())) {
      const zonas = this.zonas();
      this.elegirZona(zonas.length === 1 ? zonas[0].IdZone : null);
    }
    const robots = this.robots();
    if (!robots.some((r) => r.IdDevice === this.robotId())) {
      this.robotId.set(robots.length === 1 ? robots[0].IdDevice : null);
      guardar(CLAVE_ROBOT, this.robotId() === null ? null : String(this.robotId()));
    }
    if (this.suspendidas === 0) void this.vigilar();
  }

  private programar(): void {
    if (this.suspendidas > 0) return;
    const espera = this.enMarcha() ? VIGILANCIA_EN_MARCHA_MS : VIGILANCIA_EN_REPOSO_MS;
    this.temporizador = setTimeout(() => void this.vigilar(), espera);
  }

  private pararVigilancia(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
  }
}

/** Los robots de un inventario, uno por id. */
export function robotsDelInventario(inventario: RobotInventory | null): { IdDevice: number; Name: string }[] {
  const vistos = new Map<number, string>();
  for (const d of inventario?.Devices ?? []) {
    if (d.Type?.toLowerCase() === 'robot' && !vistos.has(d.IdDevice)) vistos.set(d.IdDevice, d.Name);
  }
  return [...vistos].map(([IdDevice, Name]) => ({ IdDevice, Name }));
}

// localStorage puede no estar (modo privado, pruebas): nunca debe tumbar la pantalla.
function leer(clave: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento la elección dura lo que dure la pestaña.
  }
}

function numeroDe(texto: string | null): number | null {
  if (texto === null) return null;
  const n = Number(texto);
  return Number.isFinite(n) ? n : null;
}
