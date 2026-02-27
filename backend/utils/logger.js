'use strict'

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }
const currentLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug'

function log(level, message, meta) {
  if (LOG_LEVELS[level] > LOG_LEVELS[currentLevel]) return

  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`

  if (meta !== undefined) {
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
      prefix,
      message,
      meta
    )
  } else {
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
      prefix,
      message
    )
  }
}

module.exports = {
  error: (msg, meta) => log('error', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
}
