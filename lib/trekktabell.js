/**
 * Norwegian Tax Withholding (Tabelltrekk) Calculator
 *
 * This module implements the algorithmic calculation of Norwegian income tax
 * withholding (tabelltrekk) based on the official Skatteetaten methodology.
 *
 * The calculation is simplified but follows the core principles:
 * - Trinnskatt (bracket tax) on personal income
 * - Trygdeavgift (national insurance) on personal income
 * - Alminnelig inntekt (general income tax) after deductions
 * - Minstefradrag (minimum standard deduction)
 * - Personfradrag (personal allowance)
 * - Table number adjustments (fradrag/tillegg)
 *
 * Note: This is an ESTIMATE. Actual withholding may vary slightly due to
 * rounding, timing, and other factors. Always verify with official sources.
 */

// Import tax rates for Node.js environment
// In browser, tax-rates.js is loaded first via manifest and creates global TAX_RATES
let TAX_RATES_DATA;
let getTaxRatesFunc;
if (typeof TAX_RATES === 'undefined' && typeof require !== 'undefined') {
  // Node.js: Load module with different variable names to avoid conflicts
  const taxRatesModule = require('./tax-rates.js');
  TAX_RATES_DATA = taxRatesModule.TAX_RATES;
  getTaxRatesFunc = taxRatesModule.getTaxRates;
} else {
  // Browser: Use the globally loaded TAX_RATES and getTaxRates
  TAX_RATES_DATA = typeof TAX_RATES !== 'undefined' ? TAX_RATES : null;
  getTaxRatesFunc = typeof getTaxRates !== 'undefined' ? getTaxRates : null;
}

/**
 * Parse a Norwegian tax table number to extract deduction/addition info
 *
 * Table number format (2025+):
 * - 8000-8400: Fradragstabeller (deduction tables)
 *   Last 3 digits × 1000 = deduction amount in NOK
 *   Example: 8115 = 115,000 NOK in deductions
 *
 * - 9010-9400: Tilleggstabeller (addition tables)
 *   Last 3 digits × 1000 = addition amount in NOK
 *   Example: 9050 = 50,000 NOK in additions
 *
 * @param {number} tableNumber - The tax table number (e.g., 8115)
 * @returns {object|null} - { type: 'fradrag'|'tillegg', amount: number } or null
 */
function parseTableNumber(tableNumber) {
  if (tableNumber >= 8000 && tableNumber <= 8400) {
    return {
      type: 'fradrag',
      amount: (tableNumber - 8000) * 1000
    };
  } else if (tableNumber >= 9010 && tableNumber <= 9400) {
    return {
      type: 'tillegg',
      amount: (tableNumber - 9000) * 1000
    };
  }

  // Special tables (7150, 7160, etc.) not supported in v1
  return null;
}

/**
 * Calculate trinnskatt (bracket tax) for annual income
 *
 * Progressive tax system where each bracket has its own rate.
 * Only the income within each bracket is taxed at that bracket's rate.
 *
 * @param {number} annualIncome - Annual gross income in NOK
 * @param {Array} brackets - Array of bracket objects with threshold and rate
 * @returns {number} Total trinnskatt amount in NOK
 */
function calculateTrinnskatt(annualIncome, brackets) {
  let tax = 0;
  let previousThreshold = 0;

  for (const bracket of brackets) {
    // Stop if income doesn't reach this bracket
    if (annualIncome <= previousThreshold) break;

    // Calculate taxable amount in this bracket
    const taxableInBracket = Math.min(annualIncome, bracket.threshold) - previousThreshold;

    // Add tax for this bracket
    tax += Math.max(0, taxableInBracket) * bracket.rate;

    previousThreshold = bracket.threshold;
  }

  return tax;
}

/**
 * Calculate monthly withholding for a given gross monthly income
 *
 * This is the core tabelltrekk calculation that determines how much tax
 * should be withheld from a monthly salary payment.
 *
 * @param {number} monthlyGross - Gross monthly salary in NOK
 * @param {number} tableNumber - Skattetabell number (e.g., 8115)
 * @param {number} taxYear - Tax year (default: 2026)
 * @returns {number} Monthly withholding amount in NOK
 */
function calculateMonthlyWithholding(monthlyGross, tableNumber, taxYear = 2026) {
  // Get tax rates for the specified year
  const rates = getTaxRatesFunc ? getTaxRatesFunc(taxYear) : TAX_RATES_DATA[taxYear];
  if (!rates) {
    throw new Error(`Tax rates for year ${taxYear} are not available`);
  }

  // Parse table number
  const tableInfo = parseTableNumber(tableNumber);
  if (!tableInfo) {
    throw new Error(`Invalid or unsupported table number: ${tableNumber}`);
  }

  // Convert monthly to annual income
  const annualGross = monthlyGross * 12;

  // 1. Calculate Minstefradrag (minimum standard deduction)
  // 46% of income, minimum 4,000 NOK, maximum 95,700 NOK
  const minstefradrag = Math.min(
    Math.max(annualGross * rates.minstefradrag.rate, rates.minstefradrag.min),
    rates.minstefradrag.max
  );

  // 2. Calculate table adjustment
  // Fradrag (deduction) reduces the tax base (negative adjustment)
  // Tillegg (addition) increases the tax base (positive adjustment)
  const tableAdjustment = tableInfo.type === 'fradrag'
    ? -tableInfo.amount
    : tableInfo.amount;

  // 3. Calculate Alminnelig Inntekt (taxable general income)
  // This is the income subject to the 22% flat tax
  // Formula: gross - minstefradrag - personfradrag + tableAdjustment
  const alminneligInntekt = Math.max(0,
    annualGross - minstefradrag - rates.personfradrag + tableAdjustment
  );

  // 4. Calculate individual tax components

  // Trinnskatt: Progressive bracket tax on gross personal income
  const trinnskatt = calculateTrinnskatt(annualGross, rates.trinnskatt);

  // Trygdeavgift: 7.6% national insurance on income above threshold
  const trygdeavgift = annualGross > rates.trygdeavgift.threshold
    ? annualGross * rates.trygdeavgift.rate
    : 0;

  // Inntektsskatt: 22% flat tax on alminnelig inntekt
  const inntektsskatt = alminneligInntekt * rates.alminneligInntekt.rate;

  // 5. Sum up total annual tax
  const annualTax = trinnskatt + trygdeavgift + inntektsskatt;

  // 6. Convert to monthly withholding
  // Norwegian employers withhold for 10.5 months (not 12)
  // because of June (no withholding) and December (half withholding)
  const monthlyWithholding = annualTax / rates.withholdingMonths;

  return monthlyWithholding;
}

