import { describe, expect, it } from "vitest";
import { basicDocumentScan } from "./document-scanner";

describe("document quarantine scanner", () => {
  it("allows a passive document through the basic development scanner", () => {
    const result = basicDocumentScan(new TextEncoder().encode("%PDF-1.7 invoice\n%%EOF"), "application/pdf");
    expect(result.clean).toBe(true);
  });

  it("quarantines the standard antivirus test signature", () => {
    const bytes = new TextEncoder().encode("EICAR-STANDARD-ANTIVIRUS-TEST-FILE");
    expect(basicDocumentScan(bytes, "image/jpeg")).toMatchObject({ clean: false, result: "MALWARE_TEST_SIGNATURE" });
  });

  it("quarantines PDFs containing active launch instructions", () => {
    const bytes = new TextEncoder().encode("%PDF-1.7 /Launch action\n%%EOF");
    expect(basicDocumentScan(bytes, "application/pdf")).toMatchObject({ clean: false, result: "ACTIVE_PDF_CONTENT" });
  });
});
