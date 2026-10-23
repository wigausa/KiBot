import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { AppBootService } from '../../core/boot/app-boot.service';
import { KiBotLoader } from '../../shared/ui/kibot-loader/kibot-loader';
import { WitagLogo } from '../../shared/ui/witag-logo/witag-logo';

/** Tiempo que se sostiene el spinner antes de abrir la cortina. */
const BOOT_HOLD_MS = 1700;
const BOOT_HOLD_REDUCED_MS = 300;

/**
 * Pantalla de Inicio.
 *
 * El arranque replica el `SplashWithReveal` de WitagAndroid: el spinner de
 * marca se sostiene un momento y después la cortina sube dejando ver el
 * contenido, que entra escalonado.
 */
@Component({
  selector: 'app-home',
  imports: [KiBotLoader, WitagLogo],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Home implements OnInit {
  private readonly boot = inject(AppBootService);
  private readonly destroyRef = inject(DestroyRef);

  /** La cortina solo existe en el arranque de la app (ver AppBootService). */
  protected readonly booting = signal(this.boot.shouldPlayBoot());
  protected readonly revealed = signal(!this.boot.shouldPlayBoot());

  ngOnInit(): void {
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
