# OCR module

This server uses the OS-installed Tesseract CLI for OCR.

## Requirements (dev container)

- `tesseract-ocr`
- `poppler-utils` (for `pdftoppm`, used to rasterize PDF pages)

Install:

```bash
sudo apt-get update && sudo apt-get install -y tesseract-ocr poppler-utils
```

## API

- `extractTextFromUploads(uploads)`
  - `uploads` is the `multer` file array (`req.files`)
  - returns concatenated OCR text
