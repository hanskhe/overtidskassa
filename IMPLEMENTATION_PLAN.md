# Implementation Plan: Overtime Take-Home Calculator Browser Extension

## 1. Project Overview

### Goal

Create a Firefox/Chrome extension that calculates estimated take-home pay for overtime hours by injecting the result directly into a company timesheet page.

### Core Calculation

```
hourly_rate = yearly_salary / 1950
overtime_gross = overtime_hours × hourly_rate × 1.4
normal_monthly = yearly_salary / 12
combined_monthly = normal_monthly + overtime_gross

withholding_on_overtime = tabelltrekk(combined_monthly, table_number) - tabelltrekk(normal_monthly, table_number)
take_home_overtime = overtime_gross - withholding_on_overtime
```

### Key Insight

The tabelltrekk calculation is **algorithmic**, not a static lookup. Skatteetaten publishes open-source Java code that computes withholding from first principles. We will port this algorithm to JavaScript rather than bundling large table files.

-----

## 2. Norwegian Tax Withholding Algorithm (Tabelltrekk)

### 2.1 What the Table Number Encodes

From 2025 onwards, table numbers follow this scheme:

|Series   |Meaning                               |Example                      |
|---------|--------------------------------------|-----------------------------|
|8000–8400|Fradragstabeller (deductions built-in)|8115 = 115,000 NOK deductions|
|9010–9400|Tilleggstabeller (additions built-in) |9050 = 50,000 NOK additions  |

The last three digits × 1000 = the deduction or addition amount.

**Parsing logic:**

```javascript
function parseTableNumber(tableNum) {
  if (tableNum >= 8000 && tableNum <= 8400) {
    return { type: 'fradrag', amount: (tableNum - 8000) * 1000 };
  } else if (tableNum >= 9010 && tableNum <= 9400) {
    return { type: 'tillegg', amount: (tableNum - 9000) * 1000 };
  }
  // Special tables (7150, 7160, etc.) - not supported in v1
  return null;
}
```

### 2.2 Core Tax Components (2026 Rates)

The withholding algorithm calculates these components on an **annual basis**, then divides by withholding periods:

#### A. Trinnskatt (Bracket Tax) — on personal income

```javascript
const TRINNSKATT_2026 = [
  { threshold: 226100, rate: 0.000 },  // 0% up to 226,100
  { threshold: 318300, rate: 0.017 },  // 1.7% from 226,101 to 318,300
  { threshold: 725050, rate: 0.040 },  // 4.0% from 318,301 to 725,050
  { threshold: 980100, rate: 0.137 },  // 13.7% from 725,051 to 980,100
  { threshold: 1467200, rate: 0.168 }, // 16.8% from 980,101 to 1,467,200
  { threshold: Infinity, rate: 0.178 } // 17.8% above 1,467,200
];
```

#### B. Trygdeavgift (National Insurance) — on personal income

```javascript
const TRYGDEAVGIFT_2026 = {
  rate: 0.076,  // 7.6% for salary
  fpiGrense: 69650  // No trygdeavgift below this threshold
};
```

#### C. Skatt på Alminnelig Inntekt (Tax on General Income)

```javascript
const ALMINNELIG_INNTEKT_2026 = {
  rate: 0.22  // Flat 22%
};
```

#### D. Minstefradrag (Minimum Deduction)

```javascript
const MINSTEFRADRAG_2026 = {
  rate: 0.46,       // 46% of income
  minimum: 4000,    // At least 4,000 NOK
  maximum: 95700    // Capped at 95,700 NOK
};
```

#### E. Personfradrag (Personal Allowance)

```javascript
const PERSONFRADRAG_2026 = 114210;  // 114,210 NOK
```

### 2.3 The Calculation Flow

For a given monthly income and table number:

