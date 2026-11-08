const unsplash = (id: string, width = 1200, height?: number) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}${height ? `&h=${height}` : ""}&q=80`;

const portrait = (id: string, size = 320) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&crop=faces&w=${size}&h=${size}&q=80`;

export const images = {
  /* Brand / hero */
  hero: unsplash("1571019613454-1cb2f99b2d8b", 1200),
  heroAlt: unsplash("1517836357463-d25dfeac3438", 1000),
  heroGym: unsplash("1534438327276-14e5300c3a48", 1400),
  about: unsplash("1526506118085-60ce8714f8c5", 1000),
  aboutDetail: unsplash("1583454110551-21f2fa2afe61", 800),
  coach: unsplash("1594381898411-846e7d193883", 1000),

  /* Training */
  gym: unsplash("1534438327276-14e5300c3a48", 1200),
  gymDark: unsplash("1541534741688-6078c6bfb5c5", 1600),
  gymMan: unsplash("1571731956672-f2b94d7dd0cb", 1000),
  dumbbells: unsplash("1583454110551-21f2fa2afe61", 1200),
  athlete: unsplash("1581009146145-b5ef050c2e1e", 1200),
  woman: unsplash("1550345332-09e3ac987658", 1000),
  stretching: unsplash("1518611012118-696072aa579a", 1000),

  /* Nutrition */
  food: unsplash("1546069901-ba9599a7e63c", 1200),
  foodAlt: unsplash("1490645935967-10de6ba17061", 1000),
  mealPrep: unsplash("1540497077202-7c8a3999166f", 1200),
  salad: unsplash("1512621776951-a57141f2eefd", 1200),
  protein: unsplash("1517836357463-d25dfeac3438", 1000),
  kitchen: unsplash("1556911220-bff31c812dba", 1200),

  /* Programs */
  programStart: unsplash("1490645935967-10de6ba17061", 1000),
  programTransform: unsplash("1571019613454-1cb2f99b2d8b", 1000),
  programElite: unsplash("1581009146145-b5ef050c2e1e", 1000),

  /* Payments / account */
  payment: unsplash("1556742049-0cfed4f6a45d", 1200),
  phone: unsplash("1512941937669-90a1b58e7e9c", 1000),
  dashboard: unsplash("1551288049-bebda4e38f71", 1400),

  /* Blog */
  blogNutrition: unsplash("1498837167922-ddd27525d352", 1200),
  blogTraining: unsplash("1517836357463-d25dfeac3438", 1200),
  blogSleep: unsplash("1541781774459-bb2af2f05b55", 1200),

  /* Avatars */
  avatar1: portrait("1507003211169-0a1dd7228f2d"),
  avatar2: portrait("1494790108377-be9c29b29330"),
  avatar3: portrait("1500648767791-00dcc994a43e"),
  avatar4: portrait("1534528741775-53994a69daeb"),
  avatar5: portrait("1506794778202-cad84cf45f1d"),
} as const;

/** Local, dependency-free fallback so no card ever shows a broken image. */
export const fallbackImage =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000">
      <defs>
        <radialGradient id="g" cx="25%" cy="15%" r="90%">
          <stop offset="0" stop-color="#1c2410"/>
          <stop offset="0.6" stop-color="#0c0e09"/>
          <stop offset="1" stop-color="#08090a"/>
        </radialGradient>
        <linearGradient id="l" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#eaffa3"/>
          <stop offset="1" stop-color="#a3cc16"/>
        </linearGradient>
      </defs>
      <rect width="800" height="1000" fill="url(#g)"/>
      <circle cx="610" cy="190" r="230" fill="#d4ff3f" opacity="0.07"/>
      <g transform="translate(292 380) scale(9)">
        <path fill="url(#l)" opacity="0.85" d="M3 18.34S4 7.09 7 3l5 1l-1 3.09H9v7.16h1c2-3.07 6.14-4.19 8.64-3.07c3.3 1.53 3 6.14 0 8.18C16.24 21 9 22.43 3 18.34"/>
      </g>
      <text x="400" y="700" text-anchor="middle" fill="#f5f2e9" opacity="0.35" font-family="Arial" font-size="26" letter-spacing="9">MOSTAFA YOUSSEF</text>
    </svg>
  `);

export const avatarFor = (index: number) =>
  [images.avatar1, images.avatar2, images.avatar3, images.avatar4, images.avatar5][index % 5];
