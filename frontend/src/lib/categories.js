export const CATEGORIES = [
  { id: "all", label: "الكل", emoji: "✨" },
  { id: "adopt_me", label: "Adopt Me", emoji: "🐾" },
  { id: "grow_garden", label: "Grow a Garden", emoji: "🌱" },
  { id: "steal_brainrot", label: "Steal a Brainrot", emoji: "🧠" },
];

export const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id;
