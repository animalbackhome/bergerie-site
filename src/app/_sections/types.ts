// src/app/_sections/types.ts

export type TourismItem = {
  title: string;
  description: string;
  subtitle?: string;
  imageSrcs?: string[]; // (on peut garder dans les data, mais V2 ne l’affiche pas)
  recommendedByLocals?: number;
};
