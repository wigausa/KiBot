import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PlanPreview, PlanSaveResult, WarehousePlan } from './warehouse-map.models';
import { WarehouseMapService } from './warehouse-map.service';
import { WarehouseMapStore } from './warehouse-map.store';

/**
 * Un doble a mano: lo que se prueba es el store, no HTTP.
 *
 * <p>El fallo va en un campo aparte y no se detecta con `instanceof Error`, porque
 * `HttpErrorResponse` <b>no hereda de `Error`</b> —implementa su forma, pero extiende
 * `HttpResponseBase`—. Comprobarlo así daba el error por respuesta buena.</p>
 */
class ServicioFalso {
  preview: PlanPreview = respuestaValida();
  guardado: PlanSaveResult = { MapId: 'map-1', Version: 1, Warnings: [], FaceAisles: [] };

  previewFalla: unknown = null;
  guardadoFalla: unknown = null;

  planesRecibidos: WarehousePlan[] = [];
  llamadasAGuardar = 0;

  async previewPlan(plan: WarehousePlan): Promise<PlanPreview> {
    this.planesRecibidos.push(plan);
    if (this.previewFalla !== null) throw this.previewFalla;
    return this.preview;
  }

  async createFromPlan(): Promise<PlanSaveResult> {
    this.llamadasAGuardar++;
    if (this.guardadoFalla !== null) throw this.guardadoFalla;
    return this.guardado;
  }

  async saveVersionFromPlan(): Promise<PlanSaveResult> {
    this.llamadasAGuardar++;
    if (this.guardadoFalla !== null) throw this.guardadoFalla;
    return this.guardado;
  }
}

function respuestaValida(valid = true, errors: string[] = [], warnings: string[] = []): PlanPreview {
  return {
    Valid: valid,
    Errors: errors,
    Warnings: warnings,
    Resumen: {
      Aisles: 33,
      Racks: 832,
      Faces: 1664,
      FacesWithoutAisle: 0,
      Plane: { X: 0, Z: 0, Width: 90, Depth: 40 },
      Inventory: { X: 0, Z: 0, Width: 86, Depth: 36 }
    },
    Map: { Aisles: [], ShelvingUnits: [] } as unknown as PlanPreview['Map']
  };
}

const PLANO = JSON.stringify({ nombre: 'Prueba', companyId: 1 });

describe('WarehouseMapStore', () => {
  let store: WarehouseMapStore;
  let servicio: ServicioFalso;

  beforeEach(() => {
    servicio = new ServicioFalso();

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        WarehouseMapStore,
        { provide: WarehouseMapService, useValue: servicio }
      ]
    });

    store = TestBed.inject(WarehouseMapStore);
  });

  it('un JSON mal escrito se contesta sin ir a la red', async () => {
    store.escribir('{ esto no es json');

    await store.previsualizar();

    expect(servicio.planesRecibidos.length).toBe(0);
    expect(store.preview().status).toBe('error');
  });

  it('un plano inválido llena el panel, no el estado de error', async () => {
    // `Valid: false` es contenido de la pantalla: la lista de lo que hay que arreglar. Tratarlo
    // como fallo haría que un número mal puesto pareciera una caída del servidor.
    servicio.preview = respuestaValida(false, ['anchoBloque es 0.3 m y el mínimo es 0.6 m.']);
    store.escribir(PLANO);

    await store.previsualizar();

    expect(store.preview().status).toBe('ready');
    expect(store.erroresDelPlano()).toEqual(['anchoBloque es 0.3 m y el mínimo es 0.6 m.']);
    expect(store.puedeGuardar()).toBeFalse();
  });

  it('un fallo de la petición sí es un error, y conserva los detalles del backend', async () => {
    servicio.previewFalla = new HttpErrorResponse({
      status: 400,
      error: { Error: 'El plano no se pudo expandir.', Detalles: ['nombre está vacío'] }
    });
    store.escribir(PLANO);

    await store.previsualizar();

    const estado = store.preview();
    expect(estado.status).toBe('error');
    if (estado.status === 'error') {
      expect(estado.message).toBe('El plano no se pudo expandir.');
      expect(estado.details).toEqual(['nombre está vacío']);
    }
  });

  it('no se guarda nada que no se haya previsualizado', async () => {
    store.escribir(PLANO);

    await store.guardar();

    expect(servicio.llamadasAGuardar).toBe(0);
  });

  it('tocar el texto invalida la previsualización', async () => {
    store.escribir(PLANO);
    await store.previsualizar();
    expect(store.puedeGuardar()).toBeTrue();

    store.escribir(PLANO + ' ');

    // Lo que hay en pantalla ya no corresponde al texto: guardar ahora guardaría otra cosa.
    expect(store.puedeGuardar()).toBeFalse();
    expect(store.preview().status).toBe('idle');
  });

  it('un plano válido con avisos sí se guarda', async () => {
    // Un aviso cuenta algo que conviene mirar —un tramo de 9 segmentos— pero no impide guardar.
    servicio.preview = respuestaValida(true, [], ['El tramo superior de P30 tiene 9 segmentos.']);
    store.escribir(PLANO);

    await store.previsualizar();
    await store.guardar();

    expect(store.avisos().length).toBe(1);
    expect(servicio.llamadasAGuardar).toBe(1);
  });

  it('una respuesta que llega tarde no pisa a la última', async () => {
    store.escribir(PLANO);

    const lenta = respuestaValida(false, ['la vieja']);
    let resolver: (r: PlanPreview) => void = () => undefined;
    servicio.previewPlan = () => new Promise<PlanPreview>((r) => (resolver = r));
    const primera = store.previsualizar();

    servicio.previewPlan = async () => respuestaValida(true);
    await store.previsualizar();

    resolver(lenta);
    await primera;

    expect(store.erroresDelPlano()).toEqual([]);
    expect(store.puedeGuardar()).toBeTrue();
  });
});
