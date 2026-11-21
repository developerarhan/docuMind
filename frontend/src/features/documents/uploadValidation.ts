export const MAX_PDF_SIZE = 10 * 1024 * 1024;

export function validatePdfFile(file: File): string | null {
  if (!file) return "Choose a PDF file.";
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) return "Only PDF files are supported.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_PDF_SIZE) return "PDFs must be 10 MB or smaller.";
  return null;
}
