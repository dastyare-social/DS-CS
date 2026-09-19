import { NextResponse } from "next/server";

const DOCKER_IMAGE = "dastyaresocial/ds-cs";
const DOCKER_HUB_URL = `https://hub.docker.com/v2/repositories/${DOCKER_IMAGE}/tags?page_size=100&ordering=last_updated`;

type Semver = [number, number, number];

function parseSemver(tag: string): Semver | null {
  const m = tag.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

// A new build must be announced only when the major or minor version went up
// (e.g. 0.1.0 -> 1.0.0 or 1.0.0 -> 1.1.0). Patch-only bumps are ignored.
function shouldUpdate(latest: Semver, current: Semver): boolean {
  return latest[0] > current[0] || latest[1] > current[1];
}

export const dynamic = "force-dynamic";

export async function GET() {
  const currentStr = process.env.NEXT_PUBLIC_APP_VERSION;
  const current = currentStr ? parseSemver(currentStr) : null;

  // Dev mode (docker compose dev run, next dev, bun dev, …) always advertises a
  // sample update so the banner is visible on every reload — mirroring the
  // install banner's dev-mode always-show behaviour.
  if (process.env.NODE_ENV === "development") {
    const base = current ?? [0, 1, 0];
    const latest = `${base[0]}.${base[1] + 1}.0`;
    return NextResponse.json({
      current: currentStr ?? "0.1.0",
      latest,
      updateAvailable: base[0] > 0 || base[1] >= 0,
    });
  }

  if (!current) {
    return NextResponse.json({
      current: currentStr ?? null,
      latest: null,
      updateAvailable: false,
    });
  }

  try {
    const res = await fetch(DOCKER_HUB_URL, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ current: currentStr!, latest: null, updateAvailable: false });
    }
    const data = (await res.json()) as { results?: { name: string }[] };
    const versions = (data.results ?? [])
      .map((r) => parseSemver(r.name))
      .filter((v): v is Semver => v !== null)
      .sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2]);

    const latest = versions[0] ?? null;
    const updateAvailable = latest !== null && shouldUpdate(latest, current);
    return NextResponse.json({
      current: currentStr!,
      latest: latest ? latest.join(".") : null,
      updateAvailable,
    });
  } catch {
    return NextResponse.json({ current: currentStr!, latest: null, updateAvailable: false });
  }
}
