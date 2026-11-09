import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CompanyPicker } from '../../core/company/company-picker';
import { CompanyStore } from '../../core/company/company.store';
import { KiBotButton } from '../../shared/ui/kibot-button/kibot-button';
import { KiBotConfirm } from '../../shared/ui/kibot-confirm/kibot-confirm';
import { KiBotDrawer } from '../../shared/ui/kibot-drawer/kibot-drawer';
import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotLoadingIndicator } from '../../shared/ui/kibot-loading-indicator/kibot-loading-indicator';
import { KiBotMultiselect, KiBotOpcion, KiBotOpcionId } from '../../shared/ui/kibot-multiselect/kibot-multiselect';
import { KiBotSelect, KiBotSelectOpcion } from '../../shared/ui/kibot-select/kibot-select';
import { RobotContextStore } from '../robot/robot-context.store';
import { Inventory } from './inventories.models';
import { Elegible, InventoriesStore } from './inventories.store';
import { InventoryDetail } from './inventory-detail';

/**
 * Inventarios del robot: la lista de la compañía, y crear, editar o cerrar uno.
 *
 * <p>Crear y editar se hacen en un panel lateral, sin perder la lista de vista (el mockup). Editar
 * cambia solo el nombre y las zonas: el plano y el robot se enseñan bloqueados, con el porqué. El
 * recorrido del robot dentro de un inventario se controla desde Control.</p>
 */
@Component({
  selector: 'kibot-inventories',
  imports: [
    CompanyPicker,
    KiBotButton,
    KiBotDrawer,
    KiBotErrorState,
    KiBotLoadingIndicator,
    KiBotMultiselect,
    KiBotSelect,
    InventoryDetail,
    NgTemplateOutlet,
    DatePipe,
    RouterLink
  ],
  providers: [InventoriesStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inventories.html',
  styleUrl: './inventories.scss'
})
export class Inventories implements OnInit {
  protected readonly store = inject(InventoriesStore);
  private readonly companias = inject(CompanyStore);
  private readonly contexto = inject(RobotContextStore);
  private readonly confirmar = inject(KiBotConfirm);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly creando = signal(false);
  /** El inventario cuyo recorrido se mira en el panel de detalle. */
  protected readonly detalle = signal<Inventory | null>(null);

  // Lo que se ofrece en los multiselect: lo ocupado va deshabilitado con su motivo.
  /** Los planos de la compañía: «v3» a la derecha y, el que ya está en otro inventario, apagado. */
  protected readonly opcionesDePlano = computed<KiBotSelectOpcion[]>(() =>
    this.store.planosElegibles().map((p) => {
      const [nombre, version] = p.nombre.split(/ \((v\d+)\)$/);
      return { id: p.id, nombre, detalle: version ?? null, motivo: p.ocupadoPor ? `en «${p.ocupadoPor}»` : null };
    })
  );

  protected readonly opcionesDeZonas = computed(() => opciones(this.store.zonasElegibles()));
  protected readonly opcionesDeRobots = computed(() => opciones(this.store.robotsElegibles()));
  protected readonly opcionesDeEdicion = computed<KiBotOpcion[]>(() => [
    ...opciones(this.store.zonasEditables()),
    ...this.store.zonasHuerfanas().map((z) => ({ id: z.IdZone, nombre: `${z.Name} (sin geocerca)` }))
  ]);
  protected readonly zonasElegidas = computed(() => [...this.store.zonasMarcadas()]);
  protected readonly robotsElegidos = computed(() => [...this.store.robotsMarcados()]);

  protected numeros(ids: KiBotOpcionId[]): number[] {
    return ids.map(Number);
  }

  constructor() {
    effect(() => {
      this.companias.companiaId();
      untracked(() => void this.store.cargar());
    });
  }

  ngOnInit(): void {
    void this.companias.cargar();
    // Desde Control («Nuevo inventario») se llega con ?nuevo=1: el panel ya abierto.
    if (this.ruta.snapshot.queryParamMap.get('nuevo')) {
      this.creando.set(true);
      void this.router.navigate([], { relativeTo: this.ruta, queryParams: { nuevo: null }, replaceUrl: true });
    }
  }

  protected cuantos(n: number, uno: string, varios: string): string {
    return `${n} ${n === 1 ? uno : varios}`;
  }

  protected valor(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected alElegirPlano(evento: Event): void {
    const v = this.valor(evento);
    this.store.elegirPlano(v === '' ? null : v);
  }

  protected abrirCreacion(): void {
    this.store.limpiar();
    this.creando.set(true);
  }

  protected cerrarCreacion(): void {
    this.creando.set(false);
  }

  protected async crear(): Promise<void> {
    await this.store.crear();
    const c = this.store.creacion();
    if (c.status === 'ready') {
      this.creando.set(false);
      // El nuevo pasa a ser el que se mira en Control y Buscar.
      await this.contexto.cargar(true);
      this.contexto.elegirInventario(c.value._id);
    }
  }

  protected async guardarEdicion(): Promise<void> {
    if (await this.store.guardarEdicion()) {
      this.store.cerrarEdicion();
      void this.contexto.cargar(true);
    }
  }

  protected async cerrarInventario(inventario: Inventory): Promise<void> {
    const si = await this.confirmar.preguntar({
      titulo: `¿Cerrar «${inventario.Name}»?`,
      mensaje: 'Un inventario cerrado no se puede reabrir. Sus resultados se pueden seguir consultando en Buscar.',
      aceptar: 'Cerrar inventario',
      peligro: true
    });
    if (!si) return;
    await this.store.cerrarYa(inventario);
    void this.contexto.cargar(true);
  }

  protected verDetalle(inventario: Inventory): void {
    this.detalle.set(inventario);
  }

  /** Fija el inventario (y su robot) como el que se mira, y abre Control o Buscar. */
  protected async irAControl(inventario: Inventory): Promise<void> {
    await this.fijarContexto(inventario);
    void this.router.navigate(['/control']);
  }

  protected async irABuscar(inventario: Inventory): Promise<void> {
    await this.fijarContexto(inventario);
    void this.router.navigate(['/buscar']);
  }

  protected editarDesdeDetalle(inventario: Inventory): void {
    this.detalle.set(null);
    void this.store.abrirEdicion(inventario);
  }

  protected async cerrarDesdeDetalle(inventario: Inventory): Promise<void> {
    await this.cerrarInventario(inventario);
    if (this.store.cierre().status === 'ready') this.detalle.set(null);
  }

  private async fijarContexto(inventario: Inventory): Promise<void> {
    await this.contexto.cargar();
    this.contexto.elegirInventario(inventario._id);
  }

  protected robotsDe(inventario: Inventory): string {
    const robots = (inventario.Devices ?? []).filter((d) => d.Type?.toLowerCase() === 'robot').map((d) => d.Name);
    return robots.length > 0 ? [...new Set(robots)].join(', ') : '—';
  }

  protected zonasDe(inventario: Inventory): string {
    return (inventario.Zones ?? []).map((z) => z.Name).join(' · ') || '—';
  }

  protected ordenDe(id: number): number | null {
    const i = this.store.editZonas().indexOf(id);
    return i === -1 ? null : i + 1;
  }
}

function opciones(elegibles: readonly Elegible[]): KiBotOpcion[] {
  return elegibles.map((e) => ({
    id: Number(e.id),
    nombre: e.nombre,
    motivo: e.ocupadoPor ? `en «${e.ocupadoPor}»` : null
  }));
}
