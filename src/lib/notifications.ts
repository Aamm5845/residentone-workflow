/**
 * Browser Desktop Notifications
 * Request permission and send native OS notifications
 */

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notifications')
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  return false
}

export function sendDesktopNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      icon: '/icon.png', // Add your app icon
      badge: '/badge.png', // Small badge icon
      ...options,
    })

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000)

    return notification
  }
  return null
}

export function sendMentionNotification(mentionedBy: string, message: string, link?: string) {
  const notification = sendDesktopNotification(
    `${mentionedBy} mentioned you`,
    {
      body: message,
      tag: 'mention', // Replaces previous mention notifications
      requireInteraction: true, // Stays until clicked
    }
  )

  if (notification && link) {
    notification.onclick = () => {
      window.focus()
      window.location.href = link
      notification.close()
    }
  }

  return notification
}
