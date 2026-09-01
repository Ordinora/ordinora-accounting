"use client";

import { MoreHorizontal } from "lucide-react";
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type MenuPosition = { left: number; top: number; visible: boolean };

export function ActionMenu({ ariaLabel = "Transaction options", children }: { ariaLabel?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ left: 0, top: 0, visible: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !menuRef.current) return;
    const button = buttonRef.current.getBoundingClientRect();
    const menu = menuRef.current.getBoundingClientRect();
    const gap = 7, edge = 8;
    const left = Math.min(Math.max(edge, button.right - menu.width), window.innerWidth - menu.width - edge);
    const roomBelow = window.innerHeight - button.bottom - edge;
    const top = roomBelow >= menu.height + gap ? button.bottom + gap : Math.max(edge, button.top - menu.height - gap);
    setPosition({ left, top, visible: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeForOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const closeForEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const closeForViewportChange = () => setOpen(false);
    document.addEventListener("pointerdown", closeForOutsideClick);
    document.addEventListener("keydown", closeForEscape);
    window.addEventListener("resize", closeForViewportChange);
    window.addEventListener("scroll", closeForViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", closeForOutsideClick);
      document.removeEventListener("keydown", closeForEscape);
      window.removeEventListener("resize", closeForViewportChange);
      window.removeEventListener("scroll", closeForViewportChange, true);
    };
  }, [open]);

  return <span className="transaction-actions">
    <button ref={buttonRef} type="button" className="transaction-action-trigger" aria-label={ariaLabel} title={ariaLabel} aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => { setPosition({ left: 0, top: 0, visible: false }); setOpen((value) => !value); }}><MoreHorizontal size={19} /></button>
    {open && createPortal(<div ref={menuRef} id={menuId} className="transaction-action-menu transaction-action-menu-floating" style={{ left: position.left, top: position.top, visibility: position.visible ? "visible" : "hidden" }} onClick={(event) => { if (event.target instanceof Element && event.target.closest("a")) setOpen(false); }}>{children}</div>, document.body)}
  </span>;
}
