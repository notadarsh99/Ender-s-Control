"use client"

import { motion } from "framer-motion"
import { Gauge, Database, Headset, ShieldCheck } from "lucide-react"

const stats = [
  { icon: Gauge, value: "99.99%", label: "Uptime" },
  { icon: Database, value: "NVMe", label: "Storage" },
  { icon: Headset, value: "24/7", label: "Support" },
  { icon: ShieldCheck, value: "DDoS", label: "Protection" },
]

const containerVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, damping: 20, stiffness: 120 },
  },
}

export default function StatsSection() {
  return (
    <section className="relative bg-[#020617] px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24">
      <motion.div
        className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
      >
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={itemVariants}
            whileHover={{ y: -4 }}
            className="bubu-glass bubu-card-hover rounded-xl px-4 py-6 sm:px-6 sm:py-8 flex flex-col items-center text-center gap-2"
          >
            <stat.icon className="w-5 h-5 sm:w-6 sm:h-6 text-[#22d3ee] mb-1" strokeWidth={1.75} />
            <div className="orbitron-font text-xl sm:text-2xl lg:text-3xl font-bold text-white">
              {stat.value}
            </div>
            <div className="text-xs sm:text-sm text-slate-400 tracking-wide uppercase">
              {stat.label}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}
