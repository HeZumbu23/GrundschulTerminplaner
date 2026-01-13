import type { Project, Student, DaySlots } from './types';
import * as db from './db';
import { calculateAssignments, getScheduleStats } from './scheduler';
import { escapeHtml, formatDate, getDayName, timeToMinutes, minutesToTime, formatSlotId, nowISO } from './utils';

// ==================== State ====================

let currentProject: Project | null = null;
let currentStudent: Student | null = null;
let tempTimeSlots: DaySlots[] = [];

// ==================== Navigation ====================

export function showPage(pageId: string): void {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));

  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  const targetLink = document.querySelector(`[data-page="${pageId}"]`);
  if (targetLink) {
    targetLink.classList.add('active');
  }
}

// ==================== Projects ====================

export async function loadProjects(): Promise<void> {
  const projects = await db.getAllProjects();
  const container = document.getElementById('projects-list')!;
  const emptyMsg = document.getElementById('no-projects')!;

  if (projects.length === 0) {
    container.innerHTML = '';
    emptyMsg.style.display = 'block';
    return;
  }

  emptyMsg.style.display = 'none';
  container.innerHTML = projects.map(project => `
    <div class="project-card" data-project-id="${project.id}">
      <h3>${escapeHtml(project.title)}</h3>
      <p>Termine: ${countSlots(project.timeSlots)} | Dauer: ${project.appointmentDuration || 15} Min</p>
      <div class="project-meta">
        Erstellt: ${formatDate(project.createdAt)}
        ${project.deadline ? `<br>Rückgabe bis: ${formatDate(project.deadline)}` : ''}
      </div>
      <button class="btn btn-small btn-danger delete-project-btn" data-id="${project.id}">Löschen</button>
    </div>
  `).join('');

  // Click Handler für Projektkarten
  container.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('delete-project-btn')) {
        e.stopPropagation();
        const id = target.getAttribute('data-id')!;
        if (confirm('Projekt wirklich löschen? Alle Daten werden entfernt.')) {
          await db.deleteProject(id);
          loadProjects();
        }
        return;
      }

      const projectId = card.getAttribute('data-project-id')!;
      await openProject(projectId);
    });
  });
}

function countSlots(timeSlots: DaySlots[]): number {
  return timeSlots.reduce((sum, day) => sum + day.times.length, 0);
}

async function openProject(projectId: string): Promise<void> {
  const project = await db.getProject(projectId);
  if (!project) {
    alert('Projekt nicht gefunden');
    return;
  }

  currentProject = project;
  const students = await db.getStudentsByProject(projectId);

  document.getElementById('project-detail-title')!.textContent = project.title;
  document.getElementById('project-detail-deadline')!.textContent = project.deadline
    ? formatDate(project.deadline)
    : '-';
  document.getElementById('project-detail-duration')!.textContent = String(project.appointmentDuration || 15);
  document.getElementById('project-detail-break')!.textContent = String(project.breakDuration || 0);
  document.getElementById('project-detail-slots')!.textContent = String(countSlots(project.timeSlots));
  document.getElementById('project-detail-students')!.textContent = String(students.length);

  await loadAssignments();
  showPage('project');
}

async function loadAssignments(): Promise<void> {
  if (!currentProject) return;

  const results = await db.getAssignmentsByProject(currentProject.id);
  const section = document.getElementById('assignments-section')!;
  const assignedList = document.getElementById('assignments-list')!;
  const unassignedList = document.getElementById('unassigned-list')!;

  if (results.length === 0) {
    section.style.display = 'none';
    return;
  }

  const result = results[results.length - 1]; // Neueste Zuweisung
  section.style.display = 'block';

  const stats = getScheduleStats(currentProject, result);

  assignedList.innerHTML = `
    <h4>Zugewiesene Termine (${stats.assignedStudents}/${stats.totalStudents}):</h4>
    ${result.assignments.map(a => `
      <div class="assignment-card assigned">
        <span><strong>Bogen #${escapeHtml(a.formNumber)}</strong></span>
        <span>${formatDate(a.date)} | ${a.start} - ${a.end}</span>
      </div>
    `).join('')}
  `;

  if (result.unassigned.length > 0) {
    unassignedList.innerHTML = `
      <h4>Nicht zugewiesen (${result.unassigned.length}):</h4>
      ${result.unassigned.map(u => `
        <div class="assignment-card unassigned">
          <span><strong>Bogen #${escapeHtml(u.formNumber)}</strong></span>
          <span>${escapeHtml(u.reason)}</span>
        </div>
      `).join('')}
    `;
  } else {
    unassignedList.innerHTML = '';
  }
}

// ==================== Create Project ====================

