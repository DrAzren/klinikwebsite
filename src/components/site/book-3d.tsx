"use client";

/**
 * Scene 7 — Featured book. A CSS 3D book (cover, spine, page block) that
 * follows the pointer and settles with a spring. Uses the real cover image.
 */
import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useRef } from "react";

export function Book3D({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const ry = useSpring(useTransform(px, [-1, 1], [-30, -6]), { stiffness: 120, damping: 16 });
  const rx = useSpring(useTransform(py, [-1, 1], [8, -8]), { stiffness: 120, damping: 16 });
  const sheen = useTransform(px, [-1, 1], ["-30%", "70%"]);

  return (
    <div
      ref={ref}
      className="relative mx-auto flex aspect-square w-full max-w-[30rem] items-center justify-center [perspective:1600px]"
      onPointerMove={(e) => {
        if (reduce || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        px.set(((e.clientX - r.left) / r.width) * 2 - 1);
        py.set(((e.clientY - r.top) / r.height) * 2 - 1);
      }}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
      }}
    >
      <div aria-hidden className="absolute bottom-[8%] left-1/2 h-10 w-[60%] -translate-x-1/2 rounded-[50%] bg-navy-950/40 blur-2xl" />
      <motion.div
        className="relative h-[78%] w-[55%] [transform-style:preserve-3d]"
        style={reduce ? { rotateY: -18 } : { rotateY: ry, rotateX: rx }}
        initial={reduce ? false : { opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Page block */}
        <div className="absolute inset-y-[1.2%] right-0 w-[34px] bg-[repeating-linear-gradient(90deg,#f4f1e8_0px,#f4f1e8_2px,#e6e1d3_3px)]" style={{ transform: "rotateY(90deg) translateX(17px) translateZ(-17px)" }} />
        {/* Back */}
        <div className="absolute inset-0 rounded-r-md bg-[#f2d21b]" style={{ transform: "translateZ(-34px)" }} />
        {/* Spine */}
        <div className="absolute inset-y-0 left-0 w-[34px] origin-left bg-[#e8c813]" style={{ transform: "rotateY(-90deg)" }}>
          <span className="absolute inset-0 flex items-center justify-center whitespace-nowrap text-[0.6rem] font-bold tracking-wider text-[#26307a] [writing-mode:vertical-rl]">DR, SAYA BOLEH SEMBUH KE? · DR AZREN</span>
        </div>
        {/* Cover */}
        <div className="absolute inset-0 overflow-hidden rounded-r-md shadow-[0_30px_60px_-20px_rgba(6,20,40,0.6)]">
          <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 28vw, 60vw" className="object-cover" />
          <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/25 to-transparent" />
          <motion.div aria-hidden className="absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent mix-blend-overlay" style={{ left: sheen }} />
        </div>
      </motion.div>
    </div>
  );
}
