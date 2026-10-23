import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { KiBotIcon, KiBotIconName } from '../../shared/ui/kibot-icon/kibot-icon';

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
  imports: [KiBotIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="placeholder">
      <span class="placeholder__icon">
        <kibot-icon [name]="icon()" />
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
      gap: var(--kibot-spacing-3);
      min-height: 100%;
      padding: var(--kibot-spacing-7);
      text-align: center;
    }

    .placeholder__icon {
      --kibot-icon-size: 32px;

      display: grid;
      place-items: center;
      width: 72px;
      height: 72px;
      border-radius: var(--kibot-radius-7);
      background: var(--kibot-surface);
      color: var(--kibot-accent);
    }

    .placeholder__title {
      margin: 0;
      font-size: var(--kibot-font-size-heading3);
      font-weight: var(--kibot-font-weight-bold);
      color: var(--kibot-fg);
    }

    .placeholder__text {
      margin: 0;
      font-size: var(--kibot-font-size-body);
      color: var(--kibot-fg-muted);
    }
  `
})
export class ModulePlaceholder {
  readonly title = input('Módulo');
  readonly icon = input<KiBotIconName>('home');
}
