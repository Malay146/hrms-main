"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import TotalEmployeeIcon from "@/components/icons/total-employee";
import PresentTodayIcon from "@/components/icons/present-today";
import BuildingIcon from "@/components/icons/building";

const metrics = [
  {
    icon: TotalEmployeeIcon,
    value: "10k+",
    label: "Active Users",
  },
  {
    icon: PresentTodayIcon,
    value: "99.9%",
    label: "Accuracy",
  },
  {
    icon: BuildingIcon,
    value: "500+",
    label: "Organizations",
  },
];

export default function HeroSection() {
  return (
    <section className="relative overflow-x-clip bg-gradient-to-b from-zinc-50 via-white to-zinc-50/50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 pt-28 pb-36 lg:pt-36 lg:pb-52 min-h-[820px] flex items-center">
      {/* Background Decorative Grids & Glows - Extends all the way to top-0 */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:linear-gradient(to_bottom,#000_90%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-tr from-zinc-200/40 via-blue-100/30 to-purple-100/20 dark:from-zinc-800/20 dark:via-zinc-700/10 dark:to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 relative z-10 w-full">
        <div className="flex flex-col lg:flex-row items-center justify-between min-h-[640px] relative">
          
          {/* LEFT PART: Title, Description, Login CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-full lg:w-[48%] xl:w-[55%] flex flex-col gap-6 text-left shrink-0 z-20 mt-20 -ml-20"
          >
            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-medium text-zinc-950 dark:text-white tracking-tight leading-[1.1]">
              Manage Your Workforce{" "}
              <span className="block text-zinc-950 dark:text-white">
                with Confidence.
              </span>
            </h1>

            {/* Description */}
            <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl">
              Automate employee attendance, manage department hierarchies, approve leave requests seamlessly, and empower teams with real-time self-service insights.
            </p>

            {/* Login CTA */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-4">
              <Link
                href="/login"
                className="group relative inline-flex items-center justify-center gap-2.5 px-4 py-3 rounded-md bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-semibold text-md shadow-lg shadow-zinc-950/10 dark:shadow-white/5 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all duration-200 active:scale-[0.98] cursor-pointer"
              >
                <span>Login</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* 3 Metrics Row with Icons mapped from array */}
            <div className="pt-8  mt-12 flex items-center gap-6 sm:gap-18 max-w-xl">
              {metrics.map((item, index) => (
                <React.Fragment key={item.label}>
                  {index > 0 && (
                    <div className="h-24 w-px bg-zinc-300 dark:bg-zinc-800 shrink-0 self-center" />
                  )}
                  <div className="flex flex-col items-center gap-2.5">
                    <item.icon className="size-14 text-zinc-950 dark:text-white shrink-0" />
                    <div className="flex flex-col text-center mt-2">
                      <span className="text-lg sm:text-2xl font-semibold text-zinc-950 dark:text-white leading-none">
                        {item.value}
                      </span>
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">
                        {item.label}
                      </span>
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </motion.div>

          {/* RIGHT PART: 3 Images Stacked in Stair-Like Perspective Tilt 3D Way (Absolute Positioned on Desktop) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="w-full lg:w-auto lg:absolute lg:left-[46%] xl:left-[50%] lg:top-1/2 lg:-translate-y-1/2 lg:right-[-100px] xl:right-[-160px] flex items-center justify-center min-h-[480px] sm:min-h-[580px] lg:min-h-[660px] select-none z-10 mt-14 lg:mt-0"
          >
            {/* 3D Perspective Stage Container with Increased Dimensions */}
            <div className="group relative w-full max-w-[580px] sm:max-w-[680px] lg:max-w-[820px] xl:max-w-[920px] h-[420px] sm:h-[520px] lg:h-[620px] [perspective:1400px]">
              
              {/* Outer perspective transform shell */}
              <div className="relative w-full h-full transition-transform duration-700 ease-out group-hover:[transform:rotateY(-8deg)_rotateX(6deg)_rotateZ(1deg)] [transform-style:preserve-3d] [transform:rotateY(-18deg)_rotateX(12deg)_rotateZ(2deg)]">

                {/* STAIR 1: Back/Top Image - HR Admin Portal (hr.png) */}
                <div className="absolute top-0 left-0 w-[82%] sm:w-[85%] rounded-lg overflow-hidden border border-zinc-200/90 dark:border-zinc-700/80 bg-white dark:bg-zinc-900 shadow-xl transition-all duration-500 ease-out group-hover:translate-x-[-20px] group-hover:translate-y-[-20px] group-hover:[transform:translateZ(-20px)] [transform:translateZ(0px)] z-10 opacity-90 hover:opacity-100">
                  <div className="bg-zinc-100 dark:bg-zinc-800 px-3.5 py-2.5 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                    <span className="text-xs font-mono font-medium text-zinc-400 ml-2">HR Management</span>
                  </div>
                  <div className="w-full">
                    <Image
                      src="/hero/hr.png"
                      alt="HR Admin Management Portal"
                      width={3600}
                      height={2080}
                      className="w-full h-auto block"
                      priority
                    />
                  </div>
                </div>

                {/* STAIR 2: Middle Image - Employee Portal (employee.png) */}
                <div className="absolute top-[70px] sm:top-[90px] lg:top-[110px] left-[55px] sm:left-[75px] lg:left-[95px] w-[82%] sm:w-[85%] rounded-lg overflow-hidden border border-zinc-200/90 dark:border-zinc-700/80 bg-white dark:bg-zinc-900 shadow-2xl transition-all duration-500 ease-out group-hover:translate-x-[0px] group-hover:translate-y-[0px] [transform:translateZ(50px)] z-20">
                  <div className="bg-zinc-100 dark:bg-zinc-800 px-3.5 py-2.5 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                    <span className="text-xs font-mono font-medium text-zinc-400 ml-2">Employee Self-Service</span>
                  </div>
                  <div className="w-full">
                    <Image
                      src="/hero/employee.png"
                      alt="Employee Portal Dashboard"
                      width={3594}
                      height={2080}
                      className="w-full h-auto block"
                      priority
                    />
                  </div>
                </div>

                {/* STAIR 3: Front/Bottom Primary Image - Main Dashboard (dashboard.png) */}
                <div className="absolute top-[140px] sm:top-[180px] lg:top-[220px] left-[110px] sm:left-[150px] lg:left-[190px] w-[82%] sm:w-[85%] rounded-lg overflow-hidden border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.35)] transition-all duration-500 ease-out group-hover:translate-x-[20px] group-hover:translate-y-[20px] [transform:translateZ(100px)] z-30">
                  <div className="bg-zinc-950 text-white px-3.5 py-2.5 flex items-center justify-between border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-xs font-mono font-medium text-zinc-300 ml-2">Executive Analytics</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                      Live
                    </span>
                  </div>
                  <div className="w-full">
                    <Image
                      src="/hero/dashboard.png"
                      alt="Executive Analytics HRMS Dashboard"
                      width={3600}
                      height={2078}
                      className="w-full h-auto block"
                      priority
                    />
                  </div>
                </div>

              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
