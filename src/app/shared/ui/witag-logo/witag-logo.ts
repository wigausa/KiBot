import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ThemeService } from '../../../core/theme/theme.service';

export type WitagLogoVariant = 'full' | 'icon';

/**
 * `auto` sigue el tema; `on-brand` fuerza la versión blanca para superficies
 * con el gradiente de marca, donde el tema claro dejaría el logo ilegible.
 */
export type WitagLogoTone = 'auto' | 'on-brand';

/** Relación de aspecto de los SVG originales (public/brand). */
const ASPECT: Record<WitagLogoVariant, number> = {
  full: 992.98 / 233.93,
  icon: 113.85 / 100.01
};

/**
 * Logo de Witag, con variante clara/oscura resuelta por `ThemeService`.
 *
 * PROVISIONAL: los archivos de `public/brand/` son los del proyecto Witag
 * (WitagAndroid `brand/witag-logo.svg` y las variantes de identidad de
 * WitagFrontend). Se reemplazan por los de KiBot cuando marca los entregue;
 * al ser los mismos nombres de archivo, no hay que tocar este componente.
 */
@Component({
  selector: 'witag-logo',
  imports: [NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // El ancho vive en el host para que el <img> (width: 100%) tenga una caja de
  // referencia; sin esto el logo se estira al tamaño del contenedor.
  host: { '[style.width.px]': 'width()' },
  template: `
    <img
      [ngSrc]="src()"
      [width]="width()"
      [height]="height()"
      [priority]="priority()"
      [alt]="alt()"
    />
  `,
  styles: `
    :host {
      display: inline-flex;
      max-width: 100%;
    }

    img {
      width: 100%;
      height: auto;
      object-fit: contain;
    }
  `
})
export class WitagLogo {
  private readonly theme = inject(ThemeService);

  readonly variant = input<WitagLogoVariant>('full');
  /** Ancho de referencia en px; el alto se deriva de la relación de aspecto. */
  readonly width = input(160);
  readonly priority = input(false);
  readonly tone = input<WitagLogoTone>('auto');
  readonly alt = input('Witag');

  protected readonly height = computed(() => Math.round(this.width() / ASPECT[this.variant()]));

  protected readonly src = computed(() => {
    const base = this.variant() === 'icon' ? 'brand/witag-icon' : 'brand/witag-logo';
    const useLightMark = this.tone() === 'on-brand' || this.theme.resolvedTheme() === 'dark';
    return useLightMark ? `${base}-dark.svg` : `${base}.svg`;
  });
}
