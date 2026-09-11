import { User, Company, ExportRecord, Complaint } from './types';

export interface ChatContext {
  user: User | null;
  companies: Company[];
  exportRecords: ExportRecord[];
  complaints: Complaint[];
  productCount: number;
  countryCount: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  createdAt: string;
}

export const QUICK_REPLIES = [
  'How do I submit an export record?',
  'What documents are required?',
  'How many items are pending?',
  'How do I track a complaint?',
  'What is the approval process?',
  'Contact support',
];

function firstName(user: User | null): string | null {
  if (!user?.full_name) return null;
  const parts = user.full_name.trim().split(/\s+/);
  const first = parts[0];
  return ['Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Muhammad'].includes(first) && parts.length > 1 ? parts[1] : first;
}

function pendingCounts(ctx: ChatContext) {
  const registrations = ctx.companies.filter(c => ['submitted', 'under_tdap_review', 'under_nafsa_review'].includes(c.status));
  const exports = ctx.exportRecords.filter(r => ['submitted', 'under_tdap_review', 'under_nafsa_review'].includes(r.status));
  const complaints = ctx.complaints.filter(c => !['resolved', 'closed'].includes(c.status));
  return { registrations, exports, complaints };
}

function myRecordsSummary(ctx: ChatContext): string {
  if (!ctx.user) {
    return 'You are not signed in right now. Log in to your dashboard and I can summarise your export records, drafts, and pending reviews.';
  }
  const isAdmin = ['super_admin', 'moc_admin', 'tdap_admin', 'tdap_officer', 'nafsa_admin', 'nafsa_officer', 'tic', 'auditor'].includes(ctx.user.role);
  if (isAdmin) {
    const { registrations, exports, complaints } = pendingCounts(ctx);
    return [
      `Here is the current national picture, ${firstName(ctx.user) || 'Officer'}:`,
      `• Pending company registrations: ${registrations.length}`,
      `• Export records awaiting review: ${exports.length}`,
      `• Open complaints: ${complaints.length}`,
      `• Total export records in the system: ${ctx.exportRecords.length}`,
      '',
      'You can action these from the Review Workspace (Review & Approval).',
    ].join('\n');
  }
  const mine = ctx.exportRecords.filter(r => r.exporter_id === ctx.user!.id || r.exporter_id === 'u8');
  const pending = mine.filter(r => ['submitted', 'under_tdap_review', 'under_nafsa_review', 'additional_info_required'].includes(r.status));
  const approved = mine.filter(r => r.status === 'approved');
  const drafts = mine.filter(r => r.status === 'draft');
  const rejected = mine.filter(r => r.status === 'rejected');
  return [
    `Here is a summary of your export activity, ${firstName(ctx.user) || 'there'}:`,
    `• Total records: ${mine.length}`,
    `• Pending review: ${pending.length}`,
    `• Approved: ${approved.length}`,
    `• Drafts: ${drafts.length}`,
    `• Rejected: ${rejected.length}`,
    '',
    'Head to Dashboard → Export Records to view or edit them.',
  ].join('\n');
}

interface Intent {
  test: (text: string) => boolean;
  reply: (ctx: ChatContext) => string;
}

const STATUS_EXPLANATIONS: { keys: string[]; title: string; explain: string }[] = [
  { keys: ['draft'], title: 'Draft', explain: 'The record has been started but not yet submitted for review. You can still edit or delete it.' },
  { keys: ['submitted'], title: 'Submitted', explain: 'The record has been submitted and is waiting in the review queue for a TDAP or NAFSA officer.' },
  { keys: ['under_tdap_review', 'tdap review', 'under review'], title: 'Under TDAP Review', explain: 'A TDAP officer has picked up the record and is verifying the details and documents.' },
  { keys: ['under_nafsa_review', 'nafsa review'], title: 'Under NAFSA Review', explain: 'The food-safety authority (NAFSA) is reviewing the record, usually after TDAP clearance.' },
  { keys: ['additional_info_required', 'additional info', 'request info', 'additional information'], title: 'Additional Info Required', explain: 'The reviewer needs something clarified or an extra document. Edit the record — saving resubmits it for review automatically.' },
  { keys: ['approved'], title: 'Approved', explain: 'The record passed review. Registrations become verified exporters; consignments are ready for shipment.' },
  { keys: ['rejected'], title: 'Rejected', explain: 'The reviewer declined it, with remarks explaining why. You can correct the record and resubmit it.' },
  { keys: ['ready_for_shipment', 'ready for shipment'], title: 'Ready for Shipment', explain: 'An approved consignment cleared for dispatch from the port of departure.' },
  { keys: ['shipped'], title: 'Shipped', explain: 'The consignment has departed and is on the water to its destination port.' },
  { keys: ['delivered'], title: 'Delivered', explain: 'The consignment arrived at the destination and was received by the buyer.' },
  { keys: ['closed'], title: 'Closed', explain: 'The lifecycle is complete — the record or complaint is archived.' },
  { keys: ['escalated'], title: 'Escalated', explain: 'A complaint was raised to a higher escalation level because it breached or was about to breach its SLA.' },
  { keys: ['resolved'], title: 'Resolved', explain: 'The complaint was investigated and closed with a resolution summary.' },
];

