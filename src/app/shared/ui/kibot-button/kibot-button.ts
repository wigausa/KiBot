import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type KiBotButtonVariant = 'fill' | 'outline';
export type KiBotButtonSize = 'small' | 'medium' | 'large';
export type KiBotButtonTone = 'accent' | 'error';

/**
 * El botón de KiBot, según `DESIGN.md` sección 7: radio `radius-6`, borde `stroke-0`, y los tres
 * tamaños compartiendo cuerpo de letra —solo cambia el relleno—.
 *
 * <p><b>Un hueco declarado del design system.</b> `DESIGN.md` reconoce en sus *Known Gaps* que no
 * están definidos los estados de foco, error ni deshabilitado, y dice explícitamente que no se
 * improvise un valor sino que se señale. Así que aquí el deshabilitado se resuelve con lo más
 * cercano que hay —bajar la opacidad y quitar el puntero— y queda anotado para que diseño lo cierre
 * antes de que se repita en las otras pantallas.</p>
 */
@Component({
  selector: 'kibot-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || busy()"
      [attr.aria-busy]="busy() ? 'true' : null"
      [class]="clases()"
      (click)="pressed.emit()"
    >
      <ng-content />
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    button {
      /* Seccion 7: radio 12px y borde de 1px en todas las variantes. */
      border-radius: var(--kibot-radius-6);
      border: var(--kibot-stroke-0) solid transparent;
      font-family: inherit;
      /* Los tres tamanos comparten 18px; solo cambia el padding. */
      font-size: var(--kibot-font-size-body);
      font-weight: var(--kibot-font-weight-bold);
      cursor: pointer;
      transition: opacity var(--kibot-motion-fast) var(--kibot-ease-standard);
    }

    .small {
      padding: var(--kibot-spacing-1) var(--kibot-spacing-5);
    }
    .medium {
      padding: var(--kibot-spacing-2) var(--kibot-spacing-6);
    }
    .large {
      padding: var(--kibot-spacing-3) var(--kibot-spacing-7);
    }

    .fill.accent {
      background: var(--kibot-accent-strong);
      color: var(--kibot-on-brand);
    }
    .fill.error {
      background: var(--kibot-error-strong);
      color: var(--kibot-on-brand);
    }

    .outline {
      background: transparent;
    }
    .outline.accent {
      border-color: var(--kibot-accent-strong);
      color: var(--kibot-accent-strong);
    }
    .outline.error {
      border-color: var(--kibot-error-strong);
      color: var(--kibot-error-strong);
    }

    button:hover:not(:disabled) {
      opacity: 0.85;
    }

    /* HUECO DE DESIGN.md (Known Gaps): no hay token de deshabilitado ni de foco. Esto es lo mas
       cercano que permiten los tokens que existen, y esta puesto para que se vea y se cierre. */
    button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  `
})
export class KiBotButton {
  readonly variant = input<KiBotButtonVariant>('fill');
  readonly size = input<KiBotButtonSize>('medium');
  readonly tone = input<KiBotButtonTone>('accent');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);

  /** En marcha: deshabilita sin que la pantalla tenga que acordarse de hacerlo aparte. */
  readonly busy = input(false);

  readonly pressed = output<void>();

  protected readonly clases = computed(() => `${this.variant()} ${this.size()} ${this.tone()}`);
}
