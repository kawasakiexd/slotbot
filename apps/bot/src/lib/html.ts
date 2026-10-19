export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function bold(value: string): string {
  return `<b>${escapeHtml(value)}</b>`;
}
