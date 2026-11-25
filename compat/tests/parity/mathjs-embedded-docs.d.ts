// Ambient declaration for the mathjs package's embedded docs module. The mathjs package
// does not export (or type) it; the full-surface harness reads the examples by a relative
// import into the installed package.
declare module '*/embeddedDocs.js' {
  export const embeddedDocs: Record<
    string,
    {
      name?: string;
      category?: string;
      description?: string;
      syntax?: string[];
      examples?: string[];
      seealso?: string[];
    }
  >;
}
