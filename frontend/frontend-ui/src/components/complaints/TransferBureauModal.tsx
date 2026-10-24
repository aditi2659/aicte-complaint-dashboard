import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Complaint, BureauCode } from '../../types';
import { useComplaints } from '../../context/ComplaintContext';
import { BUREAUS } from '../../data/mockData';

interface TransferBureauModalProps {
  complaint: Complaint;
  isOpen: boolean;
  onClose: () => void;
}

export const TransferBureauModal: React.FC<TransferBureauModalProps> = ({
  complaint,
  isOpen,
  onClose,
}) => {
  const { transferBureau } = useComplaints();
  
  // Default to a different bureau
  const otherBureaus = BUREAUS.filter(b => b.code !== complaint.currentBureau);
  const [targetBureau, setTargetBureau] = useState<BureauCode>(otherBureaus[0]?.code || 'AB');
  const [reason, setReason] = useState('Regulatory jurisdiction realignment');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarks.trim()) {
      setError('Please provide specific handover instructions and context for the receiving bureau.');
      return;
    }

    transferBureau(complaint.id, targetBureau, reason, remarks);
    onClose();
  };

  const commonReasons = [
    'Regulatory jurisdiction realignment',
    'Intake freeze / Approval withdrawal recommended to Approval Bureau',
    'Vigilance / On-site squad deployment required by Regulation Bureau',
    'Faculty scale & service violation transferred to Faculty Development Bureau',
    'Student conciliation failed; referred for formal legal hearing',
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cross-Bureau Case Transfer"
      subtitle={`Transferring ${complaint.caseNumber} from ${complaint.currentBureau}`}
      maxWidth="xl"
      accent="pink"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
        {error && (
          <div className="p-2.5 bg-[#FF5C5C]/15 border border-[#FF5C5C]/40 text-[#FF6B6B] font-mono">
            {error}
          </div>
        )}

        <div className="p-3 bg-[#222F25] border border-[#35473A] flex items-center justify-between font-mono">
          <div>
            <div className="text-[10px] text-[#A6B7A8]">Current Custody:</div>
            <div className="text-sm font-bold text-[#C4F279]">{complaint.currentBureau}</div>
          </div>
          <div className="text-[#A6B7A8]/50">→</div>
          <div>
            <div className="text-[10px] text-[#A6B7A8]">Target Bureau:</div>
            <div className="text-sm font-bold text-[#FF8BCB]">{targetBureau}</div>
          </div>
        </div>

        <div>
          <label className="block text-[#A6B7A8] font-medium mb-1">
            Target AICTE Bureau / Cell:
          </label>
          <select
            value={targetBureau}
            onChange={(e) => setTargetBureau(e.target.value as BureauCode)}
            className="w-full px-3 py-2 bg-[#222F25] border border-[#35473A] text-[#E6EFE5] font-mono focus:border-[#FF8BCB] focus:outline-none"
          >
            {BUREAUS.map((b) => (
              <option key={b.code} value={b.code} disabled={b.code === complaint.currentBureau}>
                {b.code} - {b.name} ({b.headOfficer})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[#A6B7A8] font-medium mb-1">
            Transfer Rationale:
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 bg-[#222F25] border border-[#35473A] text-[#E6EFE5] font-sans focus:border-[#FF8BCB] focus:outline-none mb-2"
          >
            {commonReasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[#A6B7A8] font-medium mb-1">
            Inter-Bureau Handover Directives & Case Summary <span className="text-[#FF8BCB]">*</span>
          </label>
          <textarea
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Document evidence gathered to date, pending notices, and specific action requested from the target bureau head..."
            className="w-full px-3 py-2 bg-[#222F25] border border-[#35473A] text-[#E6EFE5] font-sans focus:border-[#FF8BCB] focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#35473A]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#35473A] bg-[#222F25] text-[#A6B7A8] hover:text-[#E6EFE5] hover:bg-[#27362B] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-[#FF8BCB] hover:bg-[#F278BA] text-[#101713] font-bold font-mono transition-colors shadow-xs"
          >
            Execute Inter-Bureau Transfer
          </button>
        </div>
      </form>
    </Modal>
  );
};
