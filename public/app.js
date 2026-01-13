// Grundschul-Terminplaner - Frontend App

const API_BASE = '/api';

// State
let currentProject = null;
let currentScan = null;
let timeSlots = []; // Temporäre Slots beim Erstellen

// DOM Elements
const pages = document.querySelectorAll('.page');
const navLinks = document.querySelectorAll('.nav-links a');

// ==================== Navigation ====================

function showPage(pageId) {
  pages.forEach(page => page.classList.remove('active'));
  navLinks.forEach(link => link.classList.remove('active'));

  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  const targetLink = document.querySelector(`[data-page="${pageId}"]`);
  if (targetLink) {
    targetLink.classList.add('active');
  }
}

// Navigation Links
document.querySelectorAll('[data-page]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = e.target.getAttribute('data-page');
    showPage(page);

    if (page === 'dashboard') {
      loadProjects();
    }
  });
});

// ==================== API Helpers ====================

async function apiGet(endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  return response.json();
}

async function apiPost(endpoint, data) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || response.statusText);
  }
  return response.json();
}

async function apiPut(endpoint, data) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || response.statusText);
  }
  return response.json();
}

async function apiDelete(endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  return response.json();
}

// ==================== Projekte ====================

async function loadProjects() {
  try {
    const projects = await apiGet('/projects');
    const container = document.getElementById('projects-list');
    const emptyMsg = document.getElementById('no-projects');

    if (projects.length === 0) {
      container.innerHTML = '';
      emptyMsg.style.display = 'block';
      return;
    }

    emptyMsg.style.display = 'none';
    container.innerHTML = projects.map(project => `
      <div class="project-card" data-project-id="${project.id}">
        <h3>${escapeHtml(project.title)}</h3>
        <p>${escapeHtml(project.teacherName || 'Keine Lehrkraft angegeben')}</p>
        <p>Termine: ${countSlots(project.timeSlots)}</p>
        <div class="project-meta">
          Erstellt: ${formatDate(project.createdAt)}
          ${project.deadline ? `<br>Rückgabe bis: ${formatDate(project.deadline)}` : ''}
        </div>
      </div>
    `).join('');

    // Click Handler für Projektkarten
    container.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('click', () => {
        const projectId = card.getAttribute('data-project-id');
        openProject(projectId);
      });
    });
  } catch (error) {
    console.error('Fehler beim Laden der Projekte:', error);
    alert('Fehler beim Laden der Projekte');
  }
}

function countSlots(timeSlots) {
  if (!timeSlots) return 0;
  return timeSlots.reduce((sum, day) => sum + (day.times?.length || 0), 0);
}

async function openProject(projectId) {
  try {
    currentProject = await apiGet(`/projects/${projectId}`);
    const students = await apiGet(`/projects/${projectId}/students`);

    document.getElementById('project-detail-title').textContent = currentProject.title;
    document.getElementById('project-detail-teacher').textContent = currentProject.teacherName || '-';
    document.getElementById('project-detail-deadline').textContent = currentProject.deadline
      ? formatDate(currentProject.deadline)
      : '-';
    document.getElementById('project-detail-slots').textContent = countSlots(currentProject.timeSlots);
    document.getElementById('project-detail-students').textContent = students.length;

    // Zuweisungen laden
    await loadAssignments();

    showPage('project');
  } catch (error) {
    console.error('Fehler beim Öffnen des Projekts:', error);
    alert('Fehler beim Öffnen des Projekts');
  }
}

