import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Set de íconos inline de WiDex.
 *
 * DESIGN.md sección 10 marca "Iconografía" como gap abierto: no hay librería
 * elegida. Hasta que se decida, WiDex dibuja sus propios SVG en vez de usar una
 * webfont externa (Material Symbols), porque la pantalla del robot puede
 * arrancar sin red y una webfont que no carga deja la UI sin íconos.
 *
 * El lenguaje gráfico es el mismo de los íconos de menú de WitagFrontend
 * (`src/assets/icons/menu/*.svg`): trazo fino de 1.5 sobre lienzo de ~24,
 * silueta abierta, arcos concéntricos para "señal" y pequeños bloques sólidos
 * como acento. Los motivos están adaptados a los módulos de WiDex:
 *
 * - `control` retoma los arcos de `Monitoring&Control` sobre un botón de inicio
 * - `location` retoma el pin con punto interno de `RealTimeVisualization`
 * - `status` retoma el mástil con antena y la base con bloques de `HardwareMonitoring`
 *
 * Todo va en `currentColor`: el color lo define el contenedor.
 */
export type WidexIconName =
  | 'home'
  | 'control'
  | 'search'
  | 'location'
  | 'status'
  | 'zones'
  | 'map'
  | 'chevron-right'
  | 'sun'
  | 'moon'
  | 'robot';

@Component({
  selector: 'widex-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @switch (name()) {
        <!-- Inicio: la bodega, con una caja dentro. -->
        @case ('home') {
          <path d="M2.8 10.4 12 3.4l9.2 7" />
          <path d="M5 9.7v10.9h14V9.7" />
          <rect x="10" y="13.4" width="4" height="4" rx="0.5" fill="currentColor" stroke="none" />
        }

        <!-- Control: iniciar el recorrido + arcos de señal. -->
        @case ('control') {
          <circle cx="9.6" cy="12" r="6.4" />
          <path d="M8.2 9.3 13.2 12l-5 2.7z" fill="currentColor" stroke="none" />
          <path d="M18.2 7.6a6 6 0 0 1 0 8.8" />
          <path d="M20.8 5.2a9.6 9.6 0 0 1 0 13.6" />
        }

        <!-- Buscar: lupa sobre una caja leída. -->
        @case ('search') {
          <circle cx="10.3" cy="10.3" r="6.5" />
          <path d="M15.1 15.1 20 20" />
          <rect
            x="8.6"
            y="8.6"
            width="3.4"
            height="3.4"
            rx="0.4"
            fill="currentColor"
            stroke="none"
          />
        }

        <!-- Ubicación: pin con punto interno sobre el trazo del recorrido. -->
        @case ('location') {
          <path d="M14.2 8.6c0 3.9-4.6 8.3-4.6 8.3S5 12.5 5 8.6a4.6 4.6 0 1 1 9.2 0Z" />
          <circle cx="9.6" cy="8.6" r="1.9" />
          <path d="M4.6 19.9c2.7 1.3 9.7 1.5 14.5-.6" stroke-dasharray="2 2" />
          <circle cx="19.4" cy="19.1" r="1.2" fill="currentColor" stroke="none" />
        }

        <!-- Estado: antena del robot sobre la base del equipo. -->
        @case ('status') {
          <path d="M3.4 4.6a9.6 9.6 0 0 1 14 0" />
          <path d="M6.3 7.3a5.6 5.6 0 0 1 8.2 0" />
          <circle cx="10.4" cy="10.4" r="1.9" />
          <path d="M10.4 12.3v4.8" />
          <rect x="3.2" y="17.4" width="14.4" height="4.4" rx="0.9" />
          <g fill="currentColor" stroke="none">
            <rect x="4.9" y="19" width="1.3" height="1.3" rx="0.2" />
            <rect x="7" y="19" width="1.3" height="1.3" rx="0.2" />
            <rect x="9.1" y="19" width="1.3" height="1.3" rx="0.2" />
          </g>
        }

        <!-- Zonas: plano del cooler con una zona activa. -->
        @case ('zones') {
          <rect x="2.8" y="4.8" width="18.4" height="14.4" rx="1" />
          <path d="M11.6 4.8v14.4M11.6 12h9.6" />
          <rect
            x="4.8"
            y="6.8"
            width="4.4"
            height="4.4"
            rx="0.5"
            fill="currentColor"
            stroke="none"
          />
        }

        <!-- Mapa: la rejilla de la bodega. Dos pasillos verticales entre tres bloques de
             estanteria, que es exactamente lo que describe el plano. -->
        @case ('map') {
          <rect x="2.8" y="4" width="18.4" height="16" rx="1" />
          <g fill="currentColor" stroke="none">
            <rect x="4.8" y="6.2" width="2.6" height="11.6" rx="0.4" />
            <rect x="10.7" y="6.2" width="2.6" height="11.6" rx="0.4" />
            <rect x="16.6" y="6.2" width="2.6" height="11.6" rx="0.4" />
          </g>
          <path d="M9.05 6.2v11.6M14.95 6.2v11.6" stroke-dasharray="2 1.6" />
        }

        <!-- Identidad del robot en el footer del sidebar. -->
        @case ('robot') {
          <rect x="4.8" y="7.6" width="14.4" height="11" rx="2.6" />
          <path d="M12 7.6V5.2M3.2 12.2v2.6M20.8 12.2v2.6" />
          <g fill="currentColor" stroke="none">
            <circle cx="12" cy="3.9" r="1.3" />
            <circle cx="9.2" cy="12.6" r="1.3" />
            <circle cx="14.8" cy="12.6" r="1.3" />
          </g>
        }

        @case ('sun') {
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 3.2v2.4M12 18.4v2.4M3.2 12h2.4M18.4 12h2.4M5.8 5.8l1.7 1.7M16.5 16.5l1.7 1.7M18.2 5.8l-1.7 1.7M7.5 16.5l-1.7 1.7"
          />
        }

        @case ('moon') {
          <path d="M20.2 14.6A8.6 8.6 0 0 1 9.4 3.8a8.6 8.6 0 1 0 10.8 10.8Z" />
        }

        @case ('chevron-right') {
          <path d="m9.8 6 6 6-6 6" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: var(--widex-icon-size, 24px);
      height: var(--widex-icon-size, 24px);
    }

    svg {
      width: 100%;
      height: 100%;
    }
  `
})
export class WidexIcon {
  readonly name = input.required<WidexIconName>();
}
