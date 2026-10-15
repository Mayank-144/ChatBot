import cron from 'node-cron';
import { runLeadsAgent } from '../agent/leadsAgent.js';

// Predefined human-friendly schedule presets
export const SCHEDULE_PRESETS = {
  morning: '0 8 * * *', // 8:00 AM daily
  evening: '0 18 * * *', // 6:00 PM daily
  night: '0 23 * * *', // 11:00 PM daily
  midnight: '0 0 * * *', // 12:00 AM daily
  disabled: null,
};

let activeCronTask = null;
let currentSchedule = 'disabled';
let currentCronExpr = null;
let currentRecipient = null;
let currentIndustry = null;
let currentLocation = null;
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

    if (meridian === 'pm' && hour < 12) hour += 12;
    if (meridian === 'am' && hour === 12) hour = 0;

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
function estimateNextRun(scheduleKey, cronExpr) {
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
 * Executes a single automated run of the leads agent and delivers the email report.
 * @returns {Promise<Object>} Run status result
 */
export async function executeScheduledLeadsRun() {
  const timestamp = new Date().toISOString();
  const recipient = (currentRecipient || process.env.EMAIL_TO || 'mayanktesting144@gmail.com').trim();
  const industry = (currentIndustry || process.env.LEADS_INDUSTRY || 'technology').trim();
  const location = (currentLocation || process.env.LEADS_LOCATION || 'India').trim();
  const query = process.env.LEADS_QUERY || `${industry} companies in ${location}`;

  console.log(`[SCHEDULER] ⏰ Triggered automated leads execution at ${timestamp}`);
  console.log(`[SCHEDULER] Industry: "${industry}", Location: "${location}", Recipient: "${recipient}"`);

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
      leadsCount: result.leads?.length || 0,
      recipient,
      emailStatus: result.emailStatus?.message || 'Email dispatched successfully',
      timestamp: lastRunTime,
    };

    console.log(`[SCHEDULER] ✅ Automated run succeeded at ${lastRunTime}. Dispatched to ${recipient} (${result.leads?.length} leads).`);
    return lastRunStatus;
  } catch (error) {
    lastRunTime = new Date().toISOString();
    lastRunStatus = {
      success: false,
      error: error.message,
      recipient,
      timestamp: lastRunTime,
    };
    console.error(`[SCHEDULER] ❌ Automated leads run failed at ${lastRunTime}:`, error.message);
    return lastRunStatus;
  }
}

/**
 * Stops any currently active cron scheduler task.
 */
export function stopScheduler() {
  if (activeCronTask) {
    activeCronTask.stop();
    activeCronTask = null;
    console.log('[SCHEDULER] Active cron schedule stopped.');
  }
}

/**
 * Initializes or updates the leads automation scheduler.
 * @param {Object} [options]
 * @param {string} [options.schedule] - Preset ('morning'|'evening'|'night'|'midnight'|'custom'|'disabled')
 * @param {string} [options.cronExpr] - Custom cron expression or time (e.g. "* * * * *" or "12:30 PM")
 * @param {string} [options.recipientEmail] - Target recipient email
 * @param {string} [options.industry] - Target industry
 * @param {string} [options.location] - Target location
 * @returns {Object} Current scheduler status
 */
export function initScheduler(options = {}) {
  const scheduleSetting = (options.schedule || process.env.LEADS_SCHEDULE || 'disabled').toLowerCase().trim();
  const rawCustomExpr = options.cronExpr || process.env.LEADS_CRON_EXPR;

  if (options.recipientEmail) currentRecipient = options.recipientEmail.trim();
  if (options.industry) currentIndustry = options.industry.trim();
  if (options.location) currentLocation = options.location.trim();

  stopScheduler();

  let targetExpr = null;
  if (scheduleSetting === 'custom') {
    targetExpr = parseToCronExpression(rawCustomExpr) || '0 9 * * 1';
  } else if (SCHEDULE_PRESETS[scheduleSetting]) {
    targetExpr = SCHEDULE_PRESETS[scheduleSetting];
  }

  currentSchedule = scheduleSetting;
  currentCronExpr = targetExpr;

  if (targetExpr && scheduleSetting !== 'disabled') {
    if (!cron.validate(targetExpr)) {
      console.warn(`[SCHEDULER] Invalid cron expression: "${targetExpr}". Falling back to disabled.`);
      currentSchedule = 'disabled';
      currentCronExpr = null;
      return getSchedulerStatus();
    }

    // Schedule task with explicit IST timezone support
    activeCronTask = cron.schedule(
      targetExpr,
      () => {
        executeScheduledLeadsRun();
      },
      {
        timezone: 'Asia/Kolkata',
      }
    );

    console.log(`[SCHEDULER] ✅ Leads scheduler activated: ${scheduleSetting} (${targetExpr}) for ${currentRecipient || 'mayanktesting144@gmail.com'}`);
  } else {
    console.log('[SCHEDULER] Leads scheduler is currently disabled.');
  }

  return getSchedulerStatus();
}

/**
 * Returns the current runtime status of the scheduler.
 */
export function getSchedulerStatus() {
  return {
    active: Boolean(activeCronTask),
    schedule: currentSchedule,
    cronExpr: currentCronExpr,
    nextRun: estimateNextRun(currentSchedule, currentCronExpr),
    lastRunTime,
    lastRunStatus,
    config: {
      industry: currentIndustry || process.env.LEADS_INDUSTRY || 'technology',
      location: currentLocation || process.env.LEADS_LOCATION || 'India',
      recipientEmail: currentRecipient || process.env.EMAIL_TO || 'mayanktesting144@gmail.com',
      query: process.env.LEADS_QUERY || 'top tech startups',
    },
  };
}

export default {
  initScheduler,
  stopScheduler,
  getSchedulerStatus,
  executeScheduledLeadsRun,
  parseToCronExpression,
  SCHEDULE_PRESETS,
};
