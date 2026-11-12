import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  untracked
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { KiBotButton } from '../../shared/ui/kibot-button/kibot-button';
import { KiBotConfirm } from '../../shared/ui/kibot-confirm/kibot-confirm';
import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotIcon } from '../../shared/ui/kibot-icon/kibot-icon';
import { KiBotLoadingIndicator } from '../../shared/ui/kibot-loading-indicator/kibot-loading-indicator';
import { KiBotMultiselect, KiBotOpcionId } from '../../shared/ui/kibot-multiselect/kibot-multiselect';
import { KiBotTab, KiBotTabs } from '../../shared/ui/kibot-tabs/kibot-tabs';
import { RobotContextBar } from '../robot/robot-context-bar';
import { RobotContextStore } from '../robot/robot-context.store';
import { avanceDe, textoDeEstadoDeZona, textoDeFinDeZona, textoDeRechazo } from '../robot/robot.models';
import { RobotLocation } from '../robot-status/robot-location';
import { RobotPositionMap } from '../robot-status/robot-position-map';
import { RobotTrack } from '../robot-track/robot-track';
import { RobotControlStore } from './robot-control.store';

export type VistaDeControl = 'curso' | 'ubicacion' | 'recorrido';
const VISTAS: readonly VistaDeControl[] = ['curso', 'ubicacion', 'recorrido'];
const GENERAL = 'general';

/**
 * Control del recorrido, por inventario y por zona (2026-11-06).
 *
 * <ul>
 *   <li><b>Pestañas de arriba:</b> «General» —un recorrido de varias zonas en orden, una tanda— y una
 *       por zona del inventario, que inicia solo esa zona.</li>
 *   <li><b>Dentro de cada una, sus vistas:</b> En curso (avance y órdenes), Ubicación —solo en General, con el robot en el plano— (dónde está
 *       el robot) y Recorrido en el plano.</li>
 *   <li><b>Los cuatro botones</b> —Iniciar, Pausar, Detener, Volver a casa— están siempre; los que no
 *       aplican salen apagados con el porqué (`RobotControlStore.botones`).</li>
 * </ul>
 *
 * <p>El inventario, el robot y la zona son los del contexto ({@link RobotContextStore}): se eligen una
 * vez y valen también en Buscar. La vista va en `?tab=`.</p>
 */
