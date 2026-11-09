import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { KiBotMultiselect, KiBotOpcion, KiBotOpcionId } from './kibot-multiselect';

@Component({
  imports: [KiBotMultiselect],
  template: `
    <kibot-multiselect
      etiqueta="Zonas"
      [opciones]="opciones"
      [seleccionadas]="elegidas()"
      [ordenado]="ordenado()"
      (cambia)="elegidas.set($event)"
    />
  `
})
class Anfitrion {
  readonly opciones: KiBotOpcion[] = [
    { id: 1, nombre: 'Norte' },
    { id: 2, nombre: 'Sur' },
    { id: 3, nombre: 'Patio', motivo: 'en «Octubre»' }
  ];
  readonly elegidas = signal<KiBotOpcionId[]>([]);
  readonly ordenado = signal(false);
}

describe('KiBotMultiselect', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  async function abierto() {
    const f = TestBed.createComponent(Anfitrion);
    await f.whenStable();
    (f.nativeElement.querySelector('.disparador') as HTMLButtonElement).click();
    await f.whenStable();
    return f;
  }

  function opciones(f: { nativeElement: HTMLElement }): HTMLElement[] {
    return [...f.nativeElement.querySelectorAll<HTMLElement>('[role="option"]')];
  }

  it('cerrado enseña el texto de ayuda; al abrir, la lista', async () => {
    const f = TestBed.createComponent(Anfitrion);
    await f.whenStable();
    expect(f.nativeElement.textContent).toContain('Elige…');
    expect(f.nativeElement.querySelector('[role="listbox"]')).toBeNull();

    (f.nativeElement.querySelector('.disparador') as HTMLButtonElement).click();
    await f.whenStable();
    expect(opciones(f).length).toBe(3);
  });

  it('marcar añade al final y desmarcar quita', async () => {
    const f = await abierto();
    opciones(f)[1].click();
    await f.whenStable();
    opciones(f)[0].click();
    await f.whenStable();
    expect(f.componentInstance.elegidas()).toEqual([2, 1]);

    opciones(f)[1].click();
    await f.whenStable();
    expect(f.componentInstance.elegidas()).toEqual([1]);
  });

  it('una opción con motivo no se puede marcar, ni con «Todas»', async () => {
    const f = await abierto();
    opciones(f)[2].click();
    await f.whenStable();
    expect(f.componentInstance.elegidas()).toEqual([]);
    expect(opciones(f)[2].getAttribute('aria-disabled')).toBe('true');

    (f.nativeElement.querySelectorAll('.panel__atajo')[0] as HTMLButtonElement).click();
    await f.whenStable();
    expect(f.componentInstance.elegidas()).toEqual([1, 2]);
  });

  it('Esc cierra la lista', async () => {
    const f = await abierto();
    const lista = f.nativeElement.querySelector('[role="listbox"]') as HTMLElement;
    lista.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await f.whenStable();
    expect(f.nativeElement.querySelector('[role="listbox"]')).toBeNull();
  });

  it('ordenado: enseña el turno y deja subir una zona', async () => {
    const f = TestBed.createComponent(Anfitrion);
    f.componentInstance.ordenado.set(true);
    f.componentInstance.elegidas.set([1, 2]);
    await f.whenStable();

    const filas = f.nativeElement.querySelectorAll('.orden__fila');
    expect(filas.length).toBe(2);
    (filas[1].querySelector('[aria-label="Subir Sur"]') as HTMLButtonElement).click();
    await f.whenStable();
    expect(f.componentInstance.elegidas()).toEqual([2, 1]);
  });
});
