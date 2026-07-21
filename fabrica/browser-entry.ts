/**
 * @tool Fabrica
 * @global Fabrica
 * @package fabrica
 * @tags dom reactive templates userscripts
 * @description Fine-grained reactive DOM runtime as a browser global.
 */
export * from "./index.js";

import Fabrica from "./index.js";

Fabrica.install();

export default Fabrica;