export function addTimeSlot(date: string, start: string, end: string): void {
  let daySlot = tempTimeSlots.find(s => s.date === date);
  if (!daySlot) {
    daySlot = { date, times: [] };
    tempTimeSlots.push(daySlot);
  }

  // Prüfen ob Slot bereits existiert
  const exists = daySlot.times.some(t => t.start === start && t.end === end);
  if (exists) return;

  daySlot.times.push({ start, end });
  daySlot.times.sort((a, b) => a.start.localeCompare(b.start));
  tempTimeSlots.sort((a, b) => a.date.localeCompare(b.date));

  renderTimeSlots();
}

export function removeTimeSlot(date: string, start: string, end: string): void {
  const dayIndex = tempTimeSlots.findIndex(s => s.date === date);
  if (dayIndex === -1) return;

  const timeIndex = tempTimeSlots[dayIndex].times.findIndex(
    t => t.start === start && t.end === end
  );

  if (timeIndex !== -1) {
    tempTimeSlots[dayIndex].times.splice(timeIndex, 1);
    if (tempTimeSlots[dayIndex].times.length === 0) {
      tempTimeSlots.splice(dayIndex, 1);
    }
  }

  renderTimeSlots();
}

function renderTimeSlots(): void {
  const container = document.getElementById('time-slots-list')!;

  if (tempTimeSlots.length === 0) {
    container.innerHTML = '<p class="empty-hint">Noch keine Termine hinzugefügt</p>';
    return;
  }

  container.innerHTML = tempTimeSlots.map(day => `
    <div class="slot-day-preview">
      <strong>${formatDate(day.date)} (${getDayName(day.date)}):</strong>
      <div class="slot-tags">
        ${day.times.map(t => `
          <span class="slot-tag">
            ${t.start} - ${t.end}
            <button class="remove-slot" data-date="${day.date}" data-start="${t.start}" data-end="${t.end}">&times;</button>
          </span>
        `).join('')}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.remove-slot').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = e.target as HTMLElement;
      const { date, start, end } = target.dataset;
      removeTimeSlot(date!, start!, end!);
    });
  });
}

export function generateSlots(date: string, startTime: string, endTime: string, duration: number, breakDuration: number = 0): void {
  let current = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const totalDuration = duration + breakDuration;

  while (current + duration <= endMinutes) {
    const slotStart = minutesToTime(current);
    const slotEnd = minutesToTime(current + duration);
    addTimeSlot(date, slotStart, slotEnd);
    current += totalDuration;
  }
}

export async function createProject(
  title: string,
  deadline: string,
  appointmentDuration: number,
  breakDuration: number
): Promise<Project> {
  const project: Project = {
    id: db.generateId(),
    title,
    deadline,
    appointmentDuration,
    breakDuration,
    timeSlots: [...tempTimeSlots],
    createdAt: nowISO(),
    status: 'active'
  };

  await db.saveProject(project);
  tempTimeSlots = [];
  renderTimeSlots();

  return project;
}

export function resetCreateForm(): void {
  tempTimeSlots = [];
  renderTimeSlots();
}

// ==================== Students ====================

export async function loadStudents(): Promise<void> {
  if (!currentProject) return;

  const students = await db.getStudentsByProject(currentProject.id);
  const tbody = document.getElementById('students-tbody')!;

  if (students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">Noch keine Bögen erstellt</td></tr>';
    return;
  }

  tbody.innerHTML = students.map(student => `
    <tr>
      <td><strong>#${escapeHtml(student.formNumber)}</strong></td>
      <td>
        ${student.selectedSlots.length} Termine
        ${student.selectedSlots.length > 0
          ? `<button class="btn btn-small btn-link view-slots-btn" data-id="${student.id}">anzeigen</button>`
          : ''}
      </td>
      <td>${student.assignedSlot ? formatSlotId(student.assignedSlot) : '-'}</td>
      <td class="actions">
        <button class="btn btn-small btn-secondary edit-slots-btn" data-id="${student.id}">Termine</button>
        <button class="btn btn-small btn-danger delete-student-btn" data-id="${student.id}">Löschen</button>
      </td>
    </tr>
  `).join('');

  // Event Handler
  tbody.querySelectorAll('.delete-student-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = (e.target as HTMLElement).dataset.id!;
      if (confirm('Bogen wirklich löschen?')) {
        await db.deleteStudent(id);
        loadStudents();
      }
    });
  });

  tbody.querySelectorAll('.edit-slots-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = (e.target as HTMLElement).dataset.id!;
      await openSlotSelection(id);
    });
  });
}

function generateFormNumber(): string {
  // Generiert eine 6-stellige Zufallsnummer
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function addStudents(count: number): Promise<void> {
  if (!currentProject) return;

  if (count < 1 || count > 50) {
    alert('Bitte eine Anzahl zwischen 1 und 50 eingeben');
    return;
  }

  // Sammle alle existierenden Nummern um Duplikate zu vermeiden
  const existingStudents = await db.getStudentsByProject(currentProject.id);
  const existingNumbers = new Set(existingStudents.map(s => s.formNumber));

  const students: Student[] = [];
  for (let i = 0; i < count; i++) {
    let formNumber: string;
    // Stelle sicher, dass die Nummer einzigartig ist
    do {
      formNumber = generateFormNumber();
    } while (existingNumbers.has(formNumber));

    existingNumbers.add(formNumber);

    students.push({
      id: db.generateId(),
      projectId: currentProject.id,
      formNumber,
      selectedSlots: [],
      assignedSlot: null,
      createdAt: nowISO()
    });
  }

  await db.saveStudents(students);
  loadStudents();
}

// ==================== Slot Selection ====================

async function openSlotSelection(studentId: string): Promise<void> {
  const student = await db.getStudent(studentId);
  if (!student || !currentProject) return;

  currentStudent = student;

  document.getElementById('slot-selection-title')!.textContent =
    `Termine für Bogen #${student.formNumber} auswählen`;

  renderSlotCheckboxes(student.selectedSlots);

  // Scan-Vorschau anzeigen falls vorhanden
  const scanPreview = document.getElementById('scan-preview-container')!;
  if (student.scanData) {
    scanPreview.innerHTML = `<img src="${student.scanData}" alt="Scan" class="scan-preview-img">`;
    scanPreview.style.display = 'block';
  } else {
    scanPreview.style.display = 'none';
  }

  showPage('slot-selection');
}

function renderSlotCheckboxes(selectedSlots: string[]): void {
  if (!currentProject) return;

  const container = document.getElementById('slots-checkboxes')!;

  container.innerHTML = currentProject.timeSlots.map(day => `
    <div class="slot-day">
      <h4>${formatDate(day.date)} (${getDayName(day.date)})</h4>
      ${day.times.map(time => {
        const slotId = `${day.date}_${time.start}_${time.end}`;
        const checked = selectedSlots.includes(slotId) ? 'checked' : '';
        return `
          <label class="slot-checkbox">
            <input type="checkbox" value="${slotId}" ${checked}>
            ${time.start} - ${time.end} Uhr
          </label>
        `;
      }).join('')}
    </div>
  `).join('');
}

export async function saveSelectedSlots(): Promise<void> {
  if (!currentStudent) return;

  const checkboxes = document.querySelectorAll('#slots-checkboxes input:checked') as NodeListOf<HTMLInputElement>;
  const selectedSlots = Array.from(checkboxes).map(cb => cb.value);

  currentStudent.selectedSlots = selectedSlots;
  await db.saveStudent(currentStudent);

  showPage('students');
  loadStudents();
}

// ==================== Camera / Scan ====================

export async function openCamera(): Promise<void> {
  if (!currentStudent) return;

  const video = document.getElementById('camera-video') as HTMLVideoElement;
  const cameraContainer = document.getElementById('camera-container')!;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });

    video.srcObject = stream;
    cameraContainer.style.display = 'block';
  } catch (err) {
    alert('Kamera konnte nicht geöffnet werden. Bitte Berechtigung erteilen.');
    console.error(err);
  }
}

