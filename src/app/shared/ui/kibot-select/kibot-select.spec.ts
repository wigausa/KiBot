import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { KiBotOpcionId } from '../kibot-multiselect/kibot-multiselect';
import { KiBotSelect, KiBotSelectOpcion } from './kibot-select';

@Component({
  imports: [KiBotSelect],
  template: `
    <kibot-select etiqueta="Inventario" placeholder="Elige un inventario" [opciones]="opciones"
                  [seleccionada]="elegida()" (cambia)="elegida.set($event)" />
  `
})
class Anfitrion {
  readonly opciones: KiBotSelectOpcion[] = [
    { id: 'a', nombre: 'Octubre', grupo: 'Abiertos' },
    { id: 'b', nombre: 'Noviembre', grupo: 'Abiertos', motivo: 'ocupado' },
    { id: 'c', nombre: 'Septiembre', grupo: 'Cerrados' }
  ];
  readonly elegida = signal<KiBotOpcionId | null>(null);
}

describe('KiBotSelect', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }));

  async function abierto() {
    const f = TestBed.createComponent(Anfitrion);
    await f.whenStable();
    (f.nativeElement.querySelector('.disparador') as HTMLButtonElement).click();
    await f.whenStable();
    return f;
  }

  it('enseña el texto de ayuda y, al abrir, las opciones con sus grupos', async () => {
    const f = await abierto();
    const texto = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Elige un inventario');
    expect([...f.nativeElement.querySelectorAll('.grupo')].map((g) => (g as HTMLElement).textContent?.trim())).toEqual([
      'Abiertos',
      'Cerrados'
    ]);
  });

  it('elegir una opción la guarda, cierra la lista y la enseña en el botón', async () => {
    const f = await abierto();
    (f.nativeElement.querySelectorAll('[role="option"]')[2] as HTMLElement).click();
    await f.whenStable();

    expect(f.componentInstance.elegida()).toBe('c');
    expect(f.nativeElement.querySelector('[role="listbox"]')).toBeNull();
    expect(f.nativeElement.querySelector('.disparador__valor').textContent).toContain('Septiembre');
  });

  it('una opción con motivo no se puede elegir', async () => {
    const f = await abierto();
    (f.nativeElement.querySelectorAll('[role="option"]')[1] as HTMLElement).click();
    await f.whenStable();
    expect(f.componentInstance.elegida()).toBeNull();
  });

  it('con el teclado: flecha abajo e Intro eligen', async () => {
    const f = await abierto();
    const lista = f.nativeElement.querySelector('[role="listbox"]') as HTMLElement;
    lista.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    lista.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    lista.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await f.whenStable();
    expect(f.componentInstance.elegida()).toBe('c');
  });
});
