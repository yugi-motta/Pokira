import { analyticsToken } from './analytics-config';

// Check the browser preference before loading Cloudflare's beacon. In particular,
// the exclusion-link visit must never send an analytics event itself.
const exclusionPage = location.pathname === '/analytics/exclude/';
let excluded = exclusionPage;
let saved = false;
try {
  if (exclusionPage) localStorage.setItem('pokira-analytics-excluded', 'true');
  saved = localStorage.getItem('pokira-analytics-excluded') === 'true';
  excluded ||= saved;
} catch { /* Still exclude this visit if storage is blocked. */ }

if (exclusionPage) {
  const status = document.querySelector<HTMLElement>('#analytics-exclusion-status');
  if (status) {
    status.textContent = saved
      ? 'Your visits in this browser will not be counted.'
      : 'This visit is excluded, but your browser could not save the preference. Open this link in your regular browser and try again.';
    status.dataset.state = saved ? 'saved' : 'failed';
  }
}

if (!excluded && location.hostname === 'pokira.pages.dev' && analyticsToken) {
  const beacon = document.createElement('script');
  beacon.type = 'module';
  beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  beacon.dataset.cfBeacon = JSON.stringify({ token: analyticsToken });
  document.body.appendChild(beacon);
}