const INTENTS: Intent[] = [
  // Identity & capabilities
  {
    test: t => /who are you|what are you|are you (a |an )?(bot|robot|ai|human)|your name/.test(t),
    reply: () => "I'm the Export Portal Assistant — an AI helper that sailed in with the consignments. I'm rule-based in this demo, but I know the portal inside out: registrations, export records, reviews, and complaints. Ask me anything about getting your exports moving!",
  },
  {
    test: t => /\b(help|what can you do|capabilities|options|menu|assist)\b/.test(t),
    reply: () => [
      "Here's what I can help with:",
      '• Submitting a new export record (step by step)',
      '• Required documents (SPS, PSI, and the rest)',
      '• The approval / review workflow (TDAP & NAFSA)',
      '• Filing and tracking complaints',
      '• Status meanings (draft, approved, rejected…)',
      '• Live pending counts and your record summaries',
      '',
      'Just ask in your own words, or tap a suggestion chip below.',
    ].join('\n'),
  },

  // Greetings & farewells
  {
    test: t => /^(hi|hey|hello|yo|salam|assalam|as.?salam|aoa|good (morning|afternoon|evening))\b/.test(t) || /\bsalam\b/.test(t),
    reply: ctx => {
      const name = firstName(ctx.user);
      return `Assalam-o-Alaikum${name ? `, ${name}` : ''}! I'm the Export Portal Assistant. I can guide you through export records, registrations, approvals, and complaints. What would you like to do today?`;
    },
  },
  {
    test: t => /^(bye|goodbye|farewell|khuda hafiz|allah hafiz|see you)\b/.test(t),
    reply: () => 'Allah Hafiz! Fair winds and following seas for your exports. I\'ll be right here if you need me again.',
  },
  {
    test: t => /\b(thank|thanks|shukriya|appreciate)\b/.test(t),
    reply: () => "You're most welcome! Anything else I can help you with?",
  },

  // Live data: pending counts
  {
    test: t => /\b(pending|queue|awaiting|waiting|backlog|open complaint)\b/.test(t) || /how many .*\bcomplaints?\b/.test(t),
    reply: ctx => {
      const { registrations, exports, complaints } = pendingCounts(ctx);
      if (registrations.length + exports.length + complaints.length === 0) {
        return 'Great news — the queues are clear! No pending registrations, export records awaiting review, or open complaints right now.';
      }
      return [
        'Here is the current workload:',
        `• Pending company registrations: ${registrations.length}`,
        `• Export records awaiting review: ${exports.length}`,
        `• Open complaints: ${complaints.length}`,
        '',
        'Officers can action these under Review Workspace. Ask me "what is the approval process" to learn how it works.',
      ].join('\n');
    },
  },
  {
    test: t => /\b(my records|my exports|my consignments|my shipments|my activity|my dashboard)\b/.test(t) || /how many .*\b(records|exports|consignments|shipments)\b/.test(t),
    reply: myRecordsSummary,
  },

  // Export record submission
  {
    test: t => /(submit|create|file|make|new).*(export|record|consignment|shipment)|(export|consignment).*(submit|create)/.test(t) || /new export record/.test(t),
    reply: () => [
      "Submitting an export record takes 5 short steps. From your dashboard, open New Export Record:",
      '1. Exporter Info — auto-filled from your registered company.',
      '2. Export Item — product, HS code, quantity, value, packaging, and shipment date.',
      '3. Buyer Info — buyer name, company, country, contact, and purchase order.',
      '4. Shipment — destination country/port, departure port, transport mode, and dates.',
      '5. Documents — upload your paperwork.',
      '',
      'Note: the DDP SPS Certificate and Pre-Shipment Inspection (PSI) Report are mandatory before you can submit. Once submitted, the record enters the TDAP/NAFSA review queue and gets a consignment number like EXP-2025061.',
    ].join('\n'),
  },

  // Documents
  {
    test: t => /\b(document|documents|paperwork|attachment|upload)\b/.test(t) || /\b(sps|psi|phytosanitary|certificate)\b/.test(t),
    reply: ctx => [
      'For an export record you can upload these documents:',
      '• Buyer\'s Quality Requirement Sheet',
      '• DDP SPS Certificate * (mandatory)',
      '• Pre-Shipment Inspection (PSI) Report * (mandatory)',
      '• Purchase Order / Export Contract',
      '• Commercial Invoice',
      '• Packing List',
      '• Certificate of Origin',
      '• Phytosanitary Certificate',
      '• Laboratory Test Report',
      '• Bill of Lading / Airway Bill',
      '• Additional Supporting Documents',
      '',
      'Accepted formats: PDF, JPG, PNG, DOCX, XLSX — up to 10 MB each. Submission is blocked until the two mandatory documents marked * are uploaded.',
      `Fun fact: there are currently ${ctx.productCount} approved products and ${ctx.countryCount} destination countries in the master data.`,
    ].join('\n'),
  },

  // Complaints: filing
  {
    test: t => /(file|submit|make|raise|lodge|register|new).*(complaint|issue|grievance)|(complaint).*(file|submit|raise)/.test(t),
    reply: () => [
      'Filing a complaint is simple — and you don\'t even need a portal account:',
      '1. Open the "Submit Complaint" page (link in the top navigation on the landing page).',
      '2. Fill in your details, the exporter/company involved, the category, subject, and a full description.',
      '3. Tick the declaration consent checkbox.',
      '4. Submit — you\'ll receive a tracking number like CMP-2025021.',
      '',
      'Complaints get a 14-day SLA. If they run late they are escalated, and you can follow progress on the Track Complaint page at any time.',
    ].join('\n'),
  },

  // Complaints: tracking
  {
    test: t => /\b(track|tracking|trace|follow ?up)\b/.test(t) || /(complaint|case).*(status|progress)/.test(t),
    reply: () => [
      'To track a complaint:',
      '1. Open the "Track Complaint" page (no login needed).',
      '2. Enter your tracking number, e.g. CMP-2025001.',
      '3. You\'ll see the current status, SLA deadline, and a timeline: Submitted → Acknowledged → Under Review → Assigned → Resolved.',
      '',
      'Tip: once a complaint is resolved, the resolution summary is shown at the bottom of the tracking page.',
    ].join('\n'),
  },

  // Registration
  {
    test: t => /\b(register|registration|sign ?up|company profile|become an exporter)\b/.test(t),
    reply: () => [
      'To become a verified exporter:',
      '1. Create a portal account (Register on the landing page) with your email.',
      '2. Complete your company profile — legal name, NTN, SECP number, address, and business details.',
      '3. Submit for verification.',
      '4. Your registration is checked against NADRA, SECP, and FBR/NTN records, then reviewed by TDAP and NAFSA officers.',
      '',
      'Once approved, your company status becomes "Approved" and you can submit export consignments. If the reviewers need something extra, the status shows "Additional Info Required" with their remarks.',
    ].join('\n'),
  },

  // Approval workflow / SLA
  {
    test: t => /(approval|review|verif|process).*(process|workflow|work|time|long|take)|how long|sla|turnaround|timeline/.test(t),
    reply: () => [
      'Here\'s how approvals flow:',
      '1. You submit a registration or export record (status: Submitted).',
      '2. A TDAP officer reviews it (Under TDAP Review) — verifying details and documents.',
      '3. Food-safety checks go to NAFSA where applicable (Under NAFSA Review).',
      '4. Decision: Approved, Rejected (with remarks), or Additional Info Required.',
      '5. Approved consignments move on to Ready for Shipment → Shipped → Delivered → Closed.',
      '',
      'You\'re notified at every decision, and every action is written to the immutable audit log. If a record comes back rejected or needing info, just edit it — saving automatically resubmits it to the queue.',
      'Complaints follow a 14-day SLA; overdue cases are escalated to higher levels.',
    ].join('\n'),
  },

  // Roles / institutions
  {
    test: t => /\b(tdap|nafsa|moc|mnfsr|tic|institution|who approves|who reviews|roles?)\b/.test(t),
    reply: () => [
      'The portal brings these institutions together:',
      '• MNFSR — Ministry of National Food Security & Research (overall governance, super admins, auditors).',
      '• MoC — Ministry of Commerce.',
      '• TDAP — Trade Development Authority of Pakistan: first-line review of registrations and consignments.',
      '• NAFSA — National Food Safety Authority: SPS/food-safety verification.',
      '• TICs — Trade & Investment Counsellors posted in destination countries (Beijing, Dubai, Riyadh, London, Kuala Lumpur).',
      '',
      'TDAP and NAFSA officers handle the review queues; super admins manage users, master data, and audit.',
    ].join('\n'),
  },

  // Contact / support
  {
    test: t => /\b(contact|helpline|support|hotline|phone|call|speak to|talk to|human agent)\b/.test(t),
    reply: () => [
      'Ways to reach a human:',
      '• Portal support (demo): support@exportportal.gov.pk',
      '• TDAP helpdesk: via your dashboard notifications',
      '• For complaints about an export transaction, use the public complaint form — it reaches the responsible officers directly and has a 14-day SLA.',
      '',
      'I can also answer most questions right here, instantly, day or night.',
    ].join('\n'),
  },

  // Reset demo data
  {
    test: t => /(reset|clear|restore).*(data|demo|sample)|start over|default data/.test(t),
    reply: () => 'To restore the demo dataset to its initial state: open the Admin Dashboard and click "Reset Demo Data" (top-right, next to the period selector). This clears approvals, edits, and submissions you have made — the ship returns to port for a fresh voyage.',
  },
];

