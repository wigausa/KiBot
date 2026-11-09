import { Injectable, computed, inject, signal } from '@angular/core';

import { CompanyStore } from '../../core/company/company.store';
import { apiFailure } from '../../core/http/api-error';
import { RobotApiService } from '../robot/robot-api.service';
import { WarehouseMap } from '../warehouse-map/warehouse-map.models';
import { Async } from '../warehouse-map/warehouse-map.store';
import { ZonesApiService } from '../zones/zones-api.service';
import { MapSummary } from '../zones/zones.models';
import { InventoriesApiService } from './inventories-api.service';
import { Device, Inventory } from './inventories.models';

const OCIOSO = { status: 'idle' } as const;

/** Algo que se ofrece para elegir, con el motivo si no se puede. */
export interface Elegible {
  readonly id: number | string;
  readonly nombre: string;
  readonly ocupadoPor: string | null;
}

/**
 * Los inventarios del robot de la compañía elegida: la lista, crear uno, editarlo y cerrarlo.
 *
 * <p><b>Editar</b> cambia solo el nombre y las zonas (decisión del usuario, 2026-11-06). El plano y
 * los robots se quedan: las zonas que se ofrecen son las que tienen geocerca en la versión del plano
 * que el inventario congeló, que es la que va a usar el robot.</p>
 *
 * <p><b>Solo robots.</b> El cliente no usa Witag, así que aquí no se ofrecen portales ni pistolas:
 * no habría quién los opere. Cada robot elegido va en <b>todas</b> las zonas elegidas, porque las
 * recorre todas; la zona de cada caja la decide la geocerca del rack.</p>
 *
 * <p>Lo ocupado se enseña deshabilitado con su motivo en vez de esconderlo: un plano o un robot que
 * ya están en otro inventario abierto no se pueden usar, y ver cuál los tiene es lo que dice qué
 * cerrar.</p>
 */
@Injectable()
export class InventoriesStore {
  private readonly api = inject(InventoriesApiService);
  private readonly zonasApi = inject(ZonesApiService);
  private readonly robotApi = inject(RobotApiService);
  private readonly companias = inject(CompanyStore);

  readonly companiaId = this.companias.companiaId;

  private readonly _inventarios = signal<Async<Inventory[]>>(OCIOSO);
  readonly inventarios = this._inventarios.asReadonly();
  private readonly _planos = signal<Async<MapSummary[]>>(OCIOSO);
  readonly planos = this._planos.asReadonly();
  private readonly _robots = signal<Async<Device[]>>(OCIOSO);
  readonly robotsCargados = this._robots.asReadonly();

  readonly nombre = signal('');
  readonly planoId = signal<string | null>(null);
  readonly zonasMarcadas = signal<ReadonlySet<number>>(new Set());
  readonly robotsMarcados = signal<ReadonlySet<number>>(new Set());

  private readonly _creacion = signal<Async<Inventory>>(OCIOSO);
  readonly creacion = this._creacion.asReadonly();

  // --- Editar --------------------------------------------------------------------------------
  readonly editandoId = signal<string | null>(null);
  readonly editNombre = signal('');
  /** Las zonas que tendrá, en orden: las que ya tenía primero y las nuevas detrás. */
  readonly editZonas = signal<readonly number[]>([]);
  private readonly _mapaCongelado = signal<Async<WarehouseMap>>(OCIOSO);
  readonly mapaCongelado = this._mapaCongelado.asReadonly();
  private readonly _edicion = signal<Async<Inventory>>(OCIOSO);
  readonly edicion = this._edicion.asReadonly();

  readonly confirmandoCierre = signal<string | null>(null);
  private readonly _cierre = signal<Async<string>>(OCIOSO);
  readonly cierre = this._cierre.asReadonly();

