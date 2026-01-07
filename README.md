# Overtidskassa - Overtime Take-Home Calculator

A browser extension for calculating estimated take-home pay for overtime hours in Norway, accounting for Norwegian tax withholding (tabelltrekk).

## Project Status

This project is in the planning phase. See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the complete implementation specification.

## Overview

This extension will:
- Calculate overtime take-home pay based on Norwegian tax rates (2026)
- Use algorithmic tax withholding calculation (tabelltrekk) based on Skatteetaten's open-source implementation
- Inject results directly into company timesheet pages
- Support standard tax tables (8000-8400 and 9010-9400 series)

## Key Features

- Accurate marginal tax calculation for overtime hours
- Support for both fradragstabeller (deduction tables) and tilleggstabeller (addition tables)
- Non-intrusive browser extension interface
- Configurable per user (yearly salary, table number)

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

## License

TBD

## Disclaimer

This tool provides estimates based on tax withholding tables. Actual tax liability is determined during the annual tax settlement (skatteoppgjør). Consult a tax professional for specific advice.
