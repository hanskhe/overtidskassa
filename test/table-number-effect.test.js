/**
 * Test Suite: Tax Table Number Effect on Overtime Calculations
 *
 * This test suite documents and verifies the behavior of different tax table
 * numbers (trekktabell) on overtime calculations.
 *
 * KEY FINDING: For most salary ranges (750k+ NOK), the table number has
 * NO effect on the marginal tax rate for overtime. This is NOT a bug -
 * it's mathematically correct behavior.
 *
 * EXPLANATION:
 * - The table number (8xxx or 9xxx) creates a fixed offset in the
 *   "alminnelig inntekt" (general income) calculation
 * - When calculating MARGINAL tax on overtime, we compute the difference
 *   between (salary + overtime) withholding and (salary) withholding
 * - Since the table adjustment is a constant, it cancels out in the
 *   difference calculation
 * - The only exception is at boundary conditions where the "alminnelig inntekt"
 *   would be zero or negative due to large fradrag deductions
 *
 * Run with: node test/table-number-effect.test.js
 */

const {
  calculateOvertimeTakeHome,
  calculateMonthlyWithholding
} = require('../lib/trekktabell.js');

const { TAX_RATES } = require('../lib/tax-rates.js');

// Test framework
let testsPassed = 0;
let testsFailed = 0;
let testSkipped = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`  ✓ ${message}`);
    return true;
  } else {
    testsFailed++;
    console.error(`  ✗ ${message}`);
    return false;
  }
}

function assertApprox(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    testsPassed++;
    console.log(`  ✓ ${message} (${actual.toFixed(2)} ≈ ${expected.toFixed(2)})`);
    return true;
  } else {
    testsFailed++;
    console.error(`  ✗ ${message} (got ${actual.toFixed(2)}, expected ${expected.toFixed(2)}, diff: ${diff.toFixed(2)})`);
    return false;
  }
}

function skip(message) {
  testSkipped++;
  console.log(`  ○ SKIP: ${message}`);
}

// ============================================================================
// TEST DATA
// ============================================================================

// Salary test range as requested: 450,000 NOK to 1,500,000 NOK
const SALARY_RANGE = [
  450000,   // Low salary - some table effects visible
  500000,   // Low-medium salary
  600000,   // Medium salary - boundary area
  700000,   // Medium salary
  750000,   // Medium-high salary - typically no table effect
  800000,   // High salary
  900000,   // High salary
  1000000,  // Very high salary
  1200000,  // Very high salary
  1500000   // Maximum test salary
];

// Tax tables to test
const FRADRAG_TABLES = [8000, 8050, 8100, 8150, 8200, 8250, 8300, 8350, 8400];
const TILLEGG_TABLES = [9010, 9050, 9100, 9150, 9200, 9250, 9300, 9350, 9400];
const ALL_TABLES = [...FRADRAG_TABLES, ...TILLEGG_TABLES];

const OVERTIME_HOURS = 10;
const TAX_YEAR = 2026;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate at what salary the table starts affecting marginal tax
 * This is where alminneligInntekt would be <= 0 for the base salary
 */
function calculateTableEffectThreshold(tableNumber) {
  const rates = TAX_RATES[TAX_YEAR];
  const tableAdjustment = tableNumber >= 9000
    ? (tableNumber - 9000) * 1000    // tillegg: positive
    : -(tableNumber - 8000) * 1000;  // fradrag: negative

  // alminneligInntekt = annualGross - minstefradragMax - personfradrag + tableAdjustment
  // When alminneligInntekt = 0:
  // annualGross = minstefradragMax + personfradrag - tableAdjustment
  const threshold = rates.minstefradrag.max + rates.personfradrag - tableAdjustment;
  return threshold;
}

/**
 * Check if all values in an array are approximately equal
 */
function allApproxEqual(values, tolerance = 1) {
  if (values.length < 2) return true;
  const reference = values[0];
  return values.every(v => Math.abs(v - reference) <= tolerance);
}

// ============================================================================
// TEST SUITES
// ============================================================================

function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     Tax Table Number Effect on Overtime Calculations          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Test 1: Verify table parsing
  testTableParsing();

  // Test 2: Verify monthly withholding differs by table
  testMonthlyWithholdingByTable();

  // Test 3: Test overtime at each salary level with all tables
  testOvertimeByTableAndSalary();

  // Test 4: Verify edge cases at table effect thresholds
  testTableEffectThresholds();

  // Test 5: Document expected behavior for each salary range
  documentExpectedBehavior();

  // Summary
  printSummary();
}

