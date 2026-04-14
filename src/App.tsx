/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { Camera, Upload, Mic, Send, Volume2, UserPlus, LogIn, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function App() {
  const [view, setView] = useState<'login' | 'register' | 'chat'>('login');
  const [accessStatus, setAccessStatus] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle');
  const [message, setMessage] = useState('');
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Register state
  const [registerName, setRegisterName] = useState('');
  const [registerFiles, setRegisterFiles] = useState<FileList | null>(null);
  const [registerStatus, setRegisterStatus] = useState('');

  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Web Speech API Setup ---
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = SpeechRecognition ? new SpeechRecognition() : null;

  useEffect(() => {
    if (recognition) {
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setChatInput(prev => prev + ' ' + transcript);
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };
    }
  }, [recognition]);

  const toggleListen = () => {
    if (isListening) {
      recognition?.stop();
      setIsListening(false);
    } else {
      recognition?.start();
      setIsListening(true);
    }
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  // --- API Calls ---

  const handleLogin = async (file: File) => {
    setAccessStatus('loading');
    setMessage('');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/login`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.access) {
        setAccessStatus('granted');
        setMessage(response.data.message);
        setUser(response.data.user);
        speak(response.data.message);
        
        setTimeout(() => {
          setView('chat');
        }, 2000);
      } else {
        setAccessStatus('denied');
        setMessage(response.data.message);
        speak('Access Denied');
      }
    } catch (error: any) {
      setAccessStatus('denied');
      setMessage(error.response?.data?.detail || 'Connection error');
    }
  };

  const captureAndLogin = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      // Convert base64 to File
      fetch(imageSrc)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
          handleLogin(file);
        });
    }
  }, [webcamRef]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleLogin(e.target.files[0]);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerName || !registerFiles || registerFiles.length === 0) {
      setRegisterStatus('Please provide a name and at least one image.');
      return;
    }

    setRegisterStatus('Uploading...');
    const formData = new FormData();
    formData.append('name', registerName);
    Array.from(registerFiles).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await axios.post(`${API_URL}/register`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setRegisterStatus('Registration successful! You can now login.');
      setTimeout(() => setView('login'), 2000);
    } catch (error: any) {
      setRegisterStatus(error.response?.data?.detail || 'Registration failed.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await axios.post(`${API_URL}/chat`, {
        message: userMsg,
        user_name: user?.name || 'sir'
      });
      
      const aiMsg = response.data.response;
      setChatMessages(prev => [...prev, { role: 'ai', content: aiMsg }]);
      speak(aiMsg);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'ai', content: 'Sorry, I encountered an error.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // --- UI Components ---

  if (view === 'chat') {
    return (
      <div className="flex flex-col h-screen bg-[#0A0C10] text-[#F0F6FC] font-sans overflow-hidden">
        <header className="h-16 border-b border-[#2D333B] px-6 flex justify-between items-center bg-[#15181E] shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-[#3B82F6] w-8 h-8 rounded-md flex items-center justify-center font-bold text-white">AI</div>
            <span className="font-semibold tracking-tight">CORE ACCESS CONTROL</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[13px] font-medium text-[#10B981] bg-[#10B981]/10 px-3 py-1 rounded-full border border-[#10B981]/20">
              <div className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></div>
              SYSTEM UNLOCKED
            </div>
            <span className="text-sm text-[#8B949E]">Welcome, {user?.name}</span>
            <button 
              onClick={() => { setView('login'); setUser(null); setChatMessages([]); }}
              className="text-sm text-[#8B949E] hover:text-[#F0F6FC] font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col bg-[#15181E] overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
            {chatMessages.length === 0 && (
              <div className="text-center text-[#8B949E] mt-10">
                How can I help you today, {user?.name}?
              </div>
            )}
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 px-4 rounded-xl text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-[#3B82F6] text-white' 
                    : 'bg-[#232831] border border-[#2D333B] text-[#F0F6FC]'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-[#232831] border border-[#2D333B] p-3 px-4 rounded-xl flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#3B82F6]" />
                  <span className="text-[#8B949E] text-sm">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-[#0A0C10] border-t border-[#2D333B]">
            <form onSubmit={handleSendMessage} className="flex gap-3 max-w-4xl mx-auto">
              <button
                type="button"
                onClick={toggleListen}
                className={`w-11 h-11 rounded-lg flex items-center justify-center transition-colors ${isListening ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30' : 'bg-[#2D333B] text-[#8B949E] hover:text-[#F0F6FC]'}`}
                title="Voice Input"
              >
                <Mic className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message or use voice assistant..."
                className="flex-1 bg-[#15181E] border border-[#2D333B] rounded-lg px-4 py-3 text-sm text-[#F0F6FC] focus:outline-none focus:border-[#3B82F6] placeholder-[#8B949E]"
              />
              <button
                type="submit"
                disabled={isChatLoading || !chatInput.trim()}
                className="w-11 h-11 bg-[#3B82F6] text-white rounded-lg flex items-center justify-center hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </main>

        <footer className="bg-[#0A0C10] px-6 py-3 border-t border-[#2D333B] flex justify-between font-mono text-[11px] text-[#8B949E] shrink-0">
            <div>DB: SUPABASE_POSTGRES_CONNECTED | LATENCY: 12ms | VECTORS: 4,012</div>
            <div>BACKEND: FASTAPI_RAILWAY_STABLE | API_VERSION: 1.0.4</div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0C10] text-[#F0F6FC] font-sans flex flex-col">
      <header className="h-16 border-b border-[#2D333B] px-6 flex justify-between items-center bg-[#15181E] shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-[#3B82F6] w-8 h-8 rounded-md flex items-center justify-center font-bold text-white">AI</div>
          <span className="font-semibold tracking-tight">CORE ACCESS CONTROL</span>
        </div>
        <div className="flex items-center gap-2 text-[13px] font-medium text-[#8B949E] bg-[#2D333B]/50 px-3 py-1 rounded-full border border-[#2D333B]">
          SYSTEM LOCKED
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 overflow-hidden">
        <div className="bg-[#15181E] border border-[#2D333B] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
          <div className="flex border-b border-[#2D333B]">
            <button 
              className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${view === 'login' ? 'text-[#3B82F6] border-b-2 border-[#3B82F6] bg-[#3B82F6]/5' : 'text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#2D333B]/30'}`}
              onClick={() => setView('login')}
            >
              <LogIn className="w-4 h-4" /> Authenticate
            </button>
            <button 
              className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${view === 'register' ? 'text-[#3B82F6] border-b-2 border-[#3B82F6] bg-[#3B82F6]/5' : 'text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#2D333B]/30'}`}
              onClick={() => setView('register')}
            >
              <UserPlus className="w-4 h-4" /> Register
            </button>
          </div>

          <div className="p-6 flex flex-col gap-6">
            {view === 'login' ? (
              <>
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-[#F0F6FC]">Identity Verification</h2>
                  <p className="text-[#8B949E] text-sm mt-1">Position your face within the frame</p>
                </div>

                <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] flex items-center justify-center border border-[#2D333B]">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    className="w-full h-full object-cover"
                    videoConstraints={{ facingMode: "user" }}
                  />
                  
                  {/* Theme Overlays */}
                  <div className="absolute inset-[20%] border-2 border-[#10B981] rounded-[100px] shadow-[0_0_20px_rgba(16,185,129,0.3)] pointer-events-none"></div>
                  <div className="absolute top-1/2 left-0 w-full h-[1px] bg-[#10B981] shadow-[0_0_10px_#10B981] pointer-events-none"></div>
                  <div className="absolute bottom-3 left-3 font-mono text-[10px] text-[#10B981] drop-shadow-md pointer-events-none">
                      REC ● HD 60FPS<br/>ID: ADM-9928-VX
                  </div>

                  {/* Status Overlay */}
                  {accessStatus !== 'idle' && (
                    <div className={`absolute inset-0 flex flex-col items-center justify-center bg-[#0A0C10]/80 backdrop-blur-sm transition-all`}>
                      {accessStatus === 'loading' && <Loader2 className="w-10 h-10 text-[#3B82F6] animate-spin mb-3" />}
                      {accessStatus === 'granted' && <ShieldCheck className="w-12 h-12 text-[#10B981] mb-3" />}
                      {accessStatus === 'denied' && <ShieldAlert className="w-12 h-12 text-red-500 mb-3" />}
                      <p className={`text-sm font-medium px-4 py-2 rounded-lg border ${
                        accessStatus === 'granted' ? 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/20' : 
                        accessStatus === 'denied' ? 'text-red-500 bg-red-500/10 border-red-500/20' : 'text-[#F0F6FC] bg-[#2D333B]/50 border-[#2D333B]'
                      }`}>
                        {message || 'Analyzing biometrics...'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={captureAndLogin}
                    disabled={accessStatus === 'loading'}
                    className="flex-1 bg-[#3B82F6] text-white py-3 rounded-lg font-medium hover:bg-[#2563EB] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Camera className="w-5 h-5" /> Scan Face
                  </button>
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={accessStatus === 'loading'}
                    className="bg-[#2D333B] text-[#8B949E] p-3 rounded-lg hover:text-[#F0F6FC] transition-colors disabled:opacity-50"
                    title="Upload Photo"
                  >
                    <Upload className="w-5 h-5" />
                  </button>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                </div>
              </>
            ) : (
              <form onSubmit={handleRegister} className="flex flex-col gap-5">
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-[#F0F6FC]">Enroll New User</h2>
                  <p className="text-[#8B949E] text-sm mt-1">Provide reference images for the system</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#8B949E] mb-2">Full Name</label>
                  <input
                    type="text"
                    required
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    className="w-full bg-[#0A0C10] border border-[#2D333B] rounded-lg px-4 py-3 text-sm text-[#F0F6FC] focus:outline-none focus:border-[#3B82F6] placeholder-[#8B949E]"
                    placeholder="e.g. Alexander Wright"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#8B949E] mb-2">Training Images</label>
                  <div className="border border-dashed border-[#2D333B] rounded-lg p-8 text-center hover:bg-[#2D333B]/30 transition-colors cursor-pointer bg-[#0A0C10]" onClick={() => document.getElementById('register-files')?.click()}>
                    <Upload className="w-8 h-8 text-[#8B949E] mx-auto mb-3" />
                    <p className="text-sm text-[#8B949E]">
                      {registerFiles ? <span className="text-[#10B981]">{registerFiles.length} files selected</span> : 'Click to select images'}
                    </p>
                    <input
                      id="register-files"
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setRegisterFiles(e.target.files)}
                    />
                  </div>
                </div>

                {registerStatus && (
                  <div className={`text-sm p-3 rounded-lg border ${registerStatus.includes('success') ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20' : 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20'}`}>
                    {registerStatus}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-[#3B82F6] text-white py-3 rounded-lg font-medium hover:bg-[#2563EB] transition-colors flex items-center justify-center gap-2 mt-2"
                >
                  <UserPlus className="w-5 h-5" /> Enroll Identity
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-[#0A0C10] px-6 py-3 border-t border-[#2D333B] flex justify-between font-mono text-[11px] text-[#8B949E] shrink-0">
          <div>DB: SUPABASE_POSTGRES_CONNECTED | LATENCY: 12ms | VECTORS: 4,012</div>
          <div>BACKEND: FASTAPI_RAILWAY_STABLE | API_VERSION: 1.0.4</div>
      </footer>
    </div>
  );
}

