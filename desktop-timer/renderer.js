// =============================================
// StudioFlow Desktop Timer v2.0.0 — Renderer
// Email/Password login with JWT Bearer token
// =============================================

// NOTE: "electronAPI" is a global from contextBridge.exposeInMainWorld
// so we use "eAPI" alias to avoid redeclaration errors.
const eAPI = window.electronAPI

// =============================================
// State
// =============================================
let authToken = null
let apiUrl = 'https://app.meisnerinteriors.com'
let currentUser = null
let projects = []
let activeTimer = null
let timerInterval = null
let isPaused = false

// =============================================
// DOM Elements
// =============================================
const $ = (id) => document.getElementById(id)

const screenLogin = $('screen-login')
const screenMain = $('screen-main')
const loading = $('loading')

const inputEmail = $('input-email')
const inputPassword = $('input-password')
const btnLogin = $('btn-login')
const loginError = $('login-error')

const btnMinimize = $('btn-minimize')
const btnClose = $('btn-close')

const userBar = $('user-bar')
const userName = $('user-name')
const userEmail = $('user-email')
const userAvatar = $('user-avatar')

const timerPanel = $('timer-panel')
const noTimer = $('no-timer')
const timerDisplay = $('timer-display')
const timerProject = $('timer-project')
const timerLabel = $('timer-label')
const btnPause = $('btn-pause')
const btnStop = $('btn-stop')

const projectList = $('project-list')
const btnRefresh = $('btn-refresh')
const btnLogout = $('btn-logout')

// =============================================
// Window Controls
// =============================================
btnMinimize.addEventListener('click', () => eAPI.minimize())
btnClose.addEventListener('click', () => eAPI.close())

// =============================================
// Helpers
// =============================================

function showLoading(text) {
  loading.querySelector('.loading-text').textContent = text || 'Loading...'
  loading.classList.remove('hidden')
}

function hideLoading() {
  loading.classList.add('hidden')
}

function showScreen(name) {
  screenLogin.classList.toggle('hidden', name !== 'login')
  screenMain.classList.toggle('hidden', name !== 'main')
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}

async function api(method, path, body) {
  return eAPI.apiRequest({ method, path, body, token: authToken, apiUrl })
}

// =============================================
// Login
// =============================================

async function init() {
  authToken = await eAPI.store.get('authToken')
  apiUrl = await eAPI.store.get('apiUrl') || 'https://app.meisnerinteriors.com'

  if (authToken) {
    showLoading('Signing in...')
    const user = await verifyToken()
    if (user) {
      currentUser = user
      await enterMainScreen()
    } else {
      authToken = null
      await eAPI.store.delete('authToken')
      hideLoading()
      showScreen('login')
    }
  } else {
    showScreen('login')
  }
}

async function verifyToken() {
  try {
    const res = await eAPI.apiRequest({
      method: 'GET',
      path: '/api/auth/me',
      token: authToken,
      apiUrl,
    })
    if (res.ok && res.data && res.data.user) {
      return res.data.user
    }
    return null
  } catch {
    return null
  }
}

async function loginWithCredentials(email, password) {
  try {
    const res = await eAPI.apiRequest({
      method: 'POST',
      path: '/api/auth/mobile-login',
      body: { email, password },
      apiUrl,
    })

    if (res.ok && res.data && res.data.token) {
      return { token: res.data.token, user: res.data.user }
    }

    return { error: res.data?.error || 'Login failed' }
  } catch (err) {
    return { error: 'Connection failed. Check your internet.' }
  }
}

btnLogin.addEventListener('click', async () => {
  const email = inputEmail.value.trim().toLowerCase()
  const password = inputPassword.value

  if (!email || !password) {
    loginError.textContent = 'Enter your email and password'
    return
  }

  loginError.textContent = ''
  btnLogin.disabled = true
  btnLogin.textContent = 'Signing in...'

  const result = await loginWithCredentials(email, password)

  if (result.token) {
    authToken = result.token
    currentUser = result.user
    await eAPI.store.set('authToken', authToken)
    await eAPI.store.set('apiUrl', apiUrl)
    showLoading('Loading projects...')
    await enterMainScreen()
  } else {
    loginError.textContent = result.error || 'Invalid email or password'
  }

  btnLogin.disabled = false
  btnLogin.textContent = 'Sign In'
})

inputPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnLogin.click()
})

inputEmail.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') inputPassword.focus()
})

// =============================================
// Main Screen
// =============================================

async function enterMainScreen() {
  showScreen('main')
  showUserBar()
  await Promise.all([loadProjects(), checkActiveTimer()])
  hideLoading()
}

function showUserBar() {
  if (currentUser) {
    userName.textContent = currentUser.name || 'Team Member'
    userEmail.textContent = currentUser.email || ''
    const initials = (currentUser.name || '?').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    userAvatar.textContent = initials
    userBar.classList.remove('hidden')
  }
}

async function loadProjects() {
  try {
    const res = await api('GET', '/api/extension/projects')
    if (res.ok && res.data && res.data.projects) {
      projects = res.data.projects
    }
  } catch (err) {
    // Silently fail — project list will show empty
  }
  renderProjectList()
}

async function checkActiveTimer() {
  try {
    const [runRes, pausedRes] = await Promise.all([
      api('GET', '/api/timeline/entries?status=RUNNING&perPage=1'),
      api('GET', '/api/timeline/entries?status=PAUSED&perPage=1'),
    ])

    let entry = null
    if (runRes.ok && runRes.data.entries && runRes.data.entries.length > 0) {
      entry = runRes.data.entries[0]
    } else if (pausedRes.ok && pausedRes.data.entries && pausedRes.data.entries.length > 0) {
      entry = pausedRes.data.entries[0]
    }

    if (entry) {
      const proj = projects.find(p => p.id === entry.projectId)
      const completedPauseMs = (entry.pauses || []).reduce((acc, p) => {
        if (p.resumedAt) {
          return acc + (new Date(p.resumedAt).getTime() - new Date(p.pausedAt).getTime())
        }
        return acc
      }, 0)

      activeTimer = {
        id: entry.id,
        projectId: entry.projectId,
        projectName: proj ? `${proj.name} (${proj.clientName})` : entry.project?.name || 'Unknown',
        startedAt: new Date(entry.startTime),
        status: entry.status,
        completedPauseMs,
        currentPauseStart: null,
      }

      const activePause = (entry.pauses || []).find(p => !p.resumedAt)
      if (activePause) {
        activeTimer.currentPauseStart = new Date(activePause.pausedAt)
      }

      isPaused = entry.status === 'PAUSED'
      showTimerPanel()
    } else {
      activeTimer = null
      isPaused = false
      hideTimerPanel()
    }
  } catch (err) {
    // Silently fail
  }
  renderProjectList()
}

// =============================================
// Timer Display
// =============================================

function showTimerPanel() {
  timerPanel.classList.remove('hidden')
  noTimer.classList.add('hidden')
  timerProject.textContent = activeTimer.projectName

  if (isPaused) {
    timerPanel.classList.add('paused')
    timerLabel.textContent = 'Paused'
    btnPause.innerHTML = '&#9654;'
    btnPause.title = 'Resume'
  } else {
    timerPanel.classList.remove('paused')
    timerLabel.textContent = 'Running'
    btnPause.innerHTML = '&#10074;&#10074;'
    btnPause.title = 'Pause'
  }

  startTickingDisplay()
}

function hideTimerPanel() {
  timerPanel.classList.add('hidden')
  noTimer.classList.remove('hidden')
  stopTickingDisplay()
  timerDisplay.textContent = '00:00:00'
}

function startTickingDisplay() {
  stopTickingDisplay()
  updateTimerDisplay()
  timerInterval = setInterval(updateTimerDisplay, 1000)
}

function stopTickingDisplay() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function updateTimerDisplay() {
  if (!activeTimer) return
  const now = Date.now()
  const totalMs = now - activeTimer.startedAt.getTime()
  let pauseMs = activeTimer.completedPauseMs || 0
  if (isPaused && activeTimer.currentPauseStart) {
    pauseMs += now - activeTimer.currentPauseStart.getTime()
  }
  let elapsedMs = totalMs - pauseMs
  if (elapsedMs < 0) elapsedMs = 0
  timerDisplay.textContent = formatTime(Math.floor(elapsedMs / 1000))
}

