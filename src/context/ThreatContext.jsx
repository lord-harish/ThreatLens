import React, { createContext, useContext, useState } from 'react';

const ThreatContext = createContext();

export function ThreatProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToast({ message, type, id });
    window.setTimeout(() => {
      setToast((current) => current?.id === id ? null : current);
    }, 4000);
  };

  return (
    <ThreatContext.Provider value={{ toast, setToast, showToast }}>
      {children}
    </ThreatContext.Provider>
  );
}

export function useThreat() {
  const context = useContext(ThreatContext);
  if (!context) throw new Error('useThreat must be used within ThreatProvider');
  return context;
}
