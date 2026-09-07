/** @type {import('next').NextConfig} */
const nextConfig = {
  // PDF raporu Inter'i gömüyor; bu dosyalar sunucu paketine dahil edilmeli.
  outputFileTracingIncludes: {
    "/api/[...route]": ["./assets/fonts/**"],
  },
  // Next'in otomatik ürettiği AGENTS.md / CLAUDE.md dosyaları istenmiyor.
  agentRules: false,
};

export default nextConfig;
