import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { WidexLoader } from '../widex-loader/widex-loader';

/**
 * El estado de «cargando» de una sección: el spinner de marca con su sitio reservado.
 *
 * <p><b>Envuelve a `WidexLoader` en vez de dibujar otro spinner.</b> Un segundo indicador de carga
 * sería el primer sitio por el que el design system se bifurca: dos animaciones que se parecen pero
 * no son iguales, y nadie sabría cuál usar.</p>
 *
 * <p>Lo que añade es el encuadre —centrado, con aire alrededor— para que una sección que espera no
 * salte de alto cuando llega el contenido.</p>
 */
@Component({
  selector: 'widex-loading-indicator',
  imports: [WidexLoader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <widex-loader [size]="size()" [label]="label()" [showMark]="size() >= 64" />
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      padding-block: var(--widex-spacing-7);
      min-height: var(--widex-loading-min-height, 0);
    }
  `
})
export class WidexLoadingIndicator {
  readonly size = input(64);

  /** Qué se está esperando. Lo lee un lector de pantalla, así que conviene que lo diga. */
  readonly label = input<string | null>(null);
}
