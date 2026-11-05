import { urlDeVuelta } from './msal';

describe('urlDeVuelta', () => {
  it('en local, con la base en la raíz, vuelve al origen', () => {
    expect(urlDeVuelta('http://localhost:8101/')).toBe('http://localhost:8101');
  });

  it('desplegado en kibot/, vuelve al index.html de la carpeta', () => {
    expect(urlDeVuelta('https://stwitagtestdummyclient41.z20.web.core.windows.net/kibot/')).toBe(
      'https://stwitagtestdummyclient41.z20.web.core.windows.net/kibot/index.html'
    );
  });

  it('sin <base>, desde el index.html de la carpeta, da la misma URL', () => {
    expect(urlDeVuelta('https://sitio.example/kibot/index.html#/robots')).toBe(
      'https://sitio.example/kibot/index.html'
    );
  });
});
