"use client"

import { motion, useScroll, useInView } from "framer-motion"
import { useRef } from "react"
import Image from "next/image"
import {
  Cpu,
  Shield,
  Zap,
  HeartPulse,
  Settings,
  BarChart,
  Cloud,
  Lock,
  Rocket
} from "lucide-react"
import { useLanguage } from "../contexts/LanguageContext"
import uiConfig from "../config/sections/ui.json"

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
}

export default function FeaturesSection() {
  const { t } = useLanguage()

  const features: Feature[] = [
    {
      icon: Cpu,
      title: t('features.highPerformance'),
      description: t('features.highPerformanceDesc')
    },
    {
      icon: Zap,
      title: t('features.lowLatency'),
      description: t('features.lowLatencyDesc')
    },
    {
      icon: Shield,
      title: t('features.advancedSecurity'),
      description: t('features.advancedSecurityDesc')
    },
    {
      icon: HeartPulse,
      title: t('features.autoRecovery'),
      description: t('features.autoRecoveryDesc')
    },
    {
      icon: Settings,
      title: t('features.fullControl'),
      description: t('features.fullControlDesc')
    },
    {
      icon: BarChart,
      title: t('features.resourceScaling'),
      description: t('features.resourceScalingDesc')
    },
    {
      icon: Cloud,
      title: t('features.globalNetwork'),
      description: t('features.globalNetworkDesc')
    }
  ]

  const FeaturedCard = ({ feature, index }: { feature: Feature; index: number }) => {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: "-100px" })
    const Icon = feature.icon;
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 50 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
        transition={{ duration: 0.6, delay: index * 0.2 }}
        className="hover-gradient backdrop-blur-sm border border-secondary rounded-md hover:border-secondary group transition-all duration-300 relative col-span-1 md:col-span-2"
      >
        <div className="flex justify-between items-start">
          <div className="flex-1 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold orbitron-font text-icon-primary mb-1 sm:mb-2 group-hover:text-icon-text-primary transition-colors">{feature.title}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{feature.description}</p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 border-l border-b border-primary rounded-tr-lg flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 icon-primary" />
          </div>
        </div>
        {uiConfig.christmasTheme.enabled && (
          <>
            <Image
              src="/christmas/leaf-up.png"
              alt="Christmas decoration"
              width={80}
              height={80}
              className="absolute -top-6 -left-6 pointer-events-none"
            />
            <Image
              src="/christmas/leaf-down.png"
              alt="Christmas decoration"
              width={80}
              height={80}
              className="absolute -bottom-6 -right-6 pointer-events-none"
            />
          </>
        )}
      </motion.div>
    );
  };

  const FeatureCard = ({ feature, index }: { feature: Feature; index: number }) => {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: "-100px" })
    const Icon = feature.icon;
    return (
      <motion.div
        ref={ref}
        key={feature.title}
        initial={{ opacity: 0, y: 50 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
        transition={{ duration: 0.6, delay: index * 0.2 }}
        className="bg-white/20 dark:bg-white/5 backdrop-blur-sm border border-primary rounded-md hover:border-secondary hover:hover-gradient group transition-all duration-300 relative"
      >
        <div className="flex justify-between items-start">
          <div className="flex-1 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold orbitron-font text-gray-900 dark:text-white mb-1 sm:mb-2 group-hover:text-icon-text-primary transition-colors">{feature.title}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{feature.description}</p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 border-l border-b border-primary rounded-tr-lg flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 icon-primary" />
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="bg-gray-50 dark:bg-[#020617] relative py-8 sm:py-8 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50 via-gray-50/90 to-gray-50 dark:from-[#020617] dark:via-[#020617]/90 dark:to-[#020617] z-0" />

      <div className="absolute top-20 -left-32 w-64 h-64 blob-primary rounded-full blur-3xl z-[2]" />
      <div className="absolute top-40 -right-32 w-72 h-72 blob-primary rounded-full blur-3xl" />
      <div className="absolute bottom-32 -right-24 w-56 h-56 blob-secondary rounded-full blur-3xl" />
      <div className="relative pt-12 z-10 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-left mb-16"
        >
          <div className="inline-flex items-center gap-2 card-primary px-4 py-2 rounded-tl-2xl rounded-br-2xl mb-4">
            <span className="icon-text-primary text-sm">{t('features.badge')}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 orbitron-font">
            {t('features.title').split(' ').slice(0, -1).join(' ')} <span className="icon-text-primary">{t('features.title').split(' ').slice(-1)[0]}</span>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('features.subtitle')}
          </p>
        </motion.div>

        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <FeatureCard feature={features[0]} index={0} />
            <FeatureCard feature={features[1]} index={1} />
            <FeaturedCard feature={features[2]} index={2} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {features.slice(3, 7).map((feature, index) => (
              <FeatureCard key={feature.title} feature={feature} index={index} />
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
