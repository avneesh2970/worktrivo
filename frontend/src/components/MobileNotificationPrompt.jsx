import React, { useState } from 'react';
import { Bell, BellRing, X, Smartphone, AlertCircle } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

const MobileNotificationPrompt = () => {
  const { notificationPermission, requestNotificationPermission } = useSocket() || {};
  const [dismissed, setDismissed] = useState(false);
  const [requesting, setRequesting] = useState(false);

  // If already granted, or dismissed in session, or unsupported, hide prompt
  if (
    notificationPermission === 'granted' ||
    notificationPermission === 'unsupported' ||
    dismissed
  ) {
    return null;
  }

  const handleEnable = async () => {
    try {
      setRequesting(true);
      const res = await requestNotificationPermission();
      if (res === 'granted') {
        // Trigger a test vibration and audio chime to confirm activation
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([150, 60, 150]);
        }
      }
    } finally {
      setRequesting(false);
    }
  };

  const isDenied = notificationPermission === 'denied';

  return (
    <div className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2.5 text-xs shadow-md z-30 transition-all animate-in slide-in-from-top-2">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="p-1.5 bg-white/20 rounded-lg shrink-0">
            {isDenied ? (
              <AlertCircle size={16} className="text-white" />
            ) : (
              <BellRing size={16} className="text-white animate-bounce" />
            )}
          </div>
          <p className="font-medium text-[11px] sm:text-xs leading-snug">
            {isDenied ? (
              <span>
                <strong>Notifications Blocked:</strong> To get task, chat & daily report alerts on your phone, tap your browser's lock icon and set Notifications to <em>Allow</em>.
              </span>
            ) : (
              <span>
                <strong>Enable Phone Alerts:</strong> Turn on notifications to receive instant sound, vibration & lock-screen alerts for new chat messages and tasks.
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {!isDenied && (
            <button
              onClick={handleEnable}
              disabled={requesting}
              className="px-3.5 py-1 bg-white text-emerald-800 hover:bg-slate-100 font-bold rounded-lg shadow-sm transition-transform active:scale-95 cursor-pointer text-xs disabled:opacity-75 flex items-center gap-1.5"
            >
              <Smartphone size={13} />
              <span>{requesting ? 'Activating...' : 'Enable Now'}</span>
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-white/80 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
            title="Dismiss banner"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileNotificationPrompt;