```
1. Convert monthly income to annual: årsinntekt = monthly × 12

2. Calculate Minstefradrag:
   minstefradrag = clamp(årsinntekt × 0.46, 4000, 95700)

3. Get table adjustment:
   If fradragstabell (8xxx): nettoFradrag = tableFradrag
   If tilleggstabell (9xxx): nettoFradrag = -tableTillegg

4. Calculate Alminnelig Inntekt (taxable general income):
   alminneligInntekt = årsinntekt - minstefradrag - personfradrag + nettoFradrag
   (But note: the table's fradrag/tillegg represents OTHER income/deductions
    like interest, so it adjusts the base)

5. Calculate annual taxes:
   - trinnskatt = calculateTrinnskatt(årsinntekt)  // On gross personal income
   - trygdeavgift = årsinntekt × 0.076 (if above threshold)
   - inntektsskatt = max(0, alminneligInntekt) × 0.22

6. Total annual tax = trinnskatt + trygdeavgift + inntektsskatt

7. Convert to monthly withholding:
   - Standard tables assume 10.5 months of withholding
   - månedstrekk = årsskatt / 10.5
```

### 2.4 The 10.5 Month Factor

Norwegian employers withhold tax for only 10.5 months because:

- **June**: No withholding (feriepenger month)
- **December**: Half withholding

This is built into the tables. When comparing withholdings, both lookups use the same factor, so it cancels out for our marginal calculation. However, the *displayed* monthly withholding is higher than `annual_tax / 12`.

### 2.5 Simplified Algorithm for Extension

Since we only need the **difference** in withholding (not the absolute amount), and we're comparing two incomes using the same table, we can simplify:

```javascript
function calculateWithholding(monthlyGross, tableNumber, taxYear = 2026) {
  const rates = TAX_RATES[taxYear];
  const tableInfo = parseTableNumber(tableNumber);

  const annualGross = monthlyGross * 12;

  // Minstefradrag
  const minstefradrag = Math.min(
    Math.max(annualGross * rates.minstefradrag.rate, rates.minstefradrag.min),
    rates.minstefradrag.max
  );

  // Table adjustment (fradrag reduces tax base, tillegg increases it)
  const tableAdjustment = tableInfo.type === 'fradrag'
    ? -tableInfo.amount
    : tableInfo.amount;

  // Alminnelig inntekt (general taxable income)
  const alminneligInntekt = Math.max(0,
    annualGross - minstefradrag - rates.personfradrag + tableAdjustment
  );

  // Component taxes
  const trinnskatt = calculateTrinnskatt(annualGross, rates.trinnskatt);
  const trygdeavgift = annualGross > rates.trygdeavgift.threshold
    ? annualGross * rates.trygdeavgift.rate
    : 0;
  const inntektsskatt = alminneligInntekt * rates.alminneligInntekt.rate;

  const annualTax = trinnskatt + trygdeavgift + inntektsskatt;

  // Convert to monthly (10.5 month withholding period)
  return annualTax / 10.5;
}

function calculateTrinnskatt(annualIncome, brackets) {
  let tax = 0;
  let previousThreshold = 0;

  for (const bracket of brackets) {
    if (annualIncome <= previousThreshold) break;

    const taxableInBracket = Math.min(annualIncome, bracket.threshold) - previousThreshold;
    tax += Math.max(0, taxableInBracket) * bracket.rate;
    previousThreshold = bracket.threshold;
  }

  return tax;
}
```

-----

## 3. Extension Architecture

### 3.1 File Structure

