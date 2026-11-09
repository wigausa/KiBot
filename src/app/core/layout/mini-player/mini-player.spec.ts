import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { RobotApiService } from '../../../features/robot/robot-api.service';
import { RobotContextStore } from '../../../features/robot/robot-context.store';
import { RobotBatchView } from '../../../features/robot/robot.models';
import { KiBotConfirm } from '../../../shared/ui/kibot-confirm/kibot-confirm';
import { MiniPlayer } from './mini-player';

const TANDA = {
  BatchId: 't', IdInventory: 'nov', IdDevice: 39, Status: 'Running', Current: 0, CurrentRunId: 'r1',
  Zones: [{ IdZone: 1, Name: 'Norte' }]
} as unknown as RobotBatchView;

describe('MiniPlayer', () => {
  const enMarcha = signal<RobotBatchView | null>(null);
  let pausas: [string, number][];
  let respuesta: boolean;

  beforeEach(() => {
    enMarcha.set(null);
    pausas = [];
    respuesta = true;
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: RobotContextStore,
          useValue: {
            enMarcha,
            enPausa: signal(false),
            avance: signal(40),
            robot: signal({ IdDevice: 39, Name: 'KiBot 1' }),
            zonaEnCurso: signal({ numero: 1, total: 2, nombre: 'Norte' }),
            vigilar: async () => undefined
          }
        },
        {
          provide: RobotApiService,
          useValue: { pausar: async (inv: string, robot: number) => pausas.push([inv, robot]) }
        },
        { provide: KiBotConfirm, useValue: { preguntar: async () => respuesta } }
      ]
    });
  });

  it('sin tanda en marcha no se pinta', async () => {
    const f = TestBed.createComponent(MiniPlayer);
    await f.whenStable();
    expect(f.nativeElement.querySelector('.mini')).toBeNull();
  });

  it('con tanda en marcha enseña el avance, la zona y las órdenes', async () => {
    enMarcha.set(TANDA);
    const f = TestBed.createComponent(MiniPlayer);
    await f.whenStable();

    const texto = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('40 %');
    expect(texto).toContain('Zona 1 de 2: Norte');
    expect(texto).toContain('Pausar');
    expect(texto).toContain('Ver control');
  });

  it('pausar pregunta antes y manda la orden al robot de la tanda', async () => {
    enMarcha.set(TANDA);
    const f = TestBed.createComponent(MiniPlayer);
    await f.whenStable();
    const boton = f.nativeElement.querySelector('.mini__boton--principal') as HTMLButtonElement;

    respuesta = false;
    boton.click();
    await f.whenStable();
    expect(pausas).toEqual([]);

    respuesta = true;
    boton.click();
    await f.whenStable();
    expect(pausas).toEqual([['nov', 39]]);
  });
});
