"use client";

import { useEffect } from "react";

const preservedAutocompleteTokens = new Set([
  "username",
  "current-password",
  "new-password",
  "one-time-code",
]);

function disableBusinessAutofill(root: ParentNode) {
  const forms = [
    ...(root instanceof HTMLFormElement ? [root] : []),
    ...root.querySelectorAll("form"),
  ];
  forms.forEach((form) => {
    form.setAttribute("autocomplete", "off");
  });

  const fields = [
    ...(root instanceof HTMLInputElement || root instanceof HTMLTextAreaElement ? [root] : []),
    ...root.querySelectorAll("input, textarea"),
  ];
  fields.forEach((field) => {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;

    const autocomplete = field.getAttribute("autocomplete")?.trim().toLowerCase();
    if (autocomplete && preservedAutocompleteTokens.has(autocomplete)) return;
    if (field instanceof HTMLInputElement && ["hidden", "password"].includes(field.type)) return;

    field.setAttribute("autocomplete", "off");
    field.setAttribute("data-lpignore", "true");
    field.setAttribute("data-1p-ignore", "true");
  });
}

export function BrowserAutofillPolicy() {
  useEffect(() => {
    disableBusinessAutofill(document);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) disableBusinessAutofill(node);
        });
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
