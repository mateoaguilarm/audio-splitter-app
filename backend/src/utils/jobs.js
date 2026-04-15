'use strict';

/**
 * Lightweight in-memory job store.
 * Perfectly fine for a single-instance service.
 * Swap for Redis/DB when scaling horizontally.
 *
 * @typedef {'processing'|'done'|'error'} JobStatus
 * @typedef {{status: JobStatus, segments: Array|null, error: string|null, createdAt: number}} Job
 */

const jobs = new Map();

function createJob(jobId) {
  jobs.set(jobId, {
    status: 'processing',
    segments: null,
    error: null,
    createdAt: Date.now(),
  });
}

function updateJob(jobId, updates) {
  const job = jobs.get(jobId);
  if (job) jobs.set(jobId, { ...job, ...updates });
}

/** @returns {Job|null} */
function getJob(jobId) {
  return jobs.get(jobId) ?? null;
}

// Every 30 min, remove jobs older than 2 hours
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}, 30 * 60 * 1000);

module.exports = { createJob, updateJob, getJob };
