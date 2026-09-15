import GameServerListWrapper from '../components/games/GameServerListWrapper';
import FeaturesSection from "../components/FeaturesSection"
import LocationsSection from "../components/LocationsSection"
import FAQSection from "../components/FAQSection"
import Footer from "../components/Footer"
import Navbar from "../components/Navbar";
import PanelShowcase from "../components/PanelShowcase"

export default function GamesPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#020617] transition-colors duration-300">
      <Navbar />
      <GameServerListWrapper />
      <FeaturesSection />
      <LocationsSection />
      <FAQSection />
      <PanelShowcase />
      <Footer />
    </div>
  );
}
