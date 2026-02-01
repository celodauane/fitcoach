// State
let currentStep = 1;
const totalSteps = 4;

// Elements
const sections = {
  landing: document.getElementById('landing'),
  form: document.getElementById('form-section'),
  loading: document.getElementById('loading-section'),
  results: document.getElementById('results-section'),
};

// Navigation
function showSection(name) {
  Object.values(sections).forEach(s => s.classList.remove('active'));
  sections[name].classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function startForm() {
  showSection('form');
  updateFormUI();
}

function startOver() {
  currentStep = 1;
  document.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = false;
    } else if (el.id !== 'weeks' && el.id !== 'daysPerWeek' && el.id !== 'minutesPerSession' && el.id !== 'gymAccess') {
      el.value = '';
    }
  });
  showSection('landing');
}

// Form Steps
function updateFormUI() {
  // Update step visibility
  document.querySelectorAll('.form-step').forEach((step, i) => {
    step.classList.toggle('active', i + 1 === currentStep);
  });
  
  // Update progress
  document.getElementById('progress').style.width = `${(currentStep / totalSteps) * 100}%`;
  document.getElementById('step-label').textContent = `Step ${currentStep} of ${totalSteps}`;
  
  // Update buttons
  document.getElementById('backBtn').style.visibility = currentStep === 1 ? 'hidden' : 'visible';
  document.getElementById('nextBtn').textContent = currentStep === totalSteps ? 'Generate Program' : 'Continue';
  
  // Clear error
  document.getElementById('formError').textContent = '';
}

function nextStep() {
  const error = validateStep(currentStep);
  if (error) {
    document.getElementById('formError').textContent = error;
    return;
  }
  
  if (currentStep < totalSteps) {
    currentStep++;
    updateFormUI();
  } else {
    submitForm();
  }
}

function prevStep() {
  if (currentStep > 1) {
    currentStep--;
    updateFormUI();
  }
}

// Validation
function validateStep(step) {
  if (step === 1) {
    const age = parseInt(document.getElementById('age').value);
    const sex = document.getElementById('sex').value;
    const height = parseInt(document.getElementById('height').value);
    const weight = parseFloat(document.getElementById('weight').value);
    const targetWeight = parseFloat(document.getElementById('targetWeight').value);
    const weeks = parseInt(document.getElementById('weeks').value);
    
    if (!age || age < 16 || age > 80) return 'Please enter a valid age (16-80)';
    if (!sex) return 'Please select your sex';
    if (!height || height < 140 || height > 220) return 'Please enter a valid height';
    if (!weight || weight < 40) return 'Please enter your current weight';
    if (!targetWeight || targetWeight < 40) return 'Please enter your target weight';
    if (targetWeight >= weight) return 'Target weight should be less than current weight';
    if (!weeks || weeks < 4 || weeks > 24) return 'Please enter a timeframe between 4-24 weeks';
  }
  
  if (step === 2) {
    const trainingLevel = document.querySelector('input[name="trainingLevel"]:checked');
    const activityLevel = document.getElementById('activityLevel').value;
    const cardioExperience = document.getElementById('cardioExperience').value;
    
    if (!trainingLevel) return 'Please select your training level';
    if (!activityLevel) return 'Please select your activity level';
    if (!cardioExperience) return 'Please select your cardio experience';
  }
  
  if (step === 3) {
    const cardio = document.querySelectorAll('input[name="cardio"]:checked');
    const daysPerWeek = parseInt(document.getElementById('daysPerWeek').value);
    const minutesPerSession = parseInt(document.getElementById('minutesPerSession').value);
    
    if (cardio.length === 0) return 'Please select at least one cardio option';
    if (!daysPerWeek || daysPerWeek < 2 || daysPerWeek > 7) return 'Please enter days per week (2-7)';
    if (!minutesPerSession || minutesPerSession < 15) return 'Please enter session duration (min 15 minutes)';
  }
  
  return null;
}

// Submit
async function submitForm() {
  showSection('loading');
  
  const inputs = {
    age: parseInt(document.getElementById('age').value),
    sex: document.getElementById('sex').value,
    height: parseInt(document.getElementById('height').value),
    weight: parseFloat(document.getElementById('weight').value),
    targetWeight: parseFloat(document.getElementById('targetWeight').value),
    weeks: parseInt(document.getElementById('weeks').value),
    trainingLevel: document.querySelector('input[name="trainingLevel"]:checked').value,
    activityLevel: document.getElementById('activityLevel').value,
    cardioExperience: document.getElementById('cardioExperience').value,
    cardioModalities: Array.from(document.querySelectorAll('input[name="cardio"]:checked')).map(el => el.value),
    gymAccess: document.getElementById('gymAccess').value === 'yes',
    daysPerWeek: parseInt(document.getElementById('daysPerWeek').value),
    minutesPerSession: parseInt(document.getElementById('minutesPerSession').value),
    injuries: document.getElementById('injuries').value.trim(),
    medical: document.getElementById('medical').value.trim(),
    dietary: document.getElementById('dietary').value.trim(),
  };
  
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate program');
    }
    
    displayResults(data.calculations, data.program);
    
  } catch (error) {
    alert('Error: ' + error.message);
    showSection('form');
  }
}

// Display Results
function displayResults(calcs, program) {
  // Stats
  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${calcs.dailyCalories}</div>
      <div class="stat-label">Daily Calories</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${calcs.protein}g</div>
      <div class="stat-label">Protein</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${calcs.deficit}</div>
      <div class="stat-label">Deficit (kcal)</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${calcs.weeklyLoss.toFixed(1)}kg</div>
      <div class="stat-label">Weekly Loss</div>
    </div>
  `;
  
  // Warning
  const warningBox = document.getElementById('warningBox');
  if (calcs.warning) {
    warningBox.textContent = calcs.warning;
    warningBox.classList.add('visible');
  } else {
    warningBox.classList.remove('visible');
  }
  
  // Program
  document.getElementById('programContent').innerHTML = parseMarkdown(program);
  
  showSection('results');
}

// HTML escape for XSS prevention
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Simple Markdown Parser (with XSS protection)
function parseMarkdown(text) {
  // First escape HTML to prevent XSS
  const escaped = escapeHtml(text);
  
  return escaped
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\* (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hup])/gm, '<p>')
    .replace(/(?<![>])$/gm, '</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<[hul])/g, '$1')
    .replace(/(<\/[hul][^>]*>)<\/p>/g, '$1');
}

// Copy
function copyProgram() {
  const content = document.getElementById('programContent').innerText;
  const stats = document.getElementById('statsGrid').innerText;
  navigator.clipboard.writeText(`FitCoach Program\n\n${stats}\n\n${content}`).then(() => {
    const btn = document.querySelector('.results-actions .btn-secondary');
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = original, 2000);
  });
}

// Keyboard nav
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && sections.form.classList.contains('active')) {
    const active = document.activeElement;
    if (active.tagName !== 'TEXTAREA') {
      e.preventDefault();
      nextStep();
    }
  }
});
