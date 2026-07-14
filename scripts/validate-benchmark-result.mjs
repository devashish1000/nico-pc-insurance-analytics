#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/validate-benchmark-result.mjs PATH');
  process.exit(2);
}

const result = JSON.parse(readFileSync(resolve(file), 'utf8'));
const errors = [];
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const requireObject = (key) => {
  if (!isObject(result[key])) errors.push(`${key} must be an object`);
};

if (result.schemaVersion !== '1.0.0') errors.push('schemaVersion must be 1.0.0');
for (const key of ['benchmark', 'environment', 'database', 'timing', 'pipeline', 'loadMetrics', 'queryLatency', 'explainAnalyze', 'counts', 'quality', 'thresholds']) requireObject(key);
if (!Array.isArray(result.stageDurations)) errors.push('stageDurations must be an array');
if (typeof result.createdAt !== 'string' || Number.isNaN(Date.parse(result.createdAt))) errors.push('createdAt must be an ISO timestamp');
if (typeof result.passed !== 'boolean') errors.push('passed must be boolean');
if (!Array.isArray(result.failures) || result.failures.some((value) => typeof value !== 'string')) errors.push('failures must be a string array');

if (isObject(result.benchmark)) {
  if (!['smoke', 'primary', 'extended'].includes(result.benchmark.mode)) errors.push('benchmark.mode is invalid');
  for (const key of ['seed', 'premiumRows', 'claimRows', 'totalRows']) {
    if (!Number.isInteger(result.benchmark[key])) errors.push(`benchmark.${key} must be an integer`);
  }
  if (result.benchmark.premiumRows + result.benchmark.claimRows !== result.benchmark.totalRows) errors.push('benchmark row components must equal totalRows');
}

if (isObject(result.timing)) {
  for (const key of ['seedMs', 'pipelineMs', 'totalMs']) {
    if (!Number.isInteger(result.timing[key]) || result.timing[key] < 0) errors.push(`timing.${key} must be a non-negative integer`);
  }
  if (typeof result.timing.rowsPerSecond !== 'number' || result.timing.rowsPerSecond < 0) errors.push('timing.rowsPerSecond must be non-negative');
}

for (const section of ['counts', 'quality']) {
  if (!isObject(result[section])) continue;
  for (const [key, value] of Object.entries(result[section])) {
    if (!Number.isInteger(value) || value < 0) errors.push(`${section}.${key} must be a non-negative integer`);
  }
}

if (isObject(result.loadMetrics)) {
  for (const [key, value] of Object.entries(result.loadMetrics)) {
    if (!Number.isInteger(value) || value < 0) errors.push(`loadMetrics.${key} must be a non-negative integer`);
  }
}
if (isObject(result.queryLatency)) {
  if (typeof result.queryLatency.p50Ms !== 'number' || result.queryLatency.p50Ms < 0) errors.push('queryLatency.p50Ms must be non-negative');
  if (typeof result.queryLatency.p95Ms !== 'number' || result.queryLatency.p95Ms < 0) errors.push('queryLatency.p95Ms must be non-negative');
  if (!Array.isArray(result.queryLatency.queries) || result.queryLatency.queries.length === 0) errors.push('queryLatency.queries must be a non-empty array');
}
if (isObject(result.explainAnalyze)) {
  for (const name of ['portfolioKpis', 'lobPerformance', 'pipelineEvidence']) {
    if (!Array.isArray(result.explainAnalyze[name]) || result.explainAnalyze[name].length === 0) errors.push(`explainAnalyze.${name} must be a non-empty plan array`);
  }
}

if (result.passed === true && Array.isArray(result.failures) && result.failures.length !== 0) errors.push('passing result cannot contain failures');
if (errors.length > 0) {
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Valid benchmark result: ${resolve(file)}`);
