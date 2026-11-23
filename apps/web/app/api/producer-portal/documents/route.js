import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import sql from "@/app/api/utils/sql";
import { requireProducerSession } from "@/app/api/utils/customer-portal-auth";
import { findProducerOrder, producerDocumentReference } from "@/app/api/utils/producer-orders";
import { producerDocumentPath } from "@/app/api/utils/producer-document-storage";

const types = new Set([
  "Contrato firmado", "Constancia de Situación Fiscal", "Identificación",
  "Carátula bancaria", "Opinión de cumplimiento", "Documento de huerta"
]);

function extension(buffer) {
  if (buffer.subarray(0, 5).toString() === "%PDF-") return "pdf";
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpg";
  if (buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "png";
  return null;
}

export async function POST(request) {
  let filePath;
  try {
    const auth = await requireProducerSession();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const form = await request.formData();
    const folio = form.get("folio");
    const type = form.get("documentType");
    const file = form.get("file");
    if (typeof folio !== "string" || !types.has(type) || !file?.size) {
      return NextResponse.json({ error: "Completa el folio, el tipo de documento y el archivo" }, { status: 400 });
    }
    const order = await findProducerOrder(auth.session.producerName, folio);
    if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo debe pesar 10 MB o menos" }, { status: 413 });
    }
    const data = Buffer.from(await file.arrayBuffer());
    const ext = extension(data);
    if (!ext) return NextResponse.json({ error: "Usa un archivo PDF, JPG o PNG" }, { status: 415 });

    const hash = createHash("sha256").update(data).digest("hex");
    const reference = producerDocumentReference(order);
    const [duplicate] = await sql`
      SELECT id FROM payment_documents
      WHERE module_origin = 'portal-productor' AND observations = ${reference}
        AND document_type = ${type} AND file_hash = ${hash} AND is_active = true
    `;
    if (duplicate) return NextResponse.json({ success: true });

    const name = randomUUID() + "." + ext;
    filePath = producerDocumentPath(name);
    await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
    await fs.writeFile(filePath, data, { flag: "wx", mode: 0o600 });
    await sql`
      INSERT INTO payment_documents (
        payment_id, document_type, original_file_name, system_file_name, internal_file_path,
        file_extension, file_size_bytes, file_hash, uploaded_by, status, module_origin,
        observations, is_active
      )
      VALUES (NULL, ${type}, ${path.basename(file.name).slice(0, 240)}, ${name}, ${"producer-private/" + name},
        ${"." + ext}, ${file.size}, ${hash}, 'portal_productor', 'pending', 'portal-productor',
        ${reference}, true)
    `;
    filePath = undefined;
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (filePath) await fs.unlink(filePath).catch(() => {});
    console.error("Error al guardar documento del productor:", error.message);
    return NextResponse.json({ error: "No se pudo guardar el documento" }, { status: 500 });
  }
}
