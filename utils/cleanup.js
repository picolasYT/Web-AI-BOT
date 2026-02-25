import fs from "fs-extra";

export async function limpiarArchivos(projectPath, zipPath) {
  try {
    if (projectPath) await fs.remove(projectPath);
    if (zipPath) await fs.remove(zipPath);
  } catch (error) {
    console.log("⚠️ Error limpiando archivos:", error.message);
  }
}