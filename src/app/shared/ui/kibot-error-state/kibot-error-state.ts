import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Lo que se enseña cuando algo falló.
 *
 * <p>Enseña el mensaje del backend y no uno genérico, porque el backend escribe los suyos para que
 * los lea una persona: «la excepción entre 1 y 3 no corresponde a dos pasillos consecutivos» dice
 * qué arreglar, y «se produjo un error» no dice nada.</p>
 *
 * <p>`details` es para los errores que vienen en lista —un plano puede fallar por cinco motivos a
 * la vez— y se enseñan todos: arreglar uno y volver a tropezar con el siguiente es la forma más
 * segura de que alguien abandone.</p>
 */
@Component({
  selector: 'kibot-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'alert' },
  template: `
    <p class="mensaje">{{ message() }}</p>

    @if (details().length > 0) {
      <ul class="detalles">
        @for (detalle of details(); track detalle) {
          <li>{{ detalle }}</li>
        }
      </ul>
    }

    @if (showRetry()) {
      <button type="button" class="reintentar" (click)="retry.emit()">
        {{ retryLabel() }}
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--kibot-spacing-3);
      padding: var(--kibot-spacing-5);
      border: var(--kibot-stroke-0) solid var(--kibot-error);
      border-radius: var(--kibot-radius-6);
      background: var(--kibot-surface);
      /* Un mensaje de error suele traer una URL o un id sin espacios. Sin esto se sale de la caja
         y empuja el ancho de la pagina entera. */
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .mensaje {
      margin: 0;
      color: var(--kibot-error-strong);
      font-size: var(--kibot-font-size-body);
      font-weight: var(--kibot-font-weight-bold);
    }

    .detalles {
      margin: 0;
      padding-inline-start: var(--kibot-spacing-5);
      display: flex;
      flex-direction: column;
      gap: var(--kibot-spacing-1);
      color: var(--kibot-fg-muted);
      font-size: var(--kibot-font-size-body);
      font-weight: var(--kibot-font-weight-regular);
    }

    .reintentar {
      align-self: flex-start;
      /* Boton outline, tamano Medium: DESIGN.md seccion 7. */
      padding: var(--kibot-spacing-2) var(--kibot-spacing-6);
      border: var(--kibot-stroke-0) solid var(--kibot-error);
      border-radius: var(--kibot-radius-6);
      background: transparent;
      color: var(--kibot-error-strong);
      font: inherit;
      font-size: var(--kibot-font-size-body);
      cursor: pointer;
    }
  `
})
export class KiBotErrorState {
  readonly message = input.required<string>();
  readonly details = input<readonly string[]>([]);
  readonly showRetry = input(true);
  readonly retryLabel = input('Reintentar');

  readonly retry = output<void>();
}
