/* ==========================================================================
   ResuMind AI - Application Logic, IndexedDB Browser Database & Backend Sync
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initBrowserIndexedDB();
  initNavigation();
  initAnalyzerTabs();
  initDropZone();
  initJdMatcher();
  initMockInterview();
  initResumeBuilder();
  initApiKeySettings();
  initAuth();
  updateAiStatusUI();
  checkPythonBackendStatus();
});

/* --------------------------------------------------------------------------
   1. ENTERPRISE INDEXEDDB BROWSER DATABASE ENGINE
   -------------------------------------------------------------------------- */
let dbInstance = null;
const API_BASE_URL = 'http://localhost:8000';
let isBackendOnline = false;

function initBrowserIndexedDB() {
  const request = indexedDB.open('ResuMindDB', 1);

  request.onupgradeneeded = (e) => {
    const db = e.target.result;

    if (!db.objectStoreNames.contains('users')) {
      const userStore = db.createObjectStore('users', { keyPath: 'email' });
      userStore.createIndex('id', 'id', { unique: false });
    }

    if (!db.objectStoreNames.contains('resumes')) {
      const resumeStore = db.createObjectStore('resumes', { keyPath: 'id', autoIncrement: true });
      resumeStore.createIndex('user_email', 'user_email', { unique: false });
    }

    if (!db.objectStoreNames.contains('jd_matches')) {
      const matchStore = db.createObjectStore('jd_matches', { keyPath: 'id', autoIncrement: true });
      matchStore.createIndex('user_email', 'user_email', { unique: false });
    }

    if (!db.objectStoreNames.contains('interviews')) {
      const interviewStore = db.createObjectStore('interviews', { keyPath: 'id', autoIncrement: true });
      interviewStore.createIndex('user_email', 'user_email', { unique: false });
    }
  };

  request.onsuccess = (e) => {
    dbInstance = e.target.result;
    console.log('📦 IndexedDB Browser Database Initialized Successfully (ResuMindDB)');
  };

  request.onerror = (e) => {
    console.warn('IndexedDB Error:', e.target.errorCode);
  };
}

