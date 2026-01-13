// Hilfsfunktionen

// HTML escapen
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Datum formatieren
export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

// Wochentag ermitteln
export function getDayName(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', { weekday: 'long' });
  } catch {
    return '';
  }
}

// Zeit zu Minuten
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Minuten zu Zeit
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Slot-ID formatieren für Anzeige
export function formatSlotId(slotId: string): string {
  const parts = slotId.split('_');
  if (parts.length >= 3) {
    return `${formatDate(parts[0])} ${parts[1]} - ${parts[2]}`;
  }
  return slotId;
}

// Heutiges Datum als ISO String
export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// Jetzt als ISO String
export function nowISO(): string {
  return new Date().toISOString();
}
