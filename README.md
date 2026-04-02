# ISBN Barcode Generator

A single-page web app that generates EAN-13 barcodes from ISBN numbers. It validates ISBN-10 and ISBN-13 inputs, converts ISBN-10 to ISBN-13, and renders a standards-compliant barcode with the ISBN label printed above and numeric digits below.

## Features

- Accepts ISBN-10 and ISBN-13 (hyphens and spaces are stripped automatically)
- Validates checksums for both formats
- Converts ISBN-10 to ISBN-13
- Renders EAN-13 barcode on a canvas with start/center/end guards
- Displays formatted ISBN text above the barcode
- Download barcode as PNG

## Running the App

Open `isbn-barcode-generator.html` in any modern browser. No build step or server required.

Alternatively, serve it locally:

```bash
npx serve .
```

## Running Tests

Tests use Node.js built-in test runner (Node 18+):

```bash
node --test barcode.test.js
```

## Project Structure

```
barcode.js                   Core logic (encoding tables, validation, EAN-13 encoder)
barcode.test.js              Test suite (58 tests)
isbn-barcode-generator.html  Web UI and barcode rendering
```
