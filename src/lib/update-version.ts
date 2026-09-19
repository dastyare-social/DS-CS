// Server-side "is there a newer docker image?" check.
//
// The app ships as a docker image (dastyaresocial/ds-cs — see
// docker-compose.yml and .github/workflows/docker-publish.yml). "New version"
// means the docker image on Docker Hub has a newer published tag than the
// version this running build was compiled with.
//
// Product rule — a patch bump does NOT count as an update:
//   show banner only when major OR minor increased (1.0.0 -> 1.1.0, 1.1.0 ->
//   2.0.0). A patch-only change (1.1.0 -> 1.1.1) is ignored.
const DEFAULT_IMAGE = "dastyaresocial/ds-cs";

export type Semver = [number, number, number];

export function parseSemver(raw: string): Semver | null {
  const m = raw.trim().replace(/^[vV]/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function getCurrentVersion(): string {
  // Injected at docker build time (see next.config.ts / docker-publish.yml).
  return process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0";
}

export function getDockerImage(): string {
  return process.env.NEXT_PUBLIC_DOCKER_IMAGE || DEFAULT_IMAGE;
}

export function shouldShowUpdate(current: string, latest: string): boolean {
  const c = parseSemver(current);
  const l = parseSemver(latest);
  if (!c || !l) return false;
  // Only major/minor matter — ignore the patch component.
  return c[0] !== l[0] || c[1] !== l[1];
}

// Dev-mode sample: always present an update so the banner keeps re-appearing
// on every reload (same rule as the install banner).
export function sampleLatest(current: string): string {
  const c = parseSemver(current) ?? [0, 1, 0];
  if (c[0] === 0) return `1.0.0`;
  return `${c[0]}.${c[1] + 1}.0`;
}
