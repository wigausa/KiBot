import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ThemeService } from '../../../core/theme/theme.service';
import { KiBotIcon } from '../kibot-icon/kibot-icon';

/**
 * Alterna claro/oscuro. Nunca ramifica colores en TS (DESIGN.md regla 3):
 * solo escribe el modo en `ThemeService`, que aplica `data-theme` en <html>.
 */
@Component({
  selector: 'kibot-theme-toggle',
  imports: [KiBotIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="toggle" [attr.aria-label]="label()" (click)="toggle()">
      <kibot-icon [name]="isDark() ? 'moon' : 'sun'" />
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
      gap: var(--kibot-spacing-3);
      width: 100%;
      min-height: 44px;
      padding: var(--kibot-spacing-2);
      border: var(--kibot-stroke-0) solid transparent;
      border-radius: var(--kibot-radius-6);
      background: transparent;
      color: var(--kibot-fg-muted);
      font-family: var(--kibot-font-family);
      font-size: var(--kibot-font-size-subtitle);
      font-weight: var(--kibot-font-weight-regular);
      cursor: pointer;
      transition:
        background var(--kibot-motion-fast) var(--kibot-ease-standard),
        color var(--kibot-motion-fast) var(--kibot-ease-standard);
    }

    .toggle:hover {
      background: var(--kibot-surface-variant);
      color: var(--kibot-fg);
    }

    .toggle__label {
      white-space: nowrap;
    }

    kibot-icon {
      --kibot-icon-size: 24px;
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