async function loadAssignments() {
  try {
    const data = await apiGet(`/projects/${currentProject.id}/assignments`);

    const section = document.getElementById('assignments-section');
    const assignedList = document.getElementById('assignments-list');
    const unassignedList = document.getElementById('unassigned-list');

    if (!data.assignments || data.assignments.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    // Sortiere nach Datum und Uhrzeit
    const sorted = [...data.assignments].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.start.localeCompare(b.start);
    });

    assignedList.innerHTML = '<h4>Zugewiesene Termine:</h4>' +
      sorted.map(a => `
        <div class="assignment-card assigned">
          <span><strong>${escapeHtml(a.studentName)}</strong></span>
          <span>${formatDate(a.date)} | ${a.start} - ${a.end}</span>
        </div>
      `).join('');

    if (data.unassigned && data.unassigned.length > 0) {
      unassignedList.innerHTML = '<h4>Nicht zugewiesen:</h4>' +
        data.unassigned.map(u => `
          <div class="assignment-card unassigned">
            <span><strong>${escapeHtml(u.studentName)}</strong></span>
            <span>${escapeHtml(u.reason)}</span>
          </div>
        `).join('');
    } else {
      unassignedList.innerHTML = '';
    }
  } catch (error) {
    console.error('Fehler beim Laden der Zuweisungen:', error);
  }
}

// ==================== Projekt erstellen ====================

document.getElementById('add-slot-btn').addEventListener('click', () => {
  const date = document.getElementById('slot-date').value;
  const start = document.getElementById('slot-start').value;
  const end = document.getElementById('slot-end').value;

  if (!date || !start || !end) {
    alert('Bitte Datum, Start- und Endzeit angeben');
    return;
  }

  addTimeSlot(date, start, end);
});

document.getElementById('generate-slots-btn').addEventListener('click', () => {
  const date = document.getElementById('slot-date').value;
  const startTime = document.getElementById('slot-start').value;
  const endTime = document.getElementById('slot-end').value;
  const duration = parseInt(document.getElementById('slot-duration').value) || 15;

  if (!date || !startTime || !endTime) {
    alert('Bitte Datum, Start- und Endzeit angeben');
    return;
  }

  // Generiere Slots im Intervall
  let current = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  while (current + duration <= endMinutes) {
    const slotStart = minutesToTime(current);
    const slotEnd = minutesToTime(current + duration);
    addTimeSlot(date, slotStart, slotEnd);
    current += duration;
  }
});

function addTimeSlot(date, start, end) {
  // Prüfen ob Slot bereits existiert
  const slotId = `${date}_${start}_${end}`;
  const exists = timeSlots.some(s =>
    s.date === date && s.times.some(t => t.start === start && t.end === end)
  );

  if (exists) {
    return; // Duplikat ignorieren
  }

  // Zum passenden Datum hinzufügen oder neues Datum erstellen
  let daySlot = timeSlots.find(s => s.date === date);
  if (!daySlot) {
    daySlot = { date, times: [] };
    timeSlots.push(daySlot);
  }

  daySlot.times.push({ start, end });

  // Sortiere Zeiten
  daySlot.times.sort((a, b) => a.start.localeCompare(b.start));

  // Sortiere Tage
  timeSlots.sort((a, b) => a.date.localeCompare(b.date));

  renderTimeSlots();
}

function removeTimeSlot(date, start, end) {
  const dayIndex = timeSlots.findIndex(s => s.date === date);
  if (dayIndex === -1) return;

  const timeIndex = timeSlots[dayIndex].times.findIndex(
    t => t.start === start && t.end === end
  );

  if (timeIndex !== -1) {
    timeSlots[dayIndex].times.splice(timeIndex, 1);

    // Entferne leere Tage
    if (timeSlots[dayIndex].times.length === 0) {
      timeSlots.splice(dayIndex, 1);
    }
  }

  renderTimeSlots();
}

function renderTimeSlots() {
  const container = document.getElementById('time-slots-list');

  if (timeSlots.length === 0) {
    container.innerHTML = '<p style="color: #888;">Noch keine Termine hinzugefügt</p>';
    return;
  }

  container.innerHTML = timeSlots.map(day => `
    <div class="slot-day-preview">
      <strong>${formatDate(day.date)}:</strong>
      ${day.times.map(t => `
        <span class="slot-tag">
          ${t.start} - ${t.end}
          <button class="remove-slot" data-date="${day.date}" data-start="${t.start}" data-end="${t.end}">&times;</button>
        </span>
      `).join('')}
    </div>
  `).join('');

  // Click Handler für Entfernen
  container.querySelectorAll('.remove-slot').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const { date, start, end } = e.target.dataset;
      removeTimeSlot(date, start, end);
    });
  });
}

