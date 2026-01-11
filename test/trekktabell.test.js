/**
 * Unit Tests for Norwegian Tax Withholding Calculator
 *
 * These tests verify the accuracy of the tabelltrekk calculation algorithm
 * against known values and edge cases.
 *
 * Run with: node test/trekktabell.test.js
 */

const {
  parseTableNumber,
  calculateTrinnskatt,
  calculateMonthlyWithholding,
  calculateAnnualTax,
  calculateOvertimeTakeHome,
  formatNOK,
  validateParameters
} = require('../lib/trekktabell.js');

const { TAX_RATES } = require('../lib/tax-rates.js');

// Simple test framework
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`✓ ${message}`);
  } else {
    testsFailed++;
    console.error(`✗ ${message}`);
  }
}

function assertApprox(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  const withinTolerance = diff <= tolerance;
  const errorPercent = expected !== 0 ? ((diff / expected) * 100).toFixed(2) : 0;

  if (withinTolerance) {
    testsPassed++;
    console.log(`✓ ${message} (${actual} ≈ ${expected}, diff: ${diff.toFixed(2)})`);
  } else {
    testsFailed++;
    console.error(`✗ ${message} (${actual} vs ${expected}, diff: ${diff.toFixed(2)}, ${errorPercent}% error)`);
  }
}

