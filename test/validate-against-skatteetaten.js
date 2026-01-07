/**
 * Validation Script for Skatteetaten Calculator
 *
 * This script generates test cases that can be manually verified against
 * the official Skatteetaten withholding calculator:
 * https://tabellkort.app.skatteetaten.no/
 *
 * Usage: node test/validate-against-skatteetaten.js
 */

const {
  calculateMonthlyWithholding,
  calculateOvertimeTakeHome,
  formatNOK
} = require('../lib/trekktabell.js');

console.log('=============================================================================');
console.log('VALIDATION AGAINST SKATTEETATEN CALCULATOR');
console.log('=============================================================================\n');
console.log('Compare these results with the official calculator at:');
console.log('https://tabellkort.app.skatteetaten.no/\n');
console.log('Instructions:');
console.log('1. Open the Skatteetaten calculator in your browser');
console.log('2. Select year: 2026');
console.log('3. Select "Månedslønn" (monthly salary)');
console.log('4. Enter the monthly gross and table number from each test case below');
console.log('5. Compare the calculated withholding with our result');
console.log('6. Expected accuracy: within ±2% (±50-200 NOK for typical salaries)\n');
console.log('=============================================================================\n');

// Test cases covering various salary levels and table numbers
const testCases = [
  {
    description: 'Low salary, standard deduction table',
    yearlySalary: 400000,
    tableNumber: 8100,
    overtimeHours: 8
  },
  {
    description: 'Medium salary, standard deduction table',
    yearlySalary: 600000,
    tableNumber: 8100,
    overtimeHours: 10
  },
  {
    description: 'Medium-high salary, moderate deduction',
    yearlySalary: 750000,
    tableNumber: 8115,
    overtimeHours: 12
  },
  {
    description: 'High salary, moderate deduction',
    yearlySalary: 900000,
    tableNumber: 8115,
    overtimeHours: 10
  },
  {
    description: 'Very high salary, high deduction',
    yearlySalary: 1200000,
    tableNumber: 8150,
    overtimeHours: 15
  },
  {
    description: 'Medium salary, addition table (extra income)',
    yearlySalary: 700000,
    tableNumber: 9050,
    overtimeHours: 10
  },
  {
    description: 'High salary, addition table',
    yearlySalary: 1000000,
    tableNumber: 9100,
    overtimeHours: 10
  }
];

let caseNumber = 1;

testCases.forEach(testCase => {
  console.log(`TEST CASE ${caseNumber}: ${testCase.description}`);
  console.log('─────────────────────────────────────────────────────────────────────────────');

  const { yearlySalary, tableNumber, overtimeHours } = testCase;
  const monthlyGross = yearlySalary / 12;

  // Calculate normal monthly withholding
  const normalWithholding = calculateMonthlyWithholding(monthlyGross, tableNumber, 2026);

  // Calculate overtime scenario
  const overtimeResult = calculateOvertimeTakeHome({
    yearlySalary,
    overtimeHours,
    tableNumber,
    taxYear: 2026
  });

  const combinedGross = monthlyGross + overtimeResult.grossPay;
  const combinedWithholding = calculateMonthlyWithholding(combinedGross, tableNumber, 2026);

  console.log(`\nInput Parameters:`);
  console.log(`  Yearly Salary:     ${formatNOK(yearlySalary)}`);
  console.log(`  Table Number:      ${tableNumber}`);
  console.log(`  Tax Year:          2026`);
  console.log(`  Overtime Hours:    ${overtimeHours} hours`);

  console.log(`\nMonthly Withholding (Normal Salary):`);
  console.log(`  Monthly Gross:     ${formatNOK(monthlyGross, true)}`);
  console.log(`  Withholding:       ${formatNOK(normalWithholding, true)}`);
  console.log(`  Effective Rate:    ${((normalWithholding / monthlyGross) * 100).toFixed(1)}%`);
  console.log(`  Net Pay:           ${formatNOK(monthlyGross - normalWithholding, true)}`);

  console.log(`\nMonthly Withholding (With Overtime):`);
  console.log(`  Monthly Gross:     ${formatNOK(combinedGross, true)} (includes overtime)`);
  console.log(`  Withholding:       ${formatNOK(combinedWithholding, true)}`);
  console.log(`  Effective Rate:    ${((combinedWithholding / combinedGross) * 100).toFixed(1)}%`);
  console.log(`  Net Pay:           ${formatNOK(combinedGross - combinedWithholding, true)}`);

  console.log(`\nOvertime Breakdown:`);
  console.log(`  Hourly Rate:       ${formatNOK(overtimeResult.hourlyRate, true)}`);
  console.log(`  Overtime Rate:     ${formatNOK(overtimeResult.overtimeRate, true)} (×1.4)`);
  console.log(`  Gross Overtime:    ${formatNOK(overtimeResult.grossPay, true)}`);
  console.log(`  Tax on Overtime:   ${formatNOK(overtimeResult.withholding, true)}`);
  console.log(`  NET TAKE-HOME:     ${formatNOK(overtimeResult.takeHome, true)} ← Main result`);
  console.log(`  Marginal Tax Rate: ${(overtimeResult.effectiveRate * 100).toFixed(1)}%`);

  console.log(`\nTo verify on Skatteetaten calculator:`);
  console.log(`  1. Calculate withholding for monthly gross: ${formatNOK(monthlyGross, false)}`);
  console.log(`     Expected result: ~${formatNOK(normalWithholding, false)} (±2%)`);
  console.log(`  2. Calculate withholding for combined gross: ${formatNOK(combinedGross, false)}`);
  console.log(`     Expected result: ~${formatNOK(combinedWithholding, false)} (±2%)`);
  console.log(`  3. Difference should be: ~${formatNOK(overtimeResult.withholding, false)}`);

  console.log('\n=============================================================================\n');
  caseNumber++;
});

console.log('SUMMARY OF EXPECTATIONS:');
console.log('─────────────────────────────────────────────────────────────────────────────');
console.log('Expected accuracy: ±2% of withholding amount');
console.log('');
console.log('Common sources of minor discrepancies:');
console.log('  - Rounding differences (official tables round to nearest krone)');
console.log('  - Minstefradrag calculation edge cases');
console.log('  - Order of operations in complex scenarios');
console.log('');
console.log('These differences are acceptable for the stated goal of providing');
console.log('a rough estimate of take-home overtime pay.');
console.log('=============================================================================\n');
