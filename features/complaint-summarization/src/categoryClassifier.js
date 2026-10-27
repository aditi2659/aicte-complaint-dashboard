import { PROVISIONAL_CATEGORIES } from './outputValidator.js';

const CATEGORY_RULES = [
  {
    category: 'Admissions and Enrollment',
    keywords: ['admission', 'enrollment', 'merit list', 'seat', 'application', 'registration', 'student intake', 'fee payment']
  },
  {
    category: 'Infrastructure and Facilities',
    keywords: ['classroom', 'library', 'laboratory', 'labs', 'water', 'toilet', 'sanitation', 'building', 'facility', 'internet', 'computer', 'wifi', 'hostel', 'electricity', 'ventilation']
  },
  {
    category: 'Faculty and Staff',
    keywords: ['faculty', 'teacher', 'staff', 'lecturer', 'hod', 'principal', 'non-teaching', 'staff shortage', 'faculty shortage']
  },
  {
    category: 'Academic and Curriculum',
    keywords: ['syllabus', 'curriculum', 'course', 'class', 'exam timing', 'teaching', 'attendance', 'marks', 'internals', 'academic']
  },
  {
    category: 'Fees and Financial Issues',
    keywords: ['fee', 'fees', 'tuition', 'scholarship', 'payment', 'refund', 'financial', 'cost', 'charges']
  },
  {
    category: 'Examinations, Certificates and Documentation',
    keywords: ['hall ticket', 'certificate', 'document', 'transcript', 'marksheet', 'degree', 'exam', 'result', 'admit card', 'transfer certificate', 'migration']
  },
  {
    category: 'Placements and Career Services',
    keywords: ['placement', 'career', 'internship', 'recruitment', 'job', 'campus drive', 'training placement']
  },
  {
    category: 'Regulatory Compliance',
    keywords: ['aicte', 'regulation', 'compliance', 'approval', 'affiliation', 'accreditation', 'inspection', 'norms', 'licensing']
  },
  {
    category: 'Faculty Development and Training',
    keywords: ['faculty development', 'workshop', 'training', 'fdp', 'seminar', 'staff development', 'professional development']
  },
  {
    category: 'Approval, Affiliation and Accreditation',
    keywords: ['approval', 'affiliation', 'accreditation', 'recognition', 'permission', 'renewal']
  }
];

function normalizeKeywords(value) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
}

export function suggestCategory(description, summary, keyIssues, options = {}) {
  const text = normalizeKeywords(`${description || ''} ${summary || ''} ${(keyIssues || []).join(' ')}`);
  const trimmedText = text.trim();

  if (!trimmedText || trimmedText.length < 8) {
    return {
      suggested_category: 'Other',
      category_review_required: true,
      reason: 'Insufficient detail for a confident category suggestion.'
    };
  }

  const matches = CATEGORY_RULES.map((rule) => ({
    category: rule.category,
    score: rule.keywords.reduce((count, keyword) => {
      return count + (text.includes(keyword) ? 1 : 0);
    }, 0)
  })).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);

  if (matches.length === 0) {
    return {
      suggested_category: 'Other',
      category_review_required: true,
      reason: 'No category matches were identified with enough confidence.'
    };
  }

  const winner = matches[0];
  const topScore = winner.score;
  const nextBest = matches[1]?.score ?? 0;
  const ambiguous = topScore === nextBest || topScore < 2;

  if (ambiguous || options.requireReview) {
    return {
      suggested_category: topScore > 0 ? winner.category : 'Other',
      category_review_required: true,
      reason: 'The complaint is ambiguous or low confidence; human review is recommended.'
    };
  }

  return {
    suggested_category: winner.category,
    category_review_required: false,
    reason: 'Category matched a clear keyword pattern.'
  };
}

export { PROVISIONAL_CATEGORIES };
