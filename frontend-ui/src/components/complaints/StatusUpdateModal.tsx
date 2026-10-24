import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Complaint, ComplaintStatus } from '../../types';
import { useComplaints } from '../../context/ComplaintContext';

interface StatusUpdateModalProps {
  complaint: Complaint;
  isOpen: boolean;
  onClose: () => void;
}

export const StatusUpdateModal: React.FC<StatusUpdateModalProps> = ({
  complaint,
  isOpen,
  onClose,
}) => {
  const { updateComplaintStatus } = useComplaints();
  const [status, setStatus] = useState<ComplaintStatus>(complaint.status);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarks.trim()) {
      setError('Please provide mandatory case remarks justifying this status transition.');
      return;
    }

    updateComplaintStatus(complaint.id, status, remarks);
    onClose();
  };

  const statuses: { value: ComplaintStatus; label: string; desc: string }[] = [
    { value: 'RECEIVED', label: 'Received', desc: 'Case acknowledged and queued for triage.' },
    { value: 'PENDING', label: 'Pending', desc: 'Awaiting institutional response or initial documents.' },
    { value: 'UNDER_PROCESS', label: 'Under Process', desc: 'Active hearing, scrutiny, or physical inspection underway.' },
    { value: 'TRANSFERRED', label: 'Transferred', desc: 'Shifted jurisdiction to another bureau or regional cell.' },
    { value: 'ESCALATED', label: 'Escalated', desc: 'Elevated to Advisor / Member Secretary level due to critical breach.' },
    { value: 'DISPOSED', label: 'Disposed', desc: 'Final regulatory order issued or settlement achieved.' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Complaint Regulatory Status"
      subtitle={`Case Dossier: ${complaint.caseNumber}`}
      maxWidth="xl"
      accent="green"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
        {error && (
          <div className="p-2.5 bg-[#FF5C5C]/15 border border-[#FF5C5C]/40 text-[#FF6B6B] font-mono">
            {error}
          </div>
        )}

        <div className="p-3 bg-[#222F25] border border-[#35473A] space-y-1">
          <div className="text-[#A6B7A8] font-mono text-[10px]">Respondent Institution:</div>
          <div className="font-semibold text-[#E6EFE5]">{complaint.institutionName}</div>
          <div className="text-[11px] text-[#A6B7A8]">Current Bureau: <span className="font-mono text-[#C4F279]">{complaint.currentBureau}</span></div>
        </div>

        <div>
          <label className="block text-[#A6B7A8] font-medium mb-1.5">
            Select New Operational Status:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {statuses.map((s) => (
              <label
                key={s.value}
                className={`p-2.5 border cursor-pointer transition-all flex flex-col justify-between ${
                  status === s.value
                    ? 'border-[#C4F279] bg-[#C4F279]/10 text-[#C4F279]'
                    : 'border-[#35473A] bg-[#222F25] hover:border-[#4E6654] text-[#A6B7A8]'
                }`}
              >
                <div className="flex items-center justify-between font-mono font-bold text-xs mb-1">
                  <span>{s.label}</span>
                  <input
                    type="radio"
                    name="complaintStatus"
                    value={s.value}
                    checked={status === s.value}
                    onChange={() => setStatus(s.value)}
                    className="accent-[#C4F279]"
                  />
                </div>
                <div className="text-[10px] text-[#A6B7A8] font-normal">{s.desc}</div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[#A6B7A8] font-medium mb-1">
            Official Hearing / Transition Remarks <span className="text-[#C4F279]">*</span>
          </label>
          <textarea
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Record the official rationale, committee decision, compliance report outcome, or disposal terms..."
            className="w-full px-3 py-2 bg-[#222F25] border border-[#35473A] text-[#E6EFE5] font-sans focus:border-[#C4F279] focus:outline-none"
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
            className="px-5 py-2 bg-[#C4F279] hover:bg-[#B2E560] text-[#101713] font-bold font-mono transition-colors shadow-xs"
          >
            Confirm Status Update
          </button>
        </div>
      </form>
    </Modal>
  );
};
