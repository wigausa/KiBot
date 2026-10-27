import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CompanyStore } from '../../core/company/company.store';
import { WarehouseMap } from '../warehouse-map/warehouse-map.models';
import { mapaDePrueba } from './mapa-de-prueba';
import { ZonesApiService } from './zones-api.service';
import { ZonesStore } from './zones.store';
import { ExternalZoneConfig, ManualZone, MapSaveResult, MapSummary, ZoneOption } from './zones.models';

/** Un doble a mano: lo que se prueba es el store, no HTTP. */
class ApiFalsa {
  mapa: WarehouseMap & { Doors?: unknown[] } = { ...mapaDePrueba(), Doors: [{ DoorId: 'D1' }] };
  guardados: WarehouseMap[] = [];
  llamadas: string[] = [];
  validarFalla: unknown = null;

  async manuales(): Promise<ManualZone[]> {
    return [
      { ID: 10, NAME: 'Cocina', COMPANY_ID: 1, ZONE_ID: null, ACTIVE: true },
      { ID: 11, NAME: 'De otra', COMPANY_ID: 2, ZONE_ID: null, ACTIVE: true }
    ];
  }
  async externas(): Promise<ExternalZoneConfig[]> {
    return [];
  }
  async planosDeCompania(): Promise<MapSummary[]> {
    return [];
  }
  async zonasDeCompania(): Promise<ZoneOption[]> {
    return [
      { ID: 10, NAME: 'Cocina', COMPANY_ID: 1, ACTIVE: true },
      { ID: 20, NAME: 'Sala', COMPANY_ID: 1, ACTIVE: true }
    ];
  }
  async planoVigente(): Promise<WarehouseMap> {
    return structuredClone(this.mapa);
  }
  async guardarVersion(m: WarehouseMap): Promise<MapSaveResult> {
    this.guardados.push(m);
    this.mapa = { ...(m as typeof this.mapa), Version: m.Version + 1 };
    return { MapId: m.MapId, Version: m.Version + 1, Warnings: [] };
  }
  async validarBorrado(id: number): Promise<unknown> {
    this.llamadas.push(`validar ${id}`);
    if (this.validarFalla) throw this.validarFalla;
    return {};
  }
  async borrarManual(id: number): Promise<unknown> {
    this.llamadas.push(`borrar ${id}`);
    return {};
  }
}

describe('ZonesStore', () => {
  let store: ZonesStore;
  let api: ApiFalsa;

  beforeEach(async () => {
    api = new ApiFalsa();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ZonesStore,
        { provide: ZonesApiService, useValue: api },
        { provide: CompanyStore, useValue: { companiaId: signal<number | null>(1) } }
      ]
    });
    store = TestBed.inject(ZonesStore);
    await store.cargar();
  });

  it('enseña solo las zonas manuales de la compañía elegida', () => {
    const m = store.manuales();
    expect(m.status).toBe('ready');
    if (m.status === 'ready') expect(m.value.map((z) => z.NAME)).toEqual(['Cocina']);
  });

  it('pregunta si la zona se usa antes de borrarla, y si se usa no la borra', async () => {
    api.validarFalla = new HttpErrorResponse({ status: 409, error: { Error: 'La usa el inventario «Octubre».' } });

    await store.borrarManual({ ID: 10, NAME: 'Cocina', COMPANY_ID: 1, ZONE_ID: null });

    expect(api.llamadas).toEqual(['validar 10']);
    const a = store.accionManual();
    expect(a.status).toBe('error');
    if (a.status === 'error') expect(a.message).toBe('La usa el inventario «Octubre».');
  });

  it('guarda la geocerca como versión nueva del plano entero, sin perder lo que KiBot no dibuja', async () => {
    api.mapa.Zones = [{ IdZone: 20, Name: 'Sala', Shape: 'rect', Points: [{ X: 3.56, Y: 9.25 }, { X: 7.12, Y: 18.5 }] }];
    await store.elegirPlano('map-1');
    store.elegirZona(10);
    store.desde.set('P1.1');
    store.hasta.set('P3.I');

    expect(store.racksQueEntran()).toBe(2);
    expect(store.puedeGuardarGeocerca()).toBeTrue();

    await store.guardarGeocerca();

    const enviado = api.guardados[0] as WarehouseMap & { Doors?: unknown[] };
    expect(enviado.Doors).toEqual([{ DoorId: 'D1' }]);
    expect(enviado.Zones).toEqual([
      { IdZone: 20, Name: 'Sala', Shape: 'rect', Points: [{ X: 3.56, Y: 9.25 }, { X: 7.12, Y: 18.5 }] },
      { IdZone: 10, Name: 'Cocina', Shape: 'rect', Points: [{ X: 0, Y: 0 }, { X: 7.12, Y: 8.25 }] }
    ]);
    expect(store.guardado().status).toBe('ready');
  });

  it('no deja guardar una geocerca que pisa otra, ni una sin estanterías', async () => {
    api.mapa.Zones = [{ IdZone: 20, Name: 'Sala', Shape: 'rect', Points: [{ X: 0, Y: 0 }, { X: 3.56, Y: 9.25 }] }];
    await store.elegirPlano('map-1');
    store.elegirZona(10);

    store.desde.set('P1.1');
    store.hasta.set('P3.I');
    expect(store.pisa()).toEqual(['Sala']);
    expect(store.puedeGuardarGeocerca()).toBeFalse();

    store.desde.set('P1.1');
    store.hasta.set('P1.3');
    expect(store.racksQueEntran()).toBe(0);
    expect(store.puedeGuardarGeocerca()).toBeFalse();
  });

  it('al elegir una zona que ya tiene geocerca, precarga sus anclas', async () => {
    api.mapa.Zones = [{ IdZone: 10, Name: 'Cocina', Shape: 'rect', Points: [{ X: 0, Y: 10.25 }, { X: 3.56, Y: 18.5 }] }];
    await store.elegirPlano('map-1');

    store.elegirZona(10);

    expect(store.desde()).toBe('P1.S');
    expect(store.hasta()).toBe('P2.3');
    expect(store.resaltadas().map((c) => c.rackId)).toEqual(['P1-P2-sup', 'P1-P2-sup']);
  });

  it('no deja guardar una geocerca con un par de anclas que el robot no sabe recorrer', async () => {
    await store.elegirPlano('map-1');
    store.elegirZona(10);

    store.desde.set('P1.1');
    store.hasta.set('P3.S');
    expect(store.racksQueEntran()).toBeGreaterThan(0);
    expect(store.parInvalido()).toBeTrue();
    expect(store.puedeGuardarGeocerca()).toBeFalse();

    await store.guardarGeocerca();

    expect(api.guardados).toEqual([]);
    const g = store.guardado();
    expect(g.status).toBe('error');
    if (g.status === 'error') expect(g.message).toBe('Una zona tiene que ir de .1 a .I, de .S a .3 o de .1 a .3');
  });

  it('el par vale en cualquier orden: de .3 a .S son los tramos superiores', async () => {
    await store.elegirPlano('map-1');
    store.elegirZona(10);

    store.desde.set('P3.3');
    store.hasta.set('P1.S');

    expect(store.parInvalido()).toBeFalse();
    expect(store.puedeGuardarGeocerca()).toBeTrue();
  });
});
