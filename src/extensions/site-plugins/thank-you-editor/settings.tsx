import React, { useState, useEffect } from 'react';
import type { FC } from 'react';
import { httpClient } from '@wix/essentials';

const getApiUrl = (path: string): string => {
  try {
    return new URL(path, import.meta.url).href;
  } catch {
    return path;
  }
};

const SettingsPanel: FC = () => {
  const [title, setTitle] = useState('Forgot Something? Add to Your Order');
  const [windowMinutes, setWindowMinutes] = useState(30);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    httpClient.fetchWithAuth(getApiUrl('/api/dashboard/settings'))
      .then((res) => res.json())
      .then((data) => {
        if (data.appearance?.widgetTitle) setTitle(data.appearance.widgetTitle);
        if (data.editingWindowMinutes) setWindowMinutes(data.editingWindowMinutes);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    try {
      await httpClient.fetchWithAuth(getApiUrl('/api/dashboard/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editingWindowMinutes: windowMinutes,
          appearance: { widgetTitle: title },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
        Order Editor Settings
      </h3>
      <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
        Configure the Thank You page customer addition widget.
      </p>

      <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
          Widget Heading
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
          Editing Window (Minutes)
        </label>
        <input
          type="number"
          value={windowMinutes}
          onChange={(e) => setWindowMinutes(Number(e.target.value))}
          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
        />
      </div>

      <button
        onClick={handleSave}
        style={{
          width: '100%',
          padding: '10px',
          background: '#2563eb',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
};

export default SettingsPanel;