document.getElementById('create-project-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('project-title').value.trim();
  const teacherName = document.getElementById('teacher-name').value.trim();
  const deadline = document.getElementById('deadline').value;

  if (!title) {
    alert('Bitte einen Titel eingeben');
    return;
  }

  if (timeSlots.length === 0) {
    alert('Bitte mindestens einen Termin hinzufügen');
    return;
  }

  try {
    const project = await apiPost('/projects', {
      title,
      teacherName,
      deadline,
      timeSlots
    });

    // Formular zurücksetzen
    document.getElementById('create-project-form').reset();
    timeSlots = [];
    renderTimeSlots();

    alert('Projekt erfolgreich erstellt!');
    currentProject = project;
    openProject(project.id);
  } catch (error) {
    console.error('Fehler beim Erstellen des Projekts:', error);
    alert('Fehler beim Erstellen des Projekts: ' + error.message);
  }
});

// ==================== Schüler verwalten ====================

document.getElementById('btn-manage-students').addEventListener('click', () => {
  showPage('students');
  loadStudents();
});

document.getElementById('btn-back-to-project').addEventListener('click', () => {
  showPage('project');
});

async function loadStudents() {
  if (!currentProject) return;

  try {
    const students = await apiGet(`/projects/${currentProject.id}/students`);
    const tbody = document.getElementById('students-tbody');

    if (students.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">Noch keine Schüler hinzugefügt</td></tr>';
      return;
    }

    tbody.innerHTML = students.map(student => `
      <tr>
        <td>${escapeHtml(student.name)}</td>
        <td>${student.selectedSlots?.length || 0} Termine</td>
        <td>${student.assignedSlot ? formatSlotId(student.assignedSlot) : '-'}</td>
        <td class="actions">
          <button class="btn btn-small btn-danger" onclick="deleteStudent('${student.id}')">Löschen</button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Fehler beim Laden der Schüler:', error);
  }
}

document.getElementById('add-students-btn').addEventListener('click', async () => {
  const textarea = document.getElementById('student-names');
  const namesText = textarea.value.trim();

  if (!namesText) {
    alert('Bitte Namen eingeben');
    return;
  }

  const names = namesText.split('\n')
    .map(n => n.trim())
    .filter(n => n.length > 0);

  if (names.length === 0) {
    alert('Keine gültigen Namen gefunden');
    return;
  }

  try {
    await apiPost(`/projects/${currentProject.id}/students/bulk`, { names });
    textarea.value = '';
    loadStudents();
  } catch (error) {
    console.error('Fehler beim Hinzufügen der Schüler:', error);
    alert('Fehler beim Hinzufügen der Schüler: ' + error.message);
  }
});

async function deleteStudent(studentId) {
  if (!confirm('Schüler wirklich löschen?')) return;

  try {
    await apiDelete(`/students/${studentId}`);
    loadStudents();
  } catch (error) {
    console.error('Fehler beim Löschen des Schülers:', error);
    alert('Fehler beim Löschen');
  }
}

// Global machen für onclick
window.deleteStudent = deleteStudent;

// ==================== Scans ====================

document.getElementById('btn-upload-scans').addEventListener('click', () => {
  showPage('scans');
  loadScans();
  loadStudentSelect();
});

document.getElementById('btn-back-to-project-scans').addEventListener('click', () => {
  showPage('project');
});

async function loadStudentSelect() {
  if (!currentProject) return;

  try {
    const students = await apiGet(`/projects/${currentProject.id}/students`);
    const select = document.getElementById('scan-student');

    select.innerHTML = '<option value="">-- Schüler wählen --</option>' +
      students.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  } catch (error) {
    console.error('Fehler beim Laden der Schüler:', error);
  }
}

async function loadScans() {
  if (!currentProject) return;

  try {
    const scans = await apiGet(`/projects/${currentProject.id}/scans`);
    const students = await apiGet(`/projects/${currentProject.id}/students`);
    const container = document.getElementById('scans-list');

    if (scans.length === 0) {
      container.innerHTML = '<p>Noch keine Scans hochgeladen</p>';
      return;
    }

    container.innerHTML = scans.map(scan => {
      const student = students.find(s => s.id === scan.studentId);
      return `
        <div class="scan-card">
          <img src="${scan.path}" alt="Scan" onclick="openScanAssign('${scan.id}')">
          <div class="scan-card-content">
            <h4>${student ? escapeHtml(student.name) : 'Nicht zugeordnet'}</h4>
            <p>Hochgeladen: ${formatDate(scan.createdAt)}</p>
            <span class="status-badge ${scan.processed ? 'processed' : 'pending'}">
              ${scan.processed ? 'Verarbeitet' : 'Ausstehend'}
            </span>
            <br>
            <button class="btn btn-small btn-secondary" style="margin-top: 0.5rem;" onclick="openScanAssign('${scan.id}')">
              Termine zuordnen
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Fehler beim Laden der Scans:', error);
  }
}

document.getElementById('upload-scan-btn').addEventListener('click', async () => {
  const studentId = document.getElementById('scan-student').value;
  const fileInput = document.getElementById('scan-file');

  if (!fileInput.files[0]) {
    alert('Bitte eine Datei auswählen');
    return;
  }

  const formData = new FormData();
  formData.append('scan', fileInput.files[0]);
  if (studentId) {
    formData.append('studentId', studentId);
  }

  try {
    const response = await fetch(`${API_BASE}/projects/${currentProject.id}/scans`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Upload fehlgeschlagen');
    }

    fileInput.value = '';
    document.getElementById('scan-student').value = '';
    loadScans();
    alert('Scan erfolgreich hochgeladen!');
  } catch (error) {
    console.error('Fehler beim Upload:', error);
    alert('Fehler beim Upload: ' + error.message);
  }
});

// ==================== Scan Termine zuordnen ====================

async function openScanAssign(scanId) {
  try {
    const scans = await apiGet(`/projects/${currentProject.id}/scans`);
    currentScan = scans.find(s => s.id === scanId);

    if (!currentScan) {
      alert('Scan nicht gefunden');
      return;
    }

    const students = await apiGet(`/projects/${currentProject.id}/students`);
    const student = students.find(s => s.id === currentScan.studentId);

    document.getElementById('assign-student-name').textContent =
      student ? student.name : 'Nicht zugeordnet';
    document.getElementById('assign-scan-image').src = currentScan.path;

    // Checkboxen für Slots generieren
    renderSlotCheckboxes(student?.selectedSlots || []);

    showPage('assign-slots');
  } catch (error) {
    console.error('Fehler:', error);
    alert('Fehler beim Laden');
  }
}

window.openScanAssign = openScanAssign;

function renderSlotCheckboxes(selectedSlots) {
  const container = document.getElementById('slots-checkboxes');

  if (!currentProject.timeSlots || currentProject.timeSlots.length === 0) {
    container.innerHTML = '<p>Keine Termine verfügbar</p>';
    return;
  }

  container.innerHTML = currentProject.timeSlots.map(day => `
    <div class="slot-day">
      <h4>${formatDate(day.date)} (${getDayName(day.date)})</h4>
      ${day.times.map(time => {
        const slotId = `${day.date}_${time.start}_${time.end}`;
        const checked = selectedSlots.includes(slotId) ? 'checked' : '';
        return `
          <label class="slot-checkbox">
            <input type="checkbox" value="${slotId}" ${checked}>
            ${time.start} - ${time.end}
          </label>
        `;
      }).join('')}
    </div>
  `).join('');
}

document.getElementById('btn-back-to-scans').addEventListener('click', () => {
  showPage('scans');
});

document.getElementById('save-slots-btn').addEventListener('click', async () => {
  const checkboxes = document.querySelectorAll('#slots-checkboxes input:checked');
  const selectedSlots = Array.from(checkboxes).map(cb => cb.value);

  if (!currentScan.studentId) {
    alert('Bitte zuerst einen Schüler dem Scan zuordnen');
    return;
  }

  try {
    await apiPut(`/scans/${currentScan.id}`, {
      studentId: currentScan.studentId,
      selectedSlots
    });

    alert('Termine gespeichert!');
    showPage('scans');
    loadScans();
  } catch (error) {
    console.error('Fehler beim Speichern:', error);
    alert('Fehler beim Speichern: ' + error.message);
  }
});

// ==================== Termine zuweisen ====================

document.getElementById('btn-assign').addEventListener('click', async () => {
  if (!currentProject) return;

  if (!confirm('Termine automatisch zuweisen? Bestehende Zuweisungen werden überschrieben.')) {
    return;
  }

  try {
    const result = await apiPost(`/projects/${currentProject.id}/assign`, {});

    let message = `Zuweisung abgeschlossen!\n\n`;
    message += `Gesamt: ${result.totalStudents} Schüler\n`;
    message += `Zugewiesen: ${result.assigned}\n`;
    message += `Nicht zugewiesen: ${result.unassigned}`;

    if (result.unassignedStudents && result.unassignedStudents.length > 0) {
      message += '\n\nNicht zugewiesene Schüler:\n';
      result.unassignedStudents.forEach(u => {
        message += `- ${u.studentName}: ${u.reason}\n`;
      });
    }

    alert(message);

    // Zuweisungen neu laden
    loadAssignments();
    document.getElementById('project-detail-students').textContent =
      result.totalStudents;
  } catch (error) {
    console.error('Fehler bei der Zuweisung:', error);
    alert('Fehler bei der Zuweisung: ' + error.message);
  }
});

// ==================== Druckansicht ====================

document.getElementById('btn-print').addEventListener('click', () => {
  generatePrintDocument();
  showPage('print');
});

document.getElementById('btn-back-from-print').addEventListener('click', () => {
  showPage('project');
});

document.getElementById('btn-do-print').addEventListener('click', () => {
  window.print();
});

function generatePrintDocument() {
  if (!currentProject) return;

  const container = document.getElementById('print-content');

  // Gruppiere Slots nach Wochentag
  const slotsByDay = currentProject.timeSlots.map(day => ({
    date: day.date,
    dayName: getDayName(day.date),
    formattedDate: formatDate(day.date),
    times: day.times
  }));

  container.innerHTML = `
    <div class="print-document">
      <h1>${escapeHtml(currentProject.title)}</h1>

      <div class="header-info">
        <div class="name-field">
          <strong>Name des Kindes:</strong> ________________________________
        </div>
        <div class="deadline-field">
          ${currentProject.deadline
            ? `Bitte ausfüllen und<br>bis spätestens ${formatDate(currentProject.deadline)}<br>zurückgeben.`
            : ''}
        </div>
      </div>

      <p class="instructions">
        Bitte kreuzen Sie so viele Termine wie möglich an:
      </p>

      <table class="slots-table">
        <thead>
          <tr>
            ${slotsByDay.map(day => `
              <th colspan="2">${day.dayName}<br>${day.formattedDate}</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${generateTableRows(slotsByDay)}
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
    </div>
  `;
}

function generateTableRows(slotsByDay) {
  // Finde die maximale Anzahl an Slots pro Tag
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

// ==================== Hilfsfunktionen ====================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
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

function getDayName(dateStr) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', { weekday: 'long' });
  } catch {
    return '';
  }
}

function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function formatSlotId(slotId) {
  if (!slotId) return '-';
  const parts = slotId.split('_');
  if (parts.length >= 3) {
    return `${formatDate(parts[0])} ${parts[1]} - ${parts[2]}`;
  }
  return slotId;
}

// ==================== Initialisierung ====================

// Beim Start die Projekte laden
document.addEventListener('DOMContentLoaded', () => {
  loadProjects();
});
