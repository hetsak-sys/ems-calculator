// Hetsa PowerSuite — Suggestions (WhatsApp)
//
// No server involved at all — this opens WhatsApp directly with the
// message pre-filled, via a wa.me deep link. Nothing to deploy, nothing
// to break, no email/SMTP dependency.
//
// Integration:
//   1. Copy into src/components/SuggestionBox.jsx.
//   2. Add a nav entry (Settings screen is the natural home) that renders
//      this component.
//   3. `npm install @capacitor/device` if not already present (the license
//      flow likely already depends on it — check before adding a duplicate).

import React, { useState } from 'react';
import { Device } from '@capacitor/device';

// +266 58710533, as digits only, no leading +, no spaces — wa.me's required format.
const WHATSAPP_NUMBER = '26658710533';

export default function SuggestionBox() {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // idle | opening | error

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      setStatus('error');
      return;
    }

    setStatus('opening');

    const info = await Device.getInfo().catch(() => ({}));
    const appVersion = import.meta.env.VITE_APP_VERSION || 'unknown';

    const fullMessage = [
      trimmed,
      '',
      '---',
      `Hetsa PowerSuite v${appVersion}`,
      `${info.platform || 'unknown platform'} / ${info.osVersion || 'unknown OS'}`,
    ].join('\n');

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(fullMessage)}`;

    // '_system' tells Capacitor's webview to hand this off to the OS
    // (opens the WhatsApp app directly if installed, otherwise falls
    // back to WhatsApp Web/Play Store via wa.me's own redirect logic —
    // nothing extra needed on our side for that fallback).
    window.open(url, '_system');

    setStatus('idle');
    setMessage('');
  };

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-lg font-semibold">Suggestions</h2>
      <p className="text-sm text-gray-500">
        Spotted a bug, missing standard, or an idea for a new module? Send it straight to WhatsApp —
        no account needed, no waiting on email.
      </p>

      <textarea
        className="w-full border rounded p-2 text-sm"
        rows={5}
        placeholder="Your suggestion or issue..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <button
        className="w-full bg-green-600 text-white rounded p-2 text-sm font-medium disabled:opacity-50"
        onClick={handleSend}
        disabled={status === 'opening'}
      >
        {status === 'opening' ? 'Opening WhatsApp...' : 'Send via WhatsApp'}
      </button>

      {status === 'error' && (
        <p className="text-sm text-red-600">Please enter a message before sending.</p>
      )}

      <p className="text-xs text-gray-400">
        This opens WhatsApp with your message pre-filled — you'll still need to hit Send there.
      </p>
    </div>
  );
}
