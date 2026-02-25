import fs from "fs-extra";
import archiver from "archiver";

export function crearZip(source, out) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(out);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    archive.on("error", reject);

    archive.pipe(output);
    archive.directory(source, false);
    archive.finalize();
  });
}