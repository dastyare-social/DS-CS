import { CANONICAL_AGENT, skillsDirFor } from "../agents.mjs";
import { readLockfile } from "../lockfile.mjs";
import { listInstalledSkills } from "../skills/discover.mjs";
import { log, table } from "../utils/log.mjs";

/**
 * Search installed skills by name and description.
 *
 * Offline by design: it walks the skills that are actually installed rather than
 * reaching for a registry. `ds-cs add <source> --list` is the command for
 * browsing a source you have not installed from yet.
 */
export async function searchCommand(positional, flags, { projectRoot }) {
  const query = (positional.join(" ") || "").toLowerCase();
  const lockfile = await readLockfile(projectRoot);

  const canonical = skillsDirFor(CANONICAL_AGENT, {
    projectRoot,
    global: Boolean(flags.global),
  });

  const available = await listInstalledSkills(canonical);
  if (available.length === 0) {
    log.info("No skills installed in this project.");
    return;
  }
  const matches = available
    .filter((skill) => {
      if (query === "") return true;
      return (
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query)
      );
    })
    .map((skill) => ({
      name: skill.name,
      source: lockfile.skills[skill.name]?.source ?? "(local)",
      description: skill.description,
    }));

  if (matches.length === 0) {
    log.info(query === "" ? "No skills installed." : `No installed skill matches "${query}".`);
    return;
  }

  table(matches, [
    { key: "name", title: "NAME" },
    { key: "source", title: "SOURCE" },
    { key: "description", title: "DESCRIPTION", flex: true },
  ]);
}
