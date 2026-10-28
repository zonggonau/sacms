export interface ProposalPerson {
  id: string
  name: string | null
  email: string
}

export interface ProposalActivity {
  id: string
  type: "note" | "status_change" | "call" | "email" | "meeting" | string
  message: string | null
  fromStage: string | null
  toStage: string | null
  createdAt: string
  author: ProposalPerson | null
}

export interface Proposal {
  id: string
  institutionName: string
  institutionType: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  stage: string
  estimatedValueIdr: number | null
  notes: string | null
  lostReason: string | null
  /** Short feature list shown as the offer item's description on the PDF —
   *  staff-editable, optionally AI-suggested. */
  featuresText: string | null
  /** Live demo website URL (e.g. a Vercel preview) SaCMS's team already
   *  built for this prospect — embedded as a QR code on the proposal PDF. */
  demoUrl: string | null
  assignedToId: string | null
  assignedTo: ProposalPerson | null
  createdBy: ProposalPerson | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  activities?: ProposalActivity[]
  _count?: { activities: number }
}
