#!/usr/bin/env node
import { main } from "../src/index.mjs";

main(process.argv.slice(2)).catch((error) => {
  // Anything reaching here is a bug in the CLI, not a user error. Report it in
  // a shape a maintainer can act on, then exit non-zero so scripts can branch.
  if (process.env.DS_CS_DEBUG) {
    console.error(error);
  } else {
    console.error(`\nds-cs: ${error?.message ?? error}`);
    if (error?.hint) console.error(`hint: ${error.hint}`);
  }
  process.exit(1);
});
