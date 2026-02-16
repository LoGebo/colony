import React from 'react';
import { Composition } from 'remotion';
import { ColonyAd } from './colony-ad/ColonyAd';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ColonyAd"
        component={ColonyAd}
        durationInFrames={720}
        width={1080}
        height={1920}
        fps={24}
        defaultProps={{}}
      />
    </>
  );
};
