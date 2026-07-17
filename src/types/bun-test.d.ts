declare module 'bun:test' {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void): void;
  export function beforeEach(fn: () => void): void;
  export function afterEach(fn: () => void): void;

  export const mock: {
    module: <T = any>(moduleName: string, factory?: () => T) => void;
  };

  export const vi: {
    fn: <T = any>(...args: any[]) => T;
    mock: <T = any>(moduleName: string, factory?: () => T) => void;
  };

  // Extend expect with jest-dom matchers and basic matchers
  export function expect<T = any>(value: T): {
    toBe(expected: any): void;
    toEqual(expected: any): void;
    toContain(expected: any): void;
    toBeInTheDocument(): void;
    toHaveAttribute(name: string, value?: string): void;
    toBeDisabled(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    not: {
      toBe(expected: any): void;
      toEqual(expected: any): void;
      toContain(expected: any): void;
      toBeInTheDocument(): void;
      toHaveAttribute(name: string, value?: string): void;
      toBeDisabled(): void;
      toBeTruthy(): void;
      toBeFalsy(): void;
    };
  };
}