export function closeCamera(): void {
  const video = document.getElementById('camera-video') as HTMLVideoElement;
  const cameraContainer = document.getElementById('camera-container')!;

  if (video.srcObject) {
    const stream = video.srcObject as MediaStream;
    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }

  cameraContainer.style.display = 'none';
}

export async function capturePhoto(): Promise<void> {
  if (!currentStudent) return;

  const video = document.getElementById('camera-video') as HTMLVideoElement;
  const canvas = document.createElement('canvas');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0);

  const imageData = canvas.toDataURL('image/jpeg', 0.8);
  currentStudent.scanData = imageData;
  await db.saveStudent(currentStudent);

  closeCamera();

  // Vorschau aktualisieren
  const scanPreview = document.getElementById('scan-preview-container')!;
  scanPreview.innerHTML = `<img src="${imageData}" alt="Scan" class="scan-preview-img">`;
  scanPreview.style.display = 'block';
}

export async function handleFileUpload(file: File): Promise<void> {
  if (!currentStudent) return;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      currentStudent!.scanData = imageData;
      await db.saveStudent(currentStudent!);

      const scanPreview = document.getElementById('scan-preview-container')!;
      scanPreview.innerHTML = `<img src="${imageData}" alt="Scan" class="scan-preview-img">`;
      scanPreview.style.display = 'block';

      resolve();
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==================== Assignment ====================

export async function runAssignment(): Promise<void> {
  if (!currentProject) return;

  const students = await db.getStudentsByProject(currentProject.id);

  if (students.length === 0) {
    alert('Keine Bögen vorhanden');
    return;
  }

  const studentsWithSlots = students.filter(s => s.selectedSlots.length > 0);
  if (studentsWithSlots.length === 0) {
    alert('Noch keine Termine ausgewählt. Bitte zuerst die Terminauswahl für die Bögen vornehmen.');
    return;
  }

  if (!confirm('Termine automatisch zuweisen? Bestehende Zuweisungen werden überschrieben.')) {
    return;
  }

  // Alte Zuweisungen löschen
  await db.deleteAssignmentsByProject(currentProject.id);

  // Neue Zuweisung berechnen
  const result = calculateAssignments(currentProject, students);
  await db.saveAssignment(result);

  // Schüler aktualisieren
  for (const assignment of result.assignments) {
    const student = students.find(s => s.id === assignment.studentId);
    if (student) {
      student.assignedSlot = assignment.slotId;
      await db.saveStudent(student);
    }
  }

  const stats = getScheduleStats(currentProject, result);

  alert(`Zuweisung abgeschlossen!\n\n` +
    `Gesamt: ${stats.totalStudents} Bögen\n` +
    `Zugewiesen: ${stats.assignedStudents}\n` +
    `Nicht zugewiesen: ${stats.unassignedStudents}`);

  loadAssignments();
}

// ==================== Print ====================

export async function generatePrintDocument(): Promise<void> {
  if (!currentProject) return;

  const project = currentProject;
  const students = await db.getStudentsByProject(project.id);
  const container = document.getElementById('print-content')!;

  // Generiere für jeden Bogen ein separates Dokument
  container.innerHTML = students.map(student => `
    <div class="print-document">
      <div class="form-number-header">
        <h1>Bogen #${escapeHtml(student.formNumber)}</h1>
      </div>

      <h2>${escapeHtml(project.title)}</h2>

      <div class="header-info">
        <div class="deadline-field">
          ${project.deadline
            ? `Bitte ausfüllen und bis spätestens ${formatDate(project.deadline)} zurückgeben.`
            : ''}
        </div>
      </div>

      <p class="instructions">
        Bitte kreuzen Sie so viele Termine wie möglich an:
      </p>

      <table class="slots-table">
        <thead>
          <tr>
            ${project.timeSlots.map(day => `
              <th colspan="2">${getDayName(day.date)}<br>${formatDate(day.date)}</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${generateTableRows(project.timeSlots)}
        </tbody>
      </table>

      <div class="signature-section">
        <div>
          <div class="signature-line"></div>
          <small>Datum</small>
        </div>
        <div>
          <div class="signature-line"></div>
          <small>Unterschrift</small>
        </div>
      </div>

      <div class="backside-note">
        <strong>Hinweis:</strong> Bitte tragen Sie auf der Rückseite dieses Bogens den Namen Ihres Kindes ein.
      </div>
    </div>
  `).join('<div class="page-break"></div>');
}

function generateTableRows(slotsByDay: DaySlots[]): string {
  const maxSlots = Math.max(...slotsByDay.map(d => d.times.length));
  let rows = '';

  for (let i = 0; i < maxSlots; i++) {
    rows += '<tr>';

    for (const day of slotsByDay) {
      if (day.times[i]) {
        const time = day.times[i];
        rows += `
          <td class="checkbox-cell">&#9744;</td>
          <td>${time.start} - ${time.end} Uhr</td>
        `;
      } else {
        rows += '<td></td><td></td>';
      }
    }

    rows += '</tr>';
  }

  return rows;
}

// ==================== DSGVO ====================

export async function deleteAllData(): Promise<void> {
  if (!confirm('ACHTUNG: Alle Daten werden unwiderruflich gelöscht!\n\nDies umfasst alle Projekte, Schüler und Termine.\n\nFortfahren?')) {
    return;
  }

  if (!confirm('Sind Sie wirklich sicher? Diese Aktion kann nicht rückgängig gemacht werden.')) {
    return;
  }

  await db.clearAllData();
  currentProject = null;
  currentStudent = null;
  tempTimeSlots = [];

  alert('Alle Daten wurden gelöscht.');
  showPage('dashboard');
  loadProjects();
}

// ==================== Init ====================

export function getCurrentProject(): Project | null {
  return currentProject;
}

export function setCurrentProject(project: Project | null): void {
  currentProject = project;
}
