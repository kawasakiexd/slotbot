export function toMinor(major: number): number {
  return Math.round(major * 100);
}

export function fromMinor(minor: number): number {
  return minor / 100;
}

export function formatMoney(minor: number, currency: string, locale: string): string {
  const amount = fromMinor(minor);
  const code = currency.toUpperCase();
  if (code === "USD") {
    const formatted = amount.toFixed(2);
    if (locale.startsWith("ru")) {
      return `${formatted.replace(".", ",")} $`;
    }
    return `$${formatted}`;
  }
  return new Intl.NumberFormat(locale.startsWith("ru") ? "ru-RU" : "en-US", {
    style: "currency",
    currency: code,
  }).format(amount);
}
