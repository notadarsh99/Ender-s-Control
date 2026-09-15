"use client"

import { motion } from "framer-motion"
import { MessageCircle, Users, ArrowRight } from "lucide-react"
import { FaDiscord } from "react-icons/fa6";
import { AiOutlineDiscord } from "react-icons/ai";
import { useLanguage } from '../contexts/LanguageContext';

export default function DiscordBanner() {
    const { t } = useLanguage();

    return (
        <div className=" py-18 px-4 sm:px-6 lg:px-8 relative">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="relative z-10 max-w-7xl mx-auto"
            >
                <div className="relative bubu-glass overflow-hidden rounded-xl p-8 md:p-12">
                    <div className="absolute inset-0 bubu-glow-cyan opacity-40 pointer-events-none" />
                    <div className="absolute inset-0 opacity-[0.06] pointer-events-none">
                        <div className="absolute top-4 left-4">
                            <FaDiscord className="w-16 h-16 text-white" />
                        </div>
                        <div className="absolute top-8 right-8">
                            <FaDiscord className="w-12 h-12 text-white" />
                        </div>
                        <div className="absolute bottom-4 left-1/4">
                            <FaDiscord className="w-8 h-8 text-white" />
                        </div>
                        <div className="absolute bottom-8 right-1/4">
                            <FaDiscord className="w-10 h-10 text-white" />
                        </div>
                    </div>

                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="text-center md:text-left">
                            <h2 className="text-2xl md:text-4xl font-bold text-white orbitron-font mb-4 leading-tight">
                                {t('discordBanner.title')}
                            </h2>
                            <p className="text-lg sm:text-xl text-slate-200 mb-2">
                                {t('discordBanner.subtitle')}
                            </p>
                            <p className="text-slate-400">
                                {t('discordBanner.description')}
                            </p>
                        </div>

                        <div className="flex-shrink-0 flex flex-col sm:flex-row gap-3">
                            <a
                                href="#"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="button-primary text-button-primary px-6 py-3 rounded-lg font-bold text-sm orbitron-font transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 no-underline"
                            >
                                <FaDiscord className="w-4 h-4" />
                                Join Discord
                            </a>
                            <a
                                href="#"
                                className="bubu-glass hover:border-cyan-400/40 text-white px-6 py-3 rounded-lg font-bold text-sm orbitron-font transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 no-underline"
                            >
                                Contact Support
                            </a>
                        </div>

                    </div>
                </div>
            </motion.div>
        </div>
    )
}
