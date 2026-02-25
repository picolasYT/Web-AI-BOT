import fs from "fs-extra";
import { generarArchivos } from "./openrouter.js";
import { publicarEnRender } from "./render.js";
import { crearZip } from "./zip.js";

export async function generarProyecto(chatId, prompt, nombreProyecto) {

  const files = await generarArchivos(prompt);

  if (!files?.html) {
    throw new Error("La IA no generó HTML válido");
  }

  let htmlFinal = files.html;

  // Insertar CSS
  if (files.css) {
    htmlFinal = htmlFinal.replace(
      "</head>",
      `<style>\n${files.css}\n</style>\n</head>`
    );
  }

  // Insertar JS
  if (files.js) {
    htmlFinal = htmlFinal.replace(
      "</body>",
      `<script>\n${files.js}\n</script>\n</body>`
    );
  }

  // Intentar publicar
  const deployedURL = await publicarEnRender(chatId, htmlFinal);

  if (deployedURL) {
    return {
      tipo: "online",
      url: deployedURL,
      html: htmlFinal
    };
  }

  // Fallback ZIP
  const projectName = `web-${Date.now()}`;
  const projectPath = `./${projectName}`;

  await fs.mkdir(projectPath);
  await fs.writeFile(`${projectPath}/index.html`, htmlFinal);

  const zipPath = `${projectName}.zip`;
  await crearZip(projectPath, zipPath);

  return {
    tipo: "zip",
    zipPath,
    html: htmlFinal
  };
}