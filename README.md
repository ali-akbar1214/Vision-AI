# Vision OCR Suite

An AI-powered document processing and verification system designed to extract information from documents, classify visual content, and verify extracted data against document images.

The system combines **OCR, Vision-Language Models (VLMs), document processing, and automated verification** into a unified pipeline.

---

## 🚀 Features

* 📄 **Document & PDF Processing**

  * Upload and process PDF documents and images.
  * Convert PDF pages into processable images.
  * Extract text and structured information from documents.

* 🔎 **OCR & Data Extraction**

  * Extract relevant fields from documents.
  * Process unstructured document content into structured data.
  * Validate extracted information.

* 🖼️ **Image Classification & Verification**

  * Compare a provided label/value against information visible in an image.
  * Determine whether the submitted information matches the document.
  * Return structured verification results.

* 🔗 **Combined OCR + Verification Pipeline**

  * Extract information from a document.
  * Process the extracted information through the verification system.
  * Produce a final validation result.

* 🤖 **Vision-Language Model Integration**

  * Uses vision-language models for image understanding and verification.
  * Supports locally hosted inference for privacy and reduced external API dependency.
  * Qwen2.5-VL can be used as the primary VLM for document understanding and verification.

* 📊 **Structured Results**

  * Return machine-readable extraction and verification results.
  * Provide mismatch information when submitted data does not match the document.

---

## 🏗️ System Architecture

```text
                    ┌─────────────────────┐
                    │    React Frontend   │
                    │      (Vite)         │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     FastAPI API     │
                    │    Python Backend   │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┼─────────────┐
                 │             │             │
                 ▼             ▼             ▼
          ┌────────────┐ ┌────────────┐ ┌────────────┐
          │  Doc Reader│ │  Verifier  │ │ Combined   │
          │    / OCR   │ │ /Classifier│ │  Pipeline  │
          └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
                │              │              │
                └──────────────┼──────────────┘
                               ▼
                    ┌─────────────────────┐
                    │   Vision-Language   │
                    │       Model         │
                    │    Qwen2.5-VL       │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Structured Results  │
                    │  Extraction /       │
                    │  Verification       │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      MongoDB        │
                    └─────────────────────┘
```

---

## 🧩 Core Components

### 1. Doc Reader / OCR

The **Doc Reader** is responsible for processing documents and extracting useful information.

The pipeline generally follows:

```text
PDF / Image
     │
     ▼
Document Processing
     │
     ▼
Page/Image Extraction
     │
     ▼
OCR / Vision Processing
     │
     ▼
Text & Field Extraction
     │
     ▼
Structured Data
```

For PDF documents, individual pages can be converted into images before being passed through the extraction pipeline.

The extracted information can then be normalized and validated before being returned to the user.

---

### 2. Verifier / Classifier

The **Verifier** determines whether a submitted value or label matches the information present in a document image.

Example:

```text
Submitted Value:
Name = "Ali Akbar"

             +
             │
             ▼

       Document Image
             │
             ▼
      Vision-Language Model
             │
             ▼
       Verification Logic
             │
             ▼
      MATCH / MISMATCH
```

The verifier can identify mismatches between the submitted information and the information visible in the document.

A verification response can contain:

```json
{
  "verified": true,
  "mismatches": []
}
```

For failed verification:

```json
{
  "verified": false,
  "mismatches": [
    {
      "field": "name",
      "expected": "Ali Akbar",
      "actual": "Ali Ahmed"
    }
  ]
}
```

---

### 3. Combined OCR + Verification

The combined workflow connects document extraction and verification into a single processing pipeline.

```text
Document
   │
   ▼
OCR / Extraction
   │
   ▼
Extracted Fields
   │
   ▼
Verification
   │
   ▼
Compare Against Image
   │
   ▼
Final Verification Result
```

This allows the system to automatically process a document rather than requiring each step to be performed independently.

---

## 🤖 AI Model

The project uses a **Vision-Language Model (VLM)** to understand both visual information and textual content contained within documents.

### Qwen2.5-VL

The primary model used for the vision-based pipeline is:

```text
Qwen/Qwen2.5-VL-3B-Instruct
```

The model is capable of processing images and understanding their visual and textual content, making it suitable for:

* Document understanding
* Text extraction
* Field identification
* Image-based verification
* Visual question answering
* Structured information extraction

For local deployment, quantized inference can be used to reduce GPU memory requirements.

---

## 🛠️ Technology Stack

### Frontend

