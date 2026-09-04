import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, X, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { API_BASE } from '../context/AuthContext';

const VoiceTaskModal = ({ open, onClose, token, onParsed }) => {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    if (!open) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        if (result.isFinal) {
          finalTranscriptRef.current += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }

      setTranscript(
        (finalTranscriptRef.current + interim).trim()
      );
    };

    recognition.onerror = (event) => {
      setError(event.error === 'not-allowed' ? 'Microphone access was denied.' : 'Speech recognition error. Please try again.');
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reset state each time the modal opens fresh.
  useEffect(() => {
    if (open) {
      finalTranscriptRef.current = "";
      setTranscript('');
      setError('');
      setListening(false);
      setParsing(false);
    }
  }, [open]);

  const startListening = () => {
    setError('');
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch (err) {
      // start() throws if already started — safe to ignore.
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const handleParse = async () => {
    if (!transcript.trim()) return;
    setParsing(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/tasks/parse-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ transcript: transcript.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not parse the transcript.');
        return;
      }
      onParsed(data);
    } catch (err) {
      console.error('Voice parse failed', err);
      setError('Network error while parsing transcript.');
    } finally {
      setParsing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-emerald-500" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Voice Task</h3>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {!supported ? (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 text-xs flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600" />
            <span>
              Your browser doesn't support the Web Speech API. Try Chrome or Edge, or type the task
              description below and click "Parse Task".
            </span>
          </div>
        ) : null}

        <p className="text-xs text-slate-600 dark:text-slate-400 mt-4 font-medium">
          Speak naturally, e.g. <em className="text-slate-800 dark:text-slate-300 font-normal">"Assign to Priya, update the landing page header, urgent, by tomorrow."</em>
        </p>

        <div className="mt-4 flex items-center justify-center">
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            disabled={!supported}
            className={`flex items-center justify-center w-16 h-16 rounded-full transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed ${
              listening
                ? 'bg-rose-600 hover:bg-rose-700 animate-pulse text-white shadow-rose-500/30'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
            }`}
            title={listening ? 'Stop recording' : 'Start recording'}
          >
            {listening ? <Square size={22} className="text-white" /> : <Mic size={24} className="text-white" />}
          </button>
        </div>
        <p className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2">
          {listening ? 'Listening… tap to stop' : 'Tap the mic to start speaking'}
        </p>

        <textarea
          rows={4}
          value={transcript}
          onChange={(e) => {
            setTranscript(e.target.value);
            finalTranscriptRef.current = e.target.value;
          }}
          placeholder="Transcript will appear here — you can also type or edit it directly..."
          className="w-full mt-4 px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none transition"
        />

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleParse}
            disabled={!transcript.trim() || parsing}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors shadow-md shadow-emerald-500/20"
          >
            {parsing && <Loader2 size={14} className="animate-spin" />}
            {parsing ? 'Parsing…' : 'Parse Task'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceTaskModal;