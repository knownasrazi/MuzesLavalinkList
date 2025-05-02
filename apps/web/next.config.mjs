/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    images: {
        disableStaticImages: true,
        domains: [
            "lh3.googleusercontent.com",
            "lavalink.moebot.pro",
            "cdn.discordapp.com",
        ],

    },
    async redirects() {
        return [
            {
                source: "/github",
                destination: "https://github.com/Vexlo/MuzesLavalinkList",
                permanent: false,
            },
        ];
    },
};

export default nextConfig;
