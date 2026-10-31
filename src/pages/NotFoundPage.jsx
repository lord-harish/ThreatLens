import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldIcon } from '../components/common/Icons';
import { Button } from '../components/common/Button';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6 space-y-3 font-mono">
      <div className="w-12 h-12 rounded-xs bg-[#ffe4e6] text-[#9f1239] border border-[#fecdd3] flex items-center justify-center">
        <ShieldIcon className="w-6 h-6" />
      </div>

      <div className="space-y-1">
        <h2 className="text-base font-bold text-slate-900 uppercase">
          404: Route Not Found
        </h2>
        <p className="text-xs text-slate-500 font-sans max-w-sm">
          The requested system route does not exist or has been quarantined by access control rules.
        </p>
      </div>

      <div className="pt-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate('/')}
        >
          Return to Posture Dashboard
        </Button>
      </div>
    </div>
  );
}
