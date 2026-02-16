// =============================================
// StudioFlow Desktop Timer v1.3.1 — Renderer
// Email/Password login with JWT Bearer token
// DEBUG BUILD — visible debug panel
// =============================================

// =============================================
// Debug Logger (visible on-screen)
// =============================================
const debugLog = document.getElementById('debug-log')

function dbg(msg) {
  const ts = new Date().toLocaleTimeString()
  const line = document.createElement('div')
  line.textContent = `[${ts}] ${msg}`
  line.style.marginBottom = '2px'
  if (debugLog) {
    debugLog.appendChild(line)
    debugLog.parentElement.scrollTop = debugLog.parentElement.scrollHeight
  }
  console.log(`[DBG] ${msg}`)
}

function dbgErr(msg) {
  const ts = new Date().toLocaleTimeString()
  const line = document.createElement('div')
  line.textContent = `[${ts}] ERROR: ${msg}`
  line.style.color = '#f66'
  line.style.marginBottom = '2px'
  if (debugLog) {
    debugLog.appendChild(line)
    debugLog.parentElement.scrollTop = debugLog.parentElement.scrollHeight
  }
  console.error(`[DBG] ${msg}`)
}

// =============================================
// Check electronAPI availability
// =============================================
dbg('Renderer starting...')

let electronAPI = null

if (window.electronAPI) {
  electronAPI = window.electronAPI
  dbg('electronAPI found on window')
  dbg(`  .minimize = ${typeof electronAPI.minimize}`)
  dbg(`  .close = ${typeof electronAPI.close}`)
  dbg(`  .store = ${typeof electronAPI.store}`)
  dbg(`  .apiRequest = ${typeof electronAPI.apiRequest}`)
} else {
  dbgErr('window.electronAPI is UNDEFINED — preload.js did not load!')
}

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

// Debug: verify critical DOM elements exist
dbg(`DOM: btnMinimize=${!!btnMinimize}, btnClose=${!!btnClose}`)
dbg(`DOM: btnLogin=${!!btnLogin}, inputEmail=${!!inputEmail}, inputPassword=${!!inputPassword}`)
dbg(`DOM: screenLogin=${!!screenLogin}, screenMain=${!!screenMain}`)

// =============================================
// Window Controls
// =============================================
if (btnMinimize) {
  btnMinimize.addEventListener('click', () => {
    dbg('MINIMIZE button clicked')
    if (electronAPI && electronAPI.minimize) {
      dbg('Calling electronAPI.minimize()...')
      electronAPI.minimize()
      dbg('electronAPI.minimize() called')
    } else {
      dbgErr('electronAPI.minimize is not available!')
    }
  })
  dbg('Minimize listener attached')
} else {
  dbgErr('btn-minimize element not found!')
}

if (btnClose) {
  btnClose.addEventListener('click', () => {
    dbg('CLOSE button clicked')
    if (electronAPI && electronAPI.close) {
      dbg('Calling electronAPI.close()...')
      electronAPI.close()
      dbg('electronAPI.close() called')
    } else {
      dbgErr('electronAPI.close is not available!')
    }
  })
  dbg('Close listener attached')
} else {
  dbgErr('btn-close element not found!')
}

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
  dbg(`showScreen("${name}")`)
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
  return electronAPI.apiRequest({ method, path, body, token: authToken, apiUrl })
}

// =============================================
// Login
// =============================================

async function init() {
  dbg('init() called')

  if (!electronAPI) {
    dbgErr('Cannot init — electronAPI missing!')
    return
  }

  try {
    authToken = await electronAPI.store.get('authToken')
    dbg(`Stored authToken: ${authToken ? 'exists (' + authToken.substring(0, 20) + '...)' : 'none'}`)
    apiUrl = await electronAPI.store.get('apiUrl') || 'https://app.meisnerinteriors.com'
    dbg(`apiUrl: ${apiUrl}`)
  } catch (err) {
    dbgErr(`store.get failed: ${err.message}`)
  }

  if (authToken) {
    showLoading('Signing in...')
    const user = await verifyToken()
    if (user) {
      dbg(`Token valid — user: ${user.name} (${user.email})`)
      currentUser = user
      await enterMainScreen()
    } else {
      dbg('Token invalid — clearing')
      authToken = null
      await electronAPI.store.delete('authToken')
      hideLoading()
      showScreen('login')
    }
  } else {
    dbg('No stored token — showing login')
    showScreen('login')
  }
}