@Component({
  selector: 'kibot-robot-control',
  imports: [
    KiBotButton,
    KiBotErrorState,
    KiBotIcon,
    KiBotLoadingIndicator,
    KiBotMultiselect,
    KiBotTabs,
    RobotContextBar,
    RobotLocation,
    RobotPositionMap,
    RobotTrack,
    DatePipe,
    DecimalPipe
  ],
  providers: [RobotControlStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './robot-control.html',
  styleUrl: './robot-control.scss'
})
export class RobotControl implements OnInit, OnDestroy {
  protected readonly store = inject(RobotControlStore);
  protected readonly contexto = inject(RobotContextStore);
  private readonly confirmar = inject(KiBotConfirm);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  private readonly vistaPedida = toSignal(
    this.ruta.queryParamMap.pipe(map((p) => vistaDe(p.get('tab')))),
    { initialValue: vistaDe(this.ruta.snapshot.queryParamMap.get('tab')) }
  );

  /**
   * La vista que se enseña. Ubicación es del robot y no de una zona: solo existe en General. En la
   * pestaña de una zona, `?tab=ubicacion` cae en En curso.
   */
  protected readonly vista = computed<VistaDeControl>(() => {
    const v = this.vistaPedida();
    return v === 'ubicacion' && this.store.zonaVista() !== null ? 'curso' : v;
  });

  protected readonly vistas = computed<readonly KiBotTab[]>(() =>
    this.store.zonaVista() === null
      ? [
          { id: 'curso', label: 'En curso' },
          { id: 'ubicacion', label: 'Ubicación' },
          { id: 'recorrido', label: 'Recorrido en el plano' }
        ]
      : [
          { id: 'curso', label: 'En curso' },
          { id: 'recorrido', label: 'Recorrido en el plano' }
        ]
  );

  /** General y una pestaña por zona; un punto en la que el robot recorre ahora. */
  protected readonly pestanasDeZona = computed<KiBotTab[]>(() => {
    const t = this.store.enMarcha();
    const actual = t?.Zones[t.Current]?.IdZone ?? null;
    return [
      { id: GENERAL, label: t && t.Zones.length > 1 ? 'General ●' : 'General' },
      ...this.store.zonas().map((z) => ({ id: String(z.IdZone), label: z.IdZone === actual ? `${z.Name} ●` : z.Name }))
    ];
  });

  protected readonly pestanaDeZona = computed(() => {
    const z = this.store.zonaVista();
    return z === null ? GENERAL : String(z);
  });

  protected readonly nombreDeZona = computed(() => {
    const z = this.store.zonaVista();
    return this.store.zonas().find((x) => x.IdZone === z)?.Name ?? null;
  });

  protected readonly opcionesDeZonas = computed(() =>
    this.store.zonas().map((z) => ({ id: z.IdZone, nombre: z.Name }))
  );

  /** El recorrido que se ve en el plano: el último de la zona, o en General el de la zona en curso. */
  protected readonly runDeLaVista = computed(() => {
    if (this.store.zonaVista() !== null) return this.store.progresoDeLaVista()?.RunId ?? null;
    const t = this.store.ultima();
    return t?.CurrentRunId ?? t?.Zones.filter((z) => z.RunId).at(-1)?.RunId ?? null;
  });

  /** Las filas de General: cada zona de la tanda (o de las marcadas) con su avance y su estado. */
  protected readonly filasDeGeneral = computed(() => {
    const t = this.store.ultima();
    const nombres = new Map(this.store.zonas().map((z) => [z.IdZone, z.Name]));
    return this.store.zonasDeGeneral().map((id, i) => {
      const enTanda = t?.Zones.find((z) => z.IdZone === id) ?? null;
      const p = this.store.progresoPorZona().get(id) ?? null;
      return {
        id,
        numero: i + 1,
        nombre: nombres.get(id) ?? enTanda?.Name ?? `Zona ${id}`,
        avance: avanceDe(p),
        estado: enTanda ? textoDeEstadoDeZona(enTanda.State) : 'Pendiente',
        actual: !!t && t.Status === 'Running' && t.Zones[t.Current]?.IdZone === id
      };
    });
  });

  /** La zona de la tanda en marcha cuando se mira otra: «El robot está en Norte». */
  protected readonly ubicacionEnTanda = computed(() => {
    const z = this.store.zonaEnCurso();
    if (z === null) return null;
    const vista = this.store.zonaVista();
    return vista === null || vista === z.zona.IdZone
      ? `Recorriendo «${z.zona.Name}» (zona ${z.numero} de ${z.total}).`
      : `El robot está recorriendo otra zona: «${z.zona.Name}».`;
  });

  protected readonly sinInventarioAbierto = computed(() => {
    const lista = this.store.inventarios();
    return lista.status === 'ready' && lista.value.length === 0;
  });

  protected readonly textoDeRechazo = textoDeRechazo;
  protected readonly textoDeFinDeZona = textoDeFinDeZona;
  protected readonly textoDeEstadoDeZona = textoDeEstadoDeZona;

  /** Sin tanda ni recorrido vivo: lo último que se sabe de la zona. */
  protected textoSinTanda(): string {
    const p = this.store.progresoDeLaVista();
    if (!p?.RunId) return 'Sin iniciar';
    return p.Closed ? 'Terminada' : 'Recorrida antes';
  }

  constructor() {
    // Lo elegido arriba (el contexto) manda: el store de Control lo sigue.
    effect(() => {
      const inv = this.contexto.inventarioId();
      const robot = this.contexto.robotId();
      const listo = this.store.inventarios().status === 'ready';
      untracked(() => {
        if (!listo) return;
        const abierto = this.contexto.abierto() ? inv : null;
        if (abierto !== this.store.inventarioId()) this.store.elegirInventario(abierto);
        const robotDelStore = this.store.robots().some((r) => r.IdDevice === robot) ? robot : null;
        if (robotDelStore !== this.store.robotId()) void this.store.elegirRobot(robotDelStore);
      });
    });

    // La zona del contexto es la pestaña que se mira (nula: General).
    effect(() => {
      const zona = this.contexto.zonaId();
      untracked(() => this.store.verZona(zona));
    });

    // Y lo que Control va sabiendo se lo cuenta al contexto: al salir, el mini-reproductor sale al día.
    effect(() => {
      const tanda = this.store.ultima();
      const progreso = this.store.progreso();
      const latido = this.store.latido();
      untracked(() => this.contexto.informar(tanda, progreso, latido));
    });
  }

  ngOnInit(): void {
    // Control sondea solo, más fino: mientras está abierta, el contexto no pide lo mismo.
    this.contexto.suspenderVigilancia();
    void this.contexto.cargar();
    void this.store.cargar();
  }

  ngOnDestroy(): void {
    this.contexto.reanudarVigilancia();
  }

  protected irAZona(id: string): void {
    this.contexto.elegirZona(id === GENERAL ? null : Number(id));
  }

  protected irAVista(vista: string): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { tab: vista === 'curso' ? null : vista },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  protected fijarZonas(ids: KiBotOpcionId[]): void {
    this.store.fijarZonas(ids.map(Number));
  }

  protected nuevoInventario(): void {
    void this.router.navigate(['/inventarios'], { queryParams: { nuevo: 1 } });
  }

  // Las órdenes paran un robot en mitad de un pasillo: se confirman.

  /** Iniciar: la zona de la pestaña, o en General la tanda con las zonas en su orden. En pausa, reanuda. */
  protected async iniciar(): Promise<void> {
    if (this.store.botones().reanudar) {
      await this.reanudar();
      return;
    }
    const zona = this.store.zonaVista();
    const nombres = zona !== null
      ? `«${this.nombreDeZona()}»`
      : this.store.zonasEnOrden().map((z, i) => `${i + 1}. ${z.Name}`).join(', ');
    const si = await this.confirmar.preguntar({
      titulo: '¿Iniciar el recorrido?',
      mensaje: zona !== null
        ? `El robot va a recorrer la zona ${nombres}.`
        : `El robot va a recorrer, en este orden: ${nombres}. Pasa a la siguiente cuando termina la anterior.`,
      aceptar: 'Iniciar'
    });
    if (!si) return;
    if (zona !== null) await this.store.iniciarZona(zona);
    else await this.store.iniciar();
  }

  protected async pausar(): Promise<void> {
    if (
      await this.confirmar.preguntar({
        titulo: '¿Pausar el recorrido?',
        mensaje: 'El robot se para donde esté; después se puede reanudar.',
        aceptar: 'Pausar'
      })
    ) {
      await this.store.pausar();
    }
  }

  protected async reanudar(): Promise<void> {
    if (
      await this.confirmar.preguntar({
        titulo: '¿Reanudar el recorrido?',
        mensaje: 'El robot sigue desde donde se quedó.',
        aceptar: 'Reanudar'
      })
    ) {
      await this.store.reanudar();
    }
  }

  protected async cancelar(): Promise<void> {
    if (
      await this.confirmar.preguntar({
        titulo: '¿Detener el recorrido?',
        mensaje:
          'El robot se queda donde está (no vuelve a casa), se detiene la tanda y no se recorren las zonas que faltan.',
        aceptar: 'Detener',
        peligro: true
      })
    ) {
      await this.store.cancelar();
    }
  }

  protected async volverAlDock(): Promise<void> {
    if (
      await this.confirmar.preguntar({
        titulo: '¿Mandar el robot a casa?',
        mensaje: 'Vuelve a su estación de carga. Se detiene la tanda y no se recorren las zonas que faltan.',
        aceptar: 'Volver a casa'
      })
    ) {
      await this.store.volverAlDock();
    }
  }
}

function vistaDe(valor: string | null): VistaDeControl {
  return VISTAS.includes(valor as VistaDeControl) ? (valor as VistaDeControl) : 'curso';
}
