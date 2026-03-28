export interface WorldLayerConfig {
  floorTexture: string;
  tileWidth: number;
  tileHeight: number;
}

export const DEFAULT_WORLD_LAYER: WorldLayerConfig = {
  floorTexture: "floor-lobby-1f.png",
  tileWidth: 64,
  tileHeight: 32,
};
