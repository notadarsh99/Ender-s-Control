'use client'
import HeroSection from "./components/HeroSection"
import StatsSection from "./components/StatsSection"
import FeaturesSection from "./components/FeaturesSection"
import PanelShowcase from "./components/PanelShowcase"
import LocationsSection from "./components/LocationsSection"
import FAQSection from "./components/FAQSection"
import PricingSection from "./components/PricingSection"
import Footer from "./components/Footer"
import Navbar from "./components/Navbar"

export default function Home() {
  return (
    <div className="min-h-screen bg-[#020617] transition-colors duration-300">
      <Navbar />
      <HeroSection />
      <StatsSection />
      <FeaturesSection />
      <LocationsSection />
      <PricingSection />
      <FAQSection />
      <PanelShowcase />
      <Footer />
    </div>
  )
}