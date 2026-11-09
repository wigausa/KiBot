import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type KiBotButtonVariant = 'fill' | 'outline';
export type KiBotButtonSize = 'small' | 'medium' | 'large';
export type KiBotButtonTone = 'accent' | 'secondary' | 'error';

/**
 * El botón de KiBot, según el sistema de diseño de Witag (2026-11): radio 12, borde 1 px; relleno
 * Primary (#D974FF) con hover al tono 400 y active al 200; contorno igual; deshabilitado al 40 % y
 * foco con contorno Primary. `secondary` (#29ABE2) es para acciones secundarias, y `error` para
 * las destructivas (detener, cerrar).
 */
@Component({
  selector: 'kibot-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || busy()"
      [attr.aria-busy]="busy() ? 'true' : null"
      [attr.aria-label]="ariaLabel()"
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

    /* Sistema de diseño Witag: radio 12, borde 1 px, hover = tono 400, active = tono 200,
       deshabilitado al 40 % y foco con contorno Primary. */
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--kibot-spacing-2);
      width: 100%;
      border-radius: var(--kibot-radius-6);
      border: var(--kibot-stroke-0) solid transparent;
      font-family: inherit;
      font-size: var(--kibot-font-size-body);
      font-weight: var(--kibot-font-weight-bold);
      line-height: 1.4;
      cursor: pointer;
      transition:
        background var(--kibot-motion-fast) var(--kibot-ease-standard),
        border-color var(--kibot-motion-fast) var(--kibot-ease-standard),
        color var(--kibot-motion-fast) var(--kibot-ease-standard);
    }

    button:focus-visible {
      outline: 2px solid var(--kibot-accent);
      outline-offset: 2px;
    }

    .small {
      min-height: 2.25rem;
      padding: var(--kibot-spacing-1) var(--kibot-spacing-5);
    }
    .medium {
      min-height: 2.75rem;
      padding: var(--kibot-spacing-2) var(--kibot-spacing-6);
    }
    .large {
      min-height: 3.25rem;
      padding: var(--kibot-spacing-3) var(--kibot-spacing-7);
      font-size: var(--kibot-font-size-caption);
    }

    /* Relleno: el texto va en navy, que es lo que da contraste sobre #D974FF y #29ABE2. */
    .fill.accent {
      background: var(--kibot-accent);
      color: var(--kibot-on-accent);
    }
    .fill.accent:hover:not(:disabled) {
      background: var(--kibot-accent-hover);
      color: var(--kibot-on-brand);
    }
    .fill.accent:active:not(:disabled) {
      background: var(--kibot-accent-active);
      color: var(--kibot-on-accent);
    }

    .fill.secondary {
      background: var(--kibot-secondary);
      color: var(--kibot-on-accent);
    }
    .fill.secondary:hover:not(:disabled) {
      background: var(--kibot-secondary-hover);
      color: var(--kibot-on-brand);
    }
    .fill.secondary:active:not(:disabled) {
      background: var(--kibot-secondary-active);
    }

    .fill.error {
      background: var(--kibot-error-strong);
      color: var(--kibot-on-brand);
    }
    .fill.error:hover:not(:disabled) {
      background: var(--kibot-error);
    }

    .outline {
      background: transparent;
    }
    .outline.accent {
      border-color: var(--kibot-accent);
      color: var(--kibot-accent-strong);
    }
    .outline.accent:hover:not(:disabled) {
      background: var(--kibot-accent-hover);
      border-color: var(--kibot-accent-hover);
      color: var(--kibot-on-brand);
    }
    .outline.accent:active:not(:disabled) {
      border-color: var(--kibot-accent-active);
    }
    .outline.secondary {
      border-color: var(--kibot-secondary);
      color: var(--kibot-secondary-strong);
    }
    .outline.secondary:hover:not(:disabled) {
      background: var(--kibot-secondary-hover);
      border-color: var(--kibot-secondary-hover);
      color: var(--kibot-on-brand);
    }
    .outline.error {
      border-color: var(--kibot-error-text);
      color: var(--kibot-error-text);
    }
    .outline.error:hover:not(:disabled) {
      background: var(--kibot-error-strong);
      color: var(--kibot-on-brand);
    }

    button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `
})
export class KiBotButton {
  readonly variant = input<KiBotButtonVariant>('fill');
  readonly size = input<KiBotButtonSize>('medium');
  readonly tone = input<KiBotButtonTone>('accent');
  readonly type = input<'button' | 'submit'>('button');
  /** Etiqueta para lectores de pantalla cuando el botón solo lleva un icono. */
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false);

  /** En marcha: deshabilita sin que la pantalla tenga que acordarse de hacerlo aparte. */
  readonly busy = input(false);

  readonly pressed = output<void>();

  protected readonly clases = computed(() => `${this.variant()} ${this.size()} ${this.tone()}`);
}
