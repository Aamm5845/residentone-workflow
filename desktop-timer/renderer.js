// =============================================
// StudioFlow Desktop Timer — Renderer
// =============================================

const { electronAPI } = window

// =============================================
// State
// =============================================
let apiKey = null
let apiUrl = null
let currentUser = null // { id, name, email, role }
let projects = []
let activeTimer = null
let timerInterval = null
let isPaused = false

// =============================================
// DOM Elements
// =============================================
const $ = (id) => document.getElementById(id)

const screenSetup = $('screen-setup')
const screenMain = $('screen-main')
const loading = $('loading')

// Setup
const inputApiKey = $('input-apikey')
const inputApiUrl = $('input-apiurl')
const btnConnect = $('btn-connect')
const setupError = $('setup-error')

// Title bar
const btnMinimize = $('btn-minimize')
const btnClose = $('btn-close')

// User
const userBar = $('user-bar')
const userName = $('user-name')
const userEmail = $('user-email')

// Timer
const timerPanel = $('timer-panel')
const noTimer = $('no-timer')
const timerDisplay = $('timer-display')
const timerProject = $('timer-project')
const timerLabel = $('timer-label')
const btnPause = $('btn-pause')
const btnStop = $('btn-stop')

// Projects
const projectList = $('project-list')
const btnRefresh = $('btn-refresh')
const btnDisconnect = $('btn-disconnect')

// =============================================
// Window Controls — wire immediately
// =============================================
btnMinimize.addEventListener('click', () => electronAPI.minimize())
btnClose.addEventListener('click', () => electronAPI.close())

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
  screenSetup.classList.toggle('hidden', name !== 'setup')
  screenMain.classList.toggle('hidden', name !== 'main')
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}

async function api(method, path, body) {
  return electronAPI.apiRequest({ method, path, body, apiKey, apiUrl })
}

// =============================================
// Setup / Auth
// =============================================

async function init() {
  apiKey = await electronAPI.store.get('apiKey')
  apiUrl = await electronAPI.store.get('apiUrl') || 'https://app.meisnerinteriors.com'
  inputApiUrl.value = apiUrl

  if (apiKey) {
    showLoading('Connecting...')
    const user = await validateAndGetUser(apiKey)
    if (user) {
      currentUser = user
      await electronAPI.store.set('userName', user.name || '')
      await electronAPI.store.set('userEmail', user.email || '')
      await enterMainScreen()
    } else {
      apiKey = null
      await electronAPI.store.delete('apiKey')
      hideLoading()
      showScreen('setup')
    }
  } else {
    showScreen('setup')
  }
}

async function validateAndGetUser(key) {
  try {
    const res = await electronAPI.apiRequest({
      method: 'GET',
      path: '/api/extension/auth',
      apiKey: key,
      apiUrl: apiUrl,
    })
    if (res.ok && res.data && res.data.ok) {
      return res.data.user || null
    }
    return null
  } catch (err) {
    console.error('Auth error:', err)
    return null
  }
}

btnConnect.addEventListener('click', async () => {
  const key = inputApiKey.value.trim()
  const url = inputApiUrl.value.trim()

  if (!key) {
    setupError.textContent = 'Please enter an API key'
    return
  }

  setupError.textContent = ''
  btnConnect.disabled = true
  btnConnect.textContent = 'Connecting...'

  apiUrl = url || 'https://app.meisnerinteriors.com'

  try {
    const user = await validateAndGetUser(key)

    if (user) {
      apiKey = key
      currentUser = user
      await electronAPI.store.set('apiKey', apiKey)
      await electronAPI.store.set('apiUrl', apiUrl)
      await electronAPI.store.set('userName', user.name || '')
      await electronAPI.store.set('userEmail', user.email || '')
      showLoading('Loading projects...')
      await enterMainScreen()
    } else {
      setupError.textContent = 'Invalid API key or server unreachable'
    }
  } catch (err) {
    setupError.textContent = 'Connection failed: ' + (err.message || 'Unknown error')
  }

  btnConnect.disabled = false
  btnConnect.textContent = 'Connect'
})

inputApiKey.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnConnect.click()
})

// =============================================
// Main Screen
// =============================================

async function enterMainScreen() {
  showScreen('main')
  showUserBar()

  // Load projects and check timer in parallel for speed
  await Promise.all([loadProjects(), checkActiveTimer()])
  hideLoading()
}

function showUserBar() {
  if (currentUser) {
    userName.textContent = currentUser.name || 'Team Member'
    userEmail.textContent = currentUser.email || ''
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
    console.error('Failed to load projects:', err)
  }
  renderProjectList()
}

async function checkActiveTimer() {
  try {
    // Check running and paused in parallel for speed
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
    console.error('Failed to check active timer:', err)
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

  // If same project already running, ignore
  if (activeTimer && activeTimer.projectId === projectId && !isPaused) {
    return
  }

  showLoading('Starting timer...')

  // Stop existing timer first if different project
  if (activeTimer) {
    try {
      await api('PATCH', `/api/timeline/entries/${activeTimer.id}`, { action: 'stop' })
    } catch (err) {
      console.error('Error stopping previous timer:', err)
    }
    activeTimer = null
    isPaused = false
  }

  try {
    const res = await api('POST', '/api/timeline/entries', {
      projectId: projectId,
      isManual: false,
    })

    if (res.ok && res.data && res.data.entry) {
      const entry = res.data.entry
      activeTimer = {
        id: entry.id,
        projectId: projectId,
        projectName: `${proj.name} (${proj.clientName})`,
        startedAt: new Date(entry.startTime),
        status: 'RUNNING',
        completedPauseMs: 0,
        currentPauseStart: null,
      }
      isPaused = false
      showTimerPanel()
      renderProjectList()
    } else {
      const errMsg = res.data?.error || 'Failed to start timer'
      console.error('Start timer error:', errMsg)
    }
  } catch (err) {
    console.error('Error starting timer:', err)
  }

  hideLoading()
}

async function stopCurrentTimer() {
  if (!activeTimer) return

  try {
    await api('PATCH', `/api/timeline/entries/${activeTimer.id}`, { action: 'stop' })
  } catch (err) {
    console.error('Error stopping timer:', err)
  }

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
    console.error('Error pause/resume:', err)
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
// Refresh & Disconnect
// =============================================

btnRefresh.addEventListener('click', async () => {
  showLoading('Refreshing...')
  await Promise.all([loadProjects(), checkActiveTimer()])
  hideLoading()
})

btnDisconnect.addEventListener('click', async () => {
  await electronAPI.store.delete('apiKey')
  await electronAPI.store.delete('userName')
  await electronAPI.store.delete('userEmail')
  apiKey = null
  currentUser = null
  activeTimer = null
  isPaused = false
  hideTimerPanel()
  stopTickingDisplay()
  projects = []
  userBar.classList.add('hidden')
  showScreen('setup')
  inputApiKey.value = ''
  setupError.textContent = ''
})

// =============================================
// Boot
// =============================================

init()
