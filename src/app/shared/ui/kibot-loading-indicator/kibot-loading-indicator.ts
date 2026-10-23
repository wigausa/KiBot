import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { KiBotLoader } from '../kibot-loader/kibot-loader';

/**
 * El estado de «cargando» de una sección: el spinner de marca con su sitio reservado.
 *
 * <p><b>Envuelve a `KiBotLoader` en vez de dibujar otro spinner.</b> Un segundo indicador de carga
 * sería el primer sitio por el que el design system se bifurca: dos animaciones que se parecen pero
 * no son iguales, y nadie sabría cuál usar.</p>
 *
 * <p>Lo que añade es el encuadre —centrado, con aire alrededor— para que una sección que espera no
 * salte de alto cuando llega el contenido.</p>
 */
@Component({
  selector: 'kibot-loading-indicator',
  imports: [KiBotLoader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <kibot-loader [size]="size()" [label]="label()" [showMark]="size() >= 64" />
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      padding-block: var(--kibot-spacing-7);
      min-height: var(--kibot-loading-min-height, 0);
    }
  `
})
export class KiBotLoadingIndicator {
  readonly size = input(64);

  /** Qué se está esperando. Lo lee un lector de pantalla, así que conviene que lo diga. */
  readonly label = input<string | null>(null);
}
