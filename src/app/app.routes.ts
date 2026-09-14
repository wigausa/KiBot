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
        title: 'Control y filtro del recorrido · Widex',
        loadComponent: () => import('./features/control/control').then((m) => m.Control)
      },
      placeholder('buscar', 'Búsqueda de cajas leídas', 'search'),
      placeholder('ubicacion', 'Ubicación en tiempo real', 'location'),
      placeholder('estado', 'Estado del equipo y alertas', 'status'),
      placeholder('zonas', 'Configuración de zonas', 'zones')
    ]
  },
  { path: '**', redirectTo: '' }
];
