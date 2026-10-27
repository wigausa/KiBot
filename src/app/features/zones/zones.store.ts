import { Injectable, computed, inject, signal } from '@angular/core';

import { CompanyStore } from '../../core/company/company.store';
import { apiFailure } from '../../core/http/api-error';
import { WarehouseMap, WarehouseMapZone } from '../warehouse-map/warehouse-map.models';
import { Async } from '../warehouse-map/warehouse-map.store';
import {
  Ancla,
  anclasDeLaGeocerca,
  anclasDelMapa,
  carasDentro,
  conQuienSePisa,
  GEOCERCA_INVALIDA,
  geocercaEntre,
  geocercaValida,
  racksDentro
} from './geofence';
import { ZonesApiService } from './zones-api.service';
import {
  ExternalHeader,
  ExternalParam,
  ExternalZoneConfig,
  ManualZone,
  MapSaveResult,
  MapSummary,
  ZoneOption
} from './zones.models';

const OCIOSO = { status: 'idle' } as const;

export type PestanaDeZonas = 'manuales' | 'externa' | 'geocercas';

/**
 * El estado de la pantalla Zonas: las manuales, la API externa y las geocercas de la compañía
 * elegida.
 *
 * <p>Se provee en el componente, como los demás stores de pantalla: al salir se destruye.</p>
 */
@Injectable()
export class ZonesStore {
  private readonly api = inject(ZonesApiService);
  private readonly companias = inject(CompanyStore);

  readonly pestana = signal<PestanaDeZonas>('manuales');
  readonly companiaId = this.companias.companiaId;

  // --- zonas manuales ---------------------------------------------------------------------------

  private readonly _manuales = signal<Async<ManualZone[]>>(OCIOSO);
  readonly manuales = this._manuales.asReadonly();

  /** La que se está editando; nula para crear una nueva. */
  readonly editandoId = signal<number | null>(null);
  readonly nombre = signal('');
  readonly idDelCliente = signal('');

  private readonly _accionManual = signal<Async<string>>(OCIOSO);
  readonly accionManual = this._accionManual.asReadonly();

  readonly puedeGuardarManual = computed(
    () => this.companiaId() !== null && this.nombre().trim() !== '' && this._accionManual().status !== 'loading'
  );

  // --- zona externa -----------------------------------------------------------------------------

  private readonly _externa = signal<Async<ExternalZoneConfig | null>>(OCIOSO);
  readonly externa = this._externa.asReadonly();

  readonly nombreExterna = signal('');
  readonly url = signal('');
  readonly cabeceras = signal<ExternalHeader[]>([]);
  readonly parametros = signal<ExternalParam[]>([]);

  private readonly _accionExterna = signal<Async<string>>(OCIOSO);
  readonly accionExterna = this._accionExterna.asReadonly();

  readonly puedeGuardarExterna = computed(
    () =>
      this.companiaId() !== null &&
      this.nombreExterna().trim() !== '' &&
      this.url().trim() !== '' &&
      this._accionExterna().status !== 'loading'
  );

  // --- geocercas --------------------------------------------------------------------------------

  private readonly _planos = signal<Async<MapSummary[]>>(OCIOSO);
  readonly planos = this._planos.asReadonly();
  private readonly _zonas = signal<Async<ZoneOption[]>>(OCIOSO);
  readonly zonas = this._zonas.asReadonly();
  private readonly _mapa = signal<Async<WarehouseMap>>(OCIOSO);
  readonly mapa = this._mapa.asReadonly();

  readonly planoId = signal<string | null>(null);
  readonly zonaId = signal<number | null>(null);
  readonly desde = signal<string | null>(null);
  readonly hasta = signal<string | null>(null);

  private readonly _guardado = signal<Async<MapSaveResult>>(OCIOSO);
  readonly guardado = this._guardado.asReadonly();

  private readonly mapaListo = computed(() => {
    const m = this._mapa();
    return m.status === 'ready' ? m.value : null;
  });

  readonly anclas = computed<Ancla[]>(() => {
    const m = this.mapaListo();
    return m ? anclasDelMapa(m) : [];
  });

  /** La geocerca que ya tiene la zona elegida en este plano, si tiene. */
  readonly geocercaActual = computed<WarehouseMapZone | null>(() => {
    const m = this.mapaListo();
    const id = this.zonaId();
    return m && id !== null ? (m.Zones ?? []).find((z) => z.IdZone === id && z.Points.length >= 2) ?? null : null;
  });

