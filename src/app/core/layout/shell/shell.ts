import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { KIBOT_NAV_ITEMS } from '../../navigation/nav-items';
import { Sesion } from '../../auth/sesion';
import { KiBotIcon } from '../../../shared/ui/kibot-icon/kibot-icon';
import { WitagLogo } from '../../../shared/ui/witag-logo/witag-logo';
import { ThemeToggle } from '../../../shared/ui/theme-toggle/theme-toggle';
import { KiBotConfirmHost } from '../../../shared/ui/kibot-confirm/kibot-confirm';
import { MiniPlayer } from '../mini-player/mini-player';

const SIDEBAR_STORAGE_KEY = 'kibot-sidebar-expanded';

/**
 * Shell de la aplicación: riel persistente (navy, como el mockup), el área de contenido enrutada, el
 * mini-reproductor del recorrido en curso y el diálogo de confirmación de toda la aplicación.
 *
 * <p>El riel va comprimido por defecto —icono y nombre corto debajo— y se expande al tocar el logo.
 * Los tamaños táctiles son mayores porque KiBot corre en la pantalla del robot.</p>
 */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    KiBotIcon,
    WitagLogo,
    ThemeToggle,
    MiniPlayer,
    KiBotConfirmHost
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Shell {
  protected readonly navItems = KIBOT_NAV_ITEMS;
  // Quién está dentro y cerrar sesión. Sin login (desarrollo local) no se pinta.
  protected readonly sesion = inject(Sesion);
  protected readonly expanded = signal(this.readStoredExpanded());

  private readonly router = inject(Router);

  /** En Control el recorrido ya se ve en grande: ahí el mini-reproductor sobra. */
  protected readonly enControl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => esControl(e.urlAfterRedirects))
    ),
    { initialValue: esControl(this.router.url) }
  );

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

function esControl(url: string): boolean {
  return url === '/control' || url.startsWith('/control?') || url.startsWith('/control/');
}
