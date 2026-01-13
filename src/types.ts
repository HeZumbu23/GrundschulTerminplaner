// Zeitslot für einen einzelnen Termin
export interface TimeSlot {
  start: string; // "12:30"
  end: string;   // "12:45"
}

// Ein Tag mit mehreren Zeitslots
export interface DaySlots {
  date: string;  // "2026-02-02"
  times: TimeSlot[];
}

// Ein Projekt (Terminplan)
export interface Project {
  id: string;
  title: string;
  teacherName: string;
  deadline: string;
  timeSlots: DaySlots[];
  createdAt: string;
  status: 'active' | 'completed' | 'archived';
}

// Ein Schüler
export interface Student {
  id: string;
  projectId: string;
  name: string;
  selectedSlots: string[];  // Array von slotIds: "2026-02-02_12:30_12:45"
  assignedSlot: string | null;
  scanData?: string;  // Base64 Bild des Scans
  createdAt: string;
}

// Ergebnis der automatischen Zuweisung
export interface Assignment {
  studentId: string;
  studentName: string;
  slotId: string;
  date: string;
  start: string;
  end: string;
}

export interface UnassignedStudent {
  studentId: string;
  studentName: string;
  reason: string;
}

export interface AssignmentResult {
  id: string;
  projectId: string;
  assignments: Assignment[];
  unassigned: UnassignedStudent[];
  createdAt: string;
}

// Hilfsfunktion zum Erstellen einer Slot-ID
export function createSlotId(date: string, start: string, end: string): string {
  return `${date}_${start}_${end}`;
}

// Slot-ID parsen
export function parseSlotId(slotId: string): { date: string; start: string; end: string } | null {
  const parts = slotId.split('_');
  if (parts.length >= 3) {
    return {
      date: parts[0],
      start: parts[1],
      end: parts[2]
    };
  }
  return null;
}
