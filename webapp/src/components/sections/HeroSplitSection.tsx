import { PuffyFloatingHero3D } from "../canvas/puffy-hero-3d/PuffyFloatingHero3D";

export function HeroSplitSection() {
  return (
    <section
      className="showroom-3d-stage"
      aria-label="Puffy 3D Interactive Mattress Showroom"
    >
      <div className="hero-split-left-column">
        <PuffyFloatingHero3D viewport="desktop" selectedSize="Queen" />
      </div>
    </section>
  );
}
