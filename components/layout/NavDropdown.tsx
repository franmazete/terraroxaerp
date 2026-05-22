"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "./NavDropdown.module.css";
import type { NavItem } from "./nav-config";

interface Props {
  label: string;
  items: NavItem[];
}

export function NavDropdown({ label, items }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const hasActive = items.some((i) => pathname === i.href);

  return (
    <div className={s.wrap} ref={ref}>
      <button
        type="button"
        className={`${s.trigger} ${open ? s.open : ""} ${hasActive && !open ? s.hasActive : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <span className={s.caret}>▾</span>
      </button>
      {open && (
        <div className={s.menu}>
          {items.length === 0 ? (
            <div className={s.empty}>Nenhuma opção disponível</div>
          ) : (
            items.map((item) => (
              <Link key={item.href} href={item.href} className={`${s.menuItem} ${pathname === item.href ? s.active : ""}`}>
                {item.label}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
