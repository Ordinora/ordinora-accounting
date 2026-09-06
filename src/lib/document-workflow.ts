export const documentWorkflowStatuses = ["RECEIVED", "UNDER_REVIEW", "POSTED", "REJECTED"] as const;
export type DocumentWorkflowStatusValue = (typeof documentWorkflowStatuses)[number];

const allowedTransitions: Record<DocumentWorkflowStatusValue, readonly DocumentWorkflowStatusValue[]> = {
  RECEIVED: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["POSTED", "REJECTED"],
  POSTED: [],
  REJECTED: ["UNDER_REVIEW"],
};

export function availableDocumentWorkflowStatuses(current: DocumentWorkflowStatusValue) {
  return allowedTransitions[current];
}

export function validateDocumentWorkflowChange(input: {
  current: DocumentWorkflowStatusValue;
  next: DocumentWorkflowStatusValue;
  reference?: string;
  note?: string;
}) {
  const reference = input.reference?.trim() || null;
  const note = input.note?.trim() || null;
  if (!allowedTransitions[input.current].includes(input.next)) {
    throw new Error(`A document cannot move from ${input.current.replaceAll("_", " ")} to ${input.next.replaceAll("_", " ")}.`);
  }
  if (input.next === "POSTED" && !reference) throw new Error("Enter the posted transaction reference before marking the document as posted.");
  if (input.next === "REJECTED" && !note) throw new Error("Enter a reason before rejecting the document.");
  return {
    workflowStatus: input.next,
    workflowReference: input.next === "POSTED" ? reference : null,
    workflowNote: note,
  };
}

export function clientDocumentStatus(status: string, workflowStatus: DocumentWorkflowStatusValue) {
  if (status === "SCAN_PENDING") return "SECURITY REVIEW";
  if (status === "QUARANTINED") return "UPLOAD REJECTED";
  return workflowStatus.replaceAll("_", " ");
}