async function checkPythonBackendStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/`, { method: 'GET' }).catch(() => null);
    if (res && res.ok) {
      isBackendOnline = true;
      const data = await res.json();
      console.log('🐍 Python SQLite Backend Connected:', data.database);
    } else {
      isBackendOnline = false;
    }
  } catch (e) {
    isBackendOnline = false;
  }
}

/* --------------------------------------------------------------------------
   USER AUTHENTICATION & DATABASE PERSISTENCE ENGINE
   -------------------------------------------------------------------------- */
let currentUser = null;

const DEFAULT_USERS = {
  'User@example.com': {
    id: 1,
    email: 'User@example.com',
    name: 'User name ',
    role: 'Senior Full Stack Engineer',
    initials: 'AP',
    audits: [
      { id: 101, name: 'User_Name_FullStack_2026.pdf', role: 'Senior Full Stack Engineer', score: 88, time: '2 hours ago' },
      { id: 102, name: 'Backend_Node_Developer_v2.docx', role: 'Node.js Backend Lead', score: 74, time: 'Yesterday' }
    ]
  },
  'sarah@example.com': {
    id: 2,
    email: 'sarah@example.com',
    name: 'Sarah Jenkins',
    role: 'Data Scientist / AI Specialist',
    initials: 'SJ',
    audits: [
      { id: 201, name: 'Sarah_Jenkins_DataScientist.pdf', role: 'Data Scientist / ML Engineer', score: 92, time: '1 day ago' }
    ]
  }
};

function initAuth() {
  if (!localStorage.getItem('RESUMIND_USERS')) {
    localStorage.setItem('RESUMIND_USERS', JSON.stringify(DEFAULT_USERS));
  }

  const savedUserEmail = localStorage.getItem('RESUMIND_CURRENT_USER');
  const usersDb = JSON.parse(localStorage.getItem('RESUMIND_USERS'));

  if (savedUserEmail && usersDb[savedUserEmail]) {
    currentUser = usersDb[savedUserEmail];
  } else {
    currentUser = usersDb['archit@example.com'];
  }

  updateUserUI();
}

function updateUserUI() {
  if (!currentUser) return;

  document.getElementById('sidebarUserName').innerText = currentUser.name;
  document.getElementById('sidebarUserRole').innerText = currentUser.role;
  document.getElementById('sidebarAvatar').innerText = currentUser.initials;

  const welcomeText = document.getElementById('welcomeUserNameText');
  if (welcomeText) welcomeText.innerText = currentUser.name.split(' ')[0];

  const pvName = document.getElementById('pvName');
  if (pvName) pvName.innerText = currentUser.name.toUpperCase();

  const pvTitle = document.getElementById('pvTitle');
  if (pvTitle) pvTitle.innerText = currentUser.role.toUpperCase();

  const authHeaderState = document.getElementById('authHeaderState');
  if (authHeaderState) {
    authHeaderState.innerHTML = `
      <div class="user-header-pill" title="Signed in as ${currentUser.email}">
        <div class="avatar-xs">${currentUser.initials}</div>
        <span class="user-name-sm">${currentUser.name}</span>
        <button class="btn-icon-xs ms-1" title="Sign Out" onclick="logoutUser()"><i class="fa-solid fa-right-from-bracket"></i></button>
      </div>
    `;
  }

  renderUserAudits();
}

function renderUserAudits() {
  const auditList = document.getElementById('dashboardAuditList');
  if (!auditList || !currentUser) return;

  if (!currentUser.audits || currentUser.audits.length === 0) {
    auditList.innerHTML = `
      <div class="text-center p-3 text-muted" style="font-size: 0.85rem;">
        <i class="fa-solid fa-folder-open mb-2" style="font-size: 1.5rem;"></i>
        <p>No saved resume audits yet. Run your first audit in the Resume Analyzer tab!</p>
      </div>
    `;
    return;
  }

  auditList.innerHTML = currentUser.audits.map(item => `
    <div class="audit-item">
      <div class="file-icon"><i class="fa-solid fa-file-pdf"></i></div>
      <div class="audit-info">
        <h4>${item.name}</h4>
        <span>Target: ${item.role} • ${item.time || 'Saved'}</span>
      </div>
      <div class="audit-score ${item.score >= 80 ? 'score-high' : 'score-mid'}">${item.score}</div>
    </div>
  `).join('');
}

function toggleAuthModal(show) {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.toggle('hidden', !show);
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const regForm = document.getElementById('registerForm');
  const tabLogin = document.getElementById('tabBtnLogin');
  const tabReg = document.getElementById('tabBtnRegister');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
    tabLogin.classList.add('active');
    tabReg.classList.remove('active');
  } else {
    loginForm.classList.add('hidden');
    regForm.classList.remove('hidden');
    tabReg.classList.add('active');
    tabLogin.classList.remove('active');
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;

  // Try Python Backend Login if server is active
  if (isBackendOnline) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const data = await res.json();
        currentUser = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.target_role,
          initials: data.user.name.split(' ').map(n => n[0]).join('').slice(0, 2),
          audits: []
        };
        localStorage.setItem('RESUMIND_CURRENT_USER', email);
        updateUserUI();
        toggleAuthModal(false);
        alert(`🎉 Logged into SQLite Database! Welcome, ${currentUser.name}.`);
        return;
      }
    } catch (e) {
      console.warn("Backend auth failed, using local database");
    }
  }

  // Local storage fallback
  const usersDb = JSON.parse(localStorage.getItem('RESUMIND_USERS') || '{}');
  if (usersDb[email]) {
    currentUser = usersDb[email];
    localStorage.setItem('RESUMIND_CURRENT_USER', email);
    updateUserUI();
    toggleAuthModal(false);
    alert(`🎉 Welcome back, ${currentUser.name}! Signed in successfully.`);
  } else {
    const namePart = email.split('@')[0];
    const newName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    quickLogin(email, newName, 'Software Developer');
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const password = document.getElementById('regPassword').value;
  const role = document.getElementById('regRole').value;

  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'US';

  // Sync with Python SQLite Database if available
  if (isBackendOnline) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Registered in SQLite DB:', data);
      }
    } catch (e) {
      console.warn('Backend reg error:', e);
    }
  }

  // Save to Local DB & IndexedDB
  const usersDb = JSON.parse(localStorage.getItem('RESUMIND_USERS') || '{}');
  usersDb[email] = { id: Date.now(), email, name, role, initials, audits: [] };
  localStorage.setItem('RESUMIND_USERS', JSON.stringify(usersDb));
  localStorage.setItem('RESUMIND_CURRENT_USER', email);
  currentUser = usersDb[email];

  // Save to IndexedDB
  if (dbInstance) {
    const tx = dbInstance.transaction('users', 'readwrite');
    tx.objectStore('users').put(currentUser);
  }

  updateUserUI();
  toggleAuthModal(false);
  alert(`✨ Account created & saved to database! Welcome, ${name}.`);
}

function quickLogin(email, name, role) {
  const usersDb = JSON.parse(localStorage.getItem('RESUMIND_USERS') || '{}');
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (!usersDb[email]) {
    usersDb[email] = { id: Date.now(), email, name, role, initials, audits: [] };
    localStorage.setItem('RESUMIND_USERS', JSON.stringify(usersDb));
  }

  currentUser = usersDb[email];
  localStorage.setItem('RESUMIND_CURRENT_USER', email);

  updateUserUI();
  toggleAuthModal(false);
  alert(`⚡ Quick signed in as ${name}!`);
}

function logoutUser() {
  localStorage.removeItem('RESUMIND_CURRENT_USER');
  currentUser = {
    id: 0,
    email: 'guest@example.com',
    name: 'Guest User',
    role: 'Job Seeker',
    initials: 'GU',
    audits: []
  };
  updateUserUI();
  alert('Signed out successfully.');
}

function saveUserAuditRecord(fileName, role, score) {
  if (!currentUser || currentUser.email === 'guest@example.com') return;

  const newRecord = {
    name: fileName,
    role: role,
    score: score,
    time: 'Just now'
  };

  const usersDb = JSON.parse(localStorage.getItem('RESUMIND_USERS') || '{}');
  if (usersDb[currentUser.email]) {
    if (!usersDb[currentUser.email].audits) usersDb[currentUser.email].audits = [];
    usersDb[currentUser.email].audits.unshift(newRecord);

    localStorage.setItem('RESUMIND_USERS', JSON.stringify(usersDb));
    currentUser = usersDb[currentUser.email];
    renderUserAudits();
  }

  // Save to Browser IndexedDB
  if (dbInstance) {
    const tx = dbInstance.transaction('resumes', 'readwrite');
    tx.objectStore('resumes').add({
      user_email: currentUser.email,
      filename: fileName,
      role: role,
      score: score,
      created_at: new Date().toISOString()
    });
  }

  // Sync to Python SQLite DB if server is active
  if (isBackendOnline && currentUser.id) {
    fetch(`${API_BASE_URL}/api/resumes/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.id,
        filename: fileName,
        raw_text: "Sample text",
        ats_score: score,
        target_role: role
      })
    }).catch(e => console.warn('SQLite Sync error:', e));
  }
}

