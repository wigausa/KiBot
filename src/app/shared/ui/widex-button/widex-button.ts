import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type WidexButtonVariant = 'fill' | 'outline';
export type WidexButtonSize = 'small' | 'medium' | 'large';
export type WidexButtonTone = 'accent' | 'error';

/**
 * El botón de WiDex, según `DESIGN.md` sección 7: radio `radius-6`, borde `stroke-0`, y los tres
 * tamaños compartiendo cuerpo de letra —solo cambia el relleno—.
 *
 * <p><b>Un hueco declarado del design system.</b> `DESIGN.md` reconoce en sus *Known Gaps* que no
 * están definidos los estados de foco, error ni deshabilitado, y dice explícitamente que no se
 * improvise un valor sino que se señale. Así que aquí el deshabilitado se resuelve con lo más
 * cercano que hay —bajar la opacidad y quitar el puntero— y queda anotado para que diseño lo cierre
 * antes de que se repita en las otras pantallas.</p>
 */
@Component({
  selector: 'widex-button',
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
      border-radius: var(--widex-radius-6);
      border: var(--widex-stroke-0) solid transparent;
      font-family: inherit;
      /* Los tres tamanos comparten 18px; solo cambia el padding. */
      font-size: var(--widex-font-size-body);
      font-weight: var(--widex-font-weight-bold);
      cursor: pointer;
      transition: opacity var(--widex-motion-fast) var(--widex-ease-standard);
    }

    .small {
      padding: var(--widex-spacing-1) var(--widex-spacing-5);
    }
    .medium {
      padding: var(--widex-spacing-2) var(--widex-spacing-6);
    }
    .large {
      padding: var(--widex-spacing-3) var(--widex-spacing-7);
    }

    .fill.accent {
      background: var(--widex-accent-strong);
      color: var(--widex-on-brand);
    }
    .fill.error {
      background: var(--widex-error-strong);
      color: var(--widex-on-brand);
    }

    .outline {
      background: transparent;
    }
    .outline.accent {
      border-color: var(--widex-accent-strong);
      color: var(--widex-accent-strong);
    }
    .outline.error {
      border-color: var(--widex-error-strong);
      color: var(--widex-error-strong);
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
export class WidexButton {
  readonly variant = input<WidexButtonVariant>('fill');
  readonly size = input<WidexButtonSize>('medium');
  readonly tone = input<WidexButtonTone>('accent');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);

  /** En marcha: deshabilita sin que la pantalla tenga que acordarse de hacerlo aparte. */
  readonly busy = input(false);

  readonly pressed = output<void>();

  protected readonly clases = computed(() => `${this.variant()} ${this.size()} ${this.tone()}`);
}
