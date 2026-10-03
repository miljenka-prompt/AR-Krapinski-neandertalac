# Isolated portal PoC v4

XR8 browser SLAM using the same engine stack as spatial-v2. No ARCore requirement. No edits outside portal-poc.

A fixed upright aperture clips interior fragments by intersecting each camera ray with the portal plane. Camera movement gives geometric parallax. Phone starts at an assumed height of 1.4 in responsive XR8 coordinates; placement intersects the center camera ray with y=0. This is an estimated reference floor, not detected floor or an XRAnchor. Dimensions are approximate. Stay in front of the portal.

Scenery is placeholder geometry for tracking tests, not a realistic forest. Physical-device camera, drift, and depth tests are pending. The previous native WebXR app.js remains archived and is not loaded by index.html.
