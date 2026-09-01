import type { MissionPlace } from '@luvani/core';
import { EveningIn, FrontDesk, HeroCafe, MarketStall, SpeakBubbles, StreetCorner } from '../illustrations.tsx';

/** One authored postcard per situation, shared by the chooser and My French. */
export function MissionArt({ place, width, paused = true }: { place: MissionPlace; width: number; paused?: boolean }) {
  switch (place) {
    case 'cafe':
      return <HeroCafe width={width} paused={paused} />;
    case 'friends':
      return <SpeakBubbles width={width} paused={paused} />;
    case 'street':
      return <StreetCorner width={width} paused={paused} />;
    case 'market':
      return <MarketStall width={width} paused={paused} />;
    case 'hotel':
      return <FrontDesk width={width} paused={paused} />;
    default:
      return <EveningIn width={width} paused={paused} />;
  }
}
