import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';

import { CompanyStore } from '../../core/company/company.store';
import { apiFailure } from '../../core/http/api-error';
import { InventoriesApiService } from '../inventories/inventories-api.service';
import { Device } from '../inventories/inventories.models';
import { FalloDeOrden, RobotApiService, falloDeOrden } from '../robot/robot-api.service';
import {
  RobotSearch,
  RobotSearchFound,
  RobotStatusView,
  RobotTrack,
  codigosDe,
  esCodigoValido,
  ladoTexto,
  nivelDeConfianza,
  pasilloTexto,
  textoDeConfianza,
  tramoTexto
} from '../robot/robot.models';
import { MarcadorEnElPlano, PuntoDelRecorrido, RobotEnElPlano, ZonaPintada, zonasPintadasDe } from '../warehouse-map/plan-canvas/plan-canvas';
import { WarehouseMap } from '../warehouse-map/warehouse-map.models';
import { Async } from '../warehouse-map/warehouse-map.store';
import { ZonesApiService } from '../zones/zones-api.service';
import { MapSummary } from '../zones/zones.models';

const OCIOSO = { status: 'idle' } as const;

/** Cada cuánto se mira cómo va la búsqueda. El robot manda lecturas cada pocos segundos. */
export const REFRESCO_BUSQUEDA_MS = 3000;

/** Lo que pasa al mandar la búsqueda o una orden: como `Async`, pero el fallo lleva el motivo del robot. */
export type EstadoDeEnvio =
  | { status: 'idle' }
  | { status: 'loading' }
  | ({ status: 'error' } & FalloDeOrden)
  | { status: 'ready' };

/** Una fila de la tabla de resultados. */
export interface FilaDeResultado {
  readonly numero: number | null;
  readonly codigo: string;
  readonly epc: string;
  readonly estado: 'Encontrada' | 'Ambigua' | 'Buscando' | 'No encontrada';
  readonly pasillo: string;
  readonly lado: string;
  readonly tramo: string;
  readonly segmento: string;
  readonly estanteria: string;
  readonly lecturas: number | null;
  readonly senal: string;
  readonly confianza: string;
  readonly nivel: 'alta' | 'media' | 'baja' | null;
  readonly visto: string | null;
}

/**
 * Por qué el robot no puede salir ahora, según su último latido. La misma regla que valida el
 * backend (`RobotSearch.MotivoParaNoSalir`): aquí solo es para avisar antes de pulsar.
 */
export function motivoParaNoSalir(estado: RobotStatusView | null): string | null {
  if (!estado) return 'El robot no ha mandado ningún latido.';
  if (estado.Signal === 'NO_SIGNAL') return 'El robot no da señal.';
  const s = estado.Status;
  const e = (s.State ?? '').toUpperCase();
  if (e === 'ESTOP' || s.Chassis?.EmergencyStop) return 'El robot tiene la parada de emergencia puesta.';
  if (e === 'ERROR') return 'El robot está en error.';
  if (e === 'CHARGING') return 'El robot está cargando.';
  const m = s.Mission;
  if (m && (m.Status ?? '').toUpperCase() !== 'FINISHED' && (m.Status || m.RunId)) return 'El robot está en otra misión.';
  return null;
}

/**
 * «Buscar con el robot»: mandarlo a buscar unas cajas en UNA zona de un plano y ver, en vivo, cuáles
 * encuentra.
 *
 * <p><b>No pertenece a ningún inventario.</b> Se elige el plano, la zona y el robot; sus lecturas se
 * guardan aparte y no tocan ningún inventario ni snapshot. Lo encontrado lo calcula el backend; aquí
 * solo se mira. Al terminar se enseña el plano con una marca por caja y la tabla.</p>
 */
@Injectable()
export class RobotSearchStore implements OnDestroy {
  private readonly api = inject(RobotApiService);
  private readonly zonasApi = inject(ZonesApiService);
  private readonly inventariosApi = inject(InventoriesApiService);
  private readonly compania = inject(CompanyStore);

