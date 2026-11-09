/**
 * Los inventarios del robot, como los devuelve y los recibe WiscanAPIs. Son los mismos inventarios
 * de Witag: KiBot solo los crea con un plano, sus zonas y robots.
 */

/** Un inventario de `GetInventories?includeClosed=true`. */
export interface Inventory {
  _id: string;
  Name: string;
  StartDate: string;
  EndDate: string | null;
  MapId?: string | null;
  MapVersion?: number | null;
  /** `CompanyId` es lo que dice de qué compañía es el inventario: el inventario no lo lleva. */
  Zones?: { IdZone: number; Name: string; CompanyId?: number | null }[] | null;
  Devices?: { IdDevice: number; Name: string; Type: string }[] | null;
}

/** El cuerpo de `POST CreateInventory`. El robot puede ir en varias zonas (decisión 2026-10-23). */
export interface CreateInventoryRequest {
  Name: string;
  MapId: string;
  Zones: { IdZone: number; Name: string; Devices: number[] }[];
}

/** El cuerpo de `PATCH inventory/{id}`: lo que no venga se queda como está. */
export interface EditInventoryRequest {
  Name?: string;
  /** Los ids de las zonas que debe tener, en orden. */
  Zones?: number[];
}

/**
 * Un dispositivo de `GET puerta` (camelCase: es de los endpoints viejos). Solo interesa lo que
 * permite saber si es un robot y de qué compañía.
 */
export interface Device {
  idPuerta: number;
  nombre: string;
  tipoPuerta?: { nombre: string } | null;
  controlador?: { company?: { idCompany: number } | null } | null;
}