```
overtime-calculator/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/
│   └── content.js
├── lib/
│   ├── trekktabell.js      # Core calculation algorithm
│   └── tax-rates.js        # Year-specific rate constants
├── background.js           # Optional: for message passing
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

### 3.2 Manifest (v3 for Chrome, v2 for Firefox)

```json
{
  "manifest_version": 3,
  "name": "Overtime Take-Home Calculator",
  "version": "1.0.0",
  "description": "Calculate estimated take-home pay for overtime hours",
  "permissions": ["storage", "activeTab"],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["https://timesheet.example.com/*"],  // UPDATE: actual timesheet URL
      "js": ["lib/tax-rates.js", "lib/trekktabell.js", "content/content.js"],
      "css": ["content/content.css"]
    }
  ]
}
```

### 3.3 Data Storage Schema

```javascript
// Stored in browser.storage.local
{
  "settings": {
    "yearlySalary": 900000,      // NOK
    "tableNumber": 8115,
    "taxYear": 2026
  }
}
```

-----

## 4. Component Specifications

### 4.1 Popup UI (`popup/popup.html`)

**Fields:**

- Yearly salary (number input, NOK)
- Table number (number input, 4 digits)
- Tax year (dropdown: 2026, future years)
- Save button

**Validation:**

- Salary: positive number, reasonable range (100,000 – 5,000,000)
- Table number: must be valid (8000–8400 or 9010–9400)
- Show error messages inline

**UX:**

- Pre-fill from storage if settings exist
- Show "Saved!" confirmation
- Include brief explanation: "Find your table number on your skattetrekksmelding"

### 4.2 Tax Rates Module (`lib/tax-rates.js`)

Structure for easy yearly updates:

```javascript
const TAX_RATES = {
  2026: {
    trinnskatt: [
      { threshold: 226100, rate: 0 },
      { threshold: 318300, rate: 0.017 },
      { threshold: 725050, rate: 0.040 },
      { threshold: 980100, rate: 0.137 },
      { threshold: 1467200, rate: 0.168 },
      { threshold: Infinity, rate: 0.178 }
    ],
    trygdeavgift: {
      rate: 0.076,
      threshold: 69650
    },
    alminneligInntekt: {
      rate: 0.22
    },
    minstefradrag: {
      rate: 0.46,
      min: 4000,
      max: 95700
    },
    personfradrag: 114210
  },
  // Add 2027 here when available
};
```

### 4.3 Calculation Module (`lib/trekktabell.js`)

**Exports:**

```javascript
/**
 * Calculate monthly withholding for a given gross monthly income
 * @param {number} monthlyGross - Gross monthly salary in NOK
 * @param {number} tableNumber - Skattetabell number (e.g., 8115)
 * @param {number} taxYear - Tax year (default: current year)
 * @returns {number} - Monthly withholding amount in NOK
 */
function calculateMonthlyWithholding(monthlyGross, tableNumber, taxYear)

/**
 * Calculate take-home pay for overtime hours
 * @param {object} params
 * @param {number} params.yearlySalary - Annual salary in NOK
 * @param {number} params.overtimeHours - Number of overtime hours
 * @param {number} params.tableNumber - Skattetabell number
 * @param {number} params.taxYear - Tax year
 * @returns {object} - { grossPay, withholding, takeHome, effectiveRate }
 */
function calculateOvertimeTakeHome(params)
```

**Return object for `calculateOvertimeTakeHome`:**

```javascript
{
  grossPay: 7179.49,        // Overtime gross (before tax)
  withholding: 3087.18,     // Tax withheld on overtime
  takeHome: 4092.31,        // Net overtime pay
  effectiveRate: 0.43,      // Marginal tax rate on overtime (43%)
  hourlyRate: 646.15,       // Base hourly rate
  overtimeRate: 904.62      // Hourly rate × 1.4
}
```

### 4.4 Content Script (`content/content.js`)

**Responsibilities:**

1. Load settings from storage
1. Find overtime hours element on page (configurable selector)
1. Parse the overtime hours value
1. Calculate take-home using `calculateOvertimeTakeHome()`
1. Inject result display near the overtime hours element

**Configuration (at top of file):**

```javascript
const CONFIG = {
  // UPDATE THESE for the actual timesheet system
  overtimeSelector: '#overtime-hours',  // CSS selector for overtime hours element
  insertAfterSelector: '#overtime-hours', // Where to inject result
  parseOvertimeValue: (el) => parseFloat(el.textContent) // How to extract hours
};
```

**Injection HTML template:**

```html
<div class="overtime-takehome-display">
  <span class="label">Est. take-home:</span>
  <span class="amount">kr 4 092</span>
  <span class="detail">(43% tax on kr 7 179 gross)</span>
