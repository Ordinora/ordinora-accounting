"use client";

import { CheckCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { transactionNoticeMessages, type TransactionNoticeCode } from "@/lib/transaction-notice";

function isTransactionNoticeCode(value: string): value is TransactionNoticeCode {
  return Object.prototype.hasOwnProperty.call(transactionNoticeMessages, value);
}

export function TransactionNotification() {
  const [message, setMessage] = useState("");
  const searchParams = useSearchParams();

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("posted");
    if (!code || !isTransactionNoticeCode(code)) return;

    const showTimeout = window.setTimeout(() => setMessage(transactionNoticeMessages[code]), 0);
    url.searchParams.delete("posted");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);

    const dismissTimeout = window.setTimeout(() => setMessage(""), 5000);
    return () => {
      window.clearTimeout(showTimeout);
      window.clearTimeout(dismissTimeout);
    };
  }, [searchParams]);

  if (!message) return null;

  return (
    <div className="transaction-notification" role="status" aria-live="polite">
      <CheckCircle2 aria-hidden="true" size={21} />
      <span>{message}</span>
      <button type="button" onClick={() => setMessage("")} aria-label="Dismiss notification"><X size={17} /></button>
    </div>
  );
}
