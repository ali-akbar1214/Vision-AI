import React, { useState } from 'react';
import { Upload, Volume2, VolumeX, Copy, Check, FileText, MessageSquare } from 'lucide-react';
import axios from 'axios';

export default function DocReaderMode() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleExtract = async () => {
    if (!selectedFile) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (query) formData.append('query', query);
      const response = await axios.post('/api/reader/extract', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'x-api-key': 'dev-api-key-change-in-production'
        }
      });
      if (response.data.success) setResult(response.data.data);
    } catch (err) {
      alert('Extraction failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyText = () => {
    if (result?.extracted_text) {
      navigator.clipboard.writeText(result.extracted_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSpeak = () => {
    if (!result?.extracted_text) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(result.extracted_text);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="grid-layout grid-2col">
      {/* ====== LEFT: Upload & Query ====== */}
      <div>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Document Upload</h2>
            <p className="card-subtitle">Upload any document, invoice, or receipt for extraction.</p>
          </div>

          {/* Dropzone */}
          <div className="form-group">
            <label className="form-label">File</label>
            <label
              htmlFor="reader-file"
              className={`dropzone ${previewUrl ? 'active' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <input id="reader-file" type="file" accept="image/*,application/pdf,.pdf" className="sr-only" onChange={handleFileChange} />
              {previewUrl ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  {selectedFile?.type?.startsWith('image/') ? (
                    <img src={previewUrl} alt="Preview" className="img-preview" />
                  ) : (
                    <FileText style={{ width: 48, height: 48, color: 'var(--accent-primary)' }} />
                  )}
                  <span style={{ fontSize: 'var(--fs-sm)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {selectedFile?.name}
                  </span>
                </div>
              ) : (
                <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <Upload style={{ width: 24, height: 24, color: 'var(--text-muted)' }} />
                  <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>Click to upload or drag & drop</p>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>JPG, PNG, WEBP, or PDF Documents — max 15MB</p>
                </div>
              )}
            </label>
          </div>

          {/* AI Q&A Input */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MessageSquare style={{ width: 14, height: 14 }} />
              Ask AI a Question
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. What is the total amount?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <button
            onClick={handleExtract}
            disabled={!selectedFile || loading}
            className="btn btn-primary btn-block"
            style={{ marginTop: 8 }}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Processing...
              </>
            ) : (
              'Extract Document'
            )}
          </button>
        </div>
      </div>

      {/* ====== RIGHT: Results ====== */}
      <div>
        <div className="card" style={{ height: '100%' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="card-title">Document Insights</h2>
              <p className="card-subtitle">Extracted text and AI analysis</p>
            </div>
            {result && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleSpeak} className="btn btn-secondary">
                  {isSpeaking ? <><VolumeX style={{ width: 14, height: 14 }} /> Stop</> : <><Volume2 style={{ width: 14, height: 14 }} /> Read</>}
                </button>
                <button onClick={handleCopyText} className="btn btn-secondary">
                  {copied ? <><Check style={{ width: 14, height: 14, color: '#00FF94' }} /> Copied</> : <><Copy style={{ width: 14, height: 14 }} /> Copy</>}
                </button>
              </div>
            )}
          </div>

          {/* Empty State */}
          {!result && !loading && (
            <div className="empty-state">
              <p>No document processed yet.</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="loading-state">
              <div className="spinner" style={{ marginBottom: 16 }} />
              <p>Analyzing document...</p>
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {result.summary && (
                <div>
                  <div className="value-display-label">Summary</div>
                  <div className="value-display">{result.summary}</div>
                </div>
              )}

              {result.ai_answer && result.ai_answer !== 'Extraction complete.' && (
                <div>
                  <div className="value-display-label">AI Answer</div>
                  <div className="value-display" style={{ borderColor: 'var(--accent-secondary)' }}>{result.ai_answer}</div>
                </div>
              )}

              <div>
                <div className="value-display-label">Raw Extracted Text</div>
                <div className="code-block">{result.extracted_text}</div>
              </div>

              <div style={{ textAlign: 'right', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                Source: {result.source}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
