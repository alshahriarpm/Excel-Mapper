// Empty stub used by Turbopack's `resolveAlias` (see next.config.mjs) to shim
// out Node core modules (fs/stream/crypto) in the browser build. ExcelJS pulls
// them in transitively but never uses them on the client side, so an empty
// module is a safe replacement.
const emptyModule = {};

export default emptyModule;
