import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';

import { KiBotOpcionId } from '../kibot-multiselect/kibot-multiselect';

export interface KiBotSelectOpcion {
  readonly id: KiBotOpcionId;
  readonly nombre: string;
  /** Texto pequeño a la derecha (p. ej. «v3», «Cerrado»). */
  readonly detalle?: string | null;
  /** Si viene, no se puede elegir y se enseña el porqué. */
  readonly motivo?: string | null;
  /** Las opciones con el mismo grupo van juntas bajo su título («Abiertos», «Cerrados»). */
  readonly grupo?: string | null;
}

const CON_BUSCADOR = 6;
let siguienteId = 0;

/**
 * Elegir UNA de una lista (inventario, robot, compañía, plano), con el mismo diseño que
 * `kibot-multiselect`: un botón con lo elegido y, al abrirlo, la lista —con buscador si son muchas y
 * títulos de grupo—. Sustituye al `<select>` nativo, que no se puede estilar por dentro.
 *
 * <p>Accesible como un combobox: `listbox`, flechas, Inicio/Fin, Intro o Espacio para elegir y Esc
 * para cerrar. Solo pinta y avisa: quien lo usa guarda la elección.</p>
 */
@Component({
  selector: 'kibot-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'alClicFuera($event)',
    '[class.abierto]': 'abierto()'
  },
  template: `
    <button
      #disparador
      type="button"
      class="disparador"
      [disabled]="deshabilitado()"
      [attr.aria-haspopup]="'listbox'"
      [attr.aria-expanded]="abierto()"
      [attr.aria-controls]="idLista"
      [attr.aria-label]="etiqueta() + ': ' + (elegida()?.nombre ?? placeholder())"
      (click)="alternar()"
      (keydown)="alTeclearDisparador($event)"
    >
      @if (elegida(); as o) {
        <span class="disparador__valor">{{ o.nombre }}</span>
        @if (o.detalle) {
          <span class="disparador__detalle">{{ o.detalle }}</span>
        }
      } @else {
        <span class="disparador__vacio">{{ placeholder() }}</span>
      }
      <span class="disparador__flecha" aria-hidden="true"></span>
    </button>

    @if (abierto()) {
      <div class="panel">
        @if (opciones().length > conBuscador) {
          <input
            #buscador
            class="panel__buscar"
            type="search"
            placeholder="Buscar…"
            [attr.aria-label]="'Buscar en ' + etiqueta()"
            [value]="filtro()"
            (input)="alFiltrar($event)"
            (keydown)="alTeclearLista($event)"
          />
        }
        <ul
          #lista
          class="panel__lista"
          role="listbox"
          tabindex="-1"
          [id]="idLista"
          [attr.aria-label]="etiqueta()"
          [attr.aria-activedescendant]="activa() !== null ? idLista + '-' + activa() : null"
          (keydown)="alTeclearLista($event)"
        >
          @if (permitirNinguna()) {
            <li role="option" class="opcion" [class.opcion--marcada]="seleccionada() === null"
                [attr.aria-selected]="seleccionada() === null" (click)="elegir(null)">
              <span class="opcion__punto" aria-hidden="true"></span>
              <span class="opcion__nombre disparador__vacio">{{ placeholder() }}</span>
            </li>
          }
          @for (o of filtradas(); track o.id; let i = $index) {
            @if (o.grupo && o.grupo !== filtradas()[i - 1]?.grupo) {
              <li class="grupo" role="presentation">{{ o.grupo }}</li>
            }
            <li
              role="option"
              class="opcion"
              [id]="idLista + '-' + i"
              [class.opcion--activa]="i === activa()"
              [class.opcion--marcada]="o.id === seleccionada()"
              [class.opcion--bloqueada]="!!o.motivo"
              [attr.aria-selected]="o.id === seleccionada()"
              [attr.aria-disabled]="!!o.motivo"
              (mouseenter)="activa.set(i)"
              (click)="elegir(o)"
            >
              <span class="opcion__punto" aria-hidden="true"></span>
              <span class="opcion__nombre">{{ o.nombre }}</span>
              @if (o.motivo) {
                <span class="opcion__motivo">{{ o.motivo }}</span>
              } @else if (o.detalle) {
                <span class="opcion__detalle">{{ o.detalle }}</span>
              }
            </li>
          } @empty {
            <li class="opcion opcion--vacia">
              {{ filtro() ? 'Nada coincide con «' + filtro() + '».' : vacio() }}
            </li>
          }
        </ul>
      </div>
    }
  `,
  styleUrl: '../kibot-multiselect/kibot-desplegable.scss'
})
export class KiBotSelect {
  readonly opciones = input.required<readonly KiBotSelectOpcion[]>();
  readonly seleccionada = input<KiBotOpcionId | null>(null);
  readonly etiqueta = input('Opciones');
  readonly placeholder = input('Elige…');
  /** Lo que se dice si no hay ninguna opción. */
  readonly vacio = input('No hay opciones.');
  /** Ofrece volver a «ninguna» (el placeholder) como primera opción. */
  readonly permitirNinguna = input(false);
  readonly deshabilitado = input(false);
  readonly cambia = output<KiBotOpcionId | null>();