  /** Las zonas del plano con su geocerca, para la lista: «Cocina · P1.1 → P3.I». */
  readonly geocercasDelPlano = computed(() => {
    const m = this.mapaListo();
    if (!m) return [];
    return (m.Zones ?? []).map((z) => {
      const par = anclasDeLaGeocerca(this.anclas(), z);
      return {
        idZone: z.IdZone,
        nombre: this.nombreDeZona(z.IdZone) ?? z.Name,
        anclas: par ? `${par[0].etiqueta} → ${par[1].etiqueta}` : 'dibujada a mano',
        racks: racksDentro(m, z.Points).length
      };
    });
  });

  /** Las dos anclas elegidas, si están las dos. */
  private readonly par = computed<[Ancla, Ancla] | null>(() => {
    const a = this.anclas().find((x) => x.etiqueta === this.desde());
    const b = this.anclas().find((x) => x.etiqueta === this.hasta());
    return a && b ? [a, b] : null;
  });

  /** El rectángulo que dibujan las dos anclas elegidas. */
  readonly puntos = computed(() => {
    const p = this.par();
    return p ? geocercaEntre(p[0], p[1]) : null;
  });

  /**
   * Si las anclas elegidas no son un par que el robot sepa recorrer (.1–.I, .S–.3 o .1–.3). Con una
   * sola elegida todavía no se sabe: no se avisa.
   */
  readonly parInvalido = computed(() => {
    const p = this.par();
    return p !== null && !geocercaValida(p[0], p[1]);
  });

  /** Qué se señala en el lienzo: lo que entraría con las anclas elegidas, o lo que ya tiene. */
  readonly resaltadas = computed(() => {
    const m = this.mapaListo();
    const p = this.puntos() ?? this.geocercaActual()?.Points ?? null;
    return m && p ? carasDentro(m, p) : [];
  });

  readonly racksQueEntran = computed(() => {
    const m = this.mapaListo();
    const p = this.puntos();
    return m && p ? racksDentro(m, p).length : 0;
  });

  /** Las geocercas de otras zonas que la nueva pisaría. El backend no dejaría guardarla. */
  readonly pisa = computed(() => {
    const m = this.mapaListo();
    const p = this.puntos();
    const id = this.zonaId();
    return m && p && id !== null ? conQuienSePisa(m, id, p).map((z) => this.nombreDeZona(z.IdZone) ?? z.Name) : [];
  });

  readonly puedeGuardarGeocerca = computed(
    () =>
      this.zonaId() !== null &&
      this.puntos() !== null &&
      !this.parInvalido() &&
      this.racksQueEntran() > 0 &&
      this.pisa().length === 0 &&
      this._guardado().status !== 'loading'
  );

  // --- carga ------------------------------------------------------------------------------------

  /** Todo lo de la compañía elegida. Se llama al entrar y al cambiar de compañía. */
  async cargar(): Promise<void> {
    this.limpiarManual();
    this.limpiarGeocerca();
    this.planoId.set(null);
    this._mapa.set(OCIOSO);

    const compania = this.companiaId();
    if (compania === null) {
      this._manuales.set(OCIOSO);
      this._externa.set(OCIOSO);
      this._planos.set(OCIOSO);
      this._zonas.set(OCIOSO);
      return;
    }

    await Promise.all([
      this.cargarManuales(compania),
      this.cargarExterna(compania),
      this.cargarPlanos(compania),
      this.cargarZonas(compania)
    ]);
  }

  private async cargarManuales(compania: number): Promise<void> {
    this._manuales.set({ status: 'loading' });
    try {
      const todas = await this.api.manuales();
      if (this.companiaId() !== compania) return;
      this._manuales.set({
        status: 'ready',
        value: todas.filter((z) => z.COMPANY_ID === compania && z.ACTIVE !== false).sort((a, b) => a.NAME.localeCompare(b.NAME))
      });
    } catch (error) {
      this._manuales.set({ status: 'error', ...apiFailure(error) });
    }
  }

  private async cargarExterna(compania: number): Promise<void> {
    this._externa.set({ status: 'loading' });
    try {
      const todas = await this.api.externas();
      if (this.companiaId() !== compania) return;
      const suya = todas.find((z) => z.CompanyId === compania && z.Active) ?? null;
      this._externa.set({ status: 'ready', value: suya });
      this.nombreExterna.set(suya?.Name ?? '');
      this.url.set(suya?.URL ?? '');
      this.cabeceras.set((suya?.Headers ?? []).map((h) => ({ ...h })));
      this.parametros.set((suya?.Params ?? []).map((p) => ({ ...p })));
    } catch (error) {
      this._externa.set({ status: 'error', ...apiFailure(error) });
    }
  }

