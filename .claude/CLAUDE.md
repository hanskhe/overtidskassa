# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Overtidskassa** is a browser extension that calculates Norwegian overtime take-home pay. It injects estimated net overtime compensation directly into the Bekk timesheet page (timer.bekk.no).

- **Target Users**: Norwegian employees tracking overtime on timer.bekk.no
- **Core Functionality**: Calculates net overtime pay using Norwegian tax withholding algorithm (tabelltrekk)
- **Privacy**: All calculations happen locally in the browser - no data is sent to servers
- **Language**: User-facing text is in Norwegian; code/comments are in English

## Technology Stack

- **Pure JavaScript**: No build tools, no frameworks, no transpilation
- **Manifest V3**: Modern browser extension format
- **Browser APIs**: `browser.storage` (with Chrome compatibility layer)
- **Testing**: Node.js test scripts (no test framework)

## Development Commands

### Testing

```bash
# Run unit tests for tax calculation algorithm
npm test

# Validate calculations against official Skatteetaten tables
npm run validate
```

### Building

```bash
# Build Firefox distribution (creates dist/firefox/ + .zip file)
npm run build:firefox

# Build Chrome distribution (creates dist/chrome/ + .zip file)
npm run build:chrome
```

### Manual Testing

Load as unpacked extension:
- **Firefox**: `about:debugging` → This Firefox → Load Temporary Add-on → Select `manifest.json`
- **Chrome**: `chrome://extensions` → Developer mode → Load unpacked → Select project root

## Architecture

### Tax Calculation Pipeline

```
User Input → Tax Algorithm → DOM Injection
   ↓              ↓              ↓
Settings      lib/           content/
(popup/)   trekktabell.js  content.js
```

1. **User configures** (popup): Yearly salary, tax table number, tax year
2. **Algorithm calculates** (lib): Marginal tax on overtime using Norwegian tax rules
3. **Content script injects** (content): Displays net pay inline on timesheet

### Norwegian Tax Algorithm (`lib/trekktabell.js`)

Implements the official Skatteetaten withholding calculation with these components:

- **Trinnskatt**: Progressive bracket tax (6 brackets for 2026)
- **Trygdeavgift**: 7.6% national insurance on income above threshold
- **Alminnelig inntekt**: 22% flat tax on general income
- **Minstefradrag**: 46% standard deduction (min 4,000 kr, max 95,700 kr)
- **Personfradrag**: Personal allowance (114,210 kr for 2026)
- **Table adjustment**: Tax tables 8000-8400 encode deductions, 9010-9400 encode additions
- **Withholding periods**: 10.5 months (June has no withholding, December has half)

**Two calculation modes**:
- **Actual tax**: Assumes overtime is occasional - calculates true marginal tax
- **Withholding**: What employer deducts - assumes overtime recurs monthly

Users choose which to display via `useWithholding` setting.

### Tax Rates (`lib/tax-rates.js`)

Year-specific constants in a structured `TAX_RATES` object. **Must be updated annually** when Norwegian tax rates change (typically announced in October for the next year).

### Content Script Strategy (`content/content.js`)

**Challenge**: timer.bekk.no uses CSS Modules with dynamic class names like `_row_v4wpf_15`.

**Solution**: Three-layer detection strategy:
1. **Context**: Find "Nøkkeltall" heading first
2. **Pattern**: Use `[class*="_row_"]` wildcards (survives CSS Module hash changes)
3. **Content**: Match text "Overtid" (Norwegian for overtime)

**Resilience mechanisms**:
- MutationObserver watches for text changes in the hours field
- Separate observer detects when SPA removes injected content (triggers re-injection)
- Debouncing prevents excessive recalculations (100ms for updates, 150ms for re-injection)

### Browser Compatibility

Uses defensive API detection:
```javascript
const browserAPI = (() => {
  if (typeof browser !== 'undefined') return browser; // Firefox
  if (typeof chrome !== 'undefined') return chrome;   // Chrome
  return null;
})();
```

Both Firefox and Chrome use the same source files.

### File Structure

```
lib/
├── trekktabell.js    # Core tax calculation algorithm
└── tax-rates.js      # Year-specific Norwegian tax rates (UPDATE ANNUALLY)

content/
├── content.js        # DOM injection and observation logic
└── content.css       # Styling for injected elements + hover popup

popup/
├── popup.html        # Settings UI
├── popup.js          # Form validation and storage
└── popup.css         # Popup styling

test/
├── trekktabell.test.js                # Unit tests for tax calculations
├── table-number-effect.test.js        # Tests for table number effects
└── validate-against-skatteetaten.js   # Validation against official tables

manifest.json         # Browser extension manifest (Manifest V3)
updates.json          # Firefox auto-update manifest (GitHub-hosted)
```

## Critical Implementation Details

### Module Exports/Imports

