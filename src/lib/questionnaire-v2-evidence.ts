import { z } from 'zod';

export const V2_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const V2_FILE_ACCEPT = '.pdf,.txt,.png,.jpg,.jpeg,.docx';
export const v2EvidenceSchema = z.strictObject({
  id: z.uuid(),
  questionId: z.string().regex(/^[A-Z]\d+[ab]?$/),
  originalName: z.string().min(1).max(180),
  mime: z.enum([
    'application/pdf',
    'text/plain',
    'image/png',
    'image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]),
  size: z.number().int().positive().max(V2_MAX_FILE_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  uploadedBy: z.enum(['unil', 'supplier', 'reviewer']),
  visibility: z.enum(['internal', 'shared']),
  createdAt: z.iso.datetime(),
});
export type V2Evidence = z.infer<typeof v2EvidenceSchema>;

/** File names are display metadata only; UUIDs determine all storage paths. */
export function inspectV2File(originalName: string, bytes: Uint8Array) {
  const name = originalName.trim().normalize('NFC');
  if (!name || name.length > 180 || /[\/\\\x00-\x1f\x7f]/.test(name))
    throw new Error('Nom de fichier invalide.');
  if (!bytes.length || bytes.length > V2_MAX_FILE_BYTES)
    throw new Error('Le fichier doit contenir entre 1 octet et 10 Mo.');
  const extension = name.slice(name.lastIndexOf('.')).toLowerCase();
  const prefix = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (extension === '.pdf' && new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-')
    return { name, mime: 'application/pdf' as const };
  if (extension === '.png' && prefix(137, 80, 78, 71, 13, 10, 26, 10))
    return { name, mime: 'image/png' as const };
  if (['.jpg', '.jpeg'].includes(extension) && prefix(255, 216, 255))
    return { name, mime: 'image/jpeg' as const };
  if (extension === '.txt') {
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) return { name, mime: 'text/plain' as const };
    } catch {
      /* Not UTF-8 text. */
    }
  }
  if (extension === '.docx' && prefix(80, 75, 3, 4)) {
    // Inspect entry names without unpacking or executing the OOXML archive.
    const container = new TextDecoder('latin1').decode(bytes);
    if (container.includes('[Content_Types].xml') && container.includes('word/document.xml'))
      return {
        name,
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' as const,
      };
  }
  throw new Error('Format non reconnu. Formats acceptés : PDF, TXT UTF-8, PNG, JPG et DOCX.');
}
