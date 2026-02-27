/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'logo.clearbit.com' },
      { protocol: 'https', hostname: 'static.finnhub.io' },
      { protocol: 'https', hostname: 'static2.finnhub.io' },
    ],
  },
  env: {
    NEXT_PUBLIC_FINNHUB_KEY: process.env.NEXT_PUBLIC_FINNHUB_KEY,
    NEXT_PUBLIC_AV_KEY: process.env.NEXT_PUBLIC_AV_KEY,
  },
};

module.exports = nextConfig;
