import { Application, Router } from "https://deno.land/x/oak/mod.ts";

// Typy danych
export type ApiNode = {
    isConnected: boolean;
    identifier: string;
    memory: string;
    cpu: string;
    connections: string;
    systemLoad: string;
    cpuCores: number;
    uptime: string;
    restVersion: string;
    info: {
        version: {
            major: number;
            minor: number;
            patch: number;
            semver: string;
            preRelease: string | null;
        };
        buildTime: number;
        git: {
            branch: string;
            commit: string;
            commitTime: number;
        };
        jvm: string;
        lavaplayer: string;
        sourceManagers: string[];
        filters: string[];
        plugins: {
            name: string;
            version: string;
        }[];
    };
    host: string;
    port: number;
    password: string;
    secure: boolean | null;
    createdAt: Date;
    updatedAt: Date;
    author: {
        username: string;
        url: string;
        avatar: string;
    };
};

type RawNode = {
    identifier: string;
    host: string;
    port: number;
    password: string;
    secure: boolean;
    restVersion: string;
    authorId: string;
};

// Dane z nodes.json (załadowane z URL)
const nodesUrl = "https://raw.githubusercontent.com/Vexlo/MuzesLavalinkList/main/nodes.json";
let nodes: RawNode[] = [];

async function loadNodes() {
    try {
        const response = await fetch(nodesUrl);
        nodes = await response.json();
        console.log("Successfully loaded nodes data");
    } catch (error) {
        console.error("Error loading nodes data:", error);
        nodes = [];
    }
}

// Inicjalizacja danych
await loadNodes();
// Odświeżanie danych co godzinę
setInterval(loadNodes, 3600000);

const app = new Application();
const router = new Router();

// Middleware do CORS
app.use(async (ctx, next) => {
    ctx.response.headers.set("Access-Control-Allow-Origin", "*");
    ctx.response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    await next();
});

// Główny endpoint
router.get("/", (ctx) => {
    ctx.response.body = {
        message: "Welcome to Muzes Lavalink API",
        endpoints: {
            sslNodes: "/ssl-nodes",
            nonSslNodes: "/non-ssl-nodes"
        },
        github: "https://github.com/Vexlo/MuzesLavalinkList"
    };
    ctx.response.status = 200;
});

// Endpoint dla SSL nodes
router.get("/ssl-nodes", async (ctx) => {
    try {
        const sslNodes = nodes.filter(node => node.secure);
        const formattedNodes = await formatNodes(sslNodes);
        ctx.response.body = formattedNodes;
        ctx.response.status = 200;
    } catch (error) {
        console.error("Error in /ssl-nodes:", error);
        ctx.response.status = 500;
        ctx.response.body = { error: "Internal server error" };
    }
});

// Endpoint dla non-SSL nodes
router.get("/non-ssl-nodes", async (ctx) => {
    try {
        const nonSslNodes = nodes.filter(node => !node.secure);
        const formattedNodes = await formatNodes(nonSslNodes);
        ctx.response.body = formattedNodes;
        ctx.response.status = 200;
    } catch (error) {
        console.error("Error in /non-ssl-nodes:", error);
        ctx.response.status = 500;
        ctx.response.body = { error: "Internal server error" };
    }
});

