import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import DocReaderMode from './components/DocReaderMode';
import ItemClassifierMode from './components/ItemClassifierMode';
import FormVerifierMode from './components/FormVerifierMode';

export default function App() {
  const [activeTab, setActiveTab] = useState('reader');

  return (
    <div className="app-shell">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="main-content">
        <div className="content-container">
          {activeTab === 'reader' && <DocReaderMode />}
          {activeTab === 'classifier' && <ItemClassifierMode />}
          {activeTab === 'verifier' && <FormVerifierMode />}
        </div>
      </main>
    </div>
  );
}
