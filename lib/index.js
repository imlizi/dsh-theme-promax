//#region src/index.ts
/**
* Host half of the skin. The skin contributes browser UI only, so this entry
* exists so the Host loader can import the package at all; it registers
* nothing and disposes nothing.
*/
const name = "dsh-theme-promax";
function apply() {}
//#endregion
export { apply, name };
