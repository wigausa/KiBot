/**
 * El clientId del app registration de Witag del tenant (`Witag_<Cliente>`), puesto por el build:
 * `ng build --define "KIBOT_CLIENT_ID='…'"`.
 *
 * <p>Lo pasa InfraHub (`npm run build:infrahub`): compila un build por tenant con el clientId que
 * saca del Key Vault del tenant (`B2CAppClientId`), igual que hace con WitagFrontend. No es un
 * secreto, pero así un mismo commit sirve para todos los tenants. Sin `--define` queda vacío y MSAL
 * falla al arrancar, que es lo que se quiere antes que entrar sin login.</p>
 */
declare const KIBOT_CLIENT_ID: string | undefined;

export const CLIENT_ID_DEL_BUILD: string =
  typeof KIBOT_CLIENT_ID === 'string' ? KIBOT_CLIENT_ID : '';