  private async cargarPlanos(compania: number): Promise<void> {
    this._planos.set({ status: 'loading' });
    try {
      const planos = await this.api.planosDeCompania(compania);
      if (this.companiaId() === compania) this._planos.set({ status: 'ready', value: planos });
    } catch (error) {
      this._planos.set({ status: 'error', ...apiFailure(error) });
    }
  }

  private async cargarZonas(compania: number): Promise<void> {
    this._zonas.set({ status: 'loading' });
    try {
      const zonas = await this.api.zonasDeCompania(compania);
      if (this.companiaId() === compania) this._zonas.set({ status: 'ready', value: zonas.filter((z) => z.ACTIVE !== false) });
    } catch (error) {
      this._zonas.set({ status: 'error', ...apiFailure(error) });
    }
  }

  // --- zonas manuales ---------------------------------------------------------------------------

  editarManual(zona: ManualZone): void {
    this.editandoId.set(zona.ID);
    this.nombre.set(zona.NAME);
    this.idDelCliente.set(zona.ZONE_ID === null ? '' : String(zona.ZONE_ID));
    this._accionManual.set(OCIOSO);
  }

  limpiarManual(): void {
    this.editandoId.set(null);
    this.nombre.set('');
    this.idDelCliente.set('');
    this._accionManual.set(OCIOSO);
  }

  async guardarManual(): Promise<void> {
    const compania = this.companiaId();
    if (!this.puedeGuardarManual() || compania === null) return;

    const texto = this.idDelCliente().trim();
    const borrador = {
      NAME: this.nombre().trim(),
      COMPANY_ID: compania,
      ZONE_ID: texto === '' || !Number.isInteger(Number(texto)) ? null : Number(texto)
    };
    const id = this.editandoId();

    this._accionManual.set({ status: 'loading' });
    try {
      if (id === null) await this.api.crearManual(borrador);
      else await this.api.editarManual(id, borrador);
      const hecho = id === null ? `Zona «${borrador.NAME}» creada.` : `Zona «${borrador.NAME}» guardada.`;
      this.limpiarManual();
      this._accionManual.set({ status: 'ready', value: hecho });
      await Promise.all([this.cargarManuales(compania), this.cargarZonas(compania)]);
    } catch (error) {
      this._accionManual.set({ status: 'error', ...apiFailure(error) });
    }
  }

  /**
   * Borra una zona manual. Antes pregunta al backend si algún inventario la usa: si la usa, el
   * backend contesta con el motivo y se enseña tal cual, sin borrar.
   */
  async borrarManual(zona: ManualZone): Promise<void> {
    const compania = this.companiaId();
    if (compania === null || this._accionManual().status === 'loading') return;

    this._accionManual.set({ status: 'loading' });
    try {
      await this.api.validarBorrado(zona.ID);
      await this.api.borrarManual(zona.ID);
      if (this.editandoId() === zona.ID) this.limpiarManual();
      this._accionManual.set({ status: 'ready', value: `Zona «${zona.NAME}» borrada.` });
      await Promise.all([this.cargarManuales(compania), this.cargarZonas(compania)]);
    } catch (error) {
      this._accionManual.set({ status: 'error', ...apiFailure(error) });
    }
  }

  // --- zona externa -----------------------------------------------------------------------------

  anadirCabecera(): void {
    this.cabeceras.update((l) => [...l, { HeaderName: '', Value: '' }]);
  }

  quitarCabecera(i: number): void {
    this.cabeceras.update((l) => l.filter((_, j) => j !== i));
  }

  cambiarCabecera(i: number, campo: keyof ExternalHeader, valor: string): void {
    this.cabeceras.update((l) => l.map((h, j) => (j === i ? { ...h, [campo]: valor } : h)));
  }

  anadirParametro(): void {
    this.parametros.update((l) => [...l, { ParamName: '', Value: '' }]);
  }

  quitarParametro(i: number): void {
    this.parametros.update((l) => l.filter((_, j) => j !== i));
  }

