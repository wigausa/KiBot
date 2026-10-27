import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';

import { KiBotErrorState } from '../../shared/ui/kibot-error-state/kibot-error-state';
import { KiBotLoadingIndicator } from '../../shared/ui/kibot-loading-indicator/kibot-loading-indicator';
import {
  estadoGrave,
  haceCuanto,
  textoDeActividad,
  textoDeAviso,
  textoDeEstado,
  ubicacionDe
} from '../robot/robot.models';
import { RobotStatusStore } from './robot-status.store';

/**
 * Estado del equipo y alertas: qué hace cada robot, su batería, si da señal y qué avisa.
 *
 * <p>Todo sale del latido (<c>robotStatus</c>). «Sin señal» lo calcula el backend; la pantalla solo
 * lo enseña.</p>
 */
@Component({
  selector: 'kibot-robot-status',
  imports: [KiBotErrorState, KiBotLoadingIndicator, DatePipe, DecimalPipe],
  providers: [RobotStatusStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './robot-status.html',
  styleUrl: './robot-status.scss'
})
export class RobotStatus implements OnInit {
  protected readonly store = inject(RobotStatusStore);

  protected readonly textoDeEstado = textoDeEstado;
  protected readonly textoDeActividad = textoDeActividad;
  protected readonly textoDeAviso = textoDeAviso;
  protected readonly estadoGrave = estadoGrave;
  protected readonly ubicacionDe = ubicacionDe;
  protected readonly haceCuanto = haceCuanto;

  ngOnInit(): void {
    void this.store.cargar();
  }

  protected alternarDetalle(idDevice: number): void {
    void this.store.elegir(this.store.elegido() === idDevice ? null : idDevice);
  }

  /** Un booleano del latido en palabras; sin dato, «—». */
  protected estadoDe(valor: boolean | null | undefined, si: string, no: string): string {
    if (valor === null || valor === undefined) return '—';
    return valor ? si : no;
  }

  /** `true` → «Sí», `false` → «No», sin dato → «—». */
  protected siNo(valor: boolean | null | undefined): string {
    if (valor === null || valor === undefined) return '—';
    return valor ? 'Sí' : 'No';
  }
}
