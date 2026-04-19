// Ambient declarations so TypeScript can resolve CSS Modules imported by
// knowledge-map-3d (which ships raw TypeScript source).
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
