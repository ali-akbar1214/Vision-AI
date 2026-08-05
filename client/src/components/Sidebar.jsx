import React from 'react';
import { BookOpen, Layers, ShieldCheck, Zap, Eye, Scan } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'reader', label: 'Document Reader', icon: Eye, desc: 'Extract text from images' },
    { id: 'classifier', label: 'Item Classifier', icon: Scan, desc: 'Match objects to targets' },
    { id: 'verifier', label: 'Form Verifier', icon: ShieldCheck, desc: 'Validate document data' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">
          <Zap size={32} className="logo-icon" />
        </div>
        <div className="sidebar-logo-text">
          <span className="logo-main">Vision</span>
          <span className="logo-accent">AI</span>
        </div>
        <div className="logo-tagline">Intelligent Document Processing</div>
      </div>

      <nav className="sidebar-nav">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
            >
              <div className="nav-item-icon-wrapper">
                <Icon className="sidebar-nav-item-icon" size={20} />
                {isActive && <div className="nav-item-glow" />}
              </div>
              <div className="nav-item-content">
                <span className="nav-item-label">{tab.label}</span>
                <span className="nav-item-desc">{tab.desc}</span>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="footer-info">
          <div className="footer-item">
            <span className="footer-label">Developer</span>
            <span className="footer-value">Syed Ali Akbar Naqvi</span>
          </div>
          <div className="footer-item">
            <span className="footer-label">Company</span>
            <span className="footer-value">e-strats</span>
          </div>
          <div className="footer-item">
            <span className="footer-label">Supervisor</span>
            <span className="footer-value">The Great Muhammad Anas</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
