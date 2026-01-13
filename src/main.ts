import './styles.css';
import * as app from './app';

// ==================== Event Listeners ====================

document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  document.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = (e.target as HTMLElement).getAttribute('data-page')!;
      app.showPage(page);

      if (page === 'dashboard') {
        app.loadProjects();
      } else if (page === 'create') {
        app.resetCreateForm();
      }
    });
  });

  // Create Project Form
  const addSlotBtn = document.getElementById('add-slot-btn');
  addSlotBtn?.addEventListener('click', () => {
    const date = (document.getElementById('slot-date') as HTMLInputElement).value;
    const start = (document.getElementById('slot-start') as HTMLInputElement).value;
    const end = (document.getElementById('slot-end') as HTMLInputElement).value;

    if (!date || !start || !end) {
      alert('Bitte Datum, Start- und Endzeit angeben');
      return;
    }

    app.addTimeSlot(date, start, end);
  });

  const generateSlotsBtn = document.getElementById('generate-slots-btn');
  generateSlotsBtn?.addEventListener('click', () => {
    const date = (document.getElementById('slot-date') as HTMLInputElement).value;
    const start = (document.getElementById('slot-start') as HTMLInputElement).value;
    const end = (document.getElementById('slot-end') as HTMLInputElement).value;
    const duration = parseInt((document.getElementById('slot-duration') as HTMLInputElement).value) || 15;

    if (!date || !start || !end) {
      alert('Bitte Datum, Start- und Endzeit angeben');
      return;
    }

    app.generateSlots(date, start, end, duration);
  });

  const createForm = document.getElementById('create-project-form');
  createForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = (document.getElementById('project-title') as HTMLInputElement).value.trim();
    const teacherName = (document.getElementById('teacher-name') as HTMLInputElement).value.trim();
    const deadline = (document.getElementById('deadline') as HTMLInputElement).value;

    if (!title) {
      alert('Bitte einen Titel eingeben');
      return;
    }

    try {
      const project = await app.createProject(title, teacherName, deadline);
      (createForm as HTMLFormElement).reset();
      alert('Projekt erfolgreich erstellt!');
      app.setCurrentProject(project);
      app.showPage('project');
      document.getElementById('project-detail-title')!.textContent = project.title;
      document.getElementById('project-detail-teacher')!.textContent = project.teacherName || '-';
      document.getElementById('project-detail-deadline')!.textContent = project.deadline || '-';
      document.getElementById('project-detail-slots')!.textContent = String(
        project.timeSlots.reduce((sum, day) => sum + day.times.length, 0)
      );
      document.getElementById('project-detail-students')!.textContent = '0';
    } catch (error) {
      console.error(error);
      alert('Fehler beim Erstellen des Projekts');
    }
  });

  // Project Detail Buttons
  document.getElementById('btn-print')?.addEventListener('click', () => {
    app.generatePrintDocument();
    app.showPage('print');
  });

  document.getElementById('btn-manage-students')?.addEventListener('click', () => {
    app.showPage('students');
    app.loadStudents();
  });

  document.getElementById('btn-assign')?.addEventListener('click', () => {
    app.runAssignment();
  });

  // Students Page
  document.getElementById('btn-back-to-project')?.addEventListener('click', () => {
    app.showPage('project');
  });

  document.getElementById('add-students-btn')?.addEventListener('click', async () => {
    const textarea = document.getElementById('student-names') as HTMLTextAreaElement;
    await app.addStudents(textarea.value);
    textarea.value = '';
  });

  // Slot Selection Page
  document.getElementById('btn-back-from-slots')?.addEventListener('click', () => {
    app.showPage('students');
    app.loadStudents();
  });

  document.getElementById('save-slots-btn')?.addEventListener('click', () => {
    app.saveSelectedSlots();
  });

  // Camera
  document.getElementById('btn-open-camera')?.addEventListener('click', () => {
    app.openCamera();
  });

  document.getElementById('btn-close-camera')?.addEventListener('click', () => {
    app.closeCamera();
  });

  document.getElementById('btn-capture')?.addEventListener('click', () => {
    app.capturePhoto();
  });

  // File Upload
  document.getElementById('scan-file-input')?.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      await app.handleFileUpload(input.files[0]);
      input.value = '';
    }
  });

  // Print Page
  document.getElementById('btn-back-from-print')?.addEventListener('click', () => {
    app.showPage('project');
  });

  document.getElementById('btn-do-print')?.addEventListener('click', () => {
    window.print();
  });

  // DSGVO
  document.getElementById('btn-delete-all')?.addEventListener('click', () => {
    app.deleteAllData();
  });

  // Initial load
  app.loadProjects();
});
