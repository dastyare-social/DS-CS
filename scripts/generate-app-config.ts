import fs from "fs";
import path from "path";
import YAML from "yaml";

const CONFIG_DIR = path.join(process.cwd(), "config");

// Each YAML file is the human-editable source; its JSON twin is what the app
// imports. resume.config.yml is intentionally NOT pregenerated here — the
// resume page reads it at request time so toggling `enabled` needs no rebuild.
const CONFIG_PAIRS: Array<{ yaml: string; json: string }> = [
  { yaml: "app.config.yml", json: "app.config.json" },
];

function ensure_config_dir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    throw new Error(`Config directory does not exist: ${CONFIG_DIR}`);
  }
}

function read_yaml_file(file_path: string) {
  if (!fs.existsSync(file_path)) {
    throw new Error(`YAML config file not found: ${file_path}`);
  }

  const content = fs.readFileSync(file_path, "utf8");
  if (!content.trim()) {
    throw new Error(`YAML config file is empty: ${file_path}`);
  }

  return content;
}

function parse_yaml_to_json(yaml_content: string) {
  try {
    const parsed = YAML.parse(yaml_content);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Parsed YAML is not an object");
    }
    return parsed;
  } catch (err) {
    console.error("Failed to parse YAML file:");
    throw err;
  }
}

function write_json_file(file_path: string, data: unknown) {
  const jsonString = JSON.stringify(data, null, 2);
  fs.writeFileSync(file_path, jsonString, "utf8");
}

function main() {
  ensure_config_dir();

  for (const { yaml, json } of CONFIG_PAIRS) {
    const yamlFile = path.join(CONFIG_DIR, yaml);
    const jsonFile = path.join(CONFIG_DIR, json);

    console.log(`Generating ${json} from ${yaml}...`);

    const yamlContent = read_yaml_file(yamlFile);
    const data = parse_yaml_to_json(yamlContent);
    write_json_file(jsonFile, data);

    console.log(`Successfully generated JSON config: ${jsonFile}`);
  }
}

try {
  main();
} catch (err) {
  console.error("[generateAppConfig] Error:", err);
  process.exit(1);
}
