declare module 'rdf-canonize' {
  export interface CanonizeOptions {
    algorithm?: string;
    format?: string;
    inputFormat?: string;
    safe?: boolean;
  }

  export function canonize(
    input: unknown,
    options?: CanonizeOptions
  ): Promise<string>;

  export function canonize(
    input: unknown,
    options: CanonizeOptions,
    callback: (err: Error | null, canonized?: string) => void
  ): void;
}
