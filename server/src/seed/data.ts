// Seed data for the jersey store (demo store: colours are illustrative, not official kit specs).
// Colour roles used by the SVG jersey component:
//   primary   = body
//   secondary = sleeves / trim, and the second stripe colour for stripes, hoops, sash and halves
//   accent    = collar and number print
// Prices are in kobo (6800000 = ₦68,000).

export type Sport = "football" | "basketball" | "baseball";
export type Kit = "home" | "away";
export type Pattern = "solid" | "stripes" | "hoops" | "sash" | "halves";

export interface LeagueSeed {
  sport: Sport;
  name: string;
  slug: string;
  country: string | null;
}

export interface TeamSeed {
  league: string; // league slug
  name: string;
  slug: string;
  short: string;
}

export interface ProductSeed {
  team: string; // team slug
  kit: Kit;
  price: number; // kobo
  primary: string;
  secondary: string;
  accent: string;
  pattern: Pattern;
  description: string;
}

export const leagues: LeagueSeed[] = [
  { sport: "football", name: "Premier League", slug: "premier-league", country: "England" },
  { sport: "football", name: "La Liga", slug: "la-liga", country: "Spain" },
  { sport: "football", name: "Serie A", slug: "serie-a", country: "Italy" },
  { sport: "football", name: "International", slug: "international", country: null },
  { sport: "basketball", name: "NBA", slug: "nba", country: "USA" },
  { sport: "baseball", name: "MLB", slug: "mlb", country: "USA" },
];

export const teams: TeamSeed[] = [
  // Premier League
  { league: "premier-league", name: "Arsenal", slug: "arsenal", short: "ARS" },
  { league: "premier-league", name: "Liverpool", slug: "liverpool", short: "LIV" },
  { league: "premier-league", name: "Manchester United", slug: "manchester-united", short: "MUN" },
  // La Liga
  { league: "la-liga", name: "Real Madrid", slug: "real-madrid", short: "RMA" },
  { league: "la-liga", name: "Barcelona", slug: "barcelona", short: "BAR" },
  // Serie A
  { league: "serie-a", name: "AC Milan", slug: "ac-milan", short: "MIL" },
  { league: "serie-a", name: "Juventus", slug: "juventus", short: "JUV" },
  // International
  { league: "international", name: "Nigeria", slug: "nigeria", short: "NGA" },
  { league: "international", name: "Brazil", slug: "brazil", short: "BRA" },
  // NBA
  { league: "nba", name: "Los Angeles Lakers", slug: "los-angeles-lakers", short: "LAL" },
  { league: "nba", name: "Golden State Warriors", slug: "golden-state-warriors", short: "GSW" },
  { league: "nba", name: "Boston Celtics", slug: "boston-celtics", short: "BOS" },
  { league: "nba", name: "Chicago Bulls", slug: "chicago-bulls", short: "CHI" },
  { league: "nba", name: "Miami Heat", slug: "miami-heat", short: "MIA" },
  // MLB
  { league: "mlb", name: "New York Yankees", slug: "new-york-yankees", short: "NYY" },
  { league: "mlb", name: "Los Angeles Dodgers", slug: "los-angeles-dodgers", short: "LAD" },
  { league: "mlb", name: "Boston Red Sox", slug: "boston-red-sox", short: "BOS" },
  { league: "mlb", name: "Chicago Cubs", slug: "chicago-cubs", short: "CHC" },
];

