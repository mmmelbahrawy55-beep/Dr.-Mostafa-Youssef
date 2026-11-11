/**
 * All photography is bundled locally as compressed WebP, so the site does not
 * depend on a third-party image host, works offline once cached, and keeps the
 * largest contentful paint fast on mobile connections.
 */
const local = (name: string) => `/media/${name}.webp`;

export const images = {
  /* Brand / hero */
  hero: local("hero"),
  heroAlt: local("hero-alt"),
  heroGym: local("hero-gym"),
  about: local("about"),
  aboutDetail: local("about-detail"),
  coach: local("coach"),

  /* Training */
  gym: local("gym"),
  gymDark: local("gym-dark"),
  gymMan: local("gym-man"),
  dumbbells: local("dumbbells"),
  athlete: local("athlete"),
  woman: local("woman"),
  stretching: local("stretching"),

  /* Nutrition */
  food: local("food"),
  foodAlt: local("food-alt"),
  mealPrep: local("meal-prep"),
  salad: local("salad"),
  protein: local("hero-alt"),
  kitchen: local("kitchen"),

  /* Programs */
  programStart: local("food-alt"),
  programTransform: local("hero"),
  programElite: local("athlete"),

  /* Payments / account */
  payment: local("payment"),
  phone: local("phone"),
  dashboard: local("dashboard"),

  /* Blog */
  blogNutrition: local("blog-nutrition"),
  blogTraining: local("blog-training"),
  blogSleep: local("blog-sleep"),

  /* Avatars */
  avatar1: local("avatar-1"),
  avatar2: local("avatar-2"),
  avatar3: local("avatar-3"),
  avatar4: local("avatar-4"),
  avatar5: local("avatar-5"),
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
