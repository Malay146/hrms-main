"use client";

import React from "react";
import LandingNavbar from "@/components/landing/navbar";
import HeroSection from "@/components/landing/hero";

export default function HomePage() {
  return (
    <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 font-sans antialiased text-zinc-900 dark:text-zinc-100 flex flex-col">
      
      {/* Landing Navbar */}
      <LandingNavbar />

      {/* Hero Section */}
      <main className="flex-1">
        <HeroSection />
      </main>
    </div>
  );
}
