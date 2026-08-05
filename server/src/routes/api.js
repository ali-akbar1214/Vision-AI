const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const upload = multer({ storage: multer.memoryStorage() });
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

// -------------------------------------------------------------
// Health & System Status Endpoint
// -------------------------------------------------------------
router.get('/status', async (req, res) => {
  let fastApiOnline = false;
  let ollamaDetails = { online: false };

  try {
    const resp = await axios.get(`${FASTAPI_URL}/api/v1/ollama-status`, { timeout: 2500 });
    fastApiOnline = true;
    ollamaDetails = resp.data;
  } catch (err) {
    fastApiOnline = false;
  }

  res.json({
    server: 'Express MERN Backend',
    fastapi_service: {
      url: FASTAPI_URL,
      online: fastApiOnline
    },
    ollama: ollamaDetails
  });
});

// -------------------------------------------------------------
// MODE 1: Document Reader & OCR Endpoint
// -------------------------------------------------------------
router.post('/reader/extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    const query = req.body.query || '';
    const form = new FormData();
    form.append('file', req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });
    if (query) form.append('query', query);

    let apiData = null;
    try {
      const headers = form.getHeaders();
      headers['x-api-key'] = process.env.API_KEY || 'dev-api-key-change-in-production';
      const response = await axios.post(`${FASTAPI_URL}/api/v1/ocr-read`, form, {
        headers: headers,
        timeout: 120000
      });
      apiData = response?.data?.data || response?.data;
      if (!apiData || response?.data?.success === false) {
        throw new Error(response?.data?.detail || response?.data?.error || 'FastAPI returned no OCR result');
      }
    } catch (e) {
      const detail = e.response?.data?.detail || e.response?.data?.error || e.message;
      console.warn('FastAPI OCR request failed, using fallback:', detail);
      
      // Fallback OCR response
      apiData = {
        extracted_text: `Document analysis completed for: ${req.file.originalname}\n\nThis is a fallback OCR result. The FastAPI service is currently unavailable, so this is simulated text extraction. To enable real OCR, ensure the FastAPI service is running on port 8000 and Ollama is available with a vision model.\n\nSample extracted content would appear here based on the actual document image.`,
        summary: 'Fallback OCR extraction - FastAPI service unavailable',
        ai_answer: query ? `Based on the document, here's a simulated answer to "${query}": This is a fallback response. Enable the FastAPI service for real AI-powered answers.` : 'Extraction complete.',
        source: 'fallback_engine'
      };
    }

    res.json({ success: true, data: apiData });
  } catch (err) {
    console.error('Reader error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// MODE 2: Item Classification (Match / No Match) Endpoint
// -------------------------------------------------------------
router.post('/classify', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }
    const targetItem = req.body.target_item || 'Unknown Item';

    const form = new FormData();
    form.append('file', req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });
    form.append('target_item', targetItem);

    let apiData = null;
    try {
      const headers = form.getHeaders();
      headers['x-api-key'] = process.env.API_KEY || 'dev-api-key-change-in-production';
      const response = await axios.post(`${FASTAPI_URL}/api/v1/classify`, form, {
        headers: headers,
        timeout: 60000
      });
      apiData = response.data.data;
    } catch (e) {
      console.warn('FastAPI offline, classification service unavailable:', e.message);
      apiData = {
        target_item: targetItem,
        match: null,
        confidence: null,
        detected_item: null,
        reasoning: 'Classification service is currently offline. Please try again shortly.',
        source: 'unavailable',
        llm_used: false
      };
    }

    res.json({ success: true, data: apiData });
  } catch (err) {
    console.error('Classify error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// MODE 3: Document vs Form Cross-Verification Endpoint
// -------------------------------------------------------------
router.post('/verify', upload.fields([{ name: 'front_image', maxCount: 1 }, { name: 'back_image', maxCount: 1 }]), async (req, res) => {
  try {
    if (!req.files || !req.files.front_image) {
      return res.status(400).json({ error: 'Front image of document is required.' });
    }

    const formDataBody = req.body.form_data ? JSON.parse(req.body.form_data) : {};
    const frontFile = req.files.front_image[0];
    const backFile = req.files.back_image ? req.files.back_image[0] : null;

    // Enforce image-only uploads at the API layer
    const isPdfFront = frontFile.mimetype === 'application/pdf' || frontFile.originalname.toLowerCase().endsWith('.pdf');
    const isPdfBack = backFile && (backFile.mimetype === 'application/pdf' || backFile.originalname.toLowerCase().endsWith('.pdf'));
    if (isPdfFront || isPdfBack) {
      return res.status(400).json({ error: 'Verifier accepts image uploads only (PNG/JPEG). PDFs are not accepted.' });
    }

    const form = new FormData();
    form.append('form_json', JSON.stringify(formDataBody));
    form.append('front_file', frontFile.buffer, { filename: frontFile.originalname, contentType: frontFile.mimetype });
    if (backFile) {
      form.append('back_file', backFile.buffer, { filename: backFile.originalname, contentType: backFile.mimetype });
    }

    let apiData = null;
    try {
      const headers = form.getHeaders();
      headers['x-api-key'] = process.env.API_KEY || 'dev-api-key-change-in-production';
      const response = await axios.post(`${FASTAPI_URL}/api/v1/verify-form`, form, {
        headers: headers,
        timeout: 60000
      });
      apiData = response.data.data;
    } catch (e) {
      console.warn('FastAPI offline, verification service unavailable:', e.message);

      // Return honest unavailable state instead of fake scores
      apiData = {
        verdict: 'UNAVAILABLE',
        verdict_description: 'Verification service is currently offline. Please try again shortly.',
        overall_similarity: null,
        document_classification: {
          is_cnic: null,
          detected_type: null,
          confidence: null
        },
        field_results: [],
        extracted_document_data: null,
        form_submitted_data: formDataBody,
        source: 'unavailable',
        llm_used: false
      };
    }

    res.json({ success: true, data: apiData });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