  /**
   * Los de la compañía que son del robot: un inventario es de la compañía de sus zonas, y KiBot solo
   * enseña los del robot (los de portales o pistolas son de Witag).
   *
   * <p>«Del robot» = tiene un dispositivo robot, <b>o tiene plano congelado</b>: al cerrarse, el
   * backend vacía los dispositivos de sus zonas, y el plano solo lo llevan los inventarios con robot
   * (`ValidateAndResolveMap` lo exige para el robot).</p>
   */
  private readonly deLaCompania = computed(() => {
    const l = this._inventarios();
    const c = this.companiaId();
    return l.status === 'ready' && c !== null
      ? l.value.filter((i) => (i.Zones ?? []).some((z) => z.CompanyId === c) && esDelRobot(i))
      : [];
  });

  readonly abiertos = computed(() => this.deLaCompania().filter((i) => !i.EndDate));
  readonly cerrados = computed(() =>
    this.deLaCompania()
      .filter((i) => !!i.EndDate)
      .sort((a, b) => (b.EndDate ?? '').localeCompare(a.EndDate ?? ''))
  );

  /** Planos de la compañía; uno que ya está en un inventario abierto, deshabilitado (un plano = un inventario abierto). */
  readonly planosElegibles = computed<Elegible[]>(() => {
    const p = this._planos();
    if (p.status !== 'ready') return [];
    return p.value.map((m) => ({
      id: m.MapId,
      nombre: `${m.Name} (v${m.Version})`,
      ocupadoPor: this.abiertos().find((i) => i.MapId === m.MapId)?.Name ?? null
    }));
  });

  private readonly plano = computed(() => {
    const p = this._planos();
    return p.status === 'ready' ? p.value.find((m) => m.MapId === this.planoId()) ?? null : null;
  });

  /**
   * Las zonas que se pueden inventariar con este plano: las que tienen geocerca en él. Sin
   * geocerca, el robot no sabría a qué zona va cada caja y el backend no deja crearlo.
   */
  readonly zonasElegibles = computed<Elegible[]>(() =>
    (this.plano()?.Zones ?? []).map((z) => ({
      id: z.IdZone,
      nombre: z.Name,
      ocupadoPor: this.abiertos().find((i) => (i.Zones ?? []).some((x) => x.IdZone === z.IdZone))?.Name ?? null
    }))
  );