// Funkcja do pobierania statystyk Lavalink
async function fetchLavalinkStats(node: {
    host: string;
    port: number;
    password: string;
    secure: boolean;
    restVersion: string;
}): Promise<any> {
    const protocol = node.secure ? "https" : "http";
    const url = `${protocol}://${node.host}:${node.port}/${node.restVersion}/stats`;
    
    try {
        const response = await fetch(url, {
            headers: {
                Authorization: node.password,
            },
            // Timeout po 5 sekundach
            signal: AbortSignal.timeout(5000),
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`Error fetching stats from ${node.host}:${node.port}:`, error);
        return null;
    }
}

// Funkcja do formatowania danych nodów
async function formatNodes(rawNodes: RawNode[]): Promise<ApiNode[]> {
    const formattedNodes: ApiNode[] = [];
    
    for (const node of rawNodes) {
        try {
            const stats = await fetchLavalinkStats(node);
            
            const formattedNode: ApiNode = {
                isConnected: stats !== null,
                identifier: node.identifier,
                memory: stats?.memory?.used ? `${Math.round(stats.memory.used / 1024 / 1024)}MB` : "N/A",
                cpu: stats?.cpu?.systemLoad ? `${(stats.cpu.systemLoad * 100).toFixed(2)}%` : "N/A",
                connections: stats?.players ? stats.players.toString() : "0",
                systemLoad: stats?.cpu?.systemLoad ? stats.cpu.systemLoad.toFixed(4) : "0",
                cpuCores: stats?.cpu?.cores || 0,
                uptime: stats?.uptime ? formatUptime(stats.uptime) : "0s",
                restVersion: node.restVersion,
                info: stats?.version ? {
                    version: {
                        major: stats.version.semver.major,
                        minor: stats.version.semver.minor,
                        patch: stats.version.semver.patch,
                        semver: `${stats.version.semver.major}.${stats.version.semver.minor}.${stats.version.semver.patch}`,
                        preRelease: stats.version.semver.preRelease || null
                    },
                    buildTime: stats.version.buildTime,
                    git: {
                        branch: stats.version.git.branch,
                        commit: stats.version.git.commit,
                        commitTime: stats.version.git.commitTime
                    },
                    jvm: stats.jvm,
                    lavaplayer: stats.lavaplayer,
                    sourceManagers: stats.sourceManagers,
                    filters: stats.filters,
                    plugins: stats.plugins
                } : {
                    version: { major: 0, minor: 0, patch: 0, semver: "0.0.0", preRelease: null },
                    buildTime: 0,
                    git: { branch: "", commit: "", commitTime: 0 },
                    jvm: "",
                    lavaplayer: "",
                    sourceManagers: [],
                    filters: [],
                    plugins: []
                },
                host: node.host,
                port: node.port,
                password: node.password,
                secure: node.secure,
                createdAt: new Date(),
                updatedAt: new Date(),
                author: {
                    username: "Unknown",
                    url: `https://discord.com/users/${node.authorId}`,
                    avatar: `https://cdn.discordapp.com/avatars/${node.authorId}/default_avatar.png`
                }
            };
            
            formattedNodes.push(formattedNode);
        } catch (error) {
            console.error(`Error formatting node ${node.identifier}:`, error);
            // Dodaj podstawowe informacje o nodzie nawet jeśli nie udało się pobrać statystyk
            const offlineNode: ApiNode = {
                isConnected: false,
                identifier: node.identifier,
                memory: "N/A",
                cpu: "N/A",
                connections: "0",
                systemLoad: "0",
                cpuCores: 0,
                uptime: "0s",
                restVersion: node.restVersion,
                info: {
                    version: { major: 0, minor: 0, patch: 0, semver: "0.0.0", preRelease: null },
                    buildTime: 0,
                    git: { branch: "", commit: "", commitTime: 0 },
                    jvm: "",
                    lavaplayer: "",
                    sourceManagers: [],
                    filters: [],
                    plugins: []
                },
                host: node.host,
                port: node.port,
                password: node.password,
                secure: node.secure,
                createdAt: new Date(),
                updatedAt: new Date(),
                author: {
                    username: "Unknown",
                    url: `https://discord.com/users/${node.authorId}`,
                    avatar: `https://cdn.discordapp.com/avatars/${node.authorId}/default_avatar.png`
                }
            };
            formattedNodes.push(offlineNode);
        }
    }
    
    return formattedNodes;
}

// Funkcja do formatowania uptime
function formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

app.use(router.routes());
app.use(router.allowedMethods());

// Uruchomienie serwera na porcie określonym przez Deno Deploy
const port = Deno.env.get("PORT") || 8000;
console.log(`Server running on port ${port}`);
await app.listen({ port: Number(port) });
