// Booking
// ------------
// NOTE • The Cal.com link itself comes from Sanity's Global settings
// (ContactContext) — this only builds the public booking URL from it
export const bookingUrl = (calLink: string) => `https://cal.com/${calLink}?overlayCalendar=true`;