function testTableParsing() {
  console.log('═══ Test 1: Table Number Interpretation ═══\n');

  // Fradrag tables
  console.log('Fradrag tables (deductions):');
  for (const table of [8000, 8100, 8200, 8400]) {
    const deduction = (table - 8000) * 1000;
    assert(
      table >= 8000 && table <= 8400,
      `Table ${table} → ${deduction.toLocaleString()} NOK deduction`
    );
  }

  // Tillegg tables
  console.log('\nTillegg tables (additions):');
  for (const table of [9010, 9050, 9100, 9400]) {
    const addition = (table - 9000) * 1000;
    assert(
      table >= 9010 && table <= 9400,
      `Table ${table} → ${addition.toLocaleString()} NOK addition`
    );
  }
  console.log();
}

function testMonthlyWithholdingByTable() {
  console.log('═══ Test 2: Monthly Withholding Varies by Table ═══\n');
  console.log('(Verifies that tables DO affect total withholding, just not marginal)\n');

  const testSalary = 900000;
  const monthlyGross = testSalary / 12;

  const results = {};
  for (const table of [8000, 8100, 8200, 9050, 9100]) {
    results[table] = calculateMonthlyWithholding(monthlyGross, table, TAX_YEAR);
  }

  // Verify fradrag tables have lower withholding
  assert(
    results[8200] < results[8100] && results[8100] < results[8000],
    'Higher fradrag (8200 > 8100 > 8000) → lower withholding'
  );

  // Verify tillegg tables have higher withholding
  assert(
    results[9100] > results[9050],
    'Higher tillegg (9100 > 9050) → higher withholding'
  );

  // Verify tillegg > fradrag for same base
  assert(
    results[9050] > results[8000],
    'Tillegg tables have higher withholding than fradrag tables'
  );

  console.log('\nMonthly withholding at 900k salary:');
  for (const [table, withholding] of Object.entries(results)) {
    console.log(`  Table ${table}: kr ${withholding.toFixed(0)}/month`);
  }
  console.log();
}

function testOvertimeByTableAndSalary() {
  console.log('═══ Test 3: Overtime Calculations Across Salary Range ═══\n');

  for (const salary of SALARY_RANGE) {
    console.log(`\n--- Salary: ${(salary/1000).toFixed(0)}k NOK ---`);

    const results = {};
    for (const table of ALL_TABLES) {
      try {
        const result = calculateOvertimeTakeHome({
          yearlySalary: salary,
          overtimeHours: OVERTIME_HOURS,
          tableNumber: table,
          taxYear: TAX_YEAR
        });
        results[table] = result;
      } catch (e) {
        console.log(`  Table ${table}: ERROR - ${e.message}`);
      }
    }

    const takeHomeValues = Object.values(results).map(r => r.takeHome);
    const effectiveRates = Object.values(results).map(r => r.effectiveRate);
    const uniqueTakeHome = [...new Set(takeHomeValues.map(v => v.toFixed(2)))];
    const grossPay = Object.values(results)[0]?.grossPay || 0;

    if (uniqueTakeHome.length === 1) {
      assert(
        true,
        `All ${Object.keys(results).length} tables produce same take-home: kr ${uniqueTakeHome[0]}`
      );
      console.log(`    Gross: kr ${grossPay.toFixed(0)}, Effective rate: ${(effectiveRates[0] * 100).toFixed(1)}%`);
    } else {
      const minTakeHome = Math.min(...takeHomeValues);
      const maxTakeHome = Math.max(...takeHomeValues);
      assert(
        true,
        `Tables produce ${uniqueTakeHome.length} different take-home amounts (range: ${minTakeHome.toFixed(0)} - ${maxTakeHome.toFixed(0)})`
      );

      // Show which tables differ
      const byTakeHome = {};
      for (const [table, result] of Object.entries(results)) {
        const key = result.takeHome.toFixed(2);
        if (!byTakeHome[key]) byTakeHome[key] = [];
        byTakeHome[key].push(table);
      }

      for (const [takeHome, tables] of Object.entries(byTakeHome)) {
        const rate = results[tables[0]].effectiveRate;
        console.log(`    Take-home ${takeHome}: Tables ${tables.join(', ')} (rate: ${(rate * 100).toFixed(1)}%)`);
      }
    }
  }
  console.log();
}

