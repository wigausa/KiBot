import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Sesion } from '../../core/auth/sesion';
import { AppBootService } from '../../core/boot/app-boot.service';
import { KIBOT_NAV_ITEMS } from '../../core/navigation/nav-items';
import { KiBotIcon } from '../../shared/ui/kibot-icon/kibot-icon';
import { KiBotLoader } from '../../shared/ui/kibot-loader/kibot-loader';
import { RobotContextStore } from '../robot/robot-context.store';
import { textoDeEstado } from '../robot/robot.models';

/** Tiempo que se sostiene el spinner antes de abrir la cortina. */
const BOOT_HOLD_MS = 1700;
const BOOT_HOLD_REDUCED_MS = 300;

/**
 * Inicio: el saludo, el robot de un vistazo, el recorrido en curso si lo hay, y una tarjeta por
 * módulo con lo que se hace en él (pedido del usuario, 2026-11-06). Las descripciones salen de
 * `KIBOT_NAV_ITEMS`, las mismas del riel.
 *
 * <p>El arranque replica el `SplashWithReveal` de WitagAndroid: el spinner de marca se sostiene un
 * momento y después la cortina sube dejando ver el contenido, que entra escalonado.</p>
 */
@Component({
  selector: 'app-home',
  imports: [KiBotLoader, KiBotIcon, RouterLink, DecimalPipe],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Home implements OnInit {
  private readonly boot = inject(AppBootService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sesion = inject(Sesion);
  protected readonly contexto = inject(RobotContextStore);

  /** Todos menos el propio Inicio. */
  protected readonly modulos = KIBOT_NAV_ITEMS.filter((m) => m.path !== 'inicio');

  /** La cortina solo existe en el arranque de la app (ver AppBootService). */
  protected readonly booting = signal(this.boot.shouldPlayBoot());
  protected readonly revealed = signal(!this.boot.shouldPlayBoot());

  protected readonly saludo = computed(() => {
    const nombre = this.sesion.usuario?.split(/[\s@]/)[0];
    return nombre ? `Hola, ${nombre}` : 'Hola';
  });

  protected readonly conSenal = computed(() => this.contexto.latido()?.Signal === 'OK');

  protected readonly estadoDelRobot = computed(() => {
    const l = this.contexto.latido();
    if (l === null) return 'Sin noticias del robot todavía';
    if (l.Signal !== 'OK') return 'Sin señal';
    return textoDeEstado(l.Status.State);
  });

  protected readonly bateria = computed(() => {
    const b = this.contexto.latido()?.Status.Chassis?.BatteryPct;
    return b === null || b === undefined ? null : Math.round(b);
  });

  ngOnInit(): void {
    void this.contexto.cargar();

    if (!this.booting()) {
      return;
    }

    const hold = this.prefersReducedMotion() ? BOOT_HOLD_REDUCED_MS : BOOT_HOLD_MS;

    const revealTimer = setTimeout(() => {
      this.revealed.set(true);
      this.boot.markBooted();

      // La cortina se desmonta cuando termina de salir de pantalla.
      const cleanupTimer = setTimeout(() => this.booting.set(false), 1200);
      this.destroyRef.onDestroy(() => clearTimeout(cleanupTimer));
    }, hold);

    this.destroyRef.onDestroy(() => clearTimeout(revealTimer));
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
