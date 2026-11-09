/**
 * Las zonas, como las devuelve WiscanAPIs. Es la misma lógica que en Witag: una compañía trabaja con
 * zonas <b>manuales</b> (su catálogo en SQL) o con zonas <b>externas</b> (las pide en vivo a la API
 * del cliente). Los nombres de campo son los del backend, que en las manuales van en mayúsculas.
 */

/** Una zona del catálogo manual (`InventoryZone/Manual`). Lo que la identifica es `ID`. */
/** Una zona del plano que ya usó algún inventario: su geocerca no se puede mover. */
export interface ZonaEnUso {
  IdZone: number;
  /** Los nombres de los inventarios que la usaron. */
  Inventories: string[];
}

export interface ManualZone {
  ID: number;
  NAME: string;
  COMPANY_ID: number;
  /** Referencia opcional al id de la zona en el sistema del cliente. Nadie lo lee. */
  ZONE_ID: number | null;
  ACTIVE?: boolean;
}

export interface ManualZoneDraft {
  NAME: string;
  COMPANY_ID: number;
  ZONE_ID: number | null;
}

export interface ExternalHeader {
  HeaderName: string;
  Value: string;
}

export interface ExternalParam {
  ParamName: string;
  Value: string;
}

/**
 * La configuración de la API de zonas del cliente (`InventoryZone/External`). No es una zona: es
 * dónde preguntarlas. Una activa por compañía; una segunda da 409.
 */
export interface ExternalZoneConfig {
  IdZone: number;
  Name: string;
  URL: string | null;
  Headers: ExternalHeader[] | null;
  Params: ExternalParam[] | null;
  Active: boolean;
  CompanyId: number | null;
}

export interface ExternalZoneDraft {
  Name: string;
  URL: string;
  Headers: ExternalHeader[];
  Params: ExternalParam[];
  CompanyId: number;
}

/**
 * Una zona elegible para un inventario o una geocerca (`InventoryZone/ByCompany`): las externas si
 * la compañía tiene API configurada, si no las manuales, con la misma forma.
 */
export interface ZoneOption {
  ID: number;
  NAME: string;
  COMPANY_ID: number;
  ACTIVE: boolean;
}

/** Un plano de la compañía, en resumen (`warehouseMap/company/{id}`). */
export interface MapSummary {
  MapId: string;
  Name: string;
  CompanyId: number;
  Version: number;
  CreatedAt: string;
  Racks: number;
  Aisles: number;
  Zones: { IdZone: number; Name: string }[];
}

/** Lo que responde guardar una versión del plano. */
export interface MapSaveResult {
  MapId: string;
  Version: number;
  Warnings: string[];
}
