import { useState, useEffect, useRef, useMemo } from 'react';
import { Contact, CallLog, SimConfig, ActiveCallState } from './types';
import { initialContacts, initialCallLogs, defaultSettings } from './initialData';
import { playKeypadTone, triggerHaptic, playCallEndTone } from './audio';
import StatusBar from './StatusBar';
import SearchHeader from './SearchHeader';
import CallHistoryList from './CallHistoryList';
import BottomNavBar from './BottomNavBar';
import DialpadSheet from './DialpadSheet';
import InCallScreen from './InCallScreen';
import SimSelectionDialog from './SimSelectionDialog';
import NavigationDrawer from './NavigationDrawer';
import ContactsModal from './ContactsModal';
import NewContactModal from './NewContactModal';
import SettingsModal from './SettingsModal';
import HelpModal from './HelpModal';

export function App() {
  const [contacts, setContacts] = useState<Contact[]>(() => {
    try {
      const saved = localStorage.getItem('phone_app_contacts');
      return saved ? JSON.parse(saved) : initialContacts;
    } catch {
      return initialContacts;
    }
  });

  const [callLogs, setCallLogs] = useState<CallLog[]>(() => {
    try {
      const saved = localStorage.getItem('phone_app_call_logs');
      return saved ? JSON.parse(saved) : initialCallLogs;
    } catch {
      return initialCallLogs;
    }
  });

  const [sims, setSims] = useState<SimConfig[]>(() => {
    try {
      const saved = localStorage.getItem('phone_app_sims');
      return saved ? JSON.parse(saved) : defaultSettings.sims;
    } catch {
      return defaultSettings.sims;
    }
  });

  const [currentTab, setCurrentTab] = useState<'recents' | 'contacts'>('recents');
  const [dialpadDigits, setDialpadDigits] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Missed'>('All');

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);
  const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false);
  const [newContactInitialNumber, setNewContactInitialNumber] = useState('');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  const [showStatusBar, setShowStatusBar] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);

  const [pendingCall, setPendingCall] = useState<{ number: string; name?: string } | null>(null);
  const [isSimDialogOpen, setIsSimDialogOpen] = useState(false);
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);
  const callTimerRef = useRef<any>(null);

  useEffect(() => {
    try {
      localStorage.setItem('phone_app_contacts', JSON.stringify(contacts));
    } catch {}
  }, [contacts]);

  useEffect(() => {
    try {
      localStorage.setItem('phone_app_call_logs', JSON.stringify(callLogs));
    } catch {}
  }, [callLogs]);

  useEffect(() => {
    try {
      localStorage.setItem('phone_app_sims', JSON.stringify(sims));
    } catch {}
  }, [sims]);

  useEffect(() => {
    if (activeCall && activeCall.status === 'connected') {
      callTimerRef.current = setInterval(() => {
        setActiveCall(prev => prev ? { ...prev, duration: prev.duration + 1 } : null);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [activeCall?.status]);

  const handleInitiateCall = (number: string, name?: string) => {
    if (!number.trim()) return;
    if (soundEnabled) playKeypadTone(5);
    if (vibrationEnabled) triggerHaptic();

    const activeSims = sims.filter(s => s.active);
    if (activeSims.length > 1) {
      setPendingCall({ number, name });
      setIsSimDialogOpen(true);
    } else {
      startCall(number, name, activeSims[0]?.id || 1);
    }
  };

  const startCall = (number: string, name: string | undefined, simId: 1 | 2) => {
    setIsSimDialogOpen(false);
    setPendingCall(null);

    const contact = contacts.find(c => c.phoneNumber.replace(/\s+/g, '') === number.replace(/\s+/g, ''));
    const displayName = name || (contact ? contact.name : number);

    const newCallLog: CallLog = {
      id: Date.now().toString(),
      contactName: contact ? contact.name : undefined,
      phoneNumber: number,
      type: 'outgoing',
      timestamp: 'Just now',
      simSlot: simId,
      duration: '0s'
    };
    setCallLogs(prev => [newCallLog, ...prev]);

    setActiveCall({
      contactName: displayName,
      phoneNumber: number,
      simSlot: simId,
      status: 'connecting',
      duration: 0,
      isMuted: false,
      isSpeakerOn: false,
      isRecording: false,
      isKeypadOpen: false
    });

    setTimeout(() => {
      setActiveCall(prev => prev ? { ...prev, status: 'ringing' } : null);
    }, 1500);

    setTimeout(() => {
      setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);
    }, 4000);
  };

  const handleEndCall = () => {
    if (soundEnabled) playCallEndTone();
    if (vibrationEnabled) triggerHaptic();

    if (activeCall) {
      const durSec = activeCall.duration;
      const durStr = durSec > 60 ? `${Math.floor(durSec / 60)}m ${durSec % 60}s` : `${durSec}s`;
      setCallLogs(prev => prev.map((log, idx) => idx === 0 ? { ...log, duration: durStr } : log));
    }
    setActiveCall(null);
  };

  const handleToggleMute = () => {
    setActiveCall(prev => prev ? { ...prev, isMuted: !prev.isMuted } : null);
  };

  const handleToggleSpeaker = () => {
    setActiveCall(prev => prev ? { ...prev, isSpeakerOn: !prev.isSpeakerOn } : null);
  };

  const handleToggleRecord = () => {
    setActiveCall(prev => prev ? { ...prev, isRecording: !prev.isRecording } : null);
  };

  const handleToggleInCallKeypad = () => {
    setActiveCall(prev => prev ? { ...prev, isKeypadOpen: !prev.isKeypadOpen } : null);
  };

  const handleSaveNewContact = (newContact: Contact) => {
    setContacts(prev => [...prev, newContact]);
    setIsNewContactModalOpen(false);
  };

  const handleDeleteContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  const handleDeleteLog = (id: string) => {
    setCallLogs(prev => prev.filter(l => l.id !== id));
  };

  const handleClearCallHistory = () => {
    setCallLogs([]);
  };

  const handleResetData = () => {
    setContacts(initialContacts);
    setCallLogs(initialCallLogs);
    setSims(defaultSettings.sims);
    localStorage.clear();
  };

  const handleOpenCreateContact = (number?: string) => {
    setNewContactInitialNumber(number || dialpadDigits);
    setIsNewContactModalOpen(true);
  };

  const filteredLogs = useMemo(() => {
    let logs = callLogs;
    if (activeFilter === 'Missed') {
      logs = logs.filter(l => l.type === 'missed');
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      logs = logs.filter(l => 
        (l.contactName && l.contactName.toLowerCase().includes(q)) ||
        l.phoneNumber.includes(q)
      );
    }
    return logs;
  }, [callLogs, activeFilter, searchQuery]);

  return (
    <div id="phone-app-container" className="flex justify-center items-center min-h-screen bg-slate-900 text-slate-800 font-sans p-0 sm:p-4 select-none">
      <div id="phone-app-device" className="relative w-full max-w-[430px] h-[100dvh] sm:h-[880px] bg-[#f8f9fa] sm:rounded-[36px] shadow-2xl overflow-hidden flex flex-col border sm:border-slate-800">
        
        {showStatusBar && (
          <StatusBar 
            sims={sims} 
            activeCallStatus={activeCall?.status} 
            callDuration={activeCall?.duration} 
          />
        )}

        <SearchHeader 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenDrawer={() => setIsDrawerOpen(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenHelp={() => setIsHelpModalOpen(true)}
        />

        <div className="flex-1 overflow-y-auto pb-24">
          <CallHistoryList 
            logs={filteredLogs}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            onCallContact={(number, name) => handleInitiateCall(number, name)}
            onDeleteLog={handleDeleteLog}
            onAddContact={(num) => handleOpenCreateContact(num)}
            onClearAll={handleClearCallHistory}
          />
        </div>

        <DialpadSheet 
          digits={dialpadDigits}
          setDigits={setDialpadDigits}
          onCall={(number) => handleInitiateCall(number)}
          soundEnabled={soundEnabled}
          vibrationEnabled={vibrationEnabled}
          onCreateContact={() => handleOpenCreateContact(dialpadDigits)}
        />

        <BottomNavBar 
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          onOpenContacts={() => setIsContactsModalOpen(true)}
          onOpenKeypad={() => {}}
        />

        {activeCall && (
          <InCallScreen 
            call={activeCall}
            sims={sims}
            onEndCall={handleEndCall}
            onToggleMute={handleToggleMute}
            onToggleSpeaker={handleToggleSpeaker}
            onToggleRecord={handleToggleRecord}
            onToggleKeypad={handleToggleInCallKeypad}
            soundEnabled={soundEnabled}
            vibrationEnabled={vibrationEnabled}
          />
        )}

        {isSimDialogOpen && pendingCall && (
          <SimSelectionDialog 
            sims={sims}
            number={pendingCall.number}
            name={pendingCall.name}
            onSelectSim={(simId) => startCall(pendingCall.number, pendingCall.name, simId)}
            onClose={() => {
              setIsSimDialogOpen(false);
              setPendingCall(null);
            }}
          />
        )}

        <NavigationDrawer 
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onOpenSettings={() => {
            setIsDrawerOpen(false);
            setIsSettingsModalOpen(true);
          }}
          onOpenHelp={() => {
            setIsDrawerOpen(false);
            setIsHelpModalOpen(true);
          }}
          onOpenContacts={() => {
            setIsDrawerOpen(false);
            setIsContactsModalOpen(true);
          }}
          onResetData={() => {
            setIsDrawerOpen(false);
            handleResetData();
          }}
        />

        <ContactsModal 
          isOpen={isContactsModalOpen}
          onClose={() => setIsContactsModalOpen(false)}
          contacts={contacts}
          onCallContact={(number, name) => {
            setIsContactsModalOpen(false);
            handleInitiateCall(number, name);
          }}
          onAddNewContact={() => {
            setIsContactsModalOpen(false);
            handleOpenCreateContact();
          }}
          onDeleteContact={handleDeleteContact}
        />

        <NewContactModal 
          isOpen={isNewContactModalOpen}
          onClose={() => setIsNewContactModalOpen(false)}
          initialNumber={newContactInitialNumber}
          onSave={handleSaveNewContact}
        />

        <SettingsModal 
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          sims={sims}
          setSims={setSims}
          showStatusBar={showStatusBar}
          setShowStatusBar={setShowStatusBar}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          vibrationEnabled={vibrationEnabled}
          setVibrationEnabled={setVibrationEnabled}
        />

        <HelpModal 
          isOpen={isHelpModalOpen}
          onClose={() => setIsHelpModalOpen(false)}
        />

      </div>
    </div>
  );
}

export default App;