  protected readonly conBuscador = CON_BUSCADOR;
  protected readonly idLista = `kibot-select-${siguienteId++}`;

  protected readonly abierto = signal(false);
  protected readonly filtro = signal('');
  protected readonly activa = signal<number | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly disparador = viewChild<ElementRef<HTMLButtonElement>>('disparador');
  private readonly lista = viewChild<ElementRef<HTMLUListElement>>('lista');
  private readonly buscador = viewChild<ElementRef<HTMLInputElement>>('buscador');

  protected readonly elegida = computed(() => this.opciones().find((o) => o.id === this.seleccionada()) ?? null);

  protected readonly filtradas = computed(() => {
    const f = normalizar(this.filtro());
    return f === '' ? this.opciones() : this.opciones().filter((o) => normalizar(o.nombre).includes(f));
  });

  protected alternar(): void {
    if (this.abierto()) this.cerrar(false);
    else this.abrir();
  }

  protected elegir(o: KiBotSelectOpcion | null): void {
    if (o?.motivo) return;
    const id = o?.id ?? null;
    if (id !== this.seleccionada()) this.cambia.emit(id);
    this.cerrar(true);
  }

  protected alFiltrar(evento: Event): void {
    this.filtro.set((evento.target as HTMLInputElement).value);
    this.activa.set(this.filtradas().length > 0 ? 0 : null);
  }

  protected alTeclearDisparador(evento: KeyboardEvent): void {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      this.abrir();
    }
  }

  protected alTeclearLista(evento: KeyboardEvent): void {
    const total = this.filtradas().length;
    const actual = this.activa() ?? -1;
    switch (evento.key) {
      case 'ArrowDown':
        evento.preventDefault();
        if (total) this.activa.set((actual + 1) % total);
        break;
      case 'ArrowUp':
        evento.preventDefault();
        if (total) this.activa.set((actual - 1 + total) % total);
        break;
      case 'Home':
        if (evento.target === this.lista()?.nativeElement && total) {
          evento.preventDefault();
          this.activa.set(0);
        }
        break;
      case 'End':
        if (evento.target === this.lista()?.nativeElement && total) {
          evento.preventDefault();
          this.activa.set(total - 1);
        }
        break;
      case 'Enter':
      case ' ':
        if (evento.key === ' ' && evento.target === this.buscador()?.nativeElement) return;
        evento.preventDefault();
        if (actual >= 0 && actual < total) this.elegir(this.filtradas()[actual]);
        break;
      case 'Escape':
        evento.preventDefault();
        evento.stopPropagation(); // que no cierre también el panel lateral de detrás
        this.cerrar(true);
        break;
      case 'Tab':
        this.cerrar(false);
        break;
    }
    const i = this.activa();
    if (i !== null)
      queueMicrotask(() =>
        this.lista()?.nativeElement.querySelector(`#${this.idLista}-${i}`)?.scrollIntoView({ block: 'nearest' })
      );
  }

  protected alClicFuera(evento: MouseEvent): void {
    if (this.abierto() && !this.host.nativeElement.contains(evento.target as Node)) this.cerrar(false);
  }

  private abrir(): void {
    if (this.deshabilitado()) return;
    this.filtro.set('');
    const i = this.opciones().findIndex((o) => o.id === this.seleccionada());
    this.activa.set(i >= 0 ? i : this.opciones().length > 0 ? 0 : null);
    this.abierto.set(true);
    queueMicrotask(() => (this.buscador()?.nativeElement ?? this.lista()?.nativeElement)?.focus());
  }

  private cerrar(devolverFoco: boolean): void {
    this.abierto.set(false);
    if (devolverFoco) this.disparador()?.nativeElement.focus();
  }
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
