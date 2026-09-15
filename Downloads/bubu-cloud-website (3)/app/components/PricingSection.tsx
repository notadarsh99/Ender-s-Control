"use client"

import { motion } from "framer-motion"
import { Check, ChevronRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { CurrencySelector, useCurrency } from "./ui/CurrencySelector"
import pricingConfig from "../config/sections/pricing.json"
import type { PricingConfig } from "../types/pricing"
import { useLanguage } from '../contexts/LanguageContext';
import uiConfig from "../config/sections/ui.json"

const config = pricingConfig as PricingConfig

export default function PricingSection() {
  const { t } = useLanguage();
  const { selectedCurrency, setSelectedCurrency, convertPrice } = useCurrency()

  return (
    <div className="bg-gray-50 dark:bg-[#020617] py-32 px-4 sm:px-6 lg:px-8 relative">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="relative z-20 max-w-7xl mx-auto text-left mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 ">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-4 orbitron-font">
              {t('pricingSection.title')}{" "}
              <span className="icon-text-primary relative">
                {t('pricingSection.titleHighlight')}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 1418 125"
                  className="absolute left-0 w-full text-icon-text-primary"
                >
                  <path
                    d="M1412.29 72.17c-11.04-5.78-20.07-14.33-85.46-25.24-22.37-3.63-44.69-7.56-67.07-11.04-167.11-22.06-181.65-21.24-304.94-30.56C888.78 1.39 822.57 1.1 756.44 0c-46.63-.11-93.27 1.56-139.89 2.5C365.5 13.55 452.86 7.68 277.94 23.15 202.57 33.32 127.38 45.01 52.07 55.69c-11.23 2.41-22.63 4.17-33.71 7.22C6.1 66.33 5.64 66.19 3.89 67.79c-7.99 5.78-2.98 20.14 8.72 17.5 33.99-9.47 32.28-8.57 178.06-29.66 4.26 4.48 7.29 3.38 18.42 3.11 13.19-.32 26.38-.53 39.56-1.12 53.51-3.81 106.88-9.62 160.36-13.95 18.41-1.3 36.8-3.12 55.21-4.7 23.21-1.16 46.43-2.29 69.65-3.4 120.28-2.16 85.46-3.13 234.65-1.52 23.42.99 1.57-.18 125.72 6.9 96.61 8.88 200.92 27.94 295.42 46.12 40.87 7.91 116.67 23.2 156.31 36.78 3.81 1.05 8.28-.27 10.51-3.58 3.17-3.72 2.66-9.7-.78-13.13-3.25-3.12-8.14-3.44-12.18-5.08-17.89-5.85-44.19-12.09-63.67-16.56l26.16 3.28c23.02 3.13 46.28 3.92 69.34 6.75 10.8.96 25.43 1.81 34.34-4.39 2.26-1.54 4.86-2.75 6.21-5.27 2.76-4.59 1.13-11.06-3.59-13.68ZM925.4 23.77c37.64 1.4 153.99 10.85 196.64 14.94 45.95 5.51 91.89 11.03 137.76 17.19 24.25 4.77 74.13 11.21 101.72 18.14-11.87-1.15-23.77-1.97-35.65-3.06-133.46-15.9-266.8-33.02-400.47-47.21Z"
                    fill="currentColor"
                  />
                </svg>
                <br />
              </span>
            </h2>
            <p className="text-sm max-w-xl  text-gray-600 dark:text-gray-300">
              {t('pricingSection.description')}
            </p>
          </div>

          <CurrencySelector
            selectedCurrency={selectedCurrency}
            onCurrencyChange={setSelectedCurrency}
            className="w-full sm:w-64"
          />
        </div>
      </motion.div>

      <div className="relative  z-10 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-4 items-start">
          {config.section.plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              className={`relative backdrop-blur-sm border border-secondary rounded-md pt-0 hover:bg-gray-50 dark:hover:bg-transparent hover:border-secondary dark:hover:border-secondary hover:hover-gradient dark:hover:hover-gradient transition-all duration-300 ${plan.popular
                ? "border border-secondary dark:border-secondary hover-gradient  dark:hover-gradient "
                : "   dark:hover-gradient "
                }`}
            >
              <div className="relative h-32 sm:h-40 overflow-hidden rounded-t-md mb-4">
                <Image 
                  src={plan.image || "/placeholder.svg"} 
                  alt={t(plan.titleKey)} 
                  fill 
                  className="rounded-t-md object-cover" 
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  quality={85}
                  priority={plan.popular}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 dark:from-[#020617] via-gray-900/70 dark:via-[#020617]/70 to-transparent" />
                <div className="absolute inset-0 flex flex-col items-center justify-end p-3 sm:p-4 text-center z-10">
                  <h3 className="text-xl sm:text-2xl font-bold text-white orbitron-font">{t(plan.titleKey)}</h3>
                  <p className="text-gray-200 dark:text-gray-300 text-xs sm:text-sm">{t(plan.descriptionKey)}</p>
                </div>
              </div>
              <div className="p-4">
                <div className="text-center mb-6 sm:mb-8">
                  <div className="mb-4 sm:mb-6">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Starting at</p>
                    <span className="text-3xl sm:text-4xl orbitron-font font-bold text-gray-900 dark:text-white">{convertPrice(plan.basePrice.toString())}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">/month</span>
                  </div>
                </div>

                <ul className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                  {plan.featuresKeys.map((featureKey, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-3">
                      <Check className="w-5 h-5 icon-text-primary bg-icon-text-primary/10 dark:bg-icon-text-primary/30 rounded-xl flex-shrink-0 p-1" />
                      <span className="text-gray-600 dark:text-gray-300 text-sm sm:text-base">{t(featureKey)}</span>
                    </li>
                  ))}
                </ul>

                <div className="relative">
                  <Link
                    href={plan.link}
                    className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-300 flex items-center justify-between group ${plan.buttonStyle === "primary"
                      ? "button-primary text-button-primary border border-transparent hover:bg-[var(--hover-gradient)] hover:text-[var(--icon-text-primary)] hover:border-[var(--border-secondary)]"
                      : "card-primary dark:bg-transparent border border-secondary dark:border-secondary hover:bg-[var(--hover-gradient)] hover:text-[var(--icon-text-primary)] hover:border-[var(--border-secondary)] text-icon-text-primary"
                      }`}
                  >
                    <span className="w-full orbitron-font text-center">{t(plan.buttonTextKey)}</span>
                    <ChevronRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                  {uiConfig.christmasTheme.enabled && (
                    <>
                      <Image
                        src="/christmas/button-deco-up.png"
                        alt="Christmas decoration"
                        width={32}
                        height={32}
                        className="absolute -top-2 -right-2 pointer-events-none"
                      />
                      <Image
                        src="/christmas/button-deco-down.png"
                        alt="Christmas decoration"
                        width={32}
                        height={32}
                        className="absolute -bottom-2 -left-2 pointer-events-none"
                      />
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-center mt-8"
        >
          <p className="orbitron-font text-gray-600 dark:text-gray-400">
            {t('pricingSection.footerText')}{" "}
            <span className="icon-text-primary hover:text-icon-text-primary/80 cursor-pointer">{t('pricingSection.footerLinkText')}</span>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
