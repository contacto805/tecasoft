import path from "node:path";

export function producerDocumentPath(name) {
  if (!/^[a-f0-9-]{36}\.(pdf|jpg|png)$/.test(name || "")) throw new Error("Nombre de archivo inválido");
  return path.resolve(process.env.TECAVO_PRIVATE_DOCUMENT_DIR || "storage/private/producer-documents", name);
}
