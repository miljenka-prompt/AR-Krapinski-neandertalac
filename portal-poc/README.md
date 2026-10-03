# Pleistocene Portal PoC

Standalone Android WebXR immersive-ar test. No Grog, video, existing spatial code, 8th Wall code or existing repository was changed.

## Test
Open deployed HTTPS URL directly in Android Chrome. Start AR, find a textured horizontal floor and place the portal. Move sideways and toward the opening. Foreground stones should shift more than distant trees; the frame should remain at its placement. Reset and try another location. Diagnostics distinguish XRAnchor from local-reference placement.

The scene is stylized procedural geometry, not a reconstruction of a named site. Vertical 1.35 × 2.05 m stencil aperture; floor pad; genuine depth layers. No video/images/AI or network APIs. Three.js 0.183.2 loads from jsDelivr (MIT); network access is required to load the engine. Camera handling belongs to WebXR; app records/uploads nothing.

## Limits
Requires Android/Chrome/ARCore-compatible device; Redmi compatibility must be measured, not assumed. Anchors optional; local reference still tracks 6DoF but drift may differ. Ground hit test does not classify floor vs table: user confirms ring is on floor. No real-world depth occlusion or traversal through portal; stay in front. Private hosting/login must allow top-level immersive-ar. Preview does not test AR. No persistent anchors after reload.
