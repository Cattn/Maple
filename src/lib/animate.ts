import { flip, type AnimationConfig, type FlipParams } from 'svelte/animate';

const offscreen = (rect: DOMRect) => rect.bottom < 0 || rect.top > window.innerHeight;

// flip, but items that stay offscreen skip the animation so large lists only animate what's visible
export function visibleFlip(
	node: Element,
	rects: { from: DOMRect; to: DOMRect },
	params?: FlipParams
): AnimationConfig {
	if (offscreen(rects.from) && offscreen(rects.to)) return { duration: 0 };
	return flip(node, rects, params);
}
