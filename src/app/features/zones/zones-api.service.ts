import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../../core/http/api.config';
import { WarehouseMap } from '../warehouse-map/warehouse-map.models';
import {
  ExternalZoneConfig,
  ExternalZoneDraft,
  ManualZone,
  ManualZoneDraft,
  MapSaveResult,
  MapSummary,
  ZoneOption
} from './zones.models';

/**
 * Los caminos de zonas y geocercas. Todos existen ya en WiscanAPIs —son los que usa Witag—: KiBot
 * no añade backend, solo la pantalla.
 *
 * <p>Promesas y sin `catchError`, como el resto: el fallo sube tal cual y lo cuenta el store.</p>
 */
@Injectable({ providedIn: 'root' })
export class ZonesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  // --- zonas manuales ---------------------------------------------------------------------------

  manuales(): Promise<ManualZone[]> {
    return firstValueFrom(this.http.get<ManualZone[]>(`${this.baseUrl}/InventoryZone/Manual`));
  }

  crearManual(zona: ManualZoneDraft): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/InventoryZone/Manual`, zona));
  }

  editarManual(id: number, zona: ManualZoneDraft): Promise<unknown> {
    return firstValueFrom(this.http.put(`${this.baseUrl}/InventoryZone/Manual`, { ID: id, ...zona }));
  }

  /** Si algún inventario usa la zona. Se pregunta antes de borrarla. */
  validarBorrado(id: number): Promise<unknown> {
    return firstValueFrom(this.http.get(`${this.baseUrl}/InventoryZone/Manual/${id}/validate`));
  }

  borrarManual(id: number): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${this.baseUrl}/InventoryZone/Manual/${id}`));
  }

  // --- zona externa -----------------------------------------------------------------------------

  externas(): Promise<ExternalZoneConfig[]> {
    return firstValueFrom(this.http.get<ExternalZoneConfig[]>(`${this.baseUrl}/InventoryZone/External`));
  }

  crearExterna(config: ExternalZoneDraft): Promise<unknown> {
    return firstValueFrom(this.http.post(`${this.baseUrl}/InventoryZone/External`, config));
  }

  editarExterna(id: number, config: ExternalZoneDraft): Promise<unknown> {
    return firstValueFrom(this.http.put(`${this.baseUrl}/InventoryZone/External`, { IdZone: id, ...config }));
  }

  borrarExterna(id: number): Promise<unknown> {
    return firstValueFrom(this.http.delete(`${this.baseUrl}/InventoryZone/External/${id}`));
  }

  // --- lo que sirve para elegir -----------------------------------------------------------------

  /** Las zonas que la compañía puede usar: las externas si tiene API, si no las manuales. */
  zonasDeCompania(companyId: number): Promise<ZoneOption[]> {
    return firstValueFrom(this.http.get<ZoneOption[]>(`${this.baseUrl}/InventoryZone/ByCompany/${companyId}`));
  }

  planosDeCompania(companyId: number): Promise<MapSummary[]> {
    return firstValueFrom(this.http.get<MapSummary[]>(`${this.baseUrl}/warehouseMap/company/${companyId}`));
  }

  /**
   * La versión vigente del plano, <b>entera</b>: con muros, puertas y todo lo que KiBot no tipa.
   * Hace falta así porque guardar una geocerca es guardar una versión nueva del plano completo, y
   * lo que no se devuelva se perdería.
   */
  planoVigente(mapId: string): Promise<WarehouseMap> {
    return firstValueFrom(this.http.get<WarehouseMap>(`${this.baseUrl}/warehouseMap/${mapId}`));
  }

  /**
   * Guarda una versión nueva del plano. Las versiones no se sobrescriben nunca; el backend da 409
   * si la nueva pierde una zona que tenía la anterior.
   */
  guardarVersion(mapa: WarehouseMap): Promise<MapSaveResult> {
    return firstValueFrom(
      this.http.post<MapSaveResult>(`${this.baseUrl}/warehouseMap/${mapa.MapId}/version`, mapa)
    );
  }
}