</div>
```

**Styling:**

- Non-intrusive, matches page style where possible
- Clear visual indicator this is an extension-added element
- Tooltip with breakdown on hover

-----

## 5. Edge Cases and Limitations

### 5.1 Known Limitations

1. **Estimate only**: This calculates *withholding*, not final tax liability. Actual tax may differ at year-end (skatteoppgjør).
1. **Standard tables only**: Supports 8000–8400 and 9010–9400 series. Special tables (7150, 7160, 7300, etc.) for Finnmark, offshore, seafarers are **not supported** in v1.
1. **Single employer assumption**: Assumes user has one employer using tabelltrekk. Multiple employers or prosenttrekk scenarios are not handled.
1. **No formue (wealth) consideration**: Wealth tax is omitted as it doesn't affect withholding on salary.

### 5.2 Edge Cases to Handle

|Case                              |Handling                                    |
|----------------------------------|--------------------------------------------|
|Overtime hours = 0                |Display nothing or "No overtime this period"|
|Settings not configured           |Prompt user to open popup and configure     |
|Invalid table number              |Show error, don't calculate                 |
|Very high income (>1.5M/year)     |Algorithm handles it, but show disclaimer   |
|Negative result (shouldn't happen)|Clamp to 0, log warning                     |

### 5.3 Accuracy Considerations

The algorithm is a **simplification** of the full Skatteetaten trekkrutine. Differences may arise from:

- Rounding (official tables round to nearest krone)
- Edge cases in minstefradrag calculation
- Feriepenger timing nuances

For the stated goal (rough estimate for overtime), accuracy within ±2% is acceptable.

-----

## 6. Testing Strategy

### 6.1 Unit Tests for Calculation Module

Test cases using known values from Skatteetaten's online calculator:

```javascript
// Example test cases
const testCases = [
  {
    input: { yearlySalary: 600000, tableNumber: 8100, taxYear: 2026 },
    expectedMonthlyWithholding: /* look up */,
    tolerance: 0.02  // 2%
  },
  // Add more cases at different income levels
];
```

### 6.2 Integration Tests

1. Verify settings save/load correctly
1. Verify content script injects properly on mock page
1. Verify calculation triggers on page load

### 6.3 Manual Verification

Compare extension output against:

- Skatteetaten's tabellkort calculator: <https://tabellkort.app.skatteetaten.no/>
- A real payslip with overtime

-----

## 7. Future Enhancements (Out of Scope for v1)

- Support for special tables (Finnmark, offshore)
- Support for prosenttrekk as alternative
- Multiple tax years in dropdown
- Export/import settings
- Localization (Norwegian UI)
- Firefox-specific manifest v2 variant
- Automatic yearly rate updates via fetch

-----

## 8. Implementation Checklist

### Phase 1: Core Algorithm

- [ ] Implement `tax-rates.js` with 2026 constants
- [ ] Implement `trekktabell.js` with calculation functions
- [ ] Write unit tests for calculation accuracy
- [ ] Validate against Skatteetaten calculator

### Phase 2: Extension Popup

- [ ] Create popup HTML/CSS
- [ ] Implement settings save/load
- [ ] Add input validation
- [ ] Test cross-browser (Chrome, Firefox)

### Phase 3: Content Script

- [ ] Implement DOM detection (with placeholder selectors)
- [ ] Implement result injection
- [ ] Style injected element
- [ ] Handle missing settings gracefully

### Phase 4: Integration

- [ ] Update manifest with actual timesheet URL pattern
- [ ] Update selectors for actual timesheet DOM
- [ ] End-to-end testing on real timesheet
- [ ] Package for distribution

-----

## 9. Reference: 2026 Tax Rates Summary

|Component          |Rate/Value                 |
|-------------------|---------------------------|
|Alminnelig inntekt |22%                        |
|Trygdeavgift (lønn)|7.6%                       |
|Trinnskatt trinn 1 |1.7% (226,101 – 318,300)   |
|Trinnskatt trinn 2 |4.0% (318,301 – 725,050)   |
|Trinnskatt trinn 3 |13.7% (725,051 – 980,100)  |
|Trinnskatt trinn 4 |16.8% (980,101 – 1,467,200)|
|Trinnskatt trinn 5 |17.8% (1,467,201+)         |
|Minstefradrag      |46%, min 4,000, max 95,700 |
|Personfradrag      |114,210                    |
|Withholding periods|10.5 months                |

-----

## 10. Resources

- Skatteetaten trekktabell algorithm (Java): <https://github.com/Skatteetaten/trekktabell>
- Official bracket tax rates: <https://www.skatteetaten.no/en/rates/bracket-tax/>
- Table number explanation: <https://www.skatteetaten.no/en/business-and-organisation/employer/tax-deduction-cards-and-tax-deductions/as-an-employer-you-are-obliged-to-make-withholding-tax-deductions/overview-over-the-table-steps-for-deduction-tables-2025/>
- Online withholding calculator: <https://tabellkort.app.skatteetaten.no/>