/**
 * Calculate take-home pay for overtime hours
 *
 * This is the main function for the extension. It calculates:
 * - Gross overtime pay (hours × hourly rate × 1.4)
 * - Tax withheld on overtime (marginal withholding)
 * - Net take-home overtime pay
 * - Effective marginal tax rate
 *
 * The key insight: We calculate the DIFFERENCE in withholding between
 * (normal salary + overtime) and (normal salary alone). This gives us
 * the marginal tax on the overtime portion.
 *
 * @param {object} params - Calculation parameters
 * @param {number} params.yearlySalary - Annual salary in NOK
 * @param {number} params.overtimeHours - Number of overtime hours
 * @param {number} params.tableNumber - Skattetabell number (e.g., 8115)
 * @param {number} params.taxYear - Tax year (default: 2026)
 * @returns {object} Breakdown of overtime compensation
 */
function calculateOvertimeTakeHome({ yearlySalary, overtimeHours, tableNumber, taxYear = 2026 }) {
  // Constants
  const HOURS_PER_YEAR = 1950;  // Standard Norwegian work year
  const OVERTIME_MULTIPLIER = 1.4;  // 40% overtime premium

  // Calculate hourly rates
  const hourlyRate = yearlySalary / HOURS_PER_YEAR;
  const overtimeRate = hourlyRate * OVERTIME_MULTIPLIER;

  // Calculate gross overtime pay
  const grossPay = overtimeHours * overtimeRate;

  // Calculate normal monthly salary
  const normalMonthly = yearlySalary / 12;

  // Calculate combined monthly (normal + overtime)
  const combinedMonthly = normalMonthly + grossPay;

  // Calculate withholding on normal salary alone
  const withholdingNormal = calculateMonthlyWithholding(normalMonthly, tableNumber, taxYear);

  // Calculate withholding on combined (normal + overtime)
  const withholdingCombined = calculateMonthlyWithholding(combinedMonthly, tableNumber, taxYear);

  // The marginal withholding on overtime is the difference
  const withholdingOnOvertime = withholdingCombined - withholdingNormal;

  // Calculate net take-home from overtime
  const takeHome = grossPay - withholdingOnOvertime;

  // Calculate effective marginal tax rate on overtime
  const effectiveRate = grossPay > 0 ? withholdingOnOvertime / grossPay : 0;

  const roundedHourlyRate = Math.round(hourlyRate * 100) / 100;
  const roundedOvertimeRate = Math.round(overtimeRate * 100) / 100;

  return {
    grossPay: Math.round(grossPay * 100) / 100,
    withholding: Math.round(withholdingOnOvertime * 100) / 100,
    takeHome: Math.round(takeHome * 100) / 100,
    effectiveRate: Math.round(effectiveRate * 1000) / 1000,
    hourlyRate: roundedHourlyRate,
    overtimeRate: roundedOvertimeRate
  };
}

/**
 * Format a number as Norwegian currency (NOK)
 *
 * @param {number} amount - Amount in NOK
 * @param {boolean} includeDecimals - Whether to include øre (default: false)
 * @returns {string} Formatted currency string
 */
function formatNOK(amount, includeDecimals = false) {
  const rounded = includeDecimals ? amount : Math.round(amount);
  const formatted = new Intl.NumberFormat('nb-NO', {
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0
  }).format(rounded);

  return `kr ${formatted}`;
}

/**
 * Validate calculation parameters
 *
 * @param {object} params - Parameters to validate
 * @returns {object} { valid: boolean, errors: string[] }
 */
function validateParameters({ yearlySalary, overtimeHours, tableNumber, taxYear }) {
  const errors = [];

  if (yearlySalary === undefined || yearlySalary === null || typeof yearlySalary !== 'number') {
    errors.push('Yearly salary must be provided as a number');
  } else if (yearlySalary < 100000 || yearlySalary > 5000000) {
    errors.push('Yearly salary must be between 100,000 and 5,000,000 NOK');
  }

  if (overtimeHours === undefined || overtimeHours === null || overtimeHours < 0) {
    errors.push('Overtime hours must be zero or a positive number');
  }

  if (overtimeHours > 200) {
    errors.push('Overtime hours seems unusually high (>200 hours)');
  }

  const tableInfo = parseTableNumber(tableNumber);
  if (!tableInfo) {
    errors.push('Invalid table number. Must be 8000-8400 or 9010-9400');
  }

  if (taxYear && !TAX_RATES_DATA[taxYear]) {
    errors.push(`Tax rates for year ${taxYear} are not available`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseTableNumber,
    calculateTrinnskatt,
    calculateMonthlyWithholding,
    calculateOvertimeTakeHome,
    formatNOK,
    validateParameters
  };
}