  cambiarParametro(i: number, campo: keyof ExternalParam, valor: string): void {
    this.parametros.update((l) => l.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)));
  }

  /** Crea o guarda la configuración. Una segunda activa en la compañía da 409, y se enseña. */
  async guardarExterna(): Promise<void> {
    const compania = this.companiaId();
    if (!this.puedeGuardarExterna() || compania === null) return;

    const actual = this._externa();
    const id = actual.status === 'ready' ? actual.value?.IdZone ?? null : null;
    const borrador = {
      Name: this.nombreExterna().trim(),
      URL: this.url().trim(),
      // Una fila a medio llenar no se manda: el cliente la recibiría como cabecera vacía.
      Headers: this.cabeceras().filter((h) => h.HeaderName.trim() !== ''),
      Params: this.parametros().filter((p) => p.ParamName.trim() !== ''),
      CompanyId: compania
    };

    this._accionExterna.set({ status: 'loading' });
    try {
      if (id === null) await this.api.crearExterna(borrador);
      else await this.api.editarExterna(id, borrador);
      this._accionExterna.set({ status: 'ready', value: 'Configuración guardada.' });
      await Promise.all([this.cargarExterna(compania), this.cargarZonas(compania)]);
    } catch (error) {
      this._accionExterna.set({ status: 'error', ...apiFailure(error) });
    }
  }

  /** Quita la API: la compañía vuelve a sus zonas manuales. */
  async borrarExterna(): Promise<void> {
    const compania = this.companiaId();
    const actual = this._externa();
    if (compania === null || actual.status !== 'ready' || actual.value === null) return;

    this._accionExterna.set({ status: 'loading' });
    try {
      await this.api.borrarExterna(actual.value.IdZone);
      this._accionExterna.set({ status: 'ready', value: 'Configuración quitada: se usan las zonas manuales.' });
      await Promise.all([this.cargarExterna(compania), this.cargarZonas(compania)]);
    } catch (error) {
      this._accionExterna.set({ status: 'error', ...apiFailure(error) });
    }
  }

  // --- geocercas --------------------------------------------------------------------------------

  async elegirPlano(mapId: string | null): Promise<void> {
    this.planoId.set(mapId);
    this.limpiarGeocerca();
    if (mapId === null) {
      this._mapa.set(OCIOSO);
      return;
    }

    this._mapa.set({ status: 'loading' });
    try {
      const mapa = await this.api.planoVigente(mapId);
      if (this.planoId() === mapId) this._mapa.set({ status: 'ready', value: mapa });
    } catch (error) {
      this._mapa.set({ status: 'error', ...apiFailure(error) });
    }
  }

  /** Elige la zona y, si ya tiene geocerca hecha con anclas, las precarga para poder moverla. */
  elegirZona(idZone: number | null): void {
    this.zonaId.set(idZone);
    this._guardado.set(OCIOSO);
    const actual = this.geocercaActual();
    const par = actual ? anclasDeLaGeocerca(this.anclas(), actual) : null;
    this.desde.set(par?.[0].etiqueta ?? null);
    this.hasta.set(par?.[1].etiqueta ?? null);
  }

  limpiarGeocerca(): void {
    this.zonaId.set(null);
    this.desde.set(null);
    this.hasta.set(null);
    this._guardado.set(OCIOSO);
  }

  /**
   * Guarda la geocerca como una versión nueva del plano, con todas las demás tal como estaban.
   * Se parte de la versión vigente que se cargó, entera, para no perder nada de lo que KiBot no
   * dibuja (muros, puertas…).
   */
  async guardarGeocerca(): Promise<void> {
    const mapa = this.mapaListo();
    const id = this.zonaId();
    const puntos = this.puntos();
    // El robot rechazaría la orden con esta geocerca: mejor que no llegue a guardarse.
    if (this.parInvalido()) {
      this._guardado.set({ status: 'error', message: GEOCERCA_INVALIDA, details: [] });
      return;
    }
    if (!this.puedeGuardarGeocerca() || !mapa || id === null || !puntos) return;

    const nueva: WarehouseMapZone = {
      IdZone: id,
      Name: this.nombreDeZona(id) ?? `Zona ${id}`,
      Shape: 'rect',
      Points: puntos.map((p) => ({ X: p.X, Y: p.Y }))
    };
    const zonas = (mapa.Zones ?? []).filter((z) => z.IdZone !== id);

    this._guardado.set({ status: 'loading' });
    try {
      const resultado = await this.api.guardarVersion({ ...mapa, Zones: [...zonas, nueva] });
      this._guardado.set({ status: 'ready', value: resultado });
      // Se recarga la vigente: la siguiente geocerca tiene que partir de la versión recién guardada.
      const vigente = await this.api.planoVigente(mapa.MapId);
      if (this.planoId() === mapa.MapId) this._mapa.set({ status: 'ready', value: vigente });
    } catch (error) {
      this._guardado.set({ status: 'error', ...apiFailure(error) });
    }
  }

  private nombreDeZona(id: number): string | null {
    const z = this._zonas();
    return z.status === 'ready' ? z.value.find((x) => x.ID === id)?.NAME ?? null : null;
  }
}
