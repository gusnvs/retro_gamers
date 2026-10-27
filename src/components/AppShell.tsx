"use client";

import { usePathname } from "next/navigation";
import SmoothScroll from "./SmoothScroll";
import Header from "./Header";
import CookieBanner from "./CookieBanner";
import Loader from "./Loader";
import GLCanvas from "./GLCanvas";
import ScrollIndicator from "./ScrollIndicator";
import PageTransition from "./PageTransition";
import TrailOverlay from "./TrailOverlay";
import SceneLinks from "./SceneLinks";

export default function AppShell({ children }: { children: React.ReactNode }) {
  // the game route owns the whole screen (its own HUD, no page scroll, no trail)
  const game = usePathname().startsWith("/retro-smash-racer");
  return (
    <SmoothScroll>
      <SceneLinks />
      <Loader />
      {!game && <Header />}
      <main>{children}</main>
      {!game && <TrailOverlay />}
      <GLCanvas />
      {!game && <ScrollIndicator />}
      <PageTransition />
      <CookieBanner />
    </SmoothScroll>
  );
}