  private readonly _planos = signal<Async<MapSummary[]>>(OCIOSO);
  private readonly _dispositivos = signal<Async<Device[]>>(OCIOSO);
  private readonly _estadoRobot = signal<Async<RobotStatusView | null>>(OCIOSO);
  private readonly _busqueda = signal<RobotSearch | null>(null);
  private readonly _envio = signal<EstadoDeEnvio>(OCIOSO);
  private readonly _mapa = signal<Async<WarehouseMap>>(OCIOSO);
  private readonly _recorrido = signal<RobotTrack | null>(null);

  readonly planos = this._planos.asReadonly();
  readonly estadoRobot = this._estadoRobot.asReadonly();
  readonly busqueda = this._busqueda.asReadonly();
  readonly envio = this._envio.asReadonly();
  readonly mapa = this._mapa.asReadonly();

  readonly planoId = signal<string | null>(null);
  readonly zonaId = signal<number | null>(null);
  readonly robotId = signal<number | null>(null);
  readonly texto = signal('');
  /** La fila elegida en la tabla (su número), para destacar su marca. */
  readonly elegida = signal<number | null>(null);

  private temporizador: ReturnType<typeof setInterval> | null = null;

  readonly plano = computed(() => {
    const p = this._planos();
    return p.status === 'ready' ? p.value.find((m) => m.MapId === this.planoId()) ?? null : null;
  });

  readonly zonas = computed(() => this.plano()?.Zones ?? []);

