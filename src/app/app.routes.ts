import { Routes } from '@angular/router';
import { WidexIconName } from './shared/ui/widex-icon/widex-icon';

/** Ruta de un módulo aún no implementado; ver `ModulePlaceholder`. */
const placeholder = (path: string, title: string, icon: WidexIconName) => ({
  path,
  title: `${title} · Widex`,
  data: { title, icon },
  loadComponent: () =>
    import('./features/module-placeholder/module-placeholder').then((m) => m.ModulePlaceholder)
});

/**
 * Arquitectura por módulo/ruta: el shell (sidebar + contenido) es la ruta
 * raíz y cada módulo entra como hija lazy. El orden y los paths son los
 * mismos de `WIDEX_NAV_ITEMS`, que es lo que pinta el sidebar.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./core/layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        title: 'Inicio · Widex',
        loadComponent: () => import('./features/home/home').then((m) => m.Home)
      },
      {
        path: 'control',
        title: 'Control del recorrido · Widex',
        data: { title: 'Control', icon: 'control' },
        loadComponent: () =>
          import('./features/robot-control/robot-control').then((m) => m.RobotControl)
      },
      {
        path: 'buscar',
        title: 'Buscar caja · Widex',
        data: { title: 'Buscar', icon: 'search' },
        loadComponent: () => import('./features/box-search/box-search').then((m) => m.BoxSearch)
      },
      placeholder('ubicacion', 'Ubicación en tiempo real', 'location'),
      placeholder('estado', 'Estado del equipo y alertas', 'status'),
      placeholder('zonas', 'Configuración de zonas', 'zones'),
      {
        path: 'mapa',
        title: 'Plano de bodega · Widex',
        data: { title: 'Mapa', icon: 'map' },
        loadComponent: () =>
          import('./features/warehouse-map/warehouse-map').then((m) => m.WarehouseMap)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