async function verifyToken() {
  dbg('verifyToken() — calling /api/auth/me')
  try {
    const res = await electronAPI.apiRequest({
      method: 'GET',
      path: '/api/auth/me',
      token: authToken,
      apiUrl,
    })
    dbg(`verifyToken response: ok=${res.ok}, status=${res.status}`)
    if (res.ok && res.data && res.data.user) {
      return res.data.user
    }
    dbg(`verifyToken failed: ${JSON.stringify(res.data).substring(0, 100)}`)
    return null
  } catch (err) {
    dbgErr(`verifyToken exception: ${err.message}`)
    return null
  }
}

async function loginWithCredentials(email, password) {
  dbg(`loginWithCredentials("${email}", "****")`)
  dbg(`POST ${apiUrl}/api/auth/mobile-login`)
  try {
    const res = await electronAPI.apiRequest({
      method: 'POST',
      path: '/api/auth/mobile-login',
      body: { email, password },
      apiUrl,
    })

    dbg(`Login response: ok=${res.ok}, status=${res.status}`)
    dbg(`Login data keys: ${res.data ? Object.keys(res.data).join(',') : 'null'}`)

    if (res.ok && res.data && res.data.token) {
      dbg('Login SUCCESS — got token')
      return { token: res.data.token, user: res.data.user }
    }

    const errMsg = res.data?.error || `Login failed (status ${res.status})`
    dbgErr(`Login FAILED: ${errMsg}`)
    return { error: errMsg }
  } catch (err) {
    dbgErr(`Login EXCEPTION: ${err.message}`)
    return { error: 'Connection failed. Check your internet.' }
  }
}

if (btnLogin) {
  btnLogin.addEventListener('click', async () => {
    dbg('LOGIN button clicked')

    const email = inputEmail.value.trim().toLowerCase()
    const password = inputPassword.value

    dbg(`Email input value: "${email}"`)
    dbg(`Password input value: ${password ? '****(' + password.length + ' chars)' : 'EMPTY'}`)

    if (!email || !password) {
      dbg('Validation fail — empty email or password')
      loginError.textContent = 'Enter your email and password'
      return
    }

    loginError.textContent = ''
    btnLogin.disabled = true
    btnLogin.textContent = 'Signing in...'

    const result = await loginWithCredentials(email, password)

    if (result.token) {
      dbg('Storing token and entering main screen...')
      authToken = result.token
      currentUser = result.user
      await electronAPI.store.set('authToken', authToken)
      await electronAPI.store.set('apiUrl', apiUrl)
      showLoading('Loading projects...')
      await enterMainScreen()
    } else {
      dbgErr(`Login error shown to user: ${result.error}`)
      loginError.textContent = result.error || 'Invalid email or password'
    }

    btnLogin.disabled = false
    btnLogin.textContent = 'Sign In'
  })
  dbg('Login button listener attached')
} else {
  dbgErr('btn-login element not found!')
}

if (inputPassword) {
  inputPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      dbg('Enter key in password field — triggering login')
      btnLogin.click()
    }
  })
}

if (inputEmail) {
  inputEmail.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') inputPassword.focus()
  })
}

// =============================================
// Main Screen
// =============================================

async function enterMainScreen() {
  dbg('enterMainScreen()')
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
  dbg('loadProjects() — fetching...')
  try {
    const res = await api('GET', '/api/extension/projects')
    dbg(`loadProjects response: ok=${res.ok}, status=${res.status}`)
    if (res.ok && res.data && res.data.projects) {
      projects = res.data.projects
      dbg(`Loaded ${projects.length} projects`)
    } else {
      dbg(`loadProjects: no projects in response`)
    }
  } catch (err) {
    dbgErr(`loadProjects failed: ${err.message}`)
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
  dbg('Logout clicked')
  await electronAPI.store.delete('authToken')
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

dbg('About to call init()...')
init()
