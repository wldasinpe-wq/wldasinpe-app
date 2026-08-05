import type { Attachment } from 'resend';

const MAX_ATTACHMENT_BYTES = 4_500_000;

/**
 * Parses a browser data URL (JPEG/PNG/WebP) into a Resend attachment (base64 content).
 */
function dataUrlToComplianceAttachment(
  dataUrl: string,
  filename: string
): { attachment: Attachment; approxBytes: number } | null {
  const trimmed = dataUrl.trim();
  const m =
    /^data:image\/(jpeg|jpg|png|webp);base64,([\s\S]+)$/i.exec(trimmed);
  if (!m) {
    return null;
  }
  const kind = m[1].toLowerCase();
  const base64 = m[2].replace(/\s/g, '');
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_ATTACHMENT_BYTES || approxBytes < 32) {
    return null;
  }
  const ext =
    kind === 'png' ? 'png' : kind === 'webp' ? 'webp' : 'jpg';
  const contentType =
    ext === 'jpg' ? 'image/jpeg' : (`image/${ext}` as const);
  return {
    attachment: {
      filename,
      content: base64,
      contentType,
    },
    approxBytes,
  };
}

export function complianceAttachmentsFromDataUrls(
  idFrontDataUrl: string,
  idBackDataUrl: string
): Attachment[] | null {
  const front = dataUrlToComplianceAttachment(
    idFrontDataUrl,
    'cedula-frente.jpg'
  );
  const back = dataUrlToComplianceAttachment(
    idBackDataUrl,
    'cedula-reverso.jpg'
  );
  if (!front || !back) {
    return null;
  }
  return [front.attachment, back.attachment];
}