export const products: ProductSeed[] = [
  // ---------- Football: Premier League ----------
  {
    team: "arsenal", kit: "home", price: 6800000,
    primary: "#DB0007", secondary: "#FFFFFF", accent: "#C9A24D", pattern: "solid",
    description:
      "Solid red body with white sleeves and gold collar and number details. Lightweight breathable knit with mesh side panels suited to hot, humid matchdays. Regular fit. A traditional, high-visibility look for fans who want a classic red-and-white shirt for the stadium or everyday wear.",
  },
  {
    team: "arsenal", kit: "away", price: 6500000,
    primary: "#0B1F3A", secondary: "#F2C94C", accent: "#FFFFFF", pattern: "solid",
    description:
      "Deep navy body with bright yellow sleeves and white collar and number details. Soft moisture-wicking knit with a slightly slimmer athletic fit. A darker, more understated alternative to the red home shirt, good for evening matches and for fans who like strong contrast colours.",
  },
  {
    team: "liverpool", kit: "home", price: 6800000,
    primary: "#C8102E", secondary: "#9E0B22", accent: "#F6EB61", pattern: "solid",
    description:
      "Solid crimson body with deeper red sleeves and a pale yellow collar and number. Heavier textured knit that feels premium and holds its shape after washing. Regular fit. A one-colour look for supporters who prefer a clean, uncluttered shirt over busy patterns.",
  },
  {
    team: "liverpool", kit: "away", price: 6500000,
    primary: "#0E3B43", secondary: "#7DD6C8", accent: "#FFFFFF", pattern: "solid",
    description:
      "Dark teal body with mint sleeves and white collar and number. Lightweight mesh knit with a relaxed fit that stays comfortable on long days out. A cool-toned option for fans who want something different from the usual red, and easy to pair with jeans.",
  },
  {
    team: "manchester-united", kit: "home", price: 6800000,
    primary: "#DA291C", secondary: "#111111", accent: "#FBE122", pattern: "solid",
    description:
      "Bright red body with black sleeves and a yellow collar and number. Breathable knit with a slim athletic fit and a V-neck collar. The strong red-and-black contrast stands out in a crowd. Suits fans who like a sharper, more fitted shirt for matchdays.",
  },
  {
    team: "manchester-united", kit: "away", price: 6500000,
    primary: "#F4F1EA", secondary: "#111111", accent: "#DA291C", pattern: "solid",
    description:
      "Off-white body with black sleeves and a red collar and number. Smooth lightweight knit with a regular fit. A light, clean colour that is cooler to wear in hot weather, though it shows dirt more easily. Good for daytime games and casual wear.",
  },

  // ---------- Football: La Liga ----------
  {
    team: "real-madrid", kit: "home", price: 7000000,
    primary: "#FFFFFF", secondary: "#E0B03A", accent: "#1F4E9E", pattern: "solid",
    description:
      "White body with gold sleeves and a royal-blue collar and number. Fine-gauge breathable knit with a regular fit and a crisp, formal look. The lightest colour in the football range, ideal for hot days and for fans who prefer a classic, elegant style over bold colours.",
  },
  {
    team: "real-madrid", kit: "away", price: 6700000,
    primary: "#14213D", secondary: "#F28C28", accent: "#FFFFFF", pattern: "solid",
    description:
      "Navy body with orange-gold sleeves and white collar and number. Moisture-wicking knit with a slim fit. A dark, sharp-looking shirt that works for evening wear and does not show sweat marks, good for fans who like deep colours with one warm accent.",
  },
  {
    team: "barcelona", kit: "home", price: 7000000,
    primary: "#A50044", secondary: "#004D98", accent: "#EDBB00", pattern: "stripes",
    description:
      "Vertical stripes in deep garnet and royal blue with a gold collar and number. Lightweight mesh knit with a regular fit. A busy, eye-catching pattern for fans who want a bold, traditional-looking shirt to wear to matches or watch parties.",
  },
  {
    team: "barcelona", kit: "away", price: 6700000,
    primary: "#F2C94C", secondary: "#1A1A1A", accent: "#FFFFFF", pattern: "hoops",
    description:
      "Bright yellow body with black horizontal hoops and a white collar and number. Breathable knit with a relaxed fit. Loud and hard to miss, a good fit for fans who want a standout casual shirt or a gift for someone who likes bright colours.",
  },

  // ---------- Football: Serie A ----------
  {
    team: "ac-milan", kit: "home", price: 6200000,
    primary: "#FB090B", secondary: "#111111", accent: "#FFFFFF", pattern: "stripes",
    description:
      "Vertical red-and-black stripes with a white collar and number. Textured knit with a regular fit. The stripes give it a distinctive silhouette that looks good both at the stadium and with casual outfits. A popular choice for fans who like a classic striped design.",
  },
  {
    team: "ac-milan", kit: "away", price: 5900000,
    primary: "#F5F5F5", secondary: "#FB090B", accent: "#111111", pattern: "sash",
    description:
      "White body with a red diagonal sash and a black collar and number. Smooth lightweight knit with a regular fit. A lighter, more unusual design for fans who want the red-and-black palette without full stripes. Cooler to wear in hot weather.",
  },
  {
    team: "juventus", kit: "home", price: 6200000,
    primary: "#FFFFFF", secondary: "#111111", accent: "#C9A24D", pattern: "stripes",
    description:
      "Black-and-white vertical stripes with a gold collar and number. Slim athletic fit in a soft moisture-wicking knit. A high-contrast, timeless pattern that pairs easily with jeans, good for fans who prefer monochrome over bright colours.",
  },
  {
    team: "juventus", kit: "away", price: 5900000,
    primary: "#111111", secondary: "#D4AF37", accent: "#D4AF37", pattern: "solid",
    description:
      "Solid black body with gold sleeves and gold number. Lightweight mesh knit with a regular fit. A dark, premium look that hides sweat marks and suits evening events. Good for fans who like a one-colour shirt with a single metallic accent.",
  },

  // ---------- Football: International ----------
  {
    team: "nigeria", kit: "home", price: 5500000,
    primary: "#008751", secondary: "#FFFFFF", accent: "#FFFFFF", pattern: "solid",
    description:
      "Solid green body with white sleeves and a white collar and number. Lightweight breathable knit built for hot, humid weather, regular fit. Great for supporting the national team on match days, at independence celebrations and for casual wear. A bold green that is easy to spot in a crowd.",
  },
  {
    team: "nigeria", kit: "away", price: 5200000,
    primary: "#FFFFFF", secondary: "#008751", accent: "#008751", pattern: "hoops",
    description:
      "White body with green horizontal hoops and a green collar and number. Smooth, light knit with a relaxed fit, the coolest option in the range for hot weather. A fresher alternative to the green home shirt for fans who want a lighter look while still showing national colours.",
  },
  {
    team: "brazil", kit: "home", price: 5800000,
    primary: "#FFDF00", secondary: "#009C3B", accent: "#002776", pattern: "solid",
    description:
      "Bright yellow body with green sleeves and a blue collar and number. Lightweight breathable knit with a regular fit. A cheerful, high-visibility colour combination that is a safe gift for any casual fan and easy to wear on a sunny day.",
  },
  {
    team: "brazil", kit: "away", price: 5500000,
    primary: "#002776", secondary: "#FFDF00", accent: "#FFFFFF", pattern: "solid",
    description:
      "Royal blue body with yellow sleeves and a white collar and number. Moisture-wicking knit with a slim fit. A deep, saturated blue that looks sharp in photos and stays comfortable in the heat. Suits fans who want the yellow, blue and green palette in a darker, less obvious form.",
  },

  // ---------- Basketball (sleeveless: secondary = armhole and neck trim) ----------
  {
    team: "los-angeles-lakers", kit: "home", price: 8500000,
    primary: "#FDB927", secondary: "#552583", accent: "#FFFFFF", pattern: "solid",
    description:
      "Sleeveless gold jersey with purple trim and a white number. Breathable perforated mesh with a relaxed athletic fit and deep armholes for easy movement. Bright and warm, a good choice for fans who want a bold statement piece for the court or the street.",
  },
  {
    team: "los-angeles-lakers", kit: "away", price: 8200000,
    primary: "#552583", secondary: "#FDB927", accent: "#FFFFFF", pattern: "solid",
    description:
      "Sleeveless purple jersey with gold trim and a white number. Heavier, smooth mesh with a classic cut. The darker colour hides sweat and wear, good for pickup games and casual wear. Pairs well with the gold version for fans who want both.",
  },
  {
    team: "golden-state-warriors", kit: "home", price: 8200000,
    primary: "#1D428A", secondary: "#FFC72C", accent: "#FFFFFF", pattern: "solid",
    description:
      "Sleeveless royal-blue jersey with yellow trim and a white number. Lightweight mesh with a slightly longer cut that works well under a jacket. A vibrant, easy-to-wear colour for both playing and fan wear.",
  },
  {
    team: "golden-state-warriors", kit: "away", price: 7900000,
    primary: "#FFFFFF", secondary: "#1D428A", accent: "#FFC72C", pattern: "solid",
    description:
      "Sleeveless white jersey with blue trim and a yellow number. Smooth lightweight mesh with a relaxed fit. The lightest colour in the basketball range, comfortable in the heat, good for fans who want a clean, minimal look.",
  },
  {
    team: "boston-celtics", kit: "home", price: 8000000,
    primary: "#FFFFFF", secondary: "#007A33", accent: "#007A33", pattern: "solid",
    description:
      "Sleeveless white jersey with green trim and a green number. Perforated mesh with a classic fit. A crisp, simple design that works as streetwear and for playing. Good for fans who prefer understated looks over loud colours.",
  },
  {
    team: "boston-celtics", kit: "away", price: 7700000,
    primary: "#007A33", secondary: "#FFFFFF", accent: "#FFFFFF", pattern: "solid",
    description:
      "Sleeveless deep green jersey with white trim and a white number. Heavier mesh that holds its shape, classic cut. A rich, dark colour that looks premium and suits cooler evenings or layering over a long-sleeve tee.",
  },
  {
    team: "chicago-bulls", kit: "home", price: 7600000,
    primary: "#FFFFFF", secondary: "#CE1141", accent: "#111111", pattern: "solid",
    description:
      "Sleeveless white jersey with red trim and a black number. Breathable mesh with a regular fit and wide shoulder straps. A clean, sporty look suited to daytime games and casual wear.",
  },
  {
    team: "chicago-bulls", kit: "away", price: 7400000,
    primary: "#CE1141", secondary: "#111111", accent: "#FFFFFF", pattern: "solid",
    description:
      "Sleeveless red jersey with black trim and a white number. Smooth, lightweight mesh with a relaxed fit. A strong, saturated red that stands out on court and in a crowd. A good pick for fans who like bold single colours.",
  },
  {
    team: "miami-heat", kit: "home", price: 7500000,
    primary: "#FFFFFF", secondary: "#98002E", accent: "#F9A01B", pattern: "solid",
    description:
      "Sleeveless white jersey with deep red trim and an amber number. Light, breathable mesh with a regular cut. A sharp, warm-weather option that stays cool in hot climates and photographs well.",
  },
  {
    team: "miami-heat", kit: "away", price: 7200000,
    primary: "#98002E", secondary: "#F9A01B", accent: "#111111", pattern: "solid",
    description:
      "Sleeveless dark red jersey with amber trim and a black number. Heavier mesh with a classic fit. A deep, rich colour that hides sweat marks, good for evening wear and for fans who like darker palettes.",
  },

  // ---------- Baseball (button-front) ----------
  {
    team: "new-york-yankees", kit: "home", price: 7200000,
    primary: "#FFFFFF", secondary: "#0C2340", accent: "#0C2340", pattern: "stripes",
    description:
      "Button-front white jersey with fine navy pinstripes and navy trim. Smooth, lightweight knit with a regular fit. A traditional, formal-looking design that works for the stands and for casual wear. Good for fans who like understated patterns over solid colours.",
  },
  {
    team: "new-york-yankees", kit: "away", price: 6900000,
    primary: "#C4CED4", secondary: "#0C2340", accent: "#0C2340", pattern: "solid",
    description:
      "Button-front grey jersey with navy trim and a navy number. Durable, mid-weight knit with a relaxed fit. A neutral, practical colour that is easy to pair with jeans and does not show dirt, good for everyday wear.",
  },
  {
    team: "los-angeles-dodgers", kit: "home", price: 7000000,
    primary: "#FFFFFF", secondary: "#005A9C", accent: "#005A9C", pattern: "solid",
    description:
      "Button-front white jersey with blue trim and a blue number. Lightweight breathable knit, regular fit. A bright, clean look suited to hot, sunny days and to fans who want a classic ballpark shirt.",
  },
  {
    team: "los-angeles-dodgers", kit: "away", price: 6700000,
    primary: "#A5ACAF", secondary: "#005A9C", accent: "#005A9C", pattern: "solid",
    description:
      "Button-front grey jersey with blue trim and a blue number. Mid-weight knit with a relaxed fit. Easy to layer with a tee or jacket, hides dirt well and works for everyday wear.",
  },
  {
    team: "boston-red-sox", kit: "home", price: 6800000,
    primary: "#FFFFFF", secondary: "#BD3039", accent: "#0C2340", pattern: "solid",
    description:
      "Button-front white jersey with red trim and a navy number. Smooth knit with a regular fit. Crisp and traditional, a strong choice for fans who prefer a white shirt with a single bold accent colour.",
  },
  {
    team: "boston-red-sox", kit: "away", price: 6500000,
    primary: "#0C2340", secondary: "#BD3039", accent: "#FFFFFF", pattern: "solid",
    description:
      "Button-front navy jersey with red trim and a white number. Heavier knit with a relaxed fit. A dark, premium colour that suits cooler evenings and hides sweat. Good for fans who like deeper colours.",
  },
  {
    team: "chicago-cubs", kit: "home", price: 6600000,
    primary: "#FFFFFF", secondary: "#0E3386", accent: "#CC3433", pattern: "stripes",
    description:
      "Button-front white jersey with blue pinstripes and a red number and trim. Lightweight knit with a regular fit. Subtle stripes add detail without looking busy. A good choice for daytime games and casual outfits.",
  },
  {
    team: "chicago-cubs", kit: "away", price: 6300000,
    primary: "#0E3386", secondary: "#CC3433", accent: "#FFFFFF", pattern: "solid",
    description:
      "Button-front royal-blue jersey with red trim and a white number. Mid-weight knit with a relaxed fit. A vivid blue that stands out in a crowd, and a good alternative to the white home jersey for fans who want a bolder colour.",
  },
];