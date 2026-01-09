# Overtidskassa - Overtime Take-Home Calculator

A browser extension for calculating estimated take-home pay for overtime hours in Norway, accounting for Norwegian tax withholding (tabelltrekk).

## Project Status

**Phase 1 (Core Algorithm): COMPLETED ✓**
- Tax calculation engine implemented
- Unit tests passing (38/38)
- Validation test cases generated

**Phase 2 (Extension Popup): COMPLETED ✓**
- Popup UI with settings form implemented
- Settings save/load functionality working
- Input validation with real-time feedback
- Cross-browser support (pending manual testing)

**Phase 3 (Content Script): COMPLETED ✓**
- DOM detection using CSS module patterns
- Overtime hours parsing
- Inline injection strategy
- MutationObserver for dynamic updates
- Graceful error handling

**Phase 4 (Integration): IN PROGRESS**
- [ ] Update manifest with actual timesheet URL pattern
- [ ] Create extension icons
- [ ] End-to-end testing on real timesheet
- [ ] Package for distribution

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the complete implementation specification.

## Overview

This extension:
- Calculates overtime take-home pay based on Norwegian tax rates (2026)
- Uses algorithmic tax withholding calculation (tabelltrekk) based on Skatteetaten's methodology
- Injects results directly into company timesheet pages
- Supports standard tax tables (8000-8400 and 9010-9400 series)
- Performs all calculations locally in your browser (privacy-focused)

## Key Features

- **Accurate marginal tax calculation** for overtime hours
- **Support for both fradragstabeller** (deduction tables) and **tilleggstabeller** (addition tables)
- **Non-intrusive interface** - displays inline with your timesheet
- **Real-time updates** - automatically recalculates when overtime hours change
- **Privacy-focused** - all data stays in your browser

## Installation

### Chrome

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the `overtidskassa` folder
6. The extension icon should appear in your toolbar

### Firefox

1. Download or clone this repository
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox"
4. Click "Load Temporary Add-on"
5. Select the `manifest.json` file from the `overtidskassa` folder

**Note**: For permanent installation in Firefox, the extension needs to be signed.

## Configuration

Before using the extension, you need to configure your settings:

1. Click the extension icon in your browser toolbar
2. Enter your information:
   - **Årlig brutto lønn**: Your annual gross salary in NOK (e.g., 900000)
   - **Skattetabelltabell**: Your tax table number from your skattetrekkskort
     - Fradragstabeller: 8000-8400 (e.g., 8115 = 115,000 NOK in deductions)
     - Tilleggstabeller: 9010-9400 (e.g., 9050 = 50,000 NOK in additions)
   - **Skatteår**: Tax year (currently only 2026 is supported)
3. Click "Lagre innstillinger" to save

The extension will validate your input and show any errors in real-time.

## Usage

Once configured:

1. Navigate to your timesheet page
2. The extension will automatically detect overtime hours
3. Estimated take-home pay appears inline next to the hours

Example display:
```
Overtid januar (uke 2-4)    10.5 t (3 264 kr)
```

The amount shown is your estimated net take-home pay after tax withholding.

## Important Note: URL Configuration

**Before the extension will work on your timesheet, you need to update the URL pattern in `manifest.json`:**

1. Open `manifest.json`
2. Find the `content_scripts` section
3. Update the `matches` array with your company's timesheet URL pattern

Example:
```json
"content_scripts": [
  {
    "matches": ["https://your-company-timesheet.com/*"],
    ...
  }
]
```

The placeholder URL `https://timesheet.example.com/*` will not match any real page.

## Development

### Project Structure

```
overtidskassa/
├── manifest.json           # Extension manifest
├── popup/
│   ├── popup.html         # Settings popup UI
│   ├── popup.css          # Popup styles
│   └── popup.js           # Settings management
├── content/
│   ├── content.js         # Content script (DOM injection)
│   └── content.css        # Injected element styles
├── lib/
│   ├── tax-rates.js       # 2026 tax rates and constants
│   └── trekktabell.js     # Tax calculation algorithm
└── test/
    ├── trekktabell.test.js           # Unit tests
    └── validate-against-skatteetaten.js  # Validation tests
```

### Running Tests

```bash
# Run all tests
npm test

# Or run directly
node test/trekktabell.test.js
```

All tests should pass (38/38). The validation script generates test cases that can be manually verified against the [official Skatteetaten calculator](https://tabellkort.app.skatteetaten.no/).

## Documentation

- [Implementation Plan](IMPLEMENTATION_PLAN.md) - Complete technical specification and development roadmap

## Tax Calculation Method

The extension implements the Norwegian tax withholding algorithm (tabelltrekk) by:
1. Calculating normal monthly withholding
2. Calculating withholding on (normal salary + overtime)
3. Taking the difference to isolate overtime tax
4. Deducting overtime tax from overtime gross pay

This accounts for:
- Trinnskatt (bracket tax)
- Trygdeavgift (national insurance)
- Alminnelig inntekt (general income tax)
- Minstefradrag (minimum deduction)
- Personfradrag (personal allowance)

## Accuracy and Limitations

### Accuracy

This extension provides an **estimate** of overtime take-home pay based on Norwegian tax withholding (tabelltrekk) rules. For typical salaries, the estimate should be accurate within ±2%.

The actual amount may differ slightly due to:
- Rounding in official payroll systems
- Timing of feriepenger (vacation pay)
- Company-specific payroll adjustments
- Final tax settlement (skatteoppgjør) at year-end

### Limitations

- **Standard tables only**: Supports table numbers 8000-8400 and 9010-9400. Special tables (7150 for Finnmark, 7160 for offshore, etc.) are not supported.
- **Single employer**: Assumes you have one employer using tabelltrekk. Multiple employers or prosenttrekk scenarios are not handled.
- **Withholding only**: This calculates tax withholding, not your final tax liability.
- **No wealth tax**: Wealth tax (formue) is omitted as it doesn't affect salary withholding.

## Privacy

This extension is privacy-focused:

- ✅ All calculations happen locally in your browser
- ✅ Settings are stored only in local browser storage
- ✅ No external API calls or network requests
- ✅ No personal data collection or transmission
- ✅ No usage tracking or analytics
- ✅ Open source and fully auditable

Your salary information never leaves your computer.

## Data Sources

Tax rates and calculation methodology are based on:
- [Skatteetaten's official trekktabell algorithm](https://github.com/Skatteetaten/trekktabell)
- [Official bracket tax rates](https://www.skatteetaten.no/en/rates/bracket-tax/)
- [Table number explanation](https://www.skatteetaten.no/en/business-and-organisation/employer/tax-deduction-cards-and-tax-deductions/)

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests (`npm test`)
5. Submit a pull request

### Adding New Tax Years

To add support for a new tax year:

1. Update `lib/tax-rates.js` with new rates
2. Update the tax year dropdown in `popup/popup.html`
3. Add test cases in `test/trekktabell.test.js`
4. Verify against the official Skatteetaten calculator

## License

MIT License - See LICENSE file for details.

## Disclaimer

This software is provided "as is" for informational purposes. The calculated amounts are estimates and should not be considered official tax advice. Always verify with your employer's payroll department or Skatteetaten for official figures.

Actual tax liability is determined during the annual tax settlement (skatteoppgjør). This extension calculates withholding only, not final tax amounts.
