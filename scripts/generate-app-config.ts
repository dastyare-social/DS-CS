import fs from "fs";
import path from "path";
import YAML from "yaml";

const CONFIG_DIR = path.join(process.cwd(), "config");
const YAML_FILE = path.join(CONFIG_DIR, "app.config.yml");
const JSON_FILE = path.join(CONFIG_DIR, "app.config.json");

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
  console.log("Generating app.config.json from app.config.yml...");

  ensure_config_dir();

  const yamlContent = read_yaml_file(YAML_FILE);
  const data = parse_yaml_to_json(yamlContent);

  write_json_file(JSON_FILE, data);

  console.log(`Successfully generated JSON config: ${JSON_FILE}`);
}

try {
  main();
} catch (err) {
  console.error("[generateAppConfig] Error:", err);
  process.exit(1);
}
