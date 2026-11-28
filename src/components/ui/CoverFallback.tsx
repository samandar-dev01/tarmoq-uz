import { Icon } from "@/components/ui/Icon";

/**
 * The cover where a creator has not added a picture: a quiet panel, never a stand-in photograph (that would pass for
 * their work). Put it in a `relative`, `overflow-hidden` box; a picture laid over it hides it, and one that fails to
 * load shows it again.
 */
export function CoverFallback() {
  return (
    <span aria-hidden="true" className="absolute inset-0 grid place-items-center bg-gradient-to-br from-cobalt-tint to-paper-deep text-cobalt-dark">
      <Icon name="camera" size={36} className="opacity-70" />
    </span>
  );
}
