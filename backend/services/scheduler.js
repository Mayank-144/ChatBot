import cron from 'node-cron';
import { runLeadsAgent } from '../agent/leadsAgent.js';

// Predefined human-friendly schedule presets
export const SCHEDULE_PRESETS = {
  morning: '0 8 * * *', // 8:00 AM daily
  evening: '0 18 * * *', // 6:00 PM daily
  night: '0 23 * * *', // 11:00 PM daily
  midnight: '0 0 * * *', // 12:00 AM daily
};

// Store multiple active scheduled cron jobs
let activeSchedules = [];
let lastRunTime = null;
let lastRunStatus = null;

/**
 * Robust parser converting both standard 5-part cron syntax AND human clock times
 * (e.g. "12:30 PM", "14:15", "9:00 AM", "every 2 mins") into valid node-cron expressions.
 * @param {string} input
 * @returns {string|null} Valid cron expression or null
 */
export function parseToCronExpression(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // 1. If already valid standard cron expression (e.g. "* * * * *", "0 9 * * 1", "*/5 * * * *")
  if (cron.validate(trimmed)) {
    return trimmed;
  }

  // 2. Parse 12-hour or 24-hour clock time (e.g. "12:30 PM", "1:15 pm", "14:20", "9:45 AM")
  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    const meridian = timeMatch[3]?.toLowerCase();

    if (meridian === 'pm' && hour < 12) {
      hour += 12;
    } else if (meridian === 'am') {
      if (hour === 12) hour = 0;
    } else if (!meridian) {
      // If user types e.g. "1:06" without AM/PM during afternoon (>= 12:00), automatically default to PM
      const now = new Date();
      // Adjust to IST timezone hours if running in different environment
      const istHour = parseInt(
        now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false, hour: 'numeric' }),
        10
      );
      if (istHour >= 12 && hour < 12) {
        hour += 12;
      }
    }

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      const parsedCron = `${minute} ${hour} * * *`;
      if (cron.validate(parsedCron)) {
        return parsedCron;
      }
    }
  }

  // 3. Parse "every X minutes" (e.g. "every 2 mins", "every 5 minutes")
  const everyMatch = trimmed.match(/^every\s+(\d+)\s*(?:min|minute|m)s?$/i);
  if (everyMatch) {
    const mins = parseInt(everyMatch[1], 10);
    if (mins > 0 && mins < 60) {
      return `*/${mins} * * * *`;
    }
  }

  return null;
}

/**
 * Calculates a human-readable estimate of the next run time for a given cron expression.
 */
