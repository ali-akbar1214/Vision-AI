import React, { useState } from 'react';
import { ShieldCheck, Upload, CheckCircle2, XCircle, AlertTriangle, FileCheck, AlertCircle } from 'lucide-react';
import axios from 'axios';

export default function FormVerifierMode() {
  const [frontFile, setFrontFile] = useState(null);
  const [frontPreview, setFrontPreview] = useState('');
  const [backFile, setBackFile] = useState(null);
  const [backPreview, setBackPreview] = useState('');

  const [formData, setFormData] = useState({
    full_name: '',
    father_name: '',
    cnic_number: '',
    date_of_birth: '',
    issue_date: '',
    expiry_date: '',
    gender: 'Male'
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [justUploaded, setJustUploaded] = useState(false);

  const handleInputChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleFrontChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Accept images only (guard in UI too)
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file (PNG/JPEG). PDFs are not accepted.');
        return;
      }
      setFrontFile(file);
      setFrontPreview(URL.createObjectURL(file));
      setResult(null);
      // trigger a short upload animation
      setJustUploaded(true);
      setTimeout(() => setJustUploaded(false), 900);
    }
  };

  const handleBackChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file (PNG/JPEG). PDFs are not accepted.');
        return;
      }
      setBackFile(file);
      setBackPreview(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!frontFile) return;
    setLoading(true);
    try {
      const payload = new FormData();
      payload.append('form_data', JSON.stringify(formData));
      payload.append('front_image', frontFile);
      if (backFile) payload.append('back_image', backFile);
      const response = await axios.post('/api/verify', payload, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'x-api-key': 'dev-api-key-change-in-production'
        }
      });
      if (response.data.success) setResult(response.data.data);
    } catch (err) {
      alert('Verification failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const verdictConfig = {
    VERIFIED_MATCH: { color: '#00FF94', bg: 'rgba(0, 255, 148, 0.15)', border: '#00FF94', icon: CheckCircle2 },
    PARTIAL_MATCH: { color: '#FFB800', bg: 'rgba(255, 184, 0, 0.15)', border: '#FFB800', icon: AlertTriangle },
    MISMATCH: { color: '#FF4757', bg: 'rgba(255, 71, 87, 0.15)', border: '#FF4757', icon: XCircle },
    REJECTED_INVALID_DOCUMENT: { color: '#FF4757', bg: 'rgba(255, 71, 87, 0.15)', border: '#FF4757', icon: FileCheck },
    UNAVAILABLE: { color: 'var(--text-muted)', bg: 'var(--surface-elevated)', border: 'var(--border-subtle)', icon: AlertCircle },
  };

  const formFields = [
    { key: 'full_name', label: 'Full Name', type: 'text', required: true, span: 1 },
    { key: 'father_name', label: 'Father / Husband Name', type: 'text', required: true, span: 1 },
    { key: 'cnic_number', label: 'CNIC / ID Number', type: 'text', required: true, span: 1, mono: true, placeholder: '42101-1234567-9' },
    { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'], span: 1 },
    { key: 'date_of_birth', label: 'Date of Birth', type: 'date', span: 1 },
    { key: 'issue_date', label: 'Issue Date', type: 'date', span: 1 },
    { key: 'expiry_date', label: 'Expiry Date', type: 'date', span: 1 },
  ];

  return (
    <div className="grid-layout grid-2col">
      {/* ====== LEFT: Upload & Form ====== */}
      <div>
        <form onSubmit={handleVerify} className={`card ${justUploaded ? 'upload-animate' : ''}`}>
          <div className="card-header">
            <h2 className="card-title">CNIC Verifier</h2>
            <p className="card-subtitle">Cross-reference document photos with personal details.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {/* Front */}
            <div>
              <label className="form-label">CNIC Front / Doc *</label>
              <label htmlFor="front-file" className={`dropzone ${frontPreview ? 'active' : ''}`} style={{ padding: 12 }}>
                <input id="front-file" type="file" accept="image/*" className="sr-only" onChange={handleFrontChange} />
                {frontPreview ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <img src={frontPreview} alt="Front" style={{ height: 60, objectFit: 'contain' }} />
                    <span style={{ fontSize: 'var(--fs-sm)', fontFamily: 'var(--font-mono)' }}>Front Selected</span>
                  </div>
                ) : (
                  <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <Upload style={{ width: 20, height: 20, color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}>Upload Front Image (PNG/JPEG)</span>
                  </div>
                )}
              </label>
            </div>

            {/* Back */}
            <div>
              <label className="form-label">CNIC Back / Doc</label>
              <label htmlFor="back-file" className={`dropzone ${backPreview ? 'active' : ''}`} style={{ padding: 12 }}>
                <input id="back-file" type="file" accept="image/*" className="sr-only" onChange={handleBackChange} />
                {backPreview ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <img src={backPreview} alt="Back" style={{ height: 60, objectFit: 'contain' }} />
                    <span style={{ fontSize: 'var(--fs-sm)', fontFamily: 'var(--font-mono)' }}>Back Selected</span>
                  </div>
                ) : (
                  <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <Upload style={{ width: 20, height: 20, color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}>Upload Back Image (optional)</span>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div style={{ marginBottom: 16, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Personal Details
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {formFields.map(f => (
              <div key={f.key} style={{ gridColumn: f.span === 2 ? 'span 2' : 'span 1' }}>
                <label className="form-label">{f.label}</label>
                {f.type === 'select' ? (
                  <select
                    className="form-input"
                    value={formData[f.key]}
                    onChange={(e) => handleInputChange(f.key, e.target.value)}
                  >
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type}
                    required={f.required}
                    className="form-input"
                    placeholder={f.placeholder || ''}
                    value={formData[f.key]}
                    onChange={(e) => handleInputChange(f.key, e.target.value)}
                    style={f.mono ? { fontFamily: 'var(--font-mono)' } : {}}
                  />
                )}
              </div>
            ))}
          </div>

          <button type="submit" disabled={!frontFile || loading} className="btn btn-primary btn-block" style={{ marginTop: 24 }}>
            {loading ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Verifying...
              </>
            ) : (
              'Verify Form vs Document'
            )}
          </button>
        </form>
      </div>

      {/* ====== RIGHT: Verification Results ====== */}
      <div>
        <div className="card" style={{ height: '100%' }}>
          <div className="card-header">
            <h2 className="card-title">Verification Matrix</h2>
            <p className="card-subtitle">Field-by-field similarity analysis</p>
          </div>

          {!result && !loading && (
            <div className="empty-state">
              <p>No verification performed yet.</p>
            </div>
          )}

          {loading && (
            <div className="loading-state">
              <div className="spinner" style={{ marginBottom: 16 }} />
              <p>Cross-referencing fields...</p>
            </div>
          )}

          {result && !loading && (() => {
            const vc = verdictConfig[result.verdict] || verdictConfig.MISMATCH;
            const VerdictIcon = vc.icon;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Verdict Banner */}
                <div style={{
                  padding: '24px', borderRadius: 'var(--radius-lg)',
                  background: vc.bg,
                  border: `1px solid ${vc.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <VerdictIcon style={{ width: 32, height: 32, color: vc.color }} />
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: vc.color }}>
                        {result.verdict.replace(/_/g, ' ')}
                      </h3>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {result.verdict_description}
                      </p>
                    </div>
                  </div>
                  {result.overall_similarity !== null && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                        {result.overall_similarity}%
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Overall Score</div>
                    </div>
                  )}
                </div>

                {/* Classification Box */}
                {result.document_classification && (
                  <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <ShieldCheck style={{ width: 24, height: 24, color: result.document_classification.is_cnic ? '#00FF94' : '#FF4757' }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Document Classification</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{result.document_classification.detected_type}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`badge ${result.document_classification.is_cnic ? 'badge-success' : 'badge-danger'}`}>
                        {result.document_classification.is_cnic ? 'Valid CNIC' : 'Invalid Document'}
                      </span>
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>
                        {result.document_classification.confidence}% Conf.
                      </div>
                    </div>
                  </div>
                )}

                {/* Progress bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>
                    <span>Overall Similarity</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{result.overall_similarity}%</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${Math.max(result.overall_similarity, 3)}%`,
                        backgroundColor: vc.color
                      }}
                    />
                  </div>
                </div>

                {/* Table */}
                <div>
                  <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 12 }}>
                    Field Breakdown
                  </div>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Form Value</th>
                          <th>Document Value</th>
                          <th style={{ textAlign: 'right' }}>Score</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.field_results?.map((row, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 500 }}>{row.label}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }}>{row.form_value}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)' }}>{row.extracted_value}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{row.similarity_score}%</td>
                            <td>
                              <span className={`badge ${
                                row.status === 'EXACT_MATCH' ? 'badge-success'
                                : row.status === 'PARTIAL_MATCH' ? 'badge-warning'
                                : 'badge-danger'
                              }`}>
                                {row.status === 'EXACT_MATCH' ? 'Match' : row.status === 'PARTIAL_MATCH' ? 'Partial' : 'Mismatch'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ textAlign: 'right', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                  Source: {result.source}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
