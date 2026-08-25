"use client";
import { useId, useState } from "react";

export function AutoReferenceField({ label = "Reference", example }: { label?: string; example: string }) {
  const [automatic, setAutomatic] = useState(true);
  const fieldId = useId();
  const referenceId = `${fieldId}-reference`;
  const automaticId = `${fieldId}-automatic`;
  return <div className="auto-reference-field"><label htmlFor={referenceId}>{label}</label><span className="auto-reference-control"><input id={referenceId} name="reference" disabled={automatic} required={!automatic} maxLength={40} placeholder={automatic ? "Assigned when posted" : example} /><label className="auto-reference-option" htmlFor={automaticId}><input id={automaticId} type="checkbox" name="autoReference" value="true" checked={automatic} onChange={(event) => setAutomatic(event.target.checked)} />Automatic reference</label></span>{automatic && <input type="hidden" name="reference" value="" />}</div>;
}
