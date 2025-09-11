"use client";
import { ReactNode, useEffect } from "react";
import Image from "next/image";

export default function AuthLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    const prevBodyBg = document.body.style.background;
    const prevHtmlBg = document.documentElement.style.background;
    document.body.style.background = '#fff';
    document.documentElement.style.background = '#fff';
    return () => {
      document.body.style.background = prevBodyBg;
      document.documentElement.style.background = prevHtmlBg;
    };
  }, []);

  // List of all logo filenames (WNBA + NBA), mixed order
  const logoFiles = [
    // Mix of NBA and WNBA
    "Golden_State_Warriors_logo.svg.png",
    "Seattle_Storm_(2021)_logo.svg.png",
    "Los_Angeles_Lakers_logo.svg.png",
    "Phoenix_Mercury_logo.svg.png",
    "Boston_Celtics.svg.png",
    "Minnesota_Lynx_logo.svg.png",
    "Chicago_Bulls_logo.svg.png",
    "Los_Angeles_Sparks_logo.svg.png",
    "Miami_Heat_logo.svg.png",
    "New_Las_Vegas_Aces_WNBA_logo_2024.svg.png",
    "Brooklyn_Nets_primary_icon_logo_2024.svg.png",
    "Golden_State_Valkyries_logo.png",
    "Philadelphia_76ers_logo.svg.png",
    "Dallas_Wings_logo.svg.png",
    "Toronto_Raptors_logo.svg.png",
    "Washington_Mystics_logo.svg.png",
    "Cleveland_Cavaliers_logo.svg.png",
    "New_York_Liberty_logo.svg.png",
    "Atlanta_Hawks_logo.svg.png",
    "Indiana_Fever_logo.svg.png",
    "Charlotte_Hornets_(2014).svg.png",
    "Connecticut_Sun_logo.svg.png",
    "Orlando_Magic_logo.svg.png",
    "Chicago_Sky_logo.svg.png",
    "Washington_Wizards_logo.svg.png",
    "Atlanta_Dream_logo.svg.png",
    "Milwaukee_Bucks_logo.svg.png",
    "Indiana_Pacers.svg.png",
    "Logo_of_the_Detroit_Pistons.svg.png",
    "Minnesota_Timberwolves_logo.svg.png",
    "Denver_Nuggets.svg.png",
    "Oklahoma_City_Thunder.svg.png",
    "Portland_Trail_Blazers_logo.svg.png",
    "Utah_Jazz_logo_2025.svg.png",
    "SacramentoKings.svg.png",
    "Dallas_Mavericks_logo.svg.png",
    "Houston_Rockets.svg.png",
    "Memphis_Grizzlies.svg.png",
    "New_Orleans_Pelicans_logo.svg.png",
    "San_Antonio_Spurs.svg.png",
    "Los_Angeles_Clippers_(2024).svg.png",
    "Phoenix_Suns_logo.svg.png",
    "New_York_Knicks_logo.svg.png",
    // Duplicate Cavs logo for bottom right
    "Cleveland_Cavaliers_logo.svg.png",
  ];

  return (
    <div className="bg-white min-h-screen relative overflow-hidden">
      {/* Grid logo background */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '2vw',
            width: '98vw',
            maxWidth: '1800px',
            height: '98vh',
            margin: '0 auto',
            opacity: 0.09,
            filter: 'grayscale(1)',
          }}
        >
          {logoFiles.map((file, i) => (
            <div key={file + (i === logoFiles.length - 1 ? '-dupe' : '')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
              <Image
                src={`/logos/${file}`}
                alt={file.replace(/_/g, ' ').replace(/\.svg\.png|\.png/g, '')}
                width={110}
                height={110}
                style={{ objectFit: 'contain', width: '110px', height: '110px', maxWidth: '100%', maxHeight: '100%' }}
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
} 