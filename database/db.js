import fs from "fs-extra";

const DB_FILE = "./data.json";

if (!fs.existsSync(DB_FILE)) {
  fs.writeJsonSync(DB_FILE, {});
}

export function cargarDB() {
  return fs.readJsonSync(DB_FILE);
}

export function guardarDB(data) {
  fs.writeJsonSync(DB_FILE, data, { spaces: 2 });
}