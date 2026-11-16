"use client";

import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { WhatsAppIcon } from "../icons";

/** Hidden on the screening flow so it never looks like a channel for results. */
export function FloatingWhatsApp({ href, label }: { href: string; label: string }) {
  const pathname = usePathname() || "";
  const reduce = useReducedMotion();
  if (pathname.includes("/screening") || pathname.includes("/report")) return null;
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      initial={reduce ? false : { opacity: 0, scale: 0.6, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-5 right-5 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#1FAF5A] text-white shadow-[0_16px_40px_-12px_rgba(31,175,90,0.8)] transition hover:scale-105 md:bottom-8 md:right-8"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </motion.a>
  );
}
