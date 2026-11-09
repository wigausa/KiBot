import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { KiBotDrawer } from './kibot-drawer';

@Component({
  imports: [KiBotDrawer],
  template: `
    <kibot-drawer [abierto]="abierto()" titulo="Editar" (cerrar)="cerrados = cerrados + 1">
      <input id="primero" />
      <button drawer-pie id="guardar">Guardar</button>
    </kibot-drawer>
  `
})
class Anfitrion {
  readonly abierto = signal(false);
  cerrados = 0;
}

describe('KiBotDrawer', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  it('cerrado no pinta nada; abierto, el título y el contenido', async () => {
    const f = TestBed.createComponent(Anfitrion);
    await f.whenStable();
    expect(f.nativeElement.querySelector('[role="dialog"]')).toBeNull();

    f.componentInstance.abierto.set(true);
    await f.whenStable();
    const panel: HTMLElement = f.nativeElement.querySelector('[role="dialog"]');
    expect(panel.getAttribute('aria-label')).toBe('Editar');
    expect(panel.querySelector('#primero')).not.toBeNull();
    expect(panel.querySelector('.panel__pie #guardar')).not.toBeNull();
  });

  it('Esc, la ✕ y el fondo piden cerrar', async () => {
    const f = TestBed.createComponent(Anfitrion);
    f.componentInstance.abierto.set(true);
    await f.whenStable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    (f.nativeElement.querySelector('.panel__cerrar') as HTMLButtonElement).click();
    (f.nativeElement.querySelector('.fondo') as HTMLElement).click();

    expect(f.componentInstance.cerrados).toBe(3);
  });

  it('con el panel cerrado, Esc no hace nada', async () => {
    const f = TestBed.createComponent(Anfitrion);
    await f.whenStable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(f.componentInstance.cerrados).toBe(0);
  });
});