export function estimateNextRun(scheduleKey, cronExpr) {
  if (scheduleKey === 'disabled' || !cronExpr) return 'No automatic schedule (Disabled)';
  if (scheduleKey === 'morning') return 'Daily at 8:00 AM IST';
  if (scheduleKey === 'evening') return 'Daily at 6:00 PM IST';
  if (scheduleKey === 'night') return 'Daily at 11:00 PM IST';
  if (scheduleKey === 'midnight') return 'Daily at 12:00 AM (Midnight) IST';
  if (cronExpr === '* * * * *') return 'Every minute (Testing Mode)';
  if (cronExpr.startsWith('*/')) return `Every ${cronExpr.split(' ')[0].replace('*/', '')} minutes`;

  const parts = cronExpr.split(' ');
  if (parts.length === 5 && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
    const m = parts[0].padStart(2, '0');
    let h = parseInt(parts[1], 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `Daily at ${displayH}:${m} ${ampm} IST (Custom: ${cronExpr})`;
  }

  return `Custom: ${cronExpr}`;
}

/**
 * Executes an automated run of the leads agent and delivers the email report.
 * @param {Object} [scheduleConfig] - Specific configuration for this schedule instance
 * @returns {Promise<Object>} Run status result
 */
export async function executeScheduledLeadsRun(scheduleConfig = {}) {
  const timestamp = new Date().toISOString();
  const recipient = (scheduleConfig.recipientEmail || process.env.EMAIL_TO || 'mayanktesting144@gmail.com').trim();
  const industry = (scheduleConfig.industry || process.env.LEADS_INDUSTRY || 'technology').trim();
  const location = (scheduleConfig.location || process.env.LEADS_LOCATION || 'India').trim();
  const query = scheduleConfig.query || `${industry} companies in ${location}`;

  console.log(`[SCHEDULER] ⏰ Triggered automated leads execution at ${timestamp} [ID: ${scheduleConfig.id || 'manual'}]`);
  console.log(`[SCHEDULER] Target: "${industry}" in "${location}", Recipient: "${recipient}"`);

  try {
    const result = await runLeadsAgent({
      industry,
      location,
      query,
      sendEmail: true,
      recipientEmail: recipient,
    });

    lastRunTime = new Date().toISOString();
    lastRunStatus = {
      success: true,
      scheduleId: scheduleConfig.id || 'manual',
      leadsCount: result.leads?.length || 0,
      recipient,
      industry,
      location,
      emailStatus: result.emailStatus?.message || 'Email dispatched successfully',
      timestamp: lastRunTime,
    };

    console.log(`[SCHEDULER] ✅ Automated run succeeded at ${lastRunTime}. Dispatched to ${recipient} (${result.leads?.length} leads).`);
    return lastRunStatus;
  } catch (error) {
    lastRunTime = new Date().toISOString();
    lastRunStatus = {
      success: false,
      scheduleId: scheduleConfig.id || 'manual',
      error: error.message,
      recipient,
      industry,
      location,
      timestamp: lastRunTime,
    };
    console.error(`[SCHEDULER] ❌ Automated leads run failed at ${lastRunTime}:`, error.message);
    return lastRunStatus;
  }
}

/**
 * Stops and removes all currently active cron scheduler tasks.
 */
export function clearAllSchedules() {
  for (const s of activeSchedules) {
    if (s.task) {
      try {
        s.task.stop();
      } catch {}
    }
  }
  activeSchedules = [];
  console.log('[SCHEDULER] All active cron schedules cleared.');
  return getSchedulerStatus();
}

/**
 * Removes a single scheduled task by its unique ID.
 * @param {string} id - Schedule unique ID
 * @returns {Object} Updated scheduler status
 */
export function removeSchedule(id) {
  const idx = activeSchedules.findIndex((s) => s.id === id);
  if (idx !== -1) {
    const removed = activeSchedules[idx];
    if (removed.task) {
      try {
        removed.task.stop();
      } catch {}
    }
    activeSchedules.splice(idx, 1);
    console.log(`[SCHEDULER] Removed schedule ID: ${id} (${removed.cronExpr})`);
  }
  return getSchedulerStatus();
}

/**
 * Creates and registers a new active schedule without overwriting existing ones.
 * Supports comma-separated multiple times/cron (e.g. "12:51 PM, 1:00 PM").
 * @param {Object} options
 * @param {string} [options.schedule] - Preset ('morning'|'evening'|'night'|'midnight'|'custom'|'disabled')
 * @param {string} [options.cronExpr] - Custom expression (or comma-separated list)
 * @param {string} [options.recipientEmail] - Target recipient email
 * @param {string} [options.industry] - Target industry
 * @param {string} [options.location] - Target location
 * @returns {Object} Updated scheduler status
 */
export function addSchedule(options = {}) {
  const scheduleSetting = (options.schedule || 'custom').toLowerCase().trim();
  const rawCustomExpr = options.cronExpr || '';

  if (scheduleSetting === 'disabled') {
    return clearAllSchedules();
  }

  // Support comma-separated multiple entries: e.g. "12:51 PM, 1:00 PM"
  const rawList = scheduleSetting === 'custom' && rawCustomExpr.includes(',')
    ? rawCustomExpr.split(',').map((s) => s.trim()).filter(Boolean)
    : [rawCustomExpr];

  const addedItems = [];

  for (const rawItem of rawList) {
    let targetExpr = null;
    if (scheduleSetting === 'custom') {
      targetExpr = parseToCronExpression(rawItem) || parseToCronExpression(options.cronExpr);
    } else if (SCHEDULE_PRESETS[scheduleSetting]) {
      targetExpr = SCHEDULE_PRESETS[scheduleSetting];
    }

    if (!targetExpr || !cron.validate(targetExpr)) {
      console.warn(`[SCHEDULER] Invalid schedule format: "${rawItem || scheduleSetting}". Skipping.`);
      continue;
    }

    const scheduleId = `sched_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const scheduleConfig = {
      id: scheduleId,
      schedule: scheduleSetting,
      cronExpr: targetExpr,
      rawInput: rawItem || scheduleSetting,
      nextRun: estimateNextRun(scheduleSetting, targetExpr),
      industry: (options.industry || process.env.LEADS_INDUSTRY || 'technology').trim(),
      location: (options.location || process.env.LEADS_LOCATION || 'India').trim(),
      recipientEmail: (options.recipientEmail || process.env.EMAIL_TO || 'mayanktesting144@gmail.com').trim(),
      createdAt: new Date().toISOString(),
    };

    // Instantiate and start node-cron task
    const task = cron.schedule(
      targetExpr,
      () => {
        executeScheduledLeadsRun(scheduleConfig);
      },
      {
        timezone: 'Asia/Kolkata',
      }
    );

    scheduleConfig.task = task;
    activeSchedules.push(scheduleConfig);
    addedItems.push(scheduleConfig);

    console.log(`[SCHEDULER] ✅ Added active schedule [${scheduleId}]: ${targetExpr} for ${scheduleConfig.recipientEmail}`);
  }

  return getSchedulerStatus();
}

/**
 * Legacy initialization alias for backwards compatibility.
 */
export function initScheduler(options = {}) {
  if (options.schedule === 'disabled') {
    return clearAllSchedules();
  }
  return addSchedule(options);
}

/**
 * Returns the current runtime status including all active schedules.
 */
export function getSchedulerStatus() {
  const sanitizedSchedules = activeSchedules.map((s) => ({
    id: s.id,
    schedule: s.schedule,
    cronExpr: s.cronExpr,
    rawInput: s.rawInput,
    nextRun: s.nextRun,
    industry: s.industry,
    location: s.location,
    recipientEmail: s.recipientEmail,
    createdAt: s.createdAt,
  }));

  const hasActive = activeSchedules.length > 0;
  const primarySchedule = hasActive ? activeSchedules[activeSchedules.length - 1] : null;

  return {
    active: hasActive,
    activeCount: activeSchedules.length,
    schedules: sanitizedSchedules,
    schedule: primarySchedule?.schedule || 'disabled',
    cronExpr: primarySchedule?.cronExpr || null,
    nextRun: hasActive
      ? `${activeSchedules.length} active schedule(s): ${sanitizedSchedules.map((s) => s.nextRun).join(' • ')}`
      : 'No automatic schedule (Disabled)',
    lastRunTime,
    lastRunStatus,
    config: {
      industry: primarySchedule?.industry || process.env.LEADS_INDUSTRY || 'technology',
      location: primarySchedule?.location || process.env.LEADS_LOCATION || 'India',
      recipientEmail: primarySchedule?.recipientEmail || process.env.EMAIL_TO || 'mayanktesting144@gmail.com',
      query: process.env.LEADS_QUERY || 'top tech startups',
    },
  };
}

export default {
  initScheduler,
  addSchedule,
  removeSchedule,
  clearAllSchedules,
  getSchedulerStatus,
  executeScheduledLeadsRun,
  parseToCronExpression,
  estimateNextRun,
  SCHEDULE_PRESETS,
};
