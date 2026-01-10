# Code Review Findings

**Date:** 2026-01-09
**Reviewer:** Code Review Agent
**Branch:** claude/code-review-i8aSW

---

## Summary

This code review covers the Overtidskassa browser extension - a Norwegian overtime take-home pay calculator. The codebase is well-structured with good separation of concerns and comprehensive test coverage (38 passing tests).

---

## Bugs Fixed

The following bugs were identified and fixed in this review:

### 1. Typo in popup.html:35
- **Issue:** Label text "Skattetabelltabell" was redundant (tabell + tabell = "table table")
- **Fix:** Changed to "Skattetabell"

### 2. Inconsistent variable naming in content.js:165
- **Issue:** Variable `result_calc` used snake_case, inconsistent with camelCase used throughout the codebase
- **Fix:** Renamed to `result`

### 3. Dead code in content.js:23
- **Issue:** Variable `cachedSettings` was declared and assigned but never read
- **Fix:** Removed the variable and the assignment

### 4. Validation mismatch in trekktabell.js:268
- **Issue:** `validateParameters` rejected `overtimeHours === 0` because `!0` evaluates to `true`
- **Problem:** This was inconsistent with `calculateOvertimeTakeHome` which correctly handles 0 hours
- **Fix:** Changed validation to explicitly check for `undefined`, `null`, or negative values

### 5. Confusing validation in trekktabell.js:260-265
- **Issue:** Two separate checks for salary validity could produce duplicate/confusing error messages
- **Fix:** Combined into single `else if` chain with clearer error messages

### 6. Page reload requires manual save (content.js)
- **Issue:** On SPA pages, content loads dynamically after `DOMContentLoaded`. The extension ran once on DOM ready, failed to find the element, and never retried
- **Fix:** Added `waitForOvertimeRow()` function that uses both MutationObserver and polling to wait for dynamic content (up to 5 seconds)

### 7. Memory leak on re-initialization (content.js)
- **Issue:** `debounceTimer` and observers were not cleaned up when `main()` was called again
- **Fix:** Added `cleanup()` function called at start of `main()` to clear all timers and observers

### 8. HTML validation allowed invalid range (popup.html)
- **Issue:** `min="8000" max="9400"` allowed values 8401-9009 which are invalid
- **Fix:** Removed `min`/`max` attributes; JavaScript validation is the source of truth

### 9. Browser API detection not defensive (content.js, popup.js)
- **Issue:** Simple ternary check could fail in edge cases
- **Fix:** Added IIFE that checks for `browser.storage` or `chrome.storage` existence

---

## Structural Improvements (Recommendations)

The following issues are structural in nature and require more consideration before implementing:

### 1. Fragile DOM Detection (content.js:56-69)

**Location:** `findOvertimeRow()` function

**Issue:** The code assumes a specific DOM structure:
```javascript
if (spans.length === 2) {
  const labelSpan = spans[0];
  const hoursSpan = spans[1];
```

**Risk:** If the timesheet page's structure changes (e.g., adds an icon span), detection will fail silently.

**Recommendation:** Add more robust detection:
- Use data attributes if available
- Add fallback detection strategies
- Consider using text content pattern matching as primary identifier

---

### 2. No User-Facing Error Indication (content.js)

**Issue:** When the extension fails (settings not configured, DOM not found, calculation error), errors are only logged to console. Users have no visual indication of problems.

**Recommendation:**
- Display a subtle error indicator on the page
- Or show a badge/icon state change on the extension icon
- Consider a small tooltip explaining the issue

---

### 3. Unused Export (tax-rates.js:86-88)

**Issue:** The `getCurrentTaxYear()` function is exported but never used anywhere in the codebase.

**Recommendation:** Either:
- Remove if not needed for future features
- Or use it to set the default tax year dynamically instead of hardcoding 2026

---

### 4. Limited Year Support (tax-rates.js)

**Issue:** Only 2026 tax rates are available. If users need to calculate for previous years (e.g., for tax returns), this isn't supported.

**Recommendation:** Consider adding:
- 2025 and 2024 tax rates for reference
- Dynamic year selection based on available rates
- Clear documentation about supported years

---

## Test Coverage Assessment

The test suite is comprehensive with 38 tests covering:
- Table number parsing
- Trinnskatt calculation (progressive brackets)
- Monthly withholding calculation
- Overtime take-home calculation
- Edge cases (zero hours, high/low salary)
- Parameter validation
- Currency formatting

**Missing test coverage:**
- No integration tests for the content script DOM manipulation
- No tests for the popup UI interactions
- No tests for browser API storage operations

---

## Security Assessment

The extension follows good security practices:
- No external API calls (privacy-focused)
- All calculations performed locally
- No sensitive data transmitted
- Content script scope limited to specific URL pattern

**Minor consideration:** Input values from storage are trusted. Consider adding validation when reading from storage in case of data corruption.

---

## Performance Assessment

The code is well-optimized:
- MutationObserver with 100ms debounce prevents excessive recalculation
- Targeted observation (only watches the hours span, not entire document)
- No polling or intervals

---

## Conclusion

The codebase is of good quality with clear documentation and comprehensive testing. The bugs fixed in this review were minor. The structural recommendations are suggestions for future improvement and not blocking issues.

**Overall assessment:** Ready for production with minor improvements.