/* --------------------------------------------------------------------------
   REAL LLM API CALLER ENGINE (Gemini / OpenAI / Groq)
   -------------------------------------------------------------------------- */
async function callRealAI(prompt, systemInstruction = "You are a professional AI career coach & executive recruiter.") {
  const apiKey = localStorage.getItem('RESUMIND_API_KEY');
  const provider = localStorage.getItem('RESUMIND_AI_PROVIDER') || 'gemini';
  const model = localStorage.getItem('RESUMIND_AI_MODEL') || 'gemini-2.0-flash';

  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemInstruction}\n\n${prompt}` }]
        }
      ]
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Gemini API Error: ${res.status}`);
    }

    const data = await res.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!replyText) throw new Error("Empty response from Gemini API");
    return replyText;
  }

  const endpoint = provider === 'groq'
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';

  const payload = {
    model: model,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `API Error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content;
}

/* --------------------------------------------------------------------------
   API KEY SETTINGS MODAL & STATE
   -------------------------------------------------------------------------- */
function initApiKeySettings() {
  const modal = document.getElementById('apiKeyModal');
  const openBtn = document.getElementById('openApiKeyModalBtn');
  const providerSelect = document.getElementById('aiProviderSelect');
  const modelSelect = document.getElementById('aiModelSelect');

  if (openBtn) {
    openBtn.addEventListener('click', () => toggleApiKeyModal(true));
  }

  if (providerSelect) {
    providerSelect.addEventListener('change', () => {
      const val = providerSelect.value;
      if (val === 'gemini') {
        modelSelect.innerHTML = `
          <option value="gemini-2.0-flash">gemini-2.0-flash (Fast & Accurate)</option>
          <option value="gemini-1.5-flash">gemini-1.5-flash</option>
        `;
      } else if (val === 'openai') {
        modelSelect.innerHTML = `
          <option value="gpt-4o-mini">gpt-4o-mini</option>
          <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
        `;
      } else if (val === 'groq') {
        modelSelect.innerHTML = `
          <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
          <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
        `;
      }
    });
  }

  const savedKey = localStorage.getItem('RESUMIND_API_KEY');
  const savedProvider = localStorage.getItem('RESUMIND_AI_PROVIDER');
  const savedModel = localStorage.getItem('RESUMIND_AI_MODEL');

  if (savedKey) document.getElementById('userApiKeyInput').value = savedKey;
  if (savedProvider) document.getElementById('aiProviderSelect').value = savedProvider;
  if (savedModel && modelSelect) {
    modelSelect.value = savedModel;
  }
}

function toggleApiKeyModal(show) {
  const modal = document.getElementById('apiKeyModal');
  if (modal) modal.classList.toggle('hidden', !show);
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('userApiKeyInput');
  const eyeIcon = document.getElementById('eyeIcon');
  if (input.type === 'password') {
    input.type = 'text';
    eyeIcon.className = 'fa-solid fa-eye-slash';
  } else {
    input.type = 'password';
    eyeIcon.className = 'fa-solid fa-eye';
  }
}

function saveApiKey() {
  const key = document.getElementById('userApiKeyInput').value.trim();
  const provider = document.getElementById('aiProviderSelect').value;
  const model = document.getElementById('aiModelSelect').value;

  if (!key) {
    alert('Please enter your API Key.');
    return;
  }

  localStorage.setItem('RESUMIND_API_KEY', key);
  localStorage.setItem('RESUMIND_AI_PROVIDER', provider);
  localStorage.setItem('RESUMIND_AI_MODEL', model);

  updateAiStatusUI();
  toggleApiKeyModal(false);
  alert(`✨ Real AI Connected Successfully! (${provider.toUpperCase()} - ${model})`);
}

function clearApiKey() {
  localStorage.removeItem('RESUMIND_API_KEY');
  localStorage.removeItem('RESUMIND_AI_PROVIDER');
  localStorage.removeItem('RESUMIND_AI_MODEL');
  document.getElementById('userApiKeyInput').value = '';
  updateAiStatusUI();
  toggleApiKeyModal(false);
  alert('API Key removed. System returned to Demo Mode.');
}

function updateAiStatusUI() {
  const key = localStorage.getItem('RESUMIND_API_KEY');
  const provider = localStorage.getItem('RESUMIND_AI_PROVIDER') || 'Demo';
  const model = localStorage.getItem('RESUMIND_AI_MODEL') || 'Sandbox';

  const dot = document.getElementById('aiStatusDot');
  const text = document.getElementById('aiStatusText');
  const sidebarModelText = document.getElementById('sidebarAiModelText');
  const sidebarProviderText = document.getElementById('sidebarAiProviderText');
  const keyStatusSpan = document.getElementById('keyStatusSpan');

  if (key) {
    dot.className = 'dot online';
    text.innerText = 'Real AI Online';
    sidebarModelText.innerText = `AI: ${model}`;
    sidebarProviderText.innerText = `Powered by ${provider.toUpperCase()}`;
    if (keyStatusSpan) {
      keyStatusSpan.className = 'text-green';
      keyStatusSpan.innerText = `Connected (${model})`;
    }
  } else {
    dot.className = 'dot';
    text.innerText = 'Sandbox Mode';
    sidebarModelText.innerText = 'AI Engine: Sandbox';
    sidebarProviderText.innerText = "Click 'AI Settings' to connect key";
    if (keyStatusSpan) {
      keyStatusSpan.className = 'text-amber';
      keyStatusSpan.innerText = 'Not Configured';
    }
  }
}

/* --------------------------------------------------------------------------
   NAVIGATION & TAB SWITCHING
   -------------------------------------------------------------------------- */
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabTarget = item.getAttribute('data-tab');
      switchTab(tabTarget);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(nav => {
    nav.classList.toggle('active', nav.getAttribute('data-tab') === tabId);
  });

  document.querySelectorAll('.tab-page').forEach(page => {
    page.classList.toggle('active', page.id === `tab-${tabId}`);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* --------------------------------------------------------------------------
   RESUME ANALYZER & ATS SCORE ENGINE WITH REAL AI
   -------------------------------------------------------------------------- */
function initAnalyzerTabs() {
  const reportTabBtns = document.querySelectorAll('.report-tab-btn');
  reportTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      reportTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetSubtab = btn.getAttribute('data-report');
      document.querySelectorAll('.subtab-content').forEach(sub => {
        sub.classList.toggle('active', sub.id === `subtab-${targetSubtab}`);
      });
    });
  });

  const analyzeBtn = document.getElementById('analyzeResumeBtn');
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', runResumeAnalysis);
  }
}

function initDropZone() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('resumeFileInput');

  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--primary-accent)';
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = 'rgba(99, 102, 241, 0.4)';
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'rgba(99, 102, 241, 0.4)';
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      readFileContent(file);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      readFileContent(e.target.files[0]);
    }
  });
}

function readFileContent(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('rawResumeTextArea').value = e.target.result;
    runResumeAnalysis(file.name);
  };
  reader.readAsText(file);
}

function loadSampleResume(profileType) {
  if (profileType === 'software_eng') {
    document.getElementById('rawResumeTextArea').value = `ARCHIT PRAJAPATI - SENIOR FULL STACK ENGINEER
Email: archit@example.com | Phone: +91 98765 43210 | GitHub: github.com/archit

SUMMARY:
Results-driven Full Stack Engineer with 4+ years experience building web apps with React.js, Node.js, Express, PostgreSQL, and Redis.

TECHNICAL SKILLS:
Languages: JavaScript, TypeScript, Python, HTML5, CSS3
Frameworks: React.js, Redux, Node.js, Express.js
Databases: PostgreSQL, MongoDB, Redis
Tools: Git, Docker, REST APIs

EXPERIENCE:
Senior Full Stack Developer - TechNova (2024-Present)
- Developed backend REST APIs using Node.js and Express.
- Created reusable UI components in React.js and TypeScript.
- Worked on PostgreSQL database queries and optimized performance.`;
    runResumeAnalysis('Archit_FullStack_2026.pdf');
  } else {
    document.getElementById('rawResumeTextArea').value = `DATA SCIENTIST & AI ENGINEER
Summary: AI Specialist with expertise in Python, PyTorch, Scikit-Learn, LLM fine-tuning, Pinecone vector search, and FastAPI deployments.

Experience:
- Fine-tuned open-source Llama 3 models for domain-specific NLP tasks achieving 94% accuracy.
- Engineered RAG pipelines using LangChain and Pinecone vector database.`;
    runResumeAnalysis('Candidate_DataScientist.pdf');
  }
}

async function runResumeAnalysis(fileName = 'Custom_Resume.pdf') {
  const text = document.getElementById('rawResumeTextArea').value.trim();
  if (!text) {
    alert('Please paste or upload your resume text first.');
    return;
  }

  const resultsCard = document.getElementById('analysisResults');
  resultsCard.scrollIntoView({ behavior: 'smooth' });

  const isRealAi = !!localStorage.getItem('RESUMIND_API_KEY');

  if (!isRealAi) {
    simulateResumeAnalysis(fileName, 88);
    saveUserAuditRecord(fileName, currentUser ? currentUser.role : 'Software Engineer', 88);
    return;
  }

  const analyzeBtn = document.getElementById('analyzeResumeBtn');
  analyzeBtn.innerText = '⚡ Real AI Parsing Resume...';
  analyzeBtn.disabled = true;

  try {
    const prompt = `
Analyze this resume text and provide output in strict JSON format:
Resume Text:
"""
${text}
"""

Return JSON ONLY matching this structure:
{
  "target_role": "String summary of role",
  "ats_score": 88,
  "headline": "Short evaluation headline",
  "subhead": "Detailed evaluation summary",
  "detected_skills": ["Skill 1", "Skill 2", "Skill 3"],
  "missing_keywords": ["Missing 1", "Missing 2"],
  "check_items": [
    {"type": "pass", "title": "Check Title", "desc": "Check Description"},
    {"type": "warn", "title": "Check Title", "desc": "Check Description"}
  ],
  "bullet_enhancements": [
    {"original": "Original bullet", "improved": "Rewritten bullet using STAR method"}
  ]
}
`;

    const rawReply = await callRealAI(prompt, "You are a JSON-only response engine. Return valid JSON without markdown formatting.");
    let cleanJsonStr = rawReply.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanJsonStr);

    const score = data.ats_score || 88;
    document.getElementById('resumeRoleTag').innerText = `Target: ${data.target_role || 'Candidate'}`;
    document.getElementById('scoreValue').innerText = score;

    const dashoffset = 264 - (264 * score / 100);
    document.getElementById('scoreCircleProgress').style.strokeDashoffset = dashoffset;

    document.getElementById('scoreHeadline').innerText = data.headline || 'AI Audit Completed!';
    document.getElementById('scoreSubhead').innerText = data.subhead || '';

    const detectedContainer = document.getElementById('detectedSkills');
    detectedContainer.innerHTML = (data.detected_skills || []).map(s => `<span class="pill pill-green">${s}</span>`).join('');

    const missingContainer = document.getElementById('missingSkills');
    missingContainer.innerHTML = (data.missing_keywords || []).map(s => `<span class="pill pill-red">+ ${s}</span>`).join('');

    const atsList = document.getElementById('atsCheckList');
    atsList.innerHTML = (data.check_items || []).map(item => `
      <div class="check-item status-${item.type}">
        <i class="fa-solid fa-${item.type === 'pass' ? 'circle-check' : item.type === 'warn' ? 'circle-exclamation' : 'circle-xmark'}"></i>
        <div class="check-details">
          <strong>${item.title}</strong>
          <p>${item.desc}</p>
        </div>
      </div>
    `).join('');

    const bulletContainer = document.getElementById('bulletEnhanceContainer');
    bulletContainer.innerHTML = (data.bullet_enhancements || []).map(b => `
      <div class="bullet-rewrite-card mb-3">
        <div class="original-bullet">
          <span class="label">Original Bullet Point:</span>
          <p>"${b.original}"</p>
        </div>
        <div class="ai-suggestion-box">
          <span class="label-ai"><i class="fa-solid fa-wand-magic-sparkles"></i> AI Re-engineered (STAR Method):</span>
          <p class="highlight-text">"${b.improved}"</p>
          <button class="btn btn-secondary btn-xs" onclick="copyText(this)">Copy Rewritten Bullet</button>
        </div>
      </div>
    `).join('');

    saveUserAuditRecord(fileName, data.target_role || 'Software Engineer', score);

  } catch (err) {
    alert(`Real AI Analysis Error: ${err.message}. Falling back to Sandbox Mode.`);
    simulateResumeAnalysis(fileName, 88);
    saveUserAuditRecord(fileName, 'Software Engineer', 88);
  } finally {
    analyzeBtn.innerText = 'Analyze Resume with AI';
    analyzeBtn.disabled = false;
  }
}

function simulateResumeAnalysis(fileName, score) {
  document.getElementById('resumeRoleTag').innerText = `Target: Senior Software Engineer`;
  document.getElementById('scoreValue').innerText = score;
  document.getElementById('scoreCircleProgress').style.strokeDashoffset = '32';
  document.getElementById('scoreHeadline').innerText = 'Top 8% Candidate Resume!';
  document.getElementById('scoreSubhead').innerText = 'Outstanding ATS formatting, contact links, and tech keyword density.';
}

/* --------------------------------------------------------------------------
   JOB DESCRIPTION MATCHER ENGINE WITH REAL AI
   -------------------------------------------------------------------------- */
function initJdMatcher() {
  const matchBtn = document.getElementById('runJdMatchBtn');
  if (!matchBtn) return;

  matchBtn.addEventListener('click', async () => {
    const jdText = document.getElementById('jdTextArea').value.trim();
    const resumeText = document.getElementById('jdResumeTextArea').value.trim() || document.getElementById('rawResumeTextArea').value.trim();

    if (!jdText) {
      alert('Please paste a job description first.');
      return;
    }

    const isRealAi = !!localStorage.getItem('RESUMIND_API_KEY');

    if (isRealAi) {
      matchBtn.innerText = '⚡ Real AI Calculating Gap Analysis...';
      matchBtn.disabled = true;

      try {
        const prompt = `
Compare this Resume against the Job Description and return a JSON match report:

Resume:
"""${resumeText}"""

Job Description:
"""${jdText}"""

Return JSON format ONLY:
{
  "match_percentage": 82,
  "match_title": "Strong Candidate Fit",
  "match_desc": "Summary explanation of overlap",
  "pro_tip": "Specific recommendation",
  "matrix": [
    {"skill": "React.js", "status": "Found", "rec": "Keep in top section"},
    {"skill": "Kubernetes", "status": "Missing", "rec": "Add experience with containers"}
  ]
}
`;
        const reply = await callRealAI(prompt, "You are an AI recruiting manager. Return clean valid JSON only.");
        const cleanJsonStr = reply.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(cleanJsonStr);

        document.getElementById('matchPercentVal').innerText = `${data.match_percentage}%`;
        document.getElementById('matchTitle').innerText = data.match_title;
        document.getElementById('matchDesc').innerText = data.match_desc;
        document.getElementById('jdMatchProTip').innerHTML = `<strong>Pro-Tip:</strong> ${data.pro_tip}`;

        const matrixBody = document.getElementById('matrixBody');
        matrixBody.innerHTML = (data.matrix || []).map(m => `
          <tr>
            <td><strong>${m.skill}</strong></td>
            <td><span class="tag ${m.status === 'Found' ? 'tag-pass' : 'tag-fail'}">${m.status}</span></td>
            <td>${m.rec}</td>
          </tr>
        `).join('');

        document.getElementById('jdMatchOutput').scrollIntoView({ behavior: 'smooth' });
        return;
      } catch (err) {
        console.warn('Real AI Matcher fallback:', err);
      } finally {
        matchBtn.innerText = 'Run Real AI Matcher & Skill Gap Analysis';
        matchBtn.disabled = false;
      }
    }

    document.getElementById('matchPercentVal').innerText = '78%';
    document.getElementById('matchTitle').innerText = 'Moderate-High Alignment';
    document.getElementById('jdMatchOutput').scrollIntoView({ behavior: 'smooth' });
  });
}

/* --------------------------------------------------------------------------
   AI MOCK INTERVIEW SIMULATOR WITH REAL AI
   -------------------------------------------------------------------------- */
let currentQuestionIndex = 0;
let activeRole = 'Full Stack Developer';

function initMockInterview() {
  const startBtn = document.getElementById('startInterviewBtn');
  const submitAnswerBtn = document.getElementById('submitAnswerBtn');
  const nextQBtn = document.getElementById('nextQuestionBtn');
  const genNewQBtn = document.getElementById('genNewAiQuestionBtn');

  if (!startBtn) return;

  startBtn.addEventListener('click', async () => {
    activeRole = document.getElementById('interviewRoleSelect').value;
    const round = document.getElementById('interviewRoundSelect').value;

    document.getElementById('interviewSetupCard').classList.add('hidden');
    document.getElementById('interviewStage').classList.remove('hidden');
    document.getElementById('activeRoleBadge').innerText = `${activeRole} • ${round}`;

    currentQuestionIndex = 0;
    await generateAiQuestion();
  });

  if (genNewQBtn) {
    genNewQBtn.addEventListener('click', generateAiQuestion);
  }

  submitAnswerBtn.addEventListener('click', async () => {
    const answerText = document.getElementById('candidateAnswerText').value.trim();
    if (!answerText) {
      alert('Please type or speak your answer before submitting.');
      return;
    }
    await evaluateCandidateAnswerWithAI(answerText);
  });

  nextQBtn.addEventListener('click', async () => {
    currentQuestionIndex++;
    if (currentQuestionIndex < 3) {
      document.getElementById('evaluationPanel').classList.add('hidden');
      document.getElementById('candidateAnswerText').value = '';
      await generateAiQuestion();
    } else {
      alert('🎉 Mock Interview Round Completed! Reviewing your overall readiness score...');
      switchTab('dashboard');
    }
  });
}

async function generateAiQuestion() {
  const qText = document.getElementById('currentQuestionText');
  const qNum = document.getElementById('qNumberLabel');
  qNum.innerText = `Question ${currentQuestionIndex + 1} of 3`;

  const isRealAi = !!localStorage.getItem('RESUMIND_API_KEY');

  if (isRealAi) {
    qText.innerText = '"Generating tailored question with Real AI..."';
    try {
      const prompt = `Generate 1 tough, realistic technical or STAR behavioral interview question for a ${activeRole} position. Return ONLY the question string inside quotes.`;
      const reply = await callRealAI(prompt, "You are a Senior Tech Lead conducting a job interview.");
      qText.innerText = reply.trim();
      return;
    } catch (e) {
      console.warn("AI Question fallback:", e);
    }
  }

  const demoQs = [
    "Can you walk me through a complex architectural challenge you faced when building a microservice backend, and how you handled concurrency?",
    "How do you manage state and prevent unnecessary re-renders in a large-scale React application?",
    "Tell me about a time you had a technical disagreement with a peer and how you resolved it."
  ];
  qText.innerText = `"${demoQs[currentQuestionIndex % demoQs.length]}"`;
}

function loadSampleAnswer() {
  document.getElementById('candidateAnswerText').value = `In my previous role as Senior Full Stack Engineer (Situation), we faced high database latency during peak traffic (Task). I implemented a Redis caching layer for read queries and configured connection pooling (Action). This reduced API response time by 60% for 100k daily users (Result).`;
}

async function evaluateCandidateAnswerWithAI(answer) {
  const evalPanel = document.getElementById('evaluationPanel');
  const question = document.getElementById('currentQuestionText').innerText;

  evalPanel.classList.remove('hidden');
  evalPanel.scrollIntoView({ behavior: 'smooth' });

  const isRealAi = !!localStorage.getItem('RESUMIND_API_KEY');

  if (isRealAi) {
    document.getElementById('evalScoreBadge').innerText = 'AI Scoring...';
    try {
      const prompt = `
Question: "${question}"
Candidate Answer: "${answer}"

Evaluate this answer and return JSON format ONLY:
{
  "score": "8.8/10",
  "strengths": ["Strength 1", "Strength 2"],
  "missed": ["Point 1", "Point 2"],
  "model_answer": "Model STAR response..."
}
`;
      const reply = await callRealAI(prompt, "You are an Executive AI Tech Recruiter giving STAR feedback.");
      const cleanJsonStr = reply.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(cleanJsonStr);

      document.getElementById('evalScoreBadge').innerText = `Score: ${data.score}`;
      document.getElementById('evalStrengths').innerHTML = (data.strengths || []).map(s => `<li>${s}</li>`).join('');
      document.getElementById('evalMissed').innerHTML = (data.missed || []).map(m => `<li>${m}</li>`).join('');
      document.getElementById('improvedAnswerText').innerText = `"${data.model_answer}"`;
      return;
    } catch (e) {
      console.warn("Real AI eval error:", e);
    }
  }

  document.getElementById('evalScoreBadge').innerText = 'Score: 8.5/10';
  document.getElementById('evalStrengths').innerHTML = '<li>Used STAR method clearly with situation, action, and result.</li>';
  document.getElementById('evalMissed').innerHTML = '<li>Could mention specific monitoring/alerting tools used.</li>';
}

/* --------------------------------------------------------------------------
   AI RESUME BUILDER ENGINE WITH REAL AI
   -------------------------------------------------------------------------- */
function initResumeBuilder() {
  const roleInput = document.getElementById('bRoleInput');
  const summaryInput = document.getElementById('bSummaryInput');
  const skillsInput = document.getElementById('bSkillsInput');

  if (!roleInput) return;

  roleInput.addEventListener('input', () => {
    document.getElementById('pvTitle').innerText = roleInput.value.toUpperCase();
  });

  summaryInput.addEventListener('input', () => {
    document.getElementById('pvSummary').innerText = summaryInput.value;
  });

  skillsInput.addEventListener('input', () => {
    document.getElementById('pvSkills').innerHTML = `<strong>Technical Stack:</strong> ${skillsInput.value}`;
  });
}

async function enhanceSummaryWithAI() {
  const summaryInput = document.getElementById('bSummaryInput');
  const role = document.getElementById('bRoleInput').value;
  const btn = document.getElementById('btnAiEnhanceSummary');

  const isRealAi = !!localStorage.getItem('RESUMIND_API_KEY');

  if (isRealAi) {
    btn.innerText = '⚡ AI Generating...';
    try {
      const prompt = `Write a punchy, executive 3-sentence professional resume summary for a candidate targeting a "${role}" position. Current draft: "${summaryInput.value}"`;
      const reply = await callRealAI(prompt, "You are a professional executive resume writer.");
      summaryInput.value = reply.trim();
      document.getElementById('pvSummary').innerText = reply.trim();
      alert('✨ Real AI successfully enhanced your professional summary!');
      return;
    } catch (e) {
      alert(`AI Error: ${e.message}`);
    } finally {
      btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Real AI Enhance';
    }
  }

  summaryInput.value = `High-impact ${role} with proven expertise engineering resilient distributed systems, driving frontend performance optimizations, and scaling cloud-native microservices.`;
  document.getElementById('pvSummary').innerText = summaryInput.value;
  alert('✨ Enhanced summary with AI keywords!');
}

function copyText(btnElement) {
  const textToCopy = btnElement.parentElement.querySelector('.highlight-text').innerText;
  navigator.clipboard.writeText(textToCopy);
  const originalText = btnElement.innerText;
  btnElement.innerText = 'Copied!';
  setTimeout(() => {
    btnElement.innerText = originalText;
  }, 2000);
}