// =============================================
// Timer Actions
// =============================================

async function startTimer(projectId) {
  const proj = projects.find(p => p.id === projectId)
  if (!proj) return
  if (activeTimer && activeTimer.projectId === projectId && !isPaused) return

  showLoading('Starting timer...')

  if (activeTimer) {
    try { await api('PATCH', `/api/timeline/entries/${activeTimer.id}`, { action: 'stop' }) } catch {}
    activeTimer = null
    isPaused = false
  }

  try {
    const res = await api('POST', '/api/timeline/entries', { projectId, isManual: false })
    if (res.ok && res.data && res.data.entry) {
      const entry = res.data.entry
      activeTimer = {
        id: entry.id,
        projectId,
        projectName: `${proj.name} (${proj.clientName})`,
        startedAt: new Date(entry.startTime),
        status: 'RUNNING',
        completedPauseMs: 0,
        currentPauseStart: null,
      }
      isPaused = false
      showTimerPanel()
      renderProjectList()
    }
  } catch (err) {
    // Failed to start
  }

  hideLoading()
}

async function stopCurrentTimer() {
  if (!activeTimer) return
  try { await api('PATCH', `/api/timeline/entries/${activeTimer.id}`, { action: 'stop' }) } catch {}
  activeTimer = null
  isPaused = false
  hideTimerPanel()
  renderProjectList()
}

async function pauseResumeTimer() {
  if (!activeTimer) return
  const action = isPaused ? 'resume' : 'pause'
  try {
    const res = await api('PATCH', `/api/timeline/entries/${activeTimer.id}`, { action })
    if (res.ok) {
      if (action === 'pause') {
        isPaused = true
        activeTimer.status = 'PAUSED'
        activeTimer.currentPauseStart = new Date()
      } else {
        isPaused = false
        activeTimer.status = 'RUNNING'
        if (activeTimer.currentPauseStart) {
          activeTimer.completedPauseMs += Date.now() - activeTimer.currentPauseStart.getTime()
          activeTimer.currentPauseStart = null
        }
      }
      showTimerPanel()
    }
  } catch (err) {
    // Failed to pause/resume
  }
}

btnStop.addEventListener('click', () => stopCurrentTimer())
btnPause.addEventListener('click', () => pauseResumeTimer())

// =============================================
// Project List
// =============================================

function renderProjectList() {
  projectList.innerHTML = ''
  if (projects.length === 0) {
    projectList.innerHTML = '<div style="padding:20px;text-align:center;color:#666680;font-size:12px;">No projects found</div>'
    return
  }

  projects.forEach(proj => {
    const isActive = activeTimer && activeTimer.projectId === proj.id
    const item = document.createElement('div')
    item.className = 'project-item' + (isActive ? ' active' : '')
    item.innerHTML = `
      <div class="project-dot"></div>
      <div class="project-info">
        <div class="project-name">${escapeHtml(proj.name)}</div>
        <div class="project-client">${escapeHtml(proj.clientName || 'No Client')}</div>
      </div>
      <div class="project-play">${isActive ? (isPaused ? '&#9654;' : '&#9646;&#9646;') : '&#9654;'}</div>
    `
    item.addEventListener('click', () => startTimer(proj.id))
    projectList.appendChild(item)
  })
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// =============================================
// Refresh & Logout
// =============================================

btnRefresh.addEventListener('click', async () => {
  showLoading('Refreshing...')
  await Promise.all([loadProjects(), checkActiveTimer()])
  hideLoading()
})

btnLogout.addEventListener('click', async () => {
  await eAPI.store.delete('authToken')
  authToken = null
  currentUser = null
  activeTimer = null
  isPaused = false
  hideTimerPanel()
  stopTickingDisplay()
  projects = []
  userBar.classList.add('hidden')
  showScreen('login')
  inputEmail.value = ''
  inputPassword.value = ''
  loginError.textContent = ''
})

// =============================================
// Boot
// =============================================

init()
