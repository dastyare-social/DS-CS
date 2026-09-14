// Storybook-only mock for `next/navigation`. Aliased in .storybook/main.ts so
// client components that call useRouter() etc. render inside the SB iframe
// without Next's router context.

const noop = () => {};

export function useRouter() {
  return {
    push: noop,
    replace: noop,
    refresh: noop,
    back: noop,
    forward: noop,
    prefetch: noop,
  };
}

export function usePathname(): string {
  return "/";
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useParams(): any {
  return {};
}

export function redirect(url: string): never {
  throw new Error(`[mock next/navigation] redirect(${url})`);
}

export function notFound(): never {
  throw new Error("[mock next/navigation] notFound()");
}