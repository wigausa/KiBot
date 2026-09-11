import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ThemeService } from '../../../core/theme/theme.service';
import { WidexIcon } from '../widex-icon/widex-icon';

/**
 * Alterna claro/oscuro. Nunca ramifica colores en TS (DESIGN.md regla 3):
 * solo escribe el modo en `ThemeService`, que aplica `data-theme` en <html>.
 */
@Component({
  selector: 'widex-theme-toggle',
  imports: [WidexIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="toggle" [attr.aria-label]="label()" (click)="toggle()">
      <widex-icon [name]="isDark() ? 'moon' : 'sun'" />
      @if (showLabel()) {
        <span class="toggle__label">{{ label() }}</span>
      }
    </button>
  `,
  styles: `
    :host {
      display: block;
    }

    .toggle {
      display: flex;
      align-items: center;
      gap: var(--widex-spacing-3);
      width: 100%;
      min-height: 44px;
      padding: var(--widex-spacing-2);
      border: var(--widex-stroke-0) solid transparent;
      border-radius: var(--widex-radius-6);
      background: transparent;
      color: var(--widex-fg-muted);
      font-family: var(--widex-font-family);
      font-size: var(--widex-font-size-subtitle);
      font-weight: var(--widex-font-weight-regular);
      cursor: pointer;
      transition:
        background var(--widex-motion-fast) var(--widex-ease-standard),
        color var(--widex-motion-fast) var(--widex-ease-standard);
    }

    .toggle:hover {
      background: var(--widex-surface-variant);
      color: var(--widex-fg);
    }

    .toggle__label {
      white-space: nowrap;
    }

    widex-icon {
      --widex-icon-size: 24px;
      flex-shrink: 0;
    }
  `
})
export class ThemeToggle {
  private readonly theme = inject(ThemeService);

  readonly showLabel = input(true);

  protected readonly isDark = computed(() => this.theme.resolvedTheme() === 'dark');
  protected readonly label = computed(() => (this.isDark() ? 'Modo oscuro' : 'Modo claro'));

  protected toggle(): void {
    this.theme.setMode(this.isDark() ? 'light' : 'dark');
  }
}
