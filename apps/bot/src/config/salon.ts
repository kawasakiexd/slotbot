export const salon = {
  name: "Sharp & Co. Barbershop",
  address: "42 Example St, Brooklyn, NY 11211",
  phone: "+1 (555) 014-2290",
  mapsUrl: "https://maps.google.com/?q=42+Example+St,+Brooklyn,+NY+11211",
  supportTelegram: "@slotbot_demo_bot",
  hoursText: {
    en: "Mon–Sat 10:00–20:00, Sun closed",
    ru: "Пн–Сб 10:00–20:00, вс выходной",
  },
  tzLabel: {
    en: "New York time",
    ru: "время Нью-Йорка",
  },
} as const;

export type Salon = typeof salon;
