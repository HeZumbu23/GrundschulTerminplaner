import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { mkdir } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Express App initialisieren
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));
app.use('/uploads', express.static(join(__dirname, 'uploads')));

// Upload-Verzeichnis erstellen
await mkdir(join(__dirname, 'uploads'), { recursive: true });
await mkdir(join(__dirname, 'data'), { recursive: true });

// Multer für Datei-Uploads konfigurieren
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${uuidv4()}${getExtension(file.originalname)}`;
    cb(null, uniqueName);
  }
});

function getExtension(filename) {
  const ext = filename.split('.').pop();
  return ext ? `.${ext}` : '';
}

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Nur Bilder sind erlaubt!'), false);
    }
  }
});

// LowDB initialisieren
const dbFile = join(__dirname, 'data', 'db.json');
const adapter = new JSONFile(dbFile);
const defaultData = {
  projects: [],
  students: [],
  scans: [],
  assignments: []
};
const db = new Low(adapter, defaultData);

// Datenbank laden
await db.read();

// Hilfsfunktion zum Speichern
async function saveDb() {
  await db.write();
}

// ==================== API ROUTES ====================

// --- Projekte (Terminpläne) ---

// Alle Projekte abrufen
app.get('/api/projects', (req, res) => {
  res.json(db.data.projects);
});

// Einzelnes Projekt abrufen
app.get('/api/projects/:id', (req, res) => {
  const project = db.data.projects.find(p => p.id === req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Projekt nicht gefunden' });
  }
  res.json(project);
});

// Neues Projekt erstellen
app.post('/api/projects', async (req, res) => {
  const { title, teacherName, deadline, timeSlots } = req.body;

  if (!title || !timeSlots || timeSlots.length === 0) {
    return res.status(400).json({ error: 'Titel und Terminoptionen sind erforderlich' });
  }

  const project = {
    id: uuidv4(),
    title,
    teacherName: teacherName || '',
    deadline: deadline || '',
    timeSlots, // Array von { date, times: [{ start, end }] }
    createdAt: new Date().toISOString(),
    status: 'active'
  };

  db.data.projects.push(project);
  await saveDb();

  res.status(201).json(project);
});

// Projekt aktualisieren
app.put('/api/projects/:id', async (req, res) => {
  const index = db.data.projects.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Projekt nicht gefunden' });
  }

  db.data.projects[index] = {
    ...db.data.projects[index],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  await saveDb();
  res.json(db.data.projects[index]);
});

// Projekt löschen
app.delete('/api/projects/:id', async (req, res) => {
  const index = db.data.projects.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Projekt nicht gefunden' });
  }

  db.data.projects.splice(index, 1);
  await saveDb();
  res.json({ success: true });
});

// --- Schüler ---

// Alle Schüler eines Projekts abrufen
app.get('/api/projects/:projectId/students', (req, res) => {
  const students = db.data.students.filter(s => s.projectId === req.params.projectId);
  res.json(students);
});

// Schüler hinzufügen
app.post('/api/projects/:projectId/students', async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name ist erforderlich' });
  }

  const student = {
    id: uuidv4(),
    projectId: req.params.projectId,
    name,
    selectedSlots: [], // Vom Scan erkannte ausgewählte Termine
    assignedSlot: null, // Zugewiesener Termin
    createdAt: new Date().toISOString()
  };

  db.data.students.push(student);
  await saveDb();

  res.status(201).json(student);
});

// Mehrere Schüler auf einmal hinzufügen
app.post('/api/projects/:projectId/students/bulk', async (req, res) => {
  const { names } = req.body;

  if (!names || !Array.isArray(names)) {
    return res.status(400).json({ error: 'Namen-Array ist erforderlich' });
  }

  const students = names.map(name => ({
    id: uuidv4(),
    projectId: req.params.projectId,
    name: name.trim(),
    selectedSlots: [],
    assignedSlot: null,
    createdAt: new Date().toISOString()
  }));

  db.data.students.push(...students);
  await saveDb();

  res.status(201).json(students);
});

// Schüler aktualisieren (z.B. ausgewählte Termine setzen)
app.put('/api/students/:id', async (req, res) => {
  const index = db.data.students.findIndex(s => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Schüler nicht gefunden' });
  }

  db.data.students[index] = {
    ...db.data.students[index],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  await saveDb();
  res.json(db.data.students[index]);
});

// Schüler löschen
app.delete('/api/students/:id', async (req, res) => {
  const index = db.data.students.findIndex(s => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Schüler nicht gefunden' });
  }

  db.data.students.splice(index, 1);
  await saveDb();
  res.json({ success: true });
});

// --- Scans ---

// Scan hochladen
app.post('/api/projects/:projectId/scans', upload.single('scan'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Keine Datei hochgeladen' });
  }

  const scan = {
    id: uuidv4(),
    projectId: req.params.projectId,
    studentId: req.body.studentId || null,
    filename: req.file.filename,
    originalName: req.file.originalname,
    path: `/uploads/${req.file.filename}`,
    processed: false,
    extractedData: null,
    createdAt: new Date().toISOString()
  };

  db.data.scans.push(scan);
  await saveDb();

  res.status(201).json(scan);
});

// Alle Scans eines Projekts abrufen
app.get('/api/projects/:projectId/scans', (req, res) => {
  const scans = db.data.scans.filter(s => s.projectId === req.params.projectId);
  res.json(scans);
});

// Scan einem Schüler zuordnen und Termine manuell setzen
app.put('/api/scans/:id', async (req, res) => {
  const index = db.data.scans.findIndex(s => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Scan nicht gefunden' });
  }

  const { studentId, selectedSlots } = req.body;

  db.data.scans[index] = {
    ...db.data.scans[index],
    studentId,
    extractedData: { selectedSlots },
    processed: true,
    updatedAt: new Date().toISOString()
  };

  // Auch den Schüler aktualisieren
  if (studentId && selectedSlots) {
    const studentIndex = db.data.students.findIndex(s => s.id === studentId);
    if (studentIndex !== -1) {
      db.data.students[studentIndex].selectedSlots = selectedSlots;
    }
  }

  await saveDb();
  res.json(db.data.scans[index]);
});

// --- Terminzuweisung ---

// Automatische Terminzuweisung berechnen
app.post('/api/projects/:projectId/assign', async (req, res) => {
  const projectId = req.params.projectId;
  const project = db.data.projects.find(p => p.id === projectId);

  if (!project) {
    return res.status(404).json({ error: 'Projekt nicht gefunden' });
  }

  const students = db.data.students.filter(s => s.projectId === projectId);

  // Alle verfügbaren Slots sammeln
  const allSlots = [];
  for (const day of project.timeSlots) {
    for (const time of day.times) {
      allSlots.push({
        date: day.date,
        start: time.start,
        end: time.end,
        slotId: `${day.date}_${time.start}_${time.end}`
      });
    }
  }

  // Greedy-Algorithmus mit Priorisierung nach Anzahl der Optionen
  // Schüler mit weniger Optionen werden zuerst zugewiesen
  const assignments = [];
  const usedSlots = new Set();

  // Sortiere Schüler nach Anzahl der verfügbaren Slots (aufsteigend)
  const sortedStudents = [...students]
    .filter(s => s.selectedSlots && s.selectedSlots.length > 0)
    .sort((a, b) => a.selectedSlots.length - b.selectedSlots.length);

  for (const student of sortedStudents) {
    // Finde einen freien Slot aus den ausgewählten
    const availableSlot = student.selectedSlots.find(slotId => !usedSlots.has(slotId));

    if (availableSlot) {
      usedSlots.add(availableSlot);
      const slotInfo = allSlots.find(s => s.slotId === availableSlot);

      assignments.push({
        studentId: student.id,
        studentName: student.name,
        slotId: availableSlot,
        date: slotInfo?.date,
        start: slotInfo?.start,
        end: slotInfo?.end
      });

      // Schüler aktualisieren
      const studentIndex = db.data.students.findIndex(s => s.id === student.id);
      if (studentIndex !== -1) {
        db.data.students[studentIndex].assignedSlot = availableSlot;
      }
    }
  }

  // Nicht zugewiesene Schüler
  const unassigned = students.filter(s =>
    !assignments.find(a => a.studentId === s.id)
  ).map(s => ({
    studentId: s.id,
    studentName: s.name,
    reason: s.selectedSlots?.length === 0 ? 'Keine Termine ausgewählt' : 'Alle gewählten Termine belegt'
  }));

  // Speichere Zuweisungen
  const assignmentRecord = {
    id: uuidv4(),
    projectId,
    assignments,
    unassigned,
    createdAt: new Date().toISOString()
  };

  // Entferne alte Zuweisungen für dieses Projekt
  db.data.assignments = db.data.assignments.filter(a => a.projectId !== projectId);
  db.data.assignments.push(assignmentRecord);

  await saveDb();

  res.json({
    success: true,
    totalStudents: students.length,
    assigned: assignments.length,
    unassigned: unassigned.length,
    assignments,
    unassignedStudents: unassigned
  });
});

// Aktuelle Zuweisungen abrufen
app.get('/api/projects/:projectId/assignments', (req, res) => {
  const assignment = db.data.assignments.find(a => a.projectId === req.params.projectId);
  if (!assignment) {
    return res.json({ assignments: [], unassigned: [] });
  }
  res.json(assignment);
});

// Server starten
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
