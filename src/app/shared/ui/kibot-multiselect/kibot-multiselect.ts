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

export type KiBotOpcionId = number | string;

export interface KiBotOpcion {
  readonly id: KiBotOpcionId;
  readonly nombre: string;
  /** Si viene, la opción no se puede elegir y se enseña el porqué («en «Octubre»»). */
  readonly motivo?: string | null;
}

/** A partir de cuántas opciones aparece el buscador. */
const CON_BUSCADOR = 6;
/** Cuántas elegidas se ven como chip en el botón antes del «+N». */
const CHIPS_VISIBLES = 3;

let siguienteId = 0;

/**
 * Elegir varias de una lista (zonas, robots), como un desplegable: un botón con lo elegido en chips
 * y, al abrirlo, la lista con casillas, un buscador si son muchas y «Todas / Ninguna».
 *
 * <p>Con `ordenado`, lo elegido tiene turno (1, 2, 3…), el que se le da al marcar, y debajo se puede
 * subir o bajar: es el orden de un recorrido de varias zonas.</p>
 *
 * <p>Accesible: `listbox` con `aria-multiselectable`; flechas, Inicio/Fin, Espacio o Intro para
 * marcar y Esc para cerrar. Solo pinta y avisa: quien lo usa guarda la selección.</p>
 */
