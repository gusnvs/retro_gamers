"use client";

import SmoothScroll from "./SmoothScroll";
import Header from "./Header";
import CookieBanner from "./CookieBanner";
import Loader from "./Loader";
import GLCanvas from "./GLCanvas";
import ScrollIndicator from "./ScrollIndicator";
import PageTransition from "./PageTransition";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SmoothScroll>
      <Loader />
      <Header />
      <main>{children}</main>
      <GLCanvas />
      <ScrollIndicator />
      <PageTransition />
      <CookieBanner />
    </SmoothScroll>
  );
}
