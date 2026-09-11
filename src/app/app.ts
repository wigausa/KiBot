import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppBootService } from './core/boot/app-boot.service';
import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  // Se inyecta para instanciar el servicio al bootstrap y aplicar
  // data-theme en <html> antes del primer render.
  private readonly themeService = inject(ThemeService);

  // Instanciado aquí para que registre la URL inicial antes de que el router
  // navegue; de eso depende si el Inicio muestra la cortina de arranque.
  private readonly bootService = inject(AppBootService);
}
