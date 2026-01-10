/**
 * Popup Script for Overtime Calculator Extension
 *
 * Handles user settings input, validation, and storage.
 */

// Browser API compatibility (defensive detection)
const browserAPI = (() => {
  if (typeof browser !== 'undefined' && browser.storage) return browser;
  if (typeof chrome !== 'undefined' && chrome.storage) return chrome;
  console.error('Overtime Calculator: No browser API available');
  return null;
})();

// DOM elements
const form = document.getElementById('settingsForm');
const yearlySalaryInput = document.getElementById('yearlySalary');
const tableNumberInput = document.getElementById('tableNumber');
const taxYearSelect = document.getElementById('taxYear');
const saveButton = document.getElementById('saveButton');
const successMessage = document.getElementById('successMessage');
const salaryError = document.getElementById('salaryError');
const tableError = document.getElementById('tableError');

/**
 * Validate yearly salary
 * @param {number} salary - Yearly salary in NOK
 * @returns {string|null} Error message or null if valid
 */
function validateSalary(salary) {
  if (!salary || isNaN(salary)) {
    return 'Vennligst oppgi en gyldig årslønn';
  }

  if (salary < 100000) {
    return 'Årslønnen må være minst 100 000 kr';
  }

  if (salary > 5000000) {
    return 'Årslønnen må være maks 5 000 000 kr';
  }

  return null;
}

/**
 * Validate table number
 * @param {number} tableNum - Tax table number
 * @returns {string|null} Error message or null if valid
 */
function validateTableNumber(tableNum) {
  if (!tableNum || isNaN(tableNum)) {
    return 'Vennligst oppgi et gyldig tabelltall';
  }

  // Check if it's a valid fradragstabell (8000-8400) or tilleggstabell (9010-9400)
  const isFradrag = tableNum >= 8000 && tableNum <= 8400;
  const isTillegg = tableNum >= 9010 && tableNum <= 9400;

  if (!isFradrag && !isTillegg) {
    return 'Tabelltallet må være mellom 8000-8400 eller 9010-9400';
  }

  return null;
}

/**
 * Show error message for a field
 * @param {HTMLElement} errorElement - Error message element
 * @param {HTMLInputElement} inputElement - Input field
 * @param {string} message - Error message
 */
function showError(errorElement, inputElement, message) {
  errorElement.textContent = message;
  inputElement.classList.add('error');
}

/**
 * Clear error message for a field
 * @param {HTMLElement} errorElement - Error message element
 * @param {HTMLInputElement} inputElement - Input field
 */
function clearError(errorElement, inputElement) {
  errorElement.textContent = '';
  inputElement.classList.remove('error');
}

/**
 * Show success message
 */
function showSuccess() {
  successMessage.classList.remove('hidden');
  setTimeout(() => {
    successMessage.classList.add('hidden');
  }, 3000);
}

/**
 * Load saved settings from storage
 */
async function loadSettings() {
  try {
    const result = await browserAPI.storage.local.get('settings');

    if (result.settings) {
      const { yearlySalary, tableNumber, taxYear } = result.settings;

      if (yearlySalary) {
        yearlySalaryInput.value = yearlySalary;
      }

      if (tableNumber) {
        tableNumberInput.value = tableNumber;
      }

      if (taxYear) {
        taxYearSelect.value = taxYear;
      }
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

/**
 * Save settings to storage
 * @param {object} settings - Settings object
 */
async function saveSettings(settings) {
  try {
    await browserAPI.storage.local.set({ settings });
    showSuccess();
  } catch (error) {
    console.error('Error saving settings:', error);
    alert('Kunne ikke lagre innstillinger. Vennligst prøv igjen.');
  }
}

/**
 * Handle form submission
 * @param {Event} event - Submit event
 */
async function handleSubmit(event) {
  event.preventDefault();

  // Get form values
  const yearlySalary = parseInt(yearlySalaryInput.value, 10);
  const tableNumber = parseInt(tableNumberInput.value, 10);
  const taxYear = parseInt(taxYearSelect.value, 10);

  // Clear previous errors
  clearError(salaryError, yearlySalaryInput);
  clearError(tableError, tableNumberInput);

  // Validate inputs
  let hasErrors = false;

  const salaryValidation = validateSalary(yearlySalary);
  if (salaryValidation) {
    showError(salaryError, yearlySalaryInput, salaryValidation);
    hasErrors = true;
  }

  const tableValidation = validateTableNumber(tableNumber);
  if (tableValidation) {
    showError(tableError, tableNumberInput, tableValidation);
    hasErrors = true;
  }

  // If validation fails, stop here
  if (hasErrors) {
    return;
  }

  // Disable form while saving
  saveButton.disabled = true;
  saveButton.textContent = 'Lagrer...';

  // Save settings
  await saveSettings({
    yearlySalary,
    tableNumber,
    taxYear
  });

  // Re-enable form
  saveButton.disabled = false;
  saveButton.textContent = 'Lagre innstillinger';
}

/**
 * Add real-time validation on input
 */
function setupRealtimeValidation() {
  yearlySalaryInput.addEventListener('input', () => {
    const salary = parseInt(yearlySalaryInput.value, 10);
    const error = validateSalary(salary);

    if (error && yearlySalaryInput.value !== '') {
      showError(salaryError, yearlySalaryInput, error);
    } else {
      clearError(salaryError, yearlySalaryInput);
    }
  });

  tableNumberInput.addEventListener('input', () => {
    const tableNum = parseInt(tableNumberInput.value, 10);
    const error = validateTableNumber(tableNum);

    if (error && tableNumberInput.value !== '') {
      showError(tableError, tableNumberInput, error);
    } else {
      clearError(tableError, tableNumberInput);
    }
  });
}

/**
 * Initialize popup
 */
function init() {
  // Load saved settings
  loadSettings();

  // Setup event listeners
  form.addEventListener('submit', handleSubmit);
  setupRealtimeValidation();
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
