// =============================================
// StudioFlow Desktop Timer — Renderer
// =============================================

const { electronAPI } = window

// =============================================
// State
// =============================================
let apiKey = null
let apiUrl = null
let projects = []
let activeTimer = null   // { id, projectId, projectName, startedAt, status }
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
  // Load saved credentials
  apiKey = await electronAPI.store.get('apiKey')
  apiUrl = await electronAPI.store.get('apiUrl') || 'https://app.meisnerinteriors.com'
  inputApiUrl.value = apiUrl

  if (apiKey) {
    showLoading('Connecting...')
    const valid = await validateKey(apiKey)
    if (valid) {
      await enterMainScreen()
    } else {
      // Key expired or invalid
      apiKey = null
      await electronAPI.store.delete('apiKey')
      hideLoading()
      showScreen('setup')
    }
  } else {
    showScreen('setup')
  }
}

async function validateKey(key) {
  try {
    const res = await electronAPI.apiRequest({
      method: 'GET',
      path: '/api/extension/auth',
      apiKey: key,
      apiUrl: apiUrl,
    })
    return res.ok
  } catch {
    return false
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

  const valid = await validateKey(key)

  if (valid) {
    apiKey = key
    await electronAPI.store.set('apiKey', apiKey)
    await electronAPI.store.set('apiUrl', apiUrl)
    showLoading('Loading projects...')
    await enterMainScreen()
  } else {
    setupError.textContent = 'Invalid API key or cannot reach server'
  }

  btnConnect.disabled = false
  btnConnect.textContent = 'Connect'
})

// Allow Enter key in API key field
inputApiKey.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnConnect.click()
})

// =============================================
// Main Screen
// =============================================

async function enterMainScreen() {
  showScreen('main')
  await loadProjects()
  await checkActiveTimer()
  hideLoading()
}

async function loadProjects() {
  try {
    const res = await api('GET', '/api/extension/projects')
    if (res.ok && res.data.projects) {
      projects = res.data.projects
    }
  } catch (err) {
    console.error('Failed to load projects:', err)
  }
  renderProjectList()
}

async function checkActiveTimer() {
  try {
    // Check for running timer first, then paused
    let entry = null
    const res = await api('GET', '/api/timeline/entries?status=RUNNING&perPage=1')
    if (res.ok && res.data.entries && res.data.entries.length > 0) {
      entry = res.data.entries[0]
    } else {
      const pausedRes = await api('GET', '/api/timeline/entries?status=PAUSED&perPage=1')
      if (pausedRes.ok && pausedRes.data.entries && pausedRes.data.entries.length > 0) {
        entry = pausedRes.data.entries[0]
      }
    }

    if (entry) {
      const proj = projects.find(p => p.id === entry.projectId)
      // Calculate total completed pause time (in ms) from the pauses array
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
        completedPauseMs: completedPauseMs,
        // If currently paused, track when the current pause started
        currentPauseStart: null,
      }

      // Find the active (unended) pause if paused
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
    btnPause.innerHTML = '&#9654;' // play
    btnPause.title = 'Resume'
  } else {
    timerPanel.classList.remove('paused')
    timerLabel.textContent = 'Running'
    btnPause.innerHTML = '&#10074;&#10074;' // pause
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

  const now = new Date()
  const totalMs = now.getTime() - activeTimer.startedAt.getTime()

  // Subtract completed pauses
  let pauseMs = activeTimer.completedPauseMs || 0

  // If currently paused, add the duration of the current pause
  if (isPaused && activeTimer.currentPauseStart) {
    pauseMs += now.getTime() - activeTimer.currentPauseStart.getTime()
  }

  let elapsedMs = totalMs - pauseMs
  if (elapsedMs < 0) elapsedMs = 0

  const elapsed = Math.floor(elapsedMs / 1000)
  timerDisplay.textContent = formatTime(elapsed)
}

// =============================================
// Timer Actions
// =============================================

async function startTimer(projectId) {
  const proj = projects.find(p => p.id === projectId)
  if (!proj) return

  showLoading('Starting timer...')

  // If there's an active timer on a different project, stop it first
  if (activeTimer && activeTimer.projectId !== projectId) {
    await stopCurrentTimer()
  }

  // If the same project is already active, do nothing
  if (activeTimer && activeTimer.projectId === projectId) {
    hideLoading()
    return
  }

  try {
    const res = await api('POST', '/api/timeline/entries', {
      projectId: projectId,
      isManual: false,
    })

    if (res.ok && res.data.entry) {
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
      console.error('Failed to start timer:', res.data)
    }
  } catch (err) {
    console.error('Error starting timer:', err)
  }

  hideLoading()
}

async function stopCurrentTimer() {
  if (!activeTimer) return

  try {
    await api('PATCH', `/api/timeline/entries/${activeTimer.id}`, {
      action: 'stop',
    })
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
    const res = await api('PATCH', `/api/timeline/entries/${activeTimer.id}`, {
      action: action,
    })

    if (res.ok) {
      if (action === 'pause') {
        // We just paused — track when this pause started
        isPaused = true
        activeTimer.status = 'PAUSED'
        activeTimer.currentPauseStart = new Date()
      } else {
        // We just resumed — add the pause duration to completed pauses
        isPaused = false
        activeTimer.status = 'RUNNING'
        if (activeTimer.currentPauseStart) {
          const pausedMs = new Date().getTime() - activeTimer.currentPauseStart.getTime()
          activeTimer.completedPauseMs = (activeTimer.completedPauseMs || 0) + pausedMs
          activeTimer.currentPauseStart = null
        }
      }

      showTimerPanel()
    }
  } catch (err) {
    console.error('Error pause/resume timer:', err)
  }
}

btnStop.addEventListener('click', async () => {
  await stopCurrentTimer()
})

btnPause.addEventListener('click', async () => {
  await pauseResumeTimer()
})

// =============================================
// Project List Render
// =============================================

function renderProjectList() {
  projectList.innerHTML = ''

  if (projects.length === 0) {
    projectList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666680; font-size: 12px;">No projects found</div>'
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
      <div class="project-play">${isActive ? '&#9654;' : '&#9654;'}</div>
    `

    item.addEventListener('click', () => {
      if (isActive && !isPaused) {
        // Already running on this project — do nothing or pause
        return
      }
      startTimer(proj.id)
    })

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
  await loadProjects()
  await checkActiveTimer()
  hideLoading()
})

btnDisconnect.addEventListener('click', async () => {
  await electronAPI.store.delete('apiKey')
  apiKey = null
  activeTimer = null
  isPaused = false
  hideTimerPanel()
  stopTickingDisplay()
  projects = []
  showScreen('setup')
  inputApiKey.value = ''
  setupError.textContent = ''
})

// =============================================
// Window Controls
// =============================================

btnMinimize.addEventListener('click', () => electronAPI.minimize())
btnClose.addEventListener('click', () => electronAPI.close())

// =============================================
// Boot
// =============================================

init()