@Component({
  selector: 'kibot-multiselect',
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
      [attr.aria-label]="etiqueta() + (elegidas().length ? ': ' + resumen() : '')"
      (click)="alternar()"
      (keydown)="alTeclearDisparador($event)"
    >
      @if (elegidas().length === 0) {
        <span class="disparador__vacio">{{ placeholder() }}</span>
      } @else {
        <span class="disparador__chips">
          @for (o of visibles(); track o.id; let i = $index) {
            <span class="mini-chip">
              @if (ordenado()) {
                <span class="mini-chip__orden">{{ i + 1 }}</span>
              }
              {{ o.nombre }}
            </span>
          }
          @if (ocultas() > 0) {
            <span class="mini-chip mini-chip--mas">+{{ ocultas() }}</span>
          }
        </span>
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
        <div class="panel__atajos">
          <span class="panel__cuenta">{{ elegidas().length }} de {{ opciones().length }}</span>
          <button type="button" class="panel__atajo" (click)="todas()">Todas</button>
          <button type="button" class="panel__atajo" (click)="ninguna()">Ninguna</button>
        </div>
        <ul
          #lista
          class="panel__lista"
          role="listbox"
          tabindex="-1"
          aria-multiselectable="true"
          [id]="idLista"
          [attr.aria-label]="etiqueta()"
          [attr.aria-activedescendant]="activa() !== null ? idLista + '-' + activa() : null"
          (keydown)="alTeclearLista($event)"
        >
          @for (o of filtradas(); track o.id; let i = $index) {
            <li
              role="option"
              class="opcion"
              [id]="idLista + '-' + i"
              [class.opcion--activa]="i === activa()"
              [class.opcion--marcada]="marcada(o.id)"
              [class.opcion--bloqueada]="!!o.motivo"
              [attr.aria-selected]="marcada(o.id)"
              [attr.aria-disabled]="!!o.motivo"
              (mouseenter)="activa.set(i)"
              (click)="marcar(o)"
            >
              <span class="opcion__casilla" aria-hidden="true">
                @if (ordenado() && ordenDe(o.id); as n) {
                  {{ n }}
                } @else if (marcada(o.id)) {
                  ✓
                }
              </span>
              <span class="opcion__nombre">{{ o.nombre }}</span>
              @if (o.motivo) {
                <span class="opcion__motivo">{{ o.motivo }}</span>
              }
            </li>
          } @empty {
            <li class="opcion opcion--vacia">Nada coincide con «{{ filtro() }}».</li>
          }
        </ul>
      </div>
    }

    @if (ordenado() && elegidas().length > 1) {
      <ol class="orden" [attr.aria-label]="'Orden de ' + etiqueta()">
        @for (o of elegidas(); track o.id; let primera = $first, ultima = $last, i = $index) {
          <li class="orden__fila">
            <span class="mini-chip__orden">{{ i + 1 }}</span>
            <span class="orden__nombre">{{ o.nombre }}</span>
            <button type="button" class="orden__mover" [disabled]="primera || deshabilitado()"
                    [attr.aria-label]="'Subir ' + o.nombre" (click)="mover(o.id, -1)">↑</button>
            <button type="button" class="orden__mover" [disabled]="ultima || deshabilitado()"
                    [attr.aria-label]="'Bajar ' + o.nombre" (click)="mover(o.id, 1)">↓</button>
          </li>
        }
      </ol>
    }
  `,
  styleUrl: './kibot-desplegable.scss'
})
export class KiBotMultiselect {
  readonly opciones = input.required<readonly KiBotOpcion[]>();
  readonly seleccionadas = input.required<readonly KiBotOpcionId[]>();
  /** Para lectores de pantalla y el buscador: de qué es la lista («Zonas»). */
  readonly etiqueta = input('Opciones');
  readonly placeholder = input('Elige…');
  readonly ordenado = input(false);
  readonly deshabilitado = input(false);
  readonly cambia = output<KiBotOpcionId[]>();

  protected readonly conBuscador = CON_BUSCADOR;
  protected readonly idLista = `kibot-multiselect-${siguienteId++}`;

  protected readonly abierto = signal(false);
  protected readonly filtro = signal('');
  protected readonly activa = signal<number | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly disparador = viewChild<ElementRef<HTMLButtonElement>>('disparador');
  private readonly lista = viewChild<ElementRef<HTMLUListElement>>('lista');
  private readonly buscador = viewChild<ElementRef<HTMLInputElement>>('buscador');

  /** Las elegidas, en su orden (el de `seleccionadas`). */
  protected readonly elegidas = computed(() => {
    const porId = new Map(this.opciones().map((o) => [o.id, o]));
    return this.seleccionadas()
      .map((id) => porId.get(id))
      .filter((o): o is KiBotOpcion => o !== undefined);
  });

  protected readonly visibles = computed(() => this.elegidas().slice(0, CHIPS_VISIBLES));
  protected readonly ocultas = computed(() => Math.max(0, this.elegidas().length - CHIPS_VISIBLES));
  protected readonly resumen = computed(() => this.elegidas().map((o) => o.nombre).join(', '));

  protected readonly filtradas = computed(() => {
    const f = normalizar(this.filtro());
    return f === '' ? this.opciones() : this.opciones().filter((o) => normalizar(o.nombre).includes(f));
  });

  protected marcada(id: KiBotOpcionId): boolean {
    return this.seleccionadas().includes(id);
  }

  protected ordenDe(id: KiBotOpcionId): number | null {
    const i = this.seleccionadas().indexOf(id);
    return i === -1 ? null : i + 1;
  }

  protected alternar(): void {
    if (this.abierto()) this.cerrar(false);
    else this.abrir();
  }

  /** Marcar la pone al final (su turno); desmarcarla la quita y las de detrás suben. */
  protected marcar(o: KiBotOpcion): void {
    if (o.motivo || this.deshabilitado()) return;
    const actuales = this.seleccionadas();
    this.cambia.emit(actuales.includes(o.id) ? actuales.filter((x) => x !== o.id) : [...actuales, o.id]);
  }

  protected todas(): void {
    const libres = this.opciones().filter((o) => !o.motivo).map((o) => o.id);
    // Las que ya estaban conservan su turno; las demás van detrás.
    this.cambia.emit([...this.seleccionadas(), ...libres.filter((id) => !this.seleccionadas().includes(id))]);
  }

  protected ninguna(): void {
    this.cambia.emit([]);
  }

  protected mover(id: KiBotOpcionId, sentido: -1 | 1): void {
    const lista = [...this.seleccionadas()];
    const i = lista.indexOf(id);
    const j = i + sentido;
    if (i === -1 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    this.cambia.emit(lista);
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
        // En el buscador, el espacio es parte del texto.
        if (evento.key === ' ' && evento.target === this.buscador()?.nativeElement) return;
        evento.preventDefault();
        if (actual >= 0 && actual < total) this.marcar(this.filtradas()[actual]);
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
    this.verActiva();
  }

  protected alClicFuera(evento: MouseEvent): void {
    if (this.abierto() && !this.host.nativeElement.contains(evento.target as Node)) this.cerrar(false);
  }

  private abrir(): void {
    if (this.deshabilitado()) return;
    this.filtro.set('');
    this.activa.set(this.opciones().length > 0 ? 0 : null);
    this.abierto.set(true);
    queueMicrotask(() => (this.buscador()?.nativeElement ?? this.lista()?.nativeElement)?.focus());
  }

  private cerrar(devolverFoco: boolean): void {
    this.abierto.set(false);
    if (devolverFoco) this.disparador()?.nativeElement.focus();
  }

  private verActiva(): void {
    const i = this.activa();
    if (i === null) return;
    queueMicrotask(() =>
      this.lista()?.nativeElement.querySelector(`#${this.idLista}-${i}`)?.scrollIntoView({ block: 'nearest' })
    );
  }
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