  /** Los robots de la compañía. */
  readonly robotsElegibles = computed<Elegible[]>(() => {
    const r = this._robots();
    const c = this.companiaId();
    if (r.status !== 'ready' || c === null) return [];
    return r.value
      .filter((d) => d.tipoPuerta?.nombre?.toLowerCase() === 'robot' && d.controlador?.company?.idCompany === c)
      .map((d) => ({
        id: d.idPuerta,
        nombre: d.nombre,
        ocupadoPor: this.abiertos().find((i) => (i.Devices ?? []).some((x) => x.IdDevice === d.idPuerta))?.Name ?? null
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  /** El inventario que se edita. */
  readonly editado = computed(() => {
    const l = this._inventarios();
    return l.status === 'ready' ? l.value.find((i) => i._id === this.editandoId()) ?? null : null;
  });

  /**
   * Las zonas que puede tener: las que tienen geocerca en la versión CONGELADA de su plano. Una
   * dibujada después no se ofrece: el backend la rechazaría, porque el robot usa esa versión.
   */
  readonly zonasEditables = computed<Elegible[]>(() => {
    const m = this._mapaCongelado();
    const inv = this.editado();
    if (m.status !== 'ready' || inv === null) return [];
    return (m.value.Zones ?? []).filter((z) => (z.Points ?? []).length >= 2).map((z) => ({
      id: z.IdZone,
      nombre: z.Name,
      ocupadoPor:
        this.abiertos().find((i) => i._id !== inv._id && (i.Zones ?? []).some((x) => x.IdZone === z.IdZone))
          ?.Name ?? null
    }));
  });

  /** Las zonas que ya tenía y ya no están en el plano congelado (raro): se enseñan para poder quitarlas. */
  readonly zonasHuerfanas = computed(() => {
    const inv = this.editado();
    const editables = new Set(this.zonasEditables().map((z) => z.id));
    return (inv?.Zones ?? []).filter((z) => !editables.has(z.IdZone));
  });

  readonly hayCambios = computed(() => {
    const inv = this.editado();
    if (inv === null) return false;
    const antes = (inv.Zones ?? []).map((z) => z.IdZone);
    const ahora = this.editZonas();
    return (
      this.editNombre().trim() !== inv.Name ||
      antes.length !== ahora.length ||
      antes.some((id, i) => ahora[i] !== id)
    );
  });

  readonly puedeGuardarEdicion = computed(
    () =>
      this.editado() !== null &&
      this.editNombre().trim() !== '' &&
      this.editZonas().length > 0 &&
      this.hayCambios() &&
      this._edicion().status !== 'loading'
  );

  readonly puedeCrear = computed(
    () =>
      this.nombre().trim() !== '' &&
      this.plano() !== null &&
      this.zonasMarcadas().size > 0 &&
      this.robotsMarcados().size > 0 &&
      this._creacion().status !== 'loading'
  );

  async cargar(): Promise<void> {
    this.limpiar();
    this._cierre.set(OCIOSO);
    this.confirmandoCierre.set(null);

    const compania = this.companiaId();
    if (compania === null) {
      this._planos.set(OCIOSO);
      return;
    }

    await Promise.all([this.cargarInventarios(), this.cargarPlanos(compania), this.cargarRobots()]);
  }

  private async cargarInventarios(): Promise<void> {
    this._inventarios.set({ status: 'loading' });
    try {
      this._inventarios.set({ status: 'ready', value: await this.api.inventarios() });
    } catch (error) {
      this._inventarios.set({ status: 'error', ...apiFailure(error) });
    }
  }

  private async cargarPlanos(compania: number): Promise<void> {
    this._planos.set({ status: 'loading' });
    try {
      const planos = await this.zonasApi.planosDeCompania(compania);
      if (this.companiaId() === compania) this._planos.set({ status: 'ready', value: planos });
    } catch (error) {
      this._planos.set({ status: 'error', ...apiFailure(error) });
    }
  }

  private async cargarRobots(): Promise<void> {
    this._robots.set({ status: 'loading' });
    try {
      this._robots.set({ status: 'ready', value: await this.api.dispositivos() });
    } catch (error) {
      this._robots.set({ status: 'error', ...apiFailure(error) });
    }
  }

  elegirPlano(id: string | null): void {
    this.planoId.set(id);
    // Las zonas dependen del plano: las de otro no valen.
    this.zonasMarcadas.set(new Set());
  }

  alternarZona(id: number): void {
    this.zonasMarcadas.set(alternar(this.zonasMarcadas(), id));
  }

  /** Desde el multiselect: la selección entera de una vez. */
  fijarZonas(ids: readonly number[]): void {
    this.zonasMarcadas.set(new Set(ids));
  }

  fijarRobots(ids: readonly number[]): void {
    this.robotsMarcados.set(new Set(ids));
  }

  fijarZonasEditadas(ids: readonly number[]): void {
    this.editZonas.set([...ids]);
  }

  alternarRobot(id: number): void {
    this.robotsMarcados.set(alternar(this.robotsMarcados(), id));
  }

  limpiar(): void {
    this.nombre.set('');
    this.planoId.set(null);
    this.zonasMarcadas.set(new Set());
    this.robotsMarcados.set(new Set());
    this._creacion.set(OCIOSO);
  }

  /** Crea el inventario: cada robot elegido en cada zona elegida. */
  async crear(): Promise<void> {
    const plano = this.plano();
    if (!this.puedeCrear() || plano === null) return;

    const robots = [...this.robotsMarcados()].sort((a, b) => a - b);
    const zonas = plano.Zones.filter((z) => this.zonasMarcadas().has(z.IdZone)).map((z) => ({
      IdZone: z.IdZone,
      Name: z.Name,
      Devices: robots
    }));

    this._creacion.set({ status: 'loading' });
    try {
      const creado = await this.api.crear({ Name: this.nombre().trim(), MapId: plano.MapId, Zones: zonas });
      this.limpiar();
      this._creacion.set({ status: 'ready', value: creado });
      await this.cargarInventarios();
    } catch (error) {
      this._creacion.set({ status: 'error', ...apiFailure(error) });
    }
  }

  /** Abre la edición de un inventario abierto y trae la versión de su plano que congeló. */
  async abrirEdicion(inventario: Inventory): Promise<void> {
    this.editandoId.set(inventario._id);
    this.editNombre.set(inventario.Name);
    this.editZonas.set((inventario.Zones ?? []).map((z) => z.IdZone));
    this._edicion.set(OCIOSO);

    if (!inventario.MapId || inventario.MapVersion === null || inventario.MapVersion === undefined) {
      this._mapaCongelado.set({ status: 'error', message: 'Este inventario no tiene plano: no se le pueden cambiar las zonas.', details: [] });
      return;
    }
    this._mapaCongelado.set({ status: 'loading' });
    try {
      const mapa = await this.robotApi.mapa(inventario.MapId, inventario.MapVersion);
      if (this.editandoId() === inventario._id) this._mapaCongelado.set({ status: 'ready', value: mapa });
    } catch (error) {
      this._mapaCongelado.set({ status: 'error', ...apiFailure(error) });
    }
  }

  cerrarEdicion(): void {
    this.editandoId.set(null);
    this._mapaCongelado.set(OCIOSO);
    this._edicion.set(OCIOSO);
  }

  /** Marcar la añade al final; desmarcarla la quita. */
  alternarZonaEditada(id: number): void {
    const actuales = this.editZonas();
    this.editZonas.set(actuales.includes(id) ? actuales.filter((z) => z !== id) : [...actuales, id]);
  }

  /** Guarda el nombre y las zonas. Devuelve si salió bien (para cerrar el panel). */
  async guardarEdicion(): Promise<boolean> {
    const inv = this.editado();
    if (!this.puedeGuardarEdicion() || inv === null) return false;

    this._edicion.set({ status: 'loading' });
    try {
      const editado = await this.api.editar(inv._id, {
        Name: this.editNombre().trim(),
        Zones: [...this.editZonas()]
      });
      this._edicion.set({ status: 'ready', value: editado });
      await this.cargarInventarios();
      return true;
    } catch (error) {
      this._edicion.set({ status: 'error', ...apiFailure(error) });
      return false;
    }
  }

  /** Cierra ya, sin el doble paso: quien llama ya preguntó (el diálogo de confirmación). */
  async cerrarYa(inventario: Inventory): Promise<void> {
    this.confirmandoCierre.set(inventario._id);
    await this.cerrar(inventario);
  }

  /** Cerrar pide confirmación: un inventario cerrado no se reabre. */
  async cerrar(inventario: Inventory): Promise<void> {
    if (this.confirmandoCierre() !== inventario._id) {
      this.confirmandoCierre.set(inventario._id);
      return;
    }

    this._cierre.set({ status: 'loading' });
    try {
      await this.api.cerrar(inventario._id);
      this.confirmandoCierre.set(null);
      this._cierre.set({ status: 'ready', value: `«${inventario.Name}» cerrado.` });
      await this.cargarInventarios();
    } catch (error) {
      this._cierre.set({ status: 'error', ...apiFailure(error) });
    }
  }
}

/** Lleva un robot, o (cerrado, ya sin dispositivos) un plano congelado, que solo tienen los del robot. */
export function esDelRobot(i: Inventory): boolean {
  return (i.Devices ?? []).some((d) => d.Type?.toLowerCase() === 'robot') || !!i.MapId;
}

function alternar<T>(conjunto: ReadonlySet<T>, valor: T): ReadonlySet<T> {
  const nuevo = new Set(conjunto);
  if (nuevo.has(valor)) nuevo.delete(valor);
  else nuevo.add(valor);
  return nuevo;
}
