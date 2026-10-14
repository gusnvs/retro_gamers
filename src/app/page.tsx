import Hero from "@/components/home/Hero";
import Reel from "@/components/home/Reel";
import HomeGrid from "@/components/home/HomeGrid";
import PageFooter from "@/components/PageFooter";

export default function Home() {
  return (
    <div className="page-home">
      <Hero />
      <Reel />
      <HomeGrid />
      <PageFooter />
    </div>
  );
}
