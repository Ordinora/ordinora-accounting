"use client";

import { useActionState, useState } from "react";
import { FileUp, Upload } from "lucide-react";
import { uploadClientDocument } from "@/app/portal/documents/actions";

export function ClientDocumentUploadForm() {
  const [state, action, pending] = useActionState(uploadClientDocument, {});
  const [selectedName, setSelectedName] = useState("");
  return <form action={action} className="client-document-upload">
    <label className="client-file-picker">
      <span className="client-file-picker-button"><FileUp size={18}/>Select invoice or document</span>
      <span className="client-file-picker-name">{selectedName || "No document selected"}</span>
      <input name="document" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required onChange={(event) => setSelectedName(event.target.files?.[0]?.name ?? "")}/>
    </label>
    <p className="upload-help">Maximum 10 MB. PDF, JPG and PNG files only.</p>
    {state.error && <div className="form-error" role="alert">{state.error}</div>}
    {state.success && <div className="form-success" role="status">{state.success}</div>}
    <button className="button-primary" disabled={pending || !selectedName}><Upload size={15}/>{pending ? "Uploading…" : "Send to accountant"}</button>
  </form>;
}
