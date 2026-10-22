import { WidexIconName } from '../../shared/ui/widex-icon/widex-icon';

export interface WidexNavItem {
  /** Ruta hija del shell, sin slash inicial. */
  readonly path: string;
  readonly label: string;
  readonly icon: WidexIconName;
}

/**
 * Módulos de WiDex en el orden del mockup (sección "Contenido").
 * Una entrada aquí = una ruta lazy en `app.routes.ts`; no hay otra fuente de
 * verdad para el sidebar.
 */
export const WIDEX_NAV_ITEMS: readonly WidexNavItem[] = [
  { path: 'inicio', label: 'Inicio', icon: 'home' },
  { path: 'control', label: 'Control', icon: 'control' },
  { path: 'buscar', label: 'Buscar', icon: 'search' },
  { path: 'ubicacion', label: 'Ubicación', icon: 'location' },
  { path: 'estado', label: 'Estado', icon: 'status' },
  { path: 'zonas', label: 'Zonas', icon: 'zones' },
  { path: 'mapa', label: 'Mapa', icon: 'map' }
];
