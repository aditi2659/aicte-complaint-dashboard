import React, { useState } from 'react';
import { useComplaints } from '../../context/ComplaintContext';
import { Modal } from '../common/Modal';
import { ComplaintCategory, BureauCode, ComplainantType, LodgingChannel } from '../../types';

interface RegisterComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultInstitutionId?: string;
}

export const RegisterComplaintModal: React.FC<RegisterComplaintModalProps> = ({
  isOpen,
  onClose,
  defaultInstitutionId,
}) => {
  const { institutions, addComplaint } = useComplaints();

  const [institutionId, setInstitutionId] = useState(defaultInstitutionId || institutions[0]?.id || '');
  const [bureau, setBureau] = useState<BureauCode>('PGRC');
  const [category, setCategory] = useState<ComplaintCategory>('FACULTY_NON_PAYMENT');
  const [complainantType, setComplainantType] = useState<ComplainantType>('FACULTY');
  const [lodgingChannel] = useState<LodgingChannel>('ONLINE_PORTAL');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'>('NORMAL');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setError('Please provide a complaint subject.');
      return;
    }
    if (!description.trim()) {
      setError('Please provide detailed grievance descriptions.');
      return;
    }

    const categoryLabels: Record<ComplaintCategory, string> = {
      FACULTY_NON_PAYMENT: 'Faculty Non-Payment & Pay Commission Norms Violation',
      EXCESS_CAPITATION_FEE: 'Demand of Excess / Capitation Fee over Prescribed Slabs',
      INFRASTRUCTURE_DEFICIENCY: 'Deficient Physical Labs, Library, or Cadre Standards',
      UNAPPROVED_COURSES: 'Conducting Unapproved Courses without AICTE Extension of Approval',
      RAGGING_SAFETY_VIOLATION: 'Ragging or Safety Norms Non-Compliance',
      WITHHOLDING_CERTIFICATES: 'Withholding Original Certificates / Degrees',
      ADMISSION_IRREGULARITY: 'Admission Irregularity / Refund Non-Compliance',
      GOVERNANCE_MALPRACTICE: 'Governing Body Malpractice / ICC Non-Functioning',
      EXAMINATION_FRAUD: 'Examination Misconduct / Evaluation Manipulation',
      SEXUAL_HARASSMENT_ICC: 'Gender Harassment / POSH Committee Violation',
    };

    addComplaint({
      institutionId,
      currentBureau: bureau,
      category,
      categoryLabel: categoryLabels[category],
      complainantType,
      lodgingChannel,
      priority,
      subject,
      description,
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register New Institution Complaint"
      subtitle="AICTE Central Grievance Ingestion Gateway (RB • PGRC • AB)"
      maxWidth="2xl"
      accent="green"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
        {error && (
          <div className="p-3 bg-[#FF5C5C]/15 border border-[#FF5C5C]/40 text-[#FF6B6B] font-mono">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Target Institution */}
          <div>
            <label className="block text-[#A6B7A8] font-medium mb-1">
              Respondent Technical Institution <span className="text-[#C4F279]">*</span>
            </label>
            <select
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
              className="w-full px-3 py-2 bg-[#222F25] border border-[#35473A] text-[#E6EFE5] font-mono focus:border-[#C4F279] focus:outline-none"
            >
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} ({inst.aictePermanentId})
                </option>
              ))}
            </select>
          </div>

          {/* Receiving Bureau */}
          <div>
            <label className="block text-[#A6B7A8] font-medium mb-1">
              Receiving AICTE Bureau <span className="text-[#C4F279]">*</span>
            </label>
            <select
              value={bureau}
              onChange={(e) => setBureau(e.target.value as BureauCode)}
              className="w-full px-3 py-2 bg-[#222F25] border border-[#35473A] text-[#E6EFE5] font-mono focus:border-[#C4F279] focus:outline-none"
            >
              <option value="RB">Regulation Bureau (RB) - Legal & Norms</option>
              <option value="PGRC">Public Grievance Redressal Cell (PGRC)</option>
              <option value="AB">Approval Bureau (AB) - Approvals & Intake</option>
              <option value="PAPB">Policy & Academic Planning Bureau (PAPB)</option>
              <option value="FDB">Faculty Development Bureau (FDB)</option>
              <option value="SDC">Skill Development Cell (SDC)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Category */}
          <div>
            <label className="block text-[#A6B7A8] font-medium mb-1">
              Complaint Category <span className="text-[#C4F279]">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
              className="w-full px-3 py-2 bg-[#222F25] border border-[#35473A] text-[#E6EFE5] font-mono focus:border-[#C4F279] focus:outline-none"
            >
              <option value="FACULTY_NON_PAYMENT">Faculty Non-Payment (7th CPC)</option>
              <option value="EXCESS_CAPITATION_FEE">Capitation Fee / Extortion</option>
              <option value="INFRASTRUCTURE_DEFICIENCY">Infrastructure Deficiency</option>
              <option value="UNAPPROVED_COURSES">Unapproved Courses / Intake</option>
              <option value="WITHHOLDING_CERTIFICATES">Withholding Certificates / Fee</option>
              <option value="RAGGING_SAFETY_VIOLATION">Ragging / Safety Breach</option>
              <option value="ADMISSION_IRREGULARITY">Admission Irregularity</option>
              <option value="GOVERNANCE_MALPRACTICE">Governance Malpractice</option>
              <option value="EXAMINATION_FRAUD">Examination Misconduct</option>
            </select>
          </div>

          {/* Complainant Type */}
          <div>
            <label className="block text-[#A6B7A8] font-medium mb-1">
              Complainant Category <span className="text-[#C4F279]">*</span>
            </label>
            <select
              value={complainantType}
              onChange={(e) => setComplainantType(e.target.value as ComplainantType)}
              className="w-full px-3 py-2 bg-[#222F25] border border-[#35473A] text-[#E6EFE5] font-mono focus:border-[#C4F279] focus:outline-none"
            >
              <option value="FACULTY">Faculty Member / Teaching Staff</option>
              <option value="STUDENT">Enrolled Student / Alumni</option>
              <option value="PARENT">Parent / Legal Guardian</option>
              <option value="CITIZEN">Citizen / Social Welfare Body</option>
              <option value="ANONYMOUS_WHISTLEBLOWER">Confidential Whistleblower</option>
              <option value="COURT_DIRECTIVE">Court Notice / Legal Directive</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-[#A6B7A8] font-medium mb-1">
              Triage Priority Level <span className="text-[#C4F279]">*</span>
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full px-3 py-2 bg-[#222F25] border border-[#35473A] text-[#E6EFE5] font-mono focus:border-[#C4F279] focus:outline-none"
            >
              <option value="LOW">Low (Standard SLA 45 Days)</option>
              <option value="NORMAL">Normal (Standard SLA 30 Days)</option>
              <option value="HIGH">High (Urgent SLA 15 Days)</option>
              <option value="CRITICAL">Critical (Immediate SLA 7 Days)</option>
            </select>
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-[#A6B7A8] font-medium mb-1">
            Subject Heading <span className="text-[#C4F279]">*</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Non-payment of salary arrears for mechanical department faculty"
            className="w-full px-3 py-2 bg-[#222F25] border border-[#35473A] text-[#E6EFE5] focus:border-[#C4F279] focus:outline-none font-sans"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-[#A6B7A8] font-medium mb-1">
            Comprehensive Complaint Narrative <span className="text-[#C4F279]">*</span>
          </label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Specify details, affected batches, faculty counts, academic sessions, and institutional interactions..."
            className="w-full px-3 py-2 bg-[#222F25] border border-[#35473A] text-[#E6EFE5] focus:border-[#C4F279] focus:outline-none font-sans"
          />
        </div>

        {/* Actions */}
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
            Submit & Generate Case ID
          </button>
        </div>
      </form>
    </Modal>
  );
};
