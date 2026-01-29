
import { GoogleGenAI, Type } from "@google/genai";
import { TileType } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const ensureSafeSpawns = (map: number[][]) => {
  const spawnPoints = [
    { r: 0, c: 4 }, { r: 0, c: 8 },
    { r: 12, c: 4 }, { r: 12, c: 8 }
  ];

  spawnPoints.forEach(point => {
    // Clear a 2x2 or 3x3 area around spawn points to ensure tank can turn
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = point.r + dr;
        const nc = point.c + dc;
        if (nr >= 0 && nr < 13 && nc >= 0 && nc < 13) {
          // Don't clear the base or the spawn point itself
          const tile = map[nr][nc];
          if (tile !== TileType.BASE_PLAYER && tile !== TileType.BASE_ENEMY && tile !== TileType.SPAWN_POINT) {
            map[nr][nc] = TileType.EMPTY;
          }
        }
      }
    }
  });
  return map;
};

export const generateLevel = async (prompt: string): Promise<number[][] | null> => {
  const seed = Math.floor(Math.random() * 1000000);
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Design a high-quality 13x13 grid map for a tank battle game.
      Random Seed: ${seed}
      Theme/Biome: ${prompt}
      
      Tile Legend:
      0: Empty, 1: Brick, 2: Steel, 3: Bush, 4: Water, 5: Crate, 6: Spawn Point.
      
      Strict Constraints:
      - Size: Exactly 13x13.
      - Player Base at (12, 6): Must be 9.
      - Enemy Base at (0, 6): Must be 13.
      - Spawn Points are at (12, 4), (12, 8), (0, 4), (0, 8).
      - Place 5-8 crates (5) strategically.
      
      Return ONLY a JSON object: {"map": [[...]]}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            map: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER }
              }
            }
          },
          required: ["map"]
        }
      }
    });

    if (!response || !response.text) return null;

    const data = JSON.parse(response.text.trim());
    let finalMap = data.map;
    
    if (Array.isArray(finalMap) && finalMap.length === 13 && Array.isArray(finalMap[0]) && finalMap[0].length === 13) {
      // Enforce base and spawn positions
      finalMap[12][6] = TileType.BASE_PLAYER;
      finalMap[0][6] = TileType.BASE_ENEMY;
      finalMap[12][4] = TileType.SPAWN_POINT;
      finalMap[12][8] = TileType.SPAWN_POINT;
      finalMap[0][4] = TileType.SPAWN_POINT;
      finalMap[0][8] = TileType.SPAWN_POINT;
      
      // Clean up the areas around spawns to prevent sticking
      finalMap = ensureSafeSpawns(finalMap);
      
      return finalMap;
    }
    return null;
  } catch (error) {
    console.warn("AI Map Generation error (falling back to procedural):", error);
    return null;
  }
};
