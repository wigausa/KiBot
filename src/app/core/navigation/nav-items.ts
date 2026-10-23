import { KiBotIconName } from '../../shared/ui/kibot-icon/kibot-icon';

export interface KiBotNavItem {
  /** Ruta hija del shell, sin slash inicial. */
  readonly path: string;
  readonly label: string;
  readonly icon: KiBotIconName;
}

/**
 * Módulos de KiBot en el orden del mockup (sección "Contenido").
 * Una entrada aquí = una ruta lazy en `app.routes.ts`; no hay otra fuente de
 * verdad para el sidebar.
 */
export const KIBOT_NAV_ITEMS: readonly KiBotNavItem[] = [
  { path: 'inicio', label: 'Inicio', icon: 'home' },
  { path: 'control', label: 'Control', icon: 'control' },
  { path: 'buscar', label: 'Buscar', icon: 'search' },
  { path: 'ubicacion', label: 'Ubicación', icon: 'location' },
  { path: 'estado', label: 'Estado', icon: 'status' },
  { path: 'zonas', label: 'Zonas', icon: 'zones' },
  { path: 'mapa', label: 'Mapa', icon: 'map' }
];
