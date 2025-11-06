"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Pencil,
  Lightbulb,
  GraduationCap,
  Sparkles,
} from "lucide-react";

type IconConfig = {
  Icon: any;
  x: number;
  y: number;
  delay: number;
  duration: number;
  color: string;
  opacity: number;
};

export default function FloatingIcons() {
  const [icons, setIcons] = useState<IconConfig[]>([]);

  useEffect(() => {
    const ICONS = [
      BookOpen,
      Pencil,
      Lightbulb,
      GraduationCap,
      Sparkles,
      BookOpen,
      Pencil,
      Lightbulb,
      GraduationCap,
      Sparkles,
      BookOpen,
      Pencil,
    ];

    const COLORS = [
      "text-pink-300/60",
      "text-blue-300/60",
      "text-purple-300/60",
      "text-yellow-300/60",
      "text-emerald-300/60",
    ];

    const generated = ICONS.map((Icon) => ({
      Icon,
      x: Math.random() * window.innerWidth - 50,
      y: Math.random() * window.innerHeight - 50,
      delay: Math.random() * 10,
      duration: 40 + Math.random() * 25,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      opacity: 0.25 + Math.random() * 0.35,
    }));

    setIcons(generated);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {icons.map(({ Icon, x, y, delay, duration, color, opacity }, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x, y }}
          animate={{
            opacity: [0, opacity, opacity / 2, opacity],
            y: [y - 60, y + 60, y - 60],
            x: [x - 40, x + 40, x - 40],
          }}
          transition={{
            repeat: Infinity,
            duration,
            delay,
            ease: "easeInOut",
          }}
          className={`absolute ${color} drop-shadow-lg`}
        >
          <Icon size={52} /> {/* large and consistent */}
        </motion.div>
      ))}
    </div>
  );
}
