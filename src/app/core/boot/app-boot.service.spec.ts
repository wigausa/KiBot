import { rutaInicial } from './app-boot.service';

describe('rutaInicial', () => {
  it('sin hash es Inicio', () => {
    expect(rutaInicial('')).toBe('/');
    expect(rutaInicial('#')).toBe('/');
  });

  it('lee la ruta del hash', () => {
    expect(rutaInicial('#/inicio')).toBe('/inicio');
    expect(rutaInicial('#/')).toBe('/');
    expect(rutaInicial('#/robot/control')).toBe('/robot/control');
  });

  it('ignora la query de la ruta', () => {
    expect(rutaInicial('#/inicio?x=1')).toBe('/inicio');
  });
});
