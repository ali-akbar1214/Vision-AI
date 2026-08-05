import React, { useState } from 'react';
import { Upload, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';

export default function ItemClassifierMode() {
  const [targetItem, setTargetItem] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file (PNG/JPEG). PDFs are not accepted.');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleClassify = async (e) => {
    e.preventDefault();
    if (!targetItem.trim() || !selectedFile) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('target_item', targetItem.trim());
      formData.append('file', selectedFile);
      const response = await axios.post('/api/classify', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'x-api-key': 'dev-api-key-change-in-production'
        }
      });
      if (response.data.success) setResult(response.data.data);
    } catch (err) {
      alert('Classification error: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid-layout grid-2col">
      {/* ====== LEFT: Input Form ====== */}
      <div>
        <form onSubmit={handleClassify} className="card">
          <div className="card-header">
            <h2 className="card-title">Item Classifier</h2>
            <p className="card-subtitle">Specify a target item and upload a photo to verify a match.</p>
          </div>

          <div className="form-group">
            <label className="form-label">Target Item to Recognize</label>
            <input
              type="text"
              required
              className="form-input"
              placeholder="e.g., CNIC Card, Driver License..."
              value={targetItem}
              onChange={(e) => setTargetItem(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Upload Photo</label>
            <label htmlFor="classifier-file" className={`dropzone ${previewUrl ? 'active' : ''}`}>
              <input id="classifier-file" type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
              {previewUrl ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <img src={previewUrl} alt="Preview" className="img-preview" />
                  <span style={{ fontSize: 'var(--fs-sm)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {selectedFile?.name}
                  </span>
                </div>
              ) : (
                <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <Upload style={{ width: 24, height: 24, color: 'var(--text-muted)' }} />
                  <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>Click to upload or drag & drop</p>
                  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>JPG, PNG, or WEBP images only</p>
                </div>
              )}
            </label>
          </div>

          <button type="submit" disabled={!targetItem.trim() || !selectedFile || loading} className="btn btn-primary btn-block">
            {loading ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Classifying...
              </>
            ) : (
              'Verify Match'
            )}
          </button>
        </form>
      </div>

      {/* ====== RIGHT: Classification Results ====== */}
      <div>
        <div className="card" style={{ height: '100%' }}>
          <div className="card-header">
            <h2 className="card-title">Classification Result</h2>
            <p className="card-subtitle">AI verdict and model confidence</p>
          </div>

          {!result && !loading && (
            <div className="empty-state">
              <p>Ready to classify. Enter target and upload photo.</p>
            </div>
          )}

          {loading && (
            <div className="loading-state">
              <div className="spinner" style={{ marginBottom: 16 }} />
              <p>Evaluating vision features...</p>
            </div>
          )}

          {result && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Verdict Banner */}
              {result.match === null ? (
                <div style={{
                  padding: '24px', borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-elevated)',
                  display: 'flex', alignItems: 'center', gap: 16
                }}>
                  <AlertCircle style={{ width: 32, height: 32, color: 'var(--text-muted)' }} />
                  <div>
                    <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-muted)' }}>
                      Service Unavailable
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{result.reasoning}</p>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '24px', borderRadius: 'var(--radius-lg)',
                  border: `1px solid ${result.match ? '#00FF94' : '#FF4757'}`,
                  background: result.match ? 'rgba(0, 255, 148, 0.15)' : 'rgba(255, 71, 87, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {result.match
                      ? <CheckCircle2 style={{ width: 32, height: 32, color: '#00FF94' }} />
                      : <XCircle style={{ width: 32, height: 32, color: '#FF4757' }} />
                    }
                    <div>
                      <h3 style={{ fontSize: 20, fontWeight: 700, color: result.match ? '#00FF94' : '#FF4757' }}>
                        {result.match ? 'Match Detected' : 'No Match'}
                      </h3>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Target: "{result.target_item}"</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {result.confidence}%
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Model Confidence</div>
                  </div>
                </div>
              )}

              <div>
                <div className="value-display-label">Detected Object</div>
                <div className="value-display">{result.detected_item}</div>
              </div>

              <div>
                <div className="value-display-label">Reasoning</div>
                <div className="value-display">{result.reasoning}</div>
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
