"use client";

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
  return (
    <SmoothScroll>
      <SceneLinks />
      <Loader />
      <Header />
      <main>{children}</main>
      <TrailOverlay />
      <GLCanvas />
      <ScrollIndicator />
      <PageTransition />
      <CookieBanner />
    </SmoothScroll>
  );
}
