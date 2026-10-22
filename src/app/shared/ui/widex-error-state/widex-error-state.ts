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
  selector: 'widex-error-state',
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
      gap: var(--widex-spacing-3);
      padding: var(--widex-spacing-5);
      border: var(--widex-stroke-0) solid var(--widex-error);
      border-radius: var(--widex-radius-6);
      background: var(--widex-surface);
      /* Un mensaje de error suele traer una URL o un id sin espacios. Sin esto se sale de la caja
         y empuja el ancho de la pagina entera. */
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .mensaje {
      margin: 0;
      color: var(--widex-error-strong);
      font-size: var(--widex-font-size-body);
      font-weight: var(--widex-font-weight-bold);
    }

    .detalles {
      margin: 0;
      padding-inline-start: var(--widex-spacing-5);
      display: flex;
      flex-direction: column;
      gap: var(--widex-spacing-1);
      color: var(--widex-fg-muted);
      font-size: var(--widex-font-size-body);
      font-weight: var(--widex-font-weight-regular);
    }

    .reintentar {
      align-self: flex-start;
      /* Boton outline, tamano Medium: DESIGN.md seccion 7. */
      padding: var(--widex-spacing-2) var(--widex-spacing-6);
      border: var(--widex-stroke-0) solid var(--widex-error);
      border-radius: var(--widex-radius-6);
      background: transparent;
      color: var(--widex-error-strong);
      font: inherit;
      font-size: var(--widex-font-size-body);
      cursor: pointer;
    }
  `
})
export class WidexErrorState {
  readonly message = input.required<string>();
  readonly details = input<readonly string[]>([]);
  readonly showRetry = input(true);
  readonly retryLabel = input('Reintentar');

  readonly retry = output<void>();
}