export function getBotReply(input: string, ctx: ChatContext): string {
  const text = input.toLowerCase().trim();

  // Status explanation: find any status keyword mentioned
  const statusHit = STATUS_EXPLANATIONS.find(s => s.keys.some(k => text.includes(k)));
  if (statusHit && /what|why|how|explain|mean|status|shows?|say/.test(text)) {
    return `${statusHit.title}: ${statusHit.explain}`;
  }
  if (statusHit && /^(draft|submitted|approved|rejected|shipped|delivered|closed|resolved|escalated)$/.test(text.replace(/[\s_]+/g, '_'))) {
    return `${statusHit.title}: ${statusHit.explain}`;
  }

  for (const intent of INTENTS) {
    if (intent.test(text)) return intent.reply(ctx);
  }

  // Suggestions fallback
  const name = firstName(ctx.user);
  return [
    `I'm not sure I caught that${name ? `, ${name}` : ''} — I'm still learning the shipping lanes.`,
    'Try asking about:',
    '• "How do I submit an export record?"',
    '• "What documents are required?"',
    '• "How many items are pending?"',
    '• "Track my complaint"',
    '• "What does \'rejected\' mean?"',
  ].join('\n');
}

export function welcomeMessage(ctx: ChatContext): string {
  const name = firstName(ctx.user);
  if (!ctx.user) {
    return "Assalam-o-Alaikum! I'm the Export Portal Assistant. Ask me about submitting export records, required documents, approvals, or tracking complaints — no login needed for questions.";
  }
  const isAdmin = ['super_admin', 'moc_admin', 'tdap_admin', 'tdap_officer', 'nafsa_admin', 'nafsa_officer', 'tic', 'auditor'].includes(ctx.user.role);
  if (isAdmin) {
    const { registrations, exports, complaints } = pendingCounts(ctx);
    return `Assalam-o-Alaikum, ${name}! I'm the Export Portal Assistant. Quick ship's log: ${registrations.length} pending registration${registrations.length === 1 ? '' : 's'}, ${exports.length} export record${exports.length === 1 ? '' : 's'} awaiting review, and ${complaints.length} open complaint${complaints.length === 1 ? '' : 's'}. How can I help?`;
  }
  return `Assalam-o-Alaikum, ${name}! I'm the Export Portal Assistant. I can walk you through export submissions, documents, approvals, and complaints. How can I help your cargo move today?`;
}
