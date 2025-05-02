export interface LavalinkStats {
    players: number;
    playingPlayers: number;
    uptime: number;
    memory: {
        free: number;
        used: number;
        allocated: number;
        reservable: number;
    };
    cpu: {
        cores: number;
        systemLoad: number;
        lavalinkLoad: number;
    };
    frameStats?: {
        sent?: number;
        nulled?: number;
        deficit?: number;
    };
    version: {
        semver: {
            major: number;
            minor: number;
            patch: number;
            preRelease?: string;
        };
        buildTime: number;
        git: {
            branch: string;
            commit: string;
            commitTime: number;
        };
    };
    jvm: string;
    lavaplayer: string;
    sourceManagers: string[];
    filters: string[];
    plugins: {
        name: string;
        version: string;
    }[];
}

export interface LavalinkNode {
    host: string;
    port: number;
    password: string;
    secure: boolean;
    restVersion: string;
}

export async function fetchLavalinkStats(
    node: LavalinkNode,
    timeoutMs = 5000
): Promise<LavalinkStats | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const protocol = node.secure ? "https" : "http";
    const url = `${protocol}://${node.host}:${node.port}/${node.restVersion}/stats`;
    
    try {
        const response = await fetch(url, {
            headers: {
                Authorization: node.password,
                'Accept': 'application/json'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeout);

        if (!response.ok) {
            console.error(`HTTP error from ${node.host}:${node.port} - Status: ${response.status}`);
            return null;
        }

        const stats = await response.json() as LavalinkStats;
        
        // Basic validation
        if (!stats || typeof stats.players !== 'number') {
            console.error(`Invalid response from ${node.host}:${node.port}`);
            return null;
        }

        return stats;
    } catch (error) {
        clearTimeout(timeout);
        
        if (error.name === 'AbortError') {
            console.error(`Timeout (${timeoutMs}ms) fetching stats from ${node.host}:${node.port}`);
        } else {
            console.error(`Error fetching stats from ${node.host}:${node.port}:`, 
                error instanceof Error ? error.message : error);
        }
        
        return null;
    } finally {
        clearTimeout(timeout);
    }
}
