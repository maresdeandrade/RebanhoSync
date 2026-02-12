// This file creates a shim for the Deno global namespace.
// It is intended to silence strict TypeScript errors in environments
// where the Deno extension is not installed or active.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
  env: {
    get: (key: string) => string | undefined;
    toObject: () => Record<string, string>;
  };
  [key: string]: any;
};