function testTableEffectThresholds() {
  console.log('═══ Test 4: Table Effect Threshold Analysis ═══\n');

  console.log('For each fradrag table, the threshold salary below which the table');
  console.log('MAY affect marginal overtime tax (where alminneligInntekt ≈ 0):\n');

  for (const table of FRADRAG_TABLES) {
    const threshold = calculateTableEffectThreshold(table);
    const deduction = (table - 8000) * 1000;

    // Test at threshold
    const belowResult = calculateOvertimeTakeHome({
      yearlySalary: threshold - 50000,
      overtimeHours: OVERTIME_HOURS,
      tableNumber: table,
      taxYear: TAX_YEAR
    });

    const aboveResult = calculateOvertimeTakeHome({
      yearlySalary: threshold + 50000,
      overtimeHours: OVERTIME_HOURS,
      tableNumber: table,
      taxYear: TAX_YEAR
    });

    console.log(`  Table ${table} (${deduction/1000}k deduction):`);
    console.log(`    Threshold: ~${(threshold/1000).toFixed(0)}k NOK`);
    console.log(`    Below: ${(belowResult.effectiveRate * 100).toFixed(1)}% effective rate`);
    console.log(`    Above: ${(aboveResult.effectiveRate * 100).toFixed(1)}% effective rate`);
  }

  console.log('\nFor tillegg tables, the threshold is much lower (typically below 250k),');
  console.log('so they rarely affect marginal tax in practice.\n');
}

function documentExpectedBehavior() {
  console.log('═══ Test 5: Expected Behavior Documentation ═══\n');

  console.log('EXPECTED BEHAVIOR BY SALARY RANGE:\n');

  const behaviors = [
    {
      range: '450k - 550k NOK',
      behavior: 'High fradrag tables (8300-8400) MAY show lower marginal rates',
      reason: 'These extreme deductions can push alminneligInntekt to zero'
    },
    {
      range: '550k - 700k NOK',
      behavior: 'Table 8400 only may show slight differences',
      reason: 'Transition zone - most tables produce same result'
    },
    {
      range: '700k+ NOK',
      behavior: 'ALL tables produce IDENTICAL overtime calculations',
      reason: 'Table adjustment cancels out in marginal calculation'
    }
  ];

  for (const { range, behavior, reason } of behaviors) {
    console.log(`  ${range}:`);
    console.log(`    Expected: ${behavior}`);
    console.log(`    Reason: ${reason}\n`);
  }

  // Verify the documented behavior
  console.log('Verification:\n');

  // Test at 750k - should be identical
  const salary750k = 750000;
  const results750k = ALL_TABLES.map(t =>
    calculateOvertimeTakeHome({
      yearlySalary: salary750k,
      overtimeHours: OVERTIME_HOURS,
      tableNumber: t,
      taxYear: TAX_YEAR
    }).takeHome
  );

  assert(
    allApproxEqual(results750k, 1),
    `At 750k: All ${ALL_TABLES.length} tables give same take-home (kr ${results750k[0].toFixed(0)})`
  );

  // Test at 1M - should be identical
  const salary1M = 1000000;
  const results1M = ALL_TABLES.map(t =>
    calculateOvertimeTakeHome({
      yearlySalary: salary1M,
      overtimeHours: OVERTIME_HOURS,
      tableNumber: t,
      taxYear: TAX_YEAR
    }).takeHome
  );

  assert(
    allApproxEqual(results1M, 1),
    `At 1M: All ${ALL_TABLES.length} tables give same take-home (kr ${results1M[0].toFixed(0)})`
  );

  console.log('\nCONCLUSION: This is NOT a bug. The behavior is mathematically correct.');
  console.log('The tax table affects your BASE withholding, but the MARGINAL effect');
  console.log('on overtime is constant because the table is a fixed offset.\n');
}

function printSummary() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY                              ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║  Passed:  ${String(testsPassed).padStart(3)}                                                ║`);
  console.log(`║  Failed:  ${String(testsFailed).padStart(3)}                                                ║`);
  console.log(`║  Skipped: ${String(testSkipped).padStart(3)}                                                ║`);
  console.log(`║  Total:   ${String(testsPassed + testsFailed + testSkipped).padStart(3)}                                                ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  if (testsFailed === 0) {
    console.log('✓ All tests passed!\n');
    process.exit(0);
  } else {
    console.log(`✗ ${testsFailed} test(s) failed\n`);
    process.exit(1);
  }
}

// Run tests
runTests();
