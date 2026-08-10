import { BackgroundDecor } from "@/components/background-decor";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HeroSection } from "@/components/sections/hero-section";
import { ProjectsSection } from "@/components/sections/projects-section";
import { OwnProjectsSection } from "@/components/sections/own-projects-section";
import { TechStackSection } from "@/components/sections/tech-stack-section";
import { AiAssistedSection } from "@/components/sections/ai-assisted-section";
import { DeliverySection } from "@/components/sections/delivery-section";
import { ContactSection } from "@/components/sections/contact-section";

export default function Home() {
  return (
    <>
      <BackgroundDecor />
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl space-y-14 px-4 pb-16 sm:px-6 lg:px-8">
        <HeroSection />
        <OwnProjectsSection />
        <ProjectsSection />
        <TechStackSection />
        <AiAssistedSection />
        <DeliverySection />
        <ContactSection />
      </main>
      <SiteFooter />
    </>
  );
}
