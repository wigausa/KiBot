import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InventoryService } from '../../core/inventory/inventory.service';
import { WidexIcon } from '../../shared/ui/widex-icon/widex-icon';

type RecorridoState = 'idle' | 'running' | 'paused';

/** Duración de referencia para la barra de progreso simulada (ver constructor). */
const DEMO_TOTAL_SECONDS = 300;

/**
 * Módulo de Control.
 *
 * El robot solo puede estar en una zona a la vez: elegir zona es indicarle
 * a dónde ir antes de arrancar, no un filtro (por eso NO es un multi-select
 * de tabs). Una vez en marcha, la zona queda bloqueada hasta detener.
 *
 * "Etiquetas a ignorar" es distinto de elegir zona: son EPCs que el robot
 * sigue leyendo pero no envía, y la lista es por recorrido — se limpia al
 * detener, no persiste entre recorridos.
 */
@Component({
  selector: 'app-control',
  imports: [WidexIcon, ReactiveFormsModule],
  templateUrl: './control.html',
  styleUrl: './control.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Control {
  private readonly destroyRef = inject(DestroyRef);
  private readonly inventory = inject(InventoryService);
  private timerHandle: ReturnType<typeof setInterval> | null = null;

  /** Zonas disponibles para el recorrido: siempre las del inventario actual. */
  protected readonly zones = this.inventory.zones;
  protected readonly inventoryName = computed(() => this.inventory.currentInventory().name);

  // Buscador de zonas: el inventario puede tener muchas más que las 6 de
  // ejemplo, así que la lista de botones se filtra en vivo en vez de crecer
  // sin control.
  protected readonly zoneQuery = new FormControl('', { nonNullable: true });
  private readonly zoneQueryValue = toSignal(this.zoneQuery.valueChanges, {
    initialValue: this.zoneQuery.value
  });

  protected readonly filteredZones = computed(() => {
    const query = this.zoneQueryValue().trim().toLowerCase();
    return query
      ? this.zones().filter((zone) => zone.label.toLowerCase().includes(query))
      : this.zones();
  });

  protected readonly state = signal<RecorridoState>('idle');
  protected readonly selectedZoneId = signal<string | null>(null);
  protected readonly elapsedSeconds = signal(0);
  protected readonly ignoredTags = signal<readonly string[]>([]);
  protected readonly tagControl = new FormControl('', { nonNullable: true });

  protected readonly isIdle = computed(() => this.state() === 'idle');
  protected readonly isRunning = computed(() => this.state() === 'running');
  protected readonly isPaused = computed(() => this.state() === 'paused');

  protected readonly selectedZoneLabel = computed(
    () => this.zones().find((zone) => zone.id === this.selectedZoneId())?.label ?? null
  );

  protected readonly canStart = computed(() => this.isIdle() && this.selectedZoneId() !== null);
  protected readonly primaryLabel = computed(() => (this.isPaused() ? 'Reanudar' : 'Iniciar'));
  protected readonly primaryDisabled = computed(
    () => this.isRunning() || (this.isIdle() && this.selectedZoneId() === null)
  );

  protected readonly progressPercent = computed(() =>
    Math.min(99, Math.round((this.elapsedSeconds() / DEMO_TOTAL_SECONDS) * 100))
  );

  protected readonly elapsedLabel = computed(() => formatElapsed(this.elapsedSeconds()));

  protected readonly statusLabel = computed(() => {
    if (this.isRunning()) return 'En curso';
    if (this.isPaused()) return 'Pausado';
    return 'Detenido';
  });

  constructor() {
    // Simulación local del avance del recorrido: todavía no hay telemetría
    // real del robot conectada a este módulo (ver DESIGN.md sección 10).
    effect(() => {
      if (this.state() === 'running') {
        this.timerHandle ??= setInterval(() => this.elapsedSeconds.update((s) => s + 1), 1000);
      } else if (this.timerHandle !== null) {
        clearInterval(this.timerHandle);
        this.timerHandle = null;
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.timerHandle !== null) {
        clearInterval(this.timerHandle);
      }
    });
  }

  protected selectZone(zoneId: string): void {
    if (!this.isIdle()) {
      return;
    }
    this.selectedZoneId.set(zoneId);
  }

  protected onPrimaryAction(): void {
    if (this.isPaused() || this.canStart()) {
      this.state.set('running');
    }
  }

  protected pause(): void {
    if (this.isRunning()) {
      this.state.set('paused');
    }
  }

  protected stop(): void {
    this.state.set('idle');
    this.selectedZoneId.set(null);
    this.elapsedSeconds.set(0);
    this.zoneQuery.setValue('');
    // Por recorrido: la lista de ignoradas no sobrevive a un nuevo arranque.
    this.ignoredTags.set([]);
    this.tagControl.setValue('');
  }

  protected returnToChargingStation(): void {
    this.stop();
  }

  protected addIgnoredTag(): void {
    const value = this.tagControl.value.trim();
    if (!value || this.ignoredTags().includes(value)) {
      this.tagControl.setValue('');
      return;
    }
    this.ignoredTags.update((tags) => [...tags, value]);
    this.tagControl.setValue('');
  }

  protected removeIgnoredTag(tag: string): void {
    this.ignoredTags.update((tags) => tags.filter((current) => current !== tag));
  }
}

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
