"use client";

/** Scene 4 — Doctor profile entrance: soft clip-path wipe + photo settle. */
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function DoctorReveal({ children, className, index = 0 }: { children: ReactNode; className?: string; index?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.article
      className={className}
      initial={reduce ? false : { opacity: 0, clipPath: "inset(12% 6% 12% 6% round 2rem)", y: 40 }}
      whileInView={{ opacity: 1, clipPath: "inset(0% 0% 0% 0% round 2rem)", y: 0 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: index * 0.12 }}
    >
      {children}
    </motion.article>
  );
}
