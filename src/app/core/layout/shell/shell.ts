import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { WIDEX_NAV_ITEMS } from '../../navigation/nav-items';
import { WidexIcon } from '../../../shared/ui/widex-icon/widex-icon';
import { WitagLogo } from '../../../shared/ui/witag-logo/witag-logo';
import { ThemeToggle } from '../../../shared/ui/theme-toggle/theme-toggle';

const SIDEBAR_STORAGE_KEY = 'widex-sidebar-expanded';

/**
 * Shell de la aplicación: sidebar persistente + área de contenido enrutada.
 *
 * Sigue el patrón del sidebar de WitagFrontend (`modules/home/home.page`):
 * riel comprimido por defecto, se expande al tocar el logo, ítem activo
 * resaltado y footer fijo que no scrollea con la lista de módulos.
 * Los tamaños táctiles son mayores porque WiDex corre en la pantalla del robot.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, WidexIcon, WitagLogo, ThemeToggle],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Shell {
  protected readonly navItems = WIDEX_NAV_ITEMS;
  protected readonly expanded = signal(this.readStoredExpanded());

  protected toggleSidebar(): void {
    this.expanded.update((value) => !value);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(this.expanded()));
    }
  }

  private readStoredExpanded(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  }
}
