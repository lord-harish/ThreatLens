import React, { createContext, useContext, useState, useMemo } from 'react';
import { INITIAL_FINDINGS } from '../data/mockFindings';
import { INITIAL_REPORTS } from '../data/mockReports';

const ThreatContext = createContext();

export function ThreatProvider({ children }) {
  const [findings, setFindings] = useState(INITIAL_FINDINGS);
  const [reports, setReports] = useState(INITIAL_REPORTS);
  const [activeFinding, setActiveFinding] = useState(null);
  const [environment, setEnvironment] = useState('Production (AWS + K8s)');
  const [toast, setToast] = useState(null);

  const [notifications, setNotifications] = useState([
    {
      id: "notif-1",
      title: "Critical Zero-Day Ingested",
      message: "CVE-2024-3094 detected on bastion-us-east-prod-01 with CVSS 10.0.",
      time: "12m ago",
      type: "critical",
      read: false
    },
    {
      id: "notif-2",
      title: "Audit Report AI Extraction Complete",
      message: "KPMG API Vulnerability Report parsed successfully (31 findings extracted).",
      time: "1h ago",
      type: "success",
      read: false
    },
    {
      id: "notif-3",
      title: "Remediation Verification Passed",
      message: "David Chen resolved Outlook Moniker RCE across 34 endpoints.",
      time: "3h ago",
      type: "info",
      read: true
    }
  ]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const updateFindingStatus = (id, newStatus) => {
    setFindings(prev =>
      prev.map(item =>
        item.id === id ? { ...item, status: newStatus } : item
      )
    );
    if (activeFinding && activeFinding.id === id) {
      setActiveFinding(prev => ({ ...prev, status: newStatus }));
    }
    showToast(`Finding ${id} updated to "${newStatus}"`, 'info');
  };

  const addReportWithFindings = (newReport, generatedFindings = []) => {
    setReports(prev => [newReport, ...prev]);
    if (generatedFindings.length > 0) {
      setFindings(prev => [...generatedFindings, ...prev]);
    }
    showToast(`Report "${newReport.title}" uploaded & parsed (${newReport.findingsCount} findings)`, 'success');
  };

  const deleteReport = (reportId) => {
    const reportToDelete = reports.find(r => r.id === reportId);
    setReports(prev => prev.filter(r => r.id !== reportId));
    showToast(`Report "${reportToDelete?.title || reportId}" removed`, 'info');
  };

  const markNotificationRead = (notifId) => {
    setNotifications(prev =>
      prev.map(n => n.id === notifId ? { ...n, read: true } : n)
    );
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Computations
  const stats = useMemo(() => {
    const totalFindings = findings.length;
    const criticalRisks = findings.filter(f => f.severity === 'Critical').length;
    const highRisks = findings.filter(f => f.severity === 'High').length;
    const unresolved = findings.filter(f => f.status === 'Open' || f.status === 'In Progress').length;
    const resolved = findings.filter(f => f.status === 'Resolved').length;
    const riskAccepted = findings.filter(f => f.status === 'Risk Accepted').length;
    const remediationRate = totalFindings > 0 
      ? Math.round(((resolved + riskAccepted) / totalFindings) * 100) 
      : 0;

    return {
      totalFindings,
      criticalRisks,
      highRisks,
      unresolved,
      resolved,
      riskAccepted,
      remediationRate
    };
  }, [findings]);

  return (
    <ThreatContext.Provider
      value={{
        findings,
        reports,
        stats,
        activeFinding,
        setActiveFinding,
        updateFindingStatus,
        addReportWithFindings,
        deleteReport,
        environment,
        setEnvironment,
        notifications,
        markNotificationRead,
        markAllNotificationsRead,
        toast,
        showToast
      }}
    >
      {children}
    </ThreatContext.Provider>
  );
}

export function useThreat() {
  const context = useContext(ThreatContext);
  if (!context) throw new Error('useThreat must be used within ThreatProvider');
  return context;
}
