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
let lastRunTime = null;
let lastRunStatus = null;

/**
 * Calculates a human-readable estimate of the next run time for a given cron expression.
 */
function estimateNextRun(scheduleKey, cronExpr) {
  if (scheduleKey === 'disabled' || !cronExpr) return 'No automatic schedule (Disabled)';
  if (scheduleKey === 'morning') return 'Daily at 8:00 AM';
  if (scheduleKey === 'evening') return 'Daily at 6:00 PM';
  if (scheduleKey === 'night') return 'Daily at 11:00 PM';
  if (scheduleKey === 'midnight') return 'Daily at 12:00 AM (Midnight)';
  return `Custom: ${cronExpr}`;
}

/**
 * Executes a single scheduled run of the leads agent.
 */
async function executeScheduledLeadsRun() {
  const timestamp = new Date().toISOString();
  console.log(`Scheduler: Running leads agent at ${timestamp}...`);

  const industry = process.env.LEADS_INDUSTRY || 'technology';
  const location = process.env.LEADS_LOCATION || 'India';
  const query = process.env.LEADS_QUERY || `${industry} companies in ${location}`;

  try {
    const result = await runLeadsAgent({
      industry,
      location,
      query,
      sendEmail: true,
    });

    lastRunTime = new Date().toISOString();
    lastRunStatus = {
      success: true,
      leadsCount: result.leads?.length || 0,
      emailStatus: result.emailStatus?.message || 'Email dispatched or simulated',
      timestamp: lastRunTime,
    };

    console.log(`[SCHEDULER] Successfully completed automated run at ${lastRunTime}. Found ${result.leads?.length} leads.`);
  } catch (error) {
    lastRunTime = new Date().toISOString();
    lastRunStatus = {
      success: false,
      error: error.message,
      timestamp: lastRunTime,
    };
    console.error(`[SCHEDULER] Automated leads run failed at ${lastRunTime}:`, error.message);
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
 * @param {string} [options.cronExpr] - Custom cron expression
 * @returns {Object} Current scheduler status
 */
export function initScheduler(options = {}) {
  const scheduleSetting = (options.schedule || process.env.LEADS_SCHEDULE || 'disabled').toLowerCase().trim();
  const customExpr = options.cronExpr || process.env.LEADS_CRON_EXPR;

  stopScheduler();

  let targetExpr = null;
  if (scheduleSetting === 'custom') {
    targetExpr = customExpr || '0 9 * * 1';
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

    activeCronTask = cron.schedule(targetExpr, () => {
      executeScheduledLeadsRun();
    });

    console.log(`[SCHEDULER] Leads scheduler activated: ${scheduleSetting} (${targetExpr})`);
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
      industry: process.env.LEADS_INDUSTRY || 'technology',
      location: process.env.LEADS_LOCATION || 'India',
      query: process.env.LEADS_QUERY || 'top tech startups',
    },
  };
}

export default {
  initScheduler,
  stopScheduler,
  getSchedulerStatus,
  SCHEDULE_PRESETS,
};
