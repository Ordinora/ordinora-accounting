import { describe, expect, it } from "vitest";
import { availableDocumentWorkflowStatuses, clientDocumentStatus, validateDocumentWorkflowChange } from "./document-workflow";

describe("document workflow", () => {
  it("moves a reviewed document to posted only with a transaction reference", () => {
    expect(() => validateDocumentWorkflowChange({ current: "UNDER_REVIEW", next: "POSTED" })).toThrow(/reference/i);
    expect(validateDocumentWorkflowChange({ current: "UNDER_REVIEW", next: "POSTED", reference: "PI-2026-0042" })).toMatchObject({ workflowStatus: "POSTED", workflowReference: "PI-2026-0042" });
  });

  it("requires a rejection reason and permits a rejected document to be reopened", () => {
    expect(() => validateDocumentWorkflowChange({ current: "RECEIVED", next: "REJECTED" })).toThrow(/reason/i);
    expect(validateDocumentWorkflowChange({ current: "REJECTED", next: "UNDER_REVIEW", note: "Client clarified the invoice." }).workflowStatus).toBe("UNDER_REVIEW");
  });

  it("keeps posted documents terminal", () => {
    expect(() => validateDocumentWorkflowChange({ current: "POSTED", next: "UNDER_REVIEW", note: "Correction" })).toThrow(/cannot move/i);
    expect(availableDocumentWorkflowStatuses("POSTED")).toEqual([]);
  });

  it("shows security state ahead of processing state", () => {
    expect(clientDocumentStatus("QUARANTINED", "RECEIVED")).toBe("UPLOAD REJECTED");
    expect(clientDocumentStatus("UPLOADED", "UNDER_REVIEW")).toBe("UNDER REVIEW");
  });
});
