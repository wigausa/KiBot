import { Injectable, computed, effect, signal } from '@angular/core';

/**
 * Modo de tema elegido por el usuario. 'system' sigue prefers-color-scheme.
 */
export type WidexThemeMode = 'light' | 'dark' | 'system';

/** Tema realmente aplicado al DOM (nunca 'system'). */
export type WidexResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'widex-theme-mode';

/**
 * Controla el tema claro/oscuro de WiDex.
 *
 * Escribe `data-theme="light"|"dark"` en <html>, que es lo que leen los
 * tokens semánticos de `src/styles/tokens/_semantic.scss`. Nunca acceder a
 * colores crudos desde componentes: usar siempre `var(--widex-*)`.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly media =
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  private readonly systemPrefersDark = signal(this.media?.matches ?? false);

  readonly mode = signal<WidexThemeMode>(this.readStoredMode());

  readonly resolvedTheme = computed<WidexResolvedTheme>(() => {
    const mode = this.mode();
    return mode === 'system' ? (this.systemPrefersDark() ? 'dark' : 'light') : mode;
  });

  constructor() {
    this.media?.addEventListener('change', (event) => this.systemPrefersDark.set(event.matches));

    effect(() => {
      const theme = this.resolvedTheme();
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
      }
    });
  }

  setMode(mode: WidexThemeMode): void {
    this.mode.set(mode);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  }

  private readStoredMode(): WidexThemeMode {
    if (typeof localStorage === 'undefined') {
      return 'system';
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  }
}