function runTests() {
  console.log('\n=== Testing Tax Withholding Calculator ===\n');

  // Test 1: parseTableNumber
  console.log('--- Test parseTableNumber ---');
  const table8115 = parseTableNumber(8115);
  assert(table8115.type === 'fradrag', 'Table 8115 should be fradrag type');
  assert(table8115.amount === 115000, 'Table 8115 should have 115,000 NOK deduction');

  const table9050 = parseTableNumber(9050);
  assert(table9050.type === 'tillegg', 'Table 9050 should be tillegg type');
  assert(table9050.amount === 50000, 'Table 9050 should have 50,000 NOK addition');

  const table7150 = parseTableNumber(7150);
  assert(table7150 === null, 'Table 7150 should not be supported (special table)');

  // Test 2: calculateTrinnskatt
  console.log('\n--- Test calculateTrinnskatt ---');
  const rates2026 = TAX_RATES[2026];

  // Test at exact thresholds
  const trinnskatt0 = calculateTrinnskatt(200000, rates2026.trinnskatt);
  assert(trinnskatt0 === 0, 'No trinnskatt below 226,100 NOK');

  const trinnskatt1 = calculateTrinnskatt(226100, rates2026.trinnskatt);
  assert(trinnskatt1 === 0, 'No trinnskatt at exactly 226,100 NOK');

  // Test in first bracket (1.7%)
  const trinnskatt2 = calculateTrinnskatt(300000, rates2026.trinnskatt);
  const expected2 = (300000 - 226100) * 0.017;
  assertApprox(trinnskatt2, expected2, 1, 'Trinnskatt for 300,000 NOK (1.7% bracket)');

  // Test crossing multiple brackets
  const trinnskatt3 = calculateTrinnskatt(800000, rates2026.trinnskatt);
  const expected3 =
    (318300 - 226100) * 0.017 +  // Bracket 1
    (725050 - 318300) * 0.040 +  // Bracket 2
    (800000 - 725050) * 0.137;   // Bracket 3
  assertApprox(trinnskatt3, expected3, 1, 'Trinnskatt for 800,000 NOK (multiple brackets)');

  // Test 3: calculateMonthlyWithholding
  console.log('\n--- Test calculateMonthlyWithholding ---');

  // Test case 1: 600,000 yearly salary, table 8100
  const monthly1 = 600000 / 12;
  const withholding1 = calculateMonthlyWithholding(monthly1, 8100, 2026);
  console.log(`  Monthly withholding for 50,000 NOK/month (600k/year, table 8100): ${formatNOK(withholding1, true)}`);
  assert(withholding1 > 0, 'Withholding should be positive');
  assert(withholding1 < monthly1, 'Withholding should be less than gross salary');

  // Test case 2: 900,000 yearly salary, table 8115
  const monthly2 = 900000 / 12;
  const withholding2 = calculateMonthlyWithholding(monthly2, 8115, 2026);
  console.log(`  Monthly withholding for 75,000 NOK/month (900k/year, table 8115): ${formatNOK(withholding2, true)}`);
  assert(withholding2 > withholding1, 'Higher salary should have higher withholding');

  // Test case 3: Fradrag vs Tillegg - same income, different table
  const monthly3 = 700000 / 12;
  const withholdingFradrag = calculateMonthlyWithholding(monthly3, 8050, 2026);
  const withholdingTillegg = calculateMonthlyWithholding(monthly3, 9050, 2026);
  console.log(`  Table 8050 (fradrag): ${formatNOK(withholdingFradrag, true)}`);
  console.log(`  Table 9050 (tillegg): ${formatNOK(withholdingTillegg, true)}`);
  assert(withholdingFradrag < withholdingTillegg, 'Fradrag table should have lower withholding than tillegg');

  // Test 4: calculateOvertimeTakeHome
  console.log('\n--- Test calculateOvertimeTakeHome ---');

  // Test case: 900,000 yearly, 10 overtime hours, table 8115
  const overtime1 = calculateOvertimeTakeHome({
    yearlySalary: 900000,
    overtimeHours: 10,
    tableNumber: 8115,
    taxYear: 2026
  });

  console.log(`  Overtime calculation for 10 hours (900k/year, table 8115):`);
  console.log(`    Hourly rate: ${formatNOK(overtime1.hourlyRate, true)}`);
  console.log(`    Overtime rate (×1.4): ${formatNOK(overtime1.overtimeRate, true)}`);
  console.log(`    Gross pay: ${formatNOK(overtime1.grossPay, true)}`);
  console.log(`    Actual tax: ${formatNOK(overtime1.actualTax, true)}`);
  console.log(`    Take-home (actual): ${formatNOK(overtime1.takeHome, true)}`);
  console.log(`    Effective rate (actual): ${(overtime1.effectiveRate * 100).toFixed(1)}%`);
  console.log(`    Withholding: ${formatNOK(overtime1.withholding, true)}`);
  console.log(`    Take-home (withholding): ${formatNOK(overtime1.takeHomeWithholding, true)}`);
  console.log(`    Effective rate (withholding): ${(overtime1.effectiveRateWithholding * 100).toFixed(1)}%`);
  console.log(`    Estimated refund: ${formatNOK(overtime1.estimatedRefund, true)}`);

  assert(overtime1.hourlyRate > 0, 'Hourly rate should be positive');
  // Account for rounding: compare rounded values
  const expectedOvertimeRate = Math.round(overtime1.hourlyRate * 1.4 * 100) / 100;
  assertApprox(overtime1.overtimeRate, expectedOvertimeRate, 0.01, 'Overtime rate should be 1.4× hourly rate');
  assert(overtime1.grossPay > 0, 'Gross pay should be positive');
  assert(overtime1.actualTax > 0, 'Actual tax should be positive');
  assert(overtime1.withholding > 0, 'Withholding should be positive');
  assert(overtime1.takeHome > 0, 'Take-home should be positive');
  assert(overtime1.takeHome < overtime1.grossPay, 'Take-home should be less than gross');
  assert(overtime1.effectiveRate > 0 && overtime1.effectiveRate < 1, 'Effective rate should be between 0 and 1');

  // New tests: Actual tax vs Withholding relationship
  assert(overtime1.withholding > overtime1.actualTax, 'Withholding should be higher than actual tax');
  assert(overtime1.takeHome > overtime1.takeHomeWithholding, 'Actual take-home should be higher than withholding-based take-home');
  assert(overtime1.estimatedRefund > 0, 'Estimated refund should be positive');
  assertApprox(overtime1.estimatedRefund, overtime1.withholding - overtime1.actualTax, 0.01, 'Refund should equal withholding minus actual tax');

  // Test that actual effective rate is lower than withholding rate (by ~14%)
  const rateRatio = overtime1.effectiveRateWithholding / overtime1.effectiveRate;
  assertApprox(rateRatio, 12/10.5, 0.02, 'Withholding rate should be ~14.3% higher than actual rate');

  // Test marginal rate is reasonable (30-50% for typical salaries)
  assert(overtime1.effectiveRate >= 0.30 && overtime1.effectiveRate <= 0.55,
    'Effective marginal rate should be 30-55% for typical salary');

  // Test 5: Edge cases
  console.log('\n--- Test Edge Cases ---');

  // Zero overtime hours
  const overtime0 = calculateOvertimeTakeHome({
    yearlySalary: 600000,
    overtimeHours: 0,
    tableNumber: 8100,
    taxYear: 2026
  });
  assert(overtime0.grossPay === 0, 'Zero overtime hours should give zero gross pay');
  assert(overtime0.withholding === 0, 'Zero overtime hours should give zero withholding');
  assert(overtime0.takeHome === 0, 'Zero overtime hours should give zero take-home');

  // Very high salary (progressive brackets)
  const overtimeHigh = calculateOvertimeTakeHome({
    yearlySalary: 1500000,
    overtimeHours: 10,
    tableNumber: 8100,
    taxYear: 2026
  });
  console.log(`  High salary (1.5M/year) effective rate: ${(overtimeHigh.effectiveRate * 100).toFixed(1)}%`);
  assert(overtimeHigh.effectiveRate > overtime1.effectiveRate,
    'Higher salary should have higher marginal tax rate');

  // Low salary
  const overtimeLow = calculateOvertimeTakeHome({
    yearlySalary: 400000,
    overtimeHours: 10,
    tableNumber: 8100,
    taxYear: 2026
  });
  console.log(`  Low salary (400k/year) effective rate: ${(overtimeLow.effectiveRate * 100).toFixed(1)}%`);
  assert(overtimeLow.effectiveRate < overtime1.effectiveRate,
    'Lower salary should have lower marginal tax rate');

  // Test 6: validateParameters
  console.log('\n--- Test validateParameters ---');

  const valid1 = validateParameters({
    yearlySalary: 600000,
    overtimeHours: 10,
    tableNumber: 8115,
    taxYear: 2026
  });
  assert(valid1.valid === true, 'Valid parameters should pass validation');
  assert(valid1.errors.length === 0, 'Valid parameters should have no errors');

  const invalid1 = validateParameters({
    yearlySalary: -100,
    overtimeHours: 10,
    tableNumber: 8115,
    taxYear: 2026
  });
  assert(invalid1.valid === false, 'Negative salary should fail validation');
  assert(invalid1.errors.length > 0, 'Invalid parameters should have errors');

  const invalid2 = validateParameters({
    yearlySalary: 600000,
    overtimeHours: 10,
    tableNumber: 7150,
    taxYear: 2026
  });
  assert(invalid2.valid === false, 'Unsupported table number should fail validation');

  const invalid3 = validateParameters({
    yearlySalary: 600000,
    overtimeHours: 10,
    tableNumber: 8115,
    taxYear: 2099
  });
  assert(invalid3.valid === false, 'Unavailable tax year should fail validation');

  // Test 7: formatNOK
  console.log('\n--- Test formatNOK ---');

  const formatted1 = formatNOK(12345.67, false);
  console.log(`  Format without decimals: "${formatted1}"`);
  assert(formatted1.startsWith('kr '), 'Should start with "kr "');
  assert(formatted1.includes('12') && formatted1.includes('346'), 'Should contain rounded value');

  const formatted2 = formatNOK(12345.67, true);
  console.log(`  Format with decimals: "${formatted2}"`);
  assert(formatted2.startsWith('kr '), 'Should start with "kr "');
  assert(formatted2.includes('12') && formatted2.includes('345') && formatted2.includes('67'), 'Should contain value with decimals');

  const formatted3 = formatNOK(1000000, false);
  console.log(`  Format large number: "${formatted3}"`);
  assert(formatted3.startsWith('kr '), 'Should start with "kr "');
  assert(formatted3.match(/1.?000.?000/), 'Should format large numbers with separators');

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);
  console.log(`Total:  ${testsPassed + testsFailed}`);

  if (testsFailed === 0) {
    console.log('\n✓ All tests passed!');
    process.exit(0);
  } else {
    console.log(`\n✗ ${testsFailed} test(s) failed`);
    process.exit(1);
  }
}

// Run tests
runTests();