Supports both browser and Node.js environments:

```javascript
// At end of lib files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { /* exports */ };
}
```

- **Browser**: Scripts loaded via `manifest.json` create global functions
- **Node.js**: Scripts use CommonJS `require()`

### Storage Schema

```javascript
{
  "settings": {
    "yearlySalary": 900000,        // NOK
    "tableNumber": 8115,           // 8000-8400 or 9010-9400
    "taxYear": 2026,               // Which tax rates to use
    "useWithholding": false        // false = actual tax, true = withholding
  }
}
```

### Error Handling Philosophy

- **Silent failures for DOM**: If overtime row not found, log warning but don't alert user
- **Validation errors in popup**: Show inline error messages, prevent saving
- **Calculation errors**: Throw exceptions (caught by content script)

## Common Development Tasks

### Adding Support for a New Tax Year

1. **Update `lib/tax-rates.js`**:
   - Add new year object to `TAX_RATES`
   - Update bracket thresholds, personfradrag, minstefradrag, trygdeavgift
2. **Update `popup/popup.html`**:
   - Add new year option to `<select id="taxYear">`
3. **Test with validation script**: `npm run validate`
4. **Update version** in `manifest.json`
5. **Build and release**

### Modifying the Tax Calculation

The calculation logic is in `lib/trekktabell.js`:
- `calculateMonthlyWithholding()`: Monthly withholding (what employer deducts)
- `calculateAnnualTax()`: Actual annual tax (more accurate for occasional overtime)
- `calculateOvertimeTakeHome()`: Main entry point, returns both values

**IMPORTANT**: Always validate changes against the official Skatteetaten calculator (https://tabellkort.app.skatteetaten.no/). The algorithm should be within ±2% of official values.

### Fixing DOM Detection Issues

If timer.bekk.no changes their HTML structure:

1. **Inspect the page** to find the new structure around "Overtid" row
2. **Update `findOvertimeRow()`** in `content/content.js`
3. **Preserve these stability points**:
   - Search for "Nøkkeltall" heading first (establishes context)
   - Use `[class*="_row_"]` pattern (survives CSS Module hash changes)
   - Match on text "Overtid" (business domain term, unlikely to change)
4. **Test with different labels**: "Overtid januar", "Overtid (uke 2-4)", etc.

## Distribution & Updates

Both Firefox and Chrome extensions are published via the `publish-extension.yml` GitHub Actions workflow, triggered on release creation.

### Firefox (Signed, Auto-Updates)

1. **Extension ID**: `{6dda6ba4-e831-46fb-bf60-82b2e1a105cd}` (must remain constant)
2. **Update URL**: Points to `updates.json` in main branch on GitHub
3. **Workflow automatically**:
   - Signs extension via Mozilla Add-ons API (unlisted distribution)
   - Uploads signed `.xpi` to GitHub Release
   - Updates `updates.json` with new version
4. **User updates**: Firefox checks for updates every 24 hours automatically

### Chrome (Unsigned)

1. **Workflow automatically**:
   - Packages extension as `.zip`
   - Uploads to GitHub Release
2. **Current state**: Not yet signed or published to Chrome Web Store
3. **Distribution**: Manual sideloading via `chrome://extensions` (developer mode) or future Chrome Web Store submission

## Known Limitations

1. **Special tax tables not supported**: Only 8000-8400 and 9010-9400 series. Finnmark/offshore/seafarer tables (7xxx) not supported.
2. **Single employer assumption**: Assumes one employer using tabelltrekk. Multiple employers or prosenttrekk not handled.
3. **Estimates only**: Calculates withholding, not final tax liability (determined at year-end skatteoppgjør).
4. **DOM brittleness**: Depends on timer.bekk.no maintaining semantic structure around "Overtid" row.

## Testing Strategy

### Unit Tests
Tests use hardcoded expected values from official Skatteetaten calculator and known edge cases. Run with `npm test`.

### Validation
`npm run validate` compares calculations against official values. **Run after updating tax rates.**

### Manual Testing Checklist
1. Load unpacked extension
2. Configure settings in popup (test validation)
3. Navigate to timer.bekk.no
4. Verify injected amount appears
5. Test with different overtime hours (including 0)
6. Test hover popup shows breakdown
7. Change settings and verify live update

## Code Style

- **Semicolons**: Used consistently throughout
- **camelCase**: Functions and variables
- **UPPER_SNAKE_CASE**: Constants
- **Comments**: JSDoc for public functions; inline for complex logic
- **Norwegian in UI**: All user-facing text
- **English in code**: Variable names, comments, documentation

## Useful References

- **Tax brackets**: https://www.skatteetaten.no/en/rates/bracket-tax/
- **Skatteetaten algorithm** (Java): https://github.com/Skatteetaten/trekktabell
- **Online calculator**: https://tabellkort.app.skatteetaten.no/
