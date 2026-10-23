import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../../core/http/api.config';
import { PlanPreview, PlanSaveResult, WarehousePlan } from './warehouse-map.models';

/**
 * Los tres caminos del plano de bodega.
 *
 * <p>Devuelve promesas a propósito. `HttpClient` habla en observables, pero KiBot es una aplicación
 * de señales sin una línea de RxJS fuera de aquí: sellándolo en un `firstValueFrom` por método, el
 * store de arriba es `async/await` y no tiene que saber nada de todo esto.</p>
 *
 * <p>Sin `catchError`: el fallo sube tal cual y lo cuenta el store, que es quien sabe qué enseñar.</p>
 */
@Injectable({ providedIn: 'root' })
export class WarehouseMapService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Expande el plano y lo valida, <b>sin guardar nada</b>.
   *
   * <p>Es lo que hace usable un formato que se escribe a mano: un sitio donde equivocarse sin
   * consecuencias. Y es lo que dibuja el lienzo, porque devuelve el mapa con su geometría ya
   * resuelta.</p>
   */
  previewPlan(plan: WarehousePlan): Promise<PlanPreview> {
    return firstValueFrom(
      this.http.post<PlanPreview>(`${this.baseUrl}/warehouseMap/plan/preview`, plan)
    );
  }

  /** Crea el mapa. */
  createFromPlan(plan: WarehousePlan): Promise<PlanSaveResult> {
    return firstValueFrom(this.http.post<PlanSaveResult>(`${this.baseUrl}/warehouseMap/plan`, plan));
  }

  /**
   * Guarda una versión nueva del mismo mapa.
   *
   * <p>Es el camino normal y no la excepción: se corrige una línea del plano y se vuelve a subir.
   * Las geocercas las conserva el backend desde la versión vigente, porque el plano no las describe.</p>
   */
  saveVersionFromPlan(mapId: string, plan: WarehousePlan): Promise<PlanSaveResult> {
    return firstValueFrom(
      this.http.post<PlanSaveResult>(`${this.baseUrl}/warehouseMap/${mapId}/plan`, plan)
    );
  }
}