  /** Los robots de la compañía elegida. */
  readonly robots = computed(() => {
    const d = this._dispositivos();
    const c = this.compania.companiaId();
    if (d.status !== 'ready') return [];
    return d.value
      .filter((x) => x.tipoPuerta?.nombre?.toLowerCase() === 'robot' && (c === null || x.controlador?.company?.idCompany === c))
      .map((x) => ({ id: x.idPuerta, nombre: x.nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  readonly codigos = computed(() => codigosDe(this.texto()));
  readonly invalidos = computed(() => this.codigos().filter((c) => !esCodigoValido(c)));

  readonly enMarcha = computed(() => this._busqueda()?.Status === 'Running');
  readonly terminada = computed(() => {
    const b = this._busqueda();
    return b !== null && b.Status !== 'Running';
  });
  readonly ocupado = computed(() => this._envio().status === 'loading');

  /** Por qué el robot elegido no puede salir ahora; nulo si puede (o si todavía no se sabe). */
  readonly motivoDelRobot = computed(() => {
    const e = this._estadoRobot();
    return e.status === 'ready' ? motivoParaNoSalir(e.value) : null;
  });

  readonly puedeBuscar = computed(
    () =>
      this.planoId() !== null &&
      this.zonaId() !== null &&
      this.robotId() !== null &&
      this._estadoRobot().status === 'ready' &&
      this.motivoDelRobot() === null &&
      this.codigos().length > 0 &&
      this.invalidos().length === 0 &&
      !this.enMarcha() &&
      !this.ocupado()
  );

  /** Lo que falta para poder buscar, en una frase; nulo si se puede. */
  readonly faltaParaBuscar = computed(() => {
    if (this.enMarcha()) return null;
    if (this.planoId() === null) return 'Elige un plano.';
    if (this.zonaId() === null) return 'Elige la zona donde buscar.';
    if (this.robotId() === null) return 'Elige el robot.';
    if (this._estadoRobot().status === 'loading') return 'Comprobando el robot…';
    if (this.motivoDelRobot()) return this.motivoDelRobot();
    if (this.codigos().length === 0) return 'Escribe al menos un código.';
    if (this.invalidos().length > 0) return 'Hay códigos que no son ni un USDA ni un EPC.';
    return null;
  });

  // --- avance ------------------------------------------------------------------------------

  readonly tramosHechos = computed(() => this._busqueda()?.TramosDone ?? 0);
  readonly tramosTotales = computed(() => this._busqueda()?.TramosTotal ?? null);

  /** El avance del recorrido de la zona, 0–100. Terminada con todo encontrado, 100. */
  readonly avanceDelRecorrido = computed(() => {
    const b = this._busqueda();
    if (!b) return 0;
    if (b.Status === 'Done') return 100;
    const total = this.tramosTotales();
    if (!total) return 0;
    return Math.min(100, Math.round((this.tramosHechos() / total) * 100));
  });

  readonly avanceDeCajas = computed(() => {
    const b = this._busqueda();
    return b && b.Total > 0 ? Math.round((b.Found.length / b.Total) * 100) : 0;
  });

  /** Lo que se le dice al operador del estado de la búsqueda. */
  readonly textoDeAvance = computed(() => {
    const b = this._busqueda();
    if (!b) return '';
    if (b.Status === 'Rejected') return 'Rechazada';
    if (b.Status === 'Stopped') return 'Detenida';
    if (b.Status === 'Done') return b.Missing.length === 0 ? 'Todo encontrado' : 'Terminada';
    if (b.Total > 0 && b.Found.length === b.Total) return 'Todo encontrado · el robot vuelve al dock';
    const ack = b.Ack?.Status;
    if (!ack || ack === 'PENDING') return 'Arrancando';
    return 'Buscando';
  });

  // --- resultado: plano y tabla --------------------------------------------------------------

  /** Las encontradas en el orden de la tabla, numeradas desde 1: el número es el de la marca. */
  private readonly encontradas = computed<readonly RobotSearchFound[]>(() => this._busqueda()?.Found ?? []);

  readonly filas = computed<readonly FilaDeResultado[]>(() => {
    const b = this._busqueda();
    if (!b) return [];
    const encontradas = this.encontradas().map((f, i): FilaDeResultado => ({
      numero: i + 1,
      codigo: f.Code,
      epc: f.Epc,
      estado: f.Status === 'Ambiguous' ? 'Ambigua' : 'Encontrada',
      pasillo: pasilloTexto(f.AisleNumber, f.AisleId),
      lado: ladoTexto(f.RackSide),
      tramo: tramoTexto(f.Tramo),
      segmento: f.Segment !== null ? String(f.Segment) : '—',
      estanteria: f.RackId ?? '—',
      lecturas: f.Readings,
      senal: `${Math.round(f.MeanRssi)} dBm`,
      confianza: textoDeConfianza(f),
      nivel: nivelDeConfianza(f),
      visto: f.LastSeenAt
    }));
    const faltan = b.Missing.map((m): FilaDeResultado => ({
      numero: null,
      codigo: m.Code,
      epc: m.Epc,
      estado: b.Status === 'Running' ? 'Buscando' : 'No encontrada',
      pasillo: '—',
      lado: '—',
      tramo: '—',
      segmento: '—',
      estanteria: '—',
      lecturas: null,
      senal: '—',
      confianza: '—',
      nivel: null,
      visto: null
    }));
    return [...encontradas, ...faltan];
  });

  readonly resumen = computed(() => {
    const b = this._busqueda();
    if (!b) return null;
    const ambiguas = b.Found.filter((f) => f.Status === 'Ambiguous').length;
    return { encontradas: b.Found.length - ambiguas, ambiguas, faltan: b.Missing.length, total: b.Total };
  });

  /** Una marca por caja situada, con el número de su fila y el color de su confianza. */
  readonly marcadores = computed<readonly MarcadorEnElPlano[]>(() =>
    this.encontradas().flatMap((f, i) =>
      f.RackId && f.RackSide
        ? [{ rackId: f.RackId, side: f.RackSide, etiqueta: String(i + 1), tono: nivelDeConfianza(f), activo: this.elegida() === i + 1 }]
        : []
    )
  );

  /** La zona de la búsqueda, pintada. */
  readonly zonaPintada = computed<readonly ZonaPintada[]>(() => {
    const m = this._mapa();
    const id = this._busqueda()?.IdZone ?? this.zonaId();
    if (m.status !== 'ready' || id === null) return [];
    return zonasPintadasDe(m.value).filter((z) => z.idZone === id);
  });

  readonly ruta = computed<readonly PuntoDelRecorrido[]>(() =>
    (this._recorrido()?.Points ?? []).map((p) => ({ x: p.X, y: p.Y }))
  );

  readonly robot = computed<RobotEnElPlano | null>(() => {
    const ultimo = this._recorrido()?.Points.at(-1);
    return ultimo && this.enMarcha() ? { x: ultimo.X, y: ultimo.Y, heading: ultimo.Heading } : null;
  });

  // --- acciones ------------------------------------------------------------------------------

  async cargar(): Promise<void> {
    await Promise.all([this.cargarPlanos(), this.cargarRobots()]);
  }

  /** La compañía cambió (o llegó después de abrir la pantalla): sus planos son otros. */
  async alCambiarDeCompania(): Promise<void> {
    if (this.enMarcha()) return;
    this.elegirPlano(null);
    await this.cargarPlanos();
  }

  /** Viene de Buscar caja: plano, zona y código ya puestos. */
  prellenar(mapId: string | null, zona: number | null, codigo: string | null): void {
    if (mapId && this.planoActual(mapId)) this.elegirPlano(mapId);
    if (zona !== null && this.zonas().some((z) => z.IdZone === zona)) this.elegirZona(zona);
    if (codigo) this.texto.set(codigo.trim().toUpperCase());
  }

  elegirPlano(id: string | null): void {
    if (this.enMarcha()) return;
    this.limpiarResultado();
    this.planoId.set(id);
    this.zonaId.set(null);
    const zonas = this.zonas();
    if (zonas.length === 1) this.zonaId.set(zonas[0].IdZone);
    void this.cargarPlanoVigente();
  }

  elegirZona(id: number | null): void {
    if (this.enMarcha()) return;
    this.zonaId.set(id);
  }

  async elegirRobot(id: number | null): Promise<void> {
    if (this.enMarcha()) return;
    this.robotId.set(id);
    this._estadoRobot.set(OCIOSO);
    if (id === null) return;
    this._estadoRobot.set({ status: 'loading' });
    try {
      const estado = await this.api.estado(id);
      if (this.robotId() === id) this._estadoRobot.set({ status: 'ready', value: estado });
    } catch (error) {
      if (this.robotId() === id) this._estadoRobot.set({ status: 'error', ...apiFailure(error) });
    }
  }

  async buscar(): Promise<void> {
    const mapa = this.planoId();
    const zona = this.zonaId();
    const robot = this.robotId();
    if (!this.puedeBuscar() || mapa === null || zona === null || robot === null) return;

    this._envio.set({ status: 'loading' });
    this.elegida.set(null);
    try {
      const busqueda = await this.api.iniciarBusqueda(robot, mapa, zona, this.codigos());
      this._busqueda.set(busqueda);
      this._recorrido.set(null);
      this._envio.set({ status: 'ready' });
      void this.cargarMapaDeLaBusqueda(busqueda);
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
    const actual = this._busqueda();
    if (actual === null) return;
    try {
      const [busqueda, recorrido] = await Promise.all([
        this.api.busqueda(actual.SearchId),
        this.api.recorridoDeBusqueda(actual.SearchId).catch(() => null)
      ]);
      if (this._busqueda()?.SearchId !== actual.SearchId) return;
      this._busqueda.set(busqueda);
      if (recorrido) this._recorrido.set(recorrido);
      if (busqueda.Status !== 'Running') this.parar();
    } catch {
      // Un refresco fallido no borra lo que ya se ve: el siguiente lo vuelve a intentar.
    }
  }

  pausar(): Promise<void> {
    return this.orden('pause');
  }

  reanudar(): Promise<void> {
    return this.orden('resume');
  }

  cancelar(): Promise<void> {
    return this.orden('cancel');
  }

  volverAlDock(): Promise<void> {
    return this.orden('rth');
  }

  /** Empezar otra: deja el formulario como estaba y quita el resultado. */
  nueva(): void {
    if (this.enMarcha()) return;
    this.limpiarResultado();
    void this.elegirRobot(this.robotId());
  }

  /** El resultado como CSV (separado por `;`, como lo abre Excel en español). */
  csv(): string {
    const cabecera = ['N.º', 'Código', 'EPC', 'Estado', 'Pasillo', 'Lado', 'Tramo', 'Segmento', 'Estantería', 'Lecturas', 'Señal', 'Confianza', 'Visto'];
    const celda = (v: string | number | null) => {
      const t = v === null ? '' : String(v);
      return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const filas = this.filas().map((f) =>
      [f.numero, f.codigo, f.epc, f.estado, f.pasillo, f.lado, f.tramo, f.segmento, f.estanteria, f.lecturas, f.senal, f.confianza, f.visto]
        .map(celda)
        .join(';')
    );
    return [cabecera.join(';'), ...filas].join('\r\n');
  }

  ngOnDestroy(): void {
    this.parar();
  }

  private planoActual(mapId: string): MapSummary | null {
    const p = this._planos();
    return p.status === 'ready' ? p.value.find((m) => m.MapId === mapId) ?? null : null;
  }

  private limpiarResultado(): void {
    this.parar();
    this._busqueda.set(null);
    this._recorrido.set(null);
    this._envio.set(OCIOSO);
    this.elegida.set(null);
  }

  private async orden(accion: 'pause' | 'resume' | 'cancel' | 'rth'): Promise<void> {
    const b = this._busqueda();
    if (b === null || !this.enMarcha() || this.ocupado()) return;
    this._envio.set({ status: 'loading' });
    try {
      await this.api.ordenDeBusqueda(b.SearchId, accion);
      this._envio.set({ status: 'ready' });
    } catch (error) {
      this._envio.set({ status: 'error', ...falloDeOrden(error) });
    }
    await this.refrescar();
  }

  private async cargarPlanos(): Promise<void> {
    const compania = this.compania.companiaId();
    if (compania === null) {
      this._planos.set({ status: 'ready', value: [] });
      return;
    }
    this._planos.set({ status: 'loading' });
    try {
      this._planos.set({ status: 'ready', value: await this.zonasApi.planosDeCompania(compania) });
    } catch (error) {
      this._planos.set({ status: 'error', ...apiFailure(error) });
    }
  }

  private async cargarRobots(): Promise<void> {
    this._dispositivos.set({ status: 'loading' });
    try {
      const lista = await this.inventariosApi.dispositivos();
      this._dispositivos.set({ status: 'ready', value: lista });
      const robots = this.robots();
      if (robots.length === 1 && this.robotId() === null) void this.elegirRobot(robots[0].id);
    } catch (error) {
      this._dispositivos.set({ status: 'error', ...apiFailure(error) });
    }
  }

  /** El plano vigente, para enseñar la zona antes de buscar. */
  private async cargarPlanoVigente(): Promise<void> {
    const id = this.planoId();
    if (id === null) {
      this._mapa.set(OCIOSO);
      return;
    }
    this._mapa.set({ status: 'loading' });
    try {
      const mapa = await this.zonasApi.planoVigente(id);
      if (this.planoId() === id) this._mapa.set({ status: 'ready', value: mapa });
    } catch (error) {
      this._mapa.set({ status: 'error', ...apiFailure(error) });
    }
  }

  /** La versión con la que salió la búsqueda: lo encontrado se sitúa en ella. */
  private async cargarMapaDeLaBusqueda(b: RobotSearch): Promise<void> {
    if (!b.MapId || b.MapVersion === null || b.MapVersion === undefined) return;
    const actual = this._mapa();
    if (actual.status === 'ready' && actual.value.MapId === b.MapId && actual.value.Version === b.MapVersion) return;
    try {
      const mapa = await this.api.mapa(b.MapId, b.MapVersion);
      if (this._busqueda()?.SearchId === b.SearchId) this._mapa.set({ status: 'ready', value: mapa });
    } catch {
      // Se queda el plano vigente: casi siempre es el mismo.
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
