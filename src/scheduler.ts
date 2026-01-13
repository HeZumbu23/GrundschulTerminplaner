import type { Project, Student, Assignment, UnassignedStudent, AssignmentResult } from './types';
import { generateId } from './db';
import { nowISO } from './utils';

/**
 * Automatische Terminzuweisung mit Greedy-Algorithmus.
 * Schüler mit weniger Optionen werden priorisiert (Constraint Propagation).
 */
export function calculateAssignments(
  project: Project,
  students: Student[]
): AssignmentResult {
  // Alle verfügbaren Slots sammeln
  const allSlots: Map<string, { date: string; start: string; end: string }> = new Map();

  for (const day of project.timeSlots) {
    for (const time of day.times) {
      const slotId = `${day.date}_${time.start}_${time.end}`;
      allSlots.set(slotId, {
        date: day.date,
        start: time.start,
        end: time.end
      });
    }
  }

  const assignments: Assignment[] = [];
  const unassigned: UnassignedStudent[] = [];
  const usedSlots = new Set<string>();

  // Schüler mit ausgewählten Slots filtern und nach Anzahl sortieren (aufsteigend)
  const studentsWithSlots = students
    .filter(s => s.selectedSlots && s.selectedSlots.length > 0)
    .sort((a, b) => a.selectedSlots.length - b.selectedSlots.length);

  // Schüler ohne Auswahl
  const studentsWithoutSlots = students
    .filter(s => !s.selectedSlots || s.selectedSlots.length === 0);

  // Zuweisung für Schüler mit Auswahl
  for (const student of studentsWithSlots) {
    // Finde einen freien Slot aus den ausgewählten
    const availableSlot = student.selectedSlots.find(slotId => !usedSlots.has(slotId));

    if (availableSlot) {
      usedSlots.add(availableSlot);
      const slotInfo = allSlots.get(availableSlot);

      if (slotInfo) {
        assignments.push({
          studentId: student.id,
          studentName: student.name,
          slotId: availableSlot,
          date: slotInfo.date,
          start: slotInfo.start,
          end: slotInfo.end
        });
      }
    } else {
      unassigned.push({
        studentId: student.id,
        studentName: student.name,
        reason: 'Alle gewählten Termine sind bereits vergeben'
      });
    }
  }

  // Schüler ohne Auswahl als nicht zugewiesen markieren
  for (const student of studentsWithoutSlots) {
    unassigned.push({
      studentId: student.id,
      studentName: student.name,
      reason: 'Keine Termine ausgewählt'
    });
  }

  // Sortiere Zuweisungen nach Datum und Zeit
  assignments.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.start.localeCompare(b.start);
  });

  return {
    id: generateId(),
    projectId: project.id,
    assignments,
    unassigned,
    createdAt: nowISO()
  };
}

/**
 * Statistiken zur Terminauslastung berechnen
 */
export function getScheduleStats(
  project: Project,
  result: AssignmentResult
): {
  totalSlots: number;
  usedSlots: number;
  totalStudents: number;
  assignedStudents: number;
  unassignedStudents: number;
} {
  let totalSlots = 0;
  for (const day of project.timeSlots) {
    totalSlots += day.times.length;
  }

  return {
    totalSlots,
    usedSlots: result.assignments.length,
    totalStudents: result.assignments.length + result.unassigned.length,
    assignedStudents: result.assignments.length,
    unassignedStudents: result.unassigned.length
  };
}
