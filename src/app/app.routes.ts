import { inject } from '@angular/core';
import { RedirectFunction, Router, Routes } from '@angular/router';

/**
 * Una ruta vieja que ahora es una pestaña de otro módulo: lleva allí conservando sus query params
 * (`?inv=&code=` de Buscar con el robot, por ejemplo) y añadiendo `?tab=`.
 */
function aPestana(destino: string, tab: string): RedirectFunction {
  return ({ queryParams }) =>
    inject(Router).createUrlTree([`/${destino}`], { queryParams: { ...queryParams, tab } });
}

/**
 * Arquitectura por módulo/ruta: el shell (riel + contenido) es la ruta raíz y cada módulo entra como
 * hija lazy. Los módulos son los de `KIBOT_NAV_ITEMS`, que es lo que pinta el riel.
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
        loadComponent: () => import('./features/inventories/inventories').then((m) => m.Inventories)
      },
      {
        path: 'control',
        title: 'Control del recorrido · KiBot',
        loadComponent: () =>
          import('./features/robot-control/robot-control').then((m) => m.RobotControl)
      },
      {
        path: 'buscar',
        title: 'Buscar cajas · KiBot',
        loadComponent: () => import('./features/search/search').then((m) => m.Search)
      },
      {
        path: 'estado',
        title: 'Estado del equipo y alertas · KiBot',
        loadComponent: () => import('./features/robot-status/robot-status').then((m) => m.RobotStatus)
      },
      {
        path: 'planos',
        title: 'Planos y zonas · KiBot',
        loadComponent: () => import('./features/maps-zones/maps-zones').then((m) => m.MapsZones)
      },

      // Rutas de antes de noviembre de 2026: ahora son pestañas.
      { path: 'buscar-robot', redirectTo: aPestana('buscar', 'robot') },
      { path: 'ubicacion', redirectTo: aPestana('control', 'ubicacion') },
      { path: 'recorrido', redirectTo: aPestana('control', 'recorrido') },
      { path: 'zonas', redirectTo: aPestana('planos', 'zonas') },
      { path: 'mapa', redirectTo: aPestana('planos', 'planos') }
    ]
  },
  { path: '**', redirectTo: '' }
];
