const ICON_SOURCE_OVERRIDES: Record<string, string> = {
  css3: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/css3/css3-original.svg",
  visualstudiocode:
    "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vscode/vscode-original.svg",
  microsoftazure:
    "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/azure/azure-original.svg",
};

const ICON_COLORS: Record<string, string> = {
  html5: "e34f26",
  css3: "1572b6",
  sass: "cc6699",
  javascript: "f7df1e",
  typescript: "3178c6",
  tailwindcss: "06b6d4",
  php: "777bb4",
  react: "61dafb",
  nextdotjs: "000000",
  bootstrap: "7952b3",
  angular: "dd0031",
  laravel: "ff2d20",
  wordpress: "21759b",
  woocommerce: "96588a",
  graphql: "e10098",
  hubspot: "ff7a59",
  googletagmanager: "246fdb",
  git: "f05032",
  github: "181717",
  visualstudiocode: "007acc",
  figma: "f24e1e",
  postman: "ff6c37",
  vercel: "000000",
  microsoftazure: "0078d4",
};

export const DARK_INVERT_ICONS = new Set(["nextdotjs", "github", "vercel"]);

export function getTechIconUrl(icon: string): string {
  const overrideSrc = ICON_SOURCE_OVERRIDES[icon];
  if (overrideSrc) {
    return overrideSrc;
  }

  const color = ICON_COLORS[icon];
  return color ? `https://cdn.simpleicons.org/${icon}/${color}` : `https://cdn.simpleicons.org/${icon}`;
}

export function getInitials(label: string): string {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
