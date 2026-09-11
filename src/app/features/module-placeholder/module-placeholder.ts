import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { WidexIcon, WidexIconName } from '../../shared/ui/widex-icon/widex-icon';

/**
 * Andamiaje temporal de los módulos que todavía no se implementan
 * (Control, Buscar, Ubicación, Estado y Zonas).
 *
 * Existe para que el sidebar navegue de verdad desde la fase 1; cada módulo
 * lo reemplaza por su propio componente de ruta cuando se construya.
 * Recibe título e ícono por `data` de la ruta con `withComponentInputBinding`.
 */
@Component({
  selector: 'app-module-placeholder',
  imports: [WidexIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="placeholder">
      <span class="placeholder__icon">
        <widex-icon [name]="icon()" />
      </span>
      <h1 class="placeholder__title">{{ title() }}</h1>
      <p class="placeholder__text">Este módulo se construye en una fase posterior.</p>
    </section>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100%;
    }

    .placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--widex-spacing-3);
      min-height: 100%;
      padding: var(--widex-spacing-7);
      text-align: center;
    }

    .placeholder__icon {
      --widex-icon-size: 32px;

      display: grid;
      place-items: center;
      width: 72px;
      height: 72px;
      border-radius: var(--widex-radius-7);
      background: var(--widex-surface);
      color: var(--widex-accent);
    }

    .placeholder__title {
      margin: 0;
      font-size: var(--widex-font-size-heading3);
      font-weight: var(--widex-font-weight-bold);
      color: var(--widex-fg);
    }

    .placeholder__text {
      margin: 0;
      font-size: var(--widex-font-size-body);
      color: var(--widex-fg-muted);
    }
  `
})
export class ModulePlaceholder {
  readonly title = input('Módulo');
  readonly icon = input<WidexIconName>('home');
}
