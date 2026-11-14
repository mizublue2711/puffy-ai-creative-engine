import React from "react";
import { Composition } from "remotion";
import remotionPropsSchema from "../../../config/schemas/remotion_props.schema.json";
import sampleProps from "../sample_props.json";
import {
  PuffyHeroComposition,
  type PuffyRemotionProps,
} from "./PuffyHeroComposition";

const FPS = 30;
const DEFAULT_FRAMES = remotionPropsSchema.properties.durationInFrames.default ?? 300;

export const RemotionRoot: React.FC = () => {
  const baseProps: PuffyRemotionProps = {
    durationInFrames: sampleProps.durationInFrames ?? DEFAULT_FRAMES,
    aspectRatio: sampleProps.aspectRatio as "16:9" | "9:16",
    kenBurnsZoomIntensity: sampleProps.kenBurnsZoomIntensity,
    mattressLayerTransition:
      sampleProps.mattressLayerTransition as "pillowy-float-in" | "fade-scale",
    brandBadgeAsset: sampleProps.brandBadgeAsset,
  };

  return (
    <>
      <Composition
        id="PuffyHeroVideo"
        component={PuffyHeroComposition}
        durationInFrames={baseProps.durationInFrames}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{
          ...baseProps,
          aspectRatio: "16:9",
        }}
      />
      <Composition
        id="PuffyHeroVertical"
        component={PuffyHeroComposition}
        durationInFrames={baseProps.durationInFrames}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          ...baseProps,
          aspectRatio: "9:16",
        }}
      />
    </>
  );
};
