import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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

  protected readonly title = signal('WiDex');
}