* React
* Vite
* JavaScript / HTML / CSS

### Backend

* Python
* FastAPI
* Uvicorn

### AI / ML

* Qwen2.5-VL
* Hugging Face Transformers
* Accelerate
* PyTorch
* Pillow

### Document Processing

* PDF-to-image processing
* OCR / document extraction pipeline
* Image preprocessing

### Database

* MongoDB

---

## 🔌 API Endpoints

The backend exposes APIs for the individual processing components.

### OCR

```http
POST /api/v1/ocr-read
```

Processes a document and extracts relevant information.

---

### Classification

```http
POST /api/v1/classify
```

Processes an image and determines whether the visual content corresponds to the supplied label/value.

---

### Form Verification

```http
POST /api/v1/verify-form
```

Verifies submitted fields against information contained within a document image.

---

## 📥 Example Workflow

### Step 1 — Upload Document

The user uploads a PDF or image through the frontend.

### Step 2 — Process Document

The backend processes the document and converts PDF pages into images when necessary.

### Step 3 — Extract Information

The OCR/document processing pipeline extracts relevant text and fields.

### Step 4 — Verify Information

The extracted or submitted fields are checked against the original document using the vision-language model.

### Step 5 — Generate Result

The system returns structured information indicating whether the document data is valid or contains mismatches.

---

## 📁 Project Structure

A typical structure is:

```text
vision-ocr-suite/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── api/
│   ├── services/
│   ├── models/
│   ├── utils/
│   └── main.py
│
├── models/
│   └── Qwen2.5-VL/
│
├── requirements.txt
├── README.md
└── .env
```

> The exact structure may differ depending on the current project version.

---

## ⚙️ Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd vision-ocr-suite
```

### 2. Create a Python Virtual Environment

```bash
python -m venv venv
```

Activate it on Windows:

```bash
venv\Scripts\activate
```

### 3. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 4. Install Frontend Dependencies

```bash
cd frontend
npm install
```

---

## 🔐 Environment Variables

Create a `.env` file and configure the required environment variables.

Example:

```env
MONGODB_URI=<your-mongodb-connection-string>
```

Additional environment variables can be configured according to the deployment environment.

---

## ▶️ Running the Project

### Start the Backend

From the backend directory:

```bash
uvicorn main:app --reload
```

The FastAPI server will be available locally.

### Start the Frontend

```bash
npm run dev
```

The Vite development server will provide the frontend interface.

---

## 🔄 Processing Pipeline

The overall system can be summarized as:

```text
                    INPUT
                      │
             ┌────────┴────────┐
             │                 │
          PDF File          Image File
             │                 │
             └────────┬────────┘
                      ▼
              Document Processing
                      │
                      ▼
                OCR / VLM
                      │
                      ▼
             Structured Extraction
                      │
                      ▼
                Normalization
                      │
                      ▼
                 Verification
                      │
             ┌────────┴────────┐
             │                 │
           MATCH            MISMATCH
             │                 │
             ▼                 ▼
          Verified        Error Details
```

---

## 🧪 Verification Logic

Verification is performed by comparing the expected/submitted information with information identified from the document.

The process can be represented as:

```text
Expected Data
      │
      ├──────────────┐
      │              │
      ▼              ▼
Document Image   Submitted Fields
      │              │
      ▼              ▼
   VLM Analysis      │
      │              │
      └──────┬───────┘
             ▼
       Comparison
             │
       ┌─────┴─────┐
       ▼           ▼
     Match      Mismatch
```

Normalization can be applied before comparison to reduce false mismatches caused by differences such as:

* Capitalization
* Leading/trailing whitespace
* Formatting differences
* Minor textual representation differences

---

## 📈 Future Improvements

Potential improvements include:

* Improved document preprocessing
* Better handling of low-quality scans
* More robust field normalization
* Improved verification accuracy
* Support for additional document types
* Batch document processing
* Improved model quantization and inference performance
* More detailed verification reports
* Enhanced error handling and logging
* Additional model evaluation and benchmarking

---

## 🎯 Project Objective

The primary objective of **Vision OCR Suite** is to automate document understanding and verification by combining traditional document processing with modern vision-language models.

Instead of relying solely on conventional OCR, the system uses visual understanding to interpret documents, extract structured information, and verify that submitted information corresponds to the original document.

This creates a complete pipeline for:

**Document → Extraction → Understanding → Verification → Result**

---

## 📄 License

This project is intended for educational, research, and development purposes.

