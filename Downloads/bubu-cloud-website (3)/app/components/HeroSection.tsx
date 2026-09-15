"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import heroConfig from "../config/sections/hero.json"
import type { HeroConfig } from "../types/hero"
import { ArrowRight, ExternalLink, Server, Database, ShieldCheck, Zap } from "lucide-react"
import { useLanguage } from "../contexts/LanguageContext"

const config = heroConfig as HeroConfig

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, staggerChildren: 0.12, delayChildren: 0.15 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, damping: 20, stiffness: 110, duration: 0.7 },
  },
}

const floatCards = [
  { label: "99.99% Uptime", icon: ShieldCheck, className: "top-[6%] left-[2%] sm:left-[6%]", delay: 0 },
  { label: "NVMe SSD", icon: Database, className: "top-[20%] right-[0%] sm:right-[2%]", delay: 0.6 },
  { label: "24/7 Protection", icon: ShieldCheck, className: "bottom-[22%] left-[0%] sm:left-[0%]", delay: 1.2 },
  { label: "Instant Deployment", icon: Zap, className: "bottom-[6%] right-[6%] sm:right-[10%]", delay: 1.8 },
]

function HeroVisual() {
  return (
    <div
      className="relative mx-auto w-full max-w-[420px] aspect-square hidden md:block"
      aria-hidden="true"
    >
      {/* Outer glow */}
      <div className="absolute inset-0 rounded-full bubu-glow-cyan blur-2xl opacity-70" />

      {/* Rotating rings */}
      <div className="absolute inset-[6%] rounded-full border border-cyan-400/20 bubu-spin-slow" />
      <div className="absolute inset-[16%] rounded-full border border-blue-400/15 bubu-spin-slow-reverse" />
      <div className="absolute inset-[26%] rounded-full border border-cyan-300/10" />

      {/* Network node dots on the outer ring */}
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <div
          key={deg}
          className="absolute inset-[6%] bubu-spin-slow"
          style={{ transformOrigin: "50% 50%" }}
        >
          <div
            className="absolute w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_2px_rgba(34,211,238,0.7)]"
            style={{
              top: "50%",
              left: "50%",
              transform: `rotate(${deg}deg) translate(0, -50%) translateY(-100%)`,
            }}
          />
        </div>
      ))}

      {/* Central core */}
      <motion.div
        className="absolute inset-[32%] rounded-full bubu-glass flex items-center justify-center shadow-[0_0_60px_-10px_rgba(34,211,238,0.55)]"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.div
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Server className="w-10 h-10 sm:w-12 sm:h-12 text-cyan-300" strokeWidth={1.5} />
        </motion.div>
      </motion.div>

      {/* Floating stat cards */}
      {floatCards.map((card) => (
        <motion.div
          key={card.label}
          className={`absolute ${card.className} bubu-glass rounded-lg px-3 py-2 flex items-center gap-2 shadow-lg`}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
          transition={{
            opacity: { delay: card.delay, duration: 0.6 },
            scale: { delay: card.delay, duration: 0.6 },
            y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: card.delay },
          }}
        >
          <card.icon className="w-3.5 h-3.5 text-cyan-300 flex-shrink-0" />
          <span className="text-[11px] sm:text-xs font-medium text-white whitespace-nowrap">
            {card.label}
          </span>
        </motion.div>
      ))}
    </div>
  )
}

export default function HeroSection() {
  const { t } = useLanguage()
  const partners = config.hero.partners

  return (
    <div className="relative overflow-hidden bg-[#020617]">
      {/* Atmosphere */}
      <div className="absolute inset-0 bubu-grid-bg pointer-events-none" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bubu-glow-top pointer-events-none" />
      <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bubu-glow-cyan opacity-40 blur-3xl pointer-events-none" />

      <section className="relative px-4 sm:px-6 lg:px-8 pt-32 sm:pt-44 pb-16">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="grid md:grid-cols-2 gap-10 md:gap-12 items-center"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="text-left">
              {/* Badge */}
              <motion.div
                variants={itemVariants}
                className="inline-flex items-center gap-2 bubu-glass rounded-full px-4 py-1.5 mb-6"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 bubu-status-dot" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
                </span>
                <span className="text-xs font-medium tracking-[0.15em] uppercase text-cyan-300">
                  Next-Gen Cloud Hosting
                </span>
              </motion.div>

              {/* Heading */}
              <motion.h1
                variants={itemVariants}
                className="orbitron-font text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.05] mb-6 text-white"
              >
                {t('hero.titlePrefix') || 'Host Without'}
                <br />
                <span className="bubu-text-gradient">{t('hero.titleSuffix') || 'Limits.'}</span>
              </motion.h1>

              {/* Supporting text */}
              <motion.p
                variants={itemVariants}
                className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-lg mb-8"
              >
                {t('hero.description') || 'Fast, secure and reliable hosting built for gamers, developers and growing projects.'}
              </motion.p>

              {/* CTAs */}
              <motion.div
                variants={itemVariants}
                className="flex flex-col sm:flex-row gap-4 items-start mb-8"
              >
                <motion.a
                  href="/games"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className="group button-primary text-button-primary px-6 py-3.5 rounded-lg font-bold text-sm sm:text-base transition-all duration-300 flex items-center gap-2 no-underline orbitron-font"
                >
                  <span>{t('hero.getStarted') || 'Get Started'}</span>
                  <motion.span
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </motion.span>
                </motion.a>

                <motion.a
                  href="#hosting"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className="group bubu-glass hover:border-cyan-400/40 text-white px-6 py-3.5 rounded-lg font-bold text-sm sm:text-base transition-all duration-300 flex items-center gap-2 no-underline orbitron-font"
                >
                  <span>{t('hero.learnMore') || 'Explore Hosting'}</span>
                  <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </motion.a>
              </motion.div>

              {/* Status row */}
              <motion.div variants={itemVariants} className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 bubu-status-dot" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span className="text-sm text-slate-400">All systems operational</span>
              </motion.div>
            </div>

            {/* Hero visual */}
            <motion.div variants={itemVariants}>
              <HeroVisual />
            </motion.div>
          </motion.div>

          {/* Partner marquee */}
          <motion.div
            className="mt-16 md:mt-24 overflow-hidden relative h-16 sm:h-20"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            <p className="text-center text-[11px] tracking-[0.2em] uppercase text-slate-500 mb-3">
              Trusted infrastructure partners
            </p>
            <div className="flex gap-24 absolute whitespace-nowrap animate-scroll will-change-transform">
              {[...partners, ...partners].map((partner, index) => (
                <div
                  key={`${partner.name}-${index}`}
                  className="flex-shrink-0 w-[160px] hover:scale-110 transition-transform duration-300"
                >
                  <Image
                    src={partner.src}
                    alt={`${partner.name} - infrastructure partner`}
                    width={128}
                    height={64}
                    className="h-10 sm:h-12 w-24 sm:w-32 object-contain opacity-30 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300 brightness-0 invert"
                    loading="lazy"
                    quality={60}
                    sizes="(max-width: 640px) 96px, 128px"
                  />
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
