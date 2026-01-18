/**
 * Norwegian Tax Rates and Constants
 *
 * This module contains tax rates, thresholds, and deductions for Norwegian
 * income tax withholding (tabelltrekk) calculations.
 *
 * Source: Skatteetaten (Norwegian Tax Administration)
 * Updated: 2026 tax year
 */

const TAX_RATES = {
  2026: {
    /**
     * Trinnskatt (Bracket Tax) - Applied to personal income
     * Progressive tax with increasing rates at each threshold
     */
    trinnskatt: [
      { threshold: 226100, rate: 0.000 },  // 0% up to 226,100 NOK
      { threshold: 318300, rate: 0.017 },  // 1.7% from 226,101 to 318,300 NOK
      { threshold: 725050, rate: 0.040 },  // 4.0% from 318,301 to 725,050 NOK
      { threshold: 980100, rate: 0.137 },  // 13.7% from 725,051 to 980,100 NOK
      { threshold: 1467200, rate: 0.168 }, // 16.8% from 980,101 to 1,467,200 NOK
      { threshold: Infinity, rate: 0.178 } // 17.8% above 1,467,200 NOK
    ],

    /**
     * Trygdeavgift (National Insurance Contribution)
     * Flat rate on income above threshold
     */
    trygdeavgift: {
      rate: 0.076,      // 7.6% for salary income
      threshold: 69650  // No trygdeavgift below this annual income
    },

    /**
     * Alminnelig Inntekt (General Income Tax)
     * Flat rate on taxable general income
     */
    alminneligInntekt: {
      rate: 0.22  // 22% flat rate
    },

    /**
     * Minstefradrag (Minimum Standard Deduction)
     * Percentage-based deduction with floor and ceiling
     */
    minstefradrag: {
      rate: 0.46,     // 46% of gross income
      min: 4000,      // Minimum deduction: 4,000 NOK
      max: 95700      // Maximum deduction: 95,700 NOK
    },

    /**
     * Personfradrag (Personal Allowance)
     * Fixed amount deducted from taxable income for all taxpayers
     */
    personfradrag: 114210,  // 114,210 NOK

    /**
     * Withholding Period Factor
     * Norwegian employers withhold tax for 10.5 months:
     * - June: No withholding (vacation pay month)
     * - December: Half withholding
     */
    withholdingMonths: 10.5
  }
};

/**
 * Get tax rates for a specific year
 * @param {number} year - Tax year
 * @returns {object} Tax rates object for the year
 * @throws {Error} If tax rates for the year are not available
 */
function getTaxRates(year) {
  if (!TAX_RATES[year]) {
    throw new Error(`Tax rates for year ${year} are not available. Available years: ${Object.keys(TAX_RATES).join(', ')}`);
  }
  return TAX_RATES[year];
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TAX_RATES, getTaxRates };
}
