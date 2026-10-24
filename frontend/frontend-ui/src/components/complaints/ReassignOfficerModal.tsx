import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Complaint } from '../../types';
import { useComplaints } from '../../context/ComplaintContext';
import { ASSIGNED_OFFICERS } from '../../data/mockData';

interface ReassignOfficerModalProps {
  complaint: Complaint;
  isOpen: boolean;
  onClose: () => void;
}

export const ReassignOfficerModal: React.FC<ReassignOfficerModalProps> = ({
  complaint,
  isOpen,
  onClose,
}) => {
  const { reassignOfficer } = useComplaints();
  const [officerId, setOfficerId] = useState(complaint.assignedOfficer?.id || ASSIGNED_OFFICERS[0].id);
  const [remarks, setRemarks] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    reassignOfficer(complaint.id, officerId, remarks);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reassign Inquiry Officer"
      subtitle={`Case Dossier: ${complaint.caseNumber}`}
      maxWidth="md"
      accent="green"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
        <div className="p-3 bg-[#222F25] border border-[#35473A] text-[11px]">
          <div className="text-[#A6B7A8]">Currently Assigned:</div>
          <div className="font-semibold text-[#E6EFE5] mt-0.5">
            {complaint.assignedOfficer.name} ({complaint.assignedOfficer.designation})
          </div>
          <div className="text-[10px] text-[#A6B7A8]/70 font-mono">
            Bureau: {complaint.assignedOfficer.bureau} • Active Load: {complaint.assignedOfficer.activeCases} cases
          </div>
        </div>

        <div>
          <label className="block text-[#A6B7A8] font-medium mb-1">
            Select New Assigned Officer:
          </label>
          <select
            value={officerId}
            onChange={(e) => setOfficerId(e.target.value)}
            className="w-full px-3 py-2 bg-[#222F25] border border-[#35473A] text-[#E6EFE5] font-mono focus:border-[#C4F279] focus:outline-none"
          >
            {ASSIGNED_OFFICERS.map((off) => (
              <option key={off.id} value={off.id}>
                {off.name} ({off.designation} - {off.bureau}) [{off.activeCases} active]
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[#A6B7A8] font-medium mb-1">
            Reassignment Order Remarks:
          </label>
          <textarea
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Reassigned for regional proximity or workload balance..."
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
            Confirm Reassignment
          </button>
        </div>
      </form>
    </Modal>
  );
};
