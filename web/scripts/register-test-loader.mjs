// Entrypoint `--import` (API register() yg direkomendasikan, bukan flag
// --experimental-loader yg sudah deprecated) - lihat ts-ext-loader.mjs.
import { register } from 'node:module';

register('./ts-ext-loader.mjs', import.meta.url);
