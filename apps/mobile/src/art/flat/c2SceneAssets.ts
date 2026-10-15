import manifest from '../../../assets/c2/manifest.json';
import svg from '../../../assets/c2/svg.json';

/** Unmodified Figma SVG exports, bundled with their authored slot geometry. */
export const C2_ASSETS = svg;
export const C2_MANIFEST = manifest;

export type C2Layer = {
  asset: keyof typeof C2_ASSETS;
  nodeId?: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  bob?: number;
  fade?: number;
  pulse?: number;
  sway?: number;
  spin?: boolean;
};
export type C2SceneDefinition = {
  width: number;
  height: number;
  clip?: boolean;
  bob?: number;
  layers: readonly C2Layer[];
  badge?: { x: number; y: number; size: number; pulse: number };
};

const aliases = {
  fresh: 'brand',
  reset: 'email',
  saving: 'save',
  retry: 'save',
  age: 'pause',
  'orb-ready': 'orb-112',
  'orb-connecting': 'orb-112',
  'orb-listening': 'orb-112',
  'orb-thinking': 'orb-112',
  'orb-speaking': 'orb-112',
  'orb-error': 'orb-112',
} as const;

export type C2SceneKind = keyof typeof manifest.scenes | keyof typeof aliases;
export type C2Goal = keyof typeof manifest.goals;

/** Aliases retain callers' lifecycle states; the current C2 drawing owns the art. */
export function c2Scene(kind: C2SceneKind): C2SceneDefinition {
  const key = kind in aliases ? aliases[kind as keyof typeof aliases] : kind;
  return (key === 'brand' ? manifest.brand : manifest.scenes[key as keyof typeof manifest.scenes]) as C2SceneDefinition;
}

export function c2AssetSize(asset: keyof typeof C2_ASSETS): { width: number; height: number } {
  return manifest.assets[asset];
}
