import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import brandTokens from "../../../config/brand_tokens.json";
import mockMattress from "../../../assets/catalog/mattresses/puffy-lux-hybrid/cutout_angle45_1200x720.png";
import mockBedroom from "../../../assets/catalog/mattresses/puffy-lux-hybrid/hero_nordic-bedroom_1920x1080.png";
import puffyLogo0 from "../../../assets/logos/Puffy_Logo_0.svg";
import puffyLogo3 from "../../../assets/logos/Puffy_Logo_3.svg";
import awardBadge from "../../../assets/catalog/trust-badges/awards/badge_ad-best-cooling-2026_vector.svg";

export type PuffyRemotionProps = {
  durationInFrames: number;
  aspectRatio: "16:9" | "9:16";
  kenBurnsZoomIntensity: number;
  mattressLayerTransition: "pillowy-float-in" | "fade-scale";
  brandBadgeAsset: string;
};

const LOGO_MAP: Record<string, string> = {
  "assets/logos/Puffy_Logo_0.svg": puffyLogo0,
  "assets/logos/Puffy_Logo_3.svg": puffyLogo3,
};

const BADGE_MAP: Record<string, string> = {
  "assets/catalog/trust-badges/awards/badge_ad-best-cooling-2026_vector.svg": awardBadge,
  "assets/badges/ad_best_cooling_2026.svg": awardBadge,
};

export const PuffyHeroComposition: React.FC<PuffyRemotionProps> = ({
  durationInFrames,
  aspectRatio,
  kenBurnsZoomIntensity,
  mattressLayerTransition,
  brandBadgeAsset,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const colors = brandTokens.colors.primary;
  const isVertical = aspectRatio === "9:16";
  const clampedZoom = Math.min(1.2, Math.max(1.05, kenBurnsZoomIntensity));

  const bgScale = interpolate(frame, [0, durationInFrames], [1, clampedZoom], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const entranceSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 80, mass: 1.1 },
  });

  const mattressOpacity = interpolate(frame, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const mattressTranslateY =
    mattressLayerTransition === "pillowy-float-in"
      ? interpolate(entranceSpring, [0, 1], [64, 0])
      : 0;

  const mattressScale =
    mattressLayerTransition === "fade-scale"
      ? interpolate(entranceSpring, [0, 1], [0.92, 1])
      : 1;

  const textOpacity = interpolate(frame, [15, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const logoSrc = LOGO_MAP[brandBadgeAsset] ?? puffyLogo0;
  const badgeSrc = BADGE_MAP[brandBadgeAsset] ?? awardBadge;
  const clearSpace = brandTokens.logo_geometry.minimum_clear_space_px;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.warm_linen.hex,
        fontFamily: brandTokens.typography.secondary.font_family,
        color: colors.navy_ink.hex,
        overflow: "hidden",
      }}
    >
      {/* Generative AI Environment Backdrop with Ken Burns zoom */}
      <AbsoluteFill
        style={{
          transform: `scale(${bgScale})`,
          transformOrigin: "center center",
        }}
      >
        <Img
          src={mockBedroom}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </AbsoluteFill>

      {/* Soft Warm Linen Scrim for Copy Legibility */}
      <AbsoluteFill
        style={{
          background: isVertical
            ? "linear-gradient(180deg, rgba(229,227,223,0.92) 0%, rgba(229,227,223,0.72) 48%, rgba(229,227,223,0.22) 100%)"
            : "linear-gradient(90deg, rgba(229,227,223,0.94) 0%, rgba(229,227,223,0.78) 46%, rgba(229,227,223,0.12) 100%)",
        }}
      />

      {/* Foreground Creative Layout */}
      <AbsoluteFill
        style={{
          padding: isVertical ? "64px 56px" : "48px 72px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Header: Logo with >=30px Clear Space + Award Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ padding: `${clearSpace}px`, margin: `-${clearSpace}px` }}>
            <Img
              src={logoSrc}
              style={{
                width: isVertical ? 140 : 128,
                minWidth: brandTokens.logo_geometry.minimum_size.width_px,
                height: "auto",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              backgroundColor: "rgba(255, 255, 255, 0.92)",
              padding: "10px 18px",
              borderRadius: 999,
              border: "1px solid rgba(43, 47, 68, 0.14)",
            }}
          >
            <Img src={badgeSrc} style={{ width: 38, height: 38 }} />
            <span style={{ fontWeight: 700, fontSize: isVertical ? 22 : 17 }}>
              Best Cooling Mattress 2026
            </span>
          </div>
        </div>

        {/* Main Content Grid */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: isVertical ? "1fr" : "1.05fr 1fr",
            alignItems: "center",
            gap: isVertical ? 32 : 44,
          }}
        >
          <div style={{ opacity: textOpacity }}>
            <div
              style={{
                fontSize: isVertical ? 22 : 16,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: colors.ocean_teal.hex,
                marginBottom: 14,
              }}
            >
              {brandTokens.value_propositions.aesthetic_tone_of_voice[0]} ·{" "}
              {brandTokens.value_propositions.aesthetic_tone_of_voice[3]}
            </div>

            <h1
              style={{
                fontFamily: brandTokens.typography.primary.font_family,
                fontSize: isVertical ? 70 : 66,
                lineHeight: 1.08,
                fontWeight: 700,
                margin: "0 0 20px",
                color: colors.navy_ink.hex,
              }}
            >
              Sleep Like You&rsquo;re Floating on a Cloud
            </h1>

            <p
              style={{
                fontSize: isVertical ? 28 : 22,
                lineHeight: 1.45,
                color: colors.onyx_black.hex,
                margin: "0 0 28px",
              }}
            >
              {brandTokens.value_propositions.sleep_trial} ·{" "}
              {brandTokens.value_propositions.warranty}
            </p>

            <div
              style={{
                display: "inline-flex",
                backgroundColor: colors.ocean_teal.hex,
                color: colors.pure_white.hex,
                fontWeight: 700,
                fontSize: isVertical ? 28 : 22,
                padding: isVertical ? "20px 42px" : "16px 34px",
                borderRadius: 12,
              }}
            >
              Shop Puffy Cloud
            </div>
          </div>

          {/* Unaltered Mattress Cutout Layer (Zero Product Drift) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: mattressOpacity,
              transform: `translateY(${mattressTranslateY}px) scale(${mattressScale})`,
            }}
          >
            <Img
              src={mockMattress}
              style={{
                width: isVertical ? "94%" : "100%",
                maxHeight: isVertical ? 680 : 620,
                objectFit: "contain",
              }}
            />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
