import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Project, Student, AssignmentResult } from './types';

// Database Schema Definition
interface TerminplanerDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-date': string };
  };
  students: {
    key: string;
    value: Student;
    indexes: { 'by-project': string };
  };
  assignments: {
    key: string;
    value: AssignmentResult;
    indexes: { 'by-project': string };
  };
}

const DB_NAME = 'terminplaner-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<TerminplanerDB> | null = null;

// Datenbank initialisieren
async function getDb(): Promise<IDBPDatabase<TerminplanerDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<TerminplanerDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Projects Store
      if (!db.objectStoreNames.contains('projects')) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('by-date', 'createdAt');
      }

      // Students Store
      if (!db.objectStoreNames.contains('students')) {
        const studentStore = db.createObjectStore('students', { keyPath: 'id' });
        studentStore.createIndex('by-project', 'projectId');
      }

      // Assignments Store
      if (!db.objectStoreNames.contains('assignments')) {
        const assignmentStore = db.createObjectStore('assignments', { keyPath: 'id' });
        assignmentStore.createIndex('by-project', 'projectId');
      }
    }
  });

  return dbInstance;
}

// ==================== Projects ====================

export async function getAllProjects(): Promise<Project[]> {
  const db = await getDb();
  const projects = await db.getAll('projects');
  return projects.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDb();
  return db.get('projects', id);
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDb();
  await db.put('projects', project);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();

  // Auch alle zugehörigen Schüler und Zuweisungen löschen
  const students = await getStudentsByProject(id);
  for (const student of students) {
    await db.delete('students', student.id);
  }

  const assignments = await getAssignmentsByProject(id);
  for (const assignment of assignments) {
    await db.delete('assignments', assignment.id);
  }

  await db.delete('projects', id);
}

// ==================== Students ====================

export async function getStudentsByProject(projectId: string): Promise<Student[]> {
  const db = await getDb();
  return db.getAllFromIndex('students', 'by-project', projectId);
}

export async function getStudent(id: string): Promise<Student | undefined> {
  const db = await getDb();
  return db.get('students', id);
}

export async function saveStudent(student: Student): Promise<void> {
  const db = await getDb();
  await db.put('students', student);
}

export async function saveStudents(students: Student[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('students', 'readwrite');
  await Promise.all([
    ...students.map(s => tx.store.put(s)),
    tx.done
  ]);
}

export async function deleteStudent(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('students', id);
}

// ==================== Assignments ====================

export async function getAssignmentsByProject(projectId: string): Promise<AssignmentResult[]> {
  const db = await getDb();
  return db.getAllFromIndex('assignments', 'by-project', projectId);
}

export async function saveAssignment(assignment: AssignmentResult): Promise<void> {
  const db = await getDb();
  await db.put('assignments', assignment);
}

export async function deleteAssignmentsByProject(projectId: string): Promise<void> {
  const db = await getDb();
  const assignments = await getAssignmentsByProject(projectId);
  const tx = db.transaction('assignments', 'readwrite');
  await Promise.all([
    ...assignments.map(a => tx.store.delete(a.id)),
    tx.done
  ]);
}

// ==================== Utility ====================

export function generateId(): string {
  return crypto.randomUUID();
}

// Komplette Datenbank löschen (für DSGVO)
export async function clearAllData(): Promise<void> {
  const db = await getDb();
  await db.clear('projects');
  await db.clear('students');
  await db.clear('assignments');
}

// Export aller Daten (für Backup)
export async function exportAllData(): Promise<{
  projects: Project[];
  students: Student[];
  assignments: AssignmentResult[];
}> {
  const db = await getDb();
  return {
    projects: await db.getAll('projects'),
    students: await db.getAll('students'),
    assignments: await db.getAll('assignments')
  };
}
