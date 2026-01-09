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

// State management
let currentObserver = null;
let debounceTimer = null;
let lastKnownHours = null;
let cachedSettings = null;

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
 * Updates the overtime calculation and display
 *
 * @param {Element} hoursSpan - The span element containing hours
 * @param {Object} settings - User settings { yearlySalary, tableNumber, taxYear }
 */
function updateOvertimeDisplay(hoursSpan, settings) {
  try {
    // Parse hours
    const overtimeHours = parseOvertimeHours(hoursSpan);

    // Check if hours actually changed
    if (overtimeHours === lastKnownHours) {
      return; // No change, skip recalculation
    }

    lastKnownHours = overtimeHours;

    if (overtimeHours === null || overtimeHours === 0) {
      // No overtime - remove injected element if it exists
      removeOvertimePay(hoursSpan);
      console.log('Overtime Calculator: No overtime hours, display removed');
      return;
    }

    // Calculate take-home using the trekktabell module
    if (typeof calculateOvertimeTakeHome === 'undefined') {
      console.error('Overtime Calculator: trekktabell.js not loaded');
      return;
    }

    const result_calc = calculateOvertimeTakeHome({
      yearlySalary: settings.yearlySalary,
      overtimeHours,
      tableNumber: settings.tableNumber,
      taxYear: settings.taxYear
    });

    // Inject/update result
    injectOvertimePay(hoursSpan, result_calc.takeHome);

    console.log('Overtime Calculator: Updated take-home pay', {
      hours: overtimeHours,
      gross: result_calc.grossPay,
      takeHome: result_calc.takeHome,
      effectiveRate: `${(result_calc.effectiveRate * 100).toFixed(1)}%`
    });

  } catch (error) {
    console.error('Overtime Calculator: Error updating display:', error);
  }
}

/**
 * Sets up a targeted MutationObserver for the hoursSpan element
 *
 * @param {Element} hoursSpan - The span element to observe
 * @param {Object} settings - User settings
 */
function observeHoursSpan(hoursSpan, settings) {
  // Clean up existing observer
  if (currentObserver) {
    currentObserver.disconnect();
  }

  // Create new observer that watches specifically for text changes
  currentObserver = new MutationObserver(() => {
    // Debounce updates to avoid excessive recalculations
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      updateOvertimeDisplay(hoursSpan, settings);
    }, 100); // 100ms debounce
  });

  // Observe the hoursSpan for text content changes
  currentObserver.observe(hoursSpan, {
    characterData: true,
    childList: true,
    subtree: true
  });

  console.log('Overtime Calculator: Now observing overtime hours for live updates');
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

    const settings = {
      yearlySalary: result.settings.yearlySalary,
      tableNumber: result.settings.tableNumber,
      taxYear: result.settings.taxYear || 2026
    };

    // Cache settings for live updates
    cachedSettings = settings;

    // Find overtime row
    const overtimeData = findOvertimeRow();

    if (!overtimeData) {
      console.warn('Overtime Calculator: Could not find overtime row on this page');
      return;
    }

    const { hoursSpan } = overtimeData;

    // Initial update
    updateOvertimeDisplay(hoursSpan, settings);

    // Set up live observation of the hoursSpan
    observeHoursSpan(hoursSpan, settings);

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

  // Listen for settings changes to update live
  browserAPI.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) {
      console.log('Overtime Calculator: Settings updated, recalculating...');
      main(); // Re-initialize with new settings
    }
  });
}

// Start the extension
init();
