import { Routes } from '@angular/router';

/**
 * Arquitectura por módulo/ruta: el shell (sidebar + contenido) es la ruta
 * raíz y cada módulo entra como hija lazy. El orden y los paths son los
 * mismos de `KIBOT_NAV_ITEMS`, que es lo que pinta el sidebar.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./core/layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        title: 'Inicio · KiBot',
        loadComponent: () => import('./features/home/home').then((m) => m.Home)
      },
      {
        path: 'inventarios',
        title: 'Inventarios · KiBot',
        data: { title: 'Inventarios', icon: 'inventory' },
        loadComponent: () => import('./features/inventories/inventories').then((m) => m.Inventories)
      },
      {
        path: 'control',
        title: 'Control del recorrido · KiBot',
        data: { title: 'Control', icon: 'control' },
        loadComponent: () =>
          import('./features/robot-control/robot-control').then((m) => m.RobotControl)
      },
      {
        path: 'buscar',
        title: 'Buscar caja · KiBot',
        data: { title: 'Buscar', icon: 'search' },
        loadComponent: () => import('./features/box-search/box-search').then((m) => m.BoxSearch)
      },
      {
        path: 'ubicacion',
        title: 'Ubicación en tiempo real · KiBot',
        data: { title: 'Ubicación', icon: 'location' },
        loadComponent: () =>
          import('./features/robot-status/robot-location').then((m) => m.RobotLocation)
      },
      {
        path: 'estado',
        title: 'Estado del equipo y alertas · KiBot',
        data: { title: 'Estado', icon: 'status' },
        loadComponent: () => import('./features/robot-status/robot-status').then((m) => m.RobotStatus)
      },
      {
        path: 'zonas',
        title: 'Zonas · KiBot',
        data: { title: 'Zonas', icon: 'zones' },
        loadComponent: () => import('./features/zones/zones').then((m) => m.Zones)
      },
      {
        path: 'mapa',
        title: 'Plano de bodega · KiBot',
        data: { title: 'Mapa', icon: 'map' },
        loadComponent: () =>
          import('./features/warehouse-map/warehouse-map').then((m) => m.WarehouseMap)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
