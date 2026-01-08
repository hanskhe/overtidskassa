/**
 * Content Script for Overtime Calculator Extension
 *
 * This script runs on the timesheet page and:
 * 1. Finds the overtime hours element
 * 2. Calculates take-home pay using user settings
 * 3. Injects the result inline next to the hours
 *
 * The page uses CSS Modules with dynamic class names, so we use a robust
 * detection strategy based on content and patterns rather than exact classes.
 */

// Browser API compatibility
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Extension marker to prevent duplicate injections
const EXTENSION_MARKER = 'overtime-calculator-injected';

/**
 * Finds the DOM row containing overtime information
 *
 * Strategy:
 * 1. Search within "Nøkkeltall" section for context
 * 2. Use CSS module patterns ([class*="_row_"])
 * 3. Match on text content ("Overtid")
 *
 * @returns {Object|null} - { row: Element, hoursSpan: Element, labelSpan: Element } or null
 */
function findOvertimeRow() {
  // Strategy 1: Find "Nøkkeltall" heading for context
  const headings = Array.from(document.querySelectorAll('h2'));
  const keyFiguresHeading = headings.find(h =>
    h.textContent.trim().includes('Nøkkeltall')
  );

  let searchRoot = document.body;

  if (keyFiguresHeading) {
    // Find the container (parent or ancestor with container class)
    const container = keyFiguresHeading.closest('[class*="_container_"]') ||
                     keyFiguresHeading.parentElement;
    if (container) {
      searchRoot = container;
    }
  }

  // Find all rows within search context (using CSS module pattern)
  const rows = searchRoot.querySelectorAll('[class*="_row_"]');

  for (const row of rows) {
    const spans = row.querySelectorAll('span');

    // Validate structure: must have exactly 2 spans
    if (spans.length === 2) {
      const labelSpan = spans[0];
      const hoursSpan = spans[1];

      // Check if first span contains "Overtid" (case-insensitive)
      if (labelSpan.textContent.toLowerCase().includes('overtid')) {
        return { row, hoursSpan, labelSpan };
      }
    }
  }

  return null;
}

/**
 * Extracts overtime hours from the hours span
 *
 * Text format: "X.X t" or "X.X&nbsp;t"
 *
 * @param {Element} hoursSpan - The span element containing hours
 * @returns {number|null} - Parsed hours or null if invalid
 */
function parseOvertimeHours(hoursSpan) {
  const text = hoursSpan.textContent.trim();
  const match = text.match(/^([\d.,]+)/);

  if (match) {
    // Handle both comma and period as decimal separator
    const normalizedNumber = match[1].replace(',', '.');
    const hours = parseFloat(normalizedNumber);
    return isNaN(hours) ? null : hours;
  }

  return null;
}

/**
 * Injects or updates the overtime pay display
 *
 * Injects inline: "0.0 t" → "0.0 t (3 000 kr)"
 *
 * @param {Element} hoursSpan - The span containing hours
 * @param {number} takeHomePay - Calculated take-home pay in NOK
 */
function injectOvertimePay(hoursSpan, takeHomePay) {
  // Check if already injected (avoid duplicates)
  let payElement = hoursSpan.querySelector(`.${EXTENSION_MARKER}`);

  if (!payElement) {
    // Create new element
    payElement = document.createElement('span');
    payElement.className = EXTENSION_MARKER;
    hoursSpan.appendChild(payElement);
  }

  // Format number with thousand separators (Norwegian style: "3 000")
  const formatted = Math.round(takeHomePay).toLocaleString('nb-NO');

  // Update content
  payElement.textContent = ` (${formatted} kr)`;
}

/**
 * Removes the injected overtime pay element
 *
 * @param {Element} hoursSpan - The span containing hours
 */
function removeOvertimePay(hoursSpan) {
  const existing = hoursSpan.querySelector(`.${EXTENSION_MARKER}`);
  if (existing) {
    existing.remove();
  }
}

/**
 * Main content script execution
 */
async function main() {
  try {
    // Load settings
    const result = await browserAPI.storage.local.get('settings');

    if (!result.settings || !result.settings.yearlySalary || !result.settings.tableNumber) {
      console.warn('Overtime Calculator: Settings not configured. Please open the extension popup to configure.');
      return;
    }

    const { yearlySalary, tableNumber, taxYear = 2026 } = result.settings;

    // Find overtime row
    const overtimeData = findOvertimeRow();

    if (!overtimeData) {
      console.warn('Overtime Calculator: Could not find overtime row on this page');
      return;
    }

    const { hoursSpan } = overtimeData;

    // Parse hours
    const overtimeHours = parseOvertimeHours(hoursSpan);

    if (overtimeHours === null || overtimeHours === 0) {
      // No overtime - remove injected element if it exists
      removeOvertimePay(hoursSpan);
      return;
    }

    // Calculate take-home using the trekktabell module
    // The module should be loaded before this script in manifest.json
    if (typeof calculateOvertimeTakeHome === 'undefined') {
      console.error('Overtime Calculator: trekktabell.js not loaded');
      return;
    }

    const result_calc = calculateOvertimeTakeHome({
      yearlySalary,
      overtimeHours,
      tableNumber,
      taxYear
    });

    // Inject result
    injectOvertimePay(hoursSpan, result_calc.takeHome);

    console.log('Overtime Calculator: Successfully calculated and injected take-home pay', {
      hours: overtimeHours,
      gross: result_calc.grossPay,
      takeHome: result_calc.takeHome,
      effectiveRate: `${(result_calc.effectiveRate * 100).toFixed(1)}%`
    });

  } catch (error) {
    console.error('Overtime Calculator: Error in main execution:', error);
  }
}

/**
 * Initialize the content script
 */
function init() {
  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }

  // Re-run when page content changes (for SPAs and dynamic updates)
  const observer = new MutationObserver(() => {
    main();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Start the extension
init();
